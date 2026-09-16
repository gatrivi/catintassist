/**
 * Expected-data context (v4.117.0) — remembers WHAT was just asked for.
 *
 * Problem: "can I have your phone number?" seals in bubble N, but the digits
 * arrive in bubbles N+1..N+3 where per-bubble sentinels see mode:null — so
 * short/straddled runs never format. This module arms an expectation
 * ({ type, at, turnId }) when a request cue is seen; the display pipeline
 * then formats matching digit runs for up to EXPECTED_WINDOW_MS.
 *
 * Turns break every ~2.5s of silence, so turn-gating would void the feature —
 * the window is time-based (45s) + re-arm replaces. No imports (no cycles).
 */

export const EXPECTED_WINDOW_MS = 45000;

// Order matters: specific IDs first, bare "phone/number" last —
// "número de afiliado" must arm member, never phone.
const REQUEST_PATTERNS = [
  {
    type: 'ssn',
    res: [
      /\bssn\b/i,
      /social security/i,
      /(can i have|give me|what is|what's|tell me|i need).{0,25}(ssn|social|security)/i,
      /(seguro social|n[uú]mero de seguro)/i,
    ],
  },
  {
    type: 'member',
    res: [
      /\bmedicaid\b/i,
      /\baffiliate[sd]?\b/i,
      /\bafiliad[oa]s?\b/i,
      /member (id|number)/i,
      /(id|identification) number/i,
      /policy number/i,
      /insurance id/i,
      /\bmrn\b/i,
      /\bchart\b/i,
      /record number/i,
      /\bfolio\b/i,
      // v4.121.0: case/claim/reference IDs arm the ID lane too.
      /\b(?:case|claim|group|reference|confirmation|authorization|auth)\s*(?:id|number|#)/i,
      /(p[oó]liza|expediente|miembro|n[uú]mero de (miembro|identificaci[oó]n|afiliado))/i,
      /(me puede dar|d[ií]game|cu[aá]l es|necesito).{0,25}(afiliado|miembro|medicaid|expediente|seguro)/i,
    ],
  },
  {
    type: 'dob',
    res: [
      /date of birth/i,
      /\bbirth\b/i,
      /\bborn\b/i,
      /\bdob\b/i,
      /\bage\b/i,
      /how old/i,
      /when were you born/i,
      /fecha de nacimiento/i,
      /nacimiento/i,
      /\bedad\b/i,
      /cu[aá]ntos a[nñ]os/i,
      /(me puede dar|d[ií]game|cu[aá]l es).{0,25}(fecha|nacimiento|edad)/i,
    ],
  },
  {
    type: 'address',
    res: [
      /(mailing|home|billing)?\s*address/i,
      /where do you live/i,
      /live(s)? (at|on)/i,
      /\bzip\b/i,
      /direcci[oó]n/i,
      /d[oó]nde vive/i,
      /domicilio/i,
      /c[oó]digo postal/i,
      /(me puede dar|d[ií]game|cu[aá]l es).{0,25}(direcci[oó]n|domicilio)/i,
    ],
  },
  {
    type: 'phone',
    res: [
      /\bphone\b/i,
      /\bcell\b/i,
      /\bmobile\b/i,
      /call me at/i,
      /call back/i,
      /contact number/i,
      /tel[eé]fono/i,
      /cel(ular)?/i,
      /llamar al/i,
      /(can i have|give me|what is|what's|tell me|i need).{0,25}(phone|cell|mobile|contact|number|n[uú]mero)/i,
      /(me puede dar|d[ií]game|cu[aá]l es|necesito|dame).{0,25}(tel[eé]fono|celular|n[uú]mero)/i,
      /n[uú]mero de tel[eé]fono/i,
      /(tu|su) n[uú]mero\b/i,
    ],
  },
];

let _armed = null; // { type, at, turnId, snippet } | null

/** Scan sealed/live text; on a request cue, (re-)arm. Never clears on miss. */
export const armExpectedData = (text, { turnId = null, now = Date.now() } = {}) => {
  if (!text?.trim()) return _armed;
  for (const { type, res } of REQUEST_PATTERNS) {
    if (res.some((re) => re.test(text))) {
      _armed = { type, at: now, turnId, snippet: text.trim().slice(0, 80) };
      return _armed;
    }
  }
  return _armed;
};

/** Armed type if inside the window, else null (expiry clears the store). */
export const getArmedExpectedType = ({ now = Date.now() } = {}) => {
  if (!_armed) return null;
  if (now - _armed.at > EXPECTED_WINDOW_MS) {
    _armed = null;
    return null;
  }
  return _armed.type;
};

export const peekArmedExpected = () => _armed;

export const clearExpectedData = () => {
  _armed = null;
};
