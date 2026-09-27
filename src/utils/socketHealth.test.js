import {
  describeSocket, buildSocketHealth, formatSilence,
  SOCKET_SILENCE_ALERT_MS, SOCKET_QUIET_HINT_MS, MIN_WORDS_FOR_SNIPPET,
} from './socketHealth';

// v4.169.0. These cases are the incident, restated as assertions. On a real CSA
// call the EN socket transcribed a whole conversation while the ES socket
// returned nothing, every bubble was stamped `en`, and the screen said
// "EN 65% / ES 0%" — which reads like two numbers, not like "one side is dead".

const NOW = 1_700_000_000_000;

describe('formatSilence', () => {
  test('reads like an operator would say it', () => {
    expect(formatSilence(0)).toBe('now');
    expect(formatSilence(3_000)).toBe('now');
    expect(formatSilence(45_000)).toBe('45s');
    expect(formatSilence(134_000)).toBe('2m');
    expect(formatSilence(3_840_000)).toBe('1h 4m');
    expect(formatSilence(7_200_000)).toBe('2h');
  });

  test('never goes negative or NaN on junk', () => {
    expect(formatSilence(-500)).toBe('now');
    expect(formatSilence(undefined)).toBe('now');
    expect(formatSilence('x')).toBe('now');
  });
});

describe('describeSocket', () => {
  test('a socket that has never spoken is "no words", NOT "silent"', () => {
    // The distinction matters: before connect we know nothing, and claiming
    // "silent" there would cry wolf on every single call.
    const s = describeSocket({ now: NOW, side: 'es' });
    expect(s.producedEver).toBe(false);
    expect(s.silent).toBe(false);
    expect(s.label).toBe('no words');
  });

  test('an active socket shows its word count and stops ageing', () => {
    const s = describeSocket({ now: NOW, side: 'en', words: 412, lastTextAt: NOW - 1_000 });
    expect(s.producedEver).toBe(true);
    expect(s.silent).toBe(false);
    expect(s.label).toBe('412w');
  });

  test('a socket that stopped ages visibly, then counts as silent', () => {
    const s = describeSocket({
      now: NOW, side: 'es', words: 30, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 1_000,
    });
    expect(s.silent).toBe(true);
    expect(s.silentForMs).toBeGreaterThanOrEqual(SOCKET_SILENCE_ALERT_MS);
    expect(s.label).toMatch(/ago$/);
    expect(s.title).toMatch(/last text/);
  });
});

describe('buildSocketHealth', () => {
  // THE incident: EN transcribed everything, ES produced nothing, and the
  // operator could not tell from the screen.
  test('one socket carrying the whole call raises the alert', () => {
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 640, lastTextAt: NOW - 2_000 },
      es: { words: 0, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 74_000 },
    });
    expect(h.alert).toBeTruthy();
    expect(h.alert.side).toBe('es');
    expect(h.alert.text).toMatch(/ES socket silent/);
    expect(h.alert.text).toMatch(/EN socket is transcribing everything/);
  });

  test('the mirror case is caught too (EN starving, not just ES)', () => {
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 12, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 5_000 },
      es: { words: 480, lastTextAt: NOW - 1_000 },
    });
    expect(h.alert).toBeTruthy();
    expect(h.alert.side).toBe('en');
  });

  test('both sockets working = no alert, no quiet', () => {
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 300, lastTextAt: NOW - 1_000 },
      es: { words: 280, lastTextAt: NOW - 1_500 },
    });
    expect(h.alert).toBeNull();
    expect(h.quiet).toBeNull();
  });

  test('before connect, silence is not an alert', () => {
    // The whole point: never diagnose a socket that has had no chance to talk.
    const h = buildSocketHealth({ now: NOW, en: {}, es: {} });
    expect(h.alert).toBeNull();
    expect(h.quiet).toBeNull();
    expect(h.en.producedEver).toBe(false);
  });

  test('a barely-started peer is not treated as carrying the call', () => {
    // MIN_WORDS_FOR_SNIPPET guard: 2 words of EN is not evidence of anything.
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 2, lastTextAt: NOW - 1_000 },
      es: { words: 0, lastTextAt: 0 },
    });
    expect(h.alert).toBeNull();
    expect(MIN_WORDS_FOR_SNIPPET).toBeGreaterThan(2);
  });

  test('a lopsided-but-both-alive split gives a quiet note, not an error', () => {
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 500, lastTextAt: NOW - 1_000 },
      es: { words: 6, lastTextAt: NOW - SOCKET_QUIET_HINT_MS - 1_000 },
    });
    expect(h.alert).toBeNull();
    expect(h.quiet).toBeTruthy();
    expect(h.quiet.text).toMatch(/ES quiet/);
  });

  // The escalation ladder must actually ascend: a hint threshold at or above the
  // alert threshold makes the hint unreachable, because the alert branch
  // catches everything first. A first pass shipped that way.
  test('the ladder ascends: hint < alert', () => {
    expect(SOCKET_QUIET_HINT_MS).toBeLessThan(SOCKET_SILENCE_ALERT_MS);
  });

  test('quiet at the hint, silent at the alert — two different severities', () => {
    const base = { en: { words: 500, lastTextAt: NOW - 1_000 } };
    const hint = buildSocketHealth({
      now: NOW, ...base, es: { words: 8, lastTextAt: NOW - SOCKET_QUIET_HINT_MS - 1_000 },
    });
    expect(hint.alert).toBeNull();
    expect(hint.quiet).toBeTruthy();

    const dead = buildSocketHealth({
      now: NOW, ...base, es: { words: 8, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 1_000 },
    });
    expect(dead.alert).toBeTruthy();
    expect(dead.alert.tone).toBe('error');
  });

  test('the early warning: EN carrying it before ES actually dies', () => {
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 500, lastTextAt: NOW - 1_000 },
      es: { words: 0, lastTextAt: 0 },
    });
    expect(h.alert).toBeNull();
    expect(h.quiet).toBeTruthy();
    expect(h.quiet.text).toMatch(/EN is carrying the call/);
  });

  test('junk input cannot produce a confident verdict', () => {
    const h = buildSocketHealth({ now: NOW, en: { words: 'x' }, es: { words: null } });
    expect(h.en.words).toBe(0);
    expect(h.es.words).toBe(0);
    expect(h.alert).toBeNull();
    expect(h.en.label).toBe('no words');
  });

  test('no socket is declared silent while the other is also silent', () => {
    // Both dead is a connection problem, not a lane-starvation problem.
    const h = buildSocketHealth({
      now: NOW,
      en: { words: 100, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 1_000 },
      es: { words: 100, lastTextAt: NOW - SOCKET_SILENCE_ALERT_MS - 1_000 },
    });
    expect(h.alert).toBeNull();
  });
});
