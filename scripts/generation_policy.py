from dataclasses import dataclass


KNOWN_OPERATIONS = frozenset({"recolor", "add", "remove", "reorder"})


@dataclass(frozen=True)
class GenerationPolicy:
    name: str
    allowed_operations: tuple[str, ...]
    allow_operation_fallback: bool
    max_candidates_per_operation: int
    selection_mode: str
    refine_structural_masks: bool

    def __post_init__(self):
        unknown = set(self.allowed_operations) - KNOWN_OPERATIONS
        if unknown:
            raise ValueError(f"Unknown operations: {sorted(unknown)}")
        if not self.allowed_operations:
            raise ValueError("allowed_operations must not be empty")
        if self.selection_mode not in {"first_pass", "best_score"}:
            raise ValueError(f"Unknown selection mode: {self.selection_mode}")
        if self.max_candidates_per_operation < 1:
            raise ValueError("max_candidates_per_operation must be positive")


MIXED_GENERATION_POLICY = GenerationPolicy(
    name="mixed",
    allowed_operations=("recolor", "add", "remove", "reorder"),
    allow_operation_fallback=True,
    max_candidates_per_operation=6,
    selection_mode="first_pass",
    refine_structural_masks=False,
)


STRUCTURAL_ONLY_POLICY = GenerationPolicy(
    name="structural_only",
    allowed_operations=("add", "remove", "reorder"),
    allow_operation_fallback=True,
    max_candidates_per_operation=12,
    selection_mode="best_score",
    refine_structural_masks=True,
)
