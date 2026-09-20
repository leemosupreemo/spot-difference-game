/**
 * Guards the containment chain that lets the hint radar bleed past the artwork.
 *
 * A difference near an image edge puts most of the radar ring outside the
 * canvas. It must stay visible, bounded only by the browser viewport. Layout is
 * not testable here, so these assert the CSS facts that make it true -- each one
 * is a rule that silently re-crops the ring if it regresses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Strip comments up front: a brace inside one would otherwise truncate rule
// matching, and prose about overflow would read as a declaration.
const CSS = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of a top-level rule, e.g. ".canvas-card { ... }". */
function ruleBody(selector) {
  const pattern = new RegExp(
    `(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm'
  );
  const match = CSS.match(pattern);
  assert.ok(match, `expected a rule for ${selector}`);
  return match[2];
}

function declaration(selector, property) {
  const match = ruleBody(selector).match(
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i')
  );
  return match ? match[1].trim() : null;
}

test('the hint radar is not clipped by its own card', () => {
  assert.equal(declaration('.canvas-card', 'overflow'), 'visible',
    '.canvas-card must not crop the radar at the artwork edge');
});

test('no ancestor between the card and the page clips the radar', () => {
  assert.equal(declaration('.screen-view-transition', 'overflow'), 'visible');
  assert.equal(declaration('.screen-view-transition', 'overflow-x'), null);
  assert.equal(declaration('.screen-view-transition', 'overflow-y'), null);
});

test('the invalid overflow pair never comes back on the game view', () => {
  // CSS Overflow 3: when one axis is `visible` and the other is not, `visible`
  // computes to `auto`. So `overflow-x: hidden; overflow-y: visible` does NOT
  // mean "clip sideways, bleed vertically" -- it makes a scroll container that
  // clips BOTH axes. That is the exact bug this guards against.
  const body = ruleBody('.screen-view-transition');
  const hasAxisHidden = /overflow-x\s*:\s*(hidden|auto|scroll)/i.test(body);
  const hasAxisVisible = /overflow-y\s*:\s*visible/i.test(body);
  assert.ok(!(hasAxisHidden && hasAxisVisible),
    'overflow-x:hidden with overflow-y:visible silently clips both axes');
});

test('the page edge is what bounds the radar horizontally', () => {
  // This is the intended clip: the browser edge, not the artwork edge.
  assert.equal(declaration('body', 'overflow-x'), 'hidden');
});

test('a bleeding radar clears the HUD but stays under modals', () => {
  const z = Number(declaration('.hint-radar', 'z-index'));
  assert.ok(Number.isFinite(z), '.hint-radar needs an explicit z-index');
  assert.ok(z > 40, `radar must paint above HUD chrome, got ${z}`);
  assert.ok(z < 50, `radar must stay under modals (z-index 50+), got ${z}`);
});

test('the radar can actually extend beyond the card it sits in', () => {
  // It is centred on the difference and grows to 1.6x, so a difference at the
  // very edge leaves roughly half the ring outside the artwork. If this ever
  // shrinks to something that always fits, the clipping bug becomes invisible
  // rather than fixed.
  const size = declaration('.hint-radar', 'width');
  assert.match(size, /^\d+px$/);
  assert.ok(parseInt(size, 10) >= 48, 'radar too small to meaningfully bleed');
  assert.match(declaration('.hint-radar', 'transform'), /translate\(-50%,\s*-50%\)/,
    'radar must be centred on the difference, not offset to stay inside');
});
