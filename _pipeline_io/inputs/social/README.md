# Social Media Input Directory (`_pipeline_io/inputs/social/`)

Drop source photographs or artwork here to generate social media spot-the-difference pairs.

- **Recommended Formats**: `.jpg`, `.jpeg`, `.png`
- **Target Dimensions**: Auto-cropped and normalized to **2:3** (848 × 1264 px) or **4:5** (1080 × 1350 px).
- **Execution**:
  ```bash
  python3 scripts/run_pipelines.py social --batch-name my_batch_name
  ```
- **Outputs**:
  - Full-resolution variants & review comparison crops will be written to:
    `_marketing/social_media/<batch_name>/` and `_pipeline_io/outputs/social/<batch_name>/`.
