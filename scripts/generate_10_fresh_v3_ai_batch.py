"""
GENERATE 10 FRESH V3 AI-GENERATED BASE PAIRS (TEXTLESS & HIGH OBJECT COUNTS)
================================================================================
Runs the Authoritative Multi-Operation Pipeline across 10 brand new AI base canvases:
1. Artisan Dried Pasta Shapes & Noodles (pasta_shapes_array)
2. Minerals, Geodes & Agate Slices (minerals_geodes_agate)
3. Vintage Brass & Iron Keys (vintage_brass_keys)
4. Silk Floss Skeins & Thread Spools (silk_floss_spools)
5. Japanese Ceramic Teacups & Ochoko (japanese_teacups_array)
6. Preserved Butterfly Specimens Grid (butterfly_specimens_grid)
7. Ancient Coins, Tokens & Wax Seals (ancient_coins_tokens)
8. Glass Swirl Paperweights & Cabochons (glass_paperweights_swirls)
9. Dried Wild Forest Mushrooms (wild_mushrooms_forest)
10. Vintage Brass Drafting Dividers & Compasses (drafting_dividers_brass)
================================================================================
"""

from unified_operation_pipeline import generate_batch, DEFAULT_TARGET_MIX

def run_fresh_v3_batch():
    scenes = [
        {
            "id": "fresh_v3_ai_pasta_shapes_001",
            "title": "[AI Multi-Op] Artisan Dried Pasta Shapes Array",
            "image_path": "public/levels/fresh_v3_ai_pasta_shapes_array_base.jpg",
            "desc": "Single pasta shape mutation in wooden compartment",
            "hint": "Inspect the compartments of farfalle, rigatoni, and pasta shapes"
        },
        {
            "id": "fresh_v3_ai_minerals_geodes_002",
            "title": "[AI Multi-Op] Exotic Mineral Crystals & Agate Slices",
            "image_path": "public/levels/fresh_v3_ai_minerals_geodes_agate_base.jpg",
            "desc": "Single mineral crystal or agate slice difference",
            "hint": "Scan the amethyst geodes, pyrite cubes, and agate slices"
        },
        {
            "id": "fresh_v3_ai_vintage_keys_003",
            "title": "[AI Multi-Op] Vintage Brass & Iron Skeleton Keys",
            "image_path": "public/levels/fresh_v3_ai_vintage_brass_keys_base.jpg",
            "desc": "Single antique key or escutcheon plate difference",
            "hint": "Examine the rows of ornate brass keys and lock plates"
        },
        {
            "id": "fresh_v3_ai_silk_spools_004",
            "title": "[AI Multi-Op] Vintage Silk Floss & Wooden Thread Spools",
            "image_path": "public/levels/fresh_v3_ai_silk_floss_spools_base.jpg",
            "desc": "Single silk floss skein or thread spool difference",
            "hint": "Look closely at the colored thread spools and silk skeins"
        },
        {
            "id": "fresh_v3_ai_japanese_teacups_005",
            "title": "[AI Multi-Op] Japanese Ceramic Teacups & Ochoko Grid",
            "image_path": "public/levels/fresh_v3_ai_japanese_teacups_array_base.jpg",
            "desc": "Single ceramic tea bowl difference",
            "hint": "Scan the array of blue-and-white porcelain, Bizen, and celadon cups"
        },
        {
            "id": "fresh_v3_ai_butterfly_specimens_006",
            "title": "[AI Multi-Op] Entomological Butterfly Specimens Showcase",
            "image_path": "public/levels/fresh_v3_ai_butterfly_specimens_grid_base.jpg",
            "desc": "Single pinned butterfly specimen difference",
            "hint": "Examine the rows of swallowtails, morphos, and moths"
        },
        {
            "id": "fresh_v3_ai_ancient_coins_007",
            "preferred_op": "remove",
            "title": "[AI Multi-Op] Ancient Roman Coins & Wax Seals",
            "image_path": "public/levels/fresh_v3_ai_ancient_coins_tokens_base.jpg",
            "desc": "Single bronze coin or stamped wax seal difference",
            "hint": "Inspect the Roman sestertii, Greek drachmas, and wax seals"
        },
        {
            "id": "fresh_v3_ai_glass_paperweights_008",
            "title": "[AI Multi-Op] Swirl Glass Paperweights & Cabochons",
            "image_path": "public/levels/fresh_v3_ai_glass_paperweights_swirls_base.jpg",
            "desc": "Single glass paperweight orb difference",
            "hint": "Examine the swirl glass orbs, millefiori eggs, and aventurine gems"
        },
        {
            "id": "fresh_v3_ai_wild_mushrooms_009",
            "title": "[AI Multi-Op] Dried Wild Forest Mushrooms & Botanicals",
            "image_path": "public/levels/fresh_v3_ai_wild_mushrooms_forest_base.jpg",
            "desc": "Single dried wild mushroom dish difference",
            "hint": "Inspect the morel caps, golden chanterelles, and mushroom dishes"
        },
        {
            "id": "fresh_v3_ai_drafting_dividers_010",
            "title": "[AI Multi-Op] Victorian Brass Drafting Dividers & Compasses",
            "image_path": "public/levels/fresh_v3_ai_drafting_dividers_brass_base.jpg",
            "desc": "Single brass drafting instrument difference",
            "hint": "Examine the brass bow compasses, proportional dividers, and ruling pens"
        }
    ]

    accepted, logs, counts = generate_batch(scenes, target_mix=DEFAULT_TARGET_MIX)
    print(f"\nFresh V3 Batch complete: {len(accepted)}/10 accepted with mix: {counts}")

if __name__ == "__main__":
    run_fresh_v3_batch()
