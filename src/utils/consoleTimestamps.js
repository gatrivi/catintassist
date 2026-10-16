/**
 * v4.179.0 — every console line starts with local time `HH:MM:SS.mmm` so the
 * operator can say "show me the 14:37 ones". Patches console once, at boot.
 * A string first arg gets the stamp glued INTO it, so `%c` styling still works.
 */
export function stampArgs(args, date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const ts = `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}`;
  if (typeof args[0] === 'string') return [`${ts} ${args[0]}`, ...args.slice(1)];
  return [ts, ...args];
}

export function installConsoleTimestamps(c = console) {
  if (c.__catStamped) return;
  c.__catStamped = true;
  ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
    const orig = c[level].bind(c);
    c[level] = (...args) => orig(...stampArgs(args));
  });
}
