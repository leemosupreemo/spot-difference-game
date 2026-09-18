"""Local computer-vision gates, semantic critic dispatch, novelty scoring,
and deterministic ranking for a normalized generation candidate.

Photorealism and editability are hard gates: a strong novelty or fun score
can never compensate for failing either. Local gates run first (cheap,
free) so a locally-failing candidate never reaches the paid semantic
critic.
"""

from typing import Callable, Optional

from base_generation_types import CandidateEvaluation, NormalizedCandidate, SceneBrief
from base_visual_critic import VisualCritic


def _default_route_canvas(image_path: str) -> dict:
    from scene_affordance_router import SceneAffordanceRouter  # lazy: heavy CV deps

    return SceneAffordanceRouter.evaluate_and_route_canvas(image_path)


def _default_hash_image(image_path: str, hash_size: int = 8) -> int:
    from PIL import Image  # lazy: keeps this module importable without Pillow installed

    with Image.open(image_path) as img:
        resized = img.convert("L").resize(
            (hash_size + 1, hash_size), Image.Resampling.LANCZOS
        )
        pixels = list(resized.getdata())

    width = hash_size + 1
    rows = [pixels[row * width : (row + 1) * width] for row in range(hash_size)]

    value = 0
    for row in rows:
        for left, right in zip(row, row[1:]):
            value = (value << 1) | (1 if left > right else 0)
    return value


def _hamming_distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _history_field(entry, name, default=None):
    if isinstance(entry, dict):
        return entry.get(name, default)
    return getattr(entry, name, default)


def _rejected(candidate, gate_passed, gate_failures, critic, novelty_score, code, reason):
    return CandidateEvaluation(
        candidate=candidate,
        passed_local_gates=gate_passed,
        local_gate_failures=gate_failures,
        critic=critic,
        novelty_score=novelty_score,
        rank_score=None,
        accepted=False,
        rejection_reason=reason,
        rejection_code=code,
    )


class BaseCandidateEvaluator:
    def __init__(
        self,
        critic: VisualCritic,
        policy,
        route_canvas: Optional[Callable[[str], dict]] = None,
        hash_image: Optional[Callable[[str], int]] = None,
    ):
        self._critic = critic
        self._policy = policy
        self._route_canvas = route_canvas or _default_route_canvas
        self._hash_image = hash_image or _default_hash_image

    def _run_local_gates(self, master_path: str):
        route_result = self._route_canvas(master_path)

        if not route_result.get("approved", False):
            reason = route_result.get("reason", "local gate rejected the image")
            return False, (f"LocalGateReject: {reason}",), "LocalGateReject", reason, route_result

        policy = self._policy
        metrics = route_result.get("metrics", {})
        failures = []

        checks = (
            (
                metrics.get("sharpness_uniformity", 0.0) < policy.min_sharpness_uniformity,
                "SharpnessUniformityReject",
                f"sharpness_uniformity {metrics.get('sharpness_uniformity')} below "
                f"{policy.min_sharpness_uniformity}",
            ),
            (
                metrics.get("edge_density", 0.0) < policy.min_edge_density,
                "EdgeDensityReject",
                f"edge_density {metrics.get('edge_density')} below {policy.min_edge_density}",
            ),
            (
                route_result.get("object_count", 0) < policy.min_detected_objects,
                "ObjectCountReject",
                f"object_count {route_result.get('object_count')} below "
                f"{policy.min_detected_objects}",
            ),
            (
                route_result.get("candidate_count", 0) < policy.min_editable_targets,
                "EditableTargetReject",
                f"candidate_count {route_result.get('candidate_count')} below "
                f"{policy.min_editable_targets}",
            ),
            (
                route_result.get("peer_group_count", 0) < policy.min_peer_groups,
                "PeerGroupReject",
                f"peer_group_count {route_result.get('peer_group_count')} below "
                f"{policy.min_peer_groups}",
            ),
            (
                metrics.get("largest_foreground_pct", 0.0)
                > policy.max_foreground_object_fraction * 100,
                "HeroObjectReject",
                f"largest_foreground_pct {metrics.get('largest_foreground_pct')} above "
                f"{policy.max_foreground_object_fraction * 100}",
            ),
            (
                max(route_result.get("affordances", {}).values(), default=0.0)
                < policy.min_structural_affordance,
                "StructuralAffordanceReject",
                f"no structural affordance reached {policy.min_structural_affordance}",
            ),
        )

        for failed, code, message in checks:
            if failed:
                failures.append(f"{code}: {message}")

        if failures:
            first_code = failures[0].split(":", 1)[0]
            first_reason = failures[0].split(": ", 1)[1]
            return False, tuple(failures), first_code, first_reason, route_result

        return True, (), None, None, route_result

    def _score_novelty(self, candidate: NormalizedCandidate, brief: SceneBrief, history):
        policy = self._policy
        window = list(history)[-policy.recent_history_window :] if history else []
        candidate_hash = self._hash_image(candidate.master_path)

        min_distance = None
        for entry in window:
            entry_hash = _history_field(entry, "phash")
            if entry_hash is None:
                continue
            distance = _hamming_distance(candidate_hash, int(entry_hash))
            if min_distance is None or distance < min_distance:
                min_distance = distance

        is_duplicate = (
            min_distance is not None and min_distance <= policy.novelty_duplicate_hamming_distance
        )

        candidate_tags = (
            set(brief.object_families)
            | set(brief.materials)
            | {brief.domain, brief.layout, brief.palette}
        )

        overlap_hits = 0
        for entry in window:
            entry_tags = set(_history_field(entry, "tags", ()) or ())
            if candidate_tags & entry_tags:
                overlap_hits += 1

        overlap_ratio = (overlap_hits / len(window)) if window else 0.0
        novelty_score = 0.0 if is_duplicate else max(0.0, 1.0 - overlap_ratio)

        return novelty_score, is_duplicate

    def _rank_score(self, route_result, critic, novelty_score: float) -> float:
        policy = self._policy
        affordances = route_result.get("affordances", {})
        editability = max(affordances.values(), default=0.0)
        fun = critic.visual_fun / 10.0
        composition = critic.composition / 10.0
        multi_op_support = (
            sum(1 for score in affordances.values() if score >= policy.min_structural_affordance)
            / len(affordances)
            if affordances
            else 0.0
        )

        return (
            policy.rank_weight_editability * editability
            + policy.rank_weight_novelty * novelty_score
            + policy.rank_weight_fun * fun
            + policy.rank_weight_composition * composition
            + policy.rank_weight_multi_operation * multi_op_support
        )

    def evaluate(
        self, candidate: NormalizedCandidate, brief: SceneBrief, history
    ) -> CandidateEvaluation:
        gates_passed, failures, code, reason, route_result = self._run_local_gates(
            candidate.master_path
        )
        if not gates_passed:
            return _rejected(candidate, False, failures, None, None, code, reason)

        critic_result = self._critic.evaluate(candidate.master_path, brief)

        if critic_result.artifact_flags:
            reason = f"artifact flags detected: {', '.join(critic_result.artifact_flags)}"
            return _rejected(
                candidate, True, (), critic_result, None, "ArtifactFlagged", reason
            )

        policy = self._policy
        if critic_result.photorealism < policy.min_photorealism:
            reason = (
                f"photorealism {critic_result.photorealism} below {policy.min_photorealism}"
            )
            return _rejected(
                candidate, True, (), critic_result, None, "PhotorealismReject", reason
            )

        if critic_result.object_integrity < policy.min_object_integrity:
            reason = (
                f"object_integrity {critic_result.object_integrity} below "
                f"{policy.min_object_integrity}"
            )
            return _rejected(
                candidate, True, (), critic_result, None, "ObjectIntegrityReject", reason
            )

        novelty_score, is_duplicate = self._score_novelty(candidate, brief, history)
        if is_duplicate:
            return _rejected(
                candidate,
                True,
                (),
                critic_result,
                novelty_score,
                "PerceptualDuplicateReject",
                "perceptual hash within the recent-history duplicate boundary",
            )

        rank_score = self._rank_score(route_result, critic_result, novelty_score)

        return CandidateEvaluation(
            candidate=candidate,
            passed_local_gates=True,
            local_gate_failures=(),
            critic=critic_result,
            novelty_score=novelty_score,
            rank_score=rank_score,
            accepted=True,
        )


def rank_candidates(candidates) -> Optional[CandidateEvaluation]:
    accepted = [c for c in candidates if c.accepted]
    if not accepted:
        return None
    return max(accepted, key=lambda c: (c.rank_score, c.candidate.request_id))
