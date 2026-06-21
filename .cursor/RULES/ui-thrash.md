**** UI THRASH GUARDRAILS ****

If an element shows a connection/progress status like `"Connecting now…"`, `"Connecting…"` or `"Initializing Sockets…"`, it must never re-mount/remount/animate in a tight loop.

Rules:
- No state-update loops. If a `useEffect`/async retry path would call `setState` repeatedly, you must add a latch/cooldown/ref guard so it runs at most once per explicit user intent or per reasonable interval.
- No sub-second thrash. The same status text/state must not be re-rendered hundreds of times per second. Add explicit backoff, a single-flight boolean, and stable effect dependencies.
- Stable dependencies. Never include rapidly changing objects/functions in effect dependency arrays unless they are memoized (`useCallback/useMemo`) or read via refs.
- “Connecting now…” must be treated as a blocking symptom: when it spams, the fix is first to stop retry/looping; only then touch UI.

