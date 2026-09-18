"""Deterministic prompt construction from structured scene briefs."""

from base_generation_types import SceneBrief

PROMPT_VERSION = "1.0.0"


def compose_prompt(brief: SceneBrief, policy) -> str:
    low, high = brief.density_target
    camera_angle = getattr(brief, "camera_angle", "") or "three-quarter overhead"
    composition = getattr(brief, "composition", "") or "rule-of-thirds cluster"
    lighting_temperature = getattr(brief, "lighting_temperature", "") or "neutral daylight"

    clauses = [
        f"Documentary photorealistic {camera_angle} photograph of {brief.setting}, "
        f"with a {composition} composition under {lighting_temperature} lighting.",
        f"Show {low} to {high} visible physical objects.",
        f"Include coherent, naturally varied families: {', '.join(brief.object_families)}.",
        f"Objects are made from materials such as {', '.join(brief.materials)}.",
        "Include repeated groups of three to eight loose objects, small local gaps, "
        "and recoverable surfaces near movable objects.",
        "Deep depth of field with edge-to-edge useful focus, natural wear, minor "
        "imperfections, realistic contact shadows, and plausible object geometry.",
        "No dominant hero object and no large empty region.",
        "No people, hands, faces, brands, logos, watermarks, or readable text.",
        "Documentary photographic realism, not illustration, CGI, or styled product photography.",
        "Exact 4:3 landscape framing with no later crop.",
    ]
    return " ".join(clauses)
