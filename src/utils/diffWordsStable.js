/**
 * Word-level stable diff for continuity-preserving transcript morph (v4.84.1).
 * Display-only — no captionEngine / Deepgram changes.
 */

/** Tokenize into word+trailing-space chunks. */
export function tokenizeWords(text = '') {
  const t = text || '';
  if (!t) return [];
  return t.match(/\S+\s*/g) || [t];
}

const norm = (tok) => (tok || '').trim().toLowerCase();

/**
 * LCS-based word diff. Returns ops that never invent a blank frame:
 * - equal: { type: 'equal', text, key }
 * - replace: { type: 'replace', from, to, key }
 * - insert: { type: 'insert', text, key }
 * - delete: { type: 'delete', text, key }
 */
export function diffWordsStable(prevText = '', nextText = '') {
  const a = tokenizeWords(prevText);
  const b = tokenizeWords(nextText);

  if (!a.length && !b.length) return [];
  if (!a.length) {
    return b.map((text, i) => ({ type: 'insert', text, key: `i0-${i}` }));
  }
  if (!b.length) {
    return a.map((text, i) => ({ type: 'delete', text, key: `d0-${i}` }));
  }

  const n = a.length;
  const m = b.length;
  // DP LCS lengths
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (norm(a[i]) === norm(b[j])) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) {
      raw.push({ type: 'equal', text: b[j], key: `e${i}-${j}` });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'delete', text: a[i], key: `d${i}-${j}` });
      i += 1;
    } else {
      raw.push({ type: 'insert', text: b[j], key: `i${i}-${j}` });
      j += 1;
    }
  }
  while (i < n) {
    raw.push({ type: 'delete', text: a[i], key: `d${i}-end` });
    i += 1;
  }
  while (j < m) {
    raw.push({ type: 'insert', text: b[j], key: `i-end-${j}` });
    j += 1;
  }

  // Collapse adjacent delete+insert into replace (readable cue).
  const ops = [];
  for (let k = 0; k < raw.length; k += 1) {
    const cur = raw[k];
    const nxt = raw[k + 1];
    if (cur.type === 'delete' && nxt?.type === 'insert') {
      ops.push({
        type: 'replace',
        from: cur.text,
        to: nxt.text,
        key: `r${cur.key}-${nxt.key}`,
      });
      k += 1;
    } else if (cur.type === 'insert' && nxt?.type === 'delete') {
      ops.push({
        type: 'replace',
        from: nxt.text,
        to: cur.text,
        key: `r${nxt.key}-${cur.key}`,
      });
      k += 1;
    } else {
      ops.push(cur);
    }
  }

  return ops;
}

/** True if token looks like phone/dose/date — never blank during morph. */
export function isProtectedToken(text = '') {
  const t = (text || '').trim();
  if (!t) return false;
  if (/\d/.test(t) && t.replace(/\D/g, '').length >= 2) return true;
  if (/^\d+\/\d+/.test(t)) return true;
  if (/mg|mcg|ml|units?/i.test(t) && /\d/.test(t)) return true;
  if (/[$€£]/.test(t) && /\d/.test(t)) return true;
  if (/\b(?:dollars?|pesos?|usd|copay)\b/i.test(t) && /\d/.test(t)) return true;
  // Month-name dates: "May 8 1990", "8 de mayo de 1990"
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(t)
    && /\d/.test(t)) return true;
  return false;
}

/**
 * Summarize whether morph is append-only (stable prefix + new tail).
 */
export function isAppendOnlyMorph(prevText = '', nextText = '') {
  return !!nextText && nextText.startsWith(prevText || '');
}
