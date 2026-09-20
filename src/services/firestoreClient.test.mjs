import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestoreClient } from './firestoreClient.js';

const config = { apiKey: 'test-key', projectId: 'test-project', appId: 'test-app-id' };

const here = path.dirname(fileURLToPath(import.meta.url));

test('the same app always yields the same instance', async () => {
  const app = initializeApp(config, 'same-instance');
  try {
    const a = getFirestoreClient(app);
    const b = getFirestoreClient(app);
    assert.equal(a, b, 'starting Firestore twice for one app would throw');
  } finally { await deleteApp(app); }
});

test('a direct getFirestore first does not break the accessor', async () => {
  // initializeFirestore throws once Firestore has started for an app. The
  // accessor must hand back the running instance instead of failing.
  const { getFirestore } = await import('firebase/firestore');
  const app = initializeApp(config, 'already-started');
  try {
    const direct = getFirestore(app);
    assert.equal(getFirestoreClient(app), direct);
  } finally { await deleteApp(app); }
});

test('separate apps get separate instances', async () => {
  const one = initializeApp(config, 'app-one');
  const two = initializeApp(config, 'app-two');
  try {
    assert.notEqual(getFirestoreClient(one), getFirestoreClient(two));
  } finally { await deleteApp(one); await deleteApp(two); }
});

test('a missing app is refused rather than producing a broken handle', () => {
  assert.throws(() => getFirestoreClient(null), /needs a Firebase app/);
  assert.throws(() => getFirestoreClient(undefined), /needs a Firebase app/);
});

test('long-polling auto-detection is actually requested', () => {
  const source = fs.readFileSync(path.join(here, 'firestoreClient.js'), 'utf8');
  assert.match(source, /experimentalAutoDetectLongPolling:\s*true/);
  assert.match(source, /initializeFirestore\(app,/);
});

test('no service starts Firestore on its own', () => {
  // initializeFirestore throws once getFirestore has run for an app, so a
  // stray direct call would silently keep the default WebChannel transport
  // depending on import order -- the bug this centralisation prevents.
  const services = fs.readdirSync(here).filter(f => f.endsWith('.js') && f !== 'firestoreClient.js');
  for (const file of services) {
    const source = fs.readFileSync(path.join(here, file), 'utf8');
    assert.doesNotMatch(source, /\bgetFirestore\(/,
      `${file} must use getFirestoreClient so the transport setting applies`);
  }
});
