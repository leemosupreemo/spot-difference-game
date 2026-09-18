"""Semantic visual critic adapters.

A cost-balanced vision model judges each locally-passing candidate for
photorealism, object integrity, scene coherence, visual fun, and
composition, returning a single versioned JSON schema regardless of
provider so mixed runs can be judged by one consistently recorded critic.
"""

import base64
import json
from typing import Protocol

from base_generation_types import RunConfig, SceneBrief, VisualCriticResult

CRITIC_SCHEMA_VERSION = "1"
REQUIRED_CRITIC_KEYS = {
    "photorealism",
    "object_integrity",
    "scene_coherence",
    "visual_fun",
    "composition",
    "artifact_flags",
    "tags",
    "reason",
}
_NUMERIC_FIELDS = (
    "photorealism",
    "object_integrity",
    "scene_coherence",
    "visual_fun",
    "composition",
)
_LIST_FIELDS = ("artifact_flags", "tags")


class VisualCritic(Protocol):
    def evaluate(self, image_path: str, brief: SceneBrief) -> VisualCriticResult: ...


class CriticSchemaError(ValueError):
    """Raised when a critic response omits keys, has out-of-range scores,
    or contains non-string list entries."""


def resolve_critic_mode(run_config: RunConfig) -> str:
    """Resolve which critic provider judges a run.

    Explicit `critic_mode` always wins. In "auto", a provider-only run uses
    that same provider so no credentials for the unselected provider are
    ever required; a mixed run resolves to one fixed, explicitly recorded
    provider ("google") so every candidate in that run is judged by the
    same critic.
    """
    if run_config.critic_mode in ("google", "openai"):
        return run_config.critic_mode

    if run_config.provider_mode in ("google", "openai"):
        return run_config.provider_mode

    return "google"


def _critic_prompt(brief: SceneBrief) -> str:
    return (
        "You are a strict photorealism and editability critic for a hidden-object "
        "puzzle base image. Judge the attached photograph of "
        f"'{brief.setting}'. Score photorealism, object_integrity, scene_coherence, "
        "visual_fun, and composition each from 0 to 10. Flag any malformed objects, "
        "duplicated fragments, impossible geometry, inconsistent shadows, fake "
        "readable text, logos, watermarks, or illustrated/CGI style in "
        "artifact_flags. List short descriptive diversity tags. Give a concise "
        "reason only when rejecting. Respond with a single JSON object containing "
        f"exactly these keys: {sorted(REQUIRED_CRITIC_KEYS)}."
    )


def _parse_structured_response(raw_text: str, provider: str, model: str) -> VisualCriticResult:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise CriticSchemaError(f"critic response was not valid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise CriticSchemaError("critic response must be a JSON object")

    missing = REQUIRED_CRITIC_KEYS - payload.keys()
    if missing:
        raise CriticSchemaError(f"critic response missing keys: {sorted(missing)}")

    for field_name in _NUMERIC_FIELDS:
        value = payload[field_name]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise CriticSchemaError(f"critic field {field_name!r} must be numeric")
        if not (0.0 <= float(value) <= 10.0):
            raise CriticSchemaError(f"critic field {field_name!r} out of range 0-10: {value!r}")

    for field_name in _LIST_FIELDS:
        values = payload[field_name]
        if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
            raise CriticSchemaError(f"critic field {field_name!r} must be a list of strings")

    reason = payload["reason"]
    if reason is not None and not isinstance(reason, str):
        raise CriticSchemaError("critic field 'reason' must be a string or null")

    return VisualCriticResult(
        provider=provider,
        model=model,
        photorealism=float(payload["photorealism"]),
        object_integrity=float(payload["object_integrity"]),
        scene_coherence=float(payload["scene_coherence"]),
        visual_fun=float(payload["visual_fun"]),
        composition=float(payload["composition"]),
        artifact_flags=tuple(payload["artifact_flags"]),
        diversity_tags=tuple(payload["tags"]),
        rejection_reason=reason,
    )


class FakeVisualCritic:
    """Test/offline double implementing the VisualCritic protocol."""

    def __init__(
        self,
        photorealism: float = 9.0,
        object_integrity: float = 9.0,
        scene_coherence: float = 8.0,
        visual_fun: float = 7.0,
        composition: float = 7.0,
        artifact_flags=(),
        diversity_tags=(),
        rejection_reason=None,
        provider: str = "fake",
        model: str = "fake-critic",
    ):
        self._result = VisualCriticResult(
            provider=provider,
            model=model,
            photorealism=photorealism,
            object_integrity=object_integrity,
            scene_coherence=scene_coherence,
            visual_fun=visual_fun,
            composition=composition,
            artifact_flags=tuple(artifact_flags),
            diversity_tags=tuple(diversity_tags),
            rejection_reason=rejection_reason,
        )

    def evaluate(self, image_path: str, brief: SceneBrief) -> VisualCriticResult:
        return self._result


def _read_image_b64(image_path: str) -> str:
    with open(image_path, "rb") as handle:
        return base64.b64encode(handle.read()).decode("ascii")


class OpenAIVisualCritic:
    def __init__(self, credential, client=None, model: str | None = None):
        self._credential = credential
        self._client = client
        self._model = model or "gpt-5.6-luna"

    def _build_client(self):
        from openai import OpenAI  # lazy import; only needed for real API calls

        return OpenAI(api_key=self._credential.value)

    def evaluate(self, image_path: str, brief: SceneBrief) -> VisualCriticResult:
        client = self._client or self._build_client()
        image_b64 = _read_image_b64(image_path)
        response = client.responses.create(
            model=self._model,
            reasoning={"effort": "none"},
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": _critic_prompt(brief)},
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{image_b64}",
                            "detail": "high",
                        },
                    ],
                }
            ],
            text={"format": {"type": "json_object"}},
        )
        return _parse_structured_response(response.output_text, "openai", self._model)


class GoogleVisualCritic:
    def __init__(self, credential, client=None, model: str | None = None):
        self._credential = credential
        self._client = client
        self._model = model or "gemini-3.1-flash-lite"

    def _build_client(self):
        from google import genai  # lazy import; only needed for real API calls

        return genai.Client(credentials=self._credential.value)

    def evaluate(self, image_path: str, brief: SceneBrief) -> VisualCriticResult:
        client = self._client or self._build_client()
        image_b64 = _read_image_b64(image_path)
        response = client.interactions.create(
            model=self._model,
            thinking={"enabled": False},
            input=[
                {"type": "text", "text": _critic_prompt(brief)},
                # Google has no explicit image-detail parameter; sending the full-resolution
                # image bytes is its documented equivalent of "high detail" (see ledger ruling).
                {"type": "image", "mime_type": "image/png", "data": image_b64},
            ],
            response_format={"type": "json_object"},
        )
        return _parse_structured_response(response.output_text, "google", self._model)
