"""Shared immutable data contracts for the base-image ingest pipeline.

These dataclasses are the interface boundary between normalization,
local quality gating, structural pair generation, and publication.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedCandidate:
    scene_brief_id: str
    provider: str
    model: str
    request_id: str
    master_path: str
    size: tuple[int, int]
    normalization_crop_fraction: float
    seed: int = 0


@dataclass(frozen=True)
class FinalizedPair:
    scene_brief_id: str
    base_path: str
    variant_path: str
    dimensions: tuple[int, int]
    aspect_ratio: str
    manifest_id: str
