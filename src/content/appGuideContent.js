/** Bilingual app guide steps — keep en/es ids aligned. */

const STEP_DEFS = [
  {
    id: 'welcome',
    target: null,
    viewAction: null,
    en: {
      title: 'Welcome to CatIntAssist',
      body: 'Your interpreter cockpit: live transcription, side-by-side translation, and a gamified earnings HUD. This tour ~90 seconds.',
    },
    es: {
      title: 'Bienvenido a CatIntAssist',
      body: 'Tu cabina de interprete: transcripción en vivo, traducción lado a lado y panel de ganancias. Este recorrido ~90 segundos.',
    },
  },
  {
    id: 'connect',
    target: '[data-guide="connect"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '1 · Connect tab audio',
      body: 'Green button → pick the browser tab with your interpreter line. Check Share audio. Double-tap if Chrome asks twice. Stream stays attached between calls.',
    },
    es: {
      title: '1 · Conectar audio del tab',
      body: 'Botón verde → elige la pestaña de la línea de interprete. Marca Compartir audio. Doble toque si Chrome pide dos veces. El stream queda entre llamadas.',
    },
  },
  {
    id: 'mic',
    target: '#audio-route-mic-mode-btn',
    viewAction: { workspace: 'scoreboard', closeSettings: true },
    en: {
      title: '2 · STT route (🔖 · 🎧 · 🎤)',
      body: 'I/O strip toggle: 🔖 tab share · 🎧 VB-Cable · 🎤 mic (phone / no tab). Active mode highlights. Hotkey M = mic.',
    },
    es: {
      title: '2 · Ruta STT (🔖 · 🎧 · 🎤)',
      body: 'Barra I/O: 🔖 pestaña · 🎧 VB-Cable · 🎤 mic (teléfono / sin tab). El modo activo se resalta. Tecla M = mic.',
    },
  },
  {
    id: 'language',
    target: '[data-guide="language-pair"]',
    viewAction: { settingsSection: 'language', closeSettings: false },
    en: {
      title: '3 · Language pair',
      body: 'EN | ES pill shows your STT pair. Click → Settings → Language. Default EN↔ES. US number protections only for EN↔ES. Space / Alt+Space force left/right lane 30s.',
    },
    es: {
      title: '3 · Par de idiomas',
      body: 'Pastilla EN | ES = par STT. Clic → Ajustes → Language. Default EN↔ES. Protección de números solo EN↔ES. Espacio / Alt+Espacio fuerzan columna izq/der 30s.',
    },
  },
  {
    id: 'transcript',
    target: '[data-guide="transcript"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '4 · Transcript + translation',
      body: 'White = what was said. Gray = translation. Left/right columns follow your language pair (right column auto-flips). Bubbles split at . ! ?',
    },
    es: {
      title: '4 · Transcripción + traducción',
      body: 'Blanco = lo dicho. Gris = traducción. Columnas según tu par (la derecha se invierte sola). Burbujas se parten en . ! ?',
    },
  },
  {
    id: 'bubble-rail',
    target: '[data-guide="bubble-rail"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true },
    en: {
      title: '5 · Bubble rail (during calls)',
      body: 'During a call: T→P→R = translate / process / ready. Number = words this turn (orange 34, red 40). Play triangle = hear translation. Off-call: appears once live speech starts.',
    },
    es: {
      title: '5 · Rail central (en llamada)',
      body: 'En llamada: T→P→R = traducir / procesar / listo. Número = palabras del turno (naranja 34, rojo 40). Triángulo = audio traducción. Fuera de llamada: al hablar en vivo.',
    },
  },
  {
    id: 'metrics-strip',
    target: '[data-guide="metrics-expand"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '6 · Metrics strip',
      body: 'Collapsed off-call: one line + 3 thin bars (month / step / day). ▼ Metrics expands full scoreboard without losing transcript space.',
    },
    es: {
      title: '6 · Franja de métricas',
      body: 'Fuera de llamada: una línea + 3 barras (mes / escalón / día). ▼ Metrics expande el scoreboard sin perder espacio de transcripción.',
    },
  },
  {
    id: 'scoreboard',
    target: '[data-guide="scoreboard"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: true, scoreView: 'game' },
    en: {
      title: '7 · Game vs numbers',
      body: 'Game view = bounty HUD. Flip to numbers grid for 12 metrics. Presets (Minimal / Standard / Full) in edit mode. 🎯 opens weekly goal wheel.',
    },
    es: {
      title: '7 · Juego vs números',
      body: 'Vista juego = panel bounty. Gira a grilla numérica (12 métricas). Presets en modo edición. 🎯 abre ruleta de meta semanal.',
    },
  },
  {
    id: 'goal',
    target: '[data-guide="goal-wheel"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '8 · Goal picker wheel',
      body: '🎯 in sticky bar → weekly hours commitment dial. Sets daily minutes target from your monthly pace.',
    },
    es: {
      title: '8 · Ruleta de metas',
      body: '🎯 en barra superior → ruleta de horas semanales. Ajusta minutos diarios según ritmo mensual.',
    },
  },
  {
    id: 'soundboard',
    target: '[data-guide="soundboard-lab"]',
    viewAction: { workspace: 'soundboard', closeSettings: true },
    en: {
      title: '9 · Soundboard Studio',
      body: 'Pyramid button cycles Scoreboard ↔ Soundboard Studio (off-call only). Record greetings, health-check clips, rotating app backgrounds until you upload your own.',
    },
    es: {
      title: '9 · Estudio Soundboard',
      body: 'Botón pirámide alterna Scoreboard ↔ Soundboard Studio (solo fuera de llamada). Graba saludos, health-check, fondos rotativos hasta subir el tuyo.',
    },
  },
  {
    id: 'notes-pin',
    target: '[data-guide="notes"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '10 · Notes & pin',
      body: '📝 Quick notes panel (during calls). 📍 on any bubble pins voicemail/numbers to top. COPY_PINNED in footer exports pins.',
    },
    es: {
      title: '10 · Notas y pin',
      body: '📝 Notas rápidas (en llamada). 📍 en burbuja fija buzón/números arriba. COPY_PINNED en footer exporta pins.',
    },
  },
  {
    id: 'stop',
    target: '[data-guide="stop"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true },
    en: {
      title: '11 · Stop & recovery',
      body: 'Red stop banks minutes. ⚡ Zap if audio stalls. Yellow Re-attach after refresh keeps timer + transcript. Green vignette = in call.',
    },
    es: {
      title: '11 · Stop y recuperación',
      body: 'Stop rojo guarda minutos. ⚡ Zap si audio se cuelga. Re-attach amarillo tras refresh conserva timer + transcripción. Vignette verde = en llamada.',
    },
  },
  {
    id: 'power',
    target: '[data-guide="version"]',
    viewAction: { workspace: 'scoreboard', closeSettings: true, expandMetrics: false },
    en: {
      title: '12 · Power tips',
      body: 'Version tag top-right confirms build. Highlight text → Linguee. Shift+D demo scenarios. ? reopens this guide anytime.',
    },
    es: {
      title: '12 · Tips avanzados',
      body: 'Versión arriba-derecha confirma build. Selecciona texto → Linguee. Shift+D demos. ? reabre esta guía.',
    },
  },
];

export const GUIDE_STEP_IDS = STEP_DEFS.map((s) => s.id);

export const getGuideSteps = (lang = 'en') => {
  const code = lang === 'es' ? 'es' : 'en';
  return STEP_DEFS.map(({ id, target, viewAction, en, es }) => ({
    id,
    target,
    viewAction,
    title: (code === 'es' ? es : en).title,
    body: (code === 'es' ? es : en).body,
  }));
};

export const GUIDE_UI = {
  en: { skip: 'Skip', back: 'Back', next: 'Next', done: 'Done', langToggle: 'ES' },
  es: { skip: 'Omitir', back: 'Atrás', next: 'Siguiente', done: 'Listo', langToggle: 'EN' },
};
