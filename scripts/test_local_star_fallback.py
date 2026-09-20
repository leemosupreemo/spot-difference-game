import tempfile
import unittest
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np
from PIL import Image

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from base_generation_types import NormalizedCandidate
from generate_photo_batch import ingest_image_variants, ingest_image
from local_star_fallback import detect_star_targets, recolor_target, generate_star_variants, validate_local_edit


def starfield():
    height, width = 1152, 1536
    y, x = np.indices((height, width))
    image = np.full((height, width, 3), 12.0)
    for cx, cy in ((220, 240), (660, 260), (1100, 300), (400, 780), (1040, 800)):
        glow = np.exp(-((x-cx)**2 + (y-cy)**2) / (2 * 22.0**2))
        image += glow[:, :, None] * np.array([195, 95, 35])
    return np.clip(image, 0, 255).astype(np.uint8)


class StarFallbackTests(unittest.TestCase):
    def test_detects_five_separate_glows_without_scale_duplicates(self):
        targets = detect_star_targets(starfield())
        self.assertEqual(len(targets), 5)
        self.assertEqual(len({tuple(t["center"]) for t in targets}), 5)

    def test_uniform_image_has_no_targets(self):
        self.assertEqual(detect_star_targets(np.full((300, 400, 3), 150, np.uint8)), [])

    def test_recolor_preserves_pixels_outside_mask_and_lightness(self):
        base = starfield()
        target = detect_star_targets(base)[0]
        variant = recolor_target(base, target["mask"], 45)
        self.assertTrue(np.array_equal(base[target["mask"] == 0], variant[target["mask"] == 0]))
        b_lab = cv2.cvtColor(base.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
        v_lab = cv2.cvtColor(variant.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
        self.assertLess(np.abs(b_lab[:, :, 0] - v_lab[:, :, 0]).max(), 1.5)
        self.assertGreater(np.abs(base.astype(int) - variant.astype(int)).max(), 14)

    def test_rejects_outside_mask_drift_even_if_tiny_globally(self):
        base = starfield()
        target = detect_star_targets(base)[0]
        variant = recolor_target(base, target["mask"], 45)
        variant[0, 0] = 255
        result = validate_local_edit(base, variant, target, "recolor", "Medium")
        self.assertFalse(result[0])
        self.assertEqual(result[2], "OutsideMaskDrift")

    def test_real_pipeline_finalizes_distinct_candidates(self):
        with tempfile.TemporaryDirectory() as directory:
            master = Path(directory) / "master.png"
            cv2.imwrite(str(master), starfield())
            candidate = NormalizedCandidate("fixture", "manual", "manual", "fixture", str(master), (1536, 1152), 0)
            variants, log = generate_star_variants(candidate, {"id": "fixture", "title": "Fixture"}, directory, 5)
            self.assertGreater(len(variants), 0, log)
            self.assertLessEqual(len(variants), 5)
            centers = []
            for finalized, entry in variants:
                self.assertTrue(Path(finalized.variant_path).exists())
                self.assertEqual(entry["generationMethod"], "local_star")
                self.assertNotEqual(entry.get("curationStatus"), "approved")
                centers.append((entry["diffs"][0]["x"], entry["diffs"][0]["y"]))
            self.assertEqual(len(centers), len(set(centers)))

    def test_blank_image_returns_rejection_without_files(self):
        with tempfile.TemporaryDirectory() as directory:
            master = Path(directory) / "master.png"
            Image.new("RGB", DEFAULT_BASE_GENERATION_POLICY.master_size, "black").save(master)
            candidate = NormalizedCandidate("fixture", "manual", "manual", "fixture", str(master), (1536, 1152), 0)
            variants, log = generate_star_variants(candidate, {"id": "fixture"}, directory, 5)
            self.assertEqual(variants, [])
            self.assertEqual(log["rejection_code"], "NoLocalStarCandidate")
            self.assertFalse((Path(directory) / "finalized").exists())

    def test_quality_rejection_still_reaches_the_second_pass(self):
        """A source-quality reject now gets a second pass like any other. The
        image here has nothing to edit, so it fails on its own merits -- and the
        report keeps the original quality reason for the curator."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            Image.new("RGB", (1536, 1152), "black").save(source)
            with patch("generate_photo_batch.run_local_gates", return_value=(False, ("SharpnessUniformityReject: blur",), {})):
                with self.assertRaisesRegex(ValueError, "No local edit passed"):
                    ingest_image_variants(str(source), "fixture", 5, staging_dir=directory, fallback="local-star")
            log = json.loads((root / "fallback.json").read_text())
            self.assertEqual(log["first_pass_category"], "source_quality")
            self.assertEqual(log["first_pass_reasons"], ["SharpnessUniformityReject: blur"])
            self.assertEqual(log["accepted_count"], 0)

    def test_fallback_none_keeps_the_first_pass_rejection_verbatim(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.png"
            Image.new("RGB", (1536, 1152), "black").save(source)
            with patch("generate_photo_batch.run_local_gates", return_value=(False, ("SharpnessUniformityReject: blur",), {})):
                with self.assertRaisesRegex(ValueError, "SharpnessUniformityReject"):
                    ingest_image_variants(str(source), "fixture", 5, staging_dir=directory, fallback="none")
            self.assertFalse((Path(directory) / "fallback.json").exists())

    def test_structural_rejection_publishes_local_candidates_and_preserves_reason(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            with patch("generate_photo_batch.run_local_gates", return_value=(False, ("ObjectCountReject: 5 below 18",), {})):
                result = ingest_image_variants(str(source), "fixture", 2, staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(len(result), 2)
            self.assertEqual({entry["generationMethod"] for entry in result}, {"local_star"})
            self.assertEqual(len(json.loads((root / "manifest.json").read_text())), 2)
            log = json.loads((root / "fallback.json").read_text())
            self.assertEqual(log["first_pass_reasons"], ["ObjectCountReject: 5 below 18"])
            self.assertEqual(log["accepted_count"], 2)

    def test_unknown_failure_is_routed_but_keeps_its_original_reason(self):
        """An unrecognized code must not drop an image out of the funnel, and
        must not be relabelled as a structural limit on the way through."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            with patch("generate_photo_batch.run_local_gates", return_value=(False, ("UnexpectedReject: bug",), {})):
                published = ingest_image(str(source), "fixture", staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(published["id"], "fixture_v1")
            log = json.loads((root / "fallback.json").read_text())
            self.assertEqual(log["first_pass_category"], "unknown")
            self.assertEqual(log["first_pass_reasons"], ["UnexpectedReject: bug"])


    def test_structural_stage_rejection_routes_variants_to_fallback(self):
        """The gates pass; the structural pipeline is what gives up."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            log = {"rejection_code": "NoStructuralCandidate", "rejection_reason": "no viable edit"}
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), \
                 patch("generate_photo_batch.generate_structural_pair_variants", return_value=([], log)):
                result = ingest_image_variants(str(source), "fixture", 2, staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(len(result), 2)
            self.assertEqual({entry["generationMethod"] for entry in result}, {"local_star"})
            fallback_log = json.loads((root / "fallback.json").read_text())
            self.assertEqual(fallback_log["first_pass_stage"], "structural")
            self.assertEqual(fallback_log["first_pass_reasons"],
                             ["NoStructuralCandidate: no viable edit"])

    def test_structural_stage_rejection_routes_single_ingest_to_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            log = {"rejection_code": "NoStructuralCandidate", "rejection_reason": "no viable edit"}
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), \
                 patch("generate_photo_batch.generate_structural_pair", return_value=(None, log)):
                published = ingest_image(str(source), "fixture", staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(published["id"], "fixture_v1")
            self.assertEqual(json.loads((root / "fallback.json").read_text())["first_pass_stage"], "structural")

    def test_recolor_only_affordance_reaches_the_fallback(self):
        """An image can clear the gate on recolor affordance alone and leave the
        structural-only operation queue empty. That must still reach step two."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            log = {"rejection_code": "NoAllowedOperation", "rejection_reason": "NoAllowedOperation"}
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), \
                 patch("generate_photo_batch.generate_structural_pair_variants", return_value=([], log)):
                result = ingest_image_variants(str(source), "fixture", 1, staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(len(result), 1)

    def test_structural_rejection_without_a_code_is_still_routed(self):
        """A structural failure carrying no code classifies as unknown. It still
        gets a second pass, and the report says the code was missing."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), \
                 patch("generate_photo_batch.generate_structural_pair_variants", return_value=([], {})):
                result = ingest_image_variants(str(source), "fixture", 2, staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(len(result), 2)
            log = json.loads((root / "fallback.json").read_text())
            self.assertEqual(log["first_pass_category"], "unknown")
            self.assertEqual(log["first_pass_reasons"], ["Unknown structural failure"])

    def test_partial_structural_yield_is_published_without_fallback_top_up(self):
        """Documented behavior: any structural success wins the image outright.
        Five requested and two delivered does not hand the shortfall to step two."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            cv2.imwrite(str(source), starfield())
            one = [(SimpleNamespace(base_path=str(source), variant_path=str(source)), {"id": "fixture_v1"})]
            with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), \
                 patch("generate_photo_batch.generate_structural_pair_variants", return_value=(one, {})), \
                 patch("generate_photo_batch.publish_pair", side_effect=lambda pair, entry, *a: entry):
                result = ingest_image_variants(str(source), "fixture", 5, staging_dir=directory,
                    levels_dir=root / "levels", manifest_path=root / "manifest.json", fallback="local-star")
            self.assertEqual(len(result), 1)
            self.assertFalse((root / "fallback.json").exists())

if __name__ == "__main__":
    unittest.main()
