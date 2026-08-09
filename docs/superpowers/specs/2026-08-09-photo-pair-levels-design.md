# Pre-rendered Photo Pair Level Pool Design

## Objective

Replace the main gameplay content path with a large, expandable pool of pre-rendered photorealistic image pairs. Each puzzle will use a base image, a subtly changed variant image, and one hotspot definition. The existing procedural and runtime photo mutation paths will remain available as development fallbacks, but they should no longer be the primary player experience.

## Current Context

The game currently starts a five-pair stage by calling `generatePhotographicLevelPair` from `src/utils/photoMutationEngine.js`. That function selects a remote photo pack entry, draws it to a canvas, attempts a localized HSL mutation, and falls back to the procedural canvas generator if the image is not ready or canvas access fails. This makes the visual quality inconsistent and can produce differences that feel artificial, broad, or unreliable.

The canvas interaction model is already a good fit for pre-rendered pairs. `GameCanvas.jsx` renders left and right canvases and checks taps against percentage-based hotspot coordinates. The new system should preserve that interaction contract.

## Proposed Approach

Add a manifest-driven photo pair content path:

- Store assets under `public/levels/photo-pairs/<pack-slug>/<level-id>/base.webp`.
- Store variants beside them as `variant.webp`.
- Store level metadata in `public/levels/photo_pair_manifest.json`.
- Load and render pre-rendered pairs directly in gameplay.
- Keep the current generator available for debug tooling and emergency fallback.

Example manifest entry:

```json
{
  "id": "market_001",
  "title": "Cluttered Market Shelf",
  "pack": "Find the Sniper",
  "packId": "find_the_sniper",
  "difficulty": "Hard",
  "baseImage": "/levels/photo-pairs/find-the-sniper/market_001/base.webp",
  "variantImage": "/levels/photo-pairs/find-the-sniper/market_001/variant.webp",
  "diffs": [
    {
      "id": 1,
      "x": 63.2,
      "y": 48.7,
      "radius": 4.5,
      "hint": "Scan the crowded middle shelf."
    }
  ]
}
```

## Architecture

### Photo Pair Level Model

Create a small adapter that converts manifest entries into the existing level object shape:

- `id`, `title`, `category`, `difficulty`, and `totalDifferences`.
- `diffs` with one hotspot in percentage coordinates.
- `render(ctx, width, height, isModified)` that draws the correct preloaded image.

The adapter should not own game rules. It only normalizes content into the existing level contract.

### Manifest Loading

Add a runtime manifest loader that fetches `/levels/photo_pair_manifest.json` once, validates basic shape, and caches the parsed entries in memory. The loader should expose filtered selection by `packId` and `difficulty`.

If the manifest is missing, empty, or invalid, gameplay should fall back to the current generated level path. This keeps the app playable during development and on builds that do not yet include photo assets.

### Image Loading

Pre-rendered levels should preload both images before they are used in a stage. A stage should only include levels whose base and variant images loaded successfully. Failed entries should be skipped, and selection should continue until the stage has the requested number of pairs or no more candidates are available.

The renderer should draw each image with the same crop and scale behavior on both sides. Initial implementation will use the current fixed `800x600` canvas size and require source pairs to match a landscape 4:3 composition. If an image has a different aspect ratio, validation should warn before it ships.

### Stage Selection

When the player starts a game:

- Load the photo manifest if it has not been loaded.
- Filter by selected pack and difficulty.
- Shuffle candidates deterministically enough to avoid repeats within a stage.
- Build a five-pair stage from valid preloaded image pairs.
- Fall back to the existing generator if fewer than one image pair can be loaded.

If fewer than five valid photo pairs exist for a filter, the app may fill the rest with generated fallback levels. The UI does not need to expose this detail.

### Content Pipeline

Add a Node validation/import script:

- Validate `public/levels/photo_pair_manifest.json`.
- Confirm every `baseImage` and `variantImage` exists under `public`.
- Confirm each entry has exactly one diff.
- Confirm hotspot coordinates and radius are within valid percentage ranges.
- Warn if the number of entries per pack/difficulty is below the five-pair stage size.
- Optionally create draft manifest entries from folders that contain `base.webp` and `variant.webp`.

The script should be lightweight and avoid introducing heavy image-processing dependencies unless dimensions become a hard requirement. Filesystem existence and manifest shape checks are the first priority.

## Data Flow

1. Player chooses difficulty and pack from the menu.
2. `App.jsx` asks the photo pair loader for a stage.
3. Loader fetches and validates the manifest.
4. Loader preloads candidate image pairs.
5. Loader returns level objects using the existing `render` interface.
6. `GameCanvas.jsx` draws base on the left and variant on the right.
7. Existing tap detection checks against `diffs[0]`.
8. Existing scoring, hints, misses, and stage progression continue unchanged.

## Error Handling

- Missing manifest: use generated fallback levels.
- Invalid manifest entry: ignore that entry and log a warning in development.
- Failed image load: skip that entry and try another candidate.
- Empty filtered pack/difficulty: use generated fallback levels.
- Bad hotspot data: reject that entry during validation and skip it at runtime.

## Scope

In scope:

- Manifest file format.
- Photo pair level adapter.
- Runtime manifest loading and image preloading.
- Game start integration.
- Validator/importer script.
- A small starter sample pack so the path can be verified.

Out of scope:

- Building hundreds of finished image pairs in this change.
- In-browser AI image generation.
- Advanced image dimension inspection if it requires heavy dependencies.
- UI redesign of the main menu.
- Changing scoring, timer, miss, or hint behavior.

## Testing

Verification should include:

- Run the validator script against the sample manifest.
- Run the app build.
- Manually start a game from at least one pack and difficulty with photo-pair content.
- Confirm left/right images differ only by the authored variant.
- Confirm tapping the hotspot completes each pair.
- Confirm fallback still works if the photo manifest is unavailable or empty.

## Implementation Notes

The existing codebase has several generated-content experiments. The implementation should keep the new photo pair system small and explicit rather than extending the current HSL mutation logic. The key boundary is that production-quality visual differences live in authored assets, while the app only loads, displays, and validates them.
