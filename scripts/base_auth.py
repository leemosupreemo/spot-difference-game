"""Secure, provider-scoped credential resolution.

Resolution order for both providers is: explicit environment variable,
then a tool-owned OS keychain entry, then (Google only) Application
Default Credentials or another workload identity. Credential values
never appear in a `ResolvedCredential` repr, and `public_status()`
exposes only provider, kind, and availability.
"""

import subprocess
from dataclasses import dataclass, field

KEYRING_SERVICE_NAME = "spot-difference-base-generation"
KNOWN_PROVIDERS = ("google", "openai")


@dataclass
class ResolvedCredential:
    provider: str
    kind: str
    value: object = field(repr=False)
    metadata: dict = field(default_factory=dict, repr=False)

    def public_status(self) -> dict:
        return {"provider": self.provider, "kind": self.kind, "available": True}


def _default_keyring_backend():
    import keyring

    return keyring


def _default_adc_loader():
    try:
        import google.auth
    except ImportError:
        return None, None
    try:
        return google.auth.default()
    except Exception:
        return None, None


class CredentialResolver:
    def __init__(self, environ=None, keyring_backend=None, adc_loader=None):
        import os

        self._environ = environ if environ is not None else os.environ
        self._keyring_backend = keyring_backend
        self._adc_loader = adc_loader

    def _keychain_secret(self, provider: str):
        backend = self._keyring_backend
        if backend is None:
            try:
                backend = _default_keyring_backend()
            except ImportError:
                return None
        try:
            return backend.get_password(KEYRING_SERVICE_NAME, provider)
        except Exception:
            return None

    def resolve_openai(self):
        env_value = self._environ.get("OPENAI_API_KEY")
        if env_value:
            return ResolvedCredential(provider="openai", kind="environment", value=env_value)

        stored = self._keychain_secret("openai")
        if stored:
            return ResolvedCredential(provider="openai", kind="keychain", value=stored)

        return None

    def resolve_google(self):
        google_value = self._environ.get("GOOGLE_API_KEY")
        gemini_value = self._environ.get("GEMINI_API_KEY")
        if google_value and gemini_value and google_value != gemini_value:
            raise ValueError(
                "GOOGLE_API_KEY and GEMINI_API_KEY are both set to different values"
            )
        env_value = google_value or gemini_value
        if env_value:
            return ResolvedCredential(provider="google", kind="environment", value=env_value)

        stored = self._keychain_secret("google")
        if stored:
            return ResolvedCredential(provider="google", kind="keychain", value=stored)

        adc_loader = self._adc_loader or _default_adc_loader
        credentials, project = adc_loader()
        if credentials is None:
            return None
        metadata = {"project": project} if project else {}
        return ResolvedCredential(provider="google", kind="adc", value=credentials, metadata=metadata)


def _require_known_provider(provider: str) -> None:
    if provider not in KNOWN_PROVIDERS:
        raise ValueError(f"provider must be one of {KNOWN_PROVIDERS}, got {provider!r}")


def store_provider_key(provider: str, secret: str, keyring_backend=None) -> None:
    _require_known_provider(provider)
    backend = keyring_backend or _default_keyring_backend()
    backend.set_password(KEYRING_SERVICE_NAME, provider, secret)


def remove_provider_key(provider: str, keyring_backend=None) -> None:
    _require_known_provider(provider)
    backend = keyring_backend or _default_keyring_backend()
    try:
        backend.delete_password(KEYRING_SERVICE_NAME, provider)
    except Exception:
        pass  # already absent


def run_google_adc_login(runner=subprocess.run) -> int:
    try:
        result = runner(["gcloud", "auth", "application-default", "login"], check=False)
    except FileNotFoundError:
        return 127
    return result.returncode
