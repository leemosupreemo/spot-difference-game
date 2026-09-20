import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the shipped daily queue references no level from a photo set', () => {
  const queue = JSON.parse(fs.readFileSync(new URL('../../public/daily-queue.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(new URL('../../public/levels/photo_pair_manifest.json', import.meta.url), 'utf8'));
  const inASet = new Set(manifest.filter(e => e.setId).map(e => e.id));
  const queued = queue.queue.flatMap(entry => entry.levels || []);
  const overlap = queued.filter(id => inASet.has(id));
  assert.deepEqual(overlap, [], 'a daily level must not also appear in regular Photography');
});

test('every queued level is actually reserved for the daily challenge', async () => {
  const { isDailyOnlyEntry } = await import('../utils/remoteSetPolicy.js');
  const queue = JSON.parse(fs.readFileSync(new URL('../../public/daily-queue.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(new URL('../../public/levels/photo_pair_manifest.json', import.meta.url), 'utf8'));
  const byId = new Map(manifest.map(e => [e.id, e]));
  for (const id of queue.queue.flatMap(entry => entry.levels || [])) {
    const entry = byId.get(id);
    assert.ok(entry, `${id} is queued but missing from the manifest`);
    assert.ok(isDailyOnlyEntry(entry), `${id} is queued for daily but not reserved for it`);
  }
});

test('the daily picker cannot fall back onto regular levels', () => {
  const source = fs.readFileSync(new URL('./dailyChallenge.js', import.meta.url), 'utf8');
  assert.match(source, /const dailyPool = dailyPoolEntries\(allEntries\)/);
  assert.match(source, /available = dailyPool\.filter/);
  assert.doesNotMatch(source, /available = allEntries\.filter/,
    'the fallback must draw from the reserved pool, never the whole manifest');
});

test('regular play filters the reserved levels out', () => {
  const loader = fs.readFileSync(new URL('../utils/photoPairLevelLoader.js', import.meta.url), 'utf8');
  assert.match(loader, /regularPlayEntries\(selectableEntries\(loadManifest\(\), \{ online \}\)\)/);
  assert.match(loader, /allEntries = regularPlayEntries\(selectableEntries\(allEntries, \{ online \}\)\)/);
});

test('resetAllDailyProgress clears assignments, rotation and results', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null
  };
  for (const k of ['diff_hunter_daily_sets', 'diff_hunter_daily_queue_used',
                   'diff_hunter_daily_player_2026-09-19', 'diff_hunter_daily_leaderboard_2026-09-19',
                   'unrelated_key']) store.set(k, '1');

  const { resetAllDailyProgress } = await import('./dailyChallenge.js?reset-case');
  const cleared = resetAllDailyProgress();
  assert.ok(cleared >= 4, `expected the daily records to be cleared, got ${cleared}`);
  assert.equal(store.has('unrelated_key'), true, 'unrelated storage must survive');
  for (const k of ['diff_hunter_daily_sets', 'diff_hunter_daily_queue_used',
                   'diff_hunter_daily_player_2026-09-19', 'diff_hunter_daily_leaderboard_2026-09-19']) {
    assert.equal(store.has(k), false, `${k} should have been cleared`);
  }
});
