import {
  TRANSLATION_MAX_SLOTS,
  withTranslationSlot,
  getTranslationQueueState,
} from './translationRequestQueue';

test('translation requests are serialized to protect free engines', () => {
  expect(TRANSLATION_MAX_SLOTS).toBe(1);
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('withTranslationSlot cancellation', () => {
  test('queued work from an aborted turn never runs and frees its slot', async () => {
    const ran = [];
    let release;
    const gate = new Promise((r) => { release = r; });

    const first = withTranslationSlot(async () => {
      ran.push('first');
      await gate;
      return 'first';
    });
    // Queue two more behind the single slot, then abort the caller.
    const controllerA = new AbortController();
    const controllerB = new AbortController();
    const queuedA = withTranslationSlot(async () => { ran.push('a'); }, { signal: controllerA.signal });
    const queuedB = withTranslationSlot(async () => { ran.push('b'); }, { signal: controllerB.signal });

    expect(getTranslationQueueState()).toEqual({ activeSlots: 1, queued: 2 });

    controllerA.abort();
    controllerB.abort();
    release();
    await expect(first).resolves.toBe('first');
    await expect(queuedA).rejects.toMatchObject({ name: 'AbortError' });
    await expect(queuedB).rejects.toMatchObject({ name: 'AbortError' });
    await flush();

    expect(ran).toEqual(['first']);
    expect(getTranslationQueueState()).toEqual({ activeSlots: 0, queued: 0 });
  });

  test('an aborted caller that already held the slot releases it', async () => {
    const controller = new AbortController();
    const result = withTranslationSlot(async () => 'done', { signal: controller.signal });
    await expect(result).resolves.toBe('done');
    controller.abort();
    expect(getTranslationQueueState()).toEqual({ activeSlots: 0, queued: 0 });
  });

  test('a backlog is capped: the newest turn is served, the oldest is dropped', async () => {
    const ran = [];
    let release;
    const gate = new Promise((r) => { release = r; });

    const first = withTranslationSlot(async () => { ran.push(0); await gate; });
    const queued = [];
    for (let i = 1; i <= 12; i += 1) {
      queued.push(
        withTranslationSlot(async () => { ran.push(i); }).catch(() => 'dropped'),
      );
    }
    expect(getTranslationQueueState().queued).toBeLessThanOrEqual(8);

    release();
    await first;
    await Promise.all(queued);
    await flush();

    expect(ran[0]).toBe(0);
    expect(ran[ran.length - 1]).toBe(12);
    expect(getTranslationQueueState()).toEqual({ activeSlots: 0, queued: 0 });
  });
});

describe('per-direction lanes (v4.178.0)', () => {
  test('en-es and es-en run at the same time; same direction still waits', async () => {
    let releaseEn;
    const enGate = new Promise((r) => { releaseEn = r; });
    const ran = [];
    const en1 = withTranslationSlot(async () => { ran.push('en1'); await enGate; }, { lane: 'en-es' });
    const es1 = withTranslationSlot(async () => { ran.push('es1'); }, { lane: 'es-en' });
    const en2 = withTranslationSlot(async () => { ran.push('en2'); }, { lane: 'en-es' });

    await es1; // not blocked by the busy en-es lane
    expect(ran).toEqual(['en1', 'es1']);
    expect(getTranslationQueueState('en-es')).toEqual({ activeSlots: 1, queued: 1 });

    releaseEn();
    await en1;
    await en2;
    await flush();
    expect(ran).toEqual(['en1', 'es1', 'en2']);
    expect(getTranslationQueueState('en-es')).toEqual({ activeSlots: 0, queued: 0 });
    expect(getTranslationQueueState('es-en')).toEqual({ activeSlots: 0, queued: 0 });
  });
});
