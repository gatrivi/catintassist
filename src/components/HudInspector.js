// HudInspector (v4.89.0) — universal hover tooltip for ANY hud element,
// including plain container divs. Toggle ⌖ (bottom-right), hover shows the
// element name + unique CSS selector, click the tooltip to copy it so you
// can paste it back to report what's wrong.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const STORE_KEY = 'hud-inspector-on-v2';
export const INSPECTOR_CHANGED_EVENT = 'hud-inspector-changed';

/** v4.95.3: default OFF — debug tool, opt-in via Settings > Display or ⌖. v2 key resets v4.89.2 auto-ON. */
export const readInspectorEnabled = () => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === '1';
  } catch (_) {
    return false;
  }
};

/** Shared setter so Settings panel + floating toggle stay in sync. */
export const setInspectorEnabled = (next) => {
  try { localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch (_) { /* noop */ }
  try { window.dispatchEvent(new CustomEvent(INSPECTOR_CHANGED_EVENT, { detail: { enabled: !!next } })); } catch (_) { /* noop */ }
};

/** Friendly name: data-hud-name > data-guide > aria-label > title > #id > .class > <tag>. */
export const resolveHudName = (el) => {
  if (!el || typeof el.getAttribute !== 'function') return '<unknown>';
  const pick = (k) => {
    try { return el.getAttribute(k); } catch (_) { return null; }
  };
  const named = pick('data-hud-name') || pick('data-guide')
    || pick('aria-label') || pick('title') || pick('data-testid');
  if (named) return String(named).slice(0, 60);
  if (el.id) return `#${el.id}`;
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
  if (cls) return `.${cls}`;
  const tag = (el.tagName || 'div').toLowerCase();
  const role = pick('role');
  return role ? `<${tag} role=${role}>` : `<${tag}>`;
};

/** One-level token: prefer #id, else [data-guide], else tag.first-class. */
const tokenFor = (el) => {
  if (!el || !el.tagName) return '';
  if (el.id) return `#${CSS.escape ? CSS.escape(el.id) : el.id}`;
  try {
    const g = el.getAttribute && el.getAttribute('data-guide');
    if (g) return `[data-guide="${g}"]`;
  } catch (_) { /* noop */ }
  const tag = el.tagName.toLowerCase();
  let cls = '';
  if (typeof el.className === 'string') {
    const first = el.className.trim().split(/\s+/)[0];
    if (first && /^[A-Za-z_-]/.test(first)) cls = `.${CSS.escape ? CSS.escape(first) : first}`;
  }
  return `${tag}${cls}`;
};

/** Unique CSS path up to .app-container (max 6 levels). Works on real DOM + test fakes. */
export const buildUniqueSelector = (el) => {
  if (!el) return '';
  if (el.id) return `#${el.id}`;
  try {
    const g = el.getAttribute && el.getAttribute('data-guide');
    if (g) return `[data-guide="${g}"]`;
  } catch (_) { /* noop */ }
  const parts = [];
  let cur = el;
  let depth = 0;
  while (cur && cur.tagName && depth < 6) {
    const t = tokenFor(cur);
    if (t) parts.unshift(t);
    try {
      if (cur.classList && cur.classList.contains('app-container')) break;
    } catch (_) { /* noop */ }
    cur = cur.parentElement || cur.parentNode;
    depth += 1;
    if (!cur || cur === document?.body) break;
  }
  return parts.join(' > ') || (el.tagName || 'div').toLowerCase();
};

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (__) { return false; }
  }
};

export const HudInspectorHost = () => {
  const [on, setOn] = useState(readInspectorEnabled);
  const [tip, setTip] = useState(null); // { x, y, name, selector, below }
  const [copied, setCopied] = useState(false);
  const lastElRef = useRef(null);
  // v4.93.1 CPU fix: mousemove fires 60-120/s; coalesce via rAF, skip work
  // when hovering the same element, cache selector per element (WeakMap).
  const rafIdRef = useRef(0);
  const pendingEventRef = useRef(null);
  const selectorCacheRef = useRef(new WeakMap());

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch (_) { /* noop */ }
    try { window.dispatchEvent(new CustomEvent(INSPECTOR_CHANGED_EVENT, { detail: { enabled: on } })); } catch (_) { /* noop */ }
    if (!on) {
      setTip(null);
      if (lastElRef.current) {
        try { lastElRef.current.style.outline = ''; } catch (_) { /* noop */ }
        lastElRef.current = null;
      }
    }
  }, [on]);

  // Alt+I toggles inspector without hunting for the button mid-call.
  // Also syncs when Settings > Display flips the toggle.
  useEffect(() => {
    const onExternal = (e) => {
      const next = e?.detail?.enabled;
      if (typeof next === 'boolean') setOn(next);
      else setOn(readInspectorEnabled());
    };
    const onStorage = (e) => {
      if (!e || e.key === STORE_KEY) setOn(readInspectorEnabled());
    };
    window.addEventListener(INSPECTOR_CHANGED_EVENT, onExternal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(INSPECTOR_CHANGED_EVENT, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        setOn((v) => !v);
      }
      // 'c' while hovering copies current selector.
      if ((e.key === 'c' || e.key === 'C') && tip && !e.ctrlKey && !e.metaKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          copyText(`${tip.name} :: ${tip.selector}`).then((ok) => ok && setCopied(true));
          setTimeout(() => setCopied(false), 1200);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip]);

  useEffect(() => {
    if (!on) return undefined;
    const cachedSelector = (el) => {
      const cache = selectorCacheRef.current;
      let sel = cache.get(el);
      if (sel === undefined) {
        sel = buildUniqueSelector(el);
        try { cache.set(el, sel); } catch (_) { /* noop */ }
      }
      return sel;
    };
    const process = (e) => {
      rafIdRef.current = 0;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.hud-inspector-tip, .hud-inspector-toggle')) return;
      // Same element as last frame → nothing changed, skip setState entirely.
      if (t === lastElRef.current) return;
      const app = t.closest('.app-container');
      if (!app) {
        if (lastElRef.current) {
          try { lastElRef.current.style.outline = ''; } catch (_) { /* noop */ }
          lastElRef.current = null;
        }
        setTip((prev) => (prev === null ? prev : null));
        return;
      }
      const rect = t.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (lastElRef.current && lastElRef.current !== t) {
        try { lastElRef.current.style.outline = ''; } catch (_) { /* noop */ }
      }
      lastElRef.current = t;
      try { t.style.outline = '1px dashed #38bdf8'; } catch (_) { /* noop */ }
      const below = rect.top < 120;
      setTip({
        x: Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)),
        y: below ? rect.bottom : rect.top,
        below,
        name: resolveHudName(t),
        selector: cachedSelector(t),
      });
      setCopied(false);
    };
    const move = (e) => {
      // Coalesce the mousemove storm to one update per animation frame.
      pendingEventRef.current = e;
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => process(pendingEventRef.current));
    };
    const leave = () => {
      setTip(null);
      if (lastElRef.current) {
        try { lastElRef.current.style.outline = ''; } catch (_) { /* noop */ }
        lastElRef.current = null;
      }
    };
    document.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseleave', leave);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseleave', leave);
      leave();
    };
  }, [on]);

  const copyTip = useCallback(async () => {
    if (!tip) return;
    const ok = await copyText(`${tip.name} :: ${tip.selector}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }, [tip]);

  return createPortal(
    <>
      <button
        id="hud-inspector-toggle"
        type="button"
        className={`hud-inspector-toggle${on ? ' is-on' : ''}`}
        onClick={() => setOn((v) => !v)}
        title={on ? 'HUD inspector ON — hover anything, click tooltip to copy selector (Alt+I to hide)' : 'HUD inspector — hover any element to see its name + copy selector (Alt+I)'}
        aria-pressed={on}
      >
        ⌖
      </button>
      {on && tip && (
        <div
          className="hud-inspector-tip"
          style={{
            left: tip.x,
            top: tip.y,
            transform: tip.below ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))',
          }}
          onClick={copyTip}
          title="Click to copy name + selector"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') copyTip(); }}
        >
          <div className="hud-inspector-name">{tip.name}</div>
          <code className="hud-inspector-sel">{tip.selector}</code>
          <span className="hud-inspector-copy">{copied ? '✓ copied' : '⎘ click to copy'}</span>
        </div>
      )}
    </>,
    document.body,
  );
};
