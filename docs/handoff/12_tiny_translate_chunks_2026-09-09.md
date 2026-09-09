# Session status 2026-09-09 (v4.94.0, tiny translate chunks — LOCAL ONLY, not pushed)

Translation suites green (52 tests) · build compiles (warnings only) · full suite has 2 PRE-EXISTING failures in `sensitiveDataProtector` (Phase G digit grouping, from earlier uncommitted work — unrelated, untouched).

## Shipped (uncommitted, local only — push scope not approved yet)
- **Fix (user request):** translation requests to local API (`127.0.0.1:59200/stt/translate`) were 40-word chunks; the local model crawled on them and paragraphs came back minutes-to-half-hour late.
- `translationApplicator.js` — `segmentLongMonologue` rewritten: sentence peel → split at commas/semicolons/colons → group clauses up to **14 words** (`DEFAULT_MAX_SEGMENT_WORDS` 40→14). Hard ceiling **24** even for explicit `maxWords` (clamp now 8–24, was 20–45).
- `useTranslate.js` — dropped `{ maxWords: 40 }` override; uses tiny-chunk default.
- `translationQuality.js` — `splitLongForTranslation` doc updated (same re-export).
- Regression tests added (`translationApplicator.test.js`): never-a-paragraph default, comma split-point, comma-less hard chunk. Fixture `long-monologue.json` label updated. `translationFixtureReplay.test.js` ceiling 45→24.
- Version 4.94.0 (`version.js`, `package.json`) — label "tiny translate chunks".

## Open (not done)
- **Push decision pending:** user dismissed the scope question. Tree has ~40 files of unrelated uncommitted work (v4.93.x audio/sensitive-data sessions). Options were: bundle all / translation files only / hold.
- 2 pre-existing test failures: `sensitiveDataProtector.test.js` — "Phase G: ES afiliado digits stitch + group" and "ssn sentinel wins over address/date" expect `/101-315-9516/` but get ungrouped digits. Belongs to the number-protection session (`sensitiveDataProtector.js`), not this one.
- No push made, nothing logged in `docs/push-log.md`. Watch in prod: translations should now return in seconds; if a single 14-word chunk still stalls the local model, the bottleneck is the model/gateway, not chunking.
