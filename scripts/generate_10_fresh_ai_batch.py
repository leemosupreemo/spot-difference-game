"""
GENERATE 10 FRESH AI-GENERATED BASE PAIRS (TEXTLESS & HIGH OBJECT COUNTS)
================================================================================
Runs the Authoritative Multi-Operation Pipeline across 10 brand new AI base canvases:
1. Confectionery Truffles & Macarons
2. Mediterranean Ceramic Mosaic Tiles
3. Botanical Pressed Flora & Seed Pods
4. Glass Marbles & Venetian Millefiori Beads
5. Potted Succulents & Rosettes Grid
6. Enamel Pins & Cloisonne Badges
7. Marine Seashells & Polished Sea Glass
8. Stained Glass Mosaic Jewels & Cabochons
9. Heirloom Whole Spices & Botanicals
10. Painted Wooden Toy Figurines & Dominoes
================================================================================
"""

from unified_operation_pipeline import generate_batch, DEFAULT_TARGET_MIX

def run_fresh_10_batch():
    scenes = [
        {
            "id": "fresh_v2_ai_confectionery_truffles_001",
            "title": "[AI Multi-Op] Gourmet Confectionery & Macaron Array",
            "image_path": "public/levels/fresh_ai_confectionery_truffles_base.jpg",
            "desc": "Single confectionery treat mutation in tray",
            "hint": "Inspect the compartmentalized rows of truffles, macarons, and jellies"
        },
        {
            "id": "fresh_v2_ai_ceramic_mosaic_tiles_002",
            "title": "[AI Multi-Op] Mediterranean Ceramic Mosaic Tiles",
            "image_path": "public/levels/fresh_ai_ceramic_mosaic_tiles_base.jpg",
            "desc": "Single mosaic ceramic shard difference",
            "hint": "Scan the geometric and floral glazed pottery tiles"
        },
        {
            "id": "fresh_v2_ai_botanical_pressed_flora_003",
            "title": "[AI Multi-Op] Botanical Pressed Flora & Herbarium Specimen",
            "image_path": "public/levels/fresh_ai_botanical_pressed_flora_base.jpg",
            "desc": "Single pressed flower or botanical element difference",
            "hint": "Examine the pressed wildflower petals, fern fronds, and seed pods"
        },
        {
            "id": "fresh_v2_ai_glass_marbles_millefiori_004",
            "preferred_op": "recolor",
            "title": "[AI Multi-Op] Antique Glass Marbles & Millefiori Beads",
            "image_path": "public/levels/fresh_ai_glass_marbles_millefiori_base.jpg",
            "desc": "Single glass marble or millefiori bead difference",
            "hint": "Look closely at the swirl glass orbs and floral mosaic beads"
        },
        {
            "id": "fresh_v2_ai_succulents_greenhouse_grid_005",
            "title": "[AI Multi-Op] Potted Greenhouse Succulents Grid",
            "image_path": "public/levels/fresh_ai_succulents_greenhouse_grid_base.jpg",
            "desc": "Single potted succulent rosette difference",
            "hint": "Scan the array of miniature potted rosettes and cacti"
        },
        {
            "id": "fresh_v2_ai_enamel_pins_collector_006",
            "title": "[AI Multi-Op] Collector Enamel Pin Showcase",
            "image_path": "public/levels/fresh_ai_enamel_pins_collector_base.jpg",
            "desc": "Single cloisonne enamel pin mutation",
            "hint": "Examine the geometric badges, moons, and floral enamel pins"
        },
        {
            "id": "fresh_v2_ai_marine_seashells_specimens_007",
            "title": "[AI Multi-Op] Marine Seashells & Sea Glass Array",
            "image_path": "public/levels/fresh_ai_marine_seashells_specimens_base.jpg",
            "preferred_op": "remove",
            "desc": "Single seashell or sea glass difference",
            "hint": "Inspect the nautilus, scallop shells, and polished sea glass"
        },
        {
            "id": "fresh_v2_ai_stained_glass_jewels_008",
            "preferred_op": "recolor",
            "title": "[AI Multi-Op] Stained Glass Mosaic Jewels",
            "image_path": "public/levels/fresh_ai_stained_glass_jewels_base.jpg",
            "desc": "Single stained glass jewel cabochon difference",
            "hint": "Examine the faceted glass gems and colored cabochons"
        },
        {
            "id": "fresh_v2_ai_heirloom_spices_botanical_009",
            "preferred_op": "recolor",
            "title": "[AI Multi-Op] Heirloom Whole Spices & Dried Botanicals",
            "image_path": "public/levels/fresh_ai_heirloom_spices_botanical_base.jpg",
            "desc": "Single aromatic whole spice dish difference",
            "hint": "Inspect the star anise pods, cardamom, and spice dishes"
        },
        {
            "id": "fresh_v2_ai_wooden_toy_figurines_010",
            "title": "[AI Multi-Op] Painted Wooden Toy Figurines & Meeples",
            "image_path": "public/levels/fresh_ai_wooden_toy_figurines_base.jpg",
            "desc": "Single wooden toy meeple or domino difference",
            "hint": "Examine the rows of wooden animal shapes, meeples, and domino blocks"
        }
    ]

    accepted, logs, counts = generate_batch(scenes, target_mix=DEFAULT_TARGET_MIX)
    print(f"\nBatch generation complete: {len(accepted)}/10 accepted with mix: {counts}")

if __name__ == "__main__":
    run_fresh_10_batch()
