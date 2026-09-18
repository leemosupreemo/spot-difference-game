"""Scene catalog loading, validation, and diversity-aware batch scheduling."""

import json
import math
import random
from dataclasses import dataclass

from base_generation_types import SceneBrief

VALID_SCENE_FAMILIES = ("collection", "activity", "playful")
VALID_OPERATIONS = ("add", "remove", "reorder", "recolor")
MIN_OBJECT_FAMILIES = 4
MIN_MATERIALS = 3
DENSITY_FLOOR = 35
DENSITY_CEILING = 80


@dataclass(frozen=True)
class ScheduledSceneBrief(SceneBrief):
    """A SceneBrief extended with the camera/lighting rotation fields the
    scheduler and prompt composer need. Subclassing keeps Task 1's SceneBrief
    contract unchanged while still satisfying `isinstance(x, SceneBrief)`."""

    camera_angle: str = ""
    composition: str = ""
    lighting_temperature: str = ""


def _brief_from_entry(entry: dict) -> ScheduledSceneBrief:
    return ScheduledSceneBrief(
        id=entry.get("id", ""),
        scene_family=entry.get("scene_family", ""),
        domain=entry.get("domain", ""),
        setting=entry.get("setting", ""),
        object_families=tuple(entry.get("object_families", [])),
        materials=tuple(entry.get("materials", [])),
        layout=entry.get("layout", ""),
        palette=entry.get("palette", ""),
        density_target=tuple(entry.get("density_target", (0, 0))),
        desired_operations=tuple(entry.get("desired_operations", [])),
        camera_angle=entry.get("camera_angle", ""),
        composition=entry.get("composition", ""),
        lighting_temperature=entry.get("lighting_temperature", ""),
    )


def load_scene_catalog(path: str) -> list[SceneBrief]:
    with open(path, "r", encoding="utf-8") as handle:
        raw_entries = json.load(handle)
    return [_brief_from_entry(entry) for entry in raw_entries]


def validate_scene_catalog(briefs: list[SceneBrief]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_family_tuples: set[tuple[str, ...]] = set()

    for brief in briefs:
        label = brief.id or "<missing id>"

        if not brief.id:
            errors.append("brief is missing an id")
        elif brief.id in seen_ids:
            errors.append(f"{label}: duplicate id")
        seen_ids.add(brief.id)

        if brief.scene_family not in VALID_SCENE_FAMILIES:
            errors.append(f"{label}: invalid scene_family {brief.scene_family!r}")

        if not brief.domain:
            errors.append(f"{label}: missing domain")
        if not brief.setting:
            errors.append(f"{label}: missing setting")
        if not brief.layout:
            errors.append(f"{label}: missing layout")
        if not brief.palette:
            errors.append(f"{label}: missing palette")

        if len(brief.object_families) < MIN_OBJECT_FAMILIES:
            errors.append(
                f"{label}: needs at least {MIN_OBJECT_FAMILIES} object families, "
                f"got {len(brief.object_families)}"
            )
        else:
            family_key = tuple(sorted(brief.object_families))
            if family_key in seen_family_tuples:
                errors.append(f"{label}: duplicate object-family tuple {family_key}")
            seen_family_tuples.add(family_key)

        if len(brief.materials) < MIN_MATERIALS:
            errors.append(
                f"{label}: needs at least {MIN_MATERIALS} material tags, "
                f"got {len(brief.materials)}"
            )

        if len(brief.density_target) != 2:
            errors.append(f"{label}: density_target must have exactly two bounds")
        else:
            low, high = brief.density_target
            if not (DENSITY_FLOOR <= low <= high <= DENSITY_CEILING):
                errors.append(
                    f"{label}: density_target {brief.density_target} outside "
                    f"[{DENSITY_FLOOR}, {DENSITY_CEILING}]"
                )

        if not brief.desired_operations:
            errors.append(f"{label}: missing desired_operations")
        else:
            unknown_ops = sorted(set(brief.desired_operations) - set(VALID_OPERATIONS))
            if unknown_ops:
                errors.append(f"{label}: unknown operations {unknown_ops}")

        if isinstance(brief, ScheduledSceneBrief):
            if not brief.camera_angle:
                errors.append(f"{label}: missing camera_angle")
            if not brief.composition:
                errors.append(f"{label}: missing composition")
            if not brief.lighting_temperature:
                errors.append(f"{label}: missing lighting_temperature")

    return errors


def _recent_ids(history) -> set[str]:
    ids: set[str] = set()
    for entry in history or ():
        if isinstance(entry, dict):
            entry_id = entry.get("id")
        else:
            entry_id = getattr(entry, "id", entry)
        if entry_id:
            ids.add(entry_id)
    return ids


def _diversity_cap(count: int) -> int:
    return max(1, math.ceil(count * 0.25))


def build_batch_plan(briefs: list[SceneBrief], history, config, policy) -> list[SceneBrief]:
    """Select a diverse, quota-balanced, history-aware batch of briefs."""
    quotas = policy.portfolio_counts(config.count)
    cap = _diversity_cap(config.count)
    excluded_ids = _recent_ids(history)

    by_family: dict[str, list[SceneBrief]] = {family: [] for family in VALID_SCENE_FAMILIES}
    for brief in briefs:
        by_family.setdefault(brief.scene_family, []).append(brief)

    rng = random.Random(config.seed)

    domain_counts: dict[str, int] = {}
    layout_counts: dict[str, int] = {}
    palette_counts: dict[str, int] = {}
    material_counts: dict[str, int] = {}

    def within_caps(brief: SceneBrief) -> bool:
        if domain_counts.get(brief.domain, 0) >= cap:
            return False
        if layout_counts.get(brief.layout, 0) >= cap:
            return False
        if palette_counts.get(brief.palette, 0) >= cap:
            return False
        if any(material_counts.get(material, 0) >= cap for material in brief.materials):
            return False
        return True

    def record(brief: SceneBrief) -> None:
        domain_counts[brief.domain] = domain_counts.get(brief.domain, 0) + 1
        layout_counts[brief.layout] = layout_counts.get(brief.layout, 0) + 1
        palette_counts[brief.palette] = palette_counts.get(brief.palette, 0) + 1
        for material in brief.materials:
            material_counts[material] = material_counts.get(material, 0) + 1

    selected: list[SceneBrief] = []
    for family in VALID_SCENE_FAMILIES:
        quota = quotas.get(family, 0)
        if quota <= 0:
            continue

        pool = list(by_family.get(family, ()))
        rng.shuffle(pool)

        fresh_pool = [brief for brief in pool if brief.id not in excluded_ids]
        ordered_pool = fresh_pool + [brief for brief in pool if brief.id in excluded_ids]

        chosen: list[SceneBrief] = []

        for brief in ordered_pool:
            if len(chosen) == quota:
                break
            if within_caps(brief):
                chosen.append(brief)
                record(brief)

        if len(chosen) < quota:
            remaining = [brief for brief in ordered_pool if brief not in chosen]
            for brief in remaining:
                if len(chosen) == quota:
                    break
                chosen.append(brief)
                record(brief)

        selected.extend(chosen)

    return selected
