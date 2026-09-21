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
const rejectionNoticeSource = fs.readFileSync(path.join(here, 'HunterTagRejectionNotice.jsx'), 'utf8');

test('VictoryModal conforms to the Set Complete modal layout requirements', () => {
  // Title reads "Set Complete!"
  assert.match(victoryModalSource, /Set Complete!/);

  // Button showing leaderboards to the left of the title
  assert.match(victoryModalSource, /aria-label="View leaderboards"[\s\S]*?worldTitleConfig\.title/i);

  // Star rating centered, then time directly underneath (no separate PTS line - points live in the detail list)
  assert.match(victoryModalSource, /displayStars[\s\S]*?\{seconds\}s/);
  assert.doesNotMatch(victoryModalSource, /Underneath centered: Pts/);

  // World rank 1st/2nd/3rd title config with trophies and personal best badge
  assert.match(victoryModalSource, /World 1st!/);
  assert.match(victoryModalSource, /World 2nd!/);
  assert.match(victoryModalSource, /World 3rd!/);
  assert.match(victoryModalSource, /\(personal best!\)/);
  assert.doesNotMatch(victoryModalSource, /\(world 1st!\)/);

  // Share button appears to the left of the record time when record is achieved
  assert.match(victoryModalSource, /canShare && \(\s*<button[\s\S]*?aria-label="Share result"[\s\S]*?\{seconds\}s/);

  // Subsection with left-aligned details and right-aligned values, now including Points and Accuracy
  assert.match(victoryModalSource, /!isAbstract && \([\s\S]*?Set #[\s\S]*?Attempt #[\s\S]*?Points[\s\S]*?Accuracy/);
  assert.match(victoryModalSource, /fontSize:\s*['"]0\.95rem['"][\s\S]*?Set #/);
  assert.doesNotMatch(victoryModalSource, /[Pp]ercentile/);

  // Abstract / Generative mode drops set records and set data
  assert.match(victoryModalSource, /const isAbstract =/);
  assert.match(victoryModalSource, /isAbstract \? null :/);

  // The old bottom-of-modal Performance Breakdown Grid (Total Pts / Accuracy / Misses) and the
  // Game Center Leaderboards button are gone - accuracy moved into the detail list, points too
  assert.doesNotMatch(victoryModalSource, /TOTAL PTS/);
  assert.doesNotMatch(victoryModalSource, /MISSES/);
  assert.doesNotMatch(victoryModalSource, /Game Center Leaderboards/);
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

  // Daily mode includes Set # but drops Attempt #
  assert.match(dailyVictoryModalSource, /Set #/);
  assert.doesNotMatch(dailyVictoryModalSource, /Attempt #/);
  assert.doesNotMatch(dailyVictoryModalSource, /[Pp]ercentile/);
});

test('ProgressModal provides set dropdown filter, defaults to the general board, and omits search field', () => {
  assert.match(progressModalSource, /aria-label="Photo Set leaderboard"/);
  // Dropdown includes a clearly-labeled default entry for the overall Top 25 board
  assert.match(progressModalSource, /<option value="">General Leaderboard \(Top 25\)<\/option>/);
  // Sets in dropdown are formatted with formatSetLabel
  assert.match(progressModalSource, /formatSetLabel\(setId\)/);
  // Falls back to the general board ('') rather than auto-selecting the first specific set
  assert.match(progressModalSource, /setSelectedLeaderboardSet\(current => current && availableSets\.includes\(current\) \? current : ''\)/);
  assert.doesNotMatch(progressModalSource, /placeholder="Search Set #/);
  assert.doesNotMatch(progressModalSource, /aria-label="Search set by number"/);
  assert.doesNotMatch(progressModalSource, /setSearchQuery/);
});

test('VictoryModal Hunter Tag banner transitions to "Xth Place Saved!" then smoothly collapses away', () => {
  // Three-phase state machine driving the banner: form -> saved -> collapsing -> hidden
  assert.match(victoryModalSource, /const \[bannerPhase, setBannerPhase\] = useState\('form'\)/);
  assert.match(victoryModalSource, /setBannerPhase\('saved'\)/);
  assert.match(victoryModalSource, /setBannerPhase\('collapsing'\)/);
  assert.match(victoryModalSource, /setBannerPhase\('hidden'\)/);
  assert.match(victoryModalSource, /ordinalPlace\}\s*Place Saved!/);
  // Once hidden, the banner is removed from the layout entirely (not just visually hidden)
  assert.match(victoryModalSource, /isLeaderboardRecord && bannerPhase !== 'hidden' && \(/);
  // Collapse animates via the CSS grid-rows trick, which works for any content height
  assert.match(victoryModalSource, /gridTemplateRows:\s*bannerPhase === 'collapsing' \? '0fr' : '1fr'/);
});

test('App.jsx binds set information and routes set leaderboards', () => {
  assert.match(appSource, /handleOpenSetLeaderboard/);
  assert.match(appSource, /lastSetCompletionInfo/);
  assert.match(appSource, /initialSetId=\{selectedStatsSetId\}/);
});

test('Arcade-style Hunter Tag entry: only surfaces the moment a leaderboard record is set', () => {
  // VictoryModal shows LEADERBOARD QUALIFIED card and handles score submission with custom name
  assert.match(victoryModalSource, /LEADERBOARD QUALIFIED!/);
  assert.match(victoryModalSource, /handleSaveName/);
  assert.match(victoryModalSource, /submitLeaderboardScore/);
  assert.match(victoryModalSource, /customPlayerName/);
  // The name entry card only renders when isLeaderboardRecord is true, no standing editable field
  assert.match(victoryModalSource, /isLeaderboardRecord && bannerPhase !== 'hidden' && \(/);

  // DailyVictoryModal shows the same form -> "Xth Place Saved!" banner as VictoryModal
  assert.match(dailyVictoryModalSource, /LEADERBOARD QUALIFIED!/);
  assert.match(dailyVictoryModalSource, /\{ordinalPlace\} Place Saved!/);
  assert.match(dailyVictoryModalSource, /updateDailyPlayerName/);
  assert.match(dailyVictoryModalSource, /savePlayerName/);
  // The tag strip only renders when isLeaderboardRecord is true, not on every successful run
  assert.match(dailyVictoryModalSource, /\{isLeaderboardRecord && bannerPhase !== 'hidden' && \(/);

  // ProgressModal no longer offers a standing, always-editable Hunter Tag field
  assert.doesNotMatch(progressModalSource, /Your Hunter Tag:/);
  assert.doesNotMatch(progressModalSource, /handleSaveTag/);
  assert.doesNotMatch(progressModalSource, /savePlayerName/);
});

test('Hunter Tag entry is screened for profanity before it can be saved', () => {
  for (const source of [victoryModalSource, dailyVictoryModalSource]) {
    assert.match(source, /import \{ containsProfanity \} from '\.\.\/utils\/profanityFilter\.js'/);
    assert.match(source, /containsProfanity\(trimmed\)/);
    // Rejection must short-circuit before the name is persisted or submitted
    assert.match(source, /containsProfanity\(trimmed\)\)\s*\{[\s\S]*?return;\s*\}/);
    // Both modals share the same rejection-notice component rather than duplicating the copy
    assert.match(source, /import HunterTagRejectionNotice from '\.\/HunterTagRejectionNotice\.jsx'/);
    assert.match(source, /<HunterTagRejectionNotice visible=\{nameRejected\} reason=\{nameRejectReason\} \/>/);
    // An empty name is rejected (with a tooltip) before an attempted save, same as profanity
    assert.match(source, /if \(!trimmed\)\s*\{[\s\S]*?setNameRejectReason\('empty'\);[\s\S]*?return;\s*\}/);
  }
  assert.match(rejectionNoticeSource, /isn't allowed/);
  assert.match(rejectionNoticeSource, /Please enter a name before saving\./);
});

test('VictoryModal and DailyVictoryModal provide offline status awareness and sync feedback', () => {
  // Both modals share the same offline detection and messaging in the qualification card
  for (const source of [victoryModalSource, dailyVictoryModalSource]) {
    assert.match(source, /networkOnline/);
    assert.match(source, /Offline mode: Record is cached locally and will sync automatically when reconnected\./);
  }
});


