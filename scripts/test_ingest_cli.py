import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from typer.testing import CliRunner

from base_generation_types import FinalizedPair
from generate_photo_batch import (
    app,
    existing_manifest_ids,
    ingest_image,
    ingest_image_variants,
    resolve_image_paths,
    slugify,
    unique_id,
)


def _make_source(path: Path, size=(1536, 1152), color=(100, 110, 120)):
    Image.new("RGB", size, color).save(path)


class TestSlugify(unittest.TestCase):
    def test_lowercases_and_replaces_non_alphanumerics(self):
        self.assertEqual(slugify("Fresh Workbench #12!"), "fresh_workbench_12")

    def test_strips_leading_and_trailing_separators(self):
        self.assertEqual(slugify("  --edge-- "), "edge")

    def test_empty_input_falls_back_to_scene(self):
        self.assertEqual(slugify("###"), "scene")


class TestUniqueId(unittest.TestCase):
    def test_returns_base_id_when_available(self):
        self.assertEqual(unique_id("workbench", set()), "workbench")

    def test_suffixes_on_collision(self):
        self.assertEqual(unique_id("workbench", {"workbench"}), "workbench_2")
        self.assertEqual(unique_id("workbench", {"workbench", "workbench_2"}), "workbench_3")


class TestExistingManifestIds(unittest.TestCase):
    def test_missing_manifest_returns_empty_set(self):
        self.assertEqual(existing_manifest_ids("/nonexistent/manifest.json"), set())

    def test_reads_ids_from_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            manifest_path.write_text(json.dumps([{"id": "a"}, {"id": "b"}]))
            self.assertEqual(existing_manifest_ids(manifest_path), {"a", "b"})


class TestResolveImagePaths(unittest.TestCase):
    def test_expands_a_directory_to_its_image_files_sorted(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            _make_source(tmp_path / "b.jpg")
            _make_source(tmp_path / "a.png")
            (tmp_path / "notes.txt").write_text("skip me")

            resolved = resolve_image_paths([str(tmp_path)])

            self.assertEqual([p.name for p in resolved], ["a.png", "b.jpg"])

    def test_passes_through_explicit_files_unexpanded(self):
        resolved = resolve_image_paths(["one.jpg", "two.png"])
        self.assertEqual([p.name for p in resolved], ["one.jpg", "two.png"])


class TestIngestImage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "source.png"
        _make_source(self.source)
        self.staging_dir = Path(self.tmp.name) / "staging"
        self.staging_dir.mkdir()

    def test_rejects_missing_file(self):
        with self.assertRaises(ValueError):
            ingest_image(str(Path(self.tmp.name) / "missing.png"), "scene-1", staging_dir=self.staging_dir)

    def test_rejects_invalid_difficulty(self):
        with self.assertRaises(ValueError):
            ingest_image(str(self.source), "scene-1", difficulty="Impossible", staging_dir=self.staging_dir)

    def test_local_gate_rejection_stops_before_structural_pipeline(self):
        """With the second pass off, a gate rejection ends the image."""
        with patch(
            "generate_photo_batch.run_local_gates", return_value=(False, ("SomeReject: bad",), {})
        ), patch("generate_photo_batch.generate_structural_pair") as mocked_structural:
            with self.assertRaises(ValueError) as ctx:
                ingest_image(str(self.source), "scene-1", staging_dir=self.staging_dir, fallback="none")
            self.assertIn("SomeReject", str(ctx.exception))
            mocked_structural.assert_not_called()

    def test_structural_rejection_is_surfaced(self):
        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair",
            return_value=(None, {"rejection_reason": "no viable operation"}),
        ):
            with self.assertRaises(ValueError) as ctx:
                ingest_image(str(self.source), "scene-1", staging_dir=self.staging_dir, fallback="none")
            self.assertIn("no viable operation", str(ctx.exception))

    def test_happy_path_publishes_and_returns_entry(self):
        finalized = FinalizedPair(
            scene_brief_id="scene-1",
            base_path=str(self.source),
            variant_path=str(self.source),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="scene-1",
        )
        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair",
            return_value=(finalized, {"manifest_entry": {"id": "scene-1", "title": "Scene One"}}),
        ), patch(
            "generate_photo_batch.publish_pair",
            return_value={
                "id": "scene-1",
                "baseImage": "levels/a.jpg",
                "variantImage": "levels/b.jpg",
                "difficulty": "Medium",
                "operation": "add",
            },
        ) as mocked_publish:
            published = ingest_image(str(self.source), "scene-1", staging_dir=self.staging_dir)

        self.assertEqual(published["id"], "scene-1")
        mocked_publish.assert_called_once()


class TestIngestImageVariants(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "source.png"
        _make_source(self.source)
        self.staging_dir = Path(self.tmp.name) / "staging"
        self.staging_dir.mkdir()

    def test_rejects_missing_file(self):
        with self.assertRaises(ValueError):
            ingest_image_variants(str(Path(self.tmp.name) / "missing.png"), "scene-1", 5, staging_dir=self.staging_dir)

    def test_structural_rejection_is_surfaced(self):
        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair_variants",
            return_value=([], {"rejection_reason": "no viable operation"}),
        ):
            with self.assertRaises(ValueError) as ctx:
                ingest_image_variants(str(self.source), "scene-1", 5, staging_dir=self.staging_dir, fallback="none")
            self.assertIn("no viable operation", str(ctx.exception))

    def test_publishes_every_returned_variant(self):
        finalized = FinalizedPair(
            scene_brief_id="scene-1",
            base_path=str(self.source),
            variant_path=str(self.source),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="scene-1_v1",
        )
        variants = [(finalized, {"id": f"scene-1_v{n}"}) for n in (1, 2, 3)]
        published_entries = [{"id": f"scene-1_v{n}", "baseImage": "levels/a.jpg"} for n in (1, 2, 3)]

        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair_variants", return_value=(variants, {})
        ), patch("generate_photo_batch.publish_pair", side_effect=published_entries) as mocked_publish:
            result = ingest_image_variants(str(self.source), "scene-1", 3, staging_dir=self.staging_dir)

        self.assertEqual(mocked_publish.call_count, 3)
        self.assertEqual([entry["id"] for entry in result], ["scene-1_v1", "scene-1_v2", "scene-1_v3"])


class TestIngestCommand(unittest.TestCase):
    def setUp(self):
        self.runner = CliRunner()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.tmp_path = Path(self.tmp.name)
        self.levels_dir = self.tmp_path / "levels"
        self.manifest_path = self.tmp_path / "manifest.json"

    def _finalized_and_publish_patches(self, base_source):
        finalized = FinalizedPair(
            scene_brief_id="ignored",
            base_path=str(base_source),
            variant_path=str(base_source),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="ignored",
        )
        return patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair",
            return_value=(finalized, {"manifest_entry": {"id": "ignored", "title": "T"}}),
        )

    def test_missing_file_is_reported_without_crashing(self):
        result = self.runner.invoke(app, ["/nonexistent/image.png"])
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Not found", result.stdout)

    def test_id_flag_rejected_for_multiple_images(self):
        source_a = self.tmp_path / "a.jpg"
        source_b = self.tmp_path / "b.jpg"
        _make_source(source_a)
        _make_source(source_b)

        result = self.runner.invoke(app, [str(source_a), str(source_b), "--id", "one-id-for-two"])

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("only apply to a single image", result.stdout)

    def test_single_image_with_explicit_id_publishes_under_that_id(self):
        source = self.tmp_path / "source.jpg"
        _make_source(source)
        gate_patch, structural_patch = self._finalized_and_publish_patches(source)

        with gate_patch, structural_patch, patch(
            "generate_photo_batch.publish_pair",
            return_value={"id": "custom_id", "baseImage": "levels/a.jpg", "variantImage": "levels/b.jpg"},
        ) as mocked_publish:
            result = self.runner.invoke(
                app,
                [
                    str(source),
                    "--id",
                    "custom_id",
                    "--manifest",
                    str(self.manifest_path),
                    "--levels-dir",
                    str(self.levels_dir),
                ],
            )

        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertEqual(mocked_publish.call_args.args[0], mocked_publish.call_args.args[0])
        self.assertIn("custom_id", result.stdout)

    def test_directory_batch_ingest_derives_ids_from_filenames(self):
        (self.tmp_path / "images").mkdir()
        source_a = self.tmp_path / "images" / "Cozy Workbench.jpg"
        source_b = self.tmp_path / "images" / "Cozy Workbench.png"
        _make_source(source_a)
        _make_source(source_b)
        gate_patch, structural_patch = self._finalized_and_publish_patches(source_a)

        with gate_patch, structural_patch, patch(
            "generate_photo_batch.publish_pair",
            return_value={"id": "x", "baseImage": "levels/a.jpg", "variantImage": "levels/b.jpg"},
        ):
            result = self.runner.invoke(
                app,
                [
                    str(self.tmp_path / "images"),
                    "--manifest",
                    str(self.manifest_path),
                    "--levels-dir",
                    str(self.levels_dir),
                ],
            )

        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("cozy_workbench", result.stdout)
        self.assertIn("cozy_workbench_2", result.stdout)

    def test_variants_flag_rejected_for_multiple_images(self):
        source_a = self.tmp_path / "a.jpg"
        source_b = self.tmp_path / "b.jpg"
        _make_source(source_a)
        _make_source(source_b)

        result = self.runner.invoke(app, [str(source_a), str(source_b), "--variants", "3"])

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("only apply to a single image", result.stdout)

    def test_variants_below_one_is_rejected(self):
        source = self.tmp_path / "source.jpg"
        _make_source(source)

        result = self.runner.invoke(app, [str(source), "--variants", "0"])

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("must be at least 1", result.stdout)

    def test_variants_flag_publishes_each_variant_as_its_own_row(self):
        source = self.tmp_path / "source.jpg"
        _make_source(source)
        finalized = FinalizedPair(
            scene_brief_id="ignored",
            base_path=str(source),
            variant_path=str(source),
            dimensions=(1200, 900),
            aspect_ratio="4:3",
            manifest_id="ignored",
        )
        variants = [(finalized, {"id": f"source_v{n}"}) for n in (1, 2)]
        published_entries = [{"id": f"source_v{n}", "baseImage": f"levels/source_v{n}_base.jpg"} for n in (1, 2)]

        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair_variants", return_value=(variants, {})
        ), patch("generate_photo_batch.publish_pair", side_effect=published_entries):
            result = self.runner.invoke(
                app,
                [
                    str(source),
                    "--variants",
                    "2",
                    "--manifest",
                    str(self.manifest_path),
                    "--levels-dir",
                    str(self.levels_dir),
                ],
            )

        self.assertEqual(result.exit_code, 0, result.stdout)
        self.assertIn("source_v1", result.stdout)
        self.assertIn("source_v2", result.stdout)

    def test_one_rejection_does_not_stop_the_rest_of_a_batch(self):
        good_source = self.tmp_path / "good.jpg"
        _make_source(good_source)
        bad_source = self.tmp_path / "missing.jpg"  # never created

        gate_patch, structural_patch = self._finalized_and_publish_patches(good_source)
        with gate_patch, structural_patch, patch(
            "generate_photo_batch.publish_pair",
            return_value={"id": "good", "baseImage": "levels/a.jpg", "variantImage": "levels/b.jpg"},
        ):
            result = self.runner.invoke(
                app,
                [
                    str(good_source),
                    str(bad_source),
                    "--manifest",
                    str(self.manifest_path),
                    "--levels-dir",
                    str(self.levels_dir),
                ],
            )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Published", result.stdout)
        self.assertIn("Not found", result.stdout)


if __name__ == "__main__":
    unittest.main()
