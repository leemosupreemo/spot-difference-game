import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

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
from base_pair_publisher import generate_structural_pair, publish_pair
from base_run_store import AcceptedHistoryStore, RunStore
from base_scene_catalog import load_scene_catalog
from base_visual_critic import FakeVisualCritic
from image_pair_finalizer import finalize_pair

import generate_photo_batch
from generate_photo_batch import app, build_run_config_from_answers, resolve_providers_for_execution
from typer.testing import CliRunner

FULL_CATALOG_PATH = os.path.join(os.path.dirname(__file__), "base_scene_catalog.json")

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

    def make_pipeline(self, providers, evaluator, briefs, sleeper=None, progress_callback=None):
        return BaseGenerationPipeline(
            policy=DEFAULT_BASE_GENERATION_POLICY,
            briefs=briefs,
            providers=providers,
            evaluator=evaluator,
            history_store=AcceptedHistoryStore(path=os.path.join(self.root, "accepted.jsonl")),
            staging_root=os.path.join(self.root, "runs"),
            sleeper=sleeper or (lambda seconds: None),
            normalize=fake_normalize,
            progress_callback=progress_callback,
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

    def test_progress_callback_receives_a_done_event_per_candidate_and_on_selection(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        events = []
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF], progress_callback=events.append)

        pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=4))

        done_events = [e for e in events if e["stage"] == "done"]
        self.assertGreaterEqual(len(done_events), 2)  # at least google + openai candidate events
        for event in done_events:
            self.assertIn("generated_image_count", event)
            self.assertIn("accepted_count", event)
            self.assertIn("current_brief", event)
            self.assertIn("rejection_code", event)
        self.assertTrue(any(event["accepted"] and event["current_provider"] is None for event in done_events))

    def test_progress_callback_reports_rejection_code_for_a_rejected_candidate(self):
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: reject(c, code="PhotorealismReject"))
        events = []
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF], progress_callback=events.append)

        pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=4))

        done_events = [e for e in events if e["stage"] == "done"]
        self.assertTrue(any(e["rejection_code"] == "PhotorealismReject" for e in done_events))

    def test_progress_callback_emits_intermediate_stages_before_the_final_verdict(self):
        # These are the events that matter most for live feedback: they fire
        # before/during the slow provider and critic calls, not just after.
        providers = self._providers()
        evaluator = ScriptedEvaluator(lambda c, b, h: accept(c))
        events = []
        pipeline = self.make_pipeline(providers, evaluator, [PRIMARY_BRIEF], progress_callback=events.append)

        pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=4))

        stages_seen = [e["stage"] for e in events]
        self.assertIn("generating", stages_seen)
        self.assertIn("normalizing", stages_seen)
        self.assertIn("evaluating", stages_seen)
        # Each candidate's stages must be emitted in order, before its "done".
        first_done_index = stages_seen.index("done")
        self.assertIn("generating", stages_seen[:first_done_index])
        self.assertIn("normalizing", stages_seen[:first_done_index])
        self.assertIn("evaluating", stages_seen[:first_done_index])

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


def _make_master(color=(120, 120, 120)):
    return Image.new("RGB", DEFAULT_BASE_GENERATION_POLICY.master_size, color)


def _paste_patch(image, bbox, color):
    out = image.copy()
    x1, y1, x2, y2 = bbox
    out.paste(Image.new("RGB", (x2 - x1, y2 - y1), color), (x1, y1))
    return out


class TestImagePairFinalizer(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.output_dir = os.path.join(self.tmpdir.name, "finalized")
        self.policy = DEFAULT_BASE_GENERATION_POLICY

        self.base_path = os.path.join(self.tmpdir.name, "base.jpg")
        self.variant_path = os.path.join(self.tmpdir.name, "variant.jpg")

    def _write(self, image, path):
        image.save(path, format="JPEG", quality=100)
        return path

    def test_finalized_pair_is_exact_production_size_and_declares_metadata(self):
        base = _make_master()
        bbox = (700, 500, 900, 700)
        variant = _paste_patch(base, bbox, (200, 80, 80))
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)
        ground_truth = {"bbox": bbox}

        pair = finalize_pair(
            self.base_path, self.variant_path, ground_truth, self.output_dir, "scene-1", self.policy
        )

        with Image.open(pair.base_path) as img:
            self.assertEqual(img.size, (1200, 900))
        with Image.open(pair.variant_path) as img:
            self.assertEqual(img.size, (1200, 900))
        self.assertEqual(pair.dimensions, (1200, 900))
        self.assertEqual(pair.aspect_ratio, "4:3")
        self.assertEqual(pair.manifest_id, "scene-1")

    def test_pair_dimension_mismatch_between_base_and_variant_is_rejected(self):
        base = _make_master()
        variant = Image.new("RGB", (1536, 1150), (120, 120, 120))
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)

        with self.assertRaisesRegex(ValueError, "PairDimensionMismatch"):
            finalize_pair(
                self.base_path, self.variant_path, {"bbox": (0, 0, 10, 10)},
                self.output_dir, "scene-1", self.policy,
            )

    def test_non_master_size_input_is_rejected(self):
        base = Image.new("RGB", (800, 600), (120, 120, 120))
        variant = base.copy()
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)

        with self.assertRaisesRegex(ValueError, "PairDimensionMismatch"):
            finalize_pair(
                self.base_path, self.variant_path, {"bbox": (0, 0, 10, 10)},
                self.output_dir, "scene-1", self.policy,
            )

    def test_difference_lost_after_downsample_is_rejected(self):
        base = _make_master()
        bbox = (700, 500, 704, 504)  # 4x4, low magnitude
        variant = _paste_patch(base, bbox, (123, 123, 123))
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)

        with self.assertRaisesRegex(ValueError, "DifferenceLostAfterDownsample"):
            finalize_pair(
                self.base_path, self.variant_path, {"bbox": bbox},
                self.output_dir, "scene-1", self.policy,
            )

    def test_outside_region_drift_is_rejected(self):
        base = _make_master()
        bbox = (700, 500, 900, 700)
        variant = _paste_patch(base, bbox, (200, 80, 80))
        variant = _paste_patch(variant, (100, 100, 300, 300), (10, 200, 10))  # unrelated drift
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)

        with self.assertRaisesRegex(ValueError, "OutsideRegionDrift"):
            finalize_pair(
                self.base_path, self.variant_path, {"bbox": bbox},
                self.output_dir, "scene-1", self.policy,
            )

    def test_finalized_output_uses_identical_resize_for_both_images(self):
        base = _make_master()
        bbox = (700, 500, 900, 700)
        variant = _paste_patch(base, bbox, (200, 80, 80))
        self._write(base, self.base_path)
        self._write(variant, self.variant_path)

        pair = finalize_pair(
            self.base_path, self.variant_path, {"bbox": bbox}, self.output_dir, "scene-1", self.policy
        )

        # Outside the declared region, base and variant must be pixel-identical --
        # this can only hold if both received the same resize transform.
        with Image.open(pair.base_path) as base_out, Image.open(pair.variant_path) as variant_out:
            corner_a = base_out.crop((0, 0, 50, 50))
            corner_b = variant_out.crop((0, 0, 50, 50))

        self.assertLess(
            float(np.abs(np.asarray(corner_a, dtype=np.float32) - np.asarray(corner_b, dtype=np.float32)).mean()),
            1.5,
        )


class TestPublishPair(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.levels_dir = os.path.join(self.tmpdir.name, "levels")
        self.manifest_path = os.path.join(self.tmpdir.name, "manifest.json")

    def _make_finalized_pair(self, scene_id="scene-1", content=b"finalized-bytes"):
        staging = Path(self.tmpdir.name) / "staging"
        staging.mkdir(exist_ok=True)
        base_path = staging / f"{scene_id}-base-src.jpg"
        variant_path = staging / f"{scene_id}-variant-src.jpg"
        base_path.write_bytes(content + b"-base")
        variant_path.write_bytes(content + b"-variant")

        from base_generation_types import FinalizedPair

        return FinalizedPair(
            scene_brief_id=scene_id,
            base_path=str(base_path),
            variant_path=str(variant_path),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id=scene_id,
        )

    def test_publish_pair_writes_digest_named_files_and_updates_manifest(self):
        pair = self._make_finalized_pair()
        entry = publish_pair(pair, {"title": "Scene One"}, self.levels_dir, self.manifest_path)

        self.assertTrue(Path(self.levels_dir, Path(entry["baseImage"]).name).exists())
        self.assertTrue(Path(self.levels_dir, Path(entry["variantImage"]).name).exists())
        self.assertEqual(entry["dimensions"], {"width": 1200, "height": 900})
        self.assertEqual(entry["aspectRatio"], "4:3")
        self.assertEqual(entry["id"], "scene-1")

        manifest = json.loads(Path(self.manifest_path).read_text())
        self.assertEqual(len(manifest), 1)
        self.assertEqual(manifest[0]["id"], "scene-1")

    def test_manifest_failure_removes_newly_copied_assets(self):
        pair = self._make_finalized_pair()

        def failing_replace(src, dst):
            raise OSError("simulated manifest replace failure")

        with self.assertRaises(OSError):
            publish_pair(pair, {"title": "Scene One"}, self.levels_dir, self.manifest_path, replace_fn=failing_replace)

        self.assertEqual(list(Path(self.levels_dir).glob("*")), [])

    def test_duplicate_scene_id_uses_new_asset_names_until_manifest_commit(self):
        old_pair = self._make_finalized_pair(content=b"old-content")
        old_entry = publish_pair(old_pair, {"title": "Original"}, self.levels_dir, self.manifest_path)

        new_pair = self._make_finalized_pair(content=b"new-content")
        new_entry = publish_pair(new_pair, {"title": "Replacement"}, self.levels_dir, self.manifest_path)

        self.assertNotEqual(old_entry["baseImage"], new_entry["baseImage"])
        self.assertTrue(Path(self.levels_dir, Path(old_entry["baseImage"]).name).exists())
        self.assertTrue(Path(self.levels_dir, Path(old_entry["variantImage"]).name).exists())

        manifest = json.loads(Path(self.manifest_path).read_text())
        self.assertEqual(len(manifest), 1)  # replaced, not duplicated
        self.assertEqual(manifest[0]["title"], "Replacement")


class TestGenerateStructuralPair(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.staging_dir = os.path.join(self.tmpdir.name, "staging")

    def _candidate(self):
        return make_candidate(request_id="req-structural", scene_brief_id="scene-1")

    def test_success_path_finalizes_and_returns_log_entry(self):
        bbox = (700, 500, 900, 700)
        base = _make_master()
        variant = _paste_patch(base, bbox, (200, 80, 80))
        ground_truth = {"x": 50.0, "y": 50.0, "radius": 5.0, "bbox": bbox}

        def fake_generate(scene_spec, output_dir=None, policy=None, scheduler=None):
            out = Path(output_dir)
            out.mkdir(parents=True, exist_ok=True)
            scene_id = scene_spec["id"]
            base.save(out / f"{scene_id}_base.jpg", format="JPEG", quality=100)
            variant.save(out / f"{scene_id}_variant.jpg", format="JPEG", quality=100)
            manifest_entry = {"id": scene_id, "diffs": [ground_truth]}
            log_entry = {"accepted": True, "ground_truth": ground_truth}
            return True, manifest_entry, log_entry

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            finalized, log_entry = generate_structural_pair(
                self._candidate(), {"id": "scene-1"}, self.staging_dir
            )

        self.assertIsNotNone(finalized)
        self.assertEqual(finalized.manifest_id, "scene-1")
        with Image.open(finalized.base_path) as img:
            self.assertEqual(img.size, (1200, 900))
        self.assertTrue(log_entry["accepted"])

    def test_failure_path_returns_none_and_log_entry(self):
        def fake_generate(scene_spec, output_dir=None, policy=None, scheduler=None):
            return False, None, {"accepted": False, "rejection_reason": "NoStructuralCandidate"}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            finalized, log_entry = generate_structural_pair(
                self._candidate(), {"id": "scene-1"}, self.staging_dir
            )

        self.assertIsNone(finalized)
        self.assertEqual(log_entry["rejection_reason"], "NoStructuralCandidate")

    def test_never_writes_to_public_levels(self):
        # Regardless of success or failure, generate_structural_pair must only ever
        # touch the isolated staging directory it was given.
        def fake_generate(scene_spec, output_dir=None, policy=None, scheduler=None):
            self.assertNotIn("public/levels", str(output_dir))
            return False, None, {"accepted": False, "rejection_reason": "test"}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            generate_structural_pair(self._candidate(), {"id": "scene-1"}, self.staging_dir)


class TestCliHelp(unittest.TestCase):
    def test_help_lists_every_command(self):
        runner = CliRunner()
        result = runner.invoke(app, ["--help"])
        self.assertEqual(result.exit_code, 0)
        for command in ("plan", "generate", "resume", "report", "doctor", "auth", "catalog", "history"):
            self.assertIn(command, result.stdout)


class TestBuildRunConfigFromAnswers(unittest.TestCase):
    def test_defaults_match_run_config_defaults(self):
        self.assertEqual(build_run_config_from_answers({}), RunConfig())

    def test_explicit_answers_are_applied(self):
        config = build_run_config_from_answers(
            {
                "provider_mode": "google",
                "critic_mode": "google",
                "count": 5,
                "seed": 3,
                "max_images": 12,
                "keep_rejected": True,
                "staging_root": "/tmp/custom",
                "execution_mode": "execute",
            }
        )
        self.assertEqual(config.provider_mode, "google")
        self.assertEqual(config.critic_mode, "google")
        self.assertEqual(config.count, 5)
        self.assertEqual(config.seed, 3)
        self.assertEqual(config.max_images, 12)
        self.assertTrue(config.keep_rejected)
        self.assertEqual(config.staging_root, "/tmp/custom")
        self.assertEqual(config.execution_mode, "execute")

    def test_max_images_defaults_proportionally_to_count(self):
        config = build_run_config_from_answers({"count": 5})
        self.assertEqual(config.max_images, DEFAULT_BASE_GENERATION_POLICY.max_images_for_count(5))


class TestConfigRoundTrip(unittest.TestCase):
    def test_write_and_load_round_trips_exactly(self):
        config = build_run_config_from_answers({"count": 7, "provider_mode": "openai"})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "run-config.json"
            generate_photo_batch.write_run_config(config, path)
            loaded = generate_photo_batch.load_run_config(path)
        self.assertEqual(config, loaded)


class TestPlanCommand(unittest.TestCase):
    def setUp(self):
        self.runner = CliRunner()
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)

    def test_plan_prints_exact_portfolio_slots_and_makes_no_network_call(self):
        with patch("generate_photo_batch.CredentialResolver", side_effect=AssertionError("must not be called")):
            result = self.runner.invoke(
                app,
                [
                    "plan",
                    "--count",
                    "10",
                    "--provider",
                    "mixed",
                    "--staging-root",
                    os.path.join(self.tmpdir.name, "runs"),
                ],
            )
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("4 collections / 4 activities / 2 playful", result.stdout)

    def test_plan_writes_a_reproducible_config_file(self):
        config_out = os.path.join(self.tmpdir.name, "run-config.json")
        result = self.runner.invoke(
            app,
            [
                "plan",
                "--count",
                "5",
                "--provider",
                "openai",
                "--config-out",
                config_out,
                "--staging-root",
                os.path.join(self.tmpdir.name, "runs"),
            ],
        )
        self.assertEqual(result.exit_code, 0, result.stdout)
        loaded = generate_photo_batch.load_run_config(config_out)
        self.assertEqual(loaded.count, 5)
        self.assertEqual(loaded.provider_mode, "openai")

    def test_plan_rejects_invalid_provider_mode(self):
        result = self.runner.invoke(app, ["plan", "--provider", "dalle"])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Invalid configuration", result.stdout)


class TestGenerateCommand(unittest.TestCase):
    def setUp(self):
        self.runner = CliRunner()
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)

    def _write_config(self, **overrides):
        answers = {"execution_mode": "execute"}
        answers.update(overrides)
        config = build_run_config_from_answers(answers)
        path = os.path.join(self.tmpdir.name, "run-config.json")
        generate_photo_batch.write_run_config(config, path)
        return path

    def test_unattended_generate_requires_yes(self):
        config_path = self._write_config()
        result = self.runner.invoke(app, ["generate", "--config", config_path])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("--yes", result.stdout)

    def test_dry_run_config_never_requires_yes_or_touches_credentials(self):
        config_path = self._write_config(execution_mode="dry_run")
        with patch("generate_photo_batch.CredentialResolver", side_effect=AssertionError("must not be called")):
            result = self.runner.invoke(app, ["generate", "--config", config_path])
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("dry-run", result.stdout.lower())

    def test_direct_flags_without_config_build_an_execute_mode_config(self):
        # Matches the plan's documented live-smoke-test invocation shape:
        # `generate --provider google --count 1 --max-images 1 --keep-rejected --yes`,
        # with no --config at all.
        captured = {}

        def fake_execute(run_config, run_id=None, resume=False):
            captured["config"] = run_config

        with patch("generate_photo_batch._execute_run", side_effect=fake_execute):
            result = self.runner.invoke(
                app,
                [
                    "generate",
                    "--provider",
                    "google",
                    "--count",
                    "1",
                    "--max-images",
                    "1",
                    "--keep-rejected",
                    "--yes",
                ],
            )
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertEqual(captured["config"].provider_mode, "google")
        self.assertEqual(captured["config"].count, 1)
        self.assertEqual(captured["config"].max_images, 1)
        self.assertTrue(captured["config"].keep_rejected)
        self.assertEqual(captured["config"].execution_mode, "execute")

    def test_config_flag_overrides_and_ignores_other_flags(self):
        config_path = self._write_config(provider_mode="openai", count=3)
        captured = {}

        def fake_execute(run_config, run_id=None, resume=False):
            captured["config"] = run_config

        with patch("generate_photo_batch._execute_run", side_effect=fake_execute):
            result = self.runner.invoke(
                app,
                ["generate", "--config", config_path, "--provider", "google", "--count", "99", "--yes"],
            )
        self.assertEqual(result.exit_code, 0, result.stdout)
        # The loaded --config wins entirely; the other flags are ignored.
        self.assertEqual(captured["config"].provider_mode, "openai")
        self.assertEqual(captured["config"].count, 3)


class TestResolveProvidersForExecution(unittest.TestCase):
    class FakeProviderClass:
        def __init__(self, credential):
            self.credential = credential

    class FakeResolver:
        def __init__(self, google=None, openai=None):
            self._google = google
            self._openai = openai

        def resolve_google(self):
            return self._google

        def resolve_openai(self):
            return self._openai

    def _classes(self):
        return {"google": self.FakeProviderClass, "openai": self.FakeProviderClass}

    def test_mixed_mode_requires_both_without_fallback(self):
        resolver = self.FakeResolver(google="g-cred", openai=None)
        config = RunConfig(provider_mode="mixed", allow_provider_fallback=False)
        with self.assertRaises(ValueError):
            resolve_providers_for_execution(config, resolver, self._classes())

    def test_mixed_mode_narrows_to_single_provider_with_fallback(self):
        resolver = self.FakeResolver(google="g-cred", openai=None)
        config = RunConfig(provider_mode="mixed", allow_provider_fallback=True)
        providers, effective_config, missing = resolve_providers_for_execution(config, resolver, self._classes())
        self.assertEqual(list(providers.keys()), ["google"])
        self.assertEqual(effective_config.provider_mode, "google")
        self.assertEqual(missing, ["openai"])

    def test_raises_when_fallback_leaves_no_provider(self):
        resolver = self.FakeResolver(google=None, openai=None)
        config = RunConfig(provider_mode="mixed", allow_provider_fallback=True)
        with self.assertRaises(ValueError):
            resolve_providers_for_execution(config, resolver, self._classes())

    def test_single_provider_mode_unaffected_when_available(self):
        resolver = self.FakeResolver(google="g-cred", openai=None)
        config = RunConfig(provider_mode="google")
        providers, effective_config, missing = resolve_providers_for_execution(config, resolver, self._classes())
        self.assertEqual(list(providers.keys()), ["google"])
        self.assertEqual(effective_config.provider_mode, "google")
        self.assertEqual(missing, [])


class TestDoctorCommand(unittest.TestCase):
    def test_doctor_completes_without_generating_and_reports_checks(self):
        runner = CliRunner()
        result = runner.invoke(app, ["doctor"])
        self.assertEqual(result.exit_code, 0, result.stdout)
        for label in ("Google credentials", "OpenAI credentials", "Catalog", "Disk space free"):
            self.assertIn(label, result.stdout)


class TestCatalogCommand(unittest.TestCase):
    def test_catalog_validate_reports_ok(self):
        runner = CliRunner()
        result = runner.invoke(app, ["catalog", "validate"])
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("OK", result.stdout)


class TestHistoryCommand(unittest.TestCase):
    def test_history_stats_runs_against_missing_history_file(self):
        runner = CliRunner()
        with patch("generate_photo_batch.HISTORY_PATH_DEFAULT", "/nonexistent/path/accepted.jsonl"):
            result = runner.invoke(app, ["history", "stats"])
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("Recent accepted scenes: 0", result.stdout)


class TestAuthCommands(unittest.TestCase):
    def test_auth_status_never_prints_raw_credential_value(self):
        from base_auth import ResolvedCredential

        runner = CliRunner()
        secret_value = "sk-super-secret-value-should-never-appear"
        fake_credential = ResolvedCredential(provider="openai", kind="environment", value=secret_value)

        class FakeResolver:
            def resolve_google(self):
                return None

            def resolve_openai(self):
                return fake_credential

        with patch("generate_photo_batch.CredentialResolver", return_value=FakeResolver()):
            result = runner.invoke(app, ["auth", "status"])

        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertNotIn(secret_value, result.stdout)
        self.assertIn("openai", result.stdout)

    def test_auth_login_delegates_to_run_google_adc_login(self):
        runner = CliRunner()
        calls = []

        def fake_login():
            calls.append("called")
            return 0

        with patch("generate_photo_batch.run_google_adc_login", side_effect=fake_login):
            result = runner.invoke(app, ["auth", "login", "google"])
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertEqual(calls, ["called"])

    def test_auth_login_rejects_openai(self):
        runner = CliRunner()
        result = runner.invoke(app, ["auth", "login", "openai"])
        self.assertNotEqual(result.exit_code, 0)

    def test_auth_set_key_stores_via_hidden_prompt(self):
        runner = CliRunner()
        captured = {}

        def fake_store(provider, secret):
            captured["provider"] = provider
            captured["secret"] = secret

        with patch("generate_photo_batch.store_provider_key", side_effect=fake_store):
            result = runner.invoke(app, ["auth", "set-key", "openai"], input="my-secret-key\n")
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertEqual(captured["provider"], "openai")
        self.assertEqual(captured["secret"], "my-secret-key")
        self.assertNotIn("my-secret-key", result.stdout)

    def test_auth_remove_delegates(self):
        runner = CliRunner()
        captured = {}

        def fake_remove(provider):
            captured["provider"] = provider

        with patch("generate_photo_batch.remove_provider_key", side_effect=fake_remove):
            result = runner.invoke(app, ["auth", "remove", "google"])
        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertEqual(captured["provider"], "google")


class TestReportCommand(unittest.TestCase):
    def test_report_open_only_opens_the_generated_html_file(self):
        runner = CliRunner()
        with tempfile.TemporaryDirectory() as tmp:
            staging_root = os.path.join(tmp, "runs")
            RunStore.create(RunConfig(), [SAMPLE_BRIEF], root=staging_root, run_id="run-report-cli")

            opened = []
            with patch("generate_photo_batch.webbrowser.open", side_effect=lambda url: opened.append(url)):
                result = runner.invoke(app, ["report", "run-report-cli", "--staging-root", staging_root, "--open"])

            self.assertEqual(result.exit_code, 0, result.stdout)
            self.assertEqual(len(opened), 1)
            expected_html = Path(staging_root) / "run-report-cli" / "report.html"
            self.assertTrue(expected_html.exists())
            self.assertEqual(opened[0], expected_html.resolve().as_uri())


class TestConfigSummary(unittest.TestCase):
    def test_summary_includes_provider_models_and_spend_ceiling(self):
        config = build_run_config_from_answers({"provider_mode": "mixed", "max_spend_usd": 12.5})
        lines = generate_photo_batch._run_config_summary_lines(config)
        joined = "\n".join(lines)
        self.assertIn("Provider models:", joined)
        self.assertIn("google=", joined)
        self.assertIn("openai=", joined)
        self.assertIn("$12.50", joined)

    def test_summary_reports_no_spend_ceiling_when_unset(self):
        config = build_run_config_from_answers({})
        joined = "\n".join(generate_photo_batch._run_config_summary_lines(config))
        self.assertIn("Spend ceiling: none", joined)


class TestPlanReproducibleCommand(unittest.TestCase):
    def test_reproducible_command_never_hardcodes_yes(self):
        runner = CliRunner()
        with tempfile.TemporaryDirectory() as tmp:
            result = runner.invoke(
                app,
                ["plan", "--count", "5", "--staging-root", os.path.join(tmp, "runs")],
            )
        self.assertEqual(result.exit_code, 0, result.stdout)
        for line in result.stdout.splitlines():
            if line.startswith("Reproducible command:"):
                self.assertNotIn("--yes", line)
        self.assertIn("add --yes", result.stdout)


class TestInteractiveWizard(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self._original_cwd = os.getcwd()
        os.chdir(self.tmpdir.name)
        self.addCleanup(os.chdir, self._original_cwd)
        # CliRunner always replaces sys.stdin with a non-tty stream, even when
        # fed scripted `input=`, so the wizard's interactivity check must be
        # forced on to actually exercise the wizard path under test.
        patcher = patch("generate_photo_batch._is_interactive", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _wizard_input(self, execute="n", confirm_paid="n"):
        return (
            "mixed\n10\nbalanced_40_40_20\nproduction\n40\n\nn\n"
            f".base-generation/runs\n{execute}\n{confirm_paid}\n"
        )

    def test_invalid_provider_mode_answer_reprompts_instead_of_crashing(self):
        runner = CliRunner()
        # First answer is invalid; the wizard must re-ask, not raise.
        input_with_typo = "bogus\n" + self._wizard_input()
        result = runner.invoke(app, [], input=input_with_typo)

        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIsNone(result.exception)
        self.assertIn("isn't one of", result.stdout)
        self.assertIn("mixed/google/openai", result.stdout)

    def test_wizard_shows_summary_before_asking_to_execute_and_never_hardcodes_yes(self):
        runner = CliRunner()
        result = runner.invoke(app, [], input=self._wizard_input())

        self.assertEqual(result.exit_code, 0, result.stdout)
        summary_index = result.stdout.find("Run summary")
        execute_prompt_index = result.stdout.find("Execute now")
        self.assertNotEqual(summary_index, -1)
        self.assertNotEqual(execute_prompt_index, -1)
        self.assertLess(summary_index, execute_prompt_index)
        for line in result.stdout.splitlines():
            if line.startswith("Reproducible command:"):
                self.assertNotIn("--yes", line)

    def test_declining_execute_never_runs_generation(self):
        runner = CliRunner()
        with patch("generate_photo_batch._execute_run") as fake_execute:
            result = runner.invoke(app, [], input=self._wizard_input(execute="n"))
        self.assertEqual(result.exit_code, 0, result.stdout)
        fake_execute.assert_not_called()

    def test_declining_the_second_paid_confirmation_never_runs_generation(self):
        runner = CliRunner()
        with patch("generate_photo_batch._execute_run") as fake_execute:
            result = runner.invoke(app, [], input=self._wizard_input(execute="y", confirm_paid="n"))
        self.assertEqual(result.exit_code, 0, result.stdout)
        fake_execute.assert_not_called()

    def test_confirming_both_prompts_runs_generation_exactly_once(self):
        runner = CliRunner()
        with patch("generate_photo_batch._execute_run") as fake_execute:
            result = runner.invoke(app, [], input=self._wizard_input(execute="y", confirm_paid="y"))
        self.assertEqual(result.exit_code, 0, result.stdout)
        fake_execute.assert_called_once()
        called_config = fake_execute.call_args[0][0]
        self.assertEqual(called_config.execution_mode, "execute")


class TestWizardFlagEquivalence(unittest.TestCase):
    def test_wizard_answers_and_plan_flags_produce_equivalent_run_config(self):
        wizard_answers = {
            "provider_mode": "openai",
            "count": 6,
            "portfolio_preset": "balanced_40_40_20",
            "quality_preset": "production",
            "max_images": 24,
            "keep_rejected": False,
            "staging_root": ".base-generation/runs",
            "execution_mode": "dry_run",
        }
        flag_answers = {
            "provider_mode": "openai",
            "critic_mode": "auto",
            "count": 6,
            "seed": 0,
            "max_images": 24,
            "staging_root": ".base-generation/runs",
        }
        self.assertEqual(
            build_run_config_from_answers(wizard_answers), build_run_config_from_answers(flag_answers)
        )


class TestMockedEndToEndAcceptance(unittest.TestCase):
    """A single fully-mocked run through every real production code path --
    catalog selection, provider generation, real normalization, real local
    gate logic (with a fixture route function), a fake critic, real ledger
    transitions, a mocked structural handoff, real finalization, real atomic
    publication into a temporary directory, and real report generation --
    asserting no real network client is ever constructed and no file is ever
    written under the real `public/levels`.
    """

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.root = self.tmpdir.name

    def test_mocked_batch_reaches_published_without_network_or_production_writes(self):
        from base_image_provider import normalize_provider_image

        briefs = load_scene_catalog(FULL_CATALOG_PATH)

        def make_master_png_bytes():
            image = Image.new("RGB", DEFAULT_BASE_GENERATION_POLICY.master_size, (110, 120, 130))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            return buffer.getvalue()

        class FakeGenerationProvider:
            """Stands in for GoogleImageProvider/OpenAIImageProvider. Never
            imports or constructs a real SDK client."""

            def __init__(self, provider_name):
                self.provider_name = provider_name
                self.calls = 0

            def generate(self, request):
                self.calls += 1
                return [
                    ProviderImage(
                        provider=self.provider_name,
                        model=request.model,
                        request_id=f"{self.provider_name}-req-{self.calls}",
                        native_size=request.size,
                        image_bytes=make_master_png_bytes(),
                    )
                ]

        fake_google = FakeGenerationProvider("google")
        fake_openai = FakeGenerationProvider("openai")

        evaluator = BaseCandidateEvaluator(
            critic=FakeVisualCritic(),
            policy=DEFAULT_BASE_GENERATION_POLICY,
            route_canvas=lambda path: PASSING_ROUTE_RESULT,
            hash_image=lambda path: hash(path) & ((1 << 64) - 1),
        )

        history_store = AcceptedHistoryStore(path=os.path.join(self.root, "accepted.jsonl"))
        pipeline = BaseGenerationPipeline(
            policy=DEFAULT_BASE_GENERATION_POLICY,
            briefs=briefs,
            providers={"google": fake_google, "openai": fake_openai},
            evaluator=evaluator,
            history_store=history_store,
            staging_root=os.path.join(self.root, "runs"),
            normalize=normalize_provider_image,  # the real normalizer, not a fake
        )

        result = pipeline.run(RunConfig(count=1, provider_mode="mixed", max_images=4))

        self.assertEqual(len(result.accepted), 1)
        self.assertGreaterEqual(fake_google.calls, 1)
        self.assertGreaterEqual(fake_openai.calls, 1)

        winner = result.accepted[0]
        scene_id = winner.candidate.scene_brief_id

        # --- Fake structural handoff: the real structural pipeline module is
        # mocked (never actually invoked), but everything downstream of it
        # (finalization, publication, reports) is the real production code. ---
        edit_bbox = (700, 500, 900, 700)
        structural_base = Image.new("RGB", DEFAULT_BASE_GENERATION_POLICY.master_size, (110, 120, 130))
        structural_variant = _paste_patch(structural_base, edit_bbox, (200, 80, 80))
        ground_truth = {"x": 50.0, "y": 50.0, "radius": 5.0, "bbox": edit_bbox}

        def fake_generate_single_scene_difference(scene_spec, output_dir=None, policy=None, scheduler=None):
            out = Path(output_dir)
            out.mkdir(parents=True, exist_ok=True)
            structural_base.save(out / f"{scene_id}_base.jpg", format="JPEG", quality=100)
            structural_variant.save(out / f"{scene_id}_variant.jpg", format="JPEG", quality=100)
            manifest_entry = {"id": scene_id, "diffs": [ground_truth], "title": scene_id}
            log_entry = {"accepted": True, "ground_truth": ground_truth}
            return True, manifest_entry, log_entry

        with patch(
            "unified_operation_pipeline.generate_single_scene_difference",
            side_effect=fake_generate_single_scene_difference,
        ):
            finalized, log_entry = generate_structural_pair(
                winner.candidate, {"id": scene_id, "title": scene_id}, os.path.join(self.root, "structural-staging")
            )

        self.assertIsNotNone(finalized)
        self.assertTrue(log_entry["accepted"])

        # --- Real atomic publication, into a temporary directory only. ---
        levels_dir = os.path.join(self.root, "public-levels")
        manifest_path = os.path.join(self.root, "manifest.json")
        published_entry = publish_pair(
            finalized, {"id": scene_id, "title": scene_id}, levels_dir, manifest_path
        )

        self.assertTrue(Path(levels_dir, Path(published_entry["baseImage"]).name).exists())
        self.assertTrue(Path(levels_dir, Path(published_entry["variantImage"]).name).exists())
        manifest = json.loads(Path(manifest_path).read_text())
        self.assertEqual(len(manifest), 1)
        self.assertEqual(manifest[0]["id"], scene_id)

        # --- Real report generation. ---
        store = RunStore.resume(result.run_id, root=os.path.join(self.root, "runs"))
        json_report_path = write_json_report(store)
        html_report_path = write_html_report(store)
        self.assertTrue(json_report_path.exists())
        self.assertTrue(html_report_path.exists())

        # --- No real production path was ever touched. ---
        self.assertFalse(Path(f"public/levels/{scene_id}_base.jpg").exists())
        self.assertFalse(Path(f"public/levels/{scene_id}_variant.jpg").exists())


if __name__ == "__main__":
    unittest.main()
