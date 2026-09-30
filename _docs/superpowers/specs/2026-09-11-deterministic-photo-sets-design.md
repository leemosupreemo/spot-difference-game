# Deterministic Photo Sets and Set-Keyed Competition

## Goal

Make competitive results comparable by ensuring every player in a named Photo Set sees the same ordered puzzles, while removing difficulty classification from new photo competition.

## Rules

1. Photo competition is identified by stable `setId`, not difficulty.
2. Each photo entry has a stable positive integer `sequence` within its set.
3. A standard Photo Set contains five ordered photo entries.
4. A daily challenge contains three ordered entries selected by its existing date-keyed queue.
5. Difference variants are separate entries with separate IDs and may appear in different sets.
6. Existing difficulty fields remain readable for legacy data and procedural mode, but photo selection and new competitive identity do not filter or rank by difficulty.
7. Remote entries must provide `setId` and `sequence` to participate in deterministic photo sets; malformed entries remain excluded by manifest validation.

## Data and behavior

The manifest remains the source of photo entries. A set catalog groups entries by `setId` and sorts by `sequence`, then ID as a deterministic tie-breaker. The photo-stage builder accepts `setId` and returns that set’s ordered entries, with no seeded shuffle or difficulty filter. If a requested set is incomplete, it returns the available ordered entries and the caller uses an explicit fallback set rather than silently mixing content.

Photo Mode exposes the available set identity and starts the selected set. Every completion record stores `setId`, the ordered entry IDs, the completion time, and whether it is a first completion or repeat. Personal bests, first-time averages, repeat averages, fastest times, and leaderboard submissions are keyed by `setId`; no new photo result is keyed by difficulty. Daily records use `dateStr` plus the fixed daily `setId`/entry IDs and retain the same timing fields. Daily queue behavior remains date-keyed and continues to provide three fixed entries.

## Compatibility

Entries without set metadata are retained for non-competitive/debug catalog browsing but are not eligible for a new competitive Photo Set. Legacy progress records remain readable through their existing pack/difficulty fields; no migration deletes old records.

## Verification

Tests must prove: identical set IDs produce identical five-entry order; changing difficulty does not change a photo set; variants have distinct IDs and remain addressable; incomplete sets are not silently mixed; completion records persist `setId` and entry IDs with first/repeat times; and progress payloads expose set-keyed records.
