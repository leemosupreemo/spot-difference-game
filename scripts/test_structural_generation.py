import unittest
from unittest.mock import patch
import os
import tempfile

import cv2
import numpy as np

from generation_policy import MIXED_GENERATION_POLICY, STRUCTURAL_ONLY_POLICY
from remove_target_selector import RemoveTargetSelector
from reorder_target_selector import ReorderTargetSelector
from structural_mask_refiner import StructuralMaskRefiner
from structural_quality import (
    StructuralNaturalnessCritic,
    select_candidate,
)
from unified_operation_pipeline import build_operation_queue, generate_single_scene_difference


def textured_canvas(width, height):
    y, x = np.indices((height, width))
    texture = ((x * 3 + y * 5) % 17).astype(np.uint8)
    return np.dstack((110 + texture, 125 + texture, 140 + texture))


class TestGenerationPolicy(unittest.TestCase):
    def test_default_policy_preserves_mixed_first_pass_generation(self):
        self.assertIn("recolor", MIXED_GENERATION_POLICY.allowed_operations)
        self.assertEqual(MIXED_GENERATION_POLICY.selection_mode, "first_pass")

    def test_structural_policy_excludes_recolor_and_selects_best_candidate(self):
        self.assertEqual(
            STRUCTURAL_ONLY_POLICY.allowed_operations,
            ("add", "remove", "reorder"),
        )
        self.assertEqual(STRUCTURAL_ONLY_POLICY.selection_mode, "best_score")

    def test_structural_queue_ignores_a_disallowed_recolor_preference(self):
        queue, error = build_operation_queue(
            {"recolor": 1.0, "add": 0.8, "remove": 0.6, "reorder": 0.4},
            "recolor",
            scheduler=None,
            policy=STRUCTURAL_ONLY_POLICY,
        )

        self.assertIsNone(error)
        self.assertEqual(queue, ["add", "remove", "reorder"])

    def test_structural_queue_rejects_when_no_allowed_operation_is_viable(self):
        queue, error = build_operation_queue(
            {"recolor": 1.0, "add": 0.1, "remove": 0.2, "reorder": 0.0},
            None,
            scheduler=None,
            policy=STRUCTURAL_ONLY_POLICY,
        )

        self.assertEqual(queue, [])
        self.assertEqual(error, "NoAllowedOperation")

    def test_mixed_queue_only_uses_operations_reported_by_the_router(self):
        queue, error = build_operation_queue(
            {"add": 0.8, "remove": 0.4},
            None,
            scheduler=None,
            policy=MIXED_GENERATION_POLICY,
        )

        self.assertIsNone(error)
        self.assertEqual(queue, ["add", "remove"])


class TestStructuralMaskRefiner(unittest.TestCase):
    def test_refiner_removes_disconnected_specks_and_builds_cleanup_mask(self):
        image = textured_canvas(160, 160)
        mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.rectangle(mask, (60, 62), (92, 94), 255, -1)
        mask[10, 10] = 255

        result = StructuralMaskRefiner.refine(
            image,
            mask,
            [60, 62, 92, 94],
            _grabcut=lambda _image, cleaned, _roi: cleaned,
        )

        self.assertEqual(result.object_mask[10, 10], 0)
        self.assertGreater(np.sum(result.object_mask > 0), 800)
        self.assertTrue(np.all(result.cleanup_mask[result.object_mask > 0] > 0))
        self.assertLess(result.metrics["cleanup_area_pct"], 8.0)
        self.assertEqual(result.metrics["component_count"], 1)
        self.assertEqual(result.metrics["boundary_change_ratio"], 0.0)

    def test_refiner_falls_back_when_grabcut_changes_area_too_much(self):
        image = textured_canvas(160, 160)
        mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(mask, (80, 80), 14, 255, -1)

        def drifting_grabcut(_image, cleaned, _roi):
            return cv2.dilate(cleaned, np.ones((19, 19), np.uint8), iterations=1)

        result = StructuralMaskRefiner.refine(
            image,
            mask,
            [66, 66, 94, 94],
            _grabcut=drifting_grabcut,
        )

        self.assertEqual(result.metrics["refinement_status"], "grabcut_drift_fallback")
        self.assertLessEqual(
            abs(result.metrics["refined_area"] - result.metrics["cleaned_area"]),
            1,
        )

    def test_cleanup_mask_stays_inside_local_expansion(self):
        image = textured_canvas(120, 120)
        mask = np.zeros((120, 120), dtype=np.uint8)
        cv2.rectangle(mask, (45, 48), (70, 72), 255, -1)

        result = StructuralMaskRefiner.refine(
            image,
            mask,
            [45, 48, 70, 72],
            _grabcut=lambda _image, cleaned, _roi: cleaned,
        )
        ys, xs = np.where(result.cleanup_mask > 0)

        self.assertGreaterEqual(xs.min(), 31)
        self.assertLessEqual(xs.max(), 84)
        self.assertGreaterEqual(ys.min(), 34)
        self.assertLessEqual(ys.max(), 86)


class TestStructuralQuality(unittest.TestCase):
    def test_candidate_ranker_selects_later_higher_quality_result(self):
        candidates = [
            {
                "id": "first",
                "selector_score": 90,
                "naturalness_score": 0.40,
                "compactness_score": 0.60,
                "difficulty_fit_score": 0.50,
                "attempt_index": 0,
            },
            {
                "id": "second",
                "selector_score": 78,
                "naturalness_score": 0.95,
                "compactness_score": 0.90,
                "difficulty_fit_score": 0.90,
                "attempt_index": 1,
            },
        ]

        selected = select_candidate(candidates, "best_score")

        self.assertEqual(selected["id"], "second")
        self.assertIn("score_components", selected)

    def test_first_pass_selection_preserves_candidate_order(self):
        candidates = [
            {"id": "first", "attempt_index": 0},
            {"id": "better", "attempt_index": 1, "naturalness_score": 1.0},
        ]

        self.assertEqual(select_candidate(candidates, "first_pass")["id"], "first")

    def test_clean_compact_add_passes(self):
        base = textured_canvas(160, 160)
        variant = base.copy()
        object_mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(object_mask, (80, 80), 10, 255, -1)
        variant[object_mask > 0] = (35, 80, 180)

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [68, 68, 92, 92],
            operation="add",
            object_mask=object_mask,
            occupied_mask=np.zeros_like(object_mask),
        )

        self.assertTrue(result.passed, result.reason)
        self.assertGreater(result.score, 0.5)
        self.assertGreater(result.metrics["boundary_delta_e"], 0.0)

    def test_small_protrusion_attached_to_a_clean_add_is_rejected(self):
        # Models a real published defect: an otherwise-clean added object
        # with a small leftover fragment attached just outside its mask
        # (spill_fraction ~0.20). This measured under the old 0.25 ceiling
        # and shipped a visibly wrong silhouette; MAX_SPILL_FRACTION (0.15)
        # exists specifically to catch this shape of defect.
        base = textured_canvas(160, 160)
        variant = base.copy()
        object_mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(object_mask, (80, 80), 10, 255, -1)
        variant[object_mask > 0] = (35, 80, 180)
        variant[95:103, 75:85] = (20, 30, 40)  # small protrusion just past the mask edge

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [65, 65, 105, 108],
            operation="add",
            object_mask=object_mask,
            occupied_mask=np.zeros_like(object_mask),
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rejection_code, "StructuralBoundaryArtifact")

    def test_changed_pixels_outside_object_boundary_are_rejected(self):
        base = textured_canvas(160, 160)
        variant = base.copy()
        variant[55:105, 55:105] = 10
        object_mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(object_mask, (80, 80), 9, 255, -1)

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [52, 52, 108, 108],
            operation="add",
            object_mask=object_mask,
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rejection_code, "StructuralBoundaryArtifact")

    def test_excessively_blurred_removal_is_rejected(self):
        checker = ((np.indices((160, 160)).sum(axis=0) % 2) * 190 + 30).astype(np.uint8)
        base = np.dstack((checker, checker, checker))
        variant = base.copy()
        variant[55:105, 55:105] = cv2.GaussianBlur(base[55:105, 55:105], (25, 25), 8)

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [55, 55, 104, 104],
            operation="remove",
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rejection_code, "StructuralBlurArtifact")

    def test_added_object_collision_is_rejected(self):
        base = textured_canvas(160, 160)
        variant = base.copy()
        placed_mask = np.zeros((160, 160), dtype=np.uint8)
        occupied_mask = np.zeros_like(placed_mask)
        cv2.circle(placed_mask, (80, 80), 10, 255, -1)
        cv2.circle(occupied_mask, (84, 80), 10, 255, -1)
        variant[placed_mask > 0] = (30, 70, 170)

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [68, 68, 92, 92],
            operation="add",
            object_mask=placed_mask,
            occupied_mask=occupied_mask,
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rejection_code, "StructuralCollision")

    def test_distant_reorder_footprints_are_rejected(self):
        base = textured_canvas(180, 180)
        variant = base.copy()
        old_mask = np.zeros((180, 180), dtype=np.uint8)
        new_mask = np.zeros_like(old_mask)
        cv2.circle(old_mask, (50, 90), 10, 255, -1)
        cv2.circle(new_mask, (125, 90), 10, 255, -1)
        variant[old_mask > 0] = (130, 130, 130)
        variant[new_mask > 0] = (30, 70, 170)

        result = StructuralNaturalnessCritic.evaluate(
            base,
            variant,
            [38, 78, 137, 102],
            operation="reorder",
            old_mask=old_mask,
            new_mask=new_mask,
        )

        self.assertFalse(result.passed)
        self.assertEqual(result.rejection_code, "SplitDifferenceRegion")


class TestCleanupMaskIntegration(unittest.TestCase):
    @staticmethod
    def _fake_reconstruction(image_bgr, reconstruction_mask, _raw_masks, difficulty="Medium"):
        variant = image_bgr.copy()
        variant[reconstruction_mask > 0] = (215, 215, 215)
        ys, xs = np.where(reconstruction_mask > 0)
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        return variant, bbox, {"reconstruction_test": True}, None

    @staticmethod
    def _passing_verification(*_args, **_kwargs):
        return True, {"source_area_pct": 0.4}, "verified", None

    def test_remove_uses_cleanup_mask_for_background_reconstruction(self):
        base = np.full((100, 100, 3), 110, dtype=np.uint8)
        object_mask = np.zeros((100, 100), dtype=np.uint8)
        cleanup_mask = np.zeros_like(object_mask)
        cv2.circle(object_mask, (50, 50), 5, 255, -1)
        cv2.circle(cleanup_mask, (50, 50), 8, 255, -1)

        with (
            patch(
                "remove_target_selector.BackgroundReconstructionRouter.reconstruct_background",
                side_effect=self._fake_reconstruction,
            ),
            patch(
                "remove_target_selector.PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look",
                side_effect=self._passing_verification,
            ),
        ):
            passed, variant, _ground_truth, _reason = RemoveTargetSelector.execute_removal_and_qa(
                base,
                object_mask,
                [45, 45, 55, 55],
                [],
                difficulty="Medium",
                cleanup_mask=cleanup_mask,
            )

        self.assertTrue(passed)
        self.assertTrue(np.array_equal(variant[50, 44], [215, 215, 215]))

    def test_reorder_cleans_shadow_but_extracts_only_tight_object(self):
        base = np.full((100, 100, 3), 110, dtype=np.uint8)
        base[object_slice := np.s_[45:56, 45:56]] = (30, 80, 170)
        object_mask = np.zeros((100, 100), dtype=np.uint8)
        cleanup_mask = np.zeros_like(object_mask)
        cv2.rectangle(object_mask, (45, 45), (55, 55), 255, -1)
        cv2.rectangle(cleanup_mask, (42, 42), (58, 58), 255, -1)

        with (
            patch(
                "reorder_target_selector.BackgroundReconstructionRouter.reconstruct_background",
                side_effect=self._fake_reconstruction,
            ),
            patch(
                "reorder_target_selector.PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look",
                side_effect=self._passing_verification,
            ),
        ):
            passed, variant, _ground_truth, _reason = ReorderTargetSelector.execute_reorder_and_qa(
                base,
                object_mask,
                [45, 45, 55, 55],
                {"type": "translate", "dx": 3, "dy": 0, "angle": 0},
                [42, 42, 61, 58],
                [],
                difficulty="Medium",
                cleanup_mask=cleanup_mask,
            )

        self.assertTrue(passed)
        self.assertTrue(np.array_equal(variant[45, 43], [215, 215, 215]))
        self.assertTrue(np.array_equal(base[object_slice][0, 0], [30, 80, 170]))


class TestStructuralOrchestration(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = os.path.join(self.temp_dir.name, "dense_base.png")
        self.base = textured_canvas(160, 160)
        self.donor_mask = np.zeros((160, 160), dtype=np.uint8)
        cv2.circle(self.donor_mask, (30, 30), 10, 255, -1)
        self.base[self.donor_mask > 0] = (35, 80, 180)
        cv2.imwrite(self.base_path, self.base)
        self.donor = {
            "idx": 0,
            "mask": self.donor_mask,
            "bbox": [20, 20, 40, 40],
            "centroid": (30.0, 30.0),
            "area_pct": float(np.sum(self.donor_mask > 0)) / (160 * 160) * 100.0,
            "r_frac": 1.0,
            "halo_std": 4.0,
        }
        self.router_result = {
            "approved": True,
            "affordances": {"recolor": 1.0, "add": 0.9, "remove": 0.1, "reorder": 0.1},
            "candidate_masks": [self.donor],
            "peer_groups": [{"size": 2, "indices": [0], "avg_area": 0.4}],
            "raw_masks": np.asarray([self.donor_mask]),
            "recommended_operation": "add",
        }
        self.pairs = [
            {
                "donor": self.donor,
                "donor_bbox": [20, 20, 40, 40],
                "slot_bbox": [70, 70, 90, 90],
                "score": 50.0,
                "peer_group_size": 2,
            },
            {
                "donor": self.donor,
                "donor_bbox": [20, 20, 40, 40],
                "slot_bbox": [105, 70, 125, 90],
                "score": 95.0,
                "peer_group_size": 2,
            },
        ]

    def tearDown(self):
        self.temp_dir.cleanup()

    def _execute_add(self, image_bgr, _donor_bbox, slot_bbox, _donor_mask, difficulty="Medium"):
        variant = image_bgr.copy()
        cx = (slot_bbox[0] + slot_bbox[2]) // 2
        cy = (slot_bbox[1] + slot_bbox[3]) // 2
        cv2.circle(variant, (cx, cy), 10, (35, 80, 180), -1)
        return True, variant, {
            "x": round(cx / 160.0 * 100.0, 1),
            "y": round(cy / 160.0 * 100.0, 1),
            "radius": 6.0,
            "bbox": slot_bbox,
            "metrics": {"source_area_pct": 0.4},
        }, "verified"

    def test_structural_mode_selects_later_higher_scoring_candidate(self):
        scene = {
            "id": "structural_best_of_n",
            "title": "Best structural candidate",
            "image_path": self.base_path,
            "preferred_op": "add",
        }

        with (
            patch(
                "unified_operation_pipeline.SceneAffordanceRouter.evaluate_and_route_canvas",
                return_value=self.router_result,
            ),
            patch(
                "unified_operation_pipeline.AddTargetSelector.find_best_add_pair",
                return_value=(self.pairs[0], "two pairs", self.pairs),
            ),
            patch(
                "unified_operation_pipeline.AddTargetSelector.execute_add_and_qa",
                side_effect=self._execute_add,
            ),
            patch(
                "unified_operation_pipeline.PeerPaletteColorEngine.shift_color_peer_relative",
                side_effect=AssertionError("structural mode invoked recolor"),
            ),
        ):
            success, entry, log = generate_single_scene_difference(
                scene,
                output_dir=self.temp_dir.name,
                policy=STRUCTURAL_ONLY_POLICY,
            )

        self.assertTrue(success, log)
        self.assertEqual(entry["operation"], "add")
        self.assertEqual(entry["diffs"][0]["x"], 71.9)
        self.assertEqual(log["candidate_attempt_count"], 2)
        self.assertEqual(log["passing_candidate_count"], 2)
        self.assertGreater(log["selected_candidate_score"], 0.7)

    def test_mixed_mode_preserves_first_passing_candidate(self):
        scene = {
            "id": "mixed_first_pass",
            "title": "First mixed candidate",
            "image_path": self.base_path,
            "preferred_op": "add",
        }
        calls = 0

        def first_only(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise AssertionError("mixed mode evaluated past the first passing candidate")
            return self._execute_add(*args, **kwargs)

        with (
            patch(
                "unified_operation_pipeline.SceneAffordanceRouter.evaluate_and_route_canvas",
                return_value=self.router_result,
            ),
            patch(
                "unified_operation_pipeline.AddTargetSelector.find_best_add_pair",
                return_value=(self.pairs[0], "two pairs", self.pairs),
            ),
            patch(
                "unified_operation_pipeline.AddTargetSelector.execute_add_and_qa",
                side_effect=first_only,
            ),
        ):
            success, entry, _log = generate_single_scene_difference(
                scene,
                output_dir=self.temp_dir.name,
                policy=MIXED_GENERATION_POLICY,
            )

        self.assertTrue(success)
        self.assertEqual(calls, 1)
        self.assertEqual(entry["diffs"][0]["x"], 50.0)

    def test_failed_structural_generation_writes_no_files(self):
        scene = {
            "id": "structural_rejected",
            "title": "Rejected structural candidate",
            "image_path": self.base_path,
            "preferred_op": "add",
        }

        with (
            patch(
                "unified_operation_pipeline.SceneAffordanceRouter.evaluate_and_route_canvas",
                return_value=self.router_result,
            ),
            patch(
                "unified_operation_pipeline.AddTargetSelector.find_best_add_pair",
                return_value=(None, "no slots", []),
            ),
        ):
            success, entry, log = generate_single_scene_difference(
                scene,
                output_dir=self.temp_dir.name,
                policy=STRUCTURAL_ONLY_POLICY,
            )

        self.assertFalse(success)
        self.assertIsNone(entry)
        self.assertEqual(log["rejection_code"], "NoStructuralCandidate")
        self.assertFalse(os.path.exists(os.path.join(self.temp_dir.name, "structural_rejected_base.jpg")))
        self.assertFalse(os.path.exists(os.path.join(self.temp_dir.name, "structural_rejected_variant.jpg")))


if __name__ == "__main__":
    unittest.main()
