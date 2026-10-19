/**
 * v4.186.0 — a draft and its final are the SAME audio: the final replaces the
 * draft in place, it never prints a second copy. Live calls 10-19.
 */
import { replayFixtureEvents } from './fixtureReplay';

const ev = (atMs, start, transcript, isFinal, speechFinal = false) => ({
  atMs,
  lane: 'en',
  payload: {
    type: 'Results', is_final: isFinal, speech_final: speechFinal, start, duration: 1,
    channel: { alternatives: [{ transcript, confidence: 0.95,
      words: transcript.split(' ').map((w) => ({ word: w, confidence: 0.95 })) }] },
  },
});
const texts = (rows) => rows.map((r) => r.text);
const count = (rows, phrase) =>
  rows.filter((r) => r.text.toLowerCase().includes(phrase.toLowerCase())).length;

test('draft after a sealed sentence → its final lands in the SAME bubble', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 10, "You'll pay for the extractions that we did today.", true),
    ev(300, 13, "but you'll give that card", false),
    ev(900, 13, 'But you give that card.', true),
  ] });
  expect(texts(rows)).toEqual(["You'll pay for the extractions that we did today.", 'But you give that card.']);
});

test('the draft gets its own bubble right away and keeps its id through the final (morph, no move)', () => {
  const steps = [];
  replayFixtureEvents({ events: [
    ev(0, 10, 'Okay we are done for today.', true),
    ev(300, 13, 'i will give you the', false),
    ev(900, 13, 'I will give you the card.', true),
  ] }, { onStep: ({ rows }) => steps.push(rows.map((r) => r.id)) });
  const draftId = steps[1][1];
  expect(steps[1]).toHaveLength(2);
  expect(steps[2][1]).toBe(draftId);
});

test('paste 10-19 13:58: 3 s Deepgram pause mid-sentence, then the final', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 10, "You'll pay for the extractions that we did today.", true),
    ev(400, 13, "but you'll give that card i'll give you to the front desk for them to schedule the next", false),
    ev(3600, 13, "But you give that card. I'll give you to the front desk for them to schedule the next appointment.", true, true),
  ] });
  expect(count(rows, 'front desk')).toBe(1);
  expect(count(rows, 'give that card')).toBe(1);
  expect(count(rows, 'next appointment')).toBe(1);
});

test('paste 10-19 13:52: draft "...addressed later on, um, just how" + pause + reworded final', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 5, 'It was actually I was doing the extraction, had to be careful not to remove those crowns.', true),
    ev(300, 9, "just wanna let you know that's something that will have to be addressed later on um just how", false),
    ev(3500, 9, "Just wanted to let you know that's something that will have to be addressed later on. Just how loose these crowns are.", true, true),
  ] });
  expect(count(rows, 'addressed later on')).toBe(1);
  expect(count(rows, 'just how')).toBe(1);
});

test('a real pause before NEW audio still starts a new bubble and keeps the old words', () => {
  const { rows } = replayFixtureEvents({ events: [
    ev(0, 10, 'i need your date of', false),
    ev(3500, 20, 'Okay.', true),
  ] });
  expect(rows).toHaveLength(2);
  expect(rows[0].text.toLowerCase()).toContain('date of');
  expect(rows[0].isFinal).toBe(true);
});
