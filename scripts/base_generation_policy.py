"""Quotas, thresholds, dimensions, and validation for managed base-image generation."""

import math
from dataclasses import dataclass

from base_generation_types import RunConfig

VALID_PROVIDER_MODES = ("mixed", "google", "openai")
VALID_CRITIC_MODES = ("auto", "google", "openai")

_PORTFOLIO_SHARES = (
    ("collection", 0.4),
    ("activity", 0.4),
    ("playful", 0.2),
)


@dataclass(frozen=True)
class BaseGenerationPolicy:
    master_size: tuple[int, int] = (1536, 1152)
    production_size: tuple[int, int] = (1200, 900)
    max_normalization_crop_fraction: float = 0.005
    max_candidates_per_brief: int = 4
    max_images_per_default_batch: int = 40
    min_detected_objects: int = 18
    min_editable_targets: int = 8
    min_peer_groups: int = 2
    min_structural_affordance: float = 0.45
    min_photorealism: float = 8.0
    min_object_integrity: float = 8.0

    def portfolio_counts(self, count: int) -> dict[str, int]:
        """Largest-remainder allocation of the 40/40/20 portfolio split."""
        exact = {name: share * count for name, share in _PORTFOLIO_SHARES}
        floors = {name: math.floor(value) for name, value in exact.items()}
        remainder = count - sum(floors.values())

        by_fraction_desc = sorted(
            (name for name, _ in _PORTFOLIO_SHARES),
            key=lambda name: exact[name] - floors[name],
            reverse=True,
        )

        counts = dict(floors)
        for name in by_fraction_desc[:remainder]:
            counts[name] += 1
        return counts

    def max_images_for_count(self, count: int) -> int:
        """Proportional generation-image ceiling for a non-default batch count."""
        ratio = self.max_images_per_default_batch / 10
        return math.ceil(count * ratio)


DEFAULT_BASE_GENERATION_POLICY = BaseGenerationPolicy()


def validate_run_config(config: RunConfig, policy: BaseGenerationPolicy) -> None:
    """Validate a run configuration against policy. Raises ValueError on any violation."""
    errors: list[str] = []

    if config.count < 1:
        errors.append(f"count must be at least 1, got {config.count}")

    if config.provider_mode not in VALID_PROVIDER_MODES:
        errors.append(
            f"provider_mode must be one of {VALID_PROVIDER_MODES}, got {config.provider_mode!r}"
        )

    if config.critic_mode not in VALID_CRITIC_MODES:
        errors.append(
            f"critic_mode must be one of {VALID_CRITIC_MODES}, got {config.critic_mode!r}"
        )

    if config.count >= 1:
        ceiling = policy.max_images_for_count(config.count)
        if config.max_images > ceiling:
            errors.append(
                f"max_images {config.max_images} exceeds the policy ceiling of "
                f"{ceiling} for count {config.count}"
            )

    if errors:
        raise ValueError("; ".join(errors))
