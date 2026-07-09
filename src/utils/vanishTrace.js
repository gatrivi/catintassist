/**
 * Vanish / derender / shorten trace (v4.84.2).
 * Console + window.__catintVanishTrace — why words/segments disappear after paint.
 *
 * Usage: window.__catintVanishTrace  ·  window.__catintVanishOn = false to mute
 */

const MAX = 400;

const wordList = (t) => (t || '').trim().split(/\s+/).filter(Boolean);

export const lostWords = (before, after) => {
  const a = wordList(before);
  const b = new Set(wordList(after).map((w) => w.toLowerCase()));
  return a.filter((w) => !b.has(w.toLowerCase()));
};

export const textShortened = (before, after) => {
  const bw = wordList(before).length;
  const aw = wordList(after).length;
  return bw > 0 && aw < bw;
};

/** Push one vanish event. Always flags console when words were lost or force=true. */
export function flagVanish(reason, detail = {}) {
  if (typeof window === 'undefined') return null;
  if (window.__catintVanishOn === false) return null;

  const before = detail.before ?? detail.prev ?? '';
  const after = detail.after ?? detail.next ?? detail.text ?? '';
  const lost = detail.lost ?? (before || after ? lostWords(before, after) : []);
  const shortened = detail.shortened ?? textShortened(before, after);
  const force = detail.force === true;
  if (!force && !shortened && !lost.length && !detail.remount && !detail.derender) {
    return null;
  }

  const entry = {
    at: new Date().toISOString(),
    ms: Math.round(typeof performance !== 'undefined' ? performance.now() : 0),
    flag: 'VANISH',
    reason,
    id: detail.id || null,
    turnId: detail.turnId || null,
    beforeChars: before ? String(before).length : 0,
    afterChars: after ? String(after).length : 0,
    beforeWords: wordList(before).length,
    afterWords: wordList(after).length,
    lost: lost.slice(0, 40),
    lostCount: lost.length,
    remount: Boolean(detail.remount),
    derender: Boolean(detail.derender),
    stage: detail.stage || null,
    extra: detail.extra || null,
    beforePreview: String(before).slice(0, 120),
    afterPreview: String(after).slice(0, 120),
  };

  const buf = (window.__catintVanishTrace ??= []);
  buf.push(entry);
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);

  // eslint-disable-next-line no-console
  console.warn('[CAT VANISH]', reason, entry);
  return entry;
}

/**
 * DOM-level net (v4.84.9): catches bubble nodes React removes/relocates even when
 * no words are lost — invisible to state-level traceCaptionArrayDiff.
 * Flags: dom_bubble_removed · dom_bubble_relocated (same text re-added within windowMs).
 */
export function observeDomVanish(container, { windowMs = 2000 } = {}) {
  if (!container || typeof MutationObserver === 'undefined') return () => {};

  const recentlyRemoved = []; // { text, at }
  const textOf = (node) => (node.textContent || '').trim().slice(0, 160);
  const bubbleOf = (node) => {
    if (!(node instanceof Element)) return null;
    if (node.classList?.contains('transcript-bubble')) return node;
    return node.querySelector?.('.transcript-bubble') || null;
  };

  const obs = new MutationObserver((mutations) => {
    const now = Date.now();
    mutations.forEach((m) => {
      m.removedNodes.forEach((node) => {
        const bubble = bubbleOf(node);
        if (!bubble) return;
        const text = textOf(bubble);
        if (!text) return;
        recentlyRemoved.push({ text, at: now });
        flagVanish('dom_bubble_removed', {
          before: text,
          after: '',
          derender: true,
          force: true,
          stage: 'observeDomVanish',
        });
      });
      m.addedNodes.forEach((node) => {
        const bubble = bubbleOf(node);
        if (!bubble) return;
        const text = textOf(bubble);
        if (!text) return;
        // ponytail: prefix match, not diff — good enough to prove relocation
        const match = recentlyRemoved.find(
          (r) => now - r.at <= windowMs
            && (r.text === text || r.text.startsWith(text.slice(0, 60)) || text.startsWith(r.text.slice(0, 60))),
        );
        if (match) {
          flagVanish('dom_bubble_relocated', {
            before: match.text,
            after: text,
            remount: true,
            force: true,
            stage: 'observeDomVanish',
            extra: { gapMs: now - match.at },
          });
        }
      });
    });
    while (recentlyRemoved.length && now - recentlyRemoved[0].at > windowMs) recentlyRemoved.shift();
  });

  obs.observe(container, { childList: true, subtree: true });
  return () => obs.disconnect();
}

/** Compare caption arrays: removed rows, shortened text, live→sealed remount. */
export function traceCaptionArrayDiff(prev, next, stage = 'captions.set') {
  if (!Array.isArray(prev) || !Array.isArray(next)) return;
  const nextById = new Map(next.map((c) => [c.id, c]));
  const prevById = new Map(prev.map((c) => [c.id, c]));

  prev.forEach((p) => {
    const n = nextById.get(p.id);
    if (!n) {
      flagVanish('caption_row_removed', {
        id: p.id,
        turnId: p.turnId,
        before: p.text,
        after: '',
        derender: true,
        stage,
        extra: { wasFinal: p.isFinal },
      });
      return;
    }
    if (textShortened(p.text, n.text)) {
      flagVanish('caption_text_shortened', {
        id: p.id,
        turnId: p.turnId,
        before: p.text,
        after: n.text,
        stage,
        extra: { wasFinal: p.isFinal, nowFinal: n.isFinal },
      });
    }
    if (p.isFinal === false && n.isFinal === true) {
      flagVanish('live_to_sealed_swap', {
        id: p.id,
        turnId: p.turnId,
        before: p.text,
        after: n.text,
        remount: true,
        force: true,
        stage,
        extra: { note: 'StableLiveTranscriptText → InteractiveText (spelling layout may flip)' },
      });
    }
  });

  // New ids that replaced a live row (split) — previous live gone under different id
  if (next.length > prev.length) {
    const added = next.filter((c) => !prevById.has(c.id));
    if (added.length) {
      const lastPrev = prev[prev.length - 1];
      flagVanish('caption_split_or_append', {
        id: lastPrev?.id,
        turnId: lastPrev?.turnId,
        before: lastPrev?.text,
        after: added.map((a) => a.text).join(' | '),
        remount: true,
        force: true,
        stage,
        extra: { addedIds: added.map((a) => a.id), addedCount: added.length },
      });
    }
  }
}
