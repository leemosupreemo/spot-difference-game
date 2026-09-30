# Managed Base Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a documented, resumable CLI that generates varied photorealistic base candidates through Google and OpenAI, rejects unsuitable images, creates structural variants, and publishes consistent 1200x900 pairs safely.

**Architecture:** A provider-neutral orchestration layer selects structured scene briefs, generates and normalizes candidates, evaluates them through local and semantic gates, and records every state transition in a run ledger. Only the best passing base enters the existing structural-only pipeline; a separate finalizer and atomic publisher control production assets and manifest changes.

**Tech Stack:** Python 3.14, `unittest`, OpenCV, NumPy, Pillow, Ultralytics FastSAM, OpenAI Python SDK, Google Gen AI SDK, Google Auth, Typer, Rich, keyring, JSON/JSONL, HTML.

**Spec:** `docs/superpowers/specs/2026-09-18-managed-base-image-generation-design.md`

## Global Constraints

- Preserve all unrelated working-tree changes; the checkout is already dirty.
- The existing uncommitted structural work in `scripts/unified_operation_pipeline.py` is authoritative and must not be overwritten or reformatted wholesale.
- Default accepted mix for 10 pairs is exactly 4 collections, 4 activities, and 2 playful scenes.
- No domain, material family, layout, or dominant palette may exceed 25% of an accepted batch.
- Generate no more than four candidates per brief or 40 candidates per default batch.
- Canonical master size is exactly 1536x1152 opaque sRGB PNG.
- Canonical production size is exactly 1200x900 JPEG quality 95 with 4:4:4 chroma sampling.
- Provider normalization may center-crop at most 0.5%; no crop is permitted after hotspot calculation.
- Photorealism and object integrity must each score at least 8/10.
- Normal automated tests must make zero paid API calls.
- No secret may appear in repository files, run configs, provenance, logs, process arguments, exception text, or test fixtures.
- Only complete structurally valid pairs may reach `public/levels` or `photo_pair_manifest.json`.
- Live provider smoke tests remain explicit opt-in commands outside `npm test`.
- Use standard-library file operations and `os.replace` for atomic local writes; never rewrite production manifests in place.

## File Map

- Create `requirements-generation.txt`: isolated Python dependencies for generation tooling.
- Modify `.gitignore`: ignore `.base-generation/` staging and local run artifacts.
- Create `scripts/base_generation_types.py`: shared immutable data contracts.
- Create `scripts/base_generation_policy.py`: dimensions, thresholds, quotas, models, and budget validation.
- Create `scripts/base_scene_catalog.json`: at least 60 structured briefs.
- Create `scripts/base_scene_catalog.py`: catalog validation, history-aware scheduling, and quota checks.
- Create `scripts/base_prompt_composer.py`: deterministic photographic prompt assembly.
- Create `scripts/base_auth.py`: environment, keychain, ADC, and workload credential resolution.
- Create `scripts/base_image_provider.py`: Google/OpenAI/fake generation adapters and image normalization.
- Create `scripts/base_visual_critic.py`: Google/OpenAI/fake semantic critic adapters.
- Create `scripts/base_candidate_evaluator.py`: local gates, critic gates, novelty, and final ranking.
- Create `scripts/base_run_store.py`: resumable run ledger and atomic JSON/JSONL writes.
- Create `scripts/base_generation_report.py`: JSON and HTML contact-sheet reports.
- Create `scripts/base_generation_pipeline.py`: adaptive generation orchestration.
- Create `scripts/image_pair_finalizer.py`: paired resize, zero-drift validation, and encoding.
- Create `scripts/base_pair_publisher.py`: structural handoff and atomic publication.
- Create `scripts/generate_photo_batch.py`: Typer commands and interactive Rich wizard.
- Create `scripts/test_base_generation_policy.py`: policy, catalog, scheduling, and prompting tests.
- Create `scripts/test_base_providers.py`: authentication, provider, normalization, and critic tests.
- Create `scripts/test_base_generation_pipeline.py`: evaluator, ledger, orchestration, finalizer, and publisher tests.
- Modify `package.json`: add the three offline base-generation suites to `npm test`.
- Delete `scripts/ai_source_canvas_pipeline.py`: retire it after its useful concepts have migrated.
- Create `docs/base-image-generation.md`: complete operator documentation.
- Modify `spot_difference_generation_tools/README.md`: link the authoritative base-generation CLI and guide.

---

### Task 1: Shared Contracts, Policy, Dependencies, and Staging Boundary

**Files:**
- Create: `requirements-generation.txt`
- Modify: `.gitignore`
- Create: `scripts/base_generation_types.py`
- Create: `scripts/base_generation_policy.py`
- Create: `scripts/test_base_generation_policy.py`

**Interfaces:**
- Produces: `SceneBrief`, `RunConfig`, `ProviderRequest`, `ProviderImage`, `NormalizedCandidate`, `VisualCriticResult`, `CandidateEvaluation`, `FinalizedPair` dataclasses.
- Produces: `BaseGenerationPolicy`, `DEFAULT_BASE_GENERATION_POLICY`, and `validate_run_config(config, policy)`.

- [ ] **Step 1: Write failing policy and type tests**

Add tests asserting exact defaults, secret-free serialization, 4/4/2 quotas, the 40-image ceiling, invalid provider rejection, and proportional quotas for non-10 counts:

```python
class TestBaseGenerationPolicy(unittest.TestCase):
    def test_default_policy_has_canonical_sizes_and_budget(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        self.assertEqual(policy.master_size, (1536, 1152))
        self.assertEqual(policy.production_size, (1200, 900))
        self.assertEqual(policy.max_candidates_per_brief, 4)
        self.assertEqual(policy.max_images_per_default_batch, 40)
        self.assertEqual(policy.portfolio_counts(10), {
            "collection": 4,
            "activity": 4,
            "playful": 2,
        })

    def test_run_config_serialization_never_contains_credentials(self):
        config = RunConfig(count=10, provider_mode="mixed", critic_mode="auto")
        serialized = config.to_public_dict()
        self.assertNotIn("api_key", json.dumps(serialized).lower())
        self.assertNotIn("credential", json.dumps(serialized).lower())
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `python3 scripts/test_base_generation_policy.py`

Expected: import failure for `base_generation_policy` or `base_generation_types`.

- [ ] **Step 3: Implement immutable shared contracts and validated defaults**

Use frozen dataclasses and JSON-safe public serializers. Define provider modes `mixed`, `google`, and `openai`; critic modes `auto`, `google`, and `openai`; the exact thresholds from the spec; and largest-remainder portfolio allocation with fixed 4/4/2 output for count 10.

```python
@dataclass(frozen=True)
class RunConfig:
    count: int = 10
    provider_mode: str = "mixed"
    critic_mode: str = "auto"
    seed: int = 0
    max_images: int = 40
    keep_rejected: bool = False
    allow_provider_fallback: bool = False

    def to_public_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class BaseGenerationPolicy:
    master_size: tuple[int, int] = (1536, 1152)
    production_size: tuple[int, int] = (1200, 900)
    max_normalization_crop_fraction: float = 0.005
    max_candidates_per_brief: int = 4
    max_images_per_default_batch: int = 40
    min_detected_objects: int = 18
    min_editable_targets: int = 8
    min_peer_groups: int = 2
    min_structural_affordance: float = 0.45
    min_photorealism: float = 8.0
    min_object_integrity: float = 8.0
```

Add `.base-generation/` to `.gitignore`. Make `requirements-generation.txt` self-contained with these lower bounds: `openai>=2.0.0`, `google-genai>=1.0.0`, `google-auth>=2.0.0`, `typer>=0.12.0`, `rich>=13.0.0`, `keyring>=25.0.0`, `Pillow>=11.0.0`, `numpy>=2.0.0`, `opencv-python>=4.10.0`, and `ultralytics>=8.3.0`. Keep provider imports lazy so offline commands report actionable missing-dependency errors.

- [ ] **Step 4: Run policy tests and compile checks**

Run: `python3 scripts/test_base_generation_policy.py && python3 -m py_compile scripts/base_generation_types.py scripts/base_generation_policy.py`

Expected: all tests pass and compilation exits 0.

- [ ] **Step 5: Commit the isolated foundation**

```bash
git add .gitignore requirements-generation.txt scripts/base_generation_types.py scripts/base_generation_policy.py scripts/test_base_generation_policy.py
git commit -m "feat: define base generation contracts and policy"
```

### Task 2: Scene Catalog, Diversity Scheduler, and Prompt Composer

**Files:**
- Create: `scripts/base_scene_catalog.json`
- Create: `scripts/base_scene_catalog.py`
- Create: `scripts/base_prompt_composer.py`
- Modify: `scripts/test_base_generation_policy.py`

**Interfaces:**
- Consumes: `SceneBrief`, `RunConfig`, and `BaseGenerationPolicy` from Task 1.
- Produces: `load_scene_catalog(path) -> list[SceneBrief]`.
- Produces: `validate_scene_catalog(briefs) -> list[str]`.
- Produces: `build_batch_plan(briefs, history, config, policy) -> list[SceneBrief]`.
- Produces: `compose_prompt(brief, policy) -> str`.

- [ ] **Step 1: Add failing catalog and scheduling tests**

Test at least 60 unique IDs, all required tags, every family represented, no duplicate object-family tuple, deterministic seeded scheduling, exact 4/4/2 output, 25% dimension caps, recent-history cooldown, and prompt contract clauses.

```python
def test_catalog_has_sixty_valid_varied_briefs(self):
    briefs = load_scene_catalog(CATALOG_PATH)
    self.assertGreaterEqual(len(briefs), 60)
    self.assertEqual(len({brief.id for brief in briefs}), len(briefs))
    self.assertEqual({brief.scene_family for brief in briefs}, {
        "collection", "activity", "playful"
    })
    self.assertEqual(validate_scene_catalog(briefs), [])

def test_batch_plan_is_balanced_and_history_aware(self):
    plan = build_batch_plan(briefs, recent_history, RunConfig(seed=7), policy)
    self.assertEqual(Counter(item.scene_family for item in plan), {
        "collection": 4, "activity": 4, "playful": 2
    })
    self.assertTrue(all(item.id not in recent_ids for item in plan))
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_generation_policy.py`

Expected: imports or catalog assertions fail.

- [ ] **Step 3: Author the structured 60-brief catalog**

Create 24 collection, 24 activity, and 12 playful briefs. Use these exact concept IDs so coverage is reviewable:

```text
collection: tidepool_finds, vintage_keys, fishing_lures, fossil_fragments,
gemstone_beads, polyhedral_dice, seed_pods, mosaic_tiles, miniature_foods,
shirt_buttons, polished_stones, postage_stamps, fountain_pen_nibs,
sea_glass, chess_pieces, wooden_dominoes, cocktail_umbrellas, bottle_caps,
origami_papers, toy_badges, ceramic_tokens, ribbon_spools, puzzle_pieces,
camping_carabiners

activity: bicycle_repair, florist_station, cookie_decorating,
forest_survey, printmaker_studio, costume_workshop, model_railway_build,
camp_gear_repair, pottery_glazing, bookbinding_bench, kite_workshop,
marine_lab, pastry_station, telescope_maintenance, bonsai_station,
leathercraft_bench, jewelry_repair, mapmaking_table, puppet_workshop,
camera_repair, greenhouse_seedling, electronics_bench, sewing_table,
watchmaker_bench

playful: toy_hospital, magician_backstage, dinosaur_excavation,
carnival_prizes, treasure_map_table, whimsical_baking_lab,
miniature_spaceport, fairy_garden_workshop, robot_parts_market,
pirate_prop_room, monster_mask_studio, tiny_circus_setup
```

Every entry must provide domain, setting, at least four object families, at least three material tags, layout, palette, density range within 35–80, desired structural operations, camera angle, composition, and lighting temperature.

- [ ] **Step 4: Implement validation, deterministic scheduling, and prompt composition**

Reject missing fields, invalid density ranges, unknown operations, duplicate IDs, and insufficient family counts. Build the prompt from structured clauses in stable order; include realism, deep focus, repeated families, natural gaps, no text/logos/people, and exact 4:3 framing.

```python
def compose_prompt(brief, policy):
    return " ".join([
        f"Documentary photorealistic {brief.camera_angle} photograph of {brief.setting}.",
        f"Show {brief.density_target[0]} to {brief.density_target[1]} visible physical objects.",
        f"Include coherent families: {', '.join(brief.object_families)}.",
        "Include repeated groups of three to eight loose objects, natural local gaps, and recoverable surfaces.",
        "Deep edge-to-edge focus, realistic wear, plausible geometry, soft contact shadows, no hero object.",
        "No people, hands, faces, readable text, logos, brands, watermarks, illustration, or CGI styling.",
        "Exact 4:3 landscape composition.",
    ])
```

- [ ] **Step 5: Run tests and commit**

Run: `python3 scripts/test_base_generation_policy.py`

Expected: all policy, catalog, scheduler, and prompt tests pass.

```bash
git add scripts/base_scene_catalog.json scripts/base_scene_catalog.py scripts/base_prompt_composer.py scripts/test_base_generation_policy.py
git commit -m "feat: add diverse base scene catalog and scheduler"
```

### Task 3: Secure Credential Resolution

**Files:**
- Create: `scripts/base_auth.py`
- Create: `scripts/test_base_providers.py`

**Interfaces:**
- Produces: `ResolvedCredential(provider, kind, value, metadata)` with redacted `repr`.
- Produces: `CredentialResolver.resolve_google() -> ResolvedCredential | None`.
- Produces: `CredentialResolver.resolve_openai() -> ResolvedCredential | None`.
- Produces: `store_provider_key(provider, secret)` and `remove_provider_key(provider)`.
- Produces: `run_google_adc_login(runner=subprocess.run) -> int`.

- [ ] **Step 1: Write failing credential precedence and redaction tests**

```python
def test_openai_env_precedes_keychain_and_secret_is_redacted(self):
    resolver = CredentialResolver(
        environ={"OPENAI_API_KEY": "openai-test-value"},
        keyring_backend=FakeKeyring("stored-secret"),
    )
    credential = resolver.resolve_openai()
    self.assertEqual(credential.kind, "environment")
    self.assertEqual(credential.value, "openai-test-value")
    self.assertNotIn("openai-test-value", repr(credential))

def test_google_falls_back_to_adc_without_serializing_token(self):
    resolver = CredentialResolver(environ={}, keyring_backend=FakeKeyring(None), adc_loader=fake_adc)
    credential = resolver.resolve_google()
    self.assertEqual(credential.kind, "adc")
    self.assertNotIn("token", json.dumps(credential.public_status()).lower())
```

Also test hidden key storage, removal, missing `gcloud`, subprocess argument lists without `shell=True`, and provider-only resolution that never probes the unselected provider.

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_providers.py`

Expected: import failure for `base_auth`.

- [ ] **Step 3: Implement credential adapters with dependency injection**

Resolution order is environment, tool-owned keychain, then ADC/workload identity. For OpenAI, read `OPENAI_API_KEY`; for Google, prefer `GOOGLE_API_KEY` and accept `GEMINI_API_KEY` as its documented alias, rejecting conflicting simultaneous values. Use keyring service name `spot-difference-base-generation`; use account names `google` and `openai`. `public_status()` exposes only provider, credential kind, and availability. Do not copy ADC access tokens into `ResolvedCredential.value`; retain the refreshable credentials object and pass it directly to the SDK adapter.

```python
@dataclass
class ResolvedCredential:
    provider: str
    kind: str
    value: object = field(repr=False)
    metadata: dict = field(default_factory=dict, repr=False)

    def public_status(self):
        return {"provider": self.provider, "kind": self.kind, "available": True}
```

Invoke Google login as `subprocess.run(["gcloud", "auth", "application-default", "login"], check=False)` and never revoke global ADC from the tool.

- [ ] **Step 4: Run tests and a secret-pattern scan**

Run: `python3 scripts/test_base_providers.py && ! rg -n 'sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}' scripts/base_auth.py scripts/test_base_providers.py`

Expected: tests pass; secret scan finds nothing.

- [ ] **Step 5: Commit**

```bash
git add scripts/base_auth.py scripts/test_base_providers.py
git commit -m "feat: add secure provider authentication resolution"
```

### Task 4: Provider Adapters and Canonical Image Normalization

**Files:**
- Create: `scripts/base_image_provider.py`
- Modify: `scripts/test_base_providers.py`

**Interfaces:**
- Consumes: `ProviderRequest`, `ProviderImage`, `NormalizedCandidate`, `ResolvedCredential`, and policy.
- Produces: `ImageProvider.generate(request) -> list[ProviderImage]` protocol.
- Produces: `GoogleImageProvider`, `OpenAIImageProvider`, and `FakeImageProvider`.
- Produces: `normalize_provider_image(image, output_path, policy) -> NormalizedCandidate`.

- [ ] **Step 1: Write failing provider and normalization tests**

Mock SDK clients; never import or call live clients in tests. Assert request model/size/quality, base64 decoding, provider metadata, exact OpenAI pass-through, accepted Google 2400x1792 crop, rejected 16:9 crop, opaque RGB conversion, and canonical PNG output.

```python
def test_google_2k_output_normalizes_to_exact_master(self):
    source = make_png_bytes((2400, 1792), color=(80, 120, 160))
    provider_image = ProviderImage("google", "gemini-3.1-flash-image", source, 2400, 1792, "req-g")
    result = normalize_provider_image(provider_image, output_path, policy)
    self.assertEqual(Image.open(result.path).size, (1536, 1152))
    self.assertLessEqual(result.crop_fraction, 0.005)

def test_wide_provider_output_is_rejected_before_evaluation(self):
    image = ProviderImage("google", "model", make_png_bytes((1920, 1080)), 1920, 1080, "req")
    with self.assertRaisesRegex(ValueError, "NormalizationCropExceeded"):
        normalize_provider_image(image, output_path, policy)
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_providers.py`

Expected: provider imports fail.

- [ ] **Step 3: Implement lazy SDK adapters and normalization**

OpenAI uses `client.images.generate(model="gpt-image-2.5-sunburst", size="1536x1152", quality="high", background="opaque", output_format="png", n=request.count)`. Google uses `client.interactions.create(model="gemini-3.1-flash-image", input=request.prompt, response_format={"type": "image", "mime_type": "image/png", "aspect_ratio": "4:3", "image_size": "2K"})` once per requested candidate.

Normalize immediately: decode, apply the smallest centered crop to exact 4:3 only when the crop fraction is at most 0.005, resize with Pillow LANCZOS, convert to sRGB RGB, save opaque PNG, and return the transform metadata.

- [ ] **Step 4: Run provider tests and compilation**

Run: `python3 scripts/test_base_providers.py && python3 -m py_compile scripts/base_image_provider.py`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/base_image_provider.py scripts/test_base_providers.py
git commit -m "feat: add dual image providers and normalization"
```

### Task 5: Semantic Critics and Candidate Evaluation

**Files:**
- Create: `scripts/base_visual_critic.py`
- Create: `scripts/base_candidate_evaluator.py`
- Modify: `scripts/test_base_providers.py`
- Create: `scripts/test_base_generation_pipeline.py`

**Interfaces:**
- Produces: `VisualCritic.evaluate(image_path, brief) -> VisualCriticResult` protocol.
- Produces: `GoogleVisualCritic`, `OpenAIVisualCritic`, and `FakeVisualCritic`.
- Produces: `resolve_critic_mode(run_config) -> str`.
- Produces: `BaseCandidateEvaluator.evaluate(candidate, brief, history) -> CandidateEvaluation`.
- Produces: `rank_candidates(candidates) -> CandidateEvaluation | None`.

- [ ] **Step 1: Write failing critic routing and hard-gate tests**

Cover auto critic selection for all provider modes, one critic for a mixed run, strict schema parsing, malformed response rejection, local gate thresholds, critic score thresholds, artifact flags, perceptual duplicate rejection, ranking weights, and deterministic tie-breaking.

```python
def test_auto_critic_does_not_require_other_provider(self):
    self.assertEqual(resolve_critic_mode(RunConfig(provider_mode="google")), "google")
    self.assertEqual(resolve_critic_mode(RunConfig(provider_mode="openai")), "openai")

def test_photorealism_is_a_hard_gate(self):
    critic = FakeVisualCritic(photorealism=7.9, object_integrity=10.0)
    result = evaluator_with(critic).evaluate(candidate, brief, history=[])
    self.assertFalse(result.passed)
    self.assertEqual(result.rejection_code, "PhotorealismReject")
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_providers.py && python3 scripts/test_base_generation_pipeline.py`

Expected: critic/evaluator imports fail.

- [ ] **Step 3: Implement strict critic adapters**

Use one versioned schema with numeric scores, artifact flags, tags, and rejection reason. The OpenAI adapter uses `gpt-5.6-luna`, high image detail, no reasoning, and structured output. The Google adapter uses `gemini-3.1-flash-lite`, image input, thinking disabled, and structured output against the same JSON schema. Keep both defaults in `BaseGenerationPolicy` so operators can override them explicitly and provenance records the resolved model. Reject responses that omit keys, contain out-of-range scores, or include non-string tags.

```python
CRITIC_SCHEMA_VERSION = "1"
REQUIRED_CRITIC_KEYS = {
    "photorealism", "object_integrity", "scene_coherence",
    "visual_fun", "composition", "artifact_flags", "tags", "reason",
}
```

- [ ] **Step 4: Implement local gates, novelty, and ranking**

Inject `SceneAffordanceRouter.evaluate_and_route_canvas` so tests use fixtures. Enforce exact dimensions, object count 18, editable targets 8, peer groups 2, hero object 22%, sharpness uniformity 0.25, edge density 0.02, and structural affordance 0.45 before the critic call. Calculate pHash distance and tag overlap against the most recent 30 accepted bases.

Use exact passing weights: 35% editability, 25% novelty, 20% fun, 10% composition, and 10% multi-operation support.

- [ ] **Step 5: Run tests and commit**

Run: `python3 scripts/test_base_providers.py && python3 scripts/test_base_generation_pipeline.py`

Expected: all critic and evaluator tests pass.

```bash
git add scripts/base_visual_critic.py scripts/base_candidate_evaluator.py scripts/test_base_providers.py scripts/test_base_generation_pipeline.py
git commit -m "feat: evaluate realism editability and novelty"
```

### Task 6: Resumable Run Ledger, Adaptive Pipeline, and Reports

**Files:**
- Create: `scripts/base_run_store.py`
- Create: `scripts/base_generation_report.py`
- Create: `scripts/base_generation_pipeline.py`
- Modify: `scripts/test_base_generation_pipeline.py`

**Interfaces:**
- Produces: `RunStore.create(config, plan)`, `RunStore.transition(item_id, state, data)`, and `RunStore.resume(run_id)`.
- Produces: `AcceptedHistoryStore.recent(limit=30)` and `AcceptedHistoryStore.append(record)` backed by `.base-generation/history/accepted.jsonl`.
- Produces: `BaseGenerationPipeline.run(config) -> BatchRunResult`.
- Produces: `write_json_report(run) -> Path` and `write_html_report(run) -> Path`.

- [ ] **Step 1: Write failing ledger, budget, resume, and report tests**

Test atomic writes, allowed state transitions, accepted-history append/read order, malformed trailing-history recovery, resume without duplicate provider calls, exact budget enforcement before a request, mixed-provider initial allocation, adaptive follow-up allocation, fresh-brief substitution, partial completion without relaxed gates, rejected-image cleanup, escaped HTML, and retry classification. Transient rate-limit/server/timeout failures retry at most twice; authentication, safety, malformed-response, and quality failures do not retry.

```python
def test_resume_does_not_repeat_completed_generation(self):
    provider = CountingFakeProvider()
    pipeline = make_pipeline(provider=provider, store=prepopulated_store_with_one_candidate())
    pipeline.run(config)
    self.assertEqual(provider.calls_for("completed-candidate"), 0)

def test_budget_is_checked_before_provider_call(self):
    provider = CountingFakeProvider()
    result = make_pipeline(provider=provider).run(replace(config, max_images=1))
    self.assertEqual(provider.total_images, 1)
    self.assertEqual(result.stop_code, "GenerationBudgetReached")
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_generation_pipeline.py`

Expected: run-store and pipeline imports fail.

- [ ] **Step 3: Implement atomic ledger and resumable states**

Use `.base-generation/runs/<run-id>/run.json` and append-only `events.jsonl`. Store accepted-scene history in `.base-generation/history/accepted.jsonl`; append one `fsync`ed JSON object only after successful publication, and ignore only a malformed final partial line after an interrupted append. Valid candidate states are `planned`, `generating`, `generated`, `normalized`, `locally_rejected`, `critic_rejected`, `novelty_rejected`, `passing`, `selected`, `structural_failed`, `finalized`, and `published`. Write replaceable JSON to a sibling temporary file, `fsync`, then `os.replace`.

- [ ] **Step 4: Implement adaptive orchestration and reports**

Generate one candidate from each provider first in mixed mode. If more candidates are needed, choose the provider with the stronger recorded score for that scene family while preserving the four-per-brief cap. Check `generated_image_count < config.max_images` before every call. Retry only classified rate-limit, server, and timeout failures, at most twice with bounded 1-second then 3-second backoff supplied through an injectable sleeper; do not retry authentication, safety, malformed-response, or quality failures. Persist after every transition. Generate a JSON report plus an HTML grid showing thumbnails, provider/model, score components, and escaped rejection reasons.

- [ ] **Step 5: Run tests and commit**

Run: `python3 scripts/test_base_generation_pipeline.py`

Expected: all ledger, budget, resume, scheduling, cleanup, and report tests pass.

```bash
git add scripts/base_run_store.py scripts/base_generation_report.py scripts/base_generation_pipeline.py scripts/test_base_generation_pipeline.py
git commit -m "feat: orchestrate resumable base candidate generation"
```

### Task 7: Structural Handoff, Pair Finalization, and Atomic Publication

**Files:**
- Create: `scripts/image_pair_finalizer.py`
- Create: `scripts/base_pair_publisher.py`
- Modify: `scripts/test_base_generation_pipeline.py`

**Interfaces:**
- Consumes: `generate_single_scene_difference(..., policy=STRUCTURAL_ONLY_POLICY)` from the existing structural pipeline.
- Produces: `finalize_pair(base_path, variant_path, ground_truth, output_dir, scene_id, policy) -> FinalizedPair`.
- Produces: `publish_pair(finalized_pair, manifest_entry, levels_dir, manifest_path) -> dict`.
- Produces: `generate_structural_pair(candidate, scene_spec, staging_dir) -> tuple[FinalizedPair | None, dict]`.

- [ ] **Step 1: Write failing finalization and publisher tests**

Test exact 1200x900 output, JPEG quality settings through injected encoder, identical paired transforms, hotspot percentages unchanged, small-difference survival at 800x600, outside-region alignment, manifest dimension fields, atomic manifest replacement, duplicate-ID replacement, and rollback when manifest replacement fails.

```python
def test_finalized_pair_is_exact_1200_by_900_and_declares_metadata(self):
    pair = finalize_pair(base_master, variant_master, gt, output_dir, "scene-1", policy)
    self.assertEqual(Image.open(pair.base_path).size, (1200, 900))
    self.assertEqual(Image.open(pair.variant_path).size, (1200, 900))
    self.assertEqual(pair.dimensions, {"width": 1200, "height": 900})
    self.assertEqual(pair.aspect_ratio, "4:3")

def test_manifest_failure_removes_newly_copied_assets(self):
    with self.assertRaises(OSError):
        publish_pair(pair, entry, levels_dir, manifest_path, replace_fn=failing_replace)
    self.assertFalse((levels_dir / pair.base_path.name).exists())

def test_duplicate_scene_id_uses_new_asset_names_until_manifest_commit(self):
    old_entry = seed_existing_scene(levels_dir, manifest_path, scene_id="scene-1")
    publish_pair(pair, replacement_entry, levels_dir, manifest_path)
    self.assertTrue((levels_dir / old_entry["imageA"]).exists())
    self.assertNotEqual(old_entry["imageA"], replacement_entry["imageA"])
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_generation_pipeline.py`

Expected: finalizer/publisher imports fail.

- [ ] **Step 3: Implement paired finalization and display checks**

Load both masters, require matching 1536x1152 geometry, resize both with the same LANCZOS call, re-evaluate the changed region at 1200x900 and 800x600, encode JPEG quality 95 with `subsampling=0`, strip metadata, and return dimension/aspect metadata. Reject `DifferenceLostAfterDownsample`, `PairDimensionMismatch`, and `OutsideRegionDrift` with recorded metrics.

- [ ] **Step 4: Implement staged structural generation and atomic publication**

Call the structural generator with `STRUCTURAL_ONLY_POLICY` and an isolated run staging directory, never `public/levels`. Add `dimensions` and `aspectRatio` to the returned entry after finalization. Derive immutable destination filenames from scene ID plus content digest so replacement of a duplicate scene ID never overwrites its currently registered assets. Copy both final files to temporary names in `public/levels`, atomically rename the new files, write the updated manifest to a sibling temporary file, and atomically replace the manifest. Remove only the newly copied digest-named files if registration fails; leave previously registered files untouched. After manifest success, append the accepted history record. Orphan cleanup is a separate explicit maintenance operation, not part of publication.

- [ ] **Step 5: Run tests and commit**

Run: `python3 scripts/test_base_generation_pipeline.py && python3 scripts/test_structural_generation.py`

Expected: all new tests and 20 existing structural tests pass.

```bash
git add scripts/image_pair_finalizer.py scripts/base_pair_publisher.py scripts/test_base_generation_pipeline.py
git commit -m "feat: finalize and publish structural photo pairs safely"
```

### Task 8: Interactive and Scriptable CLI

**Files:**
- Create: `scripts/generate_photo_batch.py`
- Modify: `scripts/test_base_generation_pipeline.py`

**Interfaces:**
- Consumes all prior task interfaces.
- Produces Typer commands: root wizard, `plan`, `generate`, `resume`, `report`, `doctor`, `catalog validate`, `history stats`, and `auth` subcommands.
- Produces: `build_run_config_from_answers(answers) -> RunConfig` for testable wizard logic.

- [ ] **Step 1: Write failing CLI tests with `typer.testing.CliRunner`**

Test `--help`, no-argument wizard configuration, plan without credentials, doctor without generation, config round-trip, `--yes` requirement for unattended execution, auth status redaction, Google login subprocess delegation, report opening, and equivalent wizard/flag configs.

```python
def test_plan_never_resolves_credentials_or_calls_provider(self):
    result = runner.invoke(app, ["plan", "--count", "10", "--provider", "mixed"])
    self.assertEqual(result.exit_code, 0)
    self.assertIn("4 collections / 4 activities / 2 playful", result.stdout)
    self.assertEqual(fake_provider.total_images, 0)

def test_unattended_generate_requires_yes(self):
    result = runner.invoke(app, ["generate", "--config", str(config_path)])
    self.assertNotEqual(result.exit_code, 0)
    self.assertIn("--yes", result.stdout)
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `python3 scripts/test_base_generation_pipeline.py`

Expected: CLI import fails.

- [ ] **Step 3: Implement commands, wizard, and progress display**

Keep prompts and rendering in the CLI module; pass pure `RunConfig` objects into orchestration. The paid-run summary must show target pairs, 4/4/2 slots, provider models, image ceiling, master/production sizes, critic provider, and staging path. Never display credential values.

Use Typer sub-apps for `auth`, `catalog`, and `history`. Use Rich progress rows for generated image count, accepted slots, current brief/provider, and rejection code. `report --open` opens only a local generated HTML file through `webbrowser.open`.

- [ ] **Step 4: Run CLI tests and manual dry-run help**

Run: `python3 scripts/test_base_generation_pipeline.py && python3 scripts/generate_photo_batch.py --help && python3 scripts/generate_photo_batch.py plan --count 10 --provider mixed`

Expected: tests pass; help lists every command; plan prints exact 4/4/2 slots and performs no network call.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_photo_batch.py scripts/test_base_generation_pipeline.py
git commit -m "feat: add guided base image generation CLI"
```

### Task 9: Documentation and Legacy Source-Pipeline Retirement

**Files:**
- Create: `docs/base-image-generation.md`
- Modify: `spot_difference_generation_tools/README.md`
- Delete: `scripts/ai_source_canvas_pipeline.py`

**Interfaces:**
- Consumes: the final CLI commands and rejection codes.
- Produces: a single authoritative operator guide and removes the unused legacy source-image scaffold.

- [ ] **Step 1: Verify the legacy scorer has no runtime consumers**

Run: `rg -n "ai_source_canvas_pipeline|EditabilityScorer|SCENE_ARCHETYPES" --glob '!docs/superpowers/**' --glob '!scripts/ai_source_canvas_pipeline.py' .`

Expected: no production or test import of the legacy module. If a consumer exists, migrate it to `base_candidate_evaluator` before deletion and add a focused regression test.

- [ ] **Step 2: Write the operator guide**

Document installation from `requirements-generation.txt`, Google ADC login, Google/OpenAI keychain setup, environment and hosted auth, wizard flow, every non-interactive command, provider/critic modes, models, quotas, thresholds, sizing, staging layout, resume, reports, provenance, budget behavior, structural handoff, all rejection codes, cleanup, and both live smoke commands.

Use these explicit warnings:

```text
Normal tests never call paid APIs. Live smoke commands are opt-in and can incur provider charges.
Generation masters remain in staging. Only validated 1200x900 pairs are published.
Never paste credentials into run-config.json, command arguments, issue reports, or logs.
```

- [ ] **Step 3: Remove the migrated legacy module and update the toolkit README**

Delete `scripts/ai_source_canvas_pipeline.py`. Identify `scripts/generate_photo_batch.py` as the authoritative base-image generator and link `docs/base-image-generation.md`. Do not delete historical batch scripts in this task.

- [ ] **Step 4: Check links, references, and formatting**

Run: `test ! -e scripts/ai_source_canvas_pipeline.py && rg -n "generate_photo_batch.py|base-image-generation.md" docs/base-image-generation.md spot_difference_generation_tools/README.md && git diff --check -- docs/base-image-generation.md spot_difference_generation_tools/README.md scripts/ai_source_canvas_pipeline.py`

Expected: legacy file absent, both docs reference the authoritative CLI, and diff check is clean.

- [ ] **Step 5: Commit**

```bash
git add docs/base-image-generation.md spot_difference_generation_tools/README.md scripts/ai_source_canvas_pipeline.py
git commit -m "docs: document managed base image generation"
```

### Task 10: Repository Test Wiring and Final Verification

**Files:**
- Modify: `package.json`
- Modify: `scripts/test_base_generation_policy.py`
- Modify: `scripts/test_base_providers.py`
- Modify: `scripts/test_base_generation_pipeline.py`

**Interfaces:**
- Produces: a single offline `npm test` path covering the new subsystem.
- Produces: explicit, separately documented Google and OpenAI live-smoke entry points.

- [ ] **Step 1: Add an end-to-end mocked acceptance test**

Exercise catalog selection, one fake candidate per provider, normalization, local evaluation, fake critic, ledger transitions, fake structural handoff, finalization, atomic publication into a temporary directory, and report generation. Assert no network client was constructed and no production path changed.

```python
def test_mocked_batch_reaches_published_without_network_or_production_writes(self):
    result = build_fully_fake_pipeline(temp_dir).run(RunConfig(count=1, provider_mode="mixed"))
    self.assertEqual(result.accepted_count, 1)
    self.assertEqual(result.generated_by_provider, {"google": 1, "openai": 1})
    self.assertTrue(result.report_json.exists())
    self.assertTrue(result.report_html.exists())
    self.assertFalse(Path("public/levels/mock_scene_base.jpg").exists())
```

- [ ] **Step 2: Run the new suites directly**

Run: `python3 scripts/test_base_generation_policy.py && python3 scripts/test_base_providers.py && python3 scripts/test_base_generation_pipeline.py`

Expected: all new tests pass with zero network calls.

- [ ] **Step 3: Add the new offline suites to `npm test`**

Append these commands after the existing structural suite without removing any existing command:

```json
"test": "node --test src/**/*.test.mjs functions/**/*.test.mjs && npm run test:ui && python3 scripts/test_pipeline_unit_suite.py && python3 scripts/test_structural_generation.py && python3 scripts/test_base_generation_policy.py && python3 scripts/test_base_providers.py && python3 scripts/test_base_generation_pipeline.py"
```

- [ ] **Step 4: Run fresh full verification**

Run:

```bash
python3 -m py_compile \
  scripts/base_generation_types.py \
  scripts/base_generation_policy.py \
  scripts/base_scene_catalog.py \
  scripts/base_prompt_composer.py \
  scripts/base_auth.py \
  scripts/base_image_provider.py \
  scripts/base_visual_critic.py \
  scripts/base_candidate_evaluator.py \
  scripts/base_run_store.py \
  scripts/base_generation_report.py \
  scripts/base_generation_pipeline.py \
  scripts/image_pair_finalizer.py \
  scripts/base_pair_publisher.py \
  scripts/generate_photo_batch.py
npm test
npm run build
python3 scripts/generate_photo_batch.py doctor
python3 scripts/generate_photo_batch.py plan --count 10 --provider mixed
```

Expected: compilation exits 0; all Node, UI, legacy pipeline, structural, and base-generation tests pass; Vite builds with only the existing chunk-size warning; doctor reports provider readiness without exposing secrets; plan outputs exact 4/4/2 slots and performs no paid request.

- [ ] **Step 5: Run scoped hygiene checks**

Run:

```bash
git diff --check -- \
  .gitignore requirements-generation.txt package.json \
  scripts/base_generation_types.py scripts/base_generation_policy.py \
  scripts/base_scene_catalog.json scripts/base_scene_catalog.py \
  scripts/base_prompt_composer.py scripts/base_auth.py \
  scripts/base_image_provider.py scripts/base_visual_critic.py \
  scripts/base_candidate_evaluator.py scripts/base_run_store.py \
  scripts/base_generation_report.py scripts/base_generation_pipeline.py \
  scripts/image_pair_finalizer.py scripts/base_pair_publisher.py \
  scripts/generate_photo_batch.py scripts/test_base_generation_policy.py \
  scripts/test_base_providers.py scripts/test_base_generation_pipeline.py \
  docs/base-image-generation.md spot_difference_generation_tools/README.md
! rg -n 'sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}' \
  scripts/base_*.py scripts/generate_photo_batch.py docs/base-image-generation.md
```

Expected: no feature-file whitespace errors and no credential-shaped strings.

- [ ] **Step 6: Commit the final offline wiring**

```bash
git add package.json scripts/test_base_generation_policy.py scripts/test_base_providers.py scripts/test_base_generation_pipeline.py
git commit -m "test: verify managed base generation offline"
```

## Explicit Live Smoke Tests

These checks are never part of normal verification and must run only when the operator intentionally supplies credentials and accepts provider charges.

Google:

```bash
python3 scripts/generate_photo_batch.py generate \
  --provider google --count 1 --max-images 1 --keep-rejected --yes
```

OpenAI:

```bash
python3 scripts/generate_photo_batch.py generate \
  --provider openai --count 1 --max-images 1 --keep-rejected --yes
```

For each smoke run, verify that the provider request succeeds, native dimensions are recorded, normalization produces a 1536x1152 master, secrets are absent from reports, and either a valid structural pair is published to the explicitly selected temporary manifest/output paths or a documented quality rejection is returned without production writes.
