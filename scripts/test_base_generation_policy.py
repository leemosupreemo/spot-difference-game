import json
import unittest

from base_generation_policy import (
    DEFAULT_BASE_GENERATION_POLICY,
    validate_run_config,
)
from base_generation_types import (
    CandidateEvaluation,
    FinalizedPair,
    NormalizedCandidate,
    ProviderImage,
    ProviderRequest,
    RunConfig,
    SceneBrief,
    VisualCriticResult,
)


class TestBaseGenerationPolicy(unittest.TestCase):
    def test_default_policy_has_canonical_sizes_and_budget(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        self.assertEqual(policy.master_size, (1536, 1152))
        self.assertEqual(policy.production_size, (1200, 900))
        self.assertEqual(policy.max_candidates_per_brief, 4)
        self.assertEqual(policy.max_images_per_default_batch, 40)
        self.assertEqual(
            policy.portfolio_counts(10),
            {"collection": 4, "activity": 4, "playful": 2},
        )

    def test_portfolio_counts_are_proportional_for_non_default_counts(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        counts = policy.portfolio_counts(7)
        self.assertEqual(counts, {"collection": 3, "activity": 3, "playful": 1})
        self.assertEqual(sum(counts.values()), 7)

    def test_run_config_serialization_never_contains_credentials(self):
        config = RunConfig(count=10, provider_mode="mixed", critic_mode="auto")
        serialized = config.to_public_dict()
        dumped = json.dumps(serialized).lower()
        self.assertNotIn("api_key", dumped)
        self.assertNotIn("credential", dumped)

    def test_run_config_defaults_are_reproducible(self):
        config = RunConfig()
        self.assertEqual(config.count, 10)
        self.assertEqual(config.provider_mode, "mixed")
        self.assertEqual(config.critic_mode, "auto")
        self.assertEqual(config.max_images, 40)
        self.assertEqual(config.execution_mode, "dry_run")
        self.assertEqual(config.staging_root, ".base-generation/runs")

    def test_max_images_ceiling_is_enforced_for_default_batch(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        over_budget = RunConfig(count=10, max_images=41)
        with self.assertRaises(ValueError):
            validate_run_config(over_budget, policy)

        at_budget = RunConfig(count=10, max_images=40)
        validate_run_config(at_budget, policy)  # should not raise

    def test_max_images_ceiling_scales_proportionally_for_other_counts(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        over_budget = RunConfig(count=5, max_images=21)
        with self.assertRaises(ValueError):
            validate_run_config(over_budget, policy)

        at_budget = RunConfig(count=5, max_images=20)
        validate_run_config(at_budget, policy)  # should not raise

    def test_invalid_provider_mode_is_rejected(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        config = RunConfig(provider_mode="dalle")
        with self.assertRaises(ValueError):
            validate_run_config(config, policy)

    def test_invalid_critic_mode_is_rejected(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        config = RunConfig(critic_mode="claude")
        with self.assertRaises(ValueError):
            validate_run_config(config, policy)

    def test_invalid_count_is_rejected(self):
        policy = DEFAULT_BASE_GENERATION_POLICY
        config = RunConfig(count=0)
        with self.assertRaises(ValueError):
            validate_run_config(config, policy)


class TestSharedContracts(unittest.TestCase):
    def test_scene_brief_round_trips_expected_fields(self):
        brief = SceneBrief(
            id="forest_survey_table",
            scene_family="activity",
            domain="field_science",
            setting="forest survey table",
            object_families=("leaf samples", "sample jars"),
            materials=("glass", "paper"),
            layout="three_quarter_work_surface",
            palette="moss_green_amber",
            density_target=(35, 70),
            desired_operations=("add", "remove", "reorder"),
        )
        self.assertEqual(brief.scene_family, "activity")
        self.assertEqual(brief.density_target, (35, 70))

    def test_provider_request_and_image_are_immutable(self):
        request = ProviderRequest(
            provider="google",
            model="gemini-3.1-flash-image",
            prompt="a photorealistic scene",
            scene_brief_id="forest_survey_table",
            size=(1536, 1152),
        )
        with self.assertRaises(Exception):
            request.provider = "openai"  # type: ignore[misc]

        image = ProviderImage(
            provider="google",
            model="gemini-3.1-flash-image",
            request_id="req-1",
            native_size=(2400, 1792),
            image_bytes=b"fake-bytes",
        )
        self.assertEqual(image.content_type, "image/png")

    def test_normalized_candidate_and_critic_result_are_constructible(self):
        candidate = NormalizedCandidate(
            scene_brief_id="forest_survey_table",
            provider="google",
            model="gemini-3.1-flash-image",
            request_id="req-1",
            master_path="/tmp/run/candidate-1.png",
            size=(1536, 1152),
            normalization_crop_fraction=0.003,
        )
        self.assertEqual(candidate.size, (1536, 1152))

        critic_result = VisualCriticResult(
            provider="openai",
            model="gpt-5.6-luna",
            photorealism=9.0,
            object_integrity=8.5,
            scene_coherence=8.0,
            visual_fun=7.0,
            composition=7.5,
        )
        self.assertEqual(critic_result.artifact_flags, ())

        evaluation = CandidateEvaluation(
            candidate=candidate,
            passed_local_gates=True,
            local_gate_failures=(),
            critic=critic_result,
            novelty_score=0.8,
            rank_score=0.72,
            accepted=True,
        )
        self.assertTrue(evaluation.accepted)

    def test_finalized_pair_declares_production_dimensions(self):
        pair = FinalizedPair(
            scene_brief_id="forest_survey_table",
            base_path="public/levels/forest_survey_table_base.jpg",
            variant_path="public/levels/forest_survey_table_variant.jpg",
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="forest_survey_table",
        )
        self.assertEqual(pair.dimensions, (1200, 900))
        self.assertEqual(pair.aspect_ratio, "4:3")


if __name__ == "__main__":
    unittest.main()
