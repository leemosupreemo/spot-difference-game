import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from typer.testing import CliRunner

from base_generation_types import FinalizedPair
from generate_photo_batch import app, ingest_image


class TestIngestImage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "source.png"
        Image.new("RGB", (1536, 1152), (100, 110, 120)).save(self.source)
        self.staging_dir = Path(self.tmp.name) / "staging"
        self.staging_dir.mkdir()

    def test_rejects_missing_file(self):
        with self.assertRaises(ValueError):
            ingest_image(str(Path(self.tmp.name) / "missing.png"), "scene-1", staging_dir=self.staging_dir)

    def test_rejects_invalid_difficulty(self):
        with self.assertRaises(ValueError):
            ingest_image(str(self.source), "scene-1", difficulty="Impossible", staging_dir=self.staging_dir)

    def test_local_gate_rejection_stops_before_structural_pipeline(self):
        with patch(
            "generate_photo_batch.run_local_gates", return_value=(False, ("SomeReject: bad",), {})
        ), patch("generate_photo_batch.generate_structural_pair") as mocked_structural:
            with self.assertRaises(ValueError) as ctx:
                ingest_image(str(self.source), "scene-1", staging_dir=self.staging_dir)
            self.assertIn("SomeReject", str(ctx.exception))
            mocked_structural.assert_not_called()

    def test_structural_rejection_is_surfaced(self):
        with patch("generate_photo_batch.run_local_gates", return_value=(True, (), {})), patch(
            "generate_photo_batch.generate_structural_pair",
            return_value=(None, {"rejection_reason": "no viable operation"}),
        ):
            with self.assertRaises(ValueError) as ctx:
                ingest_image(str(self.source), "scene-1", staging_dir=self.staging_dir)
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


class TestIngestCommand(unittest.TestCase):
    def test_cli_reports_missing_file(self):
        runner = CliRunner()
        result = runner.invoke(app, ["ingest", "/nonexistent/image.png", "--id", "scene-1"])
        self.assertNotEqual(result.exit_code, 0)


if __name__ == "__main__":
    unittest.main()
