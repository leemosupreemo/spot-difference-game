import unittest

from base_candidate_evaluator import run_local_gates
from base_generation_policy import BaseGenerationPolicy


def _approved_route_result(**overrides):
    result = {
        "approved": True,
        "reason": None,
        "metrics": {
            "sharpness_uniformity": 0.5,
            "edge_density": 0.05,
            "largest_foreground_pct": 10.0,
        },
        "object_count": 25,
        "candidate_count": 12,
        "peer_group_count": 3,
        "affordances": {"add": 0.6, "remove": 0.6, "reorder": 0.6},
    }
    result.update(overrides)
    return result


class TestRunLocalGates(unittest.TestCase):
    def setUp(self):
        self.policy = BaseGenerationPolicy()

    def test_passing_candidate_has_no_failures(self):
        passed, failures, route_result = run_local_gates(
            "unused.png", self.policy, route_canvas=lambda path: _approved_route_result()
        )
        self.assertTrue(passed)
        self.assertEqual(failures, ())
        self.assertTrue(route_result["approved"])

    def test_not_approved_short_circuits_with_router_reason(self):
        passed, failures, _ = run_local_gates(
            "unused.png",
            self.policy,
            route_canvas=lambda path: {"approved": False, "reason": "too blurry"},
        )
        self.assertFalse(passed)
        self.assertEqual(failures, ("LocalGateReject: too blurry",))

    def test_low_sharpness_uniformity_is_rejected(self):
        route_result = _approved_route_result(
            metrics={"sharpness_uniformity": 0.01, "edge_density": 0.05, "largest_foreground_pct": 10.0}
        )
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("SharpnessUniformityReject") for f in failures))

    def test_router_structural_early_exit_still_checks_source_quality(self):
        from ingest_failure_report import classify_rejection

        for metrics, code in [
            ({"sharpness_uniformity": 0.23, "edge_density": 0.05, "largest_foreground_pct": 10}, "SharpnessUniformityReject"),
            ({"sharpness_uniformity": 0.5, "edge_density": 0.05, "largest_foreground_pct": 24}, "HeroObjectReject"),
        ]:
            route = {"approved": False, "reason": "Universal Gate Fail: Too few objects (2 < 14).", "metrics": metrics}
            passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route)
            self.assertFalse(passed)
            self.assertTrue(any(f.startswith(code) for f in failures), failures)
            self.assertEqual(classify_rejection(failures)["category"], "source_quality")

    def test_low_edge_density_is_rejected(self):
        route_result = _approved_route_result(
            metrics={"sharpness_uniformity": 0.5, "edge_density": 0.001, "largest_foreground_pct": 10.0}
        )
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("EdgeDensityReject") for f in failures))

    def test_low_object_count_is_rejected(self):
        route_result = _approved_route_result(object_count=1)
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("ObjectCountReject") for f in failures))

    def test_too_few_editable_targets_is_rejected(self):
        route_result = _approved_route_result(candidate_count=1)
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("EditableTargetReject") for f in failures))

    def test_too_few_peer_groups_is_rejected(self):
        route_result = _approved_route_result(peer_group_count=0)
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("PeerGroupReject") for f in failures))

    def test_hero_object_dominance_is_rejected(self):
        route_result = _approved_route_result(
            metrics={"sharpness_uniformity": 0.5, "edge_density": 0.05, "largest_foreground_pct": 90.0}
        )
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("HeroObjectReject") for f in failures))

    def test_no_structural_affordance_is_rejected(self):
        route_result = _approved_route_result(affordances={"add": 0.1, "remove": 0.1, "reorder": 0.1})
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertTrue(any(f.startswith("StructuralAffordanceReject") for f in failures))

    def test_multiple_failures_are_all_reported(self):
        route_result = _approved_route_result(object_count=1, peer_group_count=0)
        passed, failures, _ = run_local_gates("unused.png", self.policy, route_canvas=lambda path: route_result)
        self.assertFalse(passed)
        self.assertEqual(len(failures), 2)


if __name__ == "__main__":
    unittest.main()
