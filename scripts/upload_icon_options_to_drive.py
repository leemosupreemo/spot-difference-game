#!/usr/bin/env python3
"""Upload all Diff Hunter icon options to Google Drive via Apps Script Webhook."""

import base64
import json
import os
import ssl
import sys
import time
import urllib.request

WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzZ0cecBSqaRzkvFZNF3eelYUNGS9039zfrBRZhi6B6DahPboYmriC_wlBNRtlODn0akQ/exec"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "_design", "icon_options")
OUTPUT_JSON = os.path.join(ROOT, "_design", "icon_options_drive_links.json")

ITEMS = [
    ("all_icon_candidates_grid.png", "DiffHunter_Icons_3x3_Comparison_Grid.png", "3x3 Master Comparison Grid"),
    ("A1_cyber_reticle.png", "DiffHunter_Icon_A1_Cyber_Reticle.png", "Option A1: Cyber Reticle (Hunter Target Lock)"),
    ("A2_split_reticle.png", "DiffHunter_Icon_A2_Split_Reticle.png", "Option A2: Split Reticle (Dual-Tone Comparison)"),
    ("A3_diamond_reticle.png", "DiffHunter_Icon_A3_Diamond_Reticle.png", "Option A3: Diamond Reticle (45° Precision)"),
    ("B1_delta_neon.png", "DiffHunter_Icon_B1_Neon_Delta.png", "Option B1: Neon Delta (Mathematical Difference)"),
    ("B2_dh_monogram.png", "DiffHunter_Icon_B2_DH_Monogram.png", "Option B2: DH Monogram (Cyber Brand Mark)"),
    ("B3_delta_crosshair.png", "DiffHunter_Icon_B3_Delta_Target_Fusion.png", "Option B3: Delta + Target Reticle Fusion"),
    ("C1_magnifier_lens.png", "DiffHunter_Icon_C1_Finder_Loupe.png", "Option C1: Finder Loupe (Magnifying Lens)"),
    ("C2_radar_scanner.png", "DiffHunter_Icon_C2_Radar_Scanner.png", "Option C2: Difference Radar Scanner"),
    ("C3_aperture_ring.png", "DiffHunter_Icon_C3_Focus_Aperture_Iris.png", "Option C3: Focus Aperture Iris (Camera Optics)"),
]

def upload_file(local_name, remote_name, title, ctx):
    path = os.path.join(ICON_DIR, local_name)
    if not os.path.exists(path):
        print(f"Skipping {local_name}: file not found")
        return None
        
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
        
    payload = {
        "filename": remote_name,
        "content": b64,
        "mimeType": "image/png"
    }
    
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("uploaded"):
                file_url = data.get("fileUrl", "")
                print(f"✅ {title}\n   -> {file_url}")
                return {
                    "key": local_name.replace(".png", ""),
                    "title": title,
                    "filename": remote_name,
                    "fileUrl": file_url,
                    "status": "success"
                }
            else:
                print(f"❌ Failed {local_name}: {data}")
                return None
    except Exception as e:
        print(f"❌ Error uploading {local_name}: {e}")
        return None

def main():
    ctx = ssl._create_unverified_context()
    results = []
    
    print("Uploading Diff Hunter icon options to Google Drive...\n")
    for local_name, remote_name, title in ITEMS:
        res = upload_file(local_name, remote_name, title, ctx)
        if res:
            results.append(res)
        time.sleep(1) # courteous delay
        
    with open(OUTPUT_JSON, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"\n🎉 Successfully uploaded {len(results)} files to Google Drive!")
    print(f"Saved links to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
