import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from base_generation_types import NormalizedCandidate
from local_masked_edits import (
    find_paste_regions, duplicate_target, validate_duplicate, _local_background,
)
from local_star_fallback import detect_star_targets, generate_star_variants
from test_local_star_fallback import starfield


class PasteRegionTests(unittest.TestCase):
    def test_regions_avoid_existing_targets_and_borders(self):
        image = starfield()
        targets = detect_star_targets(image)
        patch = (80, 80)
        regions = find_paste_regions(image, targets, patch)
        self.assertTrue(regions, "a sparse starfield should have room to paste")

        occupied = np.zeros(image.shape[:2], bool)
        for t in targets:
            occupied |= t["mask"] > 0
        h, w = image.shape[:2]
        for region in regions:
            cx, cy = region["center"]
            self.assertGreater(cx, 12); self.assertGreater(cy, 12)
            self.assertLess(cx, w - 12); self.assertLess(cy, h - 12)
            y, x = int(cy - 40), int(cx - 40)
            self.assertFalse(occupied[y:y+80, x:x+80].any(),
                             "a destination must not overlap an existing object")

    def test_quietest_regions_come_first(self):
        image = starfield()
        regions = find_paste_regions(image, detect_star_targets(image), (60, 60))
        variances = [r["variance"] for r in regions]
        self.assertEqual(variances, sorted(variances))

    def test_a_patch_larger_than_the_image_yields_nothing(self):
        image = starfield()
        self.assertEqual(find_paste_regions(image, [], (5000, 5000)), [])


class DuplicateEditTests(unittest.TestCase):
    def setUp(self):
        self.image = starfield()
        self.targets = detect_star_targets(self.image)
        self.assertTrue(self.targets)

    def _first_region(self, target):
        x1, y1, x2, y2 = target["bbox"]
        regions = find_paste_regions(self.image, self.targets, (y2 - y1, x2 - x1))
        self.assertTrue(regions, "fixture should leave somewhere to paste")
        return regions[0]

    def test_only_pixels_inside_the_destination_mask_change(self):
        target = self.targets[0]
        region = self._first_region(target)
        variant, mask = duplicate_target(self.image, target, region["center"])
        outside = mask == 0
        np.testing.assert_array_equal(self.image[outside], variant[outside])
        self.assertTrue((mask > 0).any(), "the edit must actually mark a region")

    def test_the_copy_reproduces_the_donor_pixels(self):
        # Nothing is synthesised. The mask edge is deliberately feathered into
        # the destination, so the guarantee is checked on the interior, where
        # the composite weight is 1 and the donor pixels must survive exactly.
        target = self.targets[0]
        region = self._first_region(target)
        variant, mask = duplicate_target(self.image, target, region["center"])

        x1, y1, x2, y2 = (int(v) for v in target["bbox"])
        ph, pw = y2 - y1, x2 - x1
        cx, cy = region["center"]
        dx, dy = int(round(cx - pw / 2.0)), int(round(cy - ph / 2.0))

        donor_patch = self.image[y1:y2, x1:x2]
        copied_patch = variant[dy:dy+ph, dx:dx+pw]
        interior = cv2.erode(
            (mask[dy:dy+ph, dx:dx+pw] > 0).astype(np.uint8), np.ones((13, 13), np.uint8)
        ) > 0
        self.assertTrue(interior.any(), "fixture target should have an interior")
        np.testing.assert_array_equal(copied_patch[interior], donor_patch[interior])

    def test_the_donor_itself_is_left_untouched(self):
        target = self.targets[0]
        region = self._first_region(target)
        variant, _ = duplicate_target(self.image, target, region["center"])
        src = target["mask"] > 0
        np.testing.assert_array_equal(self.image[src], variant[src],
                                      "a duplicate adds a copy; it must not move the original")

    def test_a_destination_off_the_edge_is_refused(self):
        with self.assertRaises(ValueError):
            duplicate_target(self.image, self.targets[0], (5, 5))

    def test_mismatched_substrate_is_rejected(self):
        # Half dark sky, half bright wall: a star copied into the bright half
        # would sit in a square of foreign sky.
        image = np.zeros((600, 800, 3), np.uint8)
        image[:, :400] = 8
        image[:, 400:] = 210
        cv2.circle(image, (150, 300), 22, (210, 180, 120), -1)
        target = {"mask": np.zeros((600, 800), np.uint8), "bbox": (128, 278, 172, 322)}
        cv2.circle(target["mask"], (150, 300), 22, 255, -1)

        _, dark_mask = duplicate_target(image, target, (300, 300))
        ok, _, _ = validate_duplicate(image, target, dark_mask)
        self.assertTrue(ok, "same substrate should pass")

        _, bright_mask = duplicate_target(image, target, (620, 300))
        ok, metrics, code = validate_duplicate(image, target, bright_mask)
        self.assertFalse(ok)
        self.assertEqual(code, "DuplicateBackgroundMismatch")
        self.assertGreater(metrics["background_delta"], 26)


class DuplicatePipelineTests(unittest.TestCase):
    def test_duplication_produces_publishable_pairs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            master = root / "master.png"
            cv2.imwrite(str(master), starfield())
            candidate = NormalizedCandidate("fixture", "manual", "manual", "fixture",
                                            str(master), (1536, 1152), 0)
            pairs, log = generate_star_variants(candidate, {"id": "fixture"}, root, 2,
                                                operation="duplicate")
            self.assertEqual(log["operation"], "duplicate")
            self.assertEqual(len(pairs), log["accepted_count"])
            for _finalized, entry in pairs:
                self.assertEqual(entry["operation"], "duplicate")
                self.assertEqual(entry["diffs"][0]["operation"], "duplicate")
                self.assertIn("copy", entry["diffs"][0]["description"].lower())

    def test_the_marked_spot_is_the_copy_not_the_donor(self):
        image = starfield()
        targets = detect_star_targets(image)
        target = targets[0]
        x1, y1, x2, y2 = target["bbox"]
        region = find_paste_regions(image, targets, (y2 - y1, x2 - x1))[0]
        _, mask = duplicate_target(image, target, region["center"])
        ys, xs = np.nonzero(mask)
        cx, cy = xs.mean(), ys.mean()
        dx, dy = target["center"]
        self.assertGreater(np.hypot(cx - dx, cy - dy), 40,
                           "the player must be sent to the new copy, not the original")


if __name__ == "__main__":
    unittest.main()
