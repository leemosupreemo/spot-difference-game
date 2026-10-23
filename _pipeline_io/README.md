# Diff Hunter Pipeline I/O Directory

Centralized workspace for input staging and output inspection across the 3 variant generation pipelines.

## Folder Organization

```
_pipeline_io/
├── inputs/
│   ├── social/     # Drop base images for Social Media campaigns (2:3 or 4:5 portrait)
│   ├── daily/      # Drop base images for Daily Challenges (batches of 3, 4:3 landscape)
│   └── regular/    # Drop base images for Regular Photography Sets (batches of 5, 4:3 landscape)
│
└── outputs/
    ├── social/     # Marketing batches, review comparison crops & manifests
    ├── daily/      # Daily challenge preview crops & set manifests
    └── regular/    # Regular set preview crops & set manifests
```

## Quick Commands

```bash
# Check status of input folders & pending review queues:
python3 scripts/run_pipelines.py status

# 1. Process images in inputs/social/ (or fallback to stock/ai):
python3 scripts/run_pipelines.py social --batch-name my_new_batch

# 2. Process images in inputs/daily/ (batch of 3):
python3 scripts/run_pipelines.py daily

# 3. Process images in inputs/regular/ (batch of 5):
python3 scripts/run_pipelines.py regular
```
