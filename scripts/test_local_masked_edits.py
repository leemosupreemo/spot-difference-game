"""Preservation must hold even when an editor changes the entire canvas."""
import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np

from local_masked_edits import hard_composite, expand_generation_mask, _verify_encoded


class HardCompositeTests(unittest.TestCase):
    def test_context_mask_never_authorizes_pixels_in_final_output(self):
        base = np.full((40, 40, 3), 20, np.uint8)
        generated = np.full_like(base, 220)
        mask = np.zeros((40, 40), np.uint8)
        mask[10:30, 10:30] = 255
        context = expand_generation_mask(mask, 6)
        result = hard_composite(base, generated, mask, feather_pixels=3)
        self.assertGreater(np.count_nonzero(context), np.count_nonzero(mask))
        np.testing.assert_array_equal(result[mask == 0], base[mask == 0])
        np.testing.assert_array_equal(result[20, 20], [220, 220, 220])
        self.assertTrue(np.all(result[10, 20] > 20))
        self.assertTrue(np.all(result[10, 20] < 220))
        np.testing.assert_array_equal(base, np.full_like(base, 20))

    def test_empty_and_full_masks_are_well_defined(self):
        base = np.zeros((10, 10, 3), np.uint8)
        generated = np.full_like(base, 100)
        np.testing.assert_array_equal(hard_composite(base, generated, np.zeros((10, 10), np.uint8)), base)
        np.testing.assert_array_equal(hard_composite(base, generated, np.ones((10, 10), np.uint8), feather_pixels=0), generated)

    def test_bad_dimensions_and_nonfinite_masks_fail_closed(self):
        base = np.zeros((10, 10, 3), np.uint8)
        for mask in (np.zeros((9, 10)), np.full((10, 10), np.nan)):
            with self.assertRaises(ValueError):
                hard_composite(base, base, mask)
        with self.assertRaises(ValueError):
            hard_composite(base, base[:5], np.ones((10, 10)))

    def test_delivered_assets_reject_single_byte_drift_outside_resampling_band(self):
        # A one-byte change is invisible to a >14 threshold but violates the
        # preservation contract of lossless output. Test both far-away drift
        # and drift inside the bbox but outside the actual circular mask.
        base = np.full((200, 200, 3), 20, np.uint8)
        mask = np.zeros((200, 200), np.uint8)
        cv2.circle(mask, (100, 100), 35, 255, -1)
        target = {"mask": mask, "bbox": (65, 65, 136, 136)}
        with tempfile.TemporaryDirectory() as directory:
            base_path, variant_path = Path(directory) / "base.webp", Path(directory) / "variant.webp"
            from PIL import Image
            Image.fromarray(base).save(base_path, lossless=True)
            for y, x in ((0, 0), (66, 66)):
                variant = base.copy()
                variant[mask > 0] = (20, 40, 60)
                variant[y, x, 0] += 1
                Image.fromarray(variant).save(variant_path, lossless=True)
                result = _verify_encoded(SimpleNamespace(base_path=str(base_path), variant_path=str(variant_path)), target, "Medium")
                self.assertFalse(result[0])
                self.assertEqual(result[2], "EncodedOutsideRegionDrift")


if __name__ == "__main__":
    unittest.main()
