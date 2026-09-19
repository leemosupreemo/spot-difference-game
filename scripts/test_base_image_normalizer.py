import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from base_generation_policy import BaseGenerationPolicy
from base_image_normalizer import normalize_local_image


def _png_bytes(width, height, color=(120, 130, 140)):
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestNormalizeLocalImage(unittest.TestCase):
    def setUp(self):
        self.policy = BaseGenerationPolicy(master_size=(400, 300), max_normalization_crop_fraction=0.05)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.output_path = str(Path(self.tmp.name) / "master.png")

    def test_exact_aspect_ratio_needs_no_crop(self):
        candidate = normalize_local_image(_png_bytes(800, 600), "scene-1", self.output_path, self.policy)

        self.assertEqual(candidate.normalization_crop_fraction, 0.0)
        self.assertEqual(candidate.size, (400, 300))
        self.assertEqual(candidate.scene_brief_id, "scene-1")
        self.assertEqual(candidate.master_path, self.output_path)
        with Image.open(self.output_path) as saved:
            self.assertEqual(saved.size, (400, 300))
            self.assertEqual(saved.format, "PNG")

    def test_wider_than_target_is_center_cropped_horizontally(self):
        candidate = normalize_local_image(_png_bytes(816, 600), "scene-2", self.output_path, self.policy)

        self.assertGreater(candidate.normalization_crop_fraction, 0.0)
        self.assertLess(candidate.normalization_crop_fraction, 0.05)
        with Image.open(self.output_path) as saved:
            self.assertEqual(saved.size, (400, 300))

    def test_taller_than_target_is_center_cropped_vertically(self):
        candidate = normalize_local_image(_png_bytes(400, 310), "scene-3", self.output_path, self.policy)

        self.assertGreater(candidate.normalization_crop_fraction, 0.0)
        self.assertLess(candidate.normalization_crop_fraction, 0.05)
        with Image.open(self.output_path) as saved:
            self.assertEqual(saved.size, (400, 300))

    def test_excessive_crop_is_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            normalize_local_image(_png_bytes(2000, 300), "scene-4", self.output_path, self.policy)
        self.assertIn("NormalizationCropExceeded", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
