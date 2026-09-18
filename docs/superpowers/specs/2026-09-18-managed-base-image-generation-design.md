# Managed Base Image Generation Design

**Date:** 2026-09-18  
**Status:** Approved design  
**Scope:** Generate varied, photorealistic, object-dense base images and carry successful bases through structural pair creation.

## Problem

The repository currently contains prompt fragments, manually assembled scene lists, and two different base-image suitability evaluators, but it does not contain an end-to-end image-generation pipeline. Base images are generated outside the codebase, saved under `public/levels`, and then handed to batch scripts. The production scene router verifies basic sharpness, texture, object count, hero-object suppression, and operation affordances, but it does not enforce portfolio variety or reliably detect visually synthetic imagery.

The existing `scripts/ai_source_canvas_pipeline.py` also advertises more than 30 scene archetypes while defining only 10, and its `EditabilityScorer` is not part of the production path.

The new system must generate images automatically, prefer playful variety without sacrificing editability, prevent repeated themes, enforce photographic realism, and create consistently sized production pairs.

## Goals

- Generate photorealistic base-image candidates through the OpenAI Image API.
- Produce dense scenes with many small, structurally editable objects.
- Maintain an accepted portfolio split of 40% collections, 40% activity scenes, and 20% playful environments.
- Generate multiple candidates and select the strongest instead of accepting the first usable image.
- Treat photorealism and editability as hard gates.
- Track recent scene concepts so topical uniqueness is enforced in addition to file uniqueness.
- Integrate accepted bases with the structural-only add/remove/reorder pipeline.
- Ship every production pair at one canonical size and aspect ratio.
- Provide dry-run, spend limits, resumability, provenance, and human-readable reports.

## Non-Goals

- Replacing the existing structural mutation engines.
- Automatically publishing a pair that fails structural or display-resolution QA.
- Retrofitting every historical image to the new dimensions.
- Relaxing quality or diversity thresholds to reach a requested batch count.
- Generating abstract or illustrated game content through this pipeline.

## Current-State Findings

The current source-image workflow is fragmented:

1. An image is generated externally and placed in `public/levels`.
2. A batch-specific Python script identifies the image by path.
3. `SceneAffordanceRouter` runs FastSAM and universal suitability gates.
4. The unified operation pipeline creates a difference and registers it.

Useful existing safeguards include:

- Minimum FastSAM object count.
- Nine-cell sharpness-uniformity analysis.
- Global edge-density rejection.
- Foreground hero-object suppression.
- Small candidate extraction and peer grouping.
- Add, remove, reorder, and recolor affordance scores.

Missing safeguards include:

- A callable image-generation provider.
- A structured, sufficiently large scene catalog.
- Portfolio quotas and recent-theme cooldowns.
- A semantic photorealism and artifact critic.
- Candidate competition at the base-image stage.
- Generation provenance and cost controls.
- A canonical generation-master and production-pair size.

## Chosen Approach

Use a managed portfolio pipeline that generates several candidates per scene brief, applies local computer-vision gates, applies a semantic visual critic, checks portfolio novelty, ranks all passing candidates, and sends only the selected base into structural mutation.

This is preferred over prompt rotation alone because local sharpness and segmentation metrics cannot reliably identify malformed repeated objects, impossible shadows, fake text, or an overly synthetic visual style. It is preferred over an iterative image-edit loop because base-image regeneration is simpler, cheaper, and less likely to introduce edit artifacts before puzzle generation begins.

## Portfolio Model

Each completed batch uses this exact accepted mix:

- 40% satisfying collections and piles.
- 40% believable activity scenes and work surfaces.
- 20% playful or unusual but plausible environments.

For the default batch size of 10, this means four collection scenes, four activity scenes, and two playful scenes.

### Example content

Collections can include seashell specimens, vintage keys, fishing lures, fossils, beads, dice, seed pods, mosaic tiles, miniature foods, buttons, and polished stones.

Activity scenes can include a bicycle repair bench, florist station, decorated-cookie workspace, field-scientist table, printmaker studio, costume workshop, model-railway build, camping-gear repair, and pottery glazing table.

Playful environments can include a toy repair shop, magician's backstage props, miniature dinosaur excavation, carnival prize counter, treasure-hunt planning table, and whimsical but physically believable baking laboratory.

### Scene metadata

The catalog contains at least 60 briefs. Each brief is structured data rather than an opaque complete prompt:

```json
{
  "id": "forest_survey_table",
  "scene_family": "activity",
  "domain": "field_science",
  "setting": "forest survey table",
  "object_families": [
    "leaf samples",
    "sample jars",
    "magnifiers",
    "colored survey flags"
  ],
  "materials": ["glass", "paper", "wood", "botanical"],
  "layout": "three_quarter_work_surface",
  "palette": "moss_green_amber",
  "density_target": [35, 70],
  "desired_operations": ["add", "remove", "reorder"]
}
```

The scheduler rotates camera angle, composition, materials, palette, lighting temperature, setting, object scale, object shape, and ordered-versus-chaotic arrangement. No domain, material family, layout, or dominant palette may occupy more than 25% of an accepted batch. Recently accepted tag combinations receive a strong cooldown.

## Prompt Composition

Prompts are built deterministically from scene metadata plus a shared photographic contract. They require:

- A coherent, believable real-world activity or collection.
- Approximately 35–80 visible physical objects.
- Several related object families with natural variation.
- Repeated groups of three to eight objects that support structural edits.
- Small local gaps and recoverable surfaces near movable objects.
- Natural wear, minor imperfections, realistic contact shadows, and plausible object geometry.
- Deep depth of field and edge-to-edge useful focus.
- No dominant hero object or large empty region.
- No people, hands, faces, brands, logos, watermarks, or readable text.
- Documentary photographic realism rather than illustration, CGI, or styled product photography.
- Exact 4:3 landscape framing without a later crop.

The prompt composer records the rendered prompt and its source brief. Prompt changes are versioned in provenance so output shifts can be traced.

## Image Provider

The default provider uses the OpenAI Image API with:

- Model: `gpt-image-2.5-sunburst`.
- Quality: `high`.
- Size: `1536x1152`.
- Background: opaque.
- Output: PNG generation masters.
- Up to three candidates for a single brief.

The provider is isolated behind an interface so tests can use a fake provider and future model changes do not affect scheduling, evaluation, or finalization code.

The official OpenAI documentation identifies GPT Image 2.5 Sunburst as the most capable image-generation and editing model. The Image API supports multiple outputs, high-quality generation, opaque output, and custom dimensions whose edges are divisible by 16.

References:

- <https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst>
- <https://developers.openai.com/api/reference/cli/resources/images/methods/generate>

## Candidate Evaluation

Photorealism and editability are hard gates. A strong novelty or fun score cannot compensate for failing either.

### Local image gates

A candidate must:

- Decode successfully as an opaque image.
- Be exactly 1536x1152 in sRGB.
- Have a sharpness-uniformity score of at least 0.25.
- Have global edge density of at least 0.02.
- Contain at least 18 FastSAM-detected objects.
- Contain at least eight small editable targets.
- Have no foreground object larger than 22% of the image.
- Contain at least two repeated-object peer groups.
- Expose at least one structural-operation affordance above 0.45.

The production evaluator consolidates relevant behavior from `EditabilityScorer` and `SceneAffordanceRouter` so a single result object contains universal metrics, editable-target inventory, peer groups, and operation affordances.

### Semantic visual critic

A cost-balanced vision model analyzes each locally passing candidate and returns structured JSON containing:

- Photorealism score.
- Object-integrity score.
- Scene-coherence score.
- Visual-fun score.
- Composition score.
- Detected artifact flags.
- Descriptive diversity tags.
- A concise rejection reason when applicable.

Photorealism and object integrity must each score at least 8/10. The candidate is rejected for malformed objects, duplicated fragments, impossible geometry, physically inconsistent shadows, fake readable text, logos, watermarks, or an obviously illustrated/CGI rendering style.

The critic model is configurable. The default is `gpt-5.6-luna` through the Responses API with image detail set to `high`, reasoning effort set to `none`, and a strict structured-output schema. Current OpenAI model guidance identifies Luna as the cost-sensitive high-volume option, while current general models support image input. Model choice and image-detail settings are recorded per run.

Reference:

- <https://developers.openai.com/api/docs/models>

### Novelty check

The evaluator compares the candidate against recent accepted history using:

- Catalog tags and semantic critic tags.
- Scene-family, domain, material, layout, and palette overlap.
- A perceptual hash to catch near-duplicate imagery.
- The active batch quotas and 25% per-dimension caps.

The recent-history window defaults to 30 accepted scenes. Exact tag combinations in that window are unavailable unless an operator explicitly overrides the cooldown for a targeted batch.

### Ranking

Candidates that pass every hard gate receive a deterministic score:

- 35% structural editability.
- 25% portfolio novelty.
- 20% visual fun.
- 10% composition.
- 10% support for multiple structural operations.

The highest-scoring candidate for the currently needed portfolio slot wins. Scores and components are logged.

## Sizing Contract

### Generation master

- Exact dimensions: 1536x1152.
- Exact aspect ratio: 4:3 landscape.
- Opaque PNG in sRGB.
- No crop after generation.
- All segmentation, mask refinement, and structural mutation operate on this master.

Both edges are divisible by 16, making the size valid for supported custom GPT Image 2.5 generation. The resolution preserves small-object detail without using an unnecessarily large working canvas.

### Production pair

After structural generation succeeds, base and variant are finalized together as:

- Exact dimensions: 1200x900.
- JPEG quality 95.
- 4:4:4 chroma sampling.
- sRGB with metadata stripped.
- The identical resize transform for both images.

The manifest must contain:

```json
{
  "dimensions": {
    "width": 1200,
    "height": 900
  },
  "aspectRatio": "4:3"
}
```

The app renders photographic levels at a 4:3 ratio, uses an 800x600 logical canvas, and prioritizes photographic entries at least 1000 pixels wide. The 1200x900 production size therefore preserves useful display detail without shipping generation-master file sizes.

### Size validation

The finalizer verifies:

- Master dimensions and color mode.
- Matching base and variant dimensions.
- Exact 1200x900 production dimensions.
- No geometry-changing crop after hotspot calculation.
- Difference detectability at 1200x900 and simulated 800x600 display size.
- Survival of small edited objects after downsampling.
- Alignment of pixels outside the permitted difference region.
- Agreement between actual dimensions and manifest metadata.

Incorrectly shaped images are rejected rather than stretched or silently cropped.

## Batch Scheduling and Budget

The default command targets 10 completed pairs with a 4/4/2 portfolio split. It chooses several candidate briefs per bucket and generates adaptively until each quota is satisfied or the generation budget is exhausted.

Limits:

- Maximum three candidates for one brief.
- Maximum 40 generated images for a default 10-pair batch.
- Budget checked before every API request.
- A failed concept is replaced with a fresh brief rather than weakening its prompt or quality thresholds indefinitely.
- A run may finish with fewer than the requested count.

Dry-run mode selects briefs, renders prompts, estimates request count, and creates a report without requiring an API key or making paid calls. Execute mode requires explicit `--execute` and valid API configuration.

## End-to-End Data Flow

The operator commands are:

```bash
python3 scripts/generate_photo_batch.py --count 10 --dry-run
python3 scripts/generate_photo_batch.py --count 10 --execute
```

Execution performs:

1. Read catalog, policy, recent history, and current manifest.
2. Select underrepresented briefs for the required portfolio slots.
3. Compose and record prompts.
4. Generate 1536x1152 master candidates into a unique staging run.
5. Run local image and FastSAM gates.
6. Run the structured visual critic.
7. Run novelty and portfolio checks.
8. Rank passing candidates and stage the winning base.
9. Invoke the structural-only add/remove/reorder pipeline.
10. Validate the pair at master and display resolution.
11. Finalize the pair to 1200x900.
12. Atomically copy successful assets and register the manifest entry.
13. Append provenance and produce JSON and HTML reports.

No asset becomes production content until the complete base-and-variant pair passes.

## Components

- `scripts/base_scene_catalog.json`: at least 60 tagged scene briefs.
- `scripts/base_generation_policy.py`: quotas, thresholds, dimensions, model defaults, and budgets.
- `scripts/base_prompt_composer.py`: deterministic prompt construction.
- `scripts/base_image_provider.py`: OpenAI Image API adapter and fake-test interface.
- `scripts/base_candidate_evaluator.py`: local CV, FastSAM, semantic critic, and novelty checks.
- `scripts/base_generation_pipeline.py`: adaptive scheduling, candidate selection, and run ledger.
- `scripts/image_pair_finalizer.py`: paired resizing, encoding, and final-output validation.
- `scripts/generate_photo_batch.py`: operator-facing orchestration CLI.
- `scripts/base_generation_history.jsonl`: accepted-scene provenance and diversity history.
- `scripts/test_base_generation_pipeline.py`: focused unit and integration tests.
- `docs/base-image-generation.md`: operator guide.

The existing `scripts/ai_source_canvas_pipeline.py` is retired after its useful scoring behavior and prompt concepts are migrated. Batch-specific scene scripts remain historical until separately audited; the new CLI becomes the authoritative base-generation entry point.

## Run Artifacts and Provenance

Every execution creates a unique staging run containing:

- Run configuration and policy snapshot.
- Selected briefs and composed prompts.
- Provider model, quality, dimensions, and request identifiers.
- Candidate metrics, critic output, scores, and rejection reasons.
- Accepted generation masters.
- Structural attempt logs.
- Finalization metrics.
- A JSON report and browsable HTML contact sheet.

Rejected images are removed by default after the report is complete. `--keep-rejected` retains them for diagnosis. Rejection metadata remains in either case.

Accepted generation masters stay outside `public/levels`. Only finalized 1200x900 pairs are copied into production paths.

## Error Handling and Safety

- Validate configuration and writable paths before an API call.
- Require `OPENAI_API_KEY` only in execute mode.
- Retry transient API failures at most twice with bounded backoff.
- Do not retry safety or policy rejections with the same prompt.
- Check the image budget atomically before every generation request.
- Persist the run ledger after every state transition.
- Resume an interrupted run without regenerating completed candidates.
- Use unique staging paths and never overwrite production files.
- Write final images before changing the manifest.
- Update the manifest atomically only after both assets validate.
- Roll back newly copied assets if manifest registration fails.
- Never weaken quotas, photorealism, sizing, or editability thresholds automatically.

## Testing Strategy

Unit tests cover:

- Exact 4/4/2 scheduling for a 10-pair batch.
- Per-dimension 25% caps and recent-history cooldowns.
- Deterministic prompt composition.
- Provider request construction and response decoding using a fake provider.
- Candidate-budget enforcement before calls.
- Local image gates and threshold boundaries.
- Semantic-critic schema parsing and artifact rejection.
- Novelty scoring and perceptual duplicate rejection.
- Candidate ranking and deterministic tie-breaking.
- Exact master and production dimensions.
- Identical paired resizing and hotspot preservation.
- Resume behavior and idempotent run-ledger transitions.
- Atomic manifest registration and failure cleanup.

Integration tests cover:

- A complete dry run with no API key and no network access.
- A complete mocked execute run from catalog selection through staged pair output.
- Structural-pipeline handoff using synthetic or fixture candidates.
- A failed batch that reaches its budget without relaxing thresholds.

A separately invoked live smoke test generates one candidate for one brief and verifies the real API response and local evaluator. It is documented but excluded from `npm test` so routine tests cannot incur API cost.

Repository-wide verification continues to run the existing application, UI, pipeline, and structural-generation suites.

## Documentation Requirements

The operator guide must document:

- Installation and API-key setup.
- Dry-run and execute commands.
- Default models, dimensions, quotas, and budgets.
- Catalog authoring rules.
- Every hard gate and ranking component.
- Staging, resume, and cleanup behavior.
- Reports and provenance fields.
- Structural-pipeline handoff.
- Live smoke-test invocation and expected cost implications.
- Troubleshooting for missing dependencies, API failures, short batches, and repeated rejections.

The repository and toolkit READMEs must point to the new authoritative CLI and operator guide.

## Acceptance Criteria

The implementation is complete when:

- A dry run deterministically produces a valid 4/4/2 brief plan without network access.
- Execute mode can generate multiple candidates through an isolated provider adapter.
- Every accepted master passes local, semantic, and novelty gates.
- No accepted batch violates its portfolio quotas or 25% diversity caps.
- Accepted masters are exactly 1536x1152.
- Final pairs are exactly 1200x900 and declare `aspectRatio: "4:3"`.
- Only structurally successful, finalization-safe pairs reach `public/levels` and the manifest.
- Interrupted runs resume without duplicate API generation.
- Reports explain every acceptance and rejection.
- Automated tests cover scheduling, provider mocking, evaluation, sizing, budgets, resumability, and publication safety.
- The operator workflow is fully documented.
