import os
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from local_inpaint import (
    LocalInpaintingUnavailable, DEFAULT_WEIGHTS, is_available, inpaint, _work_window,
)


class AvailabilityTests(unittest.TestCase):
    """An absent checkpoint is reported, never fetched."""

    def test_missing_weights_raise_rather_than_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            absent = Path(tmp) / "not-provisioned.pt"
            self.assertFalse(is_available(absent))
            image = np.zeros((64, 64, 3), np.uint8)
            mask = np.zeros((64, 64), np.uint8); mask[20:40, 20:40] = 255
            with self.assertRaises(LocalInpaintingUnavailable) as ctx:
                inpaint(image, mask, weights=absent)
            self.assertIn("not provisioned", str(ctx.exception))
            self.assertFalse(absent.exists(), "a missing checkpoint must not be created")

    def test_weights_path_is_overridable(self):
        # A machine may keep models elsewhere without the code being edited.
        source = (Path(__file__).parent / "local_inpaint.py").read_text()
        self.assertIn("DIFF_HUNTER_LAMA_WEIGHTS", source)


class WorkWindowTests(unittest.TestCase):
    """The model runs on a window; a full frame takes 77s against 4s."""

    def test_window_surrounds_the_mask_with_context(self):
        mask = np.zeros((1152, 1536), np.uint8)
        mask[600:660, 700:760] = 1
        y0, y1, x0, x1 = _work_window((1152, 1536), mask, 128)
        self.assertEqual((y0, y1, x0, x1), (472, 788, 572, 888))
        self.assertLess((y1 - y0) * (x1 - x0), 1152 * 1536 * 0.2,
                        "a window that large defeats the point")

    def test_window_is_clipped_to_the_frame(self):
        mask = np.zeros((200, 200), np.uint8)
        mask[0:10, 190:200] = 1
        y0, y1, x0, x1 = _work_window((200, 200), mask, 128)
        self.assertEqual((y0, x1), (0, 200))
        self.assertGreaterEqual(y1, 10)
        self.assertLessEqual(x0, 190)


@unittest.skipUnless(is_available(), "LaMa checkpoint not provisioned")
class InpaintTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(5)
        self.image = rng.integers(0, 256, (320, 384, 3), dtype=np.uint8)
        self.mask = np.zeros((320, 384), np.uint8)
        cv2.circle(self.mask, (190, 160), 26, 255, -1)

    def test_only_the_filled_region_changes(self):
        out = inpaint(self.image, self.mask)
        # The mask is dilated before filling, so compare beyond that band.
        untouched = cv2.dilate((self.mask > 0).astype(np.uint8), np.ones((25, 25), np.uint8)) == 0
        np.testing.assert_array_equal(self.image[untouched], out[untouched])
        self.assertFalse(np.array_equal(self.image[self.mask > 0], out[self.mask > 0]))

    def test_output_keeps_the_input_shape_and_type(self):
        out = inpaint(self.image, self.mask)
        self.assertEqual(out.shape, self.image.shape)
        self.assertEqual(out.dtype, np.uint8)

    def test_an_empty_mask_returns_the_image_untouched(self):
        out = inpaint(self.image, np.zeros_like(self.mask))
        np.testing.assert_array_equal(out, self.image)

    def test_a_mask_touching_the_edge_is_handled(self):
        mask = np.zeros((320, 384), np.uint8)
        mask[0:30, 0:30] = 255
        out = inpaint(self.image, mask)
        self.assertEqual(out.shape, self.image.shape)

    def test_malformed_input_is_refused(self):
        with self.assertRaises(ValueError):
            inpaint(np.zeros((10, 10), np.uint8), self.mask)
        with self.assertRaises(ValueError):
            inpaint(self.image, np.zeros((10, 10), np.uint8))


if __name__ == "__main__":
    unittest.main()
