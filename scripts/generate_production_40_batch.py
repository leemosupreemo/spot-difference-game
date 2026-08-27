"""
PRODUCTION 40-PAIR MULTI-OPERATION GENERATOR
================================================================================
Executes the Authoritative Unified Pipeline to produce 40 verified image pairs:
- Balanced 4-way mix: Recolor (~25%), Remove (~25%), Add (~25%), Reorder (~25%).
- Two-sided PerceptualVerificationEngine QA bounds (Search Difficulty vs Verification Visibility).
- Logs attempt metrics and acceptance distribution.
================================================================================
"""

import os
import json
import glob
from unified_operation_pipeline import generate_batch, DEFAULT_TARGET_MIX

def run_production_40_suite():
    # Build candidate scene pool from high-quality base canvases
    base_pool = [
        # AI Dense Set
        {"id": "prod_v4_dense_boardgame", "title": "[AI Multi-Op] Strategy Board Game Grid", "image_path": "public/levels/ai_dense_boardgame_base.jpg"},
        {"id": "prod_v4_dense_buttons", "title": "[AI Multi-Op] Vintage Tailor Button Assortment", "image_path": "public/levels/ai_dense_buttons_base.jpg"},
        {"id": "prod_v4_dense_candies", "title": "[AI Multi-Op] Artisan Confectionery Sweets Array", "image_path": "public/levels/ai_dense_candies_base.jpg"},
        {"id": "prod_v4_dense_enamel_pins", "title": "[AI Multi-Op] Collector Enamel Pin Showcase", "image_path": "public/levels/ai_dense_enamel_pins_base.jpg"},
        {"id": "prod_v4_dense_gemstones", "title": "[AI Multi-Op] Gemologist Faceted Gemstone Tray", "image_path": "public/levels/ai_dense_gemstones_base.jpg"},
        {"id": "prod_v4_dense_hardware", "title": "[AI Multi-Op] Machinist Hardware Sorting Tray", "image_path": "public/levels/ai_dense_hardware_base.jpg"},
        {"id": "prod_v4_dense_marbles", "title": "[AI Multi-Op] Collector Glass Marble Collection", "image_path": "public/levels/ai_dense_marbles_base.jpg"},
        {"id": "prod_v4_dense_spices", "title": "[AI Multi-Op] Whole Botanical Spice Assortment", "image_path": "public/levels/ai_dense_spices_base.jpg"},
        {"id": "prod_v4_dense_succulents", "title": "[AI Multi-Op] Greenhouse Potted Succulents Grid", "image_path": "public/levels/ai_dense_succulents_base.jpg"},
        {"id": "prod_v4_dense_watch_parts", "title": "[AI Multi-Op] Horologist Escapement Parts Tray", "image_path": "public/levels/ai_dense_watch_parts_base.jpg"},
        
        # AI Unique Set
        {"id": "prod_v4_unique_bakery", "title": "[AI Multi-Op] French Patisserie Display Counter", "image_path": "public/levels/ai_unique_bakery_base.jpg"},
        {"id": "prod_v4_unique_bushcraft", "title": "[AI Multi-Op] Wilderness Bushcraft Survival Gear", "image_path": "public/levels/ai_unique_bushcraft_base.jpg"},
        {"id": "prod_v4_unique_gardening", "title": "[AI Multi-Op] Botanist Potting & Plant Tag Bench", "image_path": "public/levels/ai_unique_gardening_base.jpg"},
        {"id": "prod_v4_unique_leather", "title": "[AI Multi-Op] Leathercraft Punch & Awl Workbench", "image_path": "public/levels/ai_unique_leather_base.jpg"},
        {"id": "prod_v4_unique_miniatures", "title": "[AI Multi-Op] Miniature Painter Acrylic Dropper Rack", "image_path": "public/levels/ai_unique_miniatures_base.jpg"},
        {"id": "prod_v4_unique_palette", "title": "[AI Multi-Op] Painter Studio Oil Tube Palette", "image_path": "public/levels/ai_unique_palette_base.jpg"},
        {"id": "prod_v4_unique_pencils", "title": "[AI Multi-Op] Artist Prismacolor Pencil Array", "image_path": "public/levels/ai_unique_pencils_base.jpg"},
        {"id": "prod_v4_unique_retrogaming", "title": "[AI Multi-Op] Vintage Retro Cartridge Flat Lay", "image_path": "public/levels/ai_unique_retrogaming_base.jpg"},
        {"id": "prod_v4_unique_seashells", "title": "[AI Multi-Op] Marine Biologist Seashell Matrix", "image_path": "public/levels/ai_unique_seashells_base.jpg"},
        {"id": "prod_v4_unique_sewing", "title": "[AI Multi-Op] Haberdashery Wooden Thread Spools", "image_path": "public/levels/ai_unique_sewing_base.jpg"},
        {"id": "prod_v4_unique_woodworking", "title": "[AI Multi-Op] Joinery Carpenter Tool Layout", "image_path": "public/levels/ai_unique_woodworking_base.jpg"},
        
        # Primary AI Set
        {"id": "prod_v4_ai_electronics", "title": "[AI Multi-Op] Circuit Lab Capacitor PCB", "image_path": "public/levels/ai_electronics_pcb_base.jpg"},
        {"id": "prod_v4_ai_mechanic", "title": "[AI Multi-Op] Precision Mechanic Hardware Bench", "image_path": "public/levels/ai_mechanic_workbench_base.jpg"},
        {"id": "prod_v4_ai_watchmaker", "title": "[AI Multi-Op] Master Watchmaker Precision Pad", "image_path": "public/levels/ai_watchmaker_parts_base.jpg"},
        {"id": "prod_v4_ai_sewing", "title": "[AI Multi-Op] Tailor Notions Box & Spools", "image_path": "public/levels/ai_sewing_notions_base.jpg"},
        {"id": "prod_v4_ai_artist", "title": "[AI Multi-Op] Fine Art Palette Knife Taboret", "image_path": "public/levels/ai_artist_palette_base.jpg"},
        {"id": "prod_v4_ai_baker", "title": "[AI Multi-Op] Confectioner Dessert Display", "image_path": "public/levels/ai_baker_pastry_base.jpg"},
        {"id": "prod_v4_ai_expedition", "title": "[AI Multi-Op] Expedition Camp Equipment Table", "image_path": "public/levels/ai_expedition_bushcraft_base.jpg"},
        {"id": "prod_v4_ai_gardener", "title": "[AI Multi-Op] Greenhouse Potting Seedling Table", "image_path": "public/levels/ai_gardener_potting_base.jpg"},
        {"id": "prod_v4_ai_leathercraft", "title": "[AI Multi-Op] Leather Artisan Waxed Spools", "image_path": "public/levels/ai_leathercraft_base.jpg"},
        {"id": "prod_v4_ai_miniature", "title": "[AI Multi-Op] Hobby Miniature Workstation", "image_path": "public/levels/ai_miniature_painter_base.jpg"},
        {"id": "prod_v4_ai_retrogaming", "title": "[AI Multi-Op] Retro Gaming Desk Cartridges", "image_path": "public/levels/ai_retro_gaming_base.jpg"},
        {"id": "prod_v4_ai_woodworking", "title": "[AI Multi-Op] Woodworking Bench Carpenter Pencils", "image_path": "public/levels/ai_woodworking_bench_base.jpg"},

        # Multi-Variant Expansions
        {"id": "prod_v4_var2_dense_boardgame", "title": "[AI Multi-Op] Strategy Board Game Grid B", "image_path": "public/levels/ai_dense_boardgame_base.jpg"},
        {"id": "prod_v4_var2_dense_buttons", "title": "[AI Multi-Op] Vintage Tailor Button Assortment B", "image_path": "public/levels/ai_dense_buttons_base.jpg"},
        {"id": "prod_v4_var2_dense_candies", "title": "[AI Multi-Op] Artisan Confectionery Sweets B", "image_path": "public/levels/ai_dense_candies_base.jpg"},
        {"id": "prod_v4_var2_dense_enamel_pins", "title": "[AI Multi-Op] Collector Enamel Pin Showcase B", "image_path": "public/levels/ai_dense_enamel_pins_base.jpg"},
        {"id": "prod_v4_var2_dense_gemstones", "title": "[AI Multi-Op] Gemologist Gemstone Tray B", "image_path": "public/levels/ai_dense_gemstones_base.jpg"},
        {"id": "prod_v4_var2_dense_hardware", "title": "[AI Multi-Op] Machinist Hardware Tray B", "image_path": "public/levels/ai_dense_hardware_base.jpg"},
        {"id": "prod_v4_var2_dense_marbles", "title": "[AI Multi-Op] Collector Glass Marble Collection B", "image_path": "public/levels/ai_dense_marbles_base.jpg"},
        {"id": "prod_v4_var2_dense_spices", "title": "[AI Multi-Op] Whole Botanical Spice Assortment B", "image_path": "public/levels/ai_dense_spices_base.jpg"},
        {"id": "prod_v4_var2_dense_succulents", "title": "[AI Multi-Op] Greenhouse Succulents Grid B", "image_path": "public/levels/ai_dense_succulents_base.jpg"},
        {"id": "prod_v4_var2_dense_watch_parts", "title": "[AI Multi-Op] Horologist Escapement Parts Tray B", "image_path": "public/levels/ai_dense_watch_parts_base.jpg"},
        {"id": "prod_v4_var2_unique_bakery", "title": "[AI Multi-Op] French Patisserie Display B", "image_path": "public/levels/ai_unique_bakery_base.jpg"},
        {"id": "prod_v4_var2_unique_bushcraft", "title": "[AI Multi-Op] Wilderness Bushcraft Gear B", "image_path": "public/levels/ai_unique_bushcraft_base.jpg"},
        {"id": "prod_v4_var2_unique_gardening", "title": "[AI Multi-Op] Botanist Potting Bench B", "image_path": "public/levels/ai_unique_gardening_base.jpg"},
        {"id": "prod_v4_var2_unique_leather", "title": "[AI Multi-Op] Leathercraft Workbench B", "image_path": "public/levels/ai_unique_leather_base.jpg"},
        {"id": "prod_v4_var2_unique_miniatures", "title": "[AI Multi-Op] Miniature Dropper Rack B", "image_path": "public/levels/ai_unique_miniatures_base.jpg"},
        {"id": "prod_v4_var2_unique_palette", "title": "[AI Multi-Op] Painter Oil Palette B", "image_path": "public/levels/ai_unique_palette_base.jpg"},
        {"id": "prod_v4_var2_unique_pencils", "title": "[AI Multi-Op] Artist Prismacolor Pencil Array B", "image_path": "public/levels/ai_unique_pencils_base.jpg"},
        {"id": "prod_v4_var2_unique_retrogaming", "title": "[AI Multi-Op] Retro Cartridge Flat Lay B", "image_path": "public/levels/ai_unique_retrogaming_base.jpg"},
        {"id": "prod_v4_var2_unique_seashells", "title": "[AI Multi-Op] Marine Seashell Matrix B", "image_path": "public/levels/ai_unique_seashells_base.jpg"},
        {"id": "prod_v4_var2_unique_sewing", "title": "[AI Multi-Op] Wooden Thread Spools B", "image_path": "public/levels/ai_unique_sewing_base.jpg"},
        {"id": "prod_v4_var2_unique_woodworking", "title": "[AI Multi-Op] Carpenter Tool Layout B", "image_path": "public/levels/ai_unique_woodworking_base.jpg"},
        {"id": "prod_v4_var2_ai_electronics", "title": "[AI Multi-Op] Circuit Lab Capacitor PCB B", "image_path": "public/levels/ai_electronics_pcb_base.jpg"},
        {"id": "prod_v4_var2_ai_mechanic", "title": "[AI Multi-Op] Precision Mechanic Bench B", "image_path": "public/levels/ai_mechanic_workbench_base.jpg"},
        {"id": "prod_v4_var2_ai_watchmaker", "title": "[AI Multi-Op] Watchmaker Precision Pad B", "image_path": "public/levels/ai_watchmaker_parts_base.jpg"},
        {"id": "prod_v4_var2_ai_sewing", "title": "[AI Multi-Op] Tailor Notions Box B", "image_path": "public/levels/ai_sewing_notions_base.jpg"},
        {"id": "prod_v4_var2_ai_artist", "title": "[AI Multi-Op] Palette Knife Taboret B", "image_path": "public/levels/ai_artist_palette_base.jpg"},
        {"id": "prod_v4_var2_ai_woodworking", "title": "[AI Multi-Op] Joinery Bench Carpenter Pencils B", "image_path": "public/levels/ai_woodworking_bench_base.jpg"}
    ]

    print(f"Loaded {len(base_pool)} candidate scenes for production 40 batch.")
    accepted, logs, counts = generate_batch(base_pool, target_mix=DEFAULT_TARGET_MIX)
    
    # Save audit log
    log_path = "scripts/production_40_batch_audit.json"
    with open(log_path, "w") as f:
        json.dump({
            "total_attempted": len(base_pool),
            "total_accepted": len(accepted),
            "operation_counts": counts,
            "logs": logs
        }, f, indent=2)
    print(f"\nSaved detailed generation audit log to {log_path}")

if __name__ == "__main__":
    run_production_40_suite()
