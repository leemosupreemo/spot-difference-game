import json
import unittest

from base_auth import (
    CredentialResolver,
    ResolvedCredential,
    remove_provider_key,
    run_google_adc_login,
    store_provider_key,
)


class FakeKeyring:
    def __init__(self, stored_secret=None):
        self._stored = stored_secret
        self.calls = []

    def get_password(self, service, account):
        self.calls.append(("get", service, account))
        return self._stored

    def set_password(self, service, account, secret):
        self.calls.append(("set", service, account, secret))
        self._stored = secret

    def delete_password(self, service, account):
        self.calls.append(("delete", service, account))
        self._stored = None


def fake_adc():
    return ("fake-credentials-object", "test-project")


def fake_adc_unavailable():
    return (None, None)


class FakeCompletedProcess:
    def __init__(self, returncode=0):
        self.returncode = returncode


class TestResolvedCredential(unittest.TestCase):
    def test_repr_hides_value_and_metadata(self):
        credential = ResolvedCredential(
            provider="openai",
            kind="environment",
            value="super-secret-value",
            metadata={"raw": "super-secret-value"},
        )
        self.assertNotIn("super-secret-value", repr(credential))

    def test_public_status_exposes_only_safe_fields(self):
        credential = ResolvedCredential(
            provider="google", kind="adc", value="opaque-creds", metadata={"project": "p"}
        )
        status = credential.public_status()
        self.assertEqual(status, {"provider": "google", "kind": "adc", "available": True})
        self.assertNotIn("token", json.dumps(status).lower())


class TestCredentialResolver(unittest.TestCase):
    def test_openai_env_precedes_keychain_and_secret_is_redacted(self):
        resolver = CredentialResolver(
            environ={"OPENAI_API_KEY": "openai-test-value"},
            keyring_backend=FakeKeyring("stored-secret"),
        )
        credential = resolver.resolve_openai()
        self.assertEqual(credential.kind, "environment")
        self.assertEqual(credential.value, "openai-test-value")
        self.assertNotIn("openai-test-value", repr(credential))

    def test_openai_falls_back_to_keychain_when_env_absent(self):
        resolver = CredentialResolver(
            environ={}, keyring_backend=FakeKeyring("stored-secret")
        )
        credential = resolver.resolve_openai()
        self.assertEqual(credential.kind, "keychain")
        self.assertEqual(credential.value, "stored-secret")

    def test_openai_returns_none_when_nothing_available(self):
        resolver = CredentialResolver(environ={}, keyring_backend=FakeKeyring(None))
        self.assertIsNone(resolver.resolve_openai())

    def test_google_falls_back_to_adc_without_serializing_token(self):
        resolver = CredentialResolver(
            environ={}, keyring_backend=FakeKeyring(None), adc_loader=fake_adc
        )
        credential = resolver.resolve_google()
        self.assertEqual(credential.kind, "adc")
        self.assertNotIn("token", json.dumps(credential.public_status()).lower())

    def test_google_returns_none_when_adc_unavailable(self):
        resolver = CredentialResolver(
            environ={}, keyring_backend=FakeKeyring(None), adc_loader=fake_adc_unavailable
        )
        self.assertIsNone(resolver.resolve_google())

    def test_google_accepts_gemini_api_key_alias(self):
        resolver = CredentialResolver(
            environ={"GEMINI_API_KEY": "gemini-value"}, keyring_backend=FakeKeyring(None)
        )
        credential = resolver.resolve_google()
        self.assertEqual(credential.kind, "environment")
        self.assertEqual(credential.value, "gemini-value")

    def test_google_rejects_conflicting_env_aliases(self):
        resolver = CredentialResolver(
            environ={"GOOGLE_API_KEY": "a", "GEMINI_API_KEY": "b"},
            keyring_backend=FakeKeyring(None),
        )
        with self.assertRaises(ValueError):
            resolver.resolve_google()

    def test_google_keychain_precedes_adc(self):
        resolver = CredentialResolver(
            environ={},
            keyring_backend=FakeKeyring("stored-google-secret"),
            adc_loader=fake_adc,
        )
        credential = resolver.resolve_google()
        self.assertEqual(credential.kind, "keychain")
        self.assertEqual(credential.value, "stored-google-secret")

    def test_resolve_openai_never_touches_google_env_or_adc(self):
        adc_calls = []

        def tracking_adc_loader():
            adc_calls.append("called")
            return fake_adc()

        resolver = CredentialResolver(
            environ={"GOOGLE_API_KEY": "should-be-ignored", "OPENAI_API_KEY": "openai-value"},
            keyring_backend=FakeKeyring(None),
            adc_loader=tracking_adc_loader,
        )
        credential = resolver.resolve_openai()
        self.assertEqual(credential.value, "openai-value")
        self.assertEqual(adc_calls, [])

    def test_resolve_google_never_touches_openai_env(self):
        resolver = CredentialResolver(
            environ={"OPENAI_API_KEY": "should-be-ignored"},
            keyring_backend=FakeKeyring(None),
            adc_loader=fake_adc,
        )
        credential = resolver.resolve_google()
        self.assertEqual(credential.kind, "adc")


class TestProviderKeyStorage(unittest.TestCase):
    def test_store_and_remove_provider_key_use_keychain_backend(self):
        backend = FakeKeyring(None)
        store_provider_key("openai", "secret-value", keyring_backend=backend)
        self.assertEqual(backend._stored, "secret-value")
        self.assertEqual(backend.calls[-1], ("set", "spot-difference-base-generation", "openai", "secret-value"))

        remove_provider_key("openai", keyring_backend=backend)
        self.assertIsNone(backend._stored)

    def test_store_provider_key_rejects_unknown_provider(self):
        with self.assertRaises(ValueError):
            store_provider_key("mystery", "x", keyring_backend=FakeKeyring(None))

    def test_remove_provider_key_rejects_unknown_provider(self):
        with self.assertRaises(ValueError):
            remove_provider_key("mystery", keyring_backend=FakeKeyring(None))

    def test_remove_provider_key_is_idempotent_when_already_absent(self):
        backend = FakeKeyring(None)
        remove_provider_key("google", keyring_backend=backend)  # should not raise


class TestGoogleAdcLogin(unittest.TestCase):
    def test_invokes_expected_command_without_shell(self):
        calls = []

        def fake_runner(args, **kwargs):
            calls.append((args, kwargs))
            return FakeCompletedProcess(returncode=0)

        code = run_google_adc_login(runner=fake_runner)
        self.assertEqual(code, 0)
        args, kwargs = calls[0]
        self.assertEqual(args, ["gcloud", "auth", "application-default", "login"])
        self.assertIsInstance(args, list)
        self.assertNotIn("shell", kwargs)

    def test_handles_missing_gcloud_gracefully(self):
        def raising_runner(args, **kwargs):
            raise FileNotFoundError("gcloud not found")

        code = run_google_adc_login(runner=raising_runner)
        self.assertEqual(code, 127)


if __name__ == "__main__":
    unittest.main()
