"""
PERCEPTUAL VERIFICATION ENGINE (DISPLAY RESOLUTION & TWO-SIDED DIRECT-LOOK BAND)
================================================================================
Separates SEARCH DIFFICULTY from VERIFICATION VISIBILITY:
1. DisplayResolutionScaler: Simulates actual in-game rendering (700x440 px).
2. Two-Sided Display Size & Area Gates:
   - Enforces both MINIMUM visibility floor and MAXIMUM "too obvious" ceiling.
3. Two-Sided Direct-Look Foveal Inspection Gate:
   - Takes a 3.0x crop around the known answer.
   - Measures direct-look perceptual ΔE and structural dissimilarity.
   - Enforces Goldilocks band (too subtle -> reject; too obvious -> reject).
4. Returns explicit structured rejection codes (TooSubtle, TooObvious, TargetTooLarge, etc.).
================================================================================
"""

import cv2
import numpy as np

LIMITS_BY_DIFFICULTY = {
    "Easy": {
        "display_short_side_min": 24,
        "display_short_side_max": 65,
        "display_changed_pixels_min": 180,
        "display_thickness_min": 6.0,
        "display_thickness_max": 35.0,
        "source_changed_area_min_pct": 0.25,
        "source_changed_area_max_pct": 1.40,
        "recolor_direct_mean_delta_e_min": 22.0,
        "recolor_direct_mean_delta_e_max": 42.0,
        "structural_direct_changed_fraction_min": 0.06,
        "structural_direct_changed_fraction_max": 0.28,
    },
    "Medium": {
        "display_short_side_min": 18,
        "display_short_side_max": 42,
        "display_changed_pixels_min": 120,
        "display_thickness_min": 5.0,
        "display_thickness_max": 28.0,
        "source_changed_area_min_pct": 0.15,
        "source_changed_area_max_pct": 0.80,
        "recolor_direct_mean_delta_e_min": 18.0,
        "recolor_direct_mean_delta_e_max": 32.0,
        "structural_direct_changed_fraction_min": 0.04,
        "structural_direct_changed_fraction_max": 0.18,
    },
    "Hard": {
        "display_short_side_min": 14,
        "display_short_side_max": 34,
        "display_changed_pixels_min": 90,
        "display_thickness_min": 4.5,
        "display_thickness_max": 22.0,
        "source_changed_area_min_pct": 0.10,
        "source_changed_area_max_pct": 0.55,
        "recolor_direct_mean_delta_e_min": 14.0,
        "recolor_direct_mean_delta_e_max": 25.0,
        "structural_direct_changed_fraction_min": 0.03,
        "structural_direct_changed_fraction_max": 0.14,
    }
}

class PerceptualVerificationEngine:
    GAME_DISPLAY_WIDTH = 700
    GAME_DISPLAY_HEIGHT = 440
    DIRECT_LOOK_CROP_SIZE = 256

    @classmethod
    def evaluate_display_resolution_and_direct_look(cls, base_bgr, variant_bgr, diff_bbox, operation="recolor", difficulty="Medium"):
        """
        Runs comprehensive post-edit display-resolution and two-sided direct-look verification.
        Returns: (passed: bool, metrics: dict, reason: str, rejection_code: str or None)
        """
        src_h, src_w = base_bgr.shape[:2]
        total_src_pixels = src_h * src_w
        bx1, by1, bx2, by2 = diff_bbox
        
        limits = LIMITS_BY_DIFFICULTY.get(difficulty, LIMITS_BY_DIFFICULTY["Medium"])

        # 1. DISPLAY RESOLUTION SIMULATION (700 x 440)
        disp_base = cv2.resize(base_bgr, (cls.GAME_DISPLAY_WIDTH, cls.GAME_DISPLAY_HEIGHT), interpolation=cv2.INTER_AREA)
        disp_var = cv2.resize(variant_bgr, (cls.GAME_DISPLAY_WIDTH, cls.GAME_DISPLAY_HEIGHT), interpolation=cv2.INTER_AREA)

        # Scale bbox to display coordinates
        scale_x = cls.GAME_DISPLAY_WIDTH / float(src_w)
        scale_y = cls.GAME_DISPLAY_HEIGHT / float(src_h)
        dbx1 = int(bx1 * scale_x)
        dby1 = int(by1 * scale_y)
        dbx2 = int(bx2 * scale_x)
        dby2 = int(by2 * scale_y)
        dbw = max(1, dbx2 - dbx1 + 1)
        dbh = max(1, dby2 - dby1 + 1)
        short_side = min(dbw, dbh)
        long_side = max(dbw, dbh)

        # 2. SOURCE & DISPLAY AREA GATES (Two-Sided)
        src_diff = np.max(np.abs(base_bgr.astype(np.int16) - variant_bgr.astype(np.int16)), axis=2)
        src_diff_mask = (src_diff > 14).astype(np.uint8)
        src_changed_pixels = int(np.sum(src_diff_mask))
        src_area_pct = (src_changed_pixels / float(total_src_pixels)) * 100.0

        if src_area_pct < limits["source_changed_area_min_pct"]:
            return False, {"source_area_pct": round(src_area_pct, 3)}, f"TooSubtle: Source changed area ({src_area_pct:.3f}%) below minimum ({limits['source_changed_area_min_pct']:.2f}%).", "TargetTooSmall"

        if src_area_pct > limits["source_changed_area_max_pct"]:
            return False, {"source_area_pct": round(src_area_pct, 3)}, f"TooObvious: Source changed area ({src_area_pct:.3f}%) exceeds maximum ({limits['source_changed_area_max_pct']:.2f}%).", "TargetTooLarge"

        # 3. ABSOLUTE DISPLAYED-SIZE GATES (Two-Sided)
        if short_side < limits["display_short_side_min"]:
            return False, {
                "display_short_side": short_side,
                "display_long_side": long_side
            }, f"TargetTooSmall: Short side ({short_side}px) below verification floor ({limits['display_short_side_min']}px).", "TargetTooSmall"

        if short_side > limits["display_short_side_max"]:
            return False, {
                "display_short_side": short_side,
                "display_long_side": long_side
            }, f"TargetTooLarge: Short side ({short_side}px) exceeds upper limit ({limits['display_short_side_max']}px).", "TargetTooLarge"

        # Thickness check on display diff mask
        disp_diff = np.max(np.abs(disp_base.astype(np.int16) - disp_var.astype(np.int16)), axis=2)
        disp_diff_mask = (disp_diff > 14).astype(np.uint8)
        disp_changed_pixels = int(np.sum(disp_diff_mask))

        if disp_changed_pixels < limits["display_changed_pixels_min"]:
            return False, {
                "display_changed_pixels": disp_changed_pixels
            }, f"TooSubtle: Display changed pixels ({disp_changed_pixels}px) below floor ({limits['display_changed_pixels_min']}px).", "TooSubtle"

        # Compute effective stroke thickness via distance transform on display diff mask
        dist_transform = cv2.distanceTransform(disp_diff_mask, cv2.DIST_L2, 3)
        max_thickness = float(np.max(dist_transform) * 2.0)
        if max_thickness < limits["display_thickness_min"]:
            return False, {
                "display_thickness": round(max_thickness, 1)
            }, f"TooSubtle: Feature thickness ({max_thickness:.1f}px) is razor-thin (minimum {limits['display_thickness_min']}px).", "TooSubtle"

        # 4. DIRECT-LOOK FOVEAL INSPECTION TEST (3.0x Crop)
        cx = (bx1 + bx2) // 2
        cy = (by1 + by2) // 2
        crop_radius = int(max(bx2 - bx1, by2 - by1) * 1.5)
        crop_radius = max(crop_radius, int(src_w * 0.04))

        cx1 = max(0, cx - crop_radius)
        cy1 = max(0, cy - crop_radius)
        cx2 = min(src_w, cx + crop_radius)
        cy2 = min(src_h, cy + crop_radius)

        crop_base = base_bgr[cy1:cy2, cx1:cx2]
        crop_var = variant_bgr[cy1:cy2, cx1:cx2]

        crop_base_norm = cv2.resize(crop_base, (cls.DIRECT_LOOK_CROP_SIZE, cls.DIRECT_LOOK_CROP_SIZE), interpolation=cv2.INTER_AREA)
        crop_var_norm = cv2.resize(crop_var, (cls.DIRECT_LOOK_CROP_SIZE, cls.DIRECT_LOOK_CROP_SIZE), interpolation=cv2.INTER_AREA)

        # Convert crops to CIELAB for direct perceptual delta evaluation
        crop_base_lab = cv2.cvtColor(crop_base_norm, cv2.COLOR_BGR2LAB).astype(np.float32)
        crop_var_lab = cv2.cvtColor(crop_var_norm, cv2.COLOR_BGR2LAB).astype(np.float32)

        # Pixel-wise Delta-E in the direct look crop
        delta_e_map = np.sqrt(
            (crop_base_lab[:, :, 0] - crop_var_lab[:, :, 0])**2 +
            (crop_base_lab[:, :, 1] - crop_var_lab[:, :, 1])**2 +
            (crop_base_lab[:, :, 2] - crop_var_lab[:, :, 2])**2
        )

        active_diff_pixels = delta_e_map > 12.0
        if np.sum(active_diff_pixels) == 0:
            return False, {"direct_look_mean_delta_e": 0.0}, "TooSubtle: No discernible difference under direct inspection.", "TooSubtle"

        direct_look_mean_delta_e = float(np.mean(delta_e_map[active_diff_pixels]))
        direct_look_peak_delta_e = float(np.percentile(delta_e_map[active_diff_pixels], 95))
        direct_look_changed_fraction = float(np.sum(active_diff_pixels)) / float(cls.DIRECT_LOOK_CROP_SIZE**2)

        # 5. TWO-SIDED VERIFICATION BAND (Goldilocks Range)
        if operation == "recolor":
            if direct_look_mean_delta_e < limits["recolor_direct_mean_delta_e_min"]:
                return False, {
                    "direct_mean_de": round(direct_look_mean_delta_e, 1),
                    "direct_peak_de": round(direct_look_peak_delta_e, 1)
                }, f"TooSubtle: Color shift too weak (Mean ΔE {direct_look_mean_delta_e:.1f} < {limits['recolor_direct_mean_delta_e_min']}).", "TooSubtle"
            
            if direct_look_mean_delta_e > limits["recolor_direct_mean_delta_e_max"]:
                return False, {
                    "direct_mean_de": round(direct_look_mean_delta_e, 1),
                    "direct_peak_de": round(direct_look_peak_delta_e, 1)
                }, f"TooObvious: Color shift too loud/anomalous (Mean ΔE {direct_look_mean_delta_e:.1f} > {limits['recolor_direct_mean_delta_e_max']}).", "ColorAnomalyTooHigh"

        elif operation in ("remove", "add", "reorder"):
            if direct_look_changed_fraction < limits["structural_direct_changed_fraction_min"]:
                return False, {
                    "direct_changed_frac": round(direct_look_changed_fraction, 3)
                }, f"TooSubtle: Structural change occupies too little of crop ({direct_look_changed_fraction*100:.1f}% < {limits['structural_direct_changed_fraction_min']*100:.1f}%).", "TooSubtle"

            if direct_look_changed_fraction > limits["structural_direct_changed_fraction_max"]:
                return False, {
                    "direct_changed_frac": round(direct_look_changed_fraction, 3)
                }, f"TooObvious: Structural change occupies too much of crop ({direct_look_changed_fraction*100:.1f}% > {limits['structural_direct_changed_fraction_max']*100:.1f}%).", "StructuralChangeTooSalient"

        metrics = {
            "display_bbox_size": (dbw, dbh),
            "display_short_side": short_side,
            "display_thickness": round(max_thickness, 1),
            "display_changed_pixels": disp_changed_pixels,
            "source_area_pct": round(src_area_pct, 3),
            "direct_look_mean_delta_e": round(direct_look_mean_delta_e, 1),
            "direct_look_peak_delta_e": round(direct_look_peak_delta_e, 1),
            "direct_look_changed_fraction_pct": round(direct_look_changed_fraction * 100, 2)
        }

        return True, metrics, f"Direct-Look Verified: Display size {dbw}x{dbh}px (short side {short_side}px, thickness {max_thickness:.1f}px), Direct ΔE={direct_look_mean_delta_e:.1f}", None
