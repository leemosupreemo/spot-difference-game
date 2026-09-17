import assert from 'node:assert/strict';
import test from 'node:test';
import { containsProfanity } from './profanityFilter.js';

test('containsProfanity allows clean names', () => {
  assert.equal(containsProfanity('SpeedHunter'), false);
  assert.equal(containsProfanity('PixelSniper_4821'), false);
  assert.equal(containsProfanity(''), false);
  assert.equal(containsProfanity(null), false);
  assert.equal(containsProfanity(undefined), false);
});

test('containsProfanity does not flag common words that contain ambiguous substrings', () => {
  assert.equal(containsProfanity('Classic'), false);
  assert.equal(containsProfanity('Assassin'), false);
  assert.equal(containsProfanity('Bassist'), false);
  assert.equal(containsProfanity('Sussex'), false);
  assert.equal(containsProfanity('Grasshopper'), false);
});

test('containsProfanity rejects standalone short blocked words', () => {
  assert.equal(containsProfanity('ass'), true);
  assert.equal(containsProfanity('Sex Machine'), true);
  assert.equal(containsProfanity('hoe'), true);
});

test('containsProfanity rejects unambiguous profanity anywhere in the name', () => {
  assert.equal(containsProfanity('fuckboy'), true);
  assert.equal(containsProfanity('BigShitTalker'), true);
  assert.equal(containsProfanity('a_cunt_99'), true);
});

test('containsProfanity catches basic leetspeak evasion', () => {
  assert.equal(containsProfanity('sh1t'), true);
  assert.equal(containsProfanity('5hit'), true);
  assert.equal(containsProfanity('a55hole'), true);
});
