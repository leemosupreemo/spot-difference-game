# Ocean Series - Spot-the-Difference Social Media Content Pack

This folder contains **20 curated ocean/underwater spot-the-difference scenes**, each with:
- **1 Base Image** (`*_base.jpg`) — 1200x900 canonical 4:3 high-res canvas.
- **Variant 1 (`*_var1_variant.jpg`)**: Single **Object Change** (Added, Removed, or Shifted object).
- **Variant 2 (`*_var2_variant.jpg`)**: Single **Color Change** (Recolored object with natural peer palette).

---

## Isolation Guarantee
These assets are exclusively for marketing and social media campaigns (TikTok, Instagram, YouTube Shorts, X):
* **NOT bundled into the native iOS app** (lives outside `public/` and `dist/`).
* **NOT deployed to web hosting** (excluded from Firebase Hosting targets).
* **Git-tracked** for persistent team asset preservation and version control.

---

## File Manifest & Answer Key
Complete answer coordinates, hints, operations, and bounding boxes are indexed in:
[`ocean_social_manifest.json`](./ocean_social_manifest.json)

### Example Entry:
```json
{
  "id": "ocean_01_coral_reef",
  "index": 1,
  "title": "Vibrant Shallow Coral Reef Lagoon",
  "baseImage": "marketing/social_media/ocean_series/ocean_01_coral_reef_base.jpg",
  "variants": {
    "variant1_object_change": {
      "image": "marketing/social_media/ocean_series/ocean_01_coral_reef_var1_variant.jpg",
      "operation": "add",
      "variantCode": "STR-ADD",
      "diff": { "x": 40.7, "y": 7.1, "radius": 5.4 }
    },
    "variant2_color_change": {
      "image": "marketing/social_media/ocean_series/ocean_01_coral_reef_var2_variant.jpg",
      "operation": "recolor",
      "variantCode": "STR-CLR",
      "diff": { "x": 97.1, "y": 5.6, "radius": 4.9 }
    }
  }
}
```
