#!/usr/bin/env python3
"""
Normalizes and verifies 20 ocean/underwater base images into staging/ocean_underwater_bases/.
Produces:
  - High-res canonical production images (1200x900)
  - Master images (1536x1152)
  - ocean_bases_manifest.json with full CV gate metrics (objects, targets, edge density, etc.)
"""

import json
import os
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from base_image_normalizer import normalize_local_image
from base_candidate_evaluator import run_local_gates

OCEAN_BASES = [
    {
        "id": "ocean_01_coral_reef",
        "title": "Vibrant Shallow Coral Reef Lagoon",
        "desc": "Dense coral reef floor with clownfish, sea anemones, blue tangs, sea stars, brain coral, and sea urchins.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_coral_reef_1790731558400.jpg"
    },
    {
        "id": "ocean_02_pirate_treasure",
        "title": "Sunken Galleon Pirate Treasure",
        "desc": "Gold Spanish doubloons, silver pieces of eight, emeralds, pearl necklaces, antique compass, and encrusted bottles.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_pirate_treasure_1790731631630.jpg"
    },
    {
        "id": "ocean_03_rocky_tidepool",
        "title": "Pacific Rocky Tidepool Life",
        "desc": "Purple ochre sea stars, green anemones, hermit crabs, acorn barnacles, limpets, and sea glass pebbles in tidal water.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_rocky_tidepool_1790731667306.jpg"
    },
    {
        "id": "ocean_04_deep_bioluminescence",
        "title": "Abyssal Deep-Sea Bioluminescence",
        "desc": "Translucent glowing hydromedusae, neon nudibranchs, lanternfish, phosphorescent sea pens, and electric brittle stars.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_deep_biolum_1790731689629.jpg"
    },
    {
        "id": "ocean_05_shells_and_seaglass",
        "title": "Exotic Seashells & Polished Sea Glass Knolling",
        "desc": "Dense knolling arrangement of auger shells, nautilus sections, cockles, sand dollars, sea glass, and sea urchin tests.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_shells_glass_1790731709458.jpg"
    },
    {
        "id": "ocean_06_shipwreck_artifacts",
        "title": "Sunken Shipwreck Navigational Antiquities",
        "desc": "18th-century brass dividers, pocket sextant, copper rivets, bronze trade coins, and blue-pattern porcelain shards on sea sand.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_ship_artifacts_1790731728739.jpg"
    },
    {
        "id": "ocean_07_seagrass_meadow",
        "title": "Dwarf Seahorse Seagrass Meadow",
        "desc": "Yellow and green dwarf seahorses clinging to turtle grass blades, with pipefish, boxfish, and painted scallop shells.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_seagrass_meadow_1790731743669.jpg"
    },
    {
        "id": "ocean_08_abalone_and_pearls",
        "title": "Iridescent Abalone Shells & Baroque Pearls",
        "desc": "Paua abalone shells, loose baroque pearls, operculum eye shells, purple sea fans, and miniature porcelain crabs.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_abalone_pearl_1790731759112.jpg"
    },
    {
        "id": "ocean_09_marine_biology_tray",
        "title": "Marine Biologist Specimen Sorting Tray",
        "desc": "Organized tray with preserved sea stars, sea urchin tests, diverse marine bivalves, brass calipers, and magnifying loupe.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_marine_lab_1790731776804.jpg"
    },
    {
        "id": "ocean_10_kelp_forest_floor",
        "title": "Kelp Forest Canopy & Benthic Invertebrates",
        "desc": "Cluster of red and purple sea urchins, orange bat stars, turban snail shells, decorator crabs, and coralline algae.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_kelp_floor_1790731793713.jpg"
    },
    {
        "id": "ocean_11_octopus_garden_hoard",
        "title": "Octopus Den Treasure Hoard",
        "desc": "Curious collection of shiny bivalves, sea agates, crab carapaces, sea urchin tests, sea glass marbles, and ceramic shards.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_octopus_hoard_1790731811753.jpg"
    },
    {
        "id": "ocean_12_sunken_roman_relics",
        "title": "Sunken Greco-Roman Mediterranean Antiquities",
        "desc": "Terracotta amphora handles, weathered bronze coins, clay oil lamps, glass perfume unguentaria, and red sea anemones.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_roman_relics_1790731830492.jpg"
    },
    {
        "id": "ocean_13_nudibranch_coral_garden",
        "title": "Neon Nudibranch & Sea Slug Community",
        "desc": "Diverse colorful sea slugs with electric blue, orange, polka dot, and striped mantles crawling on sponge and reef.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/59c1ef51-4f7e-4996-826c-1b54e91f6286/ocean_nudibranchs_1790731849772.jpg"
    },
    {
        "id": "ocean_14_ocean_tidepool_shelf",
        "title": "Intertidal Basalt Rock Shelf Marine Array",
        "desc": "Dark volcanic rock shelf with purple sea urchins, orange sea stars, cobalt sea glass, limpets, and periwinkles.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/95842667-a3e8-4d7a-8576-368c505eb73c/ocean_tidepool_shelf_1790018429393.jpg"
    },
    {
        "id": "ocean_15_marine_shell_mandala",
        "title": "Marine Biologist Shell & Nautilus Mandala",
        "desc": "Concentric arrangement of nautilus sections, tiger cowries, spiral augers, sea glass, and starfish on fine sand.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/marine_seashells_specimens_1787812955763.jpg"
    },
    {
        "id": "ocean_16_beachcomber_driftwood",
        "title": "Beachcomber Flotsam, Sea Glass & Sand Dollars",
        "desc": "Parallel knolling rows of sea glass shards, smooth stones, spiral shells, mini starfish, sand dollars, and wave-smoothed driftwood.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/beachcomber_tidepool_finds_1787937479047.jpg"
    },
    {
        "id": "ocean_17_marine_sample_tray",
        "title": "Marine Lab Coral & Invertebrate Sample Tray",
        "desc": "Stainless steel laboratory dissection tray with brain coral specimens, sea fans, sea glass, shells, calipers, and field notes.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/95842667-a3e8-4d7a-8576-368c505eb73c/coral_reef_test_1789947706161.jpg"
    },
    {
        "id": "ocean_18_marine_paleontology_fossils",
        "title": "Prehistoric Marine Paleontology Fossils",
        "desc": "Curated tray of prehistoric marine life: Megalodon shark teeth, spiral ammonite fossils, trilobites, and brass measuring calipers.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/4411d433-2784-4960-8221-e23059e577a0/fossil_paleontology_tray_1789921535432.jpg"
    },
    {
        "id": "ocean_19_nautical_navigation_tools",
        "title": "Maritime Celestial Navigation Instruments",
        "desc": "Solid brass Troughton sextant, celestial star globe dial, nautical compass rose, brass dividers, telescope, and bubble levels.",
        "src": "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/sextant_base_1787249555740.jpg"
    },
    {
        "id": "ocean_20_sunken_ancient_coins",
        "title": "Sunken Mediterranean Ancient Coins & Seals",
        "desc": "Slate sea floor scatter of ancient Greek & Roman marine silver tetradrachms with Pegasus and sea owls, and imperial bronze coins.",
        "src": "staging/fresh_v9_bases/fresh_v9_ancient_coins_020_base.jpg"
    }
]

def main():
    out_dir = Path("staging/ocean_underwater_bases")
    out_dir.mkdir(parents=True, exist_ok=True)
    masters_dir = out_dir / "masters_1536x1152"
    masters_dir.mkdir(parents=True, exist_ok=True)

    print(f"🌊 Processing {len(OCEAN_BASES)} Ocean / Underwater Base Canvases...")
    manifest_records = []

    for i, item in enumerate(OCEAN_BASES, 1):
        scene_id = item["id"]
        title = item["title"]
        desc = item["desc"]
        src_path = Path(item["src"])

        if not src_path.is_absolute():
            src_path = Path.cwd() / src_path

        if not src_path.exists():
            print(f"❌ [{i:02d}/20] File not found: {src_path}")
            continue

        master_path = masters_dir / f"{scene_id}_master.png"
        prod_jpg_path = out_dir / f"{scene_id}_base.jpg"

        # 1. Normalize to canonical 1536x1152 master
        cand = normalize_local_image(src_path.read_bytes(), scene_id, str(master_path), DEFAULT_BASE_GENERATION_POLICY)

        # 2. Evaluate with local technical gates
        passed, failures, route = run_local_gates(str(master_path), DEFAULT_BASE_GENERATION_POLICY)
        status_sym = "✅" if passed else "⚠️"

        # 3. Create production size (1200x900) JPEG at high quality
        with Image.open(master_path) as im:
            prod_im = im.resize(DEFAULT_BASE_GENERATION_POLICY.production_size, Image.Resampling.LANCZOS)
            prod_im.save(prod_jpg_path, format="JPEG", quality=95, subsampling=0)

        record = {
            "index": i,
            "id": scene_id,
            "title": title,
            "description": desc,
            "production_image": str(prod_jpg_path.resolve().relative_to(Path.cwd().resolve())),
            "master_image": str(master_path.resolve().relative_to(Path.cwd().resolve())),
            "production_size": list(DEFAULT_BASE_GENERATION_POLICY.production_size),
            "master_size": list(DEFAULT_BASE_GENERATION_POLICY.master_size),
            "gate_passed": passed,
            "gate_failures": list(failures),
            "metrics": {
                "detected_objects": route.get("object_count", 0),
                "editable_candidates": route.get("candidate_count", 0),
                "peer_groups": route.get("peer_group_count", 0),
                "affordances": route.get("affordances", {})
            }
        }
        manifest_records.append(record)
        print(f"{status_sym} [{i:02d}/20] {scene_id} - {title} (Objects: {route.get('object_count')}, Candidates: {route.get('candidate_count')})")

    # Write manifest
    manifest_path = out_dir / "ocean_bases_manifest.json"
    manifest_path.write_text(json.dumps(manifest_records, indent=2), encoding="utf-8")
    print(f"\n🎉 Saved manifest with {len(manifest_records)} base canvases to {manifest_path}")

if __name__ == "__main__":
    main()
