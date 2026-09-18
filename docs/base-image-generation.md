# Managed Base Image Generation — Operator Guide

`scripts/generate_photo_batch.py` is the authoritative entry point for
generating new spot-the-difference base images end to end: portfolio-balanced
scene selection, dual-provider photorealistic generation, local and semantic
quality gates, novelty checks, the existing structural add/remove/reorder
pipeline, paired finalization, and atomic publication to `public/levels`.

> Normal tests never call paid APIs. Live smoke commands are opt-in and can incur provider charges.
> Generation masters remain in staging. Only validated 1200x900 pairs are published.
> Never paste credentials into run-config.json, command arguments, issue reports, or logs.

## 1. Installation

```bash
pip install -r requirements-generation.txt
```

This installs `openai`, `google-genai`, `google-auth`, `typer`, `rich`,
`keyring`, `Pillow`, `numpy`, `opencv-python`, and `ultralytics`. Provider SDK
imports are lazy: commands that never call a provider (`plan`, `doctor`,
`catalog validate`, `history stats`, `auth status`) work even if a provider
package isn't installed.

`doctor` (see §9) also checks that FastSAM weights (`FastSAM-s.pt`) are
present — the same weights the existing structural pipeline uses.

## 2. Authentication

Credentials are resolved through provider-specific adapters, in this order
for each provider: an explicit environment variable, a tool-owned OS
keychain entry, then Google Application Default Credentials (ADC) or another
workload identity. Credentials are never written into `run-config.json`,
command arguments, reports, provenance, or logs.

### Google

- **Recommended for interactive local use — ADC:**
  ```bash
  python3 scripts/generate_photo_batch.py auth login google
  ```
  This delegates to `gcloud auth application-default login` and never
  revokes any pre-existing global `gcloud` credentials.
- **Keychain:**
  ```bash
  python3 scripts/generate_photo_batch.py auth set-key google
  ```
  Prompts for the key with a hidden input and stores it via the OS keychain
  (service name `spot-difference-base-generation`, account `google`).
- **Environment (CI / hosted):** `GOOGLE_API_KEY`, or its documented alias
  `GEMINI_API_KEY`. Setting both to *different* values is rejected.
- **Hosted workload identity:** Google Cloud service-account or workload
  credentials are picked up automatically through ADC in a properly
  configured hosted environment — no separate flag is needed.

### OpenAI

- **Recommended for interactive local use — keychain:**
  ```bash
  python3 scripts/generate_photo_batch.py auth set-key openai
  ```
- **Environment (CI / hosted):** `OPENAI_API_KEY`.

### Checking and removing credentials

```bash
python3 scripts/generate_photo_batch.py auth status
python3 scripts/generate_photo_batch.py auth remove google
python3 scripts/generate_photo_batch.py auth remove openai
```

`auth status` only ever prints provider, credential kind, and availability —
never a raw key or token value.

Mixed provider mode requires both providers' credentials. An unattended
(non-interactive) run fails if either is missing unless
`--allow-provider-fallback` was explicitly set, in which case the run
narrows itself to whichever single provider is actually authenticated.

## 3. The interactive wizard

Running the CLI with no arguments in a terminal opens a guided wizard:

```bash
python3 scripts/generate_photo_batch.py
```

It collects provider mode, target pair count, portfolio preset, quality
preset, candidate ceiling, spend ceiling, rejected-image retention, and
staging location, then shows the full run summary (target count, exact
portfolio slots, provider models, image ceiling, canonical master/production
sizes, critic provider, staging path). If you choose to execute now, it
shows that summary again under an explicit paid-run warning and requires a
second, separate confirmation before making any billable call. Declining
either confirmation leaves the written configuration as a dry run.

The wizard always writes every non-secret choice to a `run-config.json` and
prints the equivalent reproducible non-interactive command (without
`--yes`, since re-running that command still asks for confirmation unless
you add `--yes` yourself).

Interactive wizard prompts and non-interactive flags always build the exact
same `RunConfig` through one shared function
(`build_run_config_from_answers`), so the two paths can never diverge.

## 4. Non-interactive commands

```bash
python3 scripts/generate_photo_batch.py plan --count 10 --provider mixed
python3 scripts/generate_photo_batch.py generate --config run-config.json
python3 scripts/generate_photo_batch.py generate --config run-config.json --yes
python3 scripts/generate_photo_batch.py generate --provider google --count 1 --max-images 1 --keep-rejected --yes
python3 scripts/generate_photo_batch.py resume RUN_ID
python3 scripts/generate_photo_batch.py report RUN_ID --open
python3 scripts/generate_photo_batch.py doctor
python3 scripts/generate_photo_batch.py catalog validate
python3 scripts/generate_photo_batch.py history stats
```

- **`plan`** selects a portfolio-balanced brief batch and writes a
  reproducible `run-config.json`. It never resolves credentials or calls a
  provider — safe to run with no authentication configured at all.
- **`generate`** executes a run. Pass `--config run-config.json` to run
  exactly what `plan` (or the wizard) wrote — every other flag is ignored
  when `--config` is given. Without `--config`, it builds a `RunConfig`
  directly from flags (`--provider`, `--critic`, `--count`, `--seed`,
  `--max-images`, `--max-spend`, `--staging-root`, `--keep-rejected`,
  `--allow-provider-fallback`) and always runs in execute mode — this is the
  form the live smoke commands in §12 use. A dry-run `--config`
  (`execution_mode != "execute"`) always exits immediately without touching
  credentials. An execute-mode run invoked non-interactively (e.g. in CI)
  requires `--yes`; run interactively without `--yes`, it shows the summary
  and asks for confirmation itself.
- **`resume RUN_ID`** continues an interrupted run from its ledger. Any
  candidate whose ledger state already reached `normalized` or further is
  never regenerated; the image budget is never double-counted for it either.
- **`report RUN_ID [--open]`** writes `report.json` and `report.html` for a
  run and, with `--open`, opens only that just-written local HTML file via
  `webbrowser.open` — never an arbitrary or remote URL.
- **`doctor`** checks credential availability, dependency imports, FastSAM
  weights, a writable staging path, catalog validity, and free disk space.
  It never constructs a provider or makes a paid call.
- **`catalog validate`** and **`history stats`** are read-only local
  utilities over the scene catalog and the accepted-scene history file.

## 5. Provider and critic modes

`--provider` accepts `mixed` (default), `google`, or `openai`.
`--critic` accepts `auto` (default), `google`, or `openai`.

In `auto` mode, a single-provider run's critic is that same provider — a
provider-only run never needs credentials for the other provider, even for
semantic QA. A `mixed` run's `auto` critic resolves to one fixed, explicitly
recorded provider so every candidate in that run is judged by the same
judge.

| Role | Google | OpenAI |
|---|---|---|
| Image generation | `gemini-3.1-flash-image` | `gpt-image-2.5-sunburst` |
| Semantic critic (default) | `gemini-3.1-flash-lite` | `gpt-5.6-luna` |

Mixed mode generates one candidate from each provider per brief first, then
adaptively directs any further needed candidates (up to 4 per brief) toward
whichever provider has the stronger in-run acceptance ratio for that scene
family — this never becomes a fixed provider preference across runs.

## 6. Portfolio, quotas, and budget

Each completed batch targets a 40% collection / 40% activity / 20% playful
split (4/4/2 for the default 10-pair batch; proportionally scaled via a
largest-remainder allocation for other counts). No domain, material,
layout, or palette may occupy more than `max(1, ceil(count * 0.25))` of an
accepted batch, and recently accepted tag combinations receive a cooldown
against the last 30 accepted scenes.

Limits, all enforced automatically:

- At most 4 generated candidates per brief.
- At most `ceil(count * 4)` generated images total (40 for the default
  10-pair batch), checked atomically before every single provider call —
  never after.
- A brief whose candidates are all rejected is replaced with a fresh,
  unused brief from the same portfolio bucket rather than weakening its
  prompt or any threshold.
- A run may finish with fewer than the requested count; thresholds are
  never relaxed to reach it.

A completed or stopped run reports one of these `stop_code` values:
`Completed`, `GenerationBudgetReached`, or `PlanExhausted`.

## 7. Sizing contract

- **Generation master:** exact 1536x1152, opaque PNG, sRGB, 4:3. Provider
  output is normalized immediately: OpenAI's native output is already this
  size; Google's documented 2K 4:3 output (2400x1792) is centered and cropped
  by at most 0.5% before resizing. A candidate needing a larger crop is
  rejected (`NormalizationCropExceeded`) rather than stretched.
- **Production pair:** exact 1200x900, JPEG quality 95, 4:4:4 chroma
  (`subsampling=0`), sRGB, metadata stripped. Base and variant always receive
  the identical resize transform. The manifest entry records
  `"dimensions": {"width": 1200, "height": 900}` and `"aspectRatio": "4:3"`.

## 8. Local and semantic gates, novelty, and ranking

A candidate must pass every local gate before the paid semantic critic is
ever called:

| Gate | Threshold |
|---|---|
| Sharpness uniformity | ≥ 0.25 |
| Global edge density | ≥ 0.02 |
| Detected objects (FastSAM) | ≥ 18 |
| Small editable targets | ≥ 8 |
| Repeated-object peer groups | ≥ 2 |
| Largest foreground object | ≤ 22% of frame |
| Best structural-operation affordance | ≥ 0.45 |

The semantic critic then scores photorealism, object integrity, scene
coherence, visual fun, and composition (0–10) with structured JSON output,
using high image detail (full-resolution bytes for Google, an explicit
high-detail request for OpenAI). Photorealism and object integrity must
each score ≥ 8.0 — a strong fun or novelty score never compensates for
failing either. Any non-empty artifact-flag list (malformed objects,
duplicated fragments, impossible geometry, inconsistent shadows, fake text,
logos, watermarks, illustrated/CGI style) rejects regardless of scores.

Novelty compares a 64-bit difference hash against the most recent 30
accepted scenes; a Hamming distance ≤ 6 is treated as a perceptual
duplicate and rejected. Tag/domain/material/layout/palette overlap with
recent history lowers (but does not by itself reject) the novelty score.

Passing candidates are ranked by a deterministic weighted score — 35%
structural editability, 25% novelty, 20% visual fun, 10% composition, 10%
multi-operation support — with a stable tie-break, and the top-ranked
candidate for the currently needed portfolio slot wins.

### Rejection codes

| Code | Meaning | Ledger state |
|---|---|---|
| `LocalGateReject` | The router's own universal gate rejected the image | `locally_rejected` |
| `SharpnessUniformityReject` | Sharpness uniformity below threshold | `locally_rejected` |
| `EdgeDensityReject` | Edge density below threshold | `locally_rejected` |
| `ObjectCountReject` | Too few detected objects | `locally_rejected` |
| `EditableTargetReject` | Too few small editable targets | `locally_rejected` |
| `PeerGroupReject` | Too few repeated-object peer groups | `locally_rejected` |
| `HeroObjectReject` | A foreground object is too large | `locally_rejected` |
| `StructuralAffordanceReject` | No structural operation scored high enough | `locally_rejected` |
| `PhotorealismReject` | Critic photorealism score below 8.0 | `critic_rejected` |
| `ObjectIntegrityReject` | Critic object-integrity score below 8.0 | `critic_rejected` |
| `ArtifactFlagged` | Critic flagged one or more artifacts | `critic_rejected` |
| `PerceptualDuplicateReject` | Perceptual hash too close to recent history | `novelty_rejected` |

Structural handoff and finalization can additionally reject with
`NoStructuralCandidate` (no viable structural edit found),
`PairDimensionMismatch`, `DifferenceLostAfterDownsample`, or
`OutsideRegionDrift` (see §10).

## 9. Staging layout, resume, and cleanup

```
.base-generation/
  runs/<run-id>/
    run.json          # immutable config + plan snapshot, written once
    events.jsonl       # append-only, fsynced state-transition log
    candidates/         # normalized 1536x1152 masters
    structural/          # raw structural-pipeline output (pre-finalization)
    finalized/            # 1200x900 finalized pairs, pre-publication
  history/accepted.jsonl  # cross-run, append-only accepted-scene history
```

Every candidate moves through an explicit ledger state machine: `planned` →
`generating` → `generated` → `normalized` → one of `locally_rejected` /
`critic_rejected` / `novelty_rejected` / `passing` → (for the selected
winner) `selected` → `structural_failed` or `finalized` → `published`.
Every transition is persisted (temp file + `fsync` + atomic replace for
`run.json`; an fsynced append for `events.jsonl`) before the run proceeds,
so `resume RUN_ID` can always continue without regenerating anything
already normalized or further, and without double-counting spent budget.

Rejected candidate images are deleted by default once a run's report is
written; pass `--keep-rejected` (or answer the wizard's retention prompt)
to keep them for diagnosis. Rejection metadata is retained either way.
Accepted generation masters stay outside `public/levels` — only a
finalized, structurally-successful, size-validated pair is ever published.

## 10. Structural handoff and publication

An accepted base image is handed to the existing structural-only
add/remove/reorder pipeline
(`generate_single_scene_difference(..., policy=STRUCTURAL_ONLY_POLICY)`),
writing only into the run's isolated staging directory — never
`public/levels`. If the structural pipeline finds no viable edit, the base
is rejected with `NoStructuralCandidate` and the portfolio slot tries a
fresh brief rather than forcing a weaker edit.

A successful structural result is finalized (`image_pair_finalizer.py`):
base and variant are resized together to exactly 1200x900, the declared
difference region is re-verified to survive downsampling at both
production size and a simulated 800x600 display size
(`DifferenceLostAfterDownsample` if not), and every pixel outside that
region must remain aligned between base and variant
(`OutsideRegionDrift` if not) — proof that the resize itself introduced no
new differences and destroyed none.

Publication (`base_pair_publisher.py`) is atomic and never risks a
currently-registered asset: destination filenames are derived from the
scene id plus a content digest, so a duplicate scene id with different
content always lands on new files. Both files are copied into
`public/levels` before the manifest is ever touched; the manifest is
replaced via a sibling temp file and an atomic rename. If manifest
replacement fails, only the files this specific call just copied are rolled
back — any already-registered asset is left untouched. The accepted-scene
history record is appended only after publication succeeds.

## 11. Reports and provenance

Every run produces a JSON report and an HTML contact-sheet report built
entirely from the run's own ledger — nothing in a report can claim
something the ledger doesn't also record. The HTML report escapes every
critic- or operator-controlled string (rejection reasons, tags, ids) before
rendering it. Provenance recorded per candidate includes provider, model,
normalization transform, all critic scores, novelty score, rank score, and
rejection reason where applicable.

## 12. Live smoke tests

Live smoke tests exercise the real provider and critic APIs and are
excluded from `npm test` so routine test runs never incur cost. Run them
explicitly, one provider at a time, after authenticating that provider:

```bash
python3 scripts/generate_photo_batch.py plan --count 1 --provider google --config-out /tmp/smoke-google.json
python3 scripts/generate_photo_batch.py generate --config /tmp/smoke-google.json --yes

python3 scripts/generate_photo_batch.py plan --count 1 --provider openai --config-out /tmp/smoke-openai.json
python3 scripts/generate_photo_batch.py generate --config /tmp/smoke-openai.json --yes
```

Each generates one real candidate from that provider, running it through
real normalization and the full local/semantic evaluator. Review the run's
report afterward and inspect `.base-generation/runs/<run-id>/` for the
staged artifacts.

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `doctor` reports missing dependency | `pip install -r requirements-generation.txt` not run, or run in the wrong environment | Reinstall; confirm `python3 -m pip show <package>` |
| `generate` exits immediately with a credentials error | Neither ADC, keychain, nor the environment variable resolved | `auth status`, then `auth login google` or `auth set-key <provider>` |
| Non-interactive `generate` fails asking for `--yes` | Running an execute-mode config outside a terminal (e.g. CI) without confirming | Add `--yes` once you've reviewed the config, or keep it a dry run |
| A batch finishes short of the requested count | Budget exhausted, or the catalog ran out of unused briefs for a family before quotas filled | Check the report's `stop_code`; raise `--max-images` or broaden the catalog rather than lowering thresholds |
| Many candidates fail the same rejection code | A systemic prompt, threshold, or provider issue for that scene family | Inspect `--keep-rejected` staged images and the HTML report's per-candidate scores for that code |
| `resume` errors that no run was found | Wrong `--staging-root` or run id | Confirm the exact path under `.base-generation/runs/` |
