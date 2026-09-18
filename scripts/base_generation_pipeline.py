"""Adaptive, resumable orchestration of the managed base-image generation run.

Mixed mode first generates one candidate from each provider per brief, then
adaptively directs any needed follow-up candidates (up to the per-brief
cap) toward whichever provider has performed better for that scene family
so far in this run. A brief whose candidates all fail is replaced with a
fresh brief from the same portfolio bucket rather than weakening its
prompt or thresholds. The budget is checked before every provider call,
and every state transition is persisted immediately so an interrupted run
can resume without regenerating completed candidates.
"""

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from base_generation_policy import validate_run_config
from base_generation_types import CandidateEvaluation, NormalizedCandidate, ProviderRequest
from base_prompt_composer import compose_prompt
from base_run_store import RUN_ROOT_DEFAULT, RunStore, ledger_state_for_rejection_code
from base_scene_catalog import build_batch_plan

_RETRYABLE_KINDS = {"rate_limit", "server_error", "timeout"}
_BACKOFFS = (1, 3)

_DEFAULT_PROVIDER_MODELS = {
    "google": "gemini-3.1-flash-image",
    "openai": "gpt-image-2.5-sunburst",
}

_RESUMABLE_STATES = {"planned", "generating"}
_TERMINAL_REJECTED_STATES = {"locally_rejected", "critic_rejected", "novelty_rejected"}
_ALREADY_HANDLED_STATES = {"selected", "structural_failed", "finalized", "published"}

_BUDGET_EXHAUSTED = object()


class ProviderCallError(Exception):
    """Raised by an injected provider call site to classify a failure for retry."""

    def __init__(self, message: str, kind: str):
        super().__init__(message)
        self.kind = kind


class _Budget:
    """Tracks the image-generation budget against the single real point of
    spend: the moment a provider is actually called. Checking and consuming
    happen together so a resumed or retried candidate is counted exactly
    once, no matter how many ledger states it passed through to get there.
    """

    def __init__(self, limit: int, already_used: int = 0):
        self._limit = limit
        self._used = already_used

    @property
    def used(self) -> int:
        return self._used

    def has_room(self) -> bool:
        return self._used < self._limit

    def consume(self) -> None:
        self._used += 1


@dataclass(frozen=True)
class BatchRunResult:
    run_id: str
    accepted: tuple
    generated_image_count: int
    requested_count: int
    stop_code: str


class BaseGenerationPipeline:
    def __init__(
        self,
        policy,
        briefs,
        providers: dict,
        evaluator,
        history_store,
        staging_root: str = RUN_ROOT_DEFAULT,
        sleeper=time.sleep,
        prompt_composer=compose_prompt,
        normalize=None,
        provider_models: Optional[dict] = None,
    ):
        self._policy = policy
        self._briefs = list(briefs)
        self._providers = providers
        self._evaluator = evaluator
        self._history_store = history_store
        self._staging_root = staging_root
        self._sleeper = sleeper
        self._prompt_composer = prompt_composer
        self._normalize = normalize or _lazy_normalize
        self._provider_models = provider_models or dict(_DEFAULT_PROVIDER_MODELS)

    def _call_with_retry(self, fn):
        attempt = 0
        while True:
            try:
                return fn()
            except ProviderCallError as exc:
                if exc.kind not in _RETRYABLE_KINDS or attempt >= len(_BACKOFFS):
                    raise
                self._sleeper(_BACKOFFS[attempt])
                attempt += 1

    def _initial_providers(self, provider_mode: str) -> list:
        if provider_mode == "mixed":
            return ["google", "openai"]
        return [provider_mode]

    def _stronger_provider(self, stats: dict, family: str) -> str:
        def ratio(provider: str) -> float:
            record = stats[provider][family]
            return (record["accepted"] / record["attempted"]) if record["attempted"] else 0.0

        return max(("google", "openai"), key=lambda p: (ratio(p), p == "google"))

    def _candidates_dir(self, store: RunStore) -> Path:
        directory = store.run_dir / "candidates"
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def _report_data(self, brief, provider_name, normalized, evaluation) -> dict:
        data = {
            "scene_brief_id": brief.id,
            "provider": provider_name,
            "model": normalized.model,
            "master_path": normalized.master_path,
            "rejection_reason": evaluation.rejection_reason,
        }
        if evaluation.critic is not None:
            data.update(
                {
                    "photorealism": evaluation.critic.photorealism,
                    "object_integrity": evaluation.critic.object_integrity,
                    "scene_coherence": evaluation.critic.scene_coherence,
                    "visual_fun": evaluation.critic.visual_fun,
                    "composition": evaluation.critic.composition,
                }
            )
        if evaluation.novelty_score is not None:
            data["novelty_score"] = evaluation.novelty_score
        if evaluation.rank_score is not None:
            data["rank_score"] = evaluation.rank_score
        return data

    def _generate_and_evaluate(
        self, store, brief, provider_name, candidate_id, recent_history, budget, resume_state=None
    ):
        """Run (or resume) one candidate from wherever its ledger left off.

        `resume_state` is the candidate's already-persisted state, or None for
        a brand-new candidate id. Each step below is skipped if the ledger
        already recorded it, so re-entering after a crash never attempts an
        illegal backward or repeated transition.
        """
        prompt = self._prompt_composer(brief, self._policy)
        request = ProviderRequest(
            provider=provider_name,
            model=self._provider_models[provider_name],
            prompt=prompt,
            scene_brief_id=brief.id,
            size=self._policy.master_size,
        )

        if resume_state is None:
            store.transition(candidate_id, "planned", {"scene_brief_id": brief.id, "provider": provider_name})
            resume_state = "planned"

        if resume_state == "planned":
            store.transition(
                candidate_id, "generating", {"scene_brief_id": brief.id, "provider": provider_name}
            )
            resume_state = "generating"

        # resume_state == "generating" from here: the actual provider call, the one real
        # point of spend, is checked and counted together so it can never be double-counted
        # or skipped regardless of how this candidate got here.
        if not budget.has_room():
            return _BUDGET_EXHAUSTED
        budget.consume()

        try:
            images = self._call_with_retry(lambda: self._providers[provider_name].generate(request))
        except ProviderCallError as exc:
            store.transition(
                candidate_id,
                "locally_rejected",
                {
                    "scene_brief_id": brief.id,
                    "provider": provider_name,
                    "rejection_reason": f"generation failed: {exc}",
                },
            )
            return None

        image = images[0]
        store.transition(
            candidate_id,
            "generated",
            {"scene_brief_id": brief.id, "provider": provider_name, "model": image.model},
        )

        output_path = str(self._candidates_dir(store) / f"{candidate_id}.png")
        try:
            normalized = self._normalize(image, request, output_path, self._policy)
        except ValueError as exc:
            store.transition(
                candidate_id,
                "locally_rejected",
                {
                    "scene_brief_id": brief.id,
                    "provider": provider_name,
                    "rejection_reason": f"normalization failed: {exc}",
                },
            )
            return None

        store.transition(
            candidate_id,
            "normalized",
            {
                "scene_brief_id": brief.id,
                "provider": provider_name,
                "model": normalized.model,
                "master_path": normalized.master_path,
            },
        )

        evaluation = self._evaluator.evaluate(normalized, brief, recent_history)
        ledger_state = (
            "passing" if evaluation.accepted else ledger_state_for_rejection_code(evaluation.rejection_code)
        )
        store.transition(candidate_id, ledger_state, self._report_data(brief, provider_name, normalized, evaluation))
        return candidate_id, evaluation

    def _reconstruct_normalized(self, brief, provider_name, candidate_id, data) -> NormalizedCandidate:
        return NormalizedCandidate(
            scene_brief_id=brief.id,
            provider=provider_name,
            model=data.get("model", ""),
            request_id=candidate_id,
            master_path=data.get("master_path", ""),
            size=tuple(self._policy.master_size),
            normalization_crop_fraction=0.0,
        )

    def _reload_or_generate(self, store, brief, provider_name, candidate_id, recent_history, budget):
        state = store.state_of(candidate_id)

        if state is None or state in _RESUMABLE_STATES:
            return self._generate_and_evaluate(
                store, brief, provider_name, candidate_id, recent_history, budget, resume_state=state
            )

        if state == "generated":
            # The provider call already succeeded, but the run was interrupted before
            # normalization, and the raw provider bytes were never persisted to disk (only
            # the normalized master is written). The ledger has no "generated -> generating"
            # edge to retry in place, so this id is left as a harmless, permanently
            # incomplete record and a fresh id retries the whole attempt from scratch.
            retry_id = f"{candidate_id}-retry"
            return self._generate_and_evaluate(
                store, brief, provider_name, retry_id, recent_history, budget, resume_state=None
            )

        if state in _TERMINAL_REJECTED_STATES or state in _ALREADY_HANDLED_STATES:
            return None  # already known-final; never regenerate a completed candidate

        data = store.data_of(candidate_id)

        if state == "normalized":
            # The master image already exists on disk; re-run evaluation without
            # a new provider call.
            normalized = self._reconstruct_normalized(brief, provider_name, candidate_id, data)
            evaluation = self._evaluator.evaluate(normalized, brief, recent_history)
            ledger_state = (
                "passing"
                if evaluation.accepted
                else ledger_state_for_rejection_code(evaluation.rejection_code)
            )
            store.transition(
                candidate_id, ledger_state, self._report_data(brief, provider_name, normalized, evaluation)
            )
            return candidate_id, evaluation

        if state == "passing":
            normalized = self._reconstruct_normalized(brief, provider_name, candidate_id, data)
            evaluation = CandidateEvaluation(
                candidate=normalized,
                passed_local_gates=True,
                local_gate_failures=(),
                critic=None,
                novelty_score=data.get("novelty_score"),
                rank_score=data.get("rank_score", 0.0),
                accepted=True,
            )
            return candidate_id, evaluation

        return None

    def _cleanup_rejected(self, store, config) -> None:
        if config.keep_rejected:
            return

        keep_paths = {
            record["data"]["master_path"]
            for record in store.all_items().values()
            if record["state"] in ("selected", "finalized", "published") and record["data"].get("master_path")
        }
        for record in store.all_items().values():
            if record["state"] not in ("locally_rejected", "critic_rejected", "novelty_rejected", "passing"):
                continue
            master_path = record["data"].get("master_path")
            if not master_path or master_path in keep_paths:
                continue
            path = Path(master_path)
            if path.exists():
                path.unlink()

    def _remaining_by_family_after_resume(self, store, quotas):
        remaining = dict(quotas)
        brief_family = {brief.id: brief.scene_family for brief in self._briefs}
        for record in store.all_items().values():
            if record["state"] not in ("selected", "finalized", "published"):
                continue
            family = brief_family.get(record["data"].get("scene_brief_id"))
            if family and remaining.get(family, 0) > 0:
                remaining[family] -= 1
        return remaining

    def run(self, config, run_id: Optional[str] = None, resume: bool = False) -> BatchRunResult:
        validate_run_config(config, self._policy)

        recent_history = self._history_store.recent(limit=self._policy.recent_history_window)

        if resume:
            store = RunStore.resume(run_id, root=self._staging_root)
            plan = [brief for brief in self._briefs if brief.id in store.plan_ids]
        else:
            plan = build_batch_plan(self._briefs, recent_history, config, self._policy)
            store = RunStore.create(config, plan, root=self._staging_root, run_id=run_id)

        quotas = self._policy.portfolio_counts(config.count)
        remaining_by_family = self._remaining_by_family_after_resume(store, quotas)

        used_brief_ids = {brief.id for brief in plan}
        spare_by_family = {
            family: [
                brief
                for brief in self._briefs
                if brief.scene_family == family and brief.id not in used_brief_ids
            ]
            for family in quotas
        }

        provider_stats = {
            provider: {family: {"accepted": 0, "attempted": 0} for family in quotas}
            for provider in ("google", "openai")
        }

        already_used = sum(
            1 for record in store.all_items().values() if record["state"] != "planned"
        )
        budget = _Budget(config.max_images, already_used=already_used)
        accepted = []
        stop_code = None
        queue = list(plan)

        while queue and sum(remaining_by_family.values()) > 0:
            brief = queue.pop(0)
            family = brief.scene_family
            if remaining_by_family.get(family, 0) <= 0:
                continue

            evaluations = []
            attempts = 0
            candidate_index = 0
            max_per_brief = self._policy.max_candidates_per_brief

            for provider_name in self._initial_providers(config.provider_mode):
                if attempts >= max_per_brief:
                    break
                candidate_id = f"{brief.id}::{provider_name}::{candidate_index}"
                candidate_index += 1
                attempts += 1
                result = self._reload_or_generate(store, brief, provider_name, candidate_id, recent_history, budget)
                if result is _BUDGET_EXHAUSTED:
                    stop_code = "GenerationBudgetReached"
                    break
                provider_stats[provider_name][family]["attempted"] += 1
                if result is not None:
                    evaluations.append(result)
                    if result[1].accepted:
                        provider_stats[provider_name][family]["accepted"] += 1

            while (
                stop_code is None
                and attempts < max_per_brief
                and not any(evaluation.accepted for _, evaluation in evaluations)
                and config.provider_mode == "mixed"
            ):
                provider_name = self._stronger_provider(provider_stats, family)
                candidate_id = f"{brief.id}::{provider_name}::{candidate_index}"
                candidate_index += 1
                attempts += 1
                result = self._reload_or_generate(store, brief, provider_name, candidate_id, recent_history, budget)
                if result is _BUDGET_EXHAUSTED:
                    stop_code = "GenerationBudgetReached"
                    break
                provider_stats[provider_name][family]["attempted"] += 1
                if result is not None:
                    evaluations.append(result)
                    if result[1].accepted:
                        provider_stats[provider_name][family]["accepted"] += 1

            accepted_pairs = [(cid, ev) for cid, ev in evaluations if ev.accepted]
            if accepted_pairs:
                winner_id, winner = max(accepted_pairs, key=lambda pair: (pair[1].rank_score, pair[0]))
                store.transition(winner_id, "selected", {"scene_brief_id": brief.id})
                accepted.append(winner)
                remaining_by_family[family] -= 1
            elif spare_by_family.get(family):
                queue.append(spare_by_family[family].pop(0))

            if stop_code is not None:
                break

        if stop_code is None:
            stop_code = "Completed" if sum(remaining_by_family.values()) <= 0 else "PlanExhausted"

        self._cleanup_rejected(store, config)

        return BatchRunResult(
            run_id=store.run_id,
            accepted=tuple(accepted),
            generated_image_count=budget.used,
            requested_count=config.count,
            stop_code=stop_code,
        )


def _lazy_normalize(image, request, output_path, policy):
    from base_image_provider import normalize_provider_image  # lazy: avoids a hard Pillow dependency at import time

    return normalize_provider_image(image, request, output_path, policy)
