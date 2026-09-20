import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeValue, decodeFields, decodeDocuments, listCollection } from './firestoreRest.js';

test('every Firestore value type unwraps to plain JS', () => {
  assert.equal(decodeValue({ stringValue: 'hi' }), 'hi');
  assert.equal(decodeValue({ booleanValue: true }), true);
  // Integers arrive as strings because JSON cannot hold a 64-bit int.
  assert.equal(decodeValue({ integerValue: '42' }), 42);
  assert.equal(decodeValue({ doubleValue: 1.5 }), 1.5);
  assert.equal(decodeValue({ nullValue: null }), null);
  assert.deepEqual(decodeValue({ arrayValue: { values: [{ stringValue: 'a' }] } }), ['a']);
  assert.deepEqual(decodeValue({ mapValue: { fields: { x: { integerValue: '1' } } } }), { x: 1 });
  assert.equal(decodeValue({ unknownType: 1 }), undefined, 'unknown types are dropped, not guessed');
  assert.equal(decodeValue(null), undefined);
});

test('an empty array is preserved rather than becoming undefined', () => {
  assert.deepEqual(decodeValue({ arrayValue: {} }), []);
});

test('a level entry survives the round trip intact', () => {
  const fields = {
    id: { stringValue: 'lvl_1' },
    sequence: { integerValue: '3' },
    isPlaceholder: { booleanValue: false },
    diffs: { arrayValue: { values: [
      { mapValue: { fields: { id: { integerValue: '1' }, x: { doubleValue: 50.5 } } } }
    ] } }
  };
  assert.deepEqual(decodeFields(fields), {
    id: 'lvl_1', sequence: 3, isPlaceholder: false, diffs: [{ id: 1, x: 50.5 }]
  });
});

test('documents carry their id from the resource name', () => {
  const docs = decodeDocuments({ documents: [
    { name: 'projects/p/databases/(default)/documents/packs/pack_007', fields: { active: { booleanValue: true } } }
  ] });
  assert.deepEqual(docs, [{ id: 'pack_007', active: true }]);
  assert.deepEqual(decodeDocuments({}), [], 'an empty response is not an error');
});

test('a failing response rejects instead of hanging', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403 });
  await assert.rejects(
    listCollection('packs', { projectId: 'p', apiKey: 'k', fetchImpl }),
    /failed: 403/
  );
});

test('missing credentials are refused up front', async () => {
  await assert.rejects(listCollection('packs', { apiKey: 'k' }), /needs projectId and apiKey/);
  await assert.rejects(listCollection('packs', { projectId: 'p' }), /needs projectId and apiKey/);
});

test('paging follows nextPageToken and then stops', async () => {
  const pages = [
    { documents: [{ name: 'a/one', fields: {} }], nextPageToken: 'tok' },
    { documents: [{ name: 'a/two', fields: {} }] }
  ];
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { ok: true, json: async () => pages[seen.length - 1] };
  };
  const docs = await listCollection('packs', { projectId: 'p', apiKey: 'k', fetchImpl });
  assert.deepEqual(docs.map(d => d.id), ['one', 'two']);
  assert.equal(seen.length, 2);
  assert.match(seen[1], /pageToken=tok/);
});

test('a token that never clears cannot spin forever', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => ({ documents: [], nextPageToken: 'always' }) };
  };
  await listCollection('packs', { projectId: 'p', apiKey: 'k', fetchImpl });
  assert.ok(calls <= 20, `paging must be bounded, made ${calls} requests`);
});

test('the api key is escaped into the query string', async () => {
  let url = '';
  const fetchImpl = async (u) => { url = u; return { ok: true, json: async () => ({}) }; };
  await listCollection('packs', { projectId: 'p', apiKey: 'a b&c', fetchImpl });
  assert.match(url, /key=a%20b%26c/);
});
