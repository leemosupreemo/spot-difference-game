import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalBaseUrl } from './repair_remote_pack_base_urls.mjs';

const HOST = 'https://diff-hunter-progress-20260810.web.app/levels/';
const present = (names) => (f) => names.includes(f);

test('repoints a pre-dedupe base URL at its content-addressed file', () => {
  assert.equal(
    canonicalBaseUrl(`${HOST}optical_fiber_v4_cfdec592b3ce_base.webp`, present(['cfdec592b3ce_base.webp'])),
    `${HOST}cfdec592b3ce_base.webp`
  );
});

test('leaves an already-canonical URL alone', () => {
  assert.equal(canonicalBaseUrl(`${HOST}cfdec592b3ce_base.webp`, present(['cfdec592b3ce_base.webp'])), null);
});

test('never guesses when the canonical file is absent', () => {
  // A missing target means something else is wrong; rewriting would just move
  // the 404 to a different filename and hide it.
  assert.equal(canonicalBaseUrl(`${HOST}scene_v1_aaaaaaaaaaaa_base.webp`, present([])), null);
});

test('ignores paths with no digest to work from', () => {
  assert.equal(canonicalBaseUrl(`${HOST}photo-pairs/nursery/base.jpg`, present(['base.jpg'])), null);
  assert.equal(canonicalBaseUrl(`${HOST}legacy_base.jpg`, present([])), null);
});

test('preserves the host and directory, changing only the filename', () => {
  const out = canonicalBaseUrl(
    'https://example.com/a/b/scene_v2_0123456789ab_base.jpg',
    present(['0123456789ab_base.jpg'])
  );
  assert.equal(out, 'https://example.com/a/b/0123456789ab_base.jpg');
});

test('strips a query string rather than rewriting around it', () => {
  assert.equal(
    canonicalBaseUrl(`${HOST}scene_v1_0123456789ab_base.webp?v=2`, present(['0123456789ab_base.webp'])),
    `${HOST}0123456789ab_base.webp`
  );
});

test('tolerates junk input', () => {
  for (const bad of [null, undefined, 42, '']) assert.equal(canonicalBaseUrl(bad, present([])), null);
});
