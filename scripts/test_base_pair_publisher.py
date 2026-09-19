import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from base_generation_policy import BaseGenerationPolicy
from base_generation_types import FinalizedPair, NormalizedCandidate
from base_pair_publisher import generate_structural_pair, generate_structural_pair_variants, publish_pair
from image_pair_finalizer import finalize_pair


def _save(path, array):
    Image.fromarray(array.astype("uint8"), "RGB").save(path)


class TestFinalizePair(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.policy = BaseGenerationPolicy(master_size=(200, 150), production_size=(200, 150))

    def test_valid_pair_is_finalized(self):
        base = np.full((150, 200, 3), 100, dtype=np.uint8)
        variant = base.copy()
        variant[50:100, 50:100] = 200
        base_path = Path(self.tmp.name) / "base.png"
        variant_path = Path(self.tmp.name) / "variant.png"
        _save(base_path, base)
        _save(variant_path, variant)

        ground_truth = {"bbox": (50, 50, 100, 100), "x": 37.5, "y": 50.0, "radius": 5.0}
        output_dir = Path(self.tmp.name) / "finalized"
        finalized = finalize_pair(
            str(base_path), str(variant_path), ground_truth, str(output_dir), "scene-1", self.policy
        )

        self.assertIsInstance(finalized, FinalizedPair)
        self.assertTrue(Path(finalized.base_path).exists())
        self.assertTrue(Path(finalized.variant_path).exists())
        self.assertEqual(finalized.dimensions, (200, 150))
        self.assertEqual(finalized.manifest_id, "scene-1")
        # WebP, not JPEG: comparable-or-better visual quality at a smaller
        # size, and supported since iOS 14 (well within this app's iOS 15
        # floor) -- unlike AVIF, which needs iOS 16.
        self.assertEqual(Path(finalized.base_path).suffix, ".webp")
        self.assertEqual(Path(finalized.variant_path).suffix, ".webp")
        with Image.open(finalized.base_path) as saved:
            self.assertEqual(saved.format, "WEBP")

    def test_dimension_mismatch_is_rejected(self):
        base = np.full((150, 200, 3), 100, dtype=np.uint8)
        variant = np.full((100, 100, 3), 100, dtype=np.uint8)
        base_path = Path(self.tmp.name) / "base.png"
        variant_path = Path(self.tmp.name) / "variant.png"
        _save(base_path, base)
        _save(variant_path, variant)

        with self.assertRaises(ValueError) as ctx:
            finalize_pair(
                str(base_path),
                str(variant_path),
                {"bbox": (0, 0, 10, 10)},
                str(Path(self.tmp.name) / "out"),
                "scene-2",
                self.policy,
            )
        self.assertIn("PairDimensionMismatch", str(ctx.exception))

    def test_no_visible_difference_is_rejected(self):
        base = np.full((150, 200, 3), 100, dtype=np.uint8)
        variant = base.copy()
        base_path = Path(self.tmp.name) / "base.png"
        variant_path = Path(self.tmp.name) / "variant.png"
        _save(base_path, base)
        _save(variant_path, variant)

        with self.assertRaises(ValueError) as ctx:
            finalize_pair(
                str(base_path),
                str(variant_path),
                {"bbox": (50, 50, 100, 100)},
                str(Path(self.tmp.name) / "out"),
                "scene-3",
                self.policy,
            )
        self.assertIn("DifferenceLostAfterDownsample", str(ctx.exception))


class TestPublishPair(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.levels_dir = Path(self.tmp.name) / "levels"
        self.manifest_path = Path(self.tmp.name) / "manifest.json"

        self.staged_base = Path(self.tmp.name) / "staged_base.jpg"
        self.staged_variant = Path(self.tmp.name) / "staged_variant.jpg"
        self.staged_base.write_bytes(b"base-bytes")
        self.staged_variant.write_bytes(b"variant-bytes")

        self.pair = FinalizedPair(
            scene_brief_id="scene-1",
            base_path=str(self.staged_base),
            variant_path=str(self.staged_variant),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="scene-1",
        )

    def test_publish_writes_files_and_manifest_entry(self):
        entry = publish_pair(self.pair, {"title": "Scene One"}, self.levels_dir, self.manifest_path)

        self.assertEqual(entry["id"], "scene-1")
        self.assertTrue((self.levels_dir / Path(entry["baseImage"]).name).exists())
        self.assertTrue((self.levels_dir / Path(entry["variantImage"]).name).exists())
        manifest = json.loads(self.manifest_path.read_text())
        self.assertEqual(manifest[0]["id"], "scene-1")

    def test_publish_preserves_the_finalized_files_own_extension(self):
        # publish_pair must not assume a format -- it publishes whatever
        # finalize_pair actually produced (e.g. .webp), not a hardcoded .jpg.
        webp_base = Path(self.tmp.name) / "staged_base.webp"
        webp_variant = Path(self.tmp.name) / "staged_variant.webp"
        webp_base.write_bytes(b"base-bytes")
        webp_variant.write_bytes(b"variant-bytes")
        pair = FinalizedPair(
            scene_brief_id="scene-2",
            base_path=str(webp_base),
            variant_path=str(webp_variant),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="scene-2",
        )

        entry = publish_pair(pair, {"title": "Scene Two"}, self.levels_dir, self.manifest_path)

        self.assertTrue(entry["baseImage"].endswith(".webp"))
        self.assertTrue(entry["variantImage"].endswith(".webp"))
        self.assertTrue((self.levels_dir / Path(entry["baseImage"]).name).exists())

    def test_failed_manifest_replace_rolls_back_new_files(self):
        def failing_replace(src, dst):
            raise OSError("disk full")

        with self.assertRaises(OSError):
            publish_pair(
                self.pair, {"title": "Scene One"}, self.levels_dir, self.manifest_path, replace_fn=failing_replace
            )

        self.assertEqual(list(self.levels_dir.glob("*")), [])

    def test_republishing_a_scene_id_does_not_touch_old_files(self):
        old_entry = publish_pair(self.pair, {"title": "Original"}, self.levels_dir, self.manifest_path)
        old_base_path = self.levels_dir / Path(old_entry["baseImage"]).name

        new_variant = Path(self.tmp.name) / "new_variant.jpg"
        new_variant.write_bytes(b"different-variant-bytes")
        new_pair = FinalizedPair(
            scene_brief_id="scene-1",
            base_path=str(self.staged_base),
            variant_path=str(new_variant),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="scene-1",
        )
        new_entry = publish_pair(new_pair, {"title": "Replacement"}, self.levels_dir, self.manifest_path)

        self.assertTrue(old_base_path.exists())
        self.assertNotEqual(old_entry["variantImage"], new_entry["variantImage"])
        manifest = json.loads(self.manifest_path.read_text())
        self.assertEqual(len(manifest), 1)
        self.assertEqual(manifest[0]["title"], "Replacement")


class TestGenerateStructuralPair(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.policy = BaseGenerationPolicy(master_size=(200, 150), production_size=(200, 150))
        self.master_path = Path(self.tmp.name) / "master.png"
        _save(self.master_path, np.full((150, 200, 3), 100, dtype=np.uint8))
        self.candidate = NormalizedCandidate(
            scene_brief_id="scene-1",
            provider="manual",
            model="manual-ingest",
            request_id="scene-1",
            master_path=str(self.master_path),
            size=(200, 150),
            normalization_crop_fraction=0.0,
        )

    def test_successful_structural_pair_is_finalized(self):
        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            scene_id = scene_spec["id"]
            base = np.full((150, 200, 3), 100, dtype=np.uint8)
            variant = base.copy()
            variant[50:100, 50:100] = 200
            _save(Path(output_dir) / f"{scene_id}_base.jpg", base)
            _save(Path(output_dir) / f"{scene_id}_variant.jpg", variant)
            ground_truth = {"bbox": (50, 50, 100, 100), "x": 37.5, "y": 50.0, "radius": 5.0}
            manifest_entry = {
                "id": scene_id,
                "title": scene_spec.get("title"),
                "category": "Photography",
                "pack": "Find the Sniper",
                "packId": "find_the_sniper",
                "difficulty": difficulty,
                "baseImage": f"levels/{scene_id}_base.jpg",
                "variantImage": f"levels/{scene_id}_variant.jpg",
                "operation": "add",
                "diffs": [
                    {"id": 1, "x": 37.5, "y": 50.0, "radius": 5.0, "description": "d", "hint": "h", "operation": "add"}
                ],
            }
            log_entry = {"ground_truth": ground_truth, "manifest_entry": manifest_entry}
            return True, manifest_entry, log_entry

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            finalized, log_entry = generate_structural_pair(
                self.candidate, {"id": "scene-1", "title": "Scene One"}, self.tmp.name, policy=self.policy
            )

        self.assertIsNotNone(finalized)
        self.assertEqual(finalized.manifest_id, "scene-1")
        self.assertIn("manifest_entry", log_entry)

    def test_structural_pipeline_rejection_returns_none(self):
        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return False, None, {"rejection_reason": "no viable operation"}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            finalized, log_entry = generate_structural_pair(
                self.candidate, {"id": "scene-1"}, self.tmp.name, policy=self.policy
            )

        self.assertIsNone(finalized)
        self.assertEqual(log_entry["rejection_reason"], "no viable operation")

    def test_difficulty_is_passed_through(self):
        seen = {}

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            seen["difficulty"] = difficulty
            return False, None, {"rejection_reason": "irrelevant"}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            generate_structural_pair(
                self.candidate, {"id": "scene-1"}, self.tmp.name, policy=self.policy, difficulty="Hard"
            )

        self.assertEqual(seen["difficulty"], "Hard")


class TestGenerateStructuralPairVariants(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.policy = BaseGenerationPolicy(master_size=(200, 150), production_size=(200, 150))
        self.master_path = Path(self.tmp.name) / "master.png"
        _save(self.master_path, np.full((150, 200, 3), 100, dtype=np.uint8))
        self.candidate = NormalizedCandidate(
            scene_brief_id="scene-1",
            provider="manual",
            model="manual-ingest",
            request_id="scene-1",
            master_path=str(self.master_path),
            size=(200, 150),
            normalization_crop_fraction=0.0,
        )

    def _ranked_candidate(self, region, operation="add", source_object_key=None):
        variant = np.full((150, 200, 3), 100, dtype=np.uint8)
        y1, y2, x1, x2 = region
        variant[y1:y2, x1:x2] = 200
        return {
            "operation": operation,
            "variant": variant,
            "ground_truth": {
                "bbox": (x1, y1, x2, y2),
                "x": round((x1 + x2) / 2 / 200 * 100, 1),
                "y": round((y1 + y2) / 2 / 150 * 100, 1),
                "radius": 5.0,
            },
            "final_score": 1.0,
            "source_object_key": source_object_key,
        }

    def test_publishes_up_to_count_distinct_variants_with_own_ids(self):
        ranked = [
            self._ranked_candidate((50, 100, 20, 70)),
            self._ranked_candidate((50, 100, 120, 170)),
            self._ranked_candidate((10, 60, 20, 70), operation="remove"),
        ]

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return True, {"id": scene_spec["id"]}, {"ranked_candidates": ranked}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1", "title": "Scene One"}, self.tmp.name, count=2, policy=self.policy
            )

        self.assertEqual(len(variants), 2, "count=2 must cap the result even though 3 candidates passed")
        ids = [entry["id"] for _finalized, entry in variants]
        self.assertEqual(ids, ["scene-1_v1", "scene-1_v2"])
        for finalized, entry in variants:
            self.assertEqual(finalized.manifest_id, entry["id"])
            self.assertTrue(Path(finalized.base_path).exists())
            self.assertTrue(Path(finalized.variant_path).exists())
        self.assertEqual(variants[0][1]["operation"], "add")
        self.assertIn("ranked_candidates", log_entry)

    def test_skips_a_near_duplicate_in_favor_of_a_genuinely_distinct_candidate(self):
        # c1 and c2 are ~2% apart with 5.0-radius hit-circles that overlap
        # heavily (a near-duplicate edit); c3 is genuinely far away. With
        # count=2 the result must be c1 + c3, not c1 + c2.
        c1 = self._ranked_candidate((50, 100, 20, 70))
        c2 = self._ranked_candidate((50, 100, 24, 74))
        c3 = self._ranked_candidate((50, 100, 120, 170))
        ranked = [c1, c2, c3]

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return True, {"id": scene_spec["id"]}, {"ranked_candidates": ranked}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, _log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1"}, self.tmp.name, count=2, policy=self.policy
            )

        self.assertEqual(len(variants), 2)
        xs = [entry["diffs"][0]["x"] for _finalized, entry in variants]
        self.assertEqual(xs, [c1["ground_truth"]["x"], c3["ground_truth"]["x"]])

    def test_prefers_a_different_donor_over_repositioning_the_same_one(self):
        # Models the real pins_on_carpet case: the top 3 ranked candidates
        # all duplicate the SAME flawed donor to different, well-separated
        # slots, and a 4th, lower-ranked candidate uses a genuinely different
        # donor. Requesting 2 variants must surface that different donor
        # instead of two repositions of the same flawed one.
        same_donor = "donor-A"
        c1 = self._ranked_candidate((50, 100, 20, 70), source_object_key=same_donor)
        c2 = self._ranked_candidate((50, 100, 80, 130), source_object_key=same_donor)
        c3 = self._ranked_candidate((50, 100, 140, 190), source_object_key=same_donor)
        c4 = self._ranked_candidate((10, 30, 20, 70), source_object_key="donor-B")
        ranked = [c1, c2, c3, c4]

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return True, {"id": scene_spec["id"]}, {"ranked_candidates": ranked}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, _log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1"}, self.tmp.name, count=2, policy=self.policy
            )

        self.assertEqual(len(variants), 2)
        xs = [entry["diffs"][0]["x"] for _finalized, entry in variants]
        self.assertEqual(xs, [c1["ground_truth"]["x"], c4["ground_truth"]["x"]])

    def test_falls_back_to_repeating_a_donor_when_no_other_distinct_one_exists(self):
        # If every passing candidate duplicates the same donor (no other
        # object in the scene produced a viable edit), the diversity
        # preference must not cut the result short of `count` -- it's still
        # better to show 2 repositions of one donor than fewer than asked.
        same_donor = "donor-A"
        c1 = self._ranked_candidate((50, 100, 20, 70), source_object_key=same_donor)
        c2 = self._ranked_candidate((50, 100, 80, 130), source_object_key=same_donor)
        ranked = [c1, c2]

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return True, {"id": scene_spec["id"]}, {"ranked_candidates": ranked}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, _log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1"}, self.tmp.name, count=2, policy=self.policy
            )

        self.assertEqual(len(variants), 2)

    def test_fewer_passing_candidates_than_count_returns_what_exists(self):
        ranked = [self._ranked_candidate((50, 100, 20, 70))]

        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return True, {"id": scene_spec["id"]}, {"ranked_candidates": ranked}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, _log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1"}, self.tmp.name, count=5, policy=self.policy
            )

        self.assertEqual(len(variants), 1)
        self.assertEqual(variants[0][1]["id"], "scene-1_v1")

    def test_structural_pipeline_rejection_returns_empty_list(self):
        def fake_generate(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium", policy=None):
            return False, None, {"rejection_reason": "no viable operation"}

        with patch("unified_operation_pipeline.generate_single_scene_difference", side_effect=fake_generate):
            variants, log_entry = generate_structural_pair_variants(
                self.candidate, {"id": "scene-1"}, self.tmp.name, count=5, policy=self.policy
            )

        self.assertEqual(variants, [])
        self.assertEqual(log_entry["rejection_reason"], "no viable operation")


if __name__ == "__main__":
    unittest.main()
