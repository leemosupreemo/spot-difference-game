"""
COMPREHENSIVE PIPELINE UNIT TEST SUITE
================================================================================
Unit tests for:
1. SubstrateCoherenceAnalyzer
2. RemovalNaturalnessCritic
3. BackgroundReconstructionRouter
4. OperationScheduler
5. PerceptualVerificationEngine
================================================================================
"""

import os
import sys
import unittest
import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(__file__))

from remove_target_selector import (
    SubstrateCoherenceAnalyzer,
    RemovalNaturalnessCritic,
    BackgroundReconstructionRouter
)
from unified_operation_pipeline import OperationScheduler
from perceptual_verification_engine import PerceptualVerificationEngine


class TestSubstrateCoherenceAnalyzer(unittest.TestCase):

    def setUp(self):
        # Create 200x200 uniform background image with subtle texture
        self.img = np.full((200, 200, 3), 140, dtype=np.uint8)
        # Add slight natural grain
        noise = np.random.normal(0, 3, (200, 200, 3)).astype(np.int16)
        self.img = np.clip(self.img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        # Target mask: circle in center (20px radius)
        self.target_mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(self.target_mask, (100, 100), 20, 255, -1)

        # Occupied foreground (only the target itself)
        self.occupied_fg = self.target_mask.copy()

    def test_clean_homogeneous_substrate_passes_coherence(self):
        is_coherent, score, metrics, reason = SubstrateCoherenceAnalyzer.analyze_substrate_coherence(
            self.img, self.target_mask, self.occupied_fg
        )
        self.assertTrue(is_coherent, f"Expected coherent substrate, got {reason}")
        self.assertGreaterEqual(score, 0.45)
        self.assertGreater(metrics["clean_px_count"], 150)

    def test_crowded_annulus_fails_coherence(self):
        # Occupy entire annulus with other foreground objects
        dense_fg = np.full((200, 200), 255, dtype=np.uint8)
        is_coherent, score, metrics, reason = SubstrateCoherenceAnalyzer.analyze_substrate_coherence(
            self.img, self.target_mask, dense_fg
        )
        self.assertFalse(is_coherent)
        self.assertIn("LowSubstrateCoherenceReject", str(reason))


class TestRemovalNaturalnessCritic(unittest.TestCase):

    def setUp(self):
        self.base_img = np.full((200, 200, 3), 150, dtype=np.uint8)
        # Add realistic noise
        noise = np.random.normal(0, 4, (200, 200, 3)).astype(np.int16)
        self.base_img = np.clip(self.base_img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        self.target_mask = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(self.target_mask, (100, 100), 18, 255, -1)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        self.expanded_mask = cv2.dilate(self.target_mask, kernel, iterations=1)

        # Background ring mask
        kernel_ring = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))
        dil_ring = cv2.dilate(self.expanded_mask, kernel_ring, iterations=1)
        self.bg_ring_mask = (dil_ring > 0) & (self.expanded_mask == 0)

        # Original object dominant color (e.g. bright red)
        self.obj_lab = (50.0, 60.0, 40.0)

    def test_natural_identical_fill_passes_critic(self):
        filled_img = self.base_img.copy()
        passed, metrics, reason, code = RemovalNaturalnessCritic.evaluate_removal_naturalness(
            self.base_img, filled_img, self.target_mask, self.expanded_mask, self.bg_ring_mask, self.obj_lab
        )
        self.assertTrue(passed, f"Expected pass for identical fill, got {reason}")
        self.assertIsNone(reason)

    def test_sharp_boundary_cut_fails_critic(self):
        # Create fill with sharp dark perimeter jump
        corrupted_fill = self.base_img.copy()
        corrupted_fill[self.target_mask > 0] = [20, 20, 20]

        passed, metrics, reason, code = RemovalNaturalnessCritic.evaluate_removal_naturalness(
            self.base_img, corrupted_fill, self.target_mask, self.expanded_mask, self.bg_ring_mask, self.obj_lab
        )
        self.assertFalse(passed)
        self.assertIn("Reject", str(code))

    def test_excessive_blur_fails_critic(self):
        # Heavy blur in filled region
        blurred_fill = self.base_img.copy()
        blurred_region = cv2.GaussianBlur(self.base_img, (25, 25), 10.0)
        blurred_fill[self.expanded_mask > 0] = blurred_region[self.expanded_mask > 0]

        passed, metrics, reason, code = RemovalNaturalnessCritic.evaluate_removal_naturalness(
            self.base_img, blurred_fill, self.target_mask, self.expanded_mask, self.bg_ring_mask, self.obj_lab
        )
        self.assertFalse(passed)


class TestOperationScheduler(unittest.TestCase):

    def test_operation_scheduler_balances_operations(self):
        scheduler = OperationScheduler()
        affordances = {"remove": 0.8, "add": 0.8, "reorder": 0.8, "recolor": 0.8}

        chosen_ops = []
        for _ in range(20):
            op = scheduler.select_operation_for_scene(affordances)
            scheduler.record_attempt(op, True)
            chosen_ops.append(op)

        # Ensure all 4 operations were selected
        unique_ops = set(chosen_ops)
        self.assertEqual(len(unique_ops), 4, f"Expected all 4 operations to be selected, got {unique_ops}")


class TestPerceptualVerificationEngine(unittest.TestCase):

    def setUp(self):
        # 1000x700 realistic canvas
        self.base = np.full((700, 1000, 3), 128, dtype=np.uint8)
        # Subtle texture
        noise = np.random.normal(0, 3, (700, 1000, 3)).astype(np.int16)
        self.base = np.clip(self.base.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        self.var = self.base.copy()
        # Goldilocks difference (delta-E around 18.0)
        cv2.circle(self.var, (500, 350), 22, (155, 115, 110), -1)
        self.target_bbox = (478, 328, 522, 372)

    def test_goldilocks_single_difference_passes_verification(self):
        passed, metrics, reason, code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            self.base, self.var, self.target_bbox, operation="recolor", difficulty="Medium"
        )
        self.assertTrue(passed, f"Expected pass, got {reason}")
        self.assertIsNone(code)

    def test_identical_image_fails_verification(self):
        passed, metrics, reason, code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            self.base, self.base, self.target_bbox, operation="recolor", difficulty="Medium"
        )
        self.assertFalse(passed)
        self.assertIn(code, ["TargetTooSmall", "TooSubtle"])


if __name__ == "__main__":
    unittest.main()
