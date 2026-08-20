import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { deleteLevelAssetsAndManifestEntries } from '../../scripts/curationLevelPruner.mjs';

test('deleteLevelAssetsAndManifestEntries deletes image files and updates manifest JSON files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-test-'));
  const levelsDir = path.join(tmpDir, 'public/levels');
  const photoPairsDir = path.join(levelsDir, 'photo-pairs/test_category/level_to_delete');
  
  fs.mkdirSync(photoPairsDir, { recursive: true });

  const baseImg = path.join(photoPairsDir, 'base.jpg');
  const variantImg = path.join(photoPairsDir, 'variant.jpg');
  fs.writeFileSync(baseImg, 'fake-base-image-data');
  fs.writeFileSync(variantImg, 'fake-variant-image-data');

  const manifestData = [
    {
      id: 'level_to_delete',
      title: 'Delete Me Level',
      baseImage: 'levels/photo-pairs/test_category/level_to_delete/base.jpg',
      variantImage: 'levels/photo-pairs/test_category/level_to_delete/variant.jpg'
    },
    {
      id: 'level_to_keep',
      title: 'Keep Me Level',
      baseImage: 'levels/photo-pairs/test_category/level_to_keep/base.jpg',
      variantImage: 'levels/photo-pairs/test_category/level_to_keep/variant.jpg'
    }
  ];

  const manifestPath = path.join(levelsDir, 'photo_pair_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));

  // Run the deletion
  const result = deleteLevelAssetsAndManifestEntries(['level_to_delete'], { projectRoot: tmpDir });

  assert.equal(result.success, true);
  assert.deepEqual(result.deletedLevelIds, ['level_to_delete']);
  assert.equal(fs.existsSync(baseImg), false, 'base.jpg should be deleted');
  assert.equal(fs.existsSync(variantImg), false, 'variant.jpg should be deleted');
  assert.equal(fs.existsSync(photoPairsDir), false, 'level directory should be removed');

  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(updatedManifest.length, 1);
  assert.equal(updatedManifest[0].id, 'level_to_keep');

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
