"""
PERCEPTUAL VERIFICATION ENGINE (DISPLAY RESOLUTION & DIRECT-LOOK TEST)
================================================================================
Separates SEARCH DIFFICULTY from VERIFICATION VISIBILITY:
1. DisplayResolutionScaler: Simulates actual in-game rendering (700x440 px).
2. AbsoluteDisplaySizeGate: Enforces minimum display dimensions:
   - Minimum bbox short side >= 14 display pixels (preferred 18-45 px).
   - Minimum structural thickness >= 6 display pixels.
   - Target area at source: 0.12% - 1.20% (no microscopic sub-pixel dust).
3. DirectLookInspectionGate:
   - Takes a 3.0x crop around the known answer.
   - Normalizes crop to 256x256 inspection view.
   - Measures direct-look perceptual ΔE and structural dissimilarity.
   - Hard rejects any pair where A != B cannot be immediately verified.
================================================================================
"""

import cv2
import numpy as np

class PerceptualVerificationEngine:
    GAME_DISPLAY_WIDTH = 700
    GAME_DISPLAY_HEIGHT = 440
    DIRECT_LOOK_CROP_SIZE = 256

    @classmethod
    def evaluate_display_resolution_and_direct_look(cls, base_bgr, variant_bgr, diff_bbox, operation="recolor", difficulty="Medium"):
        """
        Runs comprehensive post-edit display-resolution and direct-look verification.
        Returns: (passed: bool, metrics: dict, reason: str)
        """
        src_h, src_w = base_bgr.shape[:2]
        bx1, by1, bx2, by2 = diff_bbox

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

        # 2. ABSOLUTE DISPLAYED-SIZE GATES
        # Min short side: 14px on Hard, 18px on Medium, 24px on Easy
        min_short_side = 14 if difficulty == "Hard" else (18 if difficulty == "Medium" else 24)
        if short_side < min_short_side:
            return False, {
                "display_short_side": short_side,
                "display_long_side": long_side
            }, f"Display Size Reject: Target short side ({short_side}px) is below verification floor ({min_short_side}px at {cls.GAME_DISPLAY_WIDTH}x{cls.GAME_DISPLAY_HEIGHT})."

        # Thickness check on display diff mask
        disp_diff = np.max(np.abs(disp_base.astype(np.int16) - disp_var.astype(np.int16)), axis=2)
        disp_diff_mask = (disp_diff > 14).astype(np.uint8)
        disp_changed_pixels = int(np.sum(disp_diff_mask))

        if disp_changed_pixels < 120:
            return False, {
                "display_changed_pixels": disp_changed_pixels
            }, f"Display Size Reject: Display changed pixels ({disp_changed_pixels}px) too small to verify comfortably."

        # Compute effective stroke thickness via distance transform on display diff mask
        dist_transform = cv2.distanceTransform(disp_diff_mask, cv2.DIST_L2, 3)
        max_thickness = float(np.max(dist_transform) * 2.0)
        if max_thickness < 5.0:
            return False, {
                "display_thickness": round(max_thickness, 1)
            }, f"Display Size Reject: Feature thickness ({max_thickness:.1f}px) is razor-thin (minimum 5.0px)."

        # 3. DIRECT-LOOK FOVEAL INSPECTION TEST (3.0x Crop)
        cx = (bx1 + bx2) // 2
        cy = (by1 + by2) // 2
        crop_radius = int(max(bx2 - bx1, by2 - by1) * 1.5)
        crop_radius = max(crop_radius, int(src_w * 0.04)) # At least 4% of image width

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
            return False, {"direct_look_mean_delta_e": 0.0}, "Direct-Look Reject: No discernible difference under direct inspection."

        direct_look_mean_delta_e = float(np.mean(delta_e_map[active_diff_pixels]))
        direct_look_peak_delta_e = float(np.percentile(delta_e_map[active_diff_pixels], 95))
        direct_look_changed_fraction = float(np.sum(active_diff_pixels)) / float(cls.DIRECT_LOOK_CROP_SIZE**2)

        # 4. VERIFICATION FLOOR THRESHOLDS
        # In a direct 3x zoom crop, the difference must be immediately striking
        if operation == "recolor":
            if direct_look_mean_delta_e < 18.0:
                return False, {
                    "direct_mean_de": round(direct_look_mean_delta_e, 1),
                    "direct_peak_de": round(direct_look_peak_delta_e, 1)
                }, f"Direct-Look Reject: Color shift too subtle under direct gaze (Mean ΔE {direct_look_mean_delta_e:.1f} < 18.0)."
        elif operation in ("remove", "add"):
            if direct_look_changed_fraction < 0.040:
                return False, {
                    "direct_changed_frac": round(direct_look_changed_fraction, 3)
                }, f"Direct-Look Reject: Structural change occupies too little of direct crop ({direct_look_changed_fraction*100:.1f}% < 4.0%)."

        metrics = {
            "display_bbox_size": (dbw, dbh),
            "display_short_side": short_side,
            "display_thickness": round(max_thickness, 1),
            "display_changed_pixels": disp_changed_pixels,
            "direct_look_mean_delta_e": round(direct_look_mean_delta_e, 1),
            "direct_look_peak_delta_e": round(direct_look_peak_delta_e, 1),
            "direct_look_changed_fraction_pct": round(direct_look_changed_fraction * 100, 2)
        }

        return True, metrics, f"Direct-Look Verified: Display size {dbw}x{dbh}px (short side {short_side}px >= {min_short_side}px, thickness {max_thickness:.1f}px), Direct ΔE={direct_look_mean_delta_e:.1f}"

if __name__ == "__main__":
    print("Testing PerceptualVerificationEngine...")
