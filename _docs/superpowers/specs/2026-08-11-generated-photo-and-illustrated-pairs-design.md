# Generated Photo and Illustrated Pair Set

## Scope

Add ten playable, one-difference image-pair levels to the existing manifest:

- Five photorealistic scenes: watch repair, florist table, campsite gear, baker's counter, and electronics bench.
- Three hand-drawn illustration scenes: greenhouse, underwater study, and celestial library.
- Two abstract scenes: mechanical maze and colorful token field.

## Asset design

Every level has `base.png` and `variant.png` under `public/levels/photo-pairs/<level-id>/`. The variant is created by editing its base with a single explicitly localized object or detail change. Both images must retain the same dimensions, framing, lighting, and scene content outside that change.

Each manifest record supplies an id, title, category, difficulty, public paths, and exactly one hotspot. Photos use `find_the_sniper`; illustrated and abstract levels use `abstract_animated` so both gameplay categories receive five level candidates.

## Generation and curation

Generate each base as a rich horizontal scene, with no readable text, watermarks, or people. Produce its variant from that exact base with an edit instruction that locks all unmodified pixels and changes only the named target. Inspect each output for compositional stability and a clear target at the game's display size. Regenerate a pair if the edit causes global drift.

## Validation

Run the existing manifest validator after integration. Then use the target recalculation script to derive the hotspot from the pixel-difference component and run the standard project test/build checks. No existing assets or manifest entries will be replaced.

## Failure handling

If image generation does not preserve the base image, discard that result and retry with a narrower edit instruction. If a single connected difference cannot be isolated, do not add the pair to the manifest.
