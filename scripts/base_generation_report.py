"""JSON and HTML reports for a completed or in-progress generation run.

Both reports are built entirely from the run's ledger (`RunStore`), so a
report always reflects exactly what was persisted — no report field can
claim something the ledger does not also record.
"""

import html
import json
from pathlib import Path


def _atomic_write_text(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(text, encoding="utf-8")
    tmp_path.replace(path)
    return path


def _report_payload(run) -> dict:
    items = []
    for item_id, record in sorted(run.all_items().items()):
        items.append({"item_id": item_id, "state": record["state"], "data": record["data"]})
    return {
        "run_id": run.run_id,
        "config": run.config,
        "plan": run.plan_ids,
        "items": items,
    }


def write_json_report(run) -> Path:
    payload = _report_payload(run)
    text = json.dumps(payload, indent=2)
    return _atomic_write_text(run.run_dir / "report.json", text)


def _item_row_html(item_id: str, record: dict) -> str:
    data = record.get("data", {})
    state = record["state"]
    master_path = data.get("master_path")
    provider = data.get("provider", "")
    model = data.get("model", "")
    rejection_reason = data.get("rejection_reason")
    score_fields = (
        "photorealism",
        "object_integrity",
        "scene_coherence",
        "visual_fun",
        "composition",
        "novelty_score",
        "rank_score",
    )
    scores = {field: data[field] for field in score_fields if field in data}

    thumbnail_html = (
        f'<img class="thumb" src="{html.escape(master_path)}" alt="{html.escape(item_id)}">'
        if master_path
        else '<div class="thumb placeholder"></div>'
    )
    scores_html = "".join(
        f"<li>{html.escape(name)}: {html.escape(str(value))}</li>" for name, value in scores.items()
    )
    reason_html = (
        f'<p class="rejection-reason">{html.escape(rejection_reason)}</p>'
        if rejection_reason
        else ""
    )

    return f"""
    <div class="candidate-card state-{html.escape(state)}">
      {thumbnail_html}
      <h3>{html.escape(item_id)}</h3>
      <p>{html.escape(provider)} / {html.escape(model)}</p>
      <p class="state">{html.escape(state)}</p>
      <ul class="scores">{scores_html}</ul>
      {reason_html}
    </div>
    """


def write_html_report(run) -> Path:
    cards = "".join(
        _item_row_html(item_id, record) for item_id, record in sorted(run.all_items().items())
    )
    html_document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Base generation report: {html.escape(run.run_id)}</title>
<style>
  body {{ font-family: sans-serif; background: #111; color: #eee; }}
  .grid {{ display: flex; flex-wrap: wrap; gap: 12px; }}
  .candidate-card {{ width: 220px; border: 1px solid #333; padding: 8px; }}
  .thumb {{ width: 100%; height: auto; display: block; }}
  .thumb.placeholder {{ height: 120px; background: #333; }}
  .rejection-reason {{ color: #f88; }}
</style>
</head>
<body>
  <h1>Base generation report: {html.escape(run.run_id)}</h1>
  <div class="grid">
    {cards}
  </div>
</body>
</html>
"""
    return _atomic_write_text(run.run_dir / "report.html", html_document)
