/**
 * Sync replay of translation fixtures through applyTranslationResult.
 */
import {
  applyTranslationResult,
  assignSegmentIds,
  buildSegmentRequestId,
  composeCaptionTranslation,
  hashTranslationSource,
  segmentLongMonologue,
} from './translationApplicator';

/**
 * @param {object} fixture
 * @returns {{ state, composed, steps, entries }}
 */
export function replayTranslationFixture(fixture) {
  const captionId = fixture.captionId || 'cap-fixture';
  const targetLang = fixture.targetLang || 'es';
  const sourceText = fixture.sourceText || '';
  const maxWords = fixture.maxWords || 40;

  const segments =
    Array.isArray(fixture.segments) && fixture.segments.length
      ? fixture.segments.map((t, i) => ({
          segmentId: `seg-${i}`,
          text: String(t).trim().replace(/\s+/g, ' '),
        }))
      : assignSegmentIds(segmentLongMonologue(sourceText, { maxWords }));

  let state = { ...(fixture.initialState || {}) };
  const steps = [];
  const activeKeys = [];
  const seenKeys = new Set();

  const events = Array.isArray(fixture.events) ? fixture.events : [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const seg =
      (ev.segmentId && segments.find((s) => s.segmentId === ev.segmentId)) ||
      (Number.isFinite(ev.segmentIndex) ? segments[ev.segmentIndex] : null) ||
      segments[i] ||
      null;
    if (!seg) {
      steps.push({ index: i, skipped: true, reason: 'no-segment' });
      continue;
    }

    const sourceHash =
      ev.sourceHash != null ? ev.sourceHash : hashTranslationSource(seg.text);
    const expectedHash = hashTranslationSource(seg.text);
    const requestId = buildSegmentRequestId({
      captionId,
      segmentId: seg.segmentId,
      sourceHash: expectedHash,
      targetLang,
    });
    if (!ev.omitFromCompose && !seenKeys.has(requestId)) {
      seenKeys.add(requestId);
      activeKeys.push(requestId);
    }

    const { state: next, entry } = applyTranslationResult(state, {
      captionId,
      segmentId: seg.segmentId,
      sourceText: seg.text,
      sourceHash,
      targetLang,
      previousEntry: state[requestId] || null,
      engineResult: {
        text: ev.resultText ?? '',
        engineId: ev.engineId || 'fixture',
        quality: ev.quality || (ev.resultText ? 'ok' : 'failed'),
        requestId: ev.requestId != null ? ev.requestId : requestId,
      },
    });
    state = next;
    steps.push({ index: i, segmentId: seg.segmentId, entry, key: requestId });
  }

  // user override wins
  let composed = composeCaptionTranslation(state, activeKeys);
  if (fixture.userTranslationOverride) {
    composed = String(fixture.userTranslationOverride).trim();
  }

  return {
    state,
    composed,
    steps,
    entries: Object.values(state),
    segments,
    activeKeys,
  };
}

export function assertTranslationExpect(result, spec) {
  if (!spec) return;
  if (spec.composedIncludes) {
    for (const s of spec.composedIncludes) {
      expectContains(result.composed, s);
    }
  }
  if (spec.composedExcludes) {
    for (const s of spec.composedExcludes) {
      if (String(result.composed || '').includes(s)) {
        throw new Error(`composed unexpectedly includes "${s}"`);
      }
    }
  }
  if (spec.composedEquals != null) {
    if (result.composed !== spec.composedEquals) {
      throw new Error(
        `composed expected "${spec.composedEquals}" got "${result.composed}"`,
      );
    }
  }
  if (spec.entryWarnings) {
    for (const [segId, warning] of Object.entries(spec.entryWarnings)) {
      const entry = result.entries.find((e) => e.segmentId === segId);
      if (!entry || entry.warning !== warning) {
        throw new Error(
          `segment ${segId} warning expected ${warning} got ${entry?.warning}`,
        );
      }
    }
  }
  if (spec.preservedSegments) {
    for (const segId of spec.preservedSegments) {
      const entry = result.entries.find((e) => e.segmentId === segId);
      if (!entry?.preserved) {
        throw new Error(`segment ${segId} expected preserved:true`);
      }
    }
  }
  if (spec.minSegments != null) {
    if (result.segments.length < spec.minSegments) {
      throw new Error(
        `expected >= ${spec.minSegments} segments, got ${result.segments.length}`,
      );
    }
  }
  if (spec.siblingIntact) {
    for (const [key, text] of Object.entries(spec.siblingIntact)) {
      if (result.state[key]?.text !== text) {
        throw new Error(`sibling ${key} expected "${text}"`);
      }
    }
  }
  if (spec.statusOk) {
    for (const segId of spec.statusOk) {
      const entry = result.entries.find((e) => e.segmentId === segId);
      if (!entry || (entry.status !== 'ok' && entry.status !== 'weak' && entry.status !== 'warning')) {
        throw new Error(`segment ${segId} expected usable status, got ${entry?.status}`);
      }
    }
  }
}

function expectContains(hay, needle) {
  if (!String(hay || '').includes(needle)) {
    throw new Error(`expected composed to include "${needle}", got "${hay}"`);
  }
}
