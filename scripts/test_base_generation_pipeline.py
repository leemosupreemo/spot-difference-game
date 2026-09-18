import unittest

from base_candidate_evaluator import BaseCandidateEvaluator, rank_candidates
from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from base_generation_types import NormalizedCandidate, RunConfig, SceneBrief
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


if __name__ == "__main__":
    unittest.main()
