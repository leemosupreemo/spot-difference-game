"""Compact shorthand for how a level was produced and what it changes.

The level id is a durable external handle -- it is embedded in shared challenge
URLs and keys curation decisions -- so production facts never go in it. They go
here, derived from the manifest's own `generationMethod` and `operation` fields
so this label can never contradict them.

Format: <METHOD>-<OPERATION>, e.g. STR-ADD, LST-CLR, LSG-CLR.
Unknown parts render as ??? rather than guessing, so gaps stay visible.
"""

UNKNOWN = "???"

METHOD_CODES = {
    "structural": "STR",
    "local_star": "LST",
    "local_segmented": "LSG",
}

# "move" in review shorthand is the pipeline's "reorder"; one vocabulary, two names.
OPERATION_CODES = {
    "add": "ADD",
    "remove": "REM",
    "reorder": "MOV",
    "recolor": "CLR",
}


def method_code(method):
    if not method:
        return UNKNOWN
    return METHOD_CODES.get(str(method).strip().lower(), UNKNOWN)


def operation_code(operation):
    if not operation:
        return UNKNOWN
    return OPERATION_CODES.get(str(operation).strip().lower(), UNKNOWN)


def variant_code(entry):
    """`<METHOD>-<OPERATION>` for a manifest entry (or any mapping with those keys).

    A missing `generationMethod` defaults to structural only when an operation
    is present, because every pre-fallback level came from that pipeline; with
    neither field the code is fully unknown rather than a confident guess.
    """
    if not isinstance(entry, dict):
        return f"{UNKNOWN}-{UNKNOWN}"
    operation = entry.get("operation")
    method = entry.get("generationMethod")
    if not method and operation:
        method = "structural"
    return f"{method_code(method)}-{operation_code(operation)}"


def is_complete(code):
    """True when neither half is unknown."""
    return isinstance(code, str) and UNKNOWN not in code
