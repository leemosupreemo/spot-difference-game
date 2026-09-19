"""Dimensions and local quality-gate thresholds for base-image ingest."""

from dataclasses import dataclass


@dataclass(frozen=True)
class BaseGenerationPolicy:
    master_size: tuple[int, int] = (1536, 1152)
    production_size: tuple[int, int] = (1200, 900)
    max_normalization_crop_fraction: float = 0.005
    min_detected_objects: int = 18
    min_editable_targets: int = 8
    min_peer_groups: int = 2
    min_structural_affordance: float = 0.45
    min_sharpness_uniformity: float = 0.25
    min_edge_density: float = 0.02
    max_foreground_object_fraction: float = 0.22


DEFAULT_BASE_GENERATION_POLICY = BaseGenerationPolicy()
