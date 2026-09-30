# Structural Variant Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in structural-only generation mode that refines masks, evaluates multiple add/remove/reorder edits, rejects structural artifacts, and selects the best passing variant without changing mixed-mode defaults.

**Architecture:** Introduce an immutable generation policy at the orchestration boundary, plus focused mask-refinement and structural-quality modules. The existing selectors continue proposing candidates and producing variants; the orchestrator applies policy limits, collects passing structural results, scores them deterministically, and saves only the winner.

**Tech Stack:** Python 3, OpenCV, NumPy, Pillow, Ultralytics FastSAM, `unittest`

**Spec:** `docs/superpowers/specs/2026-09-18-structural-variant-generation-design.md`

## Global Constraints

- Mixed generation remains the default and preserves current first-pass behavior.
- Structural mode is explicit and permits only `add`, `remove`, and `reorder`.
- Structural mode must never execute or register `recolor`.
- Existing scene specs, manifest records, output paths, and callers remain compatible.
- Candidate scoring is deterministic and written to attempt logs.
- No generated image or manifest write occurs when structural generation fails.
- Preserve all unrelated working-tree changes, including the existing fallback work in `scripts/unified_operation_pipeline.py`.

---

### Task 1: Generation Policy and Operation Routing

**Files:**
- Create: `scripts/generation_policy.py`
- Create: `scripts/test_structural_generation.py`
- Modify: `scripts/unified_operation_pipeline.py`

**Interfaces:**
- Produces: `GenerationPolicy`, `MIXED_GENERATION_POLICY`, `STRUCTURAL_ONLY_POLICY`
- Produces: `build_operation_queue(affordances, preferred_op, scheduler, policy) -> tuple[list[str], str | None]`
- Consumes: existing `OperationScheduler.select_operation_for_scene`

- [ ] **Step 1: Write failing policy tests**

Add tests that assert the immutable policy defaults and operation queue behavior:

```python
class TestGenerationPolicy(unittest.TestCase):
    def test_mixed_policy_is_default_and_allows_recolor(self):
        self.assertIn("recolor", MIXED_GENERATION_POLICY.allowed_operations)
        self.assertEqual(MIXED_GENERATION_POLICY.selection_mode, "first_pass")

    def test_structural_policy_excludes_recolor(self):
        self.assertEqual(
            STRUCTURAL_ONLY_POLICY.allowed_operations,
            ("add", "remove", "reorder"),
        )
        self.assertEqual(STRUCTURAL_ONLY_POLICY.selection_mode, "best_score")

    def test_structural_queue_ignores_disallowed_preference(self):
        queue, error = build_operation_queue(
            {"recolor": 1.0, "add": 0.8, "remove": 0.6, "reorder": 0.4},
            "recolor",
            scheduler=None,
            policy=STRUCTURAL_ONLY_POLICY,
        )
        self.assertIsNone(error)
        self.assertNotIn("recolor", queue)
        self.assertEqual(queue[0], "add")

    def test_structural_queue_rejects_when_no_operation_is_viable(self):
        queue, error = build_operation_queue(
            {"recolor": 1.0, "add": 0.1, "remove": 0.2, "reorder": 0.0},
            None,
            scheduler=None,
            policy=STRUCTURAL_ONLY_POLICY,
        )
        self.assertEqual(queue, [])
        self.assertEqual(error, "NoAllowedOperation")
```

- [ ] **Step 2: Run the policy tests and verify RED**

Run: `PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestGenerationPolicy -v`

Expected: import failure because `generation_policy` and `build_operation_queue` do not exist.

- [ ] **Step 3: Implement immutable policies**

Create a frozen dataclass with validation:

```python
@dataclass(frozen=True)
class GenerationPolicy:
    name: str
    allowed_operations: tuple[str, ...]
    allow_operation_fallback: bool
    max_candidates_per_operation: int
    selection_mode: str
    refine_structural_masks: bool

    def __post_init__(self):
        unknown = set(self.allowed_operations) - {"recolor", "add", "remove", "reorder"}
        if unknown:
            raise ValueError(f"Unknown operations: {sorted(unknown)}")
        if self.selection_mode not in {"first_pass", "best_score"}:
            raise ValueError(f"Unknown selection mode: {self.selection_mode}")
        if self.max_candidates_per_operation < 1:
            raise ValueError("max_candidates_per_operation must be positive")
```

Define mixed mode with the current five/six-candidate behavior and structural mode with 12 candidates.

- [ ] **Step 4: Implement policy-aware operation queueing**

Extract routing into `build_operation_queue`. Filter affordances to allowed operations, require an affordance of at least `0.25`, ignore disallowed preferences, and only append allowed fallbacks when `allow_operation_fallback` is true. Do not append recolor unconditionally.

Add optional `policy=MIXED_GENERATION_POLICY` to `generate_single_scene_difference` and `generate_batch`, recording `generation_policy`, `allowed_operations`, and `operations_attempted` in logs.

- [ ] **Step 5: Run policy and existing tests**

Run:

```bash
PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestGenerationPolicy -v
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 6: Commit the policy slice**

```bash
git add scripts/generation_policy.py scripts/test_structural_generation.py scripts/unified_operation_pipeline.py
git commit -m "feat: add structural generation policy"
```

---

### Task 2: Structural Mask Refinement

**Files:**
- Create: `scripts/structural_mask_refiner.py`
- Modify: `scripts/test_structural_generation.py`

**Interfaces:**
- Produces: `StructuralMaskResult(object_mask, cleanup_mask, bbox, metrics)`
- Produces: `StructuralMaskRefiner.refine(image_bgr, candidate_mask, bbox) -> StructuralMaskResult`

- [ ] **Step 1: Write failing mask tests**

Use 160×160 synthetic images and masks. Tests must prove that the component containing the source centroid is retained, isolated specks disappear, cleanup contains the entire object mask, and cleanup remains inside a locally expanded bbox.

```python
def test_refiner_removes_disconnected_specks_and_builds_cleanup_mask(self):
    image = textured_canvas(160, 160)
    mask = np.zeros((160, 160), dtype=np.uint8)
    cv2.rectangle(mask, (60, 62), (92, 94), 255, -1)
    mask[10, 10] = 255

    result = StructuralMaskRefiner.refine(image, mask, [60, 62, 92, 94])

    self.assertEqual(result.object_mask[10, 10], 0)
    self.assertGreater(np.sum(result.object_mask > 0), 800)
    self.assertTrue(np.all(result.cleanup_mask[result.object_mask > 0] > 0))
    self.assertLess(result.metrics["cleanup_area_pct"], 2.0)
```

Add a test that injects a GrabCut implementation returning a mask over 35% larger and asserts fallback status `grabcut_drift_fallback`.

- [ ] **Step 2: Run mask tests and verify RED**

Run: `PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestStructuralMaskRefiner -v`

Expected: import failure because `structural_mask_refiner` does not exist.

- [ ] **Step 3: Implement connected-component cleanup**

Normalize to a binary source-sized mask, identify the original centroid, keep the containing or nearest connected component, and apply a 3×3 close/open pass. Recompute the bbox from nonzero pixels.

- [ ] **Step 4: Implement guarded local GrabCut**

Construct the GrabCut initialization from an eroded sure-foreground, original probable-foreground, dilated probable-background, and definite background outside the local ROI. Accept the result only if nonempty, its area change is at most 35%, and its centroid remains within the original bbox plus a 10% margin. Expose a private callable argument for deterministic test injection.

- [ ] **Step 5: Implement cleanup-mask expansion and metrics**

Build cleanup from a 3×3 dilation plus a two-pixel down-right shadow expansion. Clamp it to the object bbox expanded by 20% plus eight pixels. Return area, component, solidity, bbox, and refinement-status metrics.

- [ ] **Step 6: Run mask and existing tests**

Run:

```bash
PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestStructuralMaskRefiner -v
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 7: Commit the mask slice**

```bash
git add scripts/structural_mask_refiner.py scripts/test_structural_generation.py
git commit -m "feat: refine masks for structural edits"
```

---

### Task 3: Structural Naturalness Critic and Candidate Ranker

**Files:**
- Create: `scripts/structural_quality.py`
- Modify: `scripts/test_structural_generation.py`

**Interfaces:**
- Produces: `StructuralQualityResult(passed, score, metrics, rejection_code, reason)`
- Produces: `StructuralNaturalnessCritic.evaluate(base_bgr, variant_bgr, edit_bbox, operation, object_mask=None, occupied_mask=None, old_mask=None, new_mask=None) -> StructuralQualityResult`
- Produces: `score_structural_candidate(selector_score, naturalness_score, compactness_score, difficulty_fit_score) -> tuple[float, dict]`
- Produces: `select_candidate(candidates, selection_mode) -> dict | None`

- [ ] **Step 1: Write failing critic tests**

Create deterministic synthetic cases for a clean compact structural edit, a hard rectangular seam, a blurred patch, a placed-object collision, and a reorder with disconnected old/new footprints.

```python
def test_candidate_ranker_selects_later_higher_quality_result(self):
    candidates = [
        {"id": "first", "selector_score": 90, "naturalness_score": 0.40,
         "compactness_score": 0.60, "difficulty_fit_score": 0.50},
        {"id": "second", "selector_score": 78, "naturalness_score": 0.95,
         "compactness_score": 0.90, "difficulty_fit_score": 0.90},
    ]
    selected = select_candidate(candidates, "best_score")
    self.assertEqual(selected["id"], "second")
    self.assertIn("score_components", selected)
```

Assert stable codes `StructuralBoundaryArtifact`, `StructuralBlurArtifact`, `StructuralCollision`, and `SplitDifferenceRegion` for their respective fixtures.

- [ ] **Step 2: Run critic tests and verify RED**

Run: `PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestStructuralQuality -v`

Expected: import failure because `structural_quality` does not exist.

- [ ] **Step 3: Implement metric extraction**

Calculate the thresholded diff mask, changed-region connected components, changed-pixel compactness, boundary-ring Lab discontinuity, and Laplacian sharpness ratio. When masks are supplied, calculate placement collision and old/new union connectivity.

- [ ] **Step 4: Implement conservative hard gates**

Reject only severe conditions covered by tests: boundary discontinuity above the calibrated synthetic-fixture limit, sharpness ratio below `0.35`, unrelated foreground collision over `8%` of the placed object, or old/new reorder masks separated by more than one object short-side.

- [ ] **Step 5: Implement deterministic scoring and selection**

Normalize selector scores from `[0, 100]`, naturalness/compactness/difficulty fit from `[0, 1]`, and calculate:

```python
final_score = (
    0.30 * selector_score_normalized
    + 0.30 * naturalness_score
    + 0.20 * compactness_score
    + 0.20 * difficulty_fit_score
)
```

Use `0.5` for missing optional values. In `first_pass`, return the first candidate; in `best_score`, sort by final score and then stable attempt index.

- [ ] **Step 6: Run critic, policy, mask, and existing tests**

Run:

```bash
PYTHONPATH=scripts python3 scripts/test_structural_generation.py
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 7: Commit the quality slice**

```bash
git add scripts/structural_quality.py scripts/test_structural_generation.py
git commit -m "feat: score structural edit quality"
```

---

### Task 4: Integrate Refined Masks with Remove and Reorder

**Files:**
- Modify: `scripts/remove_target_selector.py`
- Modify: `scripts/reorder_target_selector.py`
- Modify: `scripts/test_structural_generation.py`

**Interfaces:**
- Extends: `RemoveTargetSelector.execute_removal_and_qa(..., cleanup_mask=None)`
- Extends: `ReorderTargetSelector.execute_reorder_and_qa(..., cleanup_mask=None)`
- Preserves: existing calls when `cleanup_mask` is omitted

- [ ] **Step 1: Write failing cleanup-mask integration tests**

Patch the reconstruction router with a recording test double and assert remove/reorder pass `cleanup_mask` to reconstruction while reorder still extracts pixels with the tight object mask.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestCleanupMaskIntegration -v`

Expected: `TypeError` because the optional parameter is not accepted.

- [ ] **Step 3: Add backward-compatible cleanup-mask parameters**

Use `reconstruction_mask = cleanup_mask if cleanup_mask is not None else target_mask`. Keep target geometry, extraction, centroid, and object transforms based on `target_mask`.

- [ ] **Step 4: Run integration and pipeline tests**

Run:

```bash
PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestCleanupMaskIntegration -v
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 5: Commit selector integration**

```bash
git add scripts/remove_target_selector.py scripts/reorder_target_selector.py scripts/test_structural_generation.py
git commit -m "feat: use cleanup masks for structural reconstruction"
```

---

### Task 5: Best-of-N Structural Orchestration

**Files:**
- Modify: `scripts/unified_operation_pipeline.py`
- Modify: `scripts/test_structural_generation.py`

**Interfaces:**
- Consumes: `StructuralMaskRefiner.refine`
- Consumes: `StructuralNaturalnessCritic.evaluate`
- Consumes: `select_candidate`
- Adds log fields specified by the design spec

- [ ] **Step 1: Write failing orchestration tests**

Patch the existing module-level router and selector class methods with `unittest.mock.patch`, returning two synthetic passing candidates whose quality scores are `0.55` and `0.90`. Assert that structural mode executes both and selects the second, that the recolor engine raises if called, and that a fully rejected run leaves a temporary output directory empty. Add a separate mixed-policy test whose executor raises on a second call, proving first-pass behavior remains unchanged.

- [ ] **Step 2: Run orchestration tests and verify RED**

Run: `PYTHONPATH=scripts python3 -m unittest scripts.test_structural_generation.TestStructuralOrchestration -v`

Expected: assertions fail because current loops stop on their first success and append recolor fallback.

- [ ] **Step 3: Add an internal structural candidate record**

Represent each passing attempt with operation, variant image, ground truth, selector score, refinement metrics, naturalness metrics, score inputs, attempt index, and QA summary. Keep this internal; do not alter the manifest schema.

- [ ] **Step 4: Refactor structural operation loops to collect candidates**

For add/remove/reorder, honor `max_candidates_per_operation`, refine masks, pass cleanup masks to reconstruction, execute existing QA, run the structural critic, and append passing attempts. Continue to the next candidate instead of breaking when `selection_mode == "best_score"`.

- [ ] **Step 5: Rank and select only after the search budget**

Calculate difficulty-fit from the center of the accepted area/direct-look band in `LIMITS_BY_DIFFICULTY`. Choose the highest-scoring candidate, set `chosen_op`, then save only that candidate. Preserve current early-break behavior for mixed mode.

- [ ] **Step 6: Add complete structured logs**

Populate `candidate_attempt_count`, `passing_candidate_count`, `candidate_scores`, `selected_candidate_score`, and rejection codes. When none passes, return `NoStructuralCandidate` and do not call image-save or manifest-update code.

- [ ] **Step 7: Run structural and existing tests**

Run:

```bash
PYTHONPATH=scripts python3 scripts/test_structural_generation.py
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 8: Commit orchestration**

```bash
git add scripts/unified_operation_pipeline.py scripts/test_structural_generation.py
git commit -m "feat: select best structural variant candidate"
```

---

### Task 6: Operator Documentation and Test Entry Point

**Files:**
- Create: `docs/structural-variant-generation.md`
- Modify: `spot_difference_generation_tools/README.md`
- Modify: `package.json`
- Modify: `scripts/test_structural_generation.py`

**Interfaces:**
- Documents: single-scene and batch structural-policy usage
- Integrates: structural Python suite into `npm test`

- [ ] **Step 1: Write a failing test-entry-point check**

Run this assertion before modifying `package.json`:

```bash
python3 -c 'import json; p=json.load(open("package.json")); assert "python3 scripts/test_structural_generation.py" in p["scripts"]["test"]'
```

Expected: `AssertionError` because the structural suite is not yet part of `npm test`.

- [ ] **Step 2: Write operator documentation**

Document:

- Mixed vs structural-only policies.
- Complete import and invocation examples.
- Dense-base suitability guidelines.
- Candidate budget and best-of-N behavior.
- Output and no-write-on-failure behavior.
- Attempt-log fields and rejection codes.
- Dependency and working-directory requirements, including root `FastSAM-s.pt`.

Update the toolkit README to identify `scripts/unified_operation_pipeline.py` as authoritative and link to the operator guide, avoiding the stale duplicate under `spot_difference_generation_tools`.

- [ ] **Step 3: Add structural tests to `npm test`**

Append `&& python3 scripts/test_structural_generation.py` after the existing pipeline unit suite.

- [ ] **Step 4: Run documentation and focused test checks**

Run:

```bash
python3 scripts/test_structural_generation.py
python3 scripts/test_pipeline_unit_suite.py
git diff --check
```

Expected: all tests pass and no whitespace errors.

- [ ] **Step 5: Commit documentation and test integration**

```bash
git add docs/structural-variant-generation.md spot_difference_generation_tools/README.md package.json scripts/test_structural_generation.py
git commit -m "docs: document structural variant generation"
```

---

### Task 7: Full Verification and Real-Image Smoke Test

**Files:**
- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**
- Verifies: complete repository behavior and one non-destructive real-image generation attempt

- [ ] **Step 1: Run static Python compilation**

Run:

```bash
python3 -m py_compile \
  scripts/generation_policy.py \
  scripts/structural_mask_refiner.py \
  scripts/structural_quality.py \
  scripts/unified_operation_pipeline.py \
  scripts/add_target_selector.py \
  scripts/remove_target_selector.py \
  scripts/reorder_target_selector.py
```

Expected: exit 0 with no output.

- [ ] **Step 2: Run all focused Python suites**

Run:

```bash
PYTHONPATH=scripts python3 scripts/test_structural_generation.py
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

Expected: all tests pass.

- [ ] **Step 3: Run the repository test and build commands**

Run:

```bash
npm test
npm run build
```

Expected: exit 0. Record unrelated pre-existing failures separately rather than changing unrelated files.

- [ ] **Step 4: Run a non-destructive real-image smoke test**

Use a temporary directory and a copy of one existing dense base image. Call `generate_single_scene_difference` with `STRUCTURAL_ONLY_POLICY`; do not point it at the production manifest. Assert that success, if achieved, reports operation `add`, `remove`, or `reorder`, and that failure reports a structural rejection code without writing a manifest.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff -- scripts docs/structural-variant-generation.md spot_difference_generation_tools/README.md package.json
```

Confirm no user-owned image, manifest, app, or unrelated workspace changes are staged or modified by this work.

- [ ] **Step 6: Commit any in-scope verification correction**

If verification required an in-scope correction, stage the exact corrected path shown by `git diff --name-only`, verify it belongs to this plan's file list, and commit it. For example, if only the quality module required correction:

```bash
git add scripts/structural_quality.py
git commit -m "fix: harden structural variant generation"
```

If verification required no correction, do not create an empty commit.
