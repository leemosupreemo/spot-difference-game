# Daily Challenge Input Directory (`_pipeline_io/inputs/daily/`)

Drop source photographs here to generate Daily Challenge sets.

- **Batch Size Constraint**: **Exact batches of 3** (e.g. 3, 6, or 9 images).
- **Target Dimensions**: Auto-cropped and normalized to **4:3 landscape** (1200 × 900 px).
- **Execution**:
  ```bash
  python3 scripts/run_pipelines.py daily
  ```
- **Review & Approval**:
  - Puzzles enter in-game review in Debug Mode (`?review=1` / Daily Challenge debug pool).
  - Side-by-side review crops are placed in `_pipeline_io/outputs/daily/<set_id>/_review/`.
  - Once reviewed and verified, approve the 3-pack into the live queue:
    ```bash
    python3 scripts/run_pipelines.py approve-daily --set-id daily_set_NNN [--push]
    ```
