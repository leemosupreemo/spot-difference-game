import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from base_generation_policy import BaseGenerationPolicy
from base_generation_types import FinalizedPair, NormalizedCandidate
from base_pair_publisher import generate_structural_pair, publish_pair
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


if __name__ == "__main__":
    unittest.main()
