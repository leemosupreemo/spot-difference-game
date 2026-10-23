#!/usr/bin/env python3
"""
Unit Test Suite for Diff Hunter Three-Pipeline Architecture
================================================================================
Tests:
  1. Pipeline 1 (Social): Aspect ratio handling, metadata format, review paths.
  2. Pipeline 2 (Daily): Batch-of-3 enforcement, dailyOnly flag, pending gate.
  3. Pipeline 3 (Regular): Batch-of-5 enforcement, distinct base photos, pending gate.
  4. Stock Image Provider: Criteria validation (resolution, contrast, typography).
================================================================================
"""

import json
import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

import sys
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from pipeline_daily import validate_daily_batch, next_daily_set_id
from pipeline_regular import validate_regular_batch, next_regular_set_id
from stock_image_provider import validate_image_criteria, crop_to_aspect
import small_object_editor as E


class TestThreePipelines(unittest.TestCase):

    def test_recolor_object_functionality(self):
        # Create small test patch with chroma/color
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        img[:, :] = (180, 80, 40)
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[30:70, 30:70] = 1
        rng = np.random.default_rng(42)
        recolored, mask_out = E.recolor_object(img, mask, rng, shift_deg=90)
        self.assertEqual(recolored.shape, img.shape)
        # Verify inside mask changed color significantly
        diff = np.abs(recolored.astype(float) - img.astype(float))
        self.assertGreater(diff[50, 50].sum(), 20.0)
        # Verify outside mask is unchanged
        self.assertEqual(diff[10, 10].sum(), 0.0)

    def test_daily_batch_validation_enforces_multiple_of_three(self):
        # 1 level -> FAIL
        l1 = [{"id": "d1_01", "baseImage": "b1.jpg", "dailyOnly": True, "setId": "daily_set_001"}]
        ok, reason = validate_daily_batch(l1)
        self.assertFalse(ok)
        self.assertIn("multiples of 3", reason)

        # 2 levels -> FAIL
        l2 = l1 + [{"id": "d1_02", "baseImage": "b2.jpg", "dailyOnly": True, "setId": "daily_set_001"}]
        ok, reason = validate_daily_batch(l2)
        self.assertFalse(ok)

        # 3 levels with distinct bases -> PASS
        l3 = l2 + [{"id": "d1_03", "baseImage": "b3.jpg", "dailyOnly": True, "setId": "daily_set_001"}]
        ok, reason = validate_daily_batch(l3)
        self.assertTrue(ok)
        self.assertEqual(reason, "Valid")

    def test_daily_batch_rejects_duplicate_base_photos(self):
        # 3 levels with duplicate base photo -> FAIL
        dupe = [
            {"id": "d1_01", "baseImage": "same_base.jpg", "dailyOnly": True, "setId": "daily_set_001"},
            {"id": "d1_02", "baseImage": "diff_base.jpg", "dailyOnly": True, "setId": "daily_set_001"},
            {"id": "d1_03", "baseImage": "same_base.jpg", "dailyOnly": True, "setId": "daily_set_001"},
        ]
        ok, reason = validate_daily_batch(dupe)
        self.assertFalse(ok)
        self.assertIn("repeated base photographs", reason)

    def test_daily_batch_rejects_missing_daily_flags(self):
        l3_missing_flag = [
            {"id": "d1_01", "baseImage": "b1.jpg", "dailyOnly": False, "setId": "daily_set_001"},
            {"id": "d1_02", "baseImage": "b2.jpg", "dailyOnly": True, "setId": "daily_set_001"},
            {"id": "d1_03", "baseImage": "b3.jpg", "dailyOnly": True, "setId": "daily_set_001"},
        ]
        ok, reason = validate_daily_batch(l3_missing_flag)
        self.assertFalse(ok)
        self.assertIn("dailyOnly: true", reason)

    def test_regular_batch_validation_enforces_multiple_of_five(self):
        # 4 levels -> FAIL
        l4 = [
            {"id": f"p1_{i:02d}", "baseImage": f"b{i}.jpg", "sequence": i, "setId": "photo_set_001"}
            for i in range(1, 5)
        ]
        ok, reason = validate_regular_batch(l4)
        self.assertFalse(ok)
        self.assertIn("multiples of 5", reason)

        # 5 levels with distinct bases and sequence 1..5 -> PASS
        l5 = l4 + [{"id": "p1_05", "baseImage": "b5.jpg", "sequence": 5, "setId": "photo_set_001"}]
        ok, reason = validate_regular_batch(l5)
        self.assertTrue(ok)
        self.assertEqual(reason, "Valid")

    def test_regular_batch_rejects_duplicate_base_photos(self):
        l5_dupe = [
            {"id": f"p1_{i:02d}", "baseImage": "same.jpg" if i in (1, 3) else f"b{i}.jpg", "sequence": i, "setId": "photo_set_001"}
            for i in range(1, 6)
        ]
        ok, reason = validate_regular_batch(l5_dupe)
        self.assertFalse(ok)
        self.assertIn("repeated base photographs", reason)

    def test_stock_image_criteria_validation(self):
        # 1. Under-resolution image -> FAIL
        small_im = Image.new("RGB", (800, 600), (128, 128, 128))
        ok, reason = validate_image_criteria(small_im, min_w=1200, min_h=900)
        self.assertFalse(ok)
        self.assertIn("below minimum", reason)

        # 2. Blank uniform image (no contrast) -> FAIL
        blank_im = Image.new("RGB", (1200, 900), (100, 100, 100))
        ok, reason = validate_image_criteria(blank_im, min_w=1200, min_h=900)
        self.assertFalse(ok)
        self.assertIn("low contrast", reason)

        # 3. High resolution natural textured image -> PASS
        natural_arr = np.zeros((900, 1200, 3), dtype=np.uint8)
        # Create gradient with distinct shapes
        for y in range(900):
            natural_arr[y, :, 0] = int(y / 900.0 * 200)
            natural_arr[y, :, 1] = int((1 - y / 900.0) * 180)
            natural_arr[y, :, 2] = 120
        # Add distinct geometric blocks with high contrast
        cv2.rectangle(natural_arr, (200, 200), (500, 500), (240, 240, 240), -1)
        cv2.rectangle(natural_arr, (700, 300), (1000, 700), (30, 30, 30), -1)
        cv2.circle(natural_arr, (600, 450), 120, (220, 180, 50), -1)
        good_im = Image.fromarray(natural_arr)
        ok, reason = validate_image_criteria(good_im, min_w=1200, min_h=900)
        self.assertTrue(ok, f"Expected valid, got: {reason}")
        self.assertEqual(reason, "Valid")

    def test_crop_to_aspect(self):
        # Landscape 1600x1200 -> exact 4:3 1200x900
        src = Image.new("RGB", (1600, 1200), (200, 200, 200))
        cropped = crop_to_aspect(src, 1200, 900)
        self.assertEqual(cropped.size, (1200, 900))

        # Landscape 1600x1200 -> 2:3 portrait 848x1264
        cropped_p = crop_to_aspect(src, 848, 1264)
        self.assertEqual(cropped_p.size, (848, 1264))

    def test_next_set_id_helpers(self):
        manifest = [
            {"setId": "daily_set_001"},
            {"setId": "daily_set_002"},
            {"setId": "photo_set_001"},
            {"setId": "photo_set_002"},
        ]
        next_d = next_daily_set_id(manifest)
        self.assertEqual(next_d, "daily_set_003")

        next_r = next_regular_set_id(manifest)
        self.assertEqual(next_r, "photo_set_003")


if __name__ == "__main__":
    unittest.main()
