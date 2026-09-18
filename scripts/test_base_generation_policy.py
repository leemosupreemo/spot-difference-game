import json
import os
import unittest
from collections import Counter

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
from base_prompt_composer import compose_prompt
from base_scene_catalog import (
    build_batch_plan,
    load_scene_catalog,
    validate_scene_catalog,
)

CATALOG_PATH = os.path.join(os.path.dirname(__file__), "base_scene_catalog.json")


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


class TestSceneCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.briefs = load_scene_catalog(CATALOG_PATH)

    def test_catalog_has_sixty_valid_varied_briefs(self):
        briefs = self.briefs
        self.assertGreaterEqual(len(briefs), 60)
        self.assertEqual(len({brief.id for brief in briefs}), len(briefs))
        self.assertEqual(
            {brief.scene_family for brief in briefs},
            {"collection", "activity", "playful"},
        )
        self.assertEqual(validate_scene_catalog(briefs), [])

    def test_catalog_has_no_duplicate_object_family_tuples(self):
        tuples = [tuple(sorted(brief.object_families)) for brief in self.briefs]
        self.assertEqual(len(tuples), len(set(tuples)))

    def test_validate_scene_catalog_rejects_missing_and_invalid_fields(self):
        broken = [
            SceneBrief(
                id="",
                scene_family="mystery",
                domain="",
                setting="",
                object_families=("a", "b"),
                materials=("x",),
                layout="",
                palette="",
                density_target=(10, 200),
                desired_operations=("teleport",),
            )
        ]
        errors = validate_scene_catalog(broken)
        self.assertTrue(errors)
        joined = " ".join(errors)
        self.assertIn("scene_family", joined)
        self.assertIn("object families", joined)
        self.assertIn("material tags", joined)
        self.assertIn("density_target", joined)
        self.assertIn("unknown operations", joined)

    def test_validate_scene_catalog_rejects_duplicate_ids(self):
        one = self.briefs[0]
        duplicate = SceneBrief(
            id=one.id,
            scene_family=one.scene_family,
            domain=one.domain,
            setting=one.setting,
            object_families=tuple(reversed(one.object_families)) + ("extra family",),
            materials=one.materials,
            layout=one.layout,
            palette=one.palette,
            density_target=one.density_target,
            desired_operations=one.desired_operations,
        )
        errors = validate_scene_catalog([one, duplicate])
        self.assertTrue(any("duplicate id" in error for error in errors))


class TestBatchScheduler(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.briefs = load_scene_catalog(CATALOG_PATH)

    def test_batch_plan_is_balanced_and_history_aware(self):
        recent_history = [{"id": brief.id} for brief in self.briefs[:5]]
        recent_ids = {entry["id"] for entry in recent_history}

        plan = build_batch_plan(
            self.briefs, recent_history, RunConfig(seed=7), DEFAULT_BASE_GENERATION_POLICY
        )

        self.assertEqual(
            dict(Counter(item.scene_family for item in plan)),
            {"collection": 4, "activity": 4, "playful": 2},
        )
        self.assertTrue(all(item.id not in recent_ids for item in plan))

    def test_batch_plan_is_deterministic_for_a_fixed_seed(self):
        plan_a = build_batch_plan(
            self.briefs, [], RunConfig(seed=42), DEFAULT_BASE_GENERATION_POLICY
        )
        plan_b = build_batch_plan(
            self.briefs, [], RunConfig(seed=42), DEFAULT_BASE_GENERATION_POLICY
        )
        self.assertEqual([b.id for b in plan_a], [b.id for b in plan_b])

    def test_batch_plan_respects_per_dimension_diversity_caps(self):
        plan = build_batch_plan(
            self.briefs, [], RunConfig(seed=3), DEFAULT_BASE_GENERATION_POLICY
        )
        cap = 3  # max(1, ceil(10 * 0.25))
        domain_counts = Counter(item.domain for item in plan)
        layout_counts = Counter(item.layout for item in plan)
        palette_counts = Counter(item.palette for item in plan)
        self.assertTrue(all(count <= cap for count in domain_counts.values()))
        self.assertTrue(all(count <= cap for count in layout_counts.values()))
        self.assertTrue(all(count <= cap for count in palette_counts.values()))

    def test_batch_plan_scales_for_non_default_counts(self):
        plan = build_batch_plan(
            self.briefs, [], RunConfig(count=7, seed=1), DEFAULT_BASE_GENERATION_POLICY
        )
        self.assertEqual(
            dict(Counter(item.scene_family for item in plan)),
            {"collection": 3, "activity": 3, "playful": 1},
        )


class TestPromptComposer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.briefs = load_scene_catalog(CATALOG_PATH)

    def test_compose_prompt_includes_required_contract_clauses(self):
        brief = self.briefs[0]
        prompt = compose_prompt(brief, DEFAULT_BASE_GENERATION_POLICY)

        self.assertIn(brief.setting, prompt)
        self.assertIn(str(brief.density_target[0]), prompt)
        self.assertIn(str(brief.density_target[1]), prompt)
        for family in brief.object_families:
            self.assertIn(family, prompt)
        self.assertIn(brief.camera_angle, prompt)
        self.assertIn(brief.lighting_temperature, prompt)
        self.assertIn("No people, hands, faces, brands, logos, watermarks", prompt)
        self.assertIn("4:3", prompt)
        self.assertIn("Deep depth of field", prompt)

    def test_compose_prompt_is_deterministic(self):
        brief = self.briefs[0]
        first = compose_prompt(brief, DEFAULT_BASE_GENERATION_POLICY)
        second = compose_prompt(brief, DEFAULT_BASE_GENERATION_POLICY)
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
