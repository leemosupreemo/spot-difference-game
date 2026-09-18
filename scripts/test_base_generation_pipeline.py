import json
import os
import tempfile
import unittest
from pathlib import Path

from base_candidate_evaluator import BaseCandidateEvaluator, rank_candidates
from base_generation_pipeline import BaseGenerationPipeline, ProviderCallError, _Budget
from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from base_generation_report import write_html_report, write_json_report
from base_generation_types import (
    CandidateEvaluation,
    NormalizedCandidate,
    ProviderImage,
    RunConfig,
    SceneBrief,
    VisualCriticResult,
)
from base_run_store import AcceptedHistoryStore, RunStore
from base_visual_critic import FakeVisualCritic

SAMPLE_BRIEF = SceneBrief(
    id="forest_survey_table",
    scene_family="activity",
    domain="field_science",
    setting="a forest survey table",
    object_families=("leaf samples", "sample jars", "magnifiers", "survey flags"),
    materials=("glass", "paper", "wood", "botanical matter"),
    layout="three_quarter_work_surface",
    palette="moss_green_amber",
    density_target=(35, 70),
    desired_operations=("add", "remove", "reorder"),
)


def make_candidate(request_id="req-1", scene_brief_id="forest_survey_table"):
    return NormalizedCandidate(
        scene_brief_id=scene_brief_id,
        provider="google",
        model="gemini-3.1-flash-image",
        request_id=request_id,
        master_path=f"/staging/{request_id}.png",
        size=(1536, 1152),
        normalization_crop_fraction=0.001,
    )


PASSING_ROUTE_RESULT = {
    "approved": True,
    "object_count": 30,
    "candidate_count": 12,
    "peer_group_count": 3,
    "affordances": {"add": 0.6, "remove": 0.5, "reorder": 0.55, "recolor": 0.3},
    "metrics": {
        "sharpness_uniformity": 0.4,
        "edge_density": 0.05,
        "largest_foreground_pct": 10.0,
    },
}


def route_result_with(**overrides):
    result = {
        "approved": True,
        "object_count": PASSING_ROUTE_RESULT["object_count"],
        "candidate_count": PASSING_ROUTE_RESULT["candidate_count"],
        "peer_group_count": PASSING_ROUTE_RESULT["peer_group_count"],
        "affordances": dict(PASSING_ROUTE_RESULT["affordances"]),
        "metrics": dict(PASSING_ROUTE_RESULT["metrics"]),
    }
    result.update({k: v for k, v in overrides.items() if k != "metrics"})
    if "metrics" in overrides:
        result["metrics"].update(overrides["metrics"])
    return result


def make_evaluator(critic=None, route_canvas=None, hash_image=None, policy=None):
    return BaseCandidateEvaluator(
        critic=critic or FakeVisualCritic(),
        policy=policy or DEFAULT_BASE_GENERATION_POLICY,
        route_canvas=route_canvas or (lambda path: PASSING_ROUTE_RESULT),
        hash_image=hash_image or (lambda path: hash(path) & ((1 << 64) - 1)),
    )


class TestLocalGates(unittest.TestCase):
    def test_passing_candidate_reaches_critic_and_is_accepted(self):
        evaluator = make_evaluator()
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertTrue(result.passed_local_gates)
        self.assertTrue(result.accepted)
        self.assertIsNone(result.rejection_code)

    def test_router_rejection_short_circuits_before_critic(self):
        critic_calls = []

        class TrackingCritic:
            def evaluate(self, image_path, brief):
                critic_calls.append(image_path)
                return FakeVisualCritic().evaluate(image_path, brief)

        evaluator = make_evaluator(
            critic=TrackingCritic(),
            route_canvas=lambda path: {"approved": False, "reason": "too dark"},
        )
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.passed_local_gates)
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "LocalGateReject")
        self.assertEqual(critic_calls, [])

    def test_object_count_below_threshold_is_rejected(self):
        evaluator = make_evaluator(route_canvas=lambda path: route_result_with(object_count=5))
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "ObjectCountReject")

    def test_editable_target_below_threshold_is_rejected(self):
        evaluator = make_evaluator(route_canvas=lambda path: route_result_with(candidate_count=2))
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "EditableTargetReject")

    def test_peer_group_below_threshold_is_rejected(self):
        evaluator = make_evaluator(route_canvas=lambda path: route_result_with(peer_group_count=1))
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "PeerGroupReject")

    def test_hero_object_above_threshold_is_rejected(self):
        evaluator = make_evaluator(
            route_canvas=lambda path: route_result_with(metrics={"largest_foreground_pct": 40.0})
        )
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "HeroObjectReject")

    def test_sharpness_uniformity_below_threshold_is_rejected(self):
        evaluator = make_evaluator(
            route_canvas=lambda path: route_result_with(metrics={"sharpness_uniformity": 0.1})
        )
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "SharpnessUniformityReject")

    def test_edge_density_below_threshold_is_rejected(self):
        evaluator = make_evaluator(
            route_canvas=lambda path: route_result_with(metrics={"edge_density": 0.001})
        )
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "EdgeDensityReject")

    def test_weak_structural_affordance_is_rejected(self):
        evaluator = make_evaluator(
            route_canvas=lambda path: route_result_with(
                affordances={"add": 0.1, "remove": 0.1, "reorder": 0.1, "recolor": 0.1}
            )
        )
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertEqual(result.rejection_code, "StructuralAffordanceReject")


class TestCriticHardGates(unittest.TestCase):
    def test_photorealism_is_a_hard_gate(self):
        critic = FakeVisualCritic(photorealism=7.9, object_integrity=10.0)
        evaluator = make_evaluator(critic=critic)
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "PhotorealismReject")

    def test_object_integrity_is_a_hard_gate(self):
        critic = FakeVisualCritic(photorealism=10.0, object_integrity=7.9)
        evaluator = make_evaluator(critic=critic)
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "ObjectIntegrityReject")

    def test_high_fun_score_cannot_compensate_for_failing_photorealism(self):
        critic = FakeVisualCritic(photorealism=1.0, object_integrity=10.0, visual_fun=10.0)
        evaluator = make_evaluator(critic=critic)
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.accepted)

    def test_artifact_flags_reject_regardless_of_scores(self):
        critic = FakeVisualCritic(
            photorealism=10.0, object_integrity=10.0, artifact_flags=("fake_text",)
        )
        evaluator = make_evaluator(critic=critic)
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "ArtifactFlagged")


class TestNoveltyGate(unittest.TestCase):
    def test_perceptual_duplicate_is_rejected(self):
        evaluator = make_evaluator(hash_image=lambda path: 0)
        history = [{"id": "prior", "phash": 0, "tags": []}]
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=history)
        self.assertFalse(result.accepted)
        self.assertEqual(result.rejection_code, "PerceptualDuplicateReject")

    def test_distinct_hash_is_not_flagged_as_duplicate(self):
        evaluator = make_evaluator(hash_image=lambda path: 0)
        history = [{"id": "prior", "phash": 0xFFFFFFFFFFFFFFFF, "tags": []}]
        result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=history)
        self.assertTrue(result.accepted)

    def test_high_tag_overlap_lowers_novelty_score_without_hard_rejecting(self):
        evaluator = make_evaluator(hash_image=lambda path: 0)
        overlapping_history = [
            {"id": "prior", "phash": 0xFFFFFFFFFFFFFFFF, "tags": ["field_science"]}
        ]
        overlapping_result = evaluator.evaluate(
            make_candidate(), SAMPLE_BRIEF, history=overlapping_history
        )
        clean_result = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertTrue(overlapping_result.accepted)
        self.assertLess(overlapping_result.novelty_score, clean_result.novelty_score)


class TestRankCandidates(unittest.TestCase):
    def test_returns_none_when_nothing_accepted(self):
        evaluator = make_evaluator(critic=FakeVisualCritic(photorealism=1.0))
        rejected = evaluator.evaluate(make_candidate(), SAMPLE_BRIEF, history=[])
        self.assertIsNone(rank_candidates([rejected]))

    def test_picks_highest_rank_score_among_accepted(self):
        evaluator = make_evaluator()
        strong = evaluator.evaluate(make_candidate("req-strong"), SAMPLE_BRIEF, history=[])
        weak_evaluator = make_evaluator(
            route_canvas=lambda path: route_result_with(
                affordances={"add": 0.2, "remove": 0.1, "reorder": 0.1, "recolor": 0.1}
            )
        )
        weak = weak_evaluator.evaluate(make_candidate("req-weak"), SAMPLE_BRIEF, history=[])

        winner = rank_candidates([weak, strong])
        self.assertIsNotNone(winner)
        self.assertEqual(winner.candidate.request_id, "req-strong")

    def test_tie_break_is_deterministic_regardless_of_input_order(self):
        evaluator = make_evaluator()
        a = evaluator.evaluate(make_candidate("req-a"), SAMPLE_BRIEF, history=[])
        b = evaluator.evaluate(make_candidate("req-b"), SAMPLE_BRIEF, history=[])
        self.assertEqual(a.rank_score, b.rank_score)  # identical inputs -> identical scores

        winner_ab = rank_candidates([a, b])
        winner_ba = rank_candidates([b, a])
        self.assertEqual(winner_ab.candidate.request_id, winner_ba.candidate.request_id)


PRIMARY_BRIEF = SceneBrief(
    id="collection_primary",
    scene_family="collection",
    domain="d1",
    setting="s1",
    object_families=("a", "b", "c", "d"),
    materials=("m1", "m2", "m3"),
    layout="l1",
    palette="p1",
    density_target=(35, 70),
    desired_operations=("add", "remove", "reorder"),
)
SPARE_BRIEF = SceneBrief(
    id="collection_spare",
    scene_family="collection",
    domain="d2",
    setting="s2",
    object_families=("e", "f", "g", "h"),
    materials=("m4", "m5", "m6"),
    layout="l2",
    palette="p2",
    density_target=(35, 70),
    desired_operations=("add", "remove", "reorder"),
)


class CountingFakeProvider:
    def __init__(self, fail_kind=None, fail_times=0):
        self.total_images = 0
        self.requests = []
        self._fail_kind = fail_kind
        self._fail_times = fail_times
        self._fail_count = 0

    def calls_for(self, scene_brief_id):
        return sum(1 for r in self.requests if r.scene_brief_id == scene_brief_id)

    def generate(self, request):
        self.requests.append(request)
        if self._fail_kind and self._fail_count < self._fail_times:
            self._fail_count += 1
            raise ProviderCallError("simulated failure", self._fail_kind)
        self.total_images += 1
        image = ProviderImage(
            provider=request.provider,
            model=request.model,
            request_id=f"req-{self.total_images}",
            native_size=request.size,
            image_bytes=b"fake",
        )
        return [image]


class ScriptedEvaluator:
    def __init__(self, decide):
        self._decide = decide
        self.calls = []

    def evaluate(self, candidate, brief, history):
        self.calls.append((candidate.provider, brief.id))
        return self._decide(candidate, brief, history)


def accept(candidate, rank_score=0.5, novelty_score=0.8):
    critic = VisualCriticResult(
        provider=candidate.provider,
        model=candidate.model,
        photorealism=9.0,
        object_integrity=9.0,
        scene_coherence=8.0,
        visual_fun=7.0,
        composition=7.0,
    )
    return CandidateEvaluation(
        candidate=candidate,
        passed_local_gates=True,
        local_gate_failures=(),
        critic=critic,
        novelty_score=novelty_score,
        rank_score=rank_score,
        accepted=True,
    )


def reject(candidate, code="PhotorealismReject", reason="too fake"):
    return CandidateEvaluation(
        candidate=candidate,
        passed_local_gates=True,
        local_gate_failures=(),
        critic=None,
        novelty_score=None,
        rank_score=None,
        accepted=False,
        rejection_reason=reason,
        rejection_code=code,
    )


def fake_normalize(image, request, output_path, policy):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(b"fake-normalized")
    return NormalizedCandidate(
        scene_brief_id=request.scene_brief_id,
        provider=image.provider,
        model=image.model,
        request_id=image.request_id,
        master_path=output_path,
        size=policy.master_size,
        normalization_crop_fraction=0.0,
    )


class PipelineTestCase(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.root = self.tmpdir.name

    def make_pipeline(self, providers, evaluator, briefs, sleeper=None):
        return BaseGenerationPipeline(
            policy=DEFAULT_BASE_GENERATION_POLICY,
            briefs=briefs,
            providers=providers,
            evaluator=evaluator,
            history_store=AcceptedHistoryStore(path=os.path.join(self.root, "accepted.jsonl")),
            staging_root=os.path.join(self.root, "runs"),
            sleeper=sleeper or (lambda seconds: None),
            normalize=fake_normalize,
        )


class TestRunStoreLedger(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.root = os.path.join(self.tmpdir.name, "runs")

    def test_create_writes_atomic_run_json_and_empty_events(self):
        RunStore.create(RunConfig(count=10), [PRIMARY_BRIEF], root=self.root, run_id="run-1")
        run_json_path = Path(self.root) / "run-1" / "run.json"
        self.assertTrue(run_json_path.exists())
        payload = json.loads(run_json_path.read_text())
        self.assertEqual(payload["run_id"], "run-1")
        self.assertEqual(payload["plan"], ["collection_primary"])
        self.assertTrue((Path(self.root) / "run-1" / "events.jsonl").exists())

    def test_transition_must_start_in_planned_state(self):
        RunStore.create(RunConfig(), [PRIMARY_BRIEF], root=self.root, run_id="run-2")
        store = RunStore.resume("run-2", root=self.root)
        with self.assertRaises(ValueError):
            store.transition("cand-1", "generating")

    def test_illegal_transition_is_rejected(self):
        RunStore.create(RunConfig(), [PRIMARY_BRIEF], root=self.root, run_id="run-3")
        store = RunStore.resume("run-3", root=self.root)
        store.transition("cand-1", "planned")
        with self.assertRaises(ValueError):
            store.transition("cand-1", "normalized")

    def test_resume_replays_events_into_current_state(self):
        RunStore.create(RunConfig(), [PRIMARY_BRIEF], root=self.root, run_id="run-4")
        store = RunStore.resume("run-4", root=self.root)
        store.transition("cand-1", "planned")
        store.transition("cand-1", "generating")
        resumed = RunStore.resume("run-4", root=self.root)
        self.assertEqual(resumed.state_of("cand-1"), "generating")

    def test_resume_tolerates_malformed_trailing_event_line(self):
        RunStore.create(RunConfig(), [PRIMARY_BRIEF], root=self.root, run_id="run-5")
        store = RunStore.resume("run-5", root=self.root)
        store.transition("cand-1", "planned")
        with open(store.run_dir / "events.jsonl", "a", encoding="utf-8") as handle:
            handle.write('{"item_id": "cand-1", "state": "gen')  # truncated/corrupt final line
        resumed = RunStore.resume("run-5", root=self.root)
        self.assertEqual(resumed.state_of("cand-1"), "planned")


class TestAcceptedHistoryStore(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.path = os.path.join(self.tmpdir.name, "accepted.jsonl")

    def test_append_and_recent_preserve_order_and_limit(self):
        store = AcceptedHistoryStore(path=self.path)
        for i in range(5):
            store.append({"id": f"scene-{i}"})
        recent = store.recent(limit=3)
        self.assertEqual([r["id"] for r in recent], ["scene-2", "scene-3", "scene-4"])

    def test_recent_tolerates_malformed_trailing_line(self):
        store = AcceptedHistoryStore(path=self.path)
        store.append({"id": "scene-0"})
        with open(self.path, "a", encoding="utf-8") as handle:
            handle.write('{"id": "broken')
        recent = store.recent(limit=30)
        self.assertEqual([r["id"] for r in recent], ["scene-0"])

    def test_recent_returns_empty_list_when_file_missing(self):
        store = AcceptedHistoryStore(path=self.path)
        self.assertEqual(store.recent(), [])


class TestReports(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.root = os.path.join(self.tmpdir.name, "runs")
        RunStore.create(RunConfig(), [PRIMARY_BRIEF], root=self.root, run_id="run-report")
        self.store = RunStore.resume("run-report", root=self.root)
        self.store.transition(
            "cand-1", "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        self.store.transition("cand-1", "generating", {})
        self.store.transition("cand-1", "generated", {"model": "gemini-3.1-flash-image"})
        self.store.transition("cand-1", "normalized", {"master_path": "candidates/cand-1.png"})
        self.store.transition(
            "cand-1",
            "critic_rejected",
            {
                "rejection_reason": "<script>alert(1)</script>",
                "master_path": "candidates/cand-1.png",
            },
        )

    def test_write_json_report_includes_all_items(self):
        path = write_json_report(self.store)
        payload = json.loads(path.read_text())
        self.assertEqual(payload["run_id"], "run-report")
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["state"], "critic_rejected")

    def test_write_html_report_escapes_rejection_reason(self):
        path = write_html_report(self.store)
        html_text = path.read_text()
        self.assertNotIn("<script>alert(1)</script>", html_text)
        self.assertIn("&lt;script&gt;", html_text)


class TestRetryClassification(PipelineTestCase):
    def test_retries_transient_failures_up_to_twice_with_backoff(self):
        sleeps = []
        pipeline = self.make_pipeline({}, None, [PRIMARY_BRIEF], sleeper=sleeps.append)
        calls = {"n": 0}

        def flaky():
            calls["n"] += 1
            if calls["n"] < 3:
                raise ProviderCallError("rate limited", "rate_limit")
            return "ok"

        result = pipeline._call_with_retry(flaky)
        self.assertEqual(result, "ok")
        self.assertEqual(calls["n"], 3)
        self.assertEqual(sleeps, [1, 3])

    def test_gives_up_after_two_retries(self):
        sleeps = []
        pipeline = self.make_pipeline({}, None, [PRIMARY_BRIEF], sleeper=sleeps.append)

        def always_fails():
            raise ProviderCallError("rate limited", "rate_limit")

        with self.assertRaises(ProviderCallError):
            pipeline._call_with_retry(always_fails)
        self.assertEqual(sleeps, [1, 3])

    def test_never_retries_non_retryable_failures(self):
        sleeps = []
        pipeline = self.make_pipeline({}, None, [PRIMARY_BRIEF], sleeper=sleeps.append)
        calls = {"n": 0}

        def fails_auth():
            calls["n"] += 1
            raise ProviderCallError("bad key", "authentication")

        with self.assertRaises(ProviderCallError):
            pipeline._call_with_retry(fails_auth)
        self.assertEqual(calls["n"], 1)
        self.assertEqual(sleeps, [])


class TestStrongerProviderSelection(PipelineTestCase):
    def test_prefers_higher_acceptance_ratio(self):
        pipeline = self.make_pipeline(
            {"google": CountingFakeProvider(), "openai": CountingFakeProvider()},
            ScriptedEvaluator(lambda c, b, h: accept(c)),
            [PRIMARY_BRIEF],
        )
        stats = {
            "google": {"collection": {"accepted": 3, "attempted": 4}},
            "openai": {"collection": {"accepted": 1, "attempted": 4}},
        }
        self.assertEqual(pipeline._stronger_provider(stats, "collection"), "google")
        stats_reversed = {
            "google": {"collection": {"accepted": 1, "attempted": 4}},
            "openai": {"collection": {"accepted": 3, "attempted": 4}},
        }
        self.assertEqual(pipeline._stronger_provider(stats_reversed, "collection"), "openai")

    def test_breaks_ties_toward_google(self):
        pipeline = self.make_pipeline(
            {"google": CountingFakeProvider(), "openai": CountingFakeProvider()},
            ScriptedEvaluator(lambda c, b, h: accept(c)),
            [PRIMARY_BRIEF],
        )
        stats = {
            "google": {"collection": {"accepted": 0, "attempted": 0}},
            "openai": {"collection": {"accepted": 0, "attempted": 0}},
        }
        self.assertEqual(pipeline._stronger_provider(stats, "collection"), "google")


class TestPipelineRun(PipelineTestCase):
    def _providers(self):
        return {"google": CountingFakeProvider(), "openai": CountingFakeProvider()}

    def test_mixed_mode_generates_one_candidate_from_each_provider_first(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        result = pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=4))

        self.assertEqual(len(result.accepted), 1)
        called = sorted({provider for provider, _ in evaluator.calls})
        self.assertEqual(called, ["google", "openai"])

    def test_budget_is_checked_before_provider_call(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        result = pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=1))

        self.assertEqual(providers["google"].total_images + providers["openai"].total_images, 1)
        self.assertEqual(result.stop_code, "GenerationBudgetReached")

    def test_fresh_brief_substitution_when_all_candidates_for_a_brief_are_rejected(self):
        providers = self._providers()

        def decide(candidate, brief, history):
            if brief.id == PRIMARY_BRIEF.id:
                return reject(candidate)
            return accept(candidate)

        evaluator = ScriptedEvaluator(decide)
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF, SPARE_BRIEF])

        # count=2 raises the image ceiling enough to cover primary's full 4-candidate
        # exhaustion plus at least one spare-brief candidate.
        result = pipeline.run(RunConfig(count=2, provider_mode="mixed", max_images=8))

        self.assertEqual(len(result.accepted), 1)
        self.assertEqual(result.accepted[0].candidate.scene_brief_id, SPARE_BRIEF.id)
        self.assertTrue(any(brief_id == SPARE_BRIEF.id for _, brief_id in evaluator.calls))
        self.assertTrue(any(brief_id == PRIMARY_BRIEF.id for _, brief_id in evaluator.calls))

    def test_partial_completion_stops_without_relaxing_gates_when_budget_runs_out(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: reject(c))
        # No spare brief available, so a run out of budget must end with zero acceptances.
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        result = pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=2))

        self.assertEqual(len(result.accepted), 0)
        self.assertEqual(result.generated_image_count, 2)
        self.assertEqual(result.stop_code, "GenerationBudgetReached")

    def test_resume_does_not_repeat_completed_generation(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        first_result = pipeline.run(
            RunConfig(count=1, provider_mode="mixed", max_images=4), run_id="resume-run"
        )
        self.assertEqual(len(first_result.accepted), 1)
        total_after_first_run = providers["google"].total_images + providers["openai"].total_images

        second_result = pipeline.run(
            RunConfig(count=1, provider_mode="mixed", max_images=4),
            run_id="resume-run",
            resume=True,
        )
        total_after_resume = providers["google"].total_images + providers["openai"].total_images

        self.assertEqual(total_after_resume, total_after_first_run)
        self.assertEqual(len(second_result.accepted), 0)  # nothing new selected on resume

    def test_resume_does_not_reprocess_a_brief_that_already_has_a_selected_candidate(self):
        # Regression: a family whose quota needs more than one brief could, on a
        # second resume, re-pop an already-won brief from the rebuilt queue. Its
        # already-"selected" candidate id short-circuits safely, but a *new*,
        # never-before-seen candidate id under the same brief (e.g. the other
        # provider's slot) would sail through untouched and could be selected as a
        # second winner for a brief that already has one.
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        briefs = [PRIMARY_BRIEF, SPARE_BRIEF]
        pipeline = self.make_pipeline(providers, evaluator, briefs)
        run_root = os.path.join(self.root, "runs")

        # count=5 gives this family a quota of 2, so after PRIMARY_BRIEF's slot is
        # already filled, the family is still not satisfied and the run keeps going.
        store = RunStore.create(RunConfig(count=5), briefs, root=run_root, run_id="multi-brief-resume")
        store = RunStore.resume("multi-brief-resume", root=run_root)
        winning_candidate_id = f"{PRIMARY_BRIEF.id}::google::0"
        store.transition(
            winning_candidate_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(winning_candidate_id, "generating", {})
        store.transition(winning_candidate_id, "generated", {"model": "gemini-3.1-flash-image"})
        store.transition(
            winning_candidate_id,
            "normalized",
            {"master_path": "candidates/fake.png", "model": "gemini-3.1-flash-image"},
        )
        store.transition(
            winning_candidate_id, "passing", {"master_path": "candidates/fake.png", "rank_score": 0.9}
        )
        store.transition(winning_candidate_id, "selected", {"scene_brief_id": PRIMARY_BRIEF.id})

        result = pipeline.run(
            RunConfig(count=5, provider_mode="mixed", max_images=20),
            run_id="multi-brief-resume",
            resume=True,
        )

        primary_wins_this_call = [
            w for w in result.accepted if w.candidate.scene_brief_id == PRIMARY_BRIEF.id
        ]
        self.assertEqual(primary_wins_this_call, [])
        self.assertEqual(
            providers["google"].calls_for(PRIMARY_BRIEF.id) + providers["openai"].calls_for(PRIMARY_BRIEF.id),
            0,
        )

    def test_reload_or_generate_skips_a_candidate_already_marked_passing(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])
        store = RunStore.create(
            RunConfig(count=1), [PRIMARY_BRIEF], root=os.path.join(self.root, "runs"), run_id="manual-run"
        )
        store = RunStore.resume("manual-run", root=os.path.join(self.root, "runs"))

        candidate_id = f"{PRIMARY_BRIEF.id}::google::0"
        store.transition(
            candidate_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(candidate_id, "generating", {})
        store.transition(candidate_id, "generated", {"model": "gemini-3.1-flash-image"})
        store.transition(
            candidate_id,
            "normalized",
            {"master_path": "candidates/fake.png", "model": "gemini-3.1-flash-image"},
        )
        store.transition(candidate_id, "passing", {"master_path": "candidates/fake.png", "rank_score": 0.9})

        result = pipeline._reload_or_generate(
            store, PRIMARY_BRIEF, "google", candidate_id, [], _Budget(limit=40)
        )

        self.assertIsNotNone(result)
        self.assertEqual(providers["google"].total_images, 0)
        self.assertTrue(result[1].accepted)
        self.assertEqual(result[1].rank_score, 0.9)

    def test_reload_or_generate_resumes_a_candidate_stuck_at_planned_without_crashing(self):
        # A crash right after the "planned" transition (before "generating") must not
        # make the resumed attempt try an illegal "planned" -> "planned" self-transition.
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])
        store = RunStore.create(
            RunConfig(count=1), [PRIMARY_BRIEF], root=os.path.join(self.root, "runs"), run_id="stuck-planned"
        )
        store = RunStore.resume("stuck-planned", root=os.path.join(self.root, "runs"))

        candidate_id = f"{PRIMARY_BRIEF.id}::google::0"
        store.transition(
            candidate_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )

        result = pipeline._reload_or_generate(
            store, PRIMARY_BRIEF, "google", candidate_id, [], _Budget(limit=40)
        )

        self.assertIsNotNone(result)
        self.assertEqual(providers["google"].total_images, 1)
        self.assertTrue(result[1].accepted)
        self.assertEqual(store.state_of(candidate_id), "passing")

    def test_reload_or_generate_resumes_a_candidate_stuck_at_generating_without_crashing(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])
        store = RunStore.create(
            RunConfig(count=1),
            [PRIMARY_BRIEF],
            root=os.path.join(self.root, "runs"),
            run_id="stuck-generating",
        )
        store = RunStore.resume("stuck-generating", root=os.path.join(self.root, "runs"))

        candidate_id = f"{PRIMARY_BRIEF.id}::google::0"
        store.transition(
            candidate_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(
            candidate_id, "generating", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )

        result = pipeline._reload_or_generate(
            store, PRIMARY_BRIEF, "google", candidate_id, [], _Budget(limit=40)
        )

        self.assertIsNotNone(result)
        self.assertEqual(providers["google"].total_images, 1)
        self.assertTrue(result[1].accepted)
        self.assertEqual(store.state_of(candidate_id), "passing")

    def test_reload_or_generate_abandons_and_retries_a_candidate_stuck_at_generated(self):
        # No raw provider bytes survive a crash between "generated" and "normalized", so
        # this id cannot resume in place; a fresh id must retry instead of crashing.
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])
        store = RunStore.create(
            RunConfig(count=1),
            [PRIMARY_BRIEF],
            root=os.path.join(self.root, "runs"),
            run_id="stuck-generated",
        )
        store = RunStore.resume("stuck-generated", root=os.path.join(self.root, "runs"))

        candidate_id = f"{PRIMARY_BRIEF.id}::google::0"
        store.transition(
            candidate_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(
            candidate_id, "generating", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(candidate_id, "generated", {"model": "gemini-3.1-flash-image"})

        result = pipeline._reload_or_generate(
            store, PRIMARY_BRIEF, "google", candidate_id, [], _Budget(limit=40)
        )

        self.assertIsNotNone(result)
        self.assertEqual(providers["google"].total_images, 1)
        self.assertTrue(result[1].accepted)
        self.assertEqual(store.state_of(candidate_id), "generated")  # abandoned in place
        self.assertNotEqual(result[0], candidate_id)  # a new id retried the attempt

    def test_adaptive_follow_up_does_not_double_count_budget_on_resume(self):
        # Reproduces a brief that already used a follow-up (3rd) candidate before an
        # interruption; resuming and reprocessing that brief must not silently spend a
        # second unit of budget for a candidate that is skipped, not regenerated.
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: reject(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])
        run_root = os.path.join(self.root, "runs")

        store = RunStore.create(RunConfig(count=1), [PRIMARY_BRIEF], root=run_root, run_id="resume-followup")
        store = RunStore.resume("resume-followup", root=run_root)
        follow_up_id = f"{PRIMARY_BRIEF.id}::google::2"
        store.transition(
            follow_up_id, "planned", {"scene_brief_id": PRIMARY_BRIEF.id, "provider": "google"}
        )
        store.transition(follow_up_id, "generating", {})
        store.transition(follow_up_id, "generated", {"model": "gemini-3.1-flash-image"})
        store.transition(
            follow_up_id,
            "normalized",
            {"master_path": "candidates/fake.png", "model": "gemini-3.1-flash-image"},
        )
        store.transition(follow_up_id, "critic_rejected", {"master_path": "candidates/fake.png"})

        budget = _Budget(limit=4, already_used=1)
        result = pipeline._reload_or_generate(
            store, PRIMARY_BRIEF, "google", follow_up_id, [], budget
        )

        self.assertIsNone(result)  # already terminal; no provider call, no evaluation
        self.assertEqual(budget.used, 1)  # unchanged -- this candidate never called the provider

    def test_rejected_candidate_images_are_deleted_by_default(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c) if c.provider == "google" else reject(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        result = pipeline.run(
            RunConfig(count=1, provider_mode="mixed", max_images=4, keep_rejected=False)
        )

        store = RunStore.resume(result.run_id, root=os.path.join(self.root, "runs"))
        rejected = [r for r in store.all_items().values() if r["state"] == "critic_rejected"]
        self.assertTrue(rejected)
        for record in rejected:
            self.assertFalse(Path(record["data"]["master_path"]).exists())

    def test_rejected_candidate_images_are_kept_with_keep_rejected_flag(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c) if c.provider == "google" else reject(c))
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF])

        result = pipeline.run(
            RunConfig(count=1, provider_mode="mixed", max_images=4, keep_rejected=True)
        )

        store = RunStore.resume(result.run_id, root=os.path.join(self.root, "runs"))
        rejected = [r for r in store.all_items().values() if r["state"] == "critic_rejected"]
        self.assertTrue(rejected)
        for record in rejected:
            self.assertTrue(Path(record["data"]["master_path"]).exists())


if __name__ == "__main__":
    unittest.main()
