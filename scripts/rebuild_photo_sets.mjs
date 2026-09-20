#!/usr/bin/env node
/**
 * Rebuild the bundled photo sets from whatever survived curation.
 *
 * Sets are only offered when they hold exactly five entries, so pruning a
 * dismissed level does not just remove that level -- it takes its whole set out
 * of play until the remaining four are regrouped. Reallocating turns 16 removals
 * back into complete sets instead of 11 broken ones.
 *
 * Levels reserved for the daily challenge are left out: they are not part of
 * regular play and must never be pulled into a photo set. Anything left over
 * after the last complete five keeps no set metadata, so it stays in the
 * manifest without forming a partial set that could never be served.
 *
 * Usage: node scripts/rebuild_photo_sets.mjs [--apply]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocateSets, baseKey } from './group_remote_sets.mjs';
import { isDailyOnlyEntry } from '../src/utils/remoteSetPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, '../public/levels/photo_pair_manifest.json');
const SET_SIZE = 5;

/** Assign `photo_set_NNN` ids to complete fives; the remainder stays unassigned. */
export function rebuildSets(entries, setSize = SET_SIZE) {
  const daily = entries.filter(isDailyOnlyEntry);
  const eligible = entries.filter(e => !isDailyOnlyEntry(e));

  const allocated = allocateSets(eligible, setSize)
    .sort((a, b) => b.length - a.length);
  const complete = allocated.filter(group => group.length === setSize);
  const leftover = allocated.filter(group => group.length !== setSize).flat();

  const assigned = [];
  complete.forEach((group, index) => {
    const setId = `photo_set_${String(index + 1).padStart(3, '0')}`;
    group.forEach((entry, i) => assigned.push({ ...entry, setId, sequence: i + 1 }));
  });
  // A partial group can never be served as a set, so it carries no set metadata
  // rather than pretending to be one.
  const singles = leftover.map(({ setId, sequence, ...rest }) => rest);
  return { assigned, singles, daily, setCount: complete.length };
}

function main() {
  const apply = process.argv.includes('--apply');
  const entries = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const { assigned, singles, daily, setCount } = rebuildSets(entries);

  console.log(`manifest entries : ${entries.length}`);
  console.log(`daily reserved   : ${daily.length} (left out of photo sets)`);
  console.log(`complete sets    : ${setCount} (${assigned.length} levels)`);
  console.log(`unassigned spare : ${singles.length}`);

  let repeats = 0;
  for (let i = 0; i < assigned.length; i += SET_SIZE) {
    const group = assigned.slice(i, i + SET_SIZE);
    if (new Set(group.map(baseKey)).size !== group.length) repeats++;
  }
  console.log(`sets repeating a base image: ${repeats}`);

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); return; }

  const next = [...assigned, ...singles, ...daily];
  if (next.length !== entries.length) {
    throw new Error(`Refusing to write: ${next.length} entries out, ${entries.length} in`);
  }
  const tmp = path.join(os.tmpdir(), `manifest.${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n');
  fs.renameSync(tmp, MANIFEST);
  console.log(`\nWrote ${MANIFEST}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
