// Lightweight, dependency-free profanity check for leaderboard "Hunter Tag" names.
// Not exhaustive (no filter is) — covers common slurs/vulgarity and basic leetspeak evasion.

// Short/ambiguous terms: only rejected as a standalone word (avoids false positives
// like "Classic", "Assassin", "Sussex", "Bassist").
const WHOLE_WORD_BLOCKED = ['ass', 'sex', 'tit', 'fag', 'cum', 'hoe', 'coon'];

// Longer, unambiguous terms: rejected if they appear anywhere in the name.
const SUBSTRING_BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'whore', 'pussy', 'dick',
  'asshole', 'bastard', 'slut', 'twat', 'wank', 'dildo', 'rape', 'faggot',
  'retard', 'kike', 'spic', 'chink', 'tranny', 'motherfucker', 'jizz'
];

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function deleetify(text) {
  return text.split('').map(ch => LEET_MAP[ch] || ch).join('');
}

export function containsProfanity(name) {
  const lower = deleetify(String(name || '').toLowerCase());

  const words = lower.split(/[^a-z]+/).filter(Boolean);
  if (words.some(word => WHOLE_WORD_BLOCKED.includes(word))) return true;

  const collapsed = lower.replace(/[^a-z]/g, '');
  return SUBSTRING_BLOCKED.some(term => collapsed.includes(term));
}
