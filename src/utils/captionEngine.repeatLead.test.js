import { dropRepeatedLeadSentences, reduceTranscriptEvent } from './captionEngine';

const ctx = () => ({
  turnWordsBaseRef: { current: 0 },
  currentTurnIdRef: { current: null },
  bubbleIdCounterRef: { current: 0 },
  lastBubbleStartedRef: { current: 0 },
});
const ev = (transcript, startTime, now) => ({
  transcript, isFinal: true, speechFinal: true, confidence: 0.95,
  laneSide: 'en', channelKey: 'multi', startTime, now,
  isSilentBreak: false, protectionsOn: false, langMode: 'auto',
  pair: { left: 'en', right: 'es' },
});

describe('dropRepeatedLeadSentences (v4.180.0)', () => {
  const A = 'What automated system are you referring to? From Social Security, or do you receive K. Or did you receive a notice?';
  test('whole repeat of a sentence above = nothing left', () =>
    expect(dropRepeatedLeadSentences(A, 'From Social Security, or do you receive K.')).toBe(''));
  test('repeated head dropped, new words kept', () =>
    expect(dropRepeatedLeadSentences(A, 'Or did you receive a notice? Stating you need to reapply for extra help?'))
      .toBe('Stating you need to reapply for extra help?'));
  test('short sentences always stay ("Okay.")', () =>
    expect(dropRepeatedLeadSentences('Okay. Thanks.', 'Okay.')).toBe('Okay.'));
  test('a repeat in the MIDDLE of the new text is kept', () =>
    expect(dropRepeatedLeadSentences(A, 'Yes I did. Or did you receive a notice?'))
      .toBe('Yes I did. Or did you receive a notice?'));
  test('unfinished sentence (no period) is never dropped', () =>
    expect(dropRepeatedLeadSentences(A, 'Or did you receive a notice')).toBe('Or did you receive a notice'));
  test('digits already visible above may be skipped, new digits stay', () =>
    expect(dropRepeatedLeadSentences('My number is 555-123-4567.', 'My number is 555-123-4567. Zip 10001.'))
      .toBe('Zip 10001.'));
});

describe('reduceTranscriptEvent: live call 10-16 repro', () => {
  test('no sentence prints twice across bubbles', () => {
    const c = ctx();
    let rows = [];
    let t = 1000;
    for (const [text, start] of [
      ['What automated system are you referring to? From Social Security, or do you receive K. Or did you receive a notice?', 1],
      ['From Social Security, or do you receive K.', 2],
      ['Or did you receive a notice? Stating you need to reapply for extra help?', 3],
      ['Stating you need to reapply for extra help?', 4],
    ]) {
      t += 2000;
      rows = reduceTranscriptEvent(rows, ev(text, start, t), c);
    }
    const all = rows.map((r) => r.text).join(" ");
    const count = (s) => all.split(s).length - 1;
    expect(count('From Social Security')).toBe(1);
    expect(count('Or did you receive a notice?')).toBe(1);
    expect(count('Stating you need to reapply')).toBe(1);
  });
});
