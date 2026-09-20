import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

import cv2
import numpy as np
from typer.testing import CliRunner

from generate_photo_batch import app
from local_segmented_fallback import select_segmented_targets, filter_foreground_targets, generate_segmented_variants
from base_generation_types import NormalizedCandidate
from test_local_star_fallback import starfield


def fixture_masks():
    masks = np.zeros((2, 1152, 1536), np.uint8)
    cv2.circle(masks[0], (220, 240), 38, 1, -1)
    cv2.circle(masks[1], (660, 260), 38, 1, -1)
    return masks


class SegmentedFallbackTests(unittest.TestCase):
    def test_dark_gap_between_bright_objects_is_not_a_recolor_target(self):
        image = np.full((400, 400, 3), 70, np.uint8)
        image[50:180, 50:180] = 215
        image[80:120, 80:120] = 70
        image[220:260, 250:290] = 215
        masks = np.zeros((2, 400, 400), np.uint8)
        masks[0, 80:120, 80:120] = 1
        masks[1, 220:260, 250:290] = 1
        targets = select_segmented_targets(masks, image.shape)
        kept, rejected = filter_foreground_targets(image, targets)
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["center"], (269.5, 239.5))
        self.assertEqual(len(rejected), 1)
        self.assertEqual(rejected[0]["reason"], "BackgroundLikeMask")

    def test_router_retains_masks_on_object_count_rejection(self):
        from scene_affordance_router import SceneAffordanceRouter

        masks = fixture_masks()
        tensor = SimpleNamespace(cpu=lambda: SimpleNamespace(numpy=lambda: masks))
        inference = lambda *args, **kwargs: [SimpleNamespace(masks=SimpleNamespace(data=tensor))]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.png"
            # Uniform random texture passes the router's sharpness/edge gates.
            cv2.imwrite(str(source), np.random.default_rng(0).integers(0, 256, (300, 400, 3), dtype=np.uint8))
            with patch("scene_affordance_router.FastSAM", return_value=inference):
                route = SceneAffordanceRouter.evaluate_and_route_canvas(str(source))
        self.assertFalse(route["approved"])
        self.assertIn("Too few objects", route["reason"])
        np.testing.assert_array_equal(route.get("raw_masks"), masks)

    def test_router_low_count_does_not_hide_large_foreground(self):
        from scene_affordance_router import SceneAffordanceRouter
        from base_candidate_evaluator import run_local_gates
        from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
        from ingest_failure_report import classify_rejection

        masks = np.zeros((2, 300, 400), np.uint8)
        masks[0, 10:290, 10:300] = 1
        masks[1, 100:125, 350:375] = 1
        tensor = SimpleNamespace(cpu=lambda: SimpleNamespace(numpy=lambda: masks))
        inference = lambda *args, **kwargs: [SimpleNamespace(masks=SimpleNamespace(data=tensor))]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.png"
            cv2.imwrite(str(source), np.random.default_rng(0).integers(0, 256, (300, 400, 3), dtype=np.uint8))
            with patch("scene_affordance_router.FastSAM", return_value=inference):
                passed, failures, _ = run_local_gates(str(source), DEFAULT_BASE_GENERATION_POLICY,
                    route_canvas=SceneAffordanceRouter.evaluate_and_route_canvas)
        self.assertFalse(passed)
        self.assertEqual(classify_rejection(failures)["category"], "source_quality", failures)

    def test_rejects_disconnected_border_and_dominant_masks_and_deduplicates(self):
        good = fixture_masks()[0]
        disconnected = good.copy()
        disconnected[700:730, 900:930] = 1
        border = np.zeros_like(good)
        border[:60, :60] = 1
        masks = [good, good.copy(), disconnected, border, np.ones_like(good)]
        targets = select_segmented_targets(np.array(masks), good.shape)
        self.assertEqual(len(targets), 1)
        self.assertEqual(targets[0]["bbox"], (182, 202, 259, 279))
        self.assertEqual(targets[0]["center"], (220.0, 240.0))
        np.testing.assert_array_equal(targets[0]["mask"] > 0, good > 0)

    def test_probability_masks_threshold_before_resize(self):
        mask = np.full((100, 100), 0.1, np.float32)
        mask[40:47, 40:47] = 0.9
        targets = select_segmented_targets([mask], (400, 400))
        self.assertEqual(len(targets), 1)
        self.assertEqual(targets[0]["area"], 784)

    def test_missing_weights_are_reported_without_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            master = root / "master.png"
            cv2.imwrite(str(master), starfield())
            candidate = NormalizedCandidate("fixture", "manual", "manual", "fixture", str(master), (1536, 1152), 0)
            pairs, log = generate_segmented_variants(candidate, {"id": "fixture"}, root, 2, weights=root / "missing.pt")
            self.assertEqual(pairs, [])
            self.assertEqual(log["rejection_code"], "LocalSegmentationUnavailable")
            self.assertFalse((root / "finalized").exists())

    def test_cli_reuses_gate_masks_and_reports_passing_candidates_after_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            report, manifest = root / "report.json", root / "manifest.json"
            # Mock only the expensive first-pass inference. Recolor, validation,
            # finalization, encoding, publication, and report writing are real.
            route = {"raw_masks": fixture_masks()}
            with patch("generate_photo_batch.run_local_gates", return_value=(False, ("ObjectCountReject: too few",), route)):
                result = CliRunner().invoke(app, [str(source), "--fallback", "local-segmented", "--variants", "2",
                    "--levels-dir", str(root / "levels"), "--manifest", str(manifest), "--report", str(report)])
            self.assertEqual(result.exit_code, 0, result.output)
            entries = json.loads(manifest.read_text())
            self.assertEqual(len(entries), 2)
            self.assertEqual({entry["generationMethod"] for entry in entries}, {"local_segmented"})
            self.assertTrue(all(entry["curationStatus"] == "pending" for entry in entries))
            log = json.loads(report.read_text())["images"][0]["fallback_execution"]
            self.assertEqual(log["accepted_count"], 2)
            self.assertEqual(len(log["engines"]), 1)
            self.assertEqual(log["engines"][0]["mask_source"], "first_pass")
            self.assertEqual(len(log["engines"][0]["targets"]), 2)

    def test_structural_stage_rejection_reuses_first_pass_masks(self):
        """An approved gate already ran FastSAM. A later structural rejection
        must reuse those masks rather than paying for a second inference."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            report, manifest = root / "report.json", root / "manifest.json"
            route = {"raw_masks": fixture_masks()}
            log = {"rejection_code": "NoStructuralCandidate", "rejection_reason": "no viable edit"}
            def never(*args, **kwargs):
                raise AssertionError("reloaded FastSAM instead of reusing first-pass masks")
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), route)), \
                 patch("generate_photo_batch.generate_structural_pair_variants", return_value=([], log)), \
                 patch("local_segmented_fallback.load_local_masks", side_effect=never):
                result = CliRunner().invoke(app, [str(source), "--fallback", "local-segmented", "--variants", "2",
                    "--levels-dir", str(root / "levels"), "--manifest", str(manifest), "--report", str(report)])
            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(len(json.loads(manifest.read_text())), 2)
            execution = json.loads(report.read_text())["images"][0]["fallback_execution"]
            self.assertEqual(execution["first_pass_stage"], "structural")
            self.assertEqual(execution["accepted_count"], 2)
            self.assertEqual(execution["engines"][0]["mask_source"], "first_pass")

    def test_auto_tops_up_with_star_without_reusing_a_segmented_object(self):
        """Default mode: segmented covers what it can from the first-pass masks,
        star fills the shortfall, ids stay unique, and no object is published
        twice in two different colors."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            report, manifest = root / "report.json", root / "manifest.json"
            # Two masks cover two of the five glows; star must supply the rest.
            route = {"raw_masks": fixture_masks()}
            with patch("generate_photo_batch.run_local_gates",
                       return_value=(False, ("ObjectCountReject: too few",), route)):
                result = CliRunner().invoke(app, [str(source), "--variants", "5",
                    "--levels-dir", str(root / "levels"), "--manifest", str(manifest),
                    "--report", str(report)])
            self.assertEqual(result.exit_code, 0, result.output)
            entries = json.loads(manifest.read_text())
            self.assertEqual(len(entries), 5)
            # publish_pair controls manifest order; only uniqueness matters here.
            self.assertEqual({entry["id"] for entry in entries},
                             {f"source_v{n}" for n in range(1, 6)})
            self.assertEqual({entry["generationMethod"] for entry in entries},
                             {"local_segmented", "local_star"})

            execution = json.loads(report.read_text())["images"][0]["fallback_execution"]
            self.assertEqual(execution["accepted_count"], 5)
            self.assertEqual([engine["method"] for engine in execution["engines"]],
                             ["local_segmented", "local_star"])
            self.assertEqual(execution["engines"][0]["mask_source"], "first_pass")
            # The star pass dropped the glows segmented had already recolored.
            self.assertGreater(execution["engines"][1]["excluded_target_count"], 0)

            # No two published variants mark the same spot.
            spots = [(round(entry["diffs"][0]["x"], 1), round(entry["diffs"][0]["y"], 1))
                     for entry in entries]
            self.assertEqual(len(set(spots)), 5)

    def test_quality_failure_is_attempted_but_still_flagged_for_source_review(self):
        """A quality reject now reaches the editor. When no target survives, the
        report keeps the quality classification so the source is still reviewed."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            with patch("generate_photo_batch.run_local_gates",
                       return_value=(False, ("SharpnessUniformityReject: blur",), {"raw_masks": []})):
                result = CliRunner().invoke(app, [str(source), "--fallback", "local-segmented",
                    "--manifest", str(root / "manifest.json"), "--report", str(root / "report.json")])
            self.assertEqual(result.exit_code, 1)
            self.assertFalse((root / "manifest.json").exists())
            record = json.loads((root / "report.json").read_text())["images"][0]
            self.assertEqual(record["fallback"]["category"], "source_quality")
            self.assertEqual(record["fallback"]["next_step"], "review_source")
            self.assertEqual(record["fallback_execution"]["accepted_count"], 0)
            self.assertEqual(record["fallback_execution"]["engines"][0]["mask_source"], "first_pass")

    def test_input_error_never_reaches_any_editor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = CliRunner().invoke(app, [str(root / "missing.png"),
                "--manifest", str(root / "manifest.json"), "--report", str(root / "report.json")])
            self.assertEqual(result.exit_code, 1)
            record = json.loads((root / "report.json").read_text())["images"][0]
            self.assertFalse(record["fallback"]["routes_to_fallback"])
            self.assertNotIn("fallback_execution", record)


if __name__ == "__main__":
    unittest.main()
