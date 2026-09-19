"""Local, free computer-vision gates for a normalized base-image candidate.

These checks (sharpness uniformity, edge density, object count, editable-
target count, peer-group count, hero-object suppression, structural
affordance) catch technical defects before an image is handed to the
structural difference pipeline. There is no paid semantic critic here --
a manually-supplied image has already been judged by a human.
"""

from typing import Callable, Optional


def _default_route_canvas(image_path: str) -> dict:
    from scene_affordance_router import SceneAffordanceRouter  # lazy: heavy CV deps

    return SceneAffordanceRouter.evaluate_and_route_canvas(image_path)


def run_local_gates(
    master_path: str, policy, route_canvas: Optional[Callable[[str], dict]] = None
):
    """Run local technical gates on a normalized master image.

    Returns (passed: bool, failures: tuple[str, ...], route_result: dict).
    """
    route_canvas = route_canvas or _default_route_canvas
    route_result = route_canvas(master_path)

    if not route_result.get("approved", False):
        reason = route_result.get("reason", "local gate rejected the image")
        return False, (f"LocalGateReject: {reason}",), route_result

    metrics = route_result.get("metrics", {})
    failures = []

    checks = (
        (
            metrics.get("sharpness_uniformity", 0.0) < policy.min_sharpness_uniformity,
            "SharpnessUniformityReject",
            f"sharpness_uniformity {metrics.get('sharpness_uniformity')} below "
            f"{policy.min_sharpness_uniformity}",
        ),
        (
            metrics.get("edge_density", 0.0) < policy.min_edge_density,
            "EdgeDensityReject",
            f"edge_density {metrics.get('edge_density')} below {policy.min_edge_density}",
        ),
        (
            route_result.get("object_count", 0) < policy.min_detected_objects,
            "ObjectCountReject",
            f"object_count {route_result.get('object_count')} below "
            f"{policy.min_detected_objects}",
        ),
        (
            route_result.get("candidate_count", 0) < policy.min_editable_targets,
            "EditableTargetReject",
            f"candidate_count {route_result.get('candidate_count')} below "
            f"{policy.min_editable_targets}",
        ),
        (
            route_result.get("peer_group_count", 0) < policy.min_peer_groups,
            "PeerGroupReject",
            f"peer_group_count {route_result.get('peer_group_count')} below "
            f"{policy.min_peer_groups}",
        ),
        (
            metrics.get("largest_foreground_pct", 0.0)
            > policy.max_foreground_object_fraction * 100,
            "HeroObjectReject",
            f"largest_foreground_pct {metrics.get('largest_foreground_pct')} above "
            f"{policy.max_foreground_object_fraction * 100}",
        ),
        (
            max(route_result.get("affordances", {}).values(), default=0.0)
            < policy.min_structural_affordance,
            "StructuralAffordanceReject",
            f"no structural affordance reached {policy.min_structural_affordance}",
        ),
    )

    for failed, code, message in checks:
        if failed:
            failures.append(f"{code}: {message}")

    return not failures, tuple(failures), route_result
