/**
 * Per-socket STT health (v4.169.0).
 *
 * WHY THIS EXISTS. On a real CSA call the whole conversation was transcribed by
 * ONE Deepgram socket while the other returned nothing, and every bubble was
 * stamped with that socket's language. The operator read Spanish that the app
 * had labelled English, and translated EN->ES from it. Nothing on screen said
 * so: the readout showed "EN 65% / ES 0%", which reads like two confidence
 * numbers and not like "one side is dead".
 *
 * `lastSocketEnConfidence` is a LAST-MESSAGE value, not a health signal, and a
 * single Zap resets it to null (which renders "--", indistinguishable from
 * "not connected yet"). The two facts that would have given it away already
 * existed but were only in a tooltip.
 *
 * This module is pure: it takes per-socket counters and returns what to say.
 * No React, no socket, no clock of its own — the caller passes `now`.
 *
 * NOT A DIAGNOSTIC TOOL. It answers one question: is a socket that should be
 * transcribing actually doing it? The lane-assignment guard that stops the
 * mislabelling is a separate change; this only makes the failure visible.
 */

/** A socket that has produced nothing for this long, while the other is talking, is an alert. */
export const SOCKET_SILENCE_ALERT_MS = 30_000;
/**
 * Softer hint: quiet this long while the peer is healthy is worth mentioning,
 * but is not yet alarming. MUST be BELOW SOCKET_SILENCE_ALERT_MS or the alert
 * branch catches everything first and this hint becomes unreachable dead code —
 * which is exactly what a first pass at this did.
 */
export const SOCKET_QUIET_HINT_MS = 12_000;
/** Below this we cannot tell a language apart, so never draw a conclusion. */
export const MIN_WORDS_FOR_SNIPPET = 4;

/** ms -> "just now" / "12s" / "2m" / "1h 4m" */
export const formatSilence = (ms) => {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

/**
 * One socket's state.
 * @param {object} o
 * @param {number} o.now          current ms
 * @param {number} [o.words]      cumulative words this socket has produced
 * @param {number} [o.lastTextAt] ms of the last message that carried text (0 = never)
 * @param {number} [o.lastMessageAt] ms of the last message of any kind
 * @returns {{side:string, words:number, silentForMs:number, producedEver:boolean, silent:boolean, label:string, title:string}}
 */
export const describeSocket = ({ now, side, words = 0, lastTextAt = 0, lastMessageAt = 0 }) => {
  const w = Math.max(0, Number(words) || 0);
  const producedEver = w > 0 || Boolean(lastTextAt);
  // Never say "silent" about a socket that has simply not had a chance yet.
  const silent = producedEver ? (now - (lastTextAt || 0)) >= SOCKET_SILENCE_ALERT_MS : false;
  const silentForMs = producedEver ? Math.max(0, now - (lastTextAt || 0)) : 0;

  let label;
  if (!producedEver) label = 'no words';
  else if (silentForMs < 5000) label = `${w}w`;
  else label = `${w}w · ${formatSilence(silentForMs)} ago`;

  return {
    side,
    words: w,
    silentForMs,
    producedEver,
    silent,
    label,
    title: producedEver
      ? `${side.toUpperCase()} socket: ${w} words · last text ${formatSilence(silentForMs)} ago`
      : `${side.toUpperCase()} socket: has produced no text yet`,
  };
};

/**
 * Both sockets, plus the one line that would have saved the call.
 *
 * The alert condition is deliberately narrow: BOTH sockets must be far enough
 * along that silence is meaningful (the peer has produced real text), and only
 * then do we claim one is starving the other. We never infer health from a
 * socket that has said nothing since connect.
 *
 * @returns {{en:object, es:object, alert:null|{tone:string, text:string, side:string}, quiet:null|{side:string,text:string}}}
 */
export const buildSocketHealth = ({ now, en = {}, es = {} }) => {
  const enSock = describeSocket({ now, side: 'en', ...en });
  const esSock = describeSocket({ now, side: 'es', ...es });

  let alert = null;
  let quiet = null;

  // One side is doing all the work. This is the incident shape: ES 0% while the
  // EN socket transcribed a whole conversation.
  if (esSock.producedEver && esSock.silent && enSock.words >= MIN_WORDS_FOR_SNIPPET && !enSock.silent) {
    alert = {
      side: 'es',
      tone: 'error',
      text: `ES socket silent ${formatSilence(esSock.silentForMs)} — the EN socket is transcribing everything.`,
    };
  } else if (enSock.producedEver && enSock.silent && esSock.words >= MIN_WORDS_FOR_SNIPPET && !esSock.silent) {
    alert = {
      side: 'en',
      tone: 'error',
      text: `EN socket silent ${formatSilence(enSock.silentForMs)} — the ES socket is transcribing everything.`,
    };
  } else if (enSock.producedEver || esSock.producedEver) {
    // Both alive: mention a lopsided split, which is the early warning before
    // one side actually dies. Note the peer does NOT have to have spoken yet —
    // "the other side has never said anything" is the most useful early warning
    // there is, and gating this on both being alive made it unreachable.
    if (enSock.words >= esSock.words) {
      const hi = enSock; const lo = esSock; const hiSide = 'EN';
      if (hi.words >= MIN_WORDS_FOR_SNIPPET && !lo.producedEver) {
        quiet = { side: lo.side, text: `${hiSide} is carrying the call (${hi.words}w vs ${lo.words}w)` };
      } else if (hi.words >= MIN_WORDS_FOR_SNIPPET && lo.producedEver && lo.silentForMs >= SOCKET_QUIET_HINT_MS) {
        quiet = { side: lo.side, text: `${lo.side.toUpperCase()} quiet ${formatSilence(lo.silentForMs)}` };
      }
    } else {
      const hi = esSock; const lo = enSock; const hiSide = 'ES';
      if (hi.words >= MIN_WORDS_FOR_SNIPPET && !lo.producedEver) {
        quiet = { side: lo.side, text: `${hiSide} is carrying the call (${hi.words}w vs ${lo.words}w)` };
      } else if (hi.words >= MIN_WORDS_FOR_SNIPPET && lo.producedEver && lo.silentForMs >= SOCKET_QUIET_HINT_MS) {
        quiet = { side: lo.side, text: `${lo.side.toUpperCase()} quiet ${formatSilence(lo.silentForMs)}` };
      }
    }
  }

  return { en: enSock, es: esSock, alert, quiet };
};
