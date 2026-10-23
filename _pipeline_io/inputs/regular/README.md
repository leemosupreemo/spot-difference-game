# Regular Set Input Directory (`_pipeline_io/inputs/regular/`)

Drop source photographs here to generate canonical 5-level Photography Sets.

- **Batch Size Constraint**: **Exact batches of 5** (e.g. 5, 10, or 15 images).
- **Target Dimensions**: Auto-cropped and normalized to **4:3 landscape** (1200 × 900 px).
- **Execution**:
  ```bash
  python3 scripts/run_pipelines.py regular
  ```
- **Review & Approval**:
  - Puzzles enter in-game review in Debug Mode (`?review=1` / Curation pool).
  - Side-by-side review crops are placed in `_pipeline_io/outputs/regular/<set_id>/_review/`.
  - Once reviewed and verified, promote the 5-pack to production gameplay:
    ```bash
    python3 scripts/run_pipelines.py approve-regular --set-id photo_set_NNN
    ```
