import unittest

from backfill_variant_codes import backfill_entries, infer_operation


class BackfillTests(unittest.TestCase):
    def test_existing_metadata_produces_a_complete_code(self):
        updated, stats = backfill_entries([
            {"id": "a", "operation": "add", "generationMethod": "structural"},
            {"id": "b", "operation": "recolor", "generationMethod": "local_star"},
        ])
        self.assertEqual([e["variantCode"] for e in updated], ["STR-ADD", "LST-CLR"])
        self.assertEqual(stats["coded"], 2)
        self.assertEqual(stats["unknown"], 0)

    def test_operation_is_recovered_from_an_unambiguous_diff(self):
        updated, stats = backfill_entries([
            {"id": "a", "diffs": [{"id": 1, "operation": "remove"}]},
        ])
        self.assertEqual(updated[0]["operation"], "remove")
        self.assertEqual(updated[0]["variantCode"], "STR-REM")
        self.assertEqual(stats["operation_recovered"], 1)

    def test_conflicting_diffs_are_never_resolved_by_guessing(self):
        entry = {"id": "a", "diffs": [{"operation": "add"}, {"operation": "remove"}]}
        self.assertIsNone(infer_operation(entry))
        updated, stats = backfill_entries([entry])
        self.assertEqual(updated[0]["variantCode"], "???-???")
        self.assertNotIn("operation", updated[0])
        self.assertEqual(stats["unknown"], 1)

    def test_entry_with_no_operation_anywhere_is_marked_unknown(self):
        updated, stats = backfill_entries([
            {"id": "legacy", "diffs": [{"id": 1, "x": 50, "y": 50, "hint": "look closely"}]},
        ])
        self.assertEqual(updated[0]["variantCode"], "???-???")
        self.assertEqual(stats["unknown"], 1)

    def test_ids_and_asset_paths_are_never_modified(self):
        original = {"id": "keep_me_v1", "operation": "add",
                    "baseImage": "levels/keep_me_v1_abc_base.webp",
                    "variantImage": "levels/keep_me_v1_def_variant.webp"}
        updated, _ = backfill_entries([original])
        self.assertEqual(updated[0]["id"], "keep_me_v1")
        self.assertEqual(updated[0]["baseImage"], original["baseImage"])
        self.assertEqual(updated[0]["variantImage"], original["variantImage"])

    def test_backfill_is_idempotent_and_non_mutating(self):
        source = [{"id": "a", "operation": "add"}]
        once, _ = backfill_entries(source)
        twice, _ = backfill_entries(once)
        self.assertEqual(once, twice)
        self.assertNotIn("variantCode", source[0], "input must not be mutated")


if __name__ == "__main__":
    unittest.main()
