import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const victoryModalSource = fs.readFileSync(path.join(here, 'VictoryModal.jsx'), 'utf8');
const dailyVictoryModalSource = fs.readFileSync(path.join(here, 'DailyVictoryModal.jsx'), 'utf8');
const progressModalSource = fs.readFileSync(path.join(here, 'ProgressModal.jsx'), 'utf8');
const appSource = fs.readFileSync(path.join(here, '../App.jsx'), 'utf8');

test('VictoryModal conforms to the Set Complete modal layout requirements', () => {
  // Title reads "Set Complete!"
  assert.match(victoryModalSource, /Set Complete!/);

  // Button showing leaderboards to the left of the title
  assert.match(victoryModalSource, /aria-label="View leaderboards"[\s\S]*?worldTitleConfig\.title/i);

  // Star rating centered, then PTS underneath, then time
  assert.match(victoryModalSource, /displayStars[\s\S]*?\{score\.toLocaleString\(\)\} PTS[\s\S]*?\{seconds\}s/);

  // World rank 1st/2nd/3rd title config with trophies and personal best badge
  assert.match(victoryModalSource, /World 1st!/);
  assert.match(victoryModalSource, /World 2nd!/);
  assert.match(victoryModalSource, /World 3rd!/);
  assert.match(victoryModalSource, /\(personal best!\)/);
  assert.doesNotMatch(victoryModalSource, /\(world 1st!\)/);

  // Share button appears to the left of the record time when record is achieved
  assert.match(victoryModalSource, /canShare && \(\s*<button[\s\S]*?aria-label="Share result"[\s\S]*?\{seconds\}s/);

  // Subsection with left-aligned details and right-aligned values
  assert.match(victoryModalSource, /!isAbstract && \([\s\S]*?Set #[\s\S]*?Attempt #[\s\S]*?Percentile/);
  assert.match(victoryModalSource, /fontSize:\s*['"]0\.95rem['"][\s\S]*?Set #/);

  // Abstract / Generative mode drops set records and set data
  assert.match(victoryModalSource, /const isAbstract =/);
  assert.match(victoryModalSource, /isAbstract \? null :/);
});

test('DailyVictoryModal conforms to the Set Complete modal layout requirements', () => {
  // Title reads "Set Complete!" or world rank
  assert.match(dailyVictoryModalSource, /Set Complete!/);

  // Button showing leaderboards to the left of the title
  assert.match(dailyVictoryModalSource, /aria-label="View daily leaderboard"[\s\S]*?worldTitleConfig\.title/);

  // Star rating, then PTS, then time
  assert.match(dailyVictoryModalSource, /stars[\s\S]*?\{score\.toLocaleString\(\)\} PTS[\s\S]*?\{totalSecStr\}s/);

  // Share button to the left of the record time
  assert.match(dailyVictoryModalSource, /aria-label="Share daily result"[\s\S]*?\{totalSecStr\}s/);

  // Daily mode includes Set # and Percentile, but drops Attempt #
  assert.match(dailyVictoryModalSource, /Set #/);
  assert.match(dailyVictoryModalSource, /Percentile/);
  assert.doesNotMatch(dailyVictoryModalSource, /Attempt #/);
});

test('ProgressModal provides set dropdown filter and omits search field', () => {
  assert.match(progressModalSource, /aria-label="Photo Set leaderboard"/);
  assert.match(progressModalSource, /General Leaderboard \(All Sets\)/);
  assert.doesNotMatch(progressModalSource, /placeholder="Search Set #/);
  assert.doesNotMatch(progressModalSource, /aria-label="Search set by number"/);
  assert.doesNotMatch(progressModalSource, /setSearchQuery/);
});

test('App.jsx binds set information and routes set leaderboards', () => {
  assert.match(appSource, /handleOpenSetLeaderboard/);
  assert.match(appSource, /lastSetCompletionInfo/);
  assert.match(appSource, /initialSetId=\{selectedStatsSetId\}/);
});

test('Leaderboard name entry and Hunter Tag editing across victory and progress modals', () => {
  // VictoryModal shows LEADERBOARD QUALIFIED card and handles score submission with custom name
  assert.match(victoryModalSource, /LEADERBOARD QUALIFIED!/);
  assert.match(victoryModalSource, /handleSaveName/);
  assert.match(victoryModalSource, /submitLeaderboardScore/);
  assert.match(victoryModalSource, /customPlayerName/);

  // DailyVictoryModal shows prominent LEADERBOARD QUALIFIED banner when achieving a top position
  assert.match(dailyVictoryModalSource, /LEADERBOARD QUALIFIED! Your Hunter Tag:/);
  assert.match(dailyVictoryModalSource, /updateDailyPlayerName/);
  assert.match(dailyVictoryModalSource, /savePlayerName/);

  // ProgressModal displays and enables editing of the player's Hunter Tag in live leaderboards
  assert.match(progressModalSource, /Your Hunter Tag:/);
  assert.match(progressModalSource, /handleSaveTag/);
  assert.match(progressModalSource, /savePlayerName/);
});

test('VictoryModal and DailyVictoryModal provide offline status awareness and sync feedback', () => {
  // VictoryModal detects network and displays offline notice in qualification card
  assert.match(victoryModalSource, /networkOnline/);
  assert.match(victoryModalSource, /Saved locally \(syncs when online\)/);
  assert.match(victoryModalSource, /Offline mode: Record is cached locally and will sync automatically when reconnected\./);

  // DailyVictoryModal displays offline tag when network is unavailable
  assert.match(dailyVictoryModalSource, /networkOnline/);
  assert.match(dailyVictoryModalSource, /\(offline, syncs online\)/);
});


