"""Atomic, resumable run ledger and accepted-scene history.

A run directory holds an immutable `run.json` snapshot (config + selected
plan) written once at creation, and an append-only `events.jsonl` state-
transition log. Resuming a run replays `events.jsonl` to reconstruct each
item's current state so completed work is never regenerated.

`AcceptedHistoryStore` is a separate, cross-run append-only log of
successfully published scenes, used for portfolio novelty comparisons.
"""

import json
import os
import time
import uuid
from pathlib import Path
from typing import Optional

RUN_ROOT_DEFAULT = ".base-generation/runs"
HISTORY_PATH_DEFAULT = ".base-generation/history/accepted.jsonl"

VALID_STATES = (
    "planned",
    "generating",
    "generated",
    "normalized",
    "locally_rejected",
    "critic_rejected",
    "novelty_rejected",
    "passing",
    "selected",
    "structural_failed",
    "finalized",
    "published",
)

# Each state's set of legal next states. Absent/empty means terminal.
ALLOWED_TRANSITIONS = {
    "planned": {"generating"},
    "generating": {"generated"},
    "generated": {"normalized"},
    "normalized": {"locally_rejected", "critic_rejected", "novelty_rejected", "passing"},
    "locally_rejected": set(),
    "critic_rejected": set(),
    "novelty_rejected": set(),
    "passing": {"selected"},
    "selected": {"structural_failed", "finalized"},
    "structural_failed": set(),
    "finalized": {"published"},
    "published": set(),
}

# Local-gate, critic, and novelty rejection codes map to one terminal ledger state,
# per the Task 5 -> Task 6 interface ruling ("a rejection code maps to one terminal
# rejection state").
_LOCAL_GATE_CODES = {
    "LocalGateReject",
    "SharpnessUniformityReject",
    "EdgeDensityReject",
    "ObjectCountReject",
    "EditableTargetReject",
    "PeerGroupReject",
    "HeroObjectReject",
    "StructuralAffordanceReject",
}
_CRITIC_CODES = {"PhotorealismReject", "ObjectIntegrityReject", "ArtifactFlagged"}
_NOVELTY_CODES = {"PerceptualDuplicateReject"}


def ledger_state_for_rejection_code(code: Optional[str]) -> str:
    if code in _CRITIC_CODES:
        return "critic_rejected"
    if code in _NOVELTY_CODES:
        return "novelty_rejected"
    return "locally_rejected"


def _atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(path.name + ".tmp")
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp_path, path)


def _default_run_id(clock) -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(clock())) + "-" + uuid.uuid4().hex[:8]


class RunStore:
    """A single run's atomic ledger: an immutable snapshot plus an append-only
    state-transition event log."""

    def __init__(self, run_dir: Path, run_id: str, config: dict, plan_ids: list, items: dict):
        self.run_dir = Path(run_dir)
        self.run_id = run_id
        self.config = config
        self.plan_ids = list(plan_ids)
        self._items = items

    @property
    def _events_path(self) -> Path:
        return self.run_dir / "events.jsonl"

    @property
    def _run_json_path(self) -> Path:
        return self.run_dir / "run.json"

    @classmethod
    def create(cls, config, plan, root: str = RUN_ROOT_DEFAULT, run_id: str = None, clock=time.time) -> "RunStore":
        run_id = run_id or _default_run_id(clock)
        run_dir = Path(root) / run_id
        run_record = {
            "run_id": run_id,
            "config": config.to_public_dict(),
            "plan": [brief.id for brief in plan],
        }
        _atomic_write_json(run_dir / "run.json", run_record)
        events_path = run_dir / "events.jsonl"
        events_path.touch(exist_ok=True)
        return cls(run_dir=run_dir, run_id=run_id, config=run_record["config"], plan_ids=run_record["plan"], items={})

    @classmethod
    def resume(cls, run_id: str, root: str = RUN_ROOT_DEFAULT) -> "RunStore":
        run_dir = Path(root) / run_id
        run_record = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        items: dict = {}
        events_path = run_dir / "events.jsonl"
        if events_path.exists():
            with open(events_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
            for index, raw_line in enumerate(lines):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    if index == len(lines) - 1:
                        continue  # tolerate a malformed final partial line
                    raise
                items[event["item_id"]] = {"state": event["state"], "data": event.get("data", {})}
        return cls(
            run_dir=run_dir,
            run_id=run_id,
            config=run_record["config"],
            plan_ids=run_record["plan"],
            items=items,
        )

    def transition(self, item_id: str, state: str, data: Optional[dict] = None) -> None:
        if state not in VALID_STATES:
            raise ValueError(f"unknown state {state!r}")

        current = self._items.get(item_id, {}).get("state")
        if current is None:
            if state != "planned":
                raise ValueError(
                    f"item {item_id!r} must start in 'planned' state, got {state!r}"
                )
        elif state not in ALLOWED_TRANSITIONS.get(current, set()):
            raise ValueError(f"illegal transition for {item_id!r}: {current!r} -> {state!r}")

        event = {"item_id": item_id, "state": state, "data": data or {}}
        self.run_dir.mkdir(parents=True, exist_ok=True)
        with open(self._events_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(event) + "\n")
            handle.flush()
            os.fsync(handle.fileno())

        self._items[item_id] = {"state": state, "data": data or {}}

    def state_of(self, item_id: str) -> Optional[str]:
        return self._items.get(item_id, {}).get("state")

    def data_of(self, item_id: str) -> dict:
        return self._items.get(item_id, {}).get("data", {})

    def item_ids_in_state(self, state: str) -> list:
        return [item_id for item_id, record in self._items.items() if record["state"] == state]

    def all_items(self) -> dict:
        return dict(self._items)


class AcceptedHistoryStore:
    """Append-only, cross-run log of accepted scenes for novelty comparisons."""

    def __init__(self, path: str = HISTORY_PATH_DEFAULT):
        self._path = Path(path)

    def append(self, record: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")
            handle.flush()
            os.fsync(handle.fileno())

    def recent(self, limit: int = 30) -> list:
        if not self._path.exists():
            return []
        with open(self._path, "r", encoding="utf-8") as handle:
            lines = handle.readlines()

        records = []
        for index, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                if index == len(lines) - 1:
                    continue  # tolerate a malformed final partial line from an interrupted append
                raise
        return records[-limit:]
