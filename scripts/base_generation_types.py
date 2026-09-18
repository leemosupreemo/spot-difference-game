"""Shared immutable data contracts for the managed base-image generation pipeline.

These dataclasses are the interface boundary between the scene catalog,
providers, evaluators, orchestration, and finalization stages. They carry no
credentials and no provider SDK objects.
"""

from dataclasses import asdict, dataclass, field
from typing import Optional


@dataclass(frozen=True)
class SceneBrief:
    id: str
    scene_family: str
    domain: str
    setting: str
    object_families: tuple[str, ...]
    materials: tuple[str, ...]
    layout: str
    palette: str
    density_target: tuple[int, int]
    desired_operations: tuple[str, ...]


@dataclass(frozen=True)
class RunConfig:
    count: int = 10
    provider_mode: str = "mixed"
    critic_mode: str = "auto"
    portfolio_preset: str = "balanced_40_40_20"
    quality_preset: str = "production"
    seed: int = 0
    max_images: int = 40
    max_spend_usd: Optional[float] = None
    keep_rejected: bool = False
    allow_provider_fallback: bool = False
    staging_root: str = ".base-generation/runs"
    execution_mode: str = "dry_run"

    def to_public_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class ProviderRequest:
    provider: str
    model: str
    prompt: str
    scene_brief_id: str
    size: tuple[int, int]
    provider_options: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderImage:
    provider: str
    model: str
    request_id: str
    native_size: tuple[int, int]
    image_bytes: bytes
    content_type: str = "image/png"


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
class VisualCriticResult:
    provider: str
    model: str
    photorealism: float
    object_integrity: float
    scene_coherence: float
    visual_fun: float
    composition: float
    artifact_flags: tuple[str, ...] = ()
    diversity_tags: tuple[str, ...] = ()
    rejection_reason: Optional[str] = None


@dataclass(frozen=True)
class CandidateEvaluation:
    candidate: NormalizedCandidate
    passed_local_gates: bool
    local_gate_failures: tuple[str, ...]
    critic: Optional[VisualCriticResult]
    novelty_score: Optional[float]
    rank_score: Optional[float]
    accepted: bool
    rejection_reason: Optional[str] = None


@dataclass(frozen=True)
class FinalizedPair:
    scene_brief_id: str
    base_path: str
    variant_path: str
    dimensions: tuple[int, int]
    aspect_ratio: str
    manifest_id: str
