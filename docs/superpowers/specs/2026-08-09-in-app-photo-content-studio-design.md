# In-App Photo Content Studio Design

## Objective

Add a debug-only content studio inside the app where generated photo-pair candidates can be reviewed, approved, rejected, and promoted into the playable photo-pair manifest without leaving the app.

The studio is for local development and content curation. It should not be available in production builds or normal player flows.

## Current Context

The game already supports static photo-pair levels through `public/levels/photo_pair_manifest.json`. Each approved level points to a `base` image, a `variant` image, and a single percentage-based hotspot. Runtime loading happens through `src/utils/photoPairLevelLoader.js`, which validates manifest shape, preloads images, and returns levels using the existing `render(ctx, width, height, isModified)` contract.

This is the right boundary for curation. The app should continue to play only approved manifest entries, while generated candidates live in a separate review queue until explicitly promoted.

## Recommended Approach

Create a debug-only React content studio backed by a small local Node API. The React app handles generation controls and review decisions. The local API owns filesystem writes: candidate metadata, candidate image assets, approved asset placement, and manifest updates.

This keeps the workflow "inside the app" from the curator's perspective while respecting the browser sandbox. A production browser or packaged iOS app cannot directly write into `public/levels`, so the write path must be local-dev-only.

## Architecture

### Content Studio UI

Add a debug-only studio accessible only when debug mode is enabled, such as from the existing debug modal or a new hidden debug button.

The studio has three tabs:

- `Generate`: choose pack, difficulty, count, title/category defaults, and generation style.
- `Review`: inspect pending candidates with side-by-side base/variant previews, hotspot overlay, approve and reject actions.
- `Approved`: inspect recently promoted levels and their playable manifest metadata.

The review card should show enough information to make a quality decision without starting gameplay:

- base and variant images side by side;
- title, pack, category, difficulty, and candidate id;
- hotspot location and radius overlay;
- hint text when available;
- approve and reject buttons.

### Local API

Add a small dev server that runs alongside Vite. It should be separate from production app code and disabled unless explicitly started in development.

Initial endpoints:

- `GET /api/content/candidates`: return pending, approved, and rejected candidates.
- `POST /api/content/generate`: create a candidate batch from request parameters.
- `POST /api/content/candidates/:id/approve`: promote one candidate into the playable manifest.
- `POST /api/content/candidates/:id/reject`: mark one candidate rejected.
- `POST /api/content/candidates/:id/hotspot`: update hotspot coordinates and radius before approval.

The API should validate inputs and write files atomically enough that a failed promotion does not leave `photo_pair_manifest.json` malformed.

### Candidate Storage

Generated candidates live outside the playable content pool:

```text
public/levels/photo-pair-candidates/<batch-id>/<candidate-id>/base.png
public/levels/photo-pair-candidates/<batch-id>/<candidate-id>/variant.png
```

Candidate metadata lives in:

```text
public/levels/photo_pair_candidates.json
```

Candidate entries include status:

```json
{
  "id": "candidate_20260809_001",
  "status": "pending",
  "batchId": "batch_20260809_001",
  "title": "Kitchen Counter Cup",
  "pack": "Find the Sniper",
  "packId": "find_the_sniper",
  "category": "Kitchen Clutter",
  "difficulty": "Easy",
  "baseImage": "/levels/photo-pair-candidates/batch_20260809_001/candidate_20260809_001/base.png",
  "variantImage": "/levels/photo-pair-candidates/batch_20260809_001/candidate_20260809_001/variant.png",
  "diffs": [
    {
      "id": 1,
      "x": 58.2,
      "y": 54.4,
      "radius": 9.5,
      "hint": "Compare the small cup near the center-right counter."
    }
  ]
}
```

### Promotion Flow

When a candidate is approved:

1. Validate the candidate with the existing photo-pair manifest rules.
2. Create a stable approved level id if one is not already assigned.
3. Copy images into `public/levels/photo-pairs/<pack-slug>/<level-id>/`.
4. Rewrite image paths to approved asset paths.
5. Append the entry to `public/levels/photo_pair_manifest.json`.
6. Mark the candidate status as `approved` with the approved level id.
7. Run the photo-pair validator.

If validation fails at any step, keep the candidate pending and return a clear error to the studio UI.

### Generation

The first implementation can support generated candidate ingestion through sample local generator logic, then later plug in a stronger AI image generation pipeline. The studio and API should not care whether candidates came from an AI service, a local script, or a manually imported folder. They only require candidate image files and manifest-shaped metadata.

Because real AI generation may need network credentials and model-specific code, generation should be isolated behind a server-side function:

```js
generateCandidateBatch(options) -> Candidate[]
```

The UI should call this through `/api/content/generate` and display the resulting candidates when the batch finishes.

## Data Flow

1. Curator enables debug mode and opens the content studio.
2. Studio fetches candidate metadata from the local API.
3. Curator generates a batch or reviews existing pending candidates.
4. Studio displays image pairs and hotspot overlays.
5. Curator adjusts hotspot if needed.
6. Curator approves or rejects each candidate.
7. API promotes approved candidates into the playable manifest.
8. Gameplay continues loading only `photo_pair_manifest.json`, so rejected and pending candidates never appear for players.

## Error Handling

- Local API unavailable: studio shows a dev-only connection error and disables write actions.
- Generation fails: studio keeps existing candidates and shows the server error.
- Candidate image missing: candidate remains pending and approval is blocked.
- Invalid hotspot: API rejects the update or approval with field-level details.
- Duplicate approved id: API generates a unique id or blocks approval before writing.
- Manifest write failure: API preserves the previous manifest file and reports the failure.
- Validator failure after promotion: API rolls back the manifest append and leaves the candidate pending.

## Production Safety

The content studio and API calls are development tools only. They should be hidden unless debug mode is enabled, and the write API should only run from a local development command. Production builds should not expose candidate generation, approval, or filesystem mutation controls.

Runtime gameplay should remain unchanged: it consumes approved photo pairs from `photo_pair_manifest.json` and falls back to generated levels only when the approved manifest path cannot provide enough content.

## Scope

In scope:

- Debug-only content studio UI.
- Local Node content API.
- Candidate metadata file.
- Candidate asset storage convention.
- Approve, reject, hotspot update, and candidate listing flows.
- Promotion into `photo_pair_manifest.json`.
- Validation after promotion.

Out of scope for the first pass:

- Production/admin authentication.
- Shipping the studio in iOS builds.
- Full cloud storage or multi-user review.
- Advanced image editing inside the browser.
- Dependence on a specific AI image provider.

## Testing

Verification should include:

- Unit tests for server-side manifest mutation and candidate state transitions.
- Validator coverage for approved candidate entries.
- A build check for the React app.
- Manual local run of the content studio with the API available.
- Manual approval of a sample candidate and confirmation that it appears in gameplay.
- Manual rejection of a sample candidate and confirmation that it never appears in gameplay.

## Implementation Notes

Keep the approved gameplay loader small and stable. The studio is a content tool, not part of core gameplay. Shared validation should live in reusable utilities so the API and runtime agree on manifest shape without duplicating rules.

The most important boundary is candidate content versus approved content. Pending and rejected candidates can be messy; approved manifest entries must stay strict, validated, and playable.
