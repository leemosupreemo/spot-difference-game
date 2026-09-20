"""Local-only second-pass triage. Recommendations do not authorize edits.

Structural gate failures describe the existing engine, not image semantics.
Assess actual pixels/masks before choosing any recommended method. Unknown
failures and source-quality failures never automatically enter a fallback.
"""

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path


class IngestRejection(ValueError):
    def __init__(self, message, stage, reasons):
        super().__init__(message)
        self.stage = stage
        self.reasons = tuple(str(reason) for reason in reasons)


def classify_rejection(reasons):
    categories = set()
    for reason in reasons:
        code = reason.split(":", 1)[0]
        if code in {"ObjectCountReject", "EditableTargetReject", "PeerGroupReject",
                    "StructuralAffordanceReject", "NoStructuralCandidate",
                    # The local gate scores recolor affordance too, so an image
                    # can clear it and still leave the structural-only operation
                    # queue empty. That is a structural limit, not a bad source.
                    "NoAllowedOperation"}:
            categories.add("structural_limit")
        elif code in {"SharpnessUniformityReject", "EdgeDensityReject", "HeroObjectReject"}:
            categories.add("source_quality")
        elif code in {"Not found", "NormalizationCropExceeded", "PairDimensionMismatch"}:
            categories.add("input_error")
        elif code == "LocalGateReject":
            # Compatibility with the router's legacy early-exit strings.
            if "Too few objects (" in reason or "FastSAM found no objects." in reason:
                categories.add("structural_limit")
            elif any(marker in reason for marker in (
                "Shallow depth-of-field", "Low texture / plain background", "Hero foreground object"
            )):
                categories.add("source_quality")
            elif "Failed to read image file." in reason:
                categories.add("input_error")
            else:
                categories.add("unknown")
        else:
            categories.add("unknown")

    category = next((name for name in ("input_error", "source_quality", "unknown", "structural_limit")
                     if name in categories), "unknown")
    next_step = {"input_error": "repair_input", "source_quality": "review_source",
                 "unknown": "inspect_failure", "structural_limit": "assess_local_targets"}[category]
    # Every image that still has a usable normalized master gets a second pass.
    # An input error does not: there is nothing decoded to edit. `next_step`
    # stays the recommendation for the human -- a source-quality reject is still
    # worth reviewing even when a local edit happens to pass its checks.
    routes = category != "input_error"
    return {
        "category": category,
        "next_step": next_step,
        "routes_to_fallback": routes,
        "candidate_methods": ["star_blob", "segmented_edit", "texture_inpaint"] if routes else [],
        "automatic_retry": routes,
    }


def rejection_record(source, scene_id, count, difficulty, exception):
    if hasattr(exception, "reasons"):
        reasons = list(exception.reasons)
    elif isinstance(exception, ValueError):
        # Gate, normalizer, and structural messages already carry a code.
        reasons = [str(exception)]
    else:
        # An unexpected crash carries no classified code. Keep its type visible
        # so the report names something to inspect instead of an empty reason,
        # and so it can never be mistaken for a structural limit.
        reasons = [f"{type(exception).__name__}: {exception}"]
    return {
        "source": str(Path(source).resolve()),
        "scene_id": scene_id,
        "requested_variants": count,
        "difficulty": difficulty,
        "status": "rejected",
        "stage": getattr(exception, "stage", "ingest"),
        "reasons": reasons,
        "fallback": classify_rejection(reasons),
    }


def write_ingest_report(path, records):
    """Atomic report write; no image arrays or temporary file dependencies."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schema_version": 2, "generated_at": datetime.now(timezone.utc).isoformat(),
               "images": records}
    fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
