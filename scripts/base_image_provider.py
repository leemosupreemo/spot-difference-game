"""Image-generation provider adapters and canonical image normalization.

Both providers implement the same `ImageProvider.generate(request)` protocol
so tests, scheduling, and evaluation never depend on a specific SDK. Provider
clients are always accepted through dependency injection; a real SDK client
is only ever lazily imported when no client was injected, so offline tests
never touch network code.
"""

import base64
import io
from typing import Callable, Protocol

from PIL import Image

from base_generation_types import NormalizedCandidate, ProviderImage, ProviderRequest


class ImageProvider(Protocol):
    def generate(self, request: ProviderRequest) -> list[ProviderImage]: ...


class FakeImageProvider:
    """Test/offline double implementing the ImageProvider protocol."""

    def __init__(self, responder: Callable[[ProviderRequest], list[ProviderImage]]):
        self._responder = responder

    def generate(self, request: ProviderRequest) -> list[ProviderImage]:
        return self._responder(request)


def _decode_b64_images(response, provider: str, model: str) -> list[ProviderImage]:
    request_id = getattr(response, "id", "unknown")
    images = []
    for item in response.data:
        image_bytes = base64.b64decode(item.b64_json)
        with Image.open(io.BytesIO(image_bytes)) as decoded:
            native_size = decoded.size
        images.append(
            ProviderImage(
                provider=provider,
                model=model,
                request_id=request_id,
                native_size=native_size,
                image_bytes=image_bytes,
            )
        )
    return images


class OpenAIImageProvider:
    def __init__(self, credential, client=None, model: str = "gpt-image-2.5-sunburst"):
        self._credential = credential
        self._client = client
        self._model = model

    def _build_client(self):
        from openai import OpenAI  # lazy import; only needed for real API calls

        return OpenAI(api_key=self._credential.value)

    def generate(self, request: ProviderRequest) -> list[ProviderImage]:
        client = self._client or self._build_client()
        width, height = request.size
        response = client.images.generate(
            model=self._model,
            size=f"{width}x{height}",
            quality=request.provider_options.get("quality", "high"),
            background=request.provider_options.get("background", "opaque"),
            output_format="png",
            n=request.provider_options.get("count", 1),
            prompt=request.prompt,
        )
        return _decode_b64_images(response, "openai", self._model)


class GoogleImageProvider:
    def __init__(self, credential, client=None, model: str = "gemini-3.1-flash-image"):
        self._credential = credential
        self._client = client
        self._model = model

    def _build_client(self):
        from google import genai  # lazy import; only needed for real API calls

        # An "adc" credential's value is a real, refreshable
        # google.auth.credentials.Credentials object; "environment" and
        # "keychain" credentials are plain API key strings. The SDK requires
        # each kind under a different constructor argument.
        if self._credential.kind == "adc":
            return genai.Client(credentials=self._credential.value)
        return genai.Client(api_key=self._credential.value)

    def generate(self, request: ProviderRequest) -> list[ProviderImage]:
        client = self._client or self._build_client()
        response = client.interactions.create(
            model=self._model,
            input=request.prompt,
            response_format={
                "type": "image",
                "mime_type": "image/png",
                "aspect_ratio": "4:3",
                "image_size": "2K",
            },
        )
        return _decode_b64_images(response, "google", self._model)


def normalize_provider_image(
    image: ProviderImage,
    request: ProviderRequest,
    output_path: str,
    policy,
) -> NormalizedCandidate:
    """Normalize provider-native output to the exact canonical master.

    Applies at most the smallest centered crop needed to reach exact 4:3,
    rejecting any candidate that would need more than
    `policy.max_normalization_crop_fraction`, then resizes to
    `policy.master_size` and re-encodes as an opaque sRGB PNG.
    """
    target_width, target_height = policy.master_size
    target_aspect = target_width / target_height

    with Image.open(io.BytesIO(image.image_bytes)) as decoded:
        decoded = decoded.convert("RGB")
        native_width, native_height = decoded.size
        native_aspect = native_width / native_height

        if abs(native_aspect - target_aspect) < 1e-9:
            crop_fraction = 0.0
            cropped = decoded
        elif native_aspect > target_aspect:
            ideal_width = native_height * target_aspect
            crop_amount = native_width - ideal_width
            crop_fraction = crop_amount / native_width
            _reject_if_over_ceiling(crop_fraction, policy)
            left = crop_amount / 2
            cropped = decoded.crop((round(left), 0, round(left + ideal_width), native_height))
        else:
            ideal_height = native_width / target_aspect
            crop_amount = native_height - ideal_height
            crop_fraction = crop_amount / native_height
            _reject_if_over_ceiling(crop_fraction, policy)
            top = crop_amount / 2
            cropped = decoded.crop((0, round(top), native_width, round(top + ideal_height)))

        resized = cropped.resize(policy.master_size, Image.Resampling.LANCZOS)
        resized.save(output_path, format="PNG")

    return NormalizedCandidate(
        scene_brief_id=request.scene_brief_id,
        provider=image.provider,
        model=image.model,
        request_id=image.request_id,
        master_path=output_path,
        size=policy.master_size,
        normalization_crop_fraction=crop_fraction,
    )


def _reject_if_over_ceiling(crop_fraction: float, policy) -> None:
    if crop_fraction > policy.max_normalization_crop_fraction:
        raise ValueError(
            f"NormalizationCropExceeded: required crop fraction {crop_fraction:.4f} "
            f"exceeds policy ceiling {policy.max_normalization_crop_fraction:.4f}"
        )
