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


class FeatherWindowingTests(unittest.TestCase):
    """The windowed distance transform must be an optimisation, not a change."""

    @staticmethod
    def _reference(original, generated, mask, feather=5):
        binary = (np.asarray(mask) > 0).astype(np.uint8)
        weight = np.clip(cv2.distanceTransform(binary, cv2.DIST_L2, 3) / feather, 0, 1)[:, :, None]
        blended = np.rint(original * (1 - weight) + generated * weight)
        result = original.copy()
        result[binary > 0] = np.clip(blended[binary > 0], 0, 255).astype(np.uint8)
        return result

    def _case(self, mask):
        rng = np.random.default_rng(7)
        original = rng.integers(0, 256, (240, 320, 3), dtype=np.uint8)
        generated = rng.integers(0, 256, (240, 320, 3), dtype=np.uint8)
        np.testing.assert_array_equal(
            hard_composite(original, generated, mask),
            self._reference(original, generated, mask),
            err_msg="windowed feather must match a full-frame transform exactly"
        )

    def test_matches_full_frame_for_a_small_interior_mask(self):
        mask = np.zeros((240, 320), np.uint8)
        cv2.circle(mask, (160, 120), 18, 255, -1)
        self._case(mask)

    def test_matches_full_frame_for_a_mask_touching_the_border(self):
        # The window clips at the frame edge, exactly as the full transform does.
        mask = np.zeros((240, 320), np.uint8)
        mask[0:30, 0:30] = 255
        self._case(mask)

    def test_matches_full_frame_for_two_separate_blobs(self):
        mask = np.zeros((240, 320), np.uint8)
        cv2.circle(mask, (40, 40), 12, 255, -1)
        cv2.circle(mask, (280, 200), 12, 255, -1)
        self._case(mask)

    def test_matches_full_frame_for_a_full_mask(self):
        self._case(np.full((240, 320), 255, np.uint8))

    def test_an_empty_mask_changes_nothing(self):
        rng = np.random.default_rng(3)
        original = rng.integers(0, 256, (120, 160, 3), dtype=np.uint8)
        generated = rng.integers(0, 256, (120, 160, 3), dtype=np.uint8)
        out = hard_composite(original, generated, np.zeros((120, 160), np.uint8))
        np.testing.assert_array_equal(out, original)
