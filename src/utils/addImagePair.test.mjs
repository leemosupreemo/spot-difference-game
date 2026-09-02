import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidPhotoPairEntry } from './photoPairManifest.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/add_image_pair.mjs');
const BASE_IMG = path.resolve(__dirname, '../../public/levels/fresh_nature_pair_001_base.jpg');
const VAR_IMG = path.resolve(__dirname, '../../public/levels/fresh_nature_pair_001_variant.jpg');

test('add_image_pair.mjs dry-run analyzes diff and produces a valid manifest entry', async () => {
  const { stdout } = await execFileAsync('node', [
    SCRIPT_PATH,
    '--base', BASE_IMG,
    '--variant', VAR_IMG,
    '--title', 'Test Tidepool',
    '--pack', 'Test Discovery',
    '--dry-run'
  ]);

  assert.match(stdout, /Detected Diff/);
  assert.match(stdout, /DRY RUN/);

  // Extract JSON block
  const jsonMatch = stdout.match(/\{[\s\S]*"diffs":[\s\S]*\}/);
  assert.ok(jsonMatch, 'Generated JSON not found in stdout');

  const entry = JSON.parse(jsonMatch[0]);
  assert.equal(isValidPhotoPairEntry(entry), true);
  assert.equal(entry.title, 'Test Tidepool');
  assert.equal(entry.packId, 'test_discovery');
  assert.equal(entry.diffs.length, 1);
  assert.ok(entry.diffs[0].x >= 5 && entry.diffs[0].x <= 95);
  assert.ok(entry.diffs[0].y >= 5 && entry.diffs[0].y <= 95);
  assert.ok(entry.diffs[0].radius >= 3 && entry.diffs[0].radius <= 10);
});
