import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'DeviceSimulatorHarness.jsx'
);

test('DeviceSimulatorHarness defines comprehensive iPhone and iPad presets', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Phone presets
  assert.match(source, /id:\s*'iphone-se'/);
  assert.match(source, /id:\s*'iphone-standard'/);
  assert.match(source, /id:\s*'iphone-max'/);
  assert.match(source, /landscapeWidth:\s*667/);
  assert.match(source, /landscapeHeight:\s*375/);
  assert.match(source, /landscapeWidth:\s*844/);
  assert.match(source, /landscapeHeight:\s*390/);
  assert.match(source, /landscapeWidth:\s*932/);
  assert.match(source, /landscapeHeight:\s*430/);

  // iPad presets
  assert.match(source, /id:\s*'ipad-11'/);
  assert.match(source, /id:\s*'ipad-13'/);
  assert.match(source, /landscapeWidth:\s*1180/);
  assert.match(source, /landscapeHeight:\s*820/);
  assert.match(source, /landscapeWidth:\s*1366/);
  assert.match(source, /landscapeHeight:\s*1024/);

  // Orientation & auto scale controls
  assert.match(source, /RotateCw/);
  assert.match(source, /computedScale/);
  assert.match(source, /isSimulatorFeatureEnabled/);
});

