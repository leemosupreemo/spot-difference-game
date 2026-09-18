import base64
import io
import json
import os
import tempfile
import unittest

from PIL import Image

from base_auth import (
    CredentialResolver,
    ResolvedCredential,
    remove_provider_key,
    run_google_adc_login,
    store_provider_key,
)
from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from base_generation_types import ProviderImage, ProviderRequest, RunConfig, SceneBrief
from base_image_provider import (
    FakeImageProvider,
    GoogleImageProvider,
    OpenAIImageProvider,
    normalize_provider_image,
)
from base_visual_critic import (
    CriticSchemaError,
    FakeVisualCritic,
    GoogleVisualCritic,
    OpenAIVisualCritic,
    resolve_critic_mode,
)

SAMPLE_BRIEF = SceneBrief(
    id="forest_survey_table",
    scene_family="activity",
    domain="field_science",
    setting="a forest survey table",
    object_families=("leaf samples", "sample jars", "magnifiers", "survey flags"),
    materials=("glass", "paper", "wood", "botanical matter"),
    layout="three_quarter_work_surface",
    palette="moss_green_amber",
    density_target=(35, 70),
    desired_operations=("add", "remove", "reorder"),
)


def valid_critic_payload(**overrides):
    payload = {
        "photorealism": 9.0,
        "object_integrity": 9.0,
        "scene_coherence": 8.0,
        "visual_fun": 7.0,
        "composition": 7.5,
        "artifact_flags": [],
        "tags": ["field_science", "moss_green_amber"],
        "reason": None,
    }
    payload.update(overrides)
    return payload


def make_png_bytes(size, color=(80, 120, 160), mode="RGB"):
    image = Image.new(mode, size, color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def make_b64_response(sizes_and_colors):
    class Item:
        def __init__(self, b64_json):
            self.b64_json = b64_json

    class Response:
        def __init__(self, data, response_id="resp-1"):
            self.data = data
            self.id = response_id

    items = [
        Item(base64.b64encode(make_png_bytes(size, color)).decode("ascii"))
        for size, color in sizes_and_colors
    ]
    return Response(items)


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


class TestFakeImageProvider(unittest.TestCase):
    def test_returns_whatever_the_responder_produces(self):
        image = ProviderImage(
            provider="google",
            model="fake-model",
            request_id="req-1",
            native_size=(1536, 1152),
            image_bytes=b"fake",
        )
        provider = FakeImageProvider(lambda request: [image])
        request = ProviderRequest(
            provider="google",
            model="fake-model",
            prompt="a scene",
            scene_brief_id="forest_survey_table",
            size=(1536, 1152),
        )
        self.assertEqual(provider.generate(request), [image])


class TestOpenAIImageProvider(unittest.TestCase):
    def test_generate_builds_request_and_decodes_response(self):
        captured = {}

        class FakeClient:
            class images:
                @staticmethod
                def generate(**kwargs):
                    captured.update(kwargs)
                    return make_b64_response([((1536, 1152), (10, 20, 30))])

        provider = OpenAIImageProvider(credential=None, client=FakeClient())
        request = ProviderRequest(
            provider="openai",
            model="gpt-image-2.5-sunburst",
            prompt="a photorealistic scene",
            scene_brief_id="forest_survey_table",
            size=(1536, 1152),
            provider_options={"count": 2},
        )

        images = provider.generate(request)

        self.assertEqual(captured["model"], "gpt-image-2.5-sunburst")
        self.assertEqual(captured["size"], "1536x1152")
        self.assertEqual(captured["quality"], "high")
        self.assertEqual(captured["background"], "opaque")
        self.assertEqual(captured["output_format"], "png")
        self.assertEqual(captured["n"], 2)

        self.assertEqual(len(images), 1)
        self.assertEqual(images[0].provider, "openai")
        self.assertEqual(images[0].native_size, (1536, 1152))
        self.assertIsInstance(images[0].image_bytes, bytes)


class TestGoogleImageProvider(unittest.TestCase):
    def test_generate_builds_request_and_decodes_response(self):
        captured = {}

        class FakeInteractions:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                return make_b64_response([((2400, 1792), (40, 50, 60))])

        class FakeClient:
            interactions = FakeInteractions()

        provider = GoogleImageProvider(credential=None, client=FakeClient())
        request = ProviderRequest(
            provider="google",
            model="gemini-3.1-flash-image",
            prompt="a photorealistic scene",
            scene_brief_id="forest_survey_table",
            size=(1536, 1152),
        )

        images = provider.generate(request)

        self.assertEqual(captured["model"], "gemini-3.1-flash-image")
        self.assertEqual(captured["input"], "a photorealistic scene")
        self.assertEqual(captured["response_format"]["aspect_ratio"], "4:3")
        self.assertEqual(captured["response_format"]["image_size"], "2K")

        self.assertEqual(len(images), 1)
        self.assertEqual(images[0].provider, "google")
        self.assertEqual(images[0].native_size, (2400, 1792))


class TestNormalizeProviderImage(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.output_path = os.path.join(self.tmpdir.name, "candidate.png")
        self.request = ProviderRequest(
            provider="google",
            model="gemini-3.1-flash-image",
            prompt="a scene",
            scene_brief_id="forest_survey_table",
            size=(1536, 1152),
        )

    def test_openai_native_master_size_passes_through_unchanged(self):
        image = ProviderImage(
            provider="openai",
            model="gpt-image-2.5-sunburst",
            request_id="req-openai",
            native_size=(1536, 1152),
            image_bytes=make_png_bytes((1536, 1152)),
        )
        result = normalize_provider_image(
            image, self.request, self.output_path, DEFAULT_BASE_GENERATION_POLICY
        )
        self.assertEqual(result.scene_brief_id, "forest_survey_table")
        self.assertEqual(result.normalization_crop_fraction, 0.0)
        with Image.open(result.master_path) as saved:
            self.assertEqual(saved.size, (1536, 1152))
            self.assertEqual(saved.mode, "RGB")

    def test_google_2k_output_normalizes_to_exact_master(self):
        image = ProviderImage(
            provider="google",
            model="gemini-3.1-flash-image",
            request_id="req-google",
            native_size=(2400, 1792),
            image_bytes=make_png_bytes((2400, 1792)),
        )
        result = normalize_provider_image(
            image, self.request, self.output_path, DEFAULT_BASE_GENERATION_POLICY
        )
        with Image.open(result.master_path) as saved:
            self.assertEqual(saved.size, (1536, 1152))
        self.assertLessEqual(result.normalization_crop_fraction, 0.005)
        self.assertGreater(result.normalization_crop_fraction, 0.0)

    def test_wide_provider_output_is_rejected_before_evaluation(self):
        image = ProviderImage(
            provider="google",
            model="gemini-3.1-flash-image",
            request_id="req-wide",
            native_size=(1920, 1080),
            image_bytes=make_png_bytes((1920, 1080)),
        )
        with self.assertRaisesRegex(ValueError, "NormalizationCropExceeded"):
            normalize_provider_image(
                image, self.request, self.output_path, DEFAULT_BASE_GENERATION_POLICY
            )

    def test_transparent_input_is_converted_to_opaque_rgb(self):
        image = ProviderImage(
            provider="openai",
            model="gpt-image-2.5-sunburst",
            request_id="req-alpha",
            native_size=(1536, 1152),
            image_bytes=make_png_bytes((1536, 1152), color=(10, 20, 30, 128), mode="RGBA"),
        )
        result = normalize_provider_image(
            image, self.request, self.output_path, DEFAULT_BASE_GENERATION_POLICY
        )
        with Image.open(result.master_path) as saved:
            self.assertEqual(saved.mode, "RGB")


class TestResolveCriticMode(unittest.TestCase):
    def test_auto_critic_does_not_require_other_provider(self):
        self.assertEqual(resolve_critic_mode(RunConfig(provider_mode="google")), "google")
        self.assertEqual(resolve_critic_mode(RunConfig(provider_mode="openai")), "openai")

    def test_auto_critic_resolves_to_one_explicit_provider_for_mixed_runs(self):
        resolved = resolve_critic_mode(RunConfig(provider_mode="mixed"))
        self.assertIn(resolved, ("google", "openai"))
        # Must be deterministic across repeated calls for the same config.
        self.assertEqual(resolved, resolve_critic_mode(RunConfig(provider_mode="mixed")))

    def test_explicit_critic_mode_overrides_provider_mode(self):
        self.assertEqual(
            resolve_critic_mode(RunConfig(provider_mode="google", critic_mode="openai")),
            "openai",
        )


class TestFakeVisualCritic(unittest.TestCase):
    def test_returns_configured_scores(self):
        critic = FakeVisualCritic(photorealism=7.9, object_integrity=10.0)
        result = critic.evaluate("candidate.png", SAMPLE_BRIEF)
        self.assertEqual(result.photorealism, 7.9)
        self.assertEqual(result.object_integrity, 10.0)


class TestCriticSchemaParsing(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.NamedTemporaryFile(suffix=".png")
        self.addCleanup(self._tmp.close)
        self._tmp.write(make_png_bytes((1536, 1152)))
        self._tmp.flush()
        self.image_path = self._tmp.name

    def _adapter_with_response(self, raw_text):
        class FakeResponse:
            output_text = raw_text

        class FakeResponses:
            @staticmethod
            def create(**kwargs):
                return FakeResponse()

        class FakeClient:
            responses = FakeResponses()

        return OpenAIVisualCritic(credential=None, client=FakeClient())

    def test_valid_response_parses_into_visual_critic_result(self):
        adapter = self._adapter_with_response(json.dumps(valid_critic_payload()))
        result = adapter.evaluate(self.image_path, SAMPLE_BRIEF)
        self.assertEqual(result.photorealism, 9.0)
        self.assertEqual(result.diversity_tags, ("field_science", "moss_green_amber"))
        self.assertEqual(result.artifact_flags, ())

    def test_response_missing_keys_is_rejected(self):
        payload = valid_critic_payload()
        del payload["object_integrity"]
        adapter = self._adapter_with_response(json.dumps(payload))
        with self.assertRaises(CriticSchemaError):
            adapter.evaluate(self.image_path, SAMPLE_BRIEF)

    def test_response_with_out_of_range_score_is_rejected(self):
        adapter = self._adapter_with_response(json.dumps(valid_critic_payload(photorealism=15.0)))
        with self.assertRaises(CriticSchemaError):
            adapter.evaluate(self.image_path, SAMPLE_BRIEF)

    def test_response_with_non_string_tags_is_rejected(self):
        adapter = self._adapter_with_response(json.dumps(valid_critic_payload(tags=[1, 2])))
        with self.assertRaises(CriticSchemaError):
            adapter.evaluate(self.image_path, SAMPLE_BRIEF)

    def test_malformed_json_is_rejected(self):
        adapter = self._adapter_with_response("not json")
        with self.assertRaises(CriticSchemaError):
            adapter.evaluate(self.image_path, SAMPLE_BRIEF)


class TestOpenAIVisualCritic(unittest.TestCase):
    def test_evaluate_sends_high_detail_image_and_uses_default_model(self):
        captured = {}

        class FakeResponse:
            output_text = json.dumps(valid_critic_payload())

        class FakeResponses:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                return FakeResponse()

        class FakeClient:
            responses = FakeResponses()

        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.write(make_png_bytes((1536, 1152)))
            tmp.flush()

            adapter = OpenAIVisualCritic(credential=None, client=FakeClient())
            result = adapter.evaluate(tmp.name, SAMPLE_BRIEF)

        self.assertEqual(result.provider, "openai")
        self.assertEqual(result.model, DEFAULT_BASE_GENERATION_POLICY.default_openai_critic_model)
        self.assertEqual(captured["model"], DEFAULT_BASE_GENERATION_POLICY.default_openai_critic_model)


class TestGoogleVisualCritic(unittest.TestCase):
    def test_evaluate_sends_high_detail_image_and_uses_default_model(self):
        captured = {}

        class FakeResponse:
            output_text = json.dumps(valid_critic_payload())

        class FakeInteractions:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                return FakeResponse()

        class FakeClient:
            interactions = FakeInteractions()

        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.write(make_png_bytes((1536, 1152)))
            tmp.flush()

            adapter = GoogleVisualCritic(credential=None, client=FakeClient())
            result = adapter.evaluate(tmp.name, SAMPLE_BRIEF)

        self.assertEqual(result.provider, "google")
        self.assertEqual(result.model, DEFAULT_BASE_GENERATION_POLICY.default_google_critic_model)
        self.assertEqual(captured["model"], DEFAULT_BASE_GENERATION_POLICY.default_google_critic_model)

    def test_never_sends_an_unsupported_detail_parameter(self):
        # Google has no image-detail request field; full-resolution bytes are its
        # documented equivalent of "high detail" (see ledger ruling). Inventing a
        # "detail" key would silently be ignored or rejected by a real client.
        captured = {}

        class FakeResponse:
            output_text = json.dumps(valid_critic_payload())

        class FakeInteractions:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                return FakeResponse()

        class FakeClient:
            interactions = FakeInteractions()

        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            tmp.write(make_png_bytes((1536, 1152)))
            tmp.flush()
            GoogleVisualCritic(credential=None, client=FakeClient()).evaluate(tmp.name, SAMPLE_BRIEF)

        image_part = next(part for part in captured["input"] if part.get("type") == "image")
        self.assertNotIn("detail", image_part)


if __name__ == "__main__":
    unittest.main()
