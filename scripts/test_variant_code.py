import unittest

from variant_code import variant_code, is_complete, method_code, operation_code


class VariantCodeTests(unittest.TestCase):
    def test_every_pipeline_combination_has_a_code(self):
        cases = {
            ("structural", "add"): "STR-ADD",
            ("structural", "remove"): "STR-REM",
            ("structural", "reorder"): "STR-MOV",
            ("structural", "recolor"): "STR-CLR",
            ("local_star", "recolor"): "LST-CLR",
            ("local_segmented", "recolor"): "LSG-CLR",
            ("local_star", "duplicate"): "LST-DUP",
            ("local_segmented", "duplicate"): "LSG-DUP",
        }
        for (method, operation), expected in cases.items():
            entry = {"generationMethod": method, "operation": operation}
            self.assertEqual(variant_code(entry), expected)
            self.assertTrue(is_complete(variant_code(entry)))

    def test_legacy_entry_without_method_is_assumed_structural(self):
        # Every level predating the local fallbacks came from that pipeline.
        self.assertEqual(variant_code({"operation": "add"}), "STR-ADD")

    def test_entry_with_neither_field_is_fully_unknown(self):
        code = variant_code({})
        self.assertEqual(code, "???-???")
        self.assertFalse(is_complete(code))

    def test_unrecognized_values_are_never_guessed(self):
        self.assertEqual(variant_code({"generationMethod": "diffusion", "operation": "morph"}),
                         "???-???")
        self.assertEqual(method_code("diffusion"), "???")
        self.assertEqual(operation_code("morph"), "???")

    def test_case_and_whitespace_are_tolerated(self):
        self.assertEqual(variant_code({"generationMethod": " Local_Star ", "operation": "RECOLOR"}),
                         "LST-CLR")

    def test_non_mapping_input_is_safe(self):
        for bad in (None, "structural", 42, ["add"]):
            self.assertEqual(variant_code(bad), "???-???")


if __name__ == "__main__":
    unittest.main()
