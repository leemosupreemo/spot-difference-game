import json
import tempfile
import unittest
from pathlib import Path

from dedupe_base_images import plan, relative_asset, digest


def write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


class RelativeAssetTests(unittest.TestCase):
    def test_leading_slash_never_escapes_the_root(self):
        # Path(root) / "/levels/x" silently drops root -- this is the guard.
        self.assertEqual(relative_asset("/levels/x_base.jpg"), "levels/x_base.jpg")
        self.assertEqual(relative_asset("levels/x_base.jpg"), "levels/x_base.jpg")
        self.assertEqual(relative_asset("/levels/x_base.jpg?v=2"), "levels/x_base.jpg")


class PlanTests(unittest.TestCase):
    def test_identical_bases_group_under_one_canonical_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for n in (1, 2, 3):
                write(root / f"levels/photo_v{n}_abc_base.webp", b"SAME-BASE")
            entries = [{"id": f"photo_v{n}", "baseImage": f"levels/photo_v{n}_abc_base.webp"}
                       for n in (1, 2, 3)]

            actions, skipped, missing = plan(entries, root)
            self.assertEqual(len(actions), 1)
            self.assertEqual(skipped, [])
            self.assertEqual(missing, [])
            action = actions[0]
            self.assertEqual(len(action["members"]), 3)
            self.assertEqual(len(action["redundant"]), 2)
            self.assertTrue(action["canonical_rel"].endswith("_base.webp"))
            self.assertIn(digest(root / "levels/photo_v1_abc_base.webp"), action["canonical_rel"])

    def test_different_content_is_never_merged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root / "levels/a_base.webp", b"BASE-A")
            write(root / "levels/b_base.webp", b"BASE-B")
            entries = [{"id": "a", "baseImage": "levels/a_base.webp"},
                       {"id": "b", "baseImage": "levels/b_base.webp"}]
            actions, _, _ = plan(entries, root)
            self.assertEqual(len(actions), 2)
            self.assertTrue(all(not a["redundant"] for a in actions))

    def test_same_content_in_different_directories_is_skipped(self):
        # Merging across folders would change a path the app may resolve
        # differently; leave those alone rather than guess.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root / "levels/one/base.jpg", b"SAME")
            write(root / "levels/two/base.jpg", b"SAME")
            entries = [{"id": "a", "baseImage": "levels/one/base.jpg"},
                       {"id": "b", "baseImage": "levels/two/base.jpg"}]
            actions, skipped, _ = plan(entries, root)
            self.assertEqual(actions, [])
            self.assertEqual(len(skipped), 1)

    def test_missing_files_are_reported_not_merged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            entries = [{"id": "a", "baseImage": "levels/gone_base.webp"}]
            actions, _, missing = plan(entries, root)
            self.assertEqual(actions, [])
            self.assertEqual(missing, ["levels/gone_base.webp"])

    def test_leading_slash_entries_resolve(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root / "levels/x_base.jpg", b"CONTENT")
            actions, _, missing = plan([{"id": "x", "baseImage": "/levels/x_base.jpg"}], root)
            self.assertEqual(missing, [])
            self.assertEqual(len(actions), 1)

    def test_variant_images_are_never_touched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root / "levels/shared_base.webp", b"SAME-BASE")
            write(root / "levels/p_v1_variant.webp", b"V1")
            write(root / "levels/p_v2_variant.webp", b"V2")
            entries = [{"id": "p_v1", "baseImage": "levels/shared_base.webp",
                        "variantImage": "levels/p_v1_variant.webp"},
                       {"id": "p_v2", "baseImage": "levels/shared_base.webp",
                        "variantImage": "levels/p_v2_variant.webp"}]
            actions, _, _ = plan(entries, root)
            self.assertEqual(len(actions), 1)
            # Both variants survive as distinct files; only bases are collapsed.
            self.assertTrue((root / "levels/p_v1_variant.webp").exists())
            self.assertTrue((root / "levels/p_v2_variant.webp").exists())


if __name__ == "__main__":
    unittest.main()
