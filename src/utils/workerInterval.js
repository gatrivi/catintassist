// Un-throttled interval (v4.136.0).
// Chrome throttles hidden-tab page timers to ~1/min (Intensive Throttling),
// which deafened the idle-ear VAD (100ms poll) and starved the idle KeepAlive
// (4s) — the #1 real-world "app fails to detect speech" cause, since this app
// normally sits in a background tab while the meeting tab is watched.
// Timers inside a Web Worker are NOT visibility-throttled, so the tick is
// scheduled there and dispatched to the page as a message. Falls back to a
// plain setInterval where Workers/Blob URLs are unavailable (tests, old
// browsers) — identical contract, just throttled in hidden tabs.
//
// Returns a stop() function (idempotent). Stop-fns are what the callers store
// in refs — no interval ids leak out of this module.

export function createUnthrottledInterval(fn, ms) {
  if (typeof Worker === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    const id = setInterval(fn, ms);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      clearInterval(id);
    };
  }

  let worker = null;
  try {
    const src = `let id=null;onmessage=(e)=>{if(e.data==='start'){if(id===null){id=setInterval(()=>postMessage(0),${Number(ms)})}}else{clearInterval(id);id=null;close();}};`;
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => fn();
    worker.postMessage('start');
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      try {
        worker.postMessage('stop');
        worker.terminate();
      } catch (_) {}
      worker = null;
    };
  } catch (_) {
    // CSP-blocked Blob worker or Worker constructor failure — plain fallback.
    const id = setInterval(fn, ms);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      clearInterval(id);
    };
  }
}
