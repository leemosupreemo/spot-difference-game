"""Failure classification must never treat broken inputs as editable scenes."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from typer.testing import CliRunner

from ingest_failure_report import classify_rejection
from generate_photo_batch import app


class FailureClassificationTests(unittest.TestCase):
    def test_structural_limits_offer_only_local_assessment(self):
        decision = classify_rejection(["ObjectCountReject: object_count 4 below 18"])
        self.assertEqual(decision["category"], "structural_limit")
        self.assertEqual(decision["next_step"], "assess_local_targets")
        self.assertEqual(decision["candidate_methods"], ["star_blob", "segmented_edit", "texture_inpaint"])

    def test_quality_failure_takes_precedence_over_structural_failure(self):
        # The human recommendation stays "review the source" even though the
        # image still gets a second pass; a passing edit does not clear a bad source.
        decision = classify_rejection(["PeerGroupReject: one group", "SharpnessUniformityReject: blurry"])
        self.assertEqual(decision["category"], "source_quality")
        self.assertEqual(decision["next_step"], "review_source")
        self.assertTrue(decision["routes_to_fallback"])

    def test_router_early_exit_object_count_is_classified(self):
        decision = classify_rejection(["LocalGateReject: Universal Gate Fail: Too few objects (4 < 14)."])
        self.assertEqual(decision["category"], "structural_limit")

    def test_unknown_router_failure_requires_inspection(self):
        decision = classify_rejection(["LocalGateReject: something unexpected"])
        self.assertEqual(decision["category"], "unknown")
        self.assertEqual(decision["next_step"], "inspect_failure")
        self.assertTrue(decision["routes_to_fallback"])

    def test_missing_file_is_not_a_fallback_candidate(self):
        # The only category that never routes: there is no decoded master to edit.
        decision = classify_rejection(["Not found: /some/image.jpg"])
        self.assertEqual(decision["category"], "input_error")
        self.assertFalse(decision["routes_to_fallback"])
        self.assertFalse(decision["automatic_retry"])
        self.assertEqual(decision["candidate_methods"], [])

    def test_generic_quality_rejection_stays_conservative(self):
        decision = classify_rejection(["LocalGateReject: Universal Gate Fail: Low texture / plain background"])
        self.assertEqual(decision["category"], "source_quality")

    def test_no_structural_candidate_can_be_assessed(self):
        decision = classify_rejection(["NoStructuralCandidate: exhausted operations"])
        self.assertEqual(decision["category"], "structural_limit")


class FailureReportTests(unittest.TestCase):
    def test_unclassified_structural_code_still_reaches_the_second_pass(self):
        # An unrecognized code must not silently drop an image out of the funnel.
        decision = classify_rejection(["SomeNewStructuralCode: added later"])
        self.assertEqual(decision["category"], "unknown")
        self.assertEqual(decision["next_step"], "inspect_failure")
        self.assertTrue(decision["routes_to_fallback"])

    def test_empty_operation_queue_is_a_structural_limit(self):
        # The gate scores recolor affordance, which the structural-only
        # operation queue cannot use; an empty queue is not a bad source.
        decision = classify_rejection(["NoAllowedOperation: NoAllowedOperation"])
        self.assertEqual(decision["category"], "structural_limit")
        self.assertEqual(decision["next_step"], "assess_local_targets")

    def test_unexpected_crash_is_never_a_structural_limit(self):
        from ingest_failure_report import rejection_record

        record = rejection_record("/tmp/x.png", "x", 1, "Medium", RuntimeError("cuda blew up"))
        self.assertEqual(record["reasons"], ["RuntimeError: cuda blew up"])
        self.assertEqual(record["fallback"]["category"], "unknown")
        self.assertEqual(record["fallback"]["next_step"], "inspect_failure")

    def test_report_cannot_replace_the_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "manifest.json"
            manifest.write_text("[]")
            result = CliRunner().invoke(app, ["missing.jpg", "--manifest", str(manifest), "--report", str(manifest)])
            self.assertEqual(result.exit_code, 1)
            self.assertIn("must not overwrite", result.output)
            self.assertEqual(manifest.read_text(), "[]")

    def test_full_gate_reasons_survive_staging_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            Image.new("RGB", (1536, 1152), (90, 100, 110)).save(source)
            report = root / "reports" / "ingest.json"
            manifest = root / "manifest.json"
            failures = ("ObjectCountReject: 4 below 18", "PeerGroupReject: 1 below 2")
            with patch("generate_photo_batch.run_local_gates", return_value=(False, failures, {})):
                result = CliRunner().invoke(app, [str(source), "--variants", "5", "--fallback", "none",
                                                  "--report", str(report), "--manifest", str(manifest)])
            self.assertEqual(result.exit_code, 1, result.output)
            record = json.loads(report.read_text())["images"][0]
            self.assertEqual(record["reasons"], list(failures))
            self.assertEqual(record["stage"], "local_gates")
            self.assertEqual(record["source"], str(source.resolve()))
            self.assertEqual(record["requested_variants"], 5)
            self.assertEqual(record["fallback"]["next_step"], "assess_local_targets")
            self.assertFalse(manifest.exists())

    def test_one_crashing_image_does_not_abort_the_batch_or_lose_the_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second = root / "a.png", root / "b.png"
            for path in (first, second):
                Image.new("RGB", (1536, 1152), (90, 100, 110)).save(path)
            report = root / "report.json"
            outcomes = [RuntimeError("segmentation backend died"),
                        ValueError("SharpnessUniformityReject: blur")]
            with patch("generate_photo_batch.ingest_image", side_effect=outcomes):
                result = CliRunner().invoke(app, [str(first), str(second),
                    "--report", str(report), "--manifest", str(root / "manifest.json")])
            self.assertEqual(result.exit_code, 1, result.output)
            records = json.loads(report.read_text())["images"]
            self.assertEqual(len(records), 2)
            self.assertEqual(records[0]["status"], "error")
            self.assertIn("RuntimeError", records[0]["traceback"])
            self.assertEqual(records[0]["fallback"]["next_step"], "inspect_failure")
            self.assertEqual(records[1]["status"], "rejected")
            self.assertEqual(records[1]["fallback"]["category"], "source_quality")

    def test_missing_file_is_saved_in_report(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "report.json"
            result = CliRunner().invoke(app, [str(Path(directory) / "missing.jpg"), "--report", str(report)])
            self.assertEqual(result.exit_code, 1, result.output)
            record = json.loads(report.read_text())["images"][0]
            self.assertEqual(record["fallback"]["category"], "input_error")


if __name__ == "__main__":
    unittest.main()
