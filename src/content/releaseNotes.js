/**
 * In-app release notes — bilingual (es default, en).
 * Add one entry per shipped UX release; keyed by APP_VERSION.
 */
import { APP_VERSION } from '../constants/version';

/** @typedef {'es'|'en'} ReleaseNotesLang */

/**
 * @typedef {Object} ReleaseNoteCopy
 * @property {string} title
 * @property {string} intro
 * @property {{ heading: string, bullets: string[] }[]} sections
 */

/**
 * @typedef {Object} ReleaseNoteEntry
 * @property {string} version — must match APP_VERSION when shown
 * @property {string} id — stable id for dismiss-forever storage
 * @property {string[]} highlightElementIds — DOM ids to shine after dismiss
 * @property {ReleaseNoteCopy} es
 * @property {ReleaseNoteCopy} en
 */

/** Newest first. Only the entry matching APP_VERSION is shown on load. */
export const RELEASE_NOTES_CATALOG = [
  {
    version: '4.102.0',
    id: 'hud-inspector-click-copy-v1',
    highlightElementIds: ['hud-inspector-toggle'],
    es: {
      title: '🎯 Inspector HUD: clic = copiar selector · tooltip estable',
      intro: 'v4.102.0 — En modo inspector (⌖ o Alt+I), haz CLIC en cualquier elemento y se copia su id/selector; el clic no dispara nada más (como el picker de DevTools). El tooltip ya no desaparece cuando mueves el mouse hacia él: un puente invisible lo une al elemento. Esc sale del modo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Clic en el elemento = copia "nombre :: #selector" (antes había que acertarle al tooltip)',
        'El clic no activa el elemento mientras inspeccionas',
        'Tooltip estable: puente invisible elemento↔tooltip; se congela al llegar',
        'Esc también apaga el inspector (además de Alt+I y ⌖)',
      ] }],
    },
    en: {
      title: '🎯 HUD inspector: click = copy selector · stable tooltip',
      intro: "v4.102.0 — In inspector mode (⌖ or Alt+I), CLICK any element and its id/selector is copied; the click does nothing else (like the DevTools picker). The tooltip no longer vanishes as you move the mouse toward it: an invisible bridge connects it to the element. Esc exits the mode.",
      sections: [{ heading: 'What changed', bullets: [
        'Clicking the element copies "name :: #selector" (before you had to hit the tooltip)',
        'The click is swallowed while inspecting',
        'Stable tooltip: invisible element↔tooltip bridge; freezes when you reach it',
        'Esc now also exits the inspector (besides Alt+I and ⌖)',
      ] }],
    },
  },
  {
    version: '4.101.0',
    id: 'soundboard-dedup-slotscripts-v1',
    highlightElementIds: [],
    es: {
      title: '🎙 Soundboard: sin duplicados · guiones AM/PM/Eve · sin rojo',
      intro: 'v4.101.0 — Dediuplicado: el LEP Open en inglés se jubiló (el saludo al LEP va en su idioma; tu grabación migró a Opener – LEP (ES) AM). Los guiones de los saludos ahora cambian con la hora: el de la tarde dice "Buenas tardes / Good afternoon". Tiles no grabados en gris, EN verde, ES azul — nada en rojo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'open_lep (LEP Open) jubilado; grabación migrada a Opener – LEP (ES) si no había ninguna',
        'Guiones por franja: AM dice "Good morning", PM "Good afternoon", Eve "Good evening" (ES: buenos días/tardes/noches)',
        'El guion se ve en el tile antes de grabar, y en la tarjeta al grabar',
        'Colores: no grabado = gris, EN = verde, ES = azul; sin rojo en el soundboard',
      ] }],
    },
    en: {
      title: '🎙 Soundboard: deduped · AM/PM/Eve scripts · no red',
      intro: 'v4.101.0 — Deduped: the English-reading LEP Open is retired (the LEP greeting is delivered in the LEP language; your recording migrated to Opener – LEP (ES) AM). Greeting scripts now follow the time of day: the afternoon one says "Good afternoon". Unrecorded tiles are gray, EN green, ES blue — no red.',
      sections: [{ heading: 'What changed', bullets: [
        'open_lep (LEP Open) retired; recording migrated to Opener – LEP (ES) if you had none',
        'Slot scripts: AM says "Good morning", PM "Good afternoon", Eve "Good evening" (ES: buenos días/tardes/noches)',
        'Script preview right on the tile before recording, and on the card while recording',
        'Colors: unrecorded = gray, EN = green, ES = blue; no red in the soundboard',
      ] }],
    },
  },
  {
    version: '4.100.2',
    id: 'honest-dg-chip-autozap-v1',
    highlightElementIds: ['audio-route-zap-btn'],
    es: {
      title: '🩺 Chip DG honesto + reconexión automática',
      intro: 'v4.100.2 — El chip ya no dice TEXT ✓ cuando Deepgram está colgado: 30s sin datos muestra DG QUIET ⚠ (ámbar), 60s DG STUCK ⚠ (rojo). Además, a los 65s sin datos el app se reconecta sola (auto-Zap) — ya no tienes que tocar ZAP.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'TEXT ✓ solo mientras llegan datos; silencio = DG QUIET / DG STUCK',
        'El punto pasa a ámbar (30s) y rojo (60s) en un estancamiento',
        'Auto-Zap: reconexión sola a los 65s sin datos, máx 1 por 2 min',
      ] }],
    },
    en: {
      title: '🩺 Honest DG chip + auto-reconnect',
      intro: 'v4.100.2 — The chip no longer says TEXT ✓ while Deepgram is silently stuck: 30s with no data shows DG QUIET ⚠ (amber), 60s DG STUCK ⚠ (red). Also, after 65s with no data the app auto-Zaps itself — no more manual ZAP.',
      sections: [{ heading: 'What changed', bullets: [
        'TEXT ✓ only while data flows; silence = DG QUIET / DG STUCK',
        'Dot goes amber (30s) then red (60s) on a stall',
        'Auto-Zap: self-reconnect at 65s without data, max 1 per 2 min',
      ] }],
    },
  },
  {
    version: '4.100.1',
    id: 'goal-defaults-1200-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: '🎯 Meta por defecto: $1200 y 6.5 días/semana',
      intro: 'v4.100.1 — La meta inicial ahora es 9231m ($1200 a $0.13/min) y la rueda abre en 6.5/Wk (28d). Si tu total difiere, corrígelo en la rueda (fila banked/mo o ↻ re-suma).',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Meta inicial 9231m en lugar de 5500m',
        'La rueda abre por defecto en 6.5/Wk',
      ] }],
    },
    en: {
      title: '🎯 Default goal: $1200 and 6.5 days/week',
      intro: 'v4.100.1 — Fresh installs start at a 9231m goal ($1200 at $0.13/min) and the wheel opens on 6.5/Wk (28d). If your banked total differs, fix it in the wheel (banked/mo row or ↻ re-sum).',
      sections: [{ heading: 'What changed', bullets: [
        'Fresh-install goal 9231m instead of 5500m',
        'Wheel defaults to 6.5/Wk',
      ] }],
    },
  },  {
    version: '4.100.0',
    id: 'goal-wheel-rehab-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: '🎯 Rueda de meta rehabilitada — el HUD ahora es botón',
      intro: 'v4.100.0 — El chip de metas del HUD (💵⏱☕📉) ahora es un botón: lo tocas y el HUD se reemplaza por la rueda de meta. La rueda trae vista previa de catch-up (cuánto hoy para volver al ritmo), opción 6.5 días/semana, entrada directa de minutos mensuales y corrección del total del mes en 2 clics (re-suma del registro). El logo 🐱 vuelve a la transcripción.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Chip de metas clicable — abre la rueda en línea, Cancel o 🐱 para volver',
        'Rueda: snap inicial usa tus días reales; suma 6.5/Wk (28d); pasos ◀▶ + teclado',
        'Vista previa: atraso, cuánto hoy, carga por día laboral y banco actual',
        'Corrección del mes: edita el total o ↻ re-suma desde el registro diario',
        '🐱 (logo) vuelve a la pantalla de transcripción',
      ] }],
    },
    en: {
      title: '🎯 Goal wheel rehab — the HUD is now a button',
      intro: 'v4.100.0 — The HUD targets chip (💵⏱☕📉) is now a button: tap it and the HUD swaps for the goal wheel. The wheel gains a catch-up preview (how much today to get back on pace), a 6.5-day/week option, direct monthly-minutes input, and a 2-click month-total fix (re-sum from the daily log). The 🐱 logo goes back to transcription.',
      sections: [{ heading: 'What changed', bullets: [
        'Clickable targets chip — opens the wheel inline, Cancel or 🐱 to go back',
        'Wheel: initial snap uses your real workdays; adds 6.5/Wk (28d); ◀▶ steps + keyboard',
        'Preview: deficit, need-today, per-workday load, and banked total',
        'Month fix: edit the total directly or ↻ re-sum from the daily log',
        '🐱 (logo) returns to the transcription screen',
      ] }],
    },
  },
  {
    version: '4.99.3',
    id: 'soundboard-dedup-v1',
    highlightElementIds: ['interpret-root'],
    es: {
      title: '🧹 Soundboard sin duplicados — un solo Opener–Client',
      intro: 'v4.99.3 — "Greeting" y "Client Open" eran el mismo texto: queda uno solo (Opener–Client, con versiones mañana/tarde/noche). Si habías grabado el duplicado, tu audio se muda solo al que queda. El resto se reordenó: Opener–… / Closing–… / Legacy–….',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Opener–Client único — adiós al tile repetido "Client Open"',
        'Openers y cierres renombrados en orden de llamada; Callout/Louder/Anyone marcados Legacy',
        'Tu grabación del duplicado se copia sola si el que queda está vacío (nunca se borra audio)',
        'El viejo clip queda como huérfano recuperable en Export backup',
      ] }],
    },
    en: {
      title: '🧹 Soundboard dedup — one Opener–Client',
      intro: 'v4.99.3 — "Greeting" and "Client Open" were the same script: one tile remains (Opener–Client, with morning/afternoon/evening variants). If you had recorded the dupe, its audio carries over automatically. The rest is relabeled: Opener–… / Closing–… / Legacy–….',
      sections: [{ heading: 'What changed', bullets: [
        'Single Opener–Client — the repeated "Client Open" tile is gone',
        'Openers and closers renamed in call order; Callout/Louder/Anyone tagged Legacy',
        'Your dupe recording auto-copies when the survivor slot is empty (audio never deleted)',
        'The old clip stays as a recoverable orphan in Export backup',
      ] }],
    },
  },
  {
    version: '4.99.2',
    id: 'scoreboard-ledger-fixes-v1',
    highlightElementIds: ['interpret-root'],
    es: {
      title: '🧮 SCOREBOARD HONESTO — se acabaron los 893m OFF CALL y el mes de 156m',
      intro: 'v4.99.2 — Tres fugas del ledger corregidas: los contadores vivos ya no arrastran cola del día anterior (el imposible "893m OFF CALL"); reattach tras STOP ya no factura la misma llamada dos veces; y una llamada sin voz de Deepgram (≥60s) ahora factura reloj — una caída de DG ya no borra tu día.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Contadores vivos (s_sec/a_sec/b_sec) se invalidan al cambiar el día — nada del ayer entra en hoy',
        'STOP pone el cronómetro a cero tras consolidar — refresh+reattach ya no duplica minutos',
        'Llamada sin STT ≥60s factura tiempo real (aviso "🎧 banked without STT" en el resumen)',
        '$ MONTH incluye la llamada en curso — mismo criterio que MINS TODAY',
        'Barra superior en UNA línea: chips + %mes + Less + iconos (scrolla si no cabe)',
      ] }],
    },
    en: {
      title: '🧮 HONEST SCOREBOARD — no more 893m OFF CALL or the 156m month',
      intro: 'v4.99.2 — Three ledger leaks fixed: live counters no longer drag yesterday\'s tail into today (the impossible "893m OFF CALL"); re-attach after STOP can no longer bill the same call twice; and a call with no Deepgram speech (≥60s) now bills wall-clock — a DG outage no longer erases your day.',
      sections: [{ heading: 'What changed', bullets: [
        'Live counters (s_sec/a_sec/b_sec) invalidated on day change — nothing from yesterday lands in today',
        'STOP zeroes the timer after banking — refresh + re-attach no longer double-counts minutes',
        'No-STT call ≥60s bills wall-clock ("🎧 banked without STT" note in the call summary)',
        '$ MONTH includes the live call — same convention as MINS TODAY',
        'Top strip on ONE line: chips + month% + Less + icons (scrolls when tight)',
      ] }],
    },
  },
  {
    version: '4.99.1',
    id: 'mic-verify-crash-hotfix-v1',
    highlightElementIds: ['interpret-root'],
    es: {
      title: '🔥 HOTFIX — panel MIC VERIFY ya no tumba la app',
      intro: 'v4.99.1 — El panel de verificación de micrófono chocaba al abrirse cuando existía un micrófono por defecto de Edge. Corregido: la app arranca normal.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'MicVerifyPanel ya no crashea al primer render (verdict era null antes del primer TEST)',
      ] }],
    },
    en: {
      title: '🔥 HOTFIX — MIC VERIFY panel no longer crashes the app',
      intro: 'v4.99.1 — The mic verification panel crashed on open whenever an Edge default mic existed. Fixed: the app boots normally.',
      sections: [{ heading: 'What changed', bullets: [
        'MicVerifyPanel no longer crashes on first render (verdict was null before the first TEST)',
      ] }],
    },
  },
  {
    version: '4.99.0',
    id: 'time-ledger-durable-v1',
    highlightElementIds: ['interpret-root'],
    es: {
      title: '⏱ TIEMPO A PRUEBA DE TODO — registro on/off call duradero',
      intro: 'v4.99.0 — Tu registro de tiempo ahora sobrevive a cualquier cosa: si el navegador muere pierdes máximo 1 minuto; si la pestaña queda abierta al cruzar medianoche, el día se archiva solo; y al iniciar sesión con Google, el historial de días se espeja a Firebase (y se restaura en otra máquina o tras borrar el navegador).',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Segundos de DISPONIBLE/DESCANSO se consolidan cada minuto — un crash ya no se los come',
        'Medianoche en vivo: el día se archiva solo aunque no cierres la pestaña',
        'Espejo Firebase users/{uid}/timetrack — solo sube cuando hay cambios (cuida el free tier)',
        'Al iniciar sesión: completa días faltantes desde la nube — JAMÁS sobrescribe lo local',
        'Sin sesión: todo sigue igual, localStorage manda',
      ] }],
    },
    en: {
      title: '⏱ BULLETPROOF TIME LEDGER — durable on/off-call record',
      intro: 'v4.99.0 — Your time record now survives anything: a browser kill loses at most 1 minute; a tab left open across midnight archives the day by itself; and signing in with Google mirrors the day history to Firebase (restoring it on another machine or after a browser wipe).',
      sections: [{ heading: 'What changed', bullets: [
        'AVAIL/BREAK seconds bank every minute — a crash no longer eats them',
        'Live midnight rollover — the day archives itself even with the tab open',
        'Firebase mirror users/{uid}/timetrack — pushes only on change (free-tier safe)',
        'On sign-in: fills MISSING days from the cloud — NEVER overwrites local data',
        'Signed out: everything as before, localStorage rules',
      ] }],
    },
  },  {
    version: '4.98.0',
    id: 'call-autopilot-v1',
    highlightElementIds: ['header-autopilot-chip'],
    es: {
      title: '🤖 CALL AUTOPILOT — la plataforma arranca y corta sola',
      intro: 'v4.98.0 — Actívalo en Settings → Behavior. Con UN solo CONNECT por sesión: la frase "call is being bridged" INICIA la llamada y "the caller has disconnected" abre un aviso de 10s que puedes cancelar y luego corta. Los anuncios de cola ("please continue to hold") ya no inician facturación por error.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Auto-START solo con frase de puente o llamada entrante — hablar solo ya no inicia (antes sí)',
        'Auto-END con frase de desconexión → banner de 10s con "Keep call" / "End now"',
        'Chip verde 🤖 AUTO en la barra — apunta a qué hora actuó el autopiloto',
        'Frases editables en Settings → Behavior (una por línea)',
        'Experimental: escucha del ring/campana en Settings (solo registro — aún no actúa)',
      ] }],
    },
    en: {
      title: '🤖 CALL AUTOPILOT — the platform starts and ends calls for you',
      intro: 'v4.98.0 — Enable it in Settings → Behavior. With ONE CONNECT per browser session: "call is being bridged" STARTS the call, "the caller has disconnected" opens a 10s banner you can cancel and then ends it. Queue announcements ("please continue to hold") no longer start billing by mistake.',
      sections: [{ heading: 'What changed', bullets: [
        'Auto-START only on a bridge phrase — speech alone no longer starts a call',
        'Auto-END on a disconnect phrase → 10s banner with "Keep call" / "End now"',
        'Green 🤖 AUTO header chip — hover shows the last autopilot action time',
        'Phrase lists editable in Settings → Behavior (one per line)',
        'Experimental ring/bell listener in Settings (log-only — acts on nothing yet)',
      ] }],
    },
  },  {
    version: '4.97.0',
    id: 'mic-verify-v1',
    highlightElementIds: ['interpret-root'],
    es: {
      title: 'MIC VERIFY — ¿te escuchará el cliente?',
      intro: 'v4.97.0 — Panel nuevo en el panel inactivo: elige el micrófono del cliente (el que toma la plataforma), pulsa TEST, habla 5s y verás barras de señal por dispositivo + te escuchas a ti mismo por la salida elegida. Avisa si el micrófono por defecto de Edge no es el tuyo — ese es el que toma la plataforma.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Dropdowns de micrófono y salida DENTRO del panel (ya no buscar en la I/O strip)',
        'TEST: 5s hablando → barras en vivo por cada mic + veredicto ✅/❌/⚠️',
        'Te escuchas de vuelta (loopback) por el dispositivo de salida elegido',
        'Chip 🎤 en la barra: mic fijado + último veredicto, antes de volver a avail',
        'Aviso si Edge default ≠ tu mic, y si el dispositivo corre a 44.1k en vez de 48k',
      ] }],
    },
    en: {
      title: 'MIC VERIFY — will the client hear you?',
      intro: 'v4.97.0 — New panel in the idle pane: pin the client mic (what the platform grabs), press TEST, speak for 5s → per-device signal bars + hear yourself back through the chosen output. Warns when Edge\u2019s default mic isn\u2019t yours — that\u2019s the one the platform tab grabs.',
      sections: [{ heading: 'What changed', bullets: [
        'Mic + playback dropdowns INSIDE the panel (no more I/O-strip hunt)',
        'TEST: speak 5s → live bars per mic + verdict ✅/❌/⚠️',
        'Loopback playback through your chosen output device',
        '🎤 chip on the bar: pinned mic + last verdict, before returning to avail',
        'Warns when Edge default ≠ your pick, and when a device runs 44.1k instead of 48k',
      ] }],
    },
  },  {
    version: '4.96.5',
    id: 'hand-edit-sync-v1',
    highlightElementIds: ['heatmap-panel'],
    es: {
      title: 'Editar un día a mano ya actualiza todo',
      intro: 'v4.96.5 — Corregir los minutos de un día pasado en el heatmap ahora actualiza el mes y el chip de déficit (antes solo pintaba la piedrita y el marcador quedaba viejo). Los días de otros meses no tocan las stats.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Clic en un día del heatmap → escribir minutos → todo se sincroniza',
        'Déficit, plan de recuperación y % del mes siguen la corrección',
        'Hoy sigue siendo el único día con edición en vivo separada',
      ] }],
    },
    en: {
      title: 'Hand-editing a day now updates everything',
      intro: 'v4.96.5 — Correcting a past day\u2019s minutes in the heatmap now updates the month total and the deficit chip (before it only repainted the pebble and the scoreboard stayed stale). Other-month days never touch stats.',
      sections: [{ heading: 'What changed', bullets: [
        'Click a heatmap day → type minutes → everything syncs',
        'Deficit, catch-up plan and month % follow the correction',
        'Today keeps its separate live-edit path',
      ] }],
    },
  },  {
    version: '4.96.4',
    id: 'pf-fail-shows-script-v1',
    highlightElementIds: ['sb-preflight-check'],
    es: {
      title: 'El fallo de calidad ya muestra el guion',
      intro: 'v4.96.4 — Cuando un clip sale UNACCEPTABLE por palabras equivocadas, el mensaje mandaba a buscar "el guion en Setup"… sin mostrarlo. Ahora el guion esperado aparece justo ahí, y el botón 🔧 Fix abre Setup en ese clip.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Paso 1 del preflight: muestra "Script:" con el texto esperado en el propio fallo',
        'Sigue viendo "Robot heard:" para comparar qué escuchó Deepgram',
        '🔧 Fix — re-record abre Setup directamente en ese clip',
      ] }],
    },
    en: {
      title: 'The quality failure now shows the script',
      intro: 'v4.96.4 — When a clip scored UNACCEPTABLE for wrong words, the message pointed at "the Script shown in Setup"… without showing it. The expected script now appears right in the failure, and 🔧 Fix opens Setup at that clip.',
      sections: [{ heading: 'What changed', bullets: [
        'Preflight step 1: shows "Script:" with the expected text inline in the failure',
        'Still shows "Robot heard:" so you can compare what Deepgram caught',
        '🔧 Fix — re-record opens Setup directly at that clip',
      ] }],
    },
  },
  {
    version: '4.96.3',
    id: 'call-card-numbers-v1',
    highlightElementIds: ['header-expand-btn'],
    es: {
      title: 'El header expandido en llamada ya es todo datos',
      intro: 'v4.96.3 — Al expandir el header durante una llamada veías una tarjeta de 242px casi vacía: DAY/MONTH, "ON CALL" y botones muertos (todo eso ya vive en la micro-barra). Ahora esa tarjeta muestra directo la grilla de 12 métricas, sin cara de juego vacía.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'En llamada: grilla de números siempre visible (ya no se esconde por "solo off-call")',
        'Fuera: DAY/MONTH, ON CALL duplicado y píldora de meta semanal en llamada',
        'Mismo lugar, mismos botones — 0px de vacío',
      ] }],
    },
    en: {
      title: 'In-call expanded header is now all data',
      intro: 'v4.96.3 — Expanding the header during a call showed a ~242px nearly-empty card: DAY/MONTH, "ON CALL" and dead buttons (all of it already lives in the micro-bar). That card now shows the 12-metric numbers grid directly — no empty game face.',
      sections: [{ heading: 'What changed', bullets: [
        'In call: numbers grid always visible (no longer hidden as "off-call only")',
        'Gone in call: DAY/MONTH, duplicated ON CALL, weekly-goal pill',
        'Same spot, same buttons — 0px of void',
      ] }],
    },
  },
  {
    version: '4.96.2',
    id: 'chip-narrow-fit-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'El chip ya no pisa los botones en ventanas angostas',
      intro: 'v4.96.2 — En ventanas de menos de ~850px el chip de metas se desbordaba y sus contadores quedaban ENCIMA de STT:FAST / EN|ES. Ahora se degrada solo: esconde ☕ primero, luego 💵; ⏱ y 📉 (lo importante) quedan siempre. Todo el detalle sigue en el tooltip al hover.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Ventana angosta: ☕ se esconde primero, luego 💵',
        '⏱ y 📉 déficit nunca se esconden ni se superponen',
        'Sin pérdida de info: el hover muestra todas las filas',
      ] }],
    },
    en: {
      title: 'Chip no longer overlaps buttons on narrow windows',
      intro: 'v4.96.2 — Under ~850px the goals chip overflowed and its counters painted ON TOP of STT:FAST / EN|ES. It now degrades gracefully: hides ☕ first, then 💵; ⏱ and 📉 (what matters) always stay. Hover still shows every row.',
      sections: [{ heading: 'What changed', bullets: [
        'Narrow window: ☕ hides first, then 💵',
        '⏱ and 📉 deficit never hide or overlap',
        'No information loss: hover shows all rows',
      ] }],
    },
  },  {
    version: '4.96.1',
    id: 'habit-toast-fix-v1',
    highlightElementIds: ['wellbeing-dock-desk'],
    es: {
      title: 'Los avisos de hábitos ya no se pegan',
      intro: 'v4.96.1 — Los avisos del dock de bienestar desaparecen solos (máx 15 s), se cierran al tocar la pastilla y se limpian al empezar una llamada. Nunca más tooltips amontonados sobre la transcripción.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Nivel 3 ("your body needs this") dura 15 s en vez de quedarse para siempre',
        'Clic en la pastilla = aviso cerrado al instante',
        'Empezar una llamada limpia cualquier aviso visible',
        'Tooltips/toasts del dock en fila horizontal, no amontonados',
      ] }],
    },
    en: {
      title: 'Habit nudges no longer stick',
      intro: 'v4.96.1 — Wellbeing-dock nudges auto-hide (15 s max), dismiss when you click their pill, and clear when a call starts. No more tooltip pile-ups over the transcript.',
      sections: [{ heading: 'What changed', bullets: [
        'Level 3 ("your body needs this") lasts 15 s instead of forever',
        'Click a pill = instant dismissal of its toast',
        'Starting a call clears any visible toast',
        'Dock tooltips/toasts fan out in a row instead of stacking',
      ] }],
    },
  },
  {
    version: '4.96.0',
    id: 'catch-up-clarity-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Tu plan de recuperación, siempre a la vista',
      intro: 'v4.96.0 — El chip del header ahora muestra cuánto vas tarde respecto al ritmo mensual (📉 −XhYm en rojo) sin hover. El panel expandido agrega el plan completo: cuánto hacer HOY, a qué hora terminás, cuánto por día el resto del mes y si alcanza antes de 18:00/23:00.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Chip: 📉 −6h12m (rojo) o 📈 +45m (verde) siempre visible',
        'Panel expandido: 📉 BEHIND → hoy → resto del mes → veredicto',
        'El objetivo del chip ahora usa TU meta del dial (no la estimación de $1200)',
        'Tooltip: primera fila = déficit y plan de recuperación',
      ] }],
    },
    en: {
      title: 'Your catch-up plan, always visible',
      intro: 'v4.96.0 — The header chip now shows how far behind month pace you are (📉 −XhYm in red) with no hover needed. The expanded panel adds the full plan: what to do TODAY, estimated clock-off, per-day load for the rest of the month, and whether it fits before 18:00/23:00.',
      sections: [{ heading: 'What changed', bullets: [
        'Chip: 📉 −6h12m (red) or 📈 +45m (green) always visible',
        'Expanded panel: 📉 BEHIND → today → rest of month → verdict',
        "Chip's daily target now uses YOUR dial goal (not the $1200 estimate)",
        'Tooltip: first row = deficit + catch-up plan',
      ] }],
    },
  },  {
    version: '4.95.4',
    id: 'live-counters-perf-v1',
    highlightElementIds: ['metric-m1', 'metric-m4'],
    es: {
      title: 'Contadores vivos, sin lag',
      intro: 'v4.95.4 — Vuelven los contadores dinámicos: $ TODAY sube cada segundo en llamada y MINS/LEFT/OFF muestran segundos tickeando. Sin odómetro pesado: mismo 1Hz que ya existía, 0 timers extra.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '$ TODAY + llamada actual tickean cada segundo (en llamada)',
        'MINS TODAY / LEFT / OFF CALL con segundos vivos',
        'Adiós strip odómetro pesado (menos nodos, sin jitter)',
      ] }],
    },
    en: {
      title: 'Live counters, no lag',
      intro: 'v4.95.4 — Dynamic counters are back: $ TODAY climbs every second in-call and MINS/LEFT/OFF show ticking seconds. No heavy odometer: same existing 1Hz tick, 0 extra timers.',
      sections: [{ heading: 'What changed', bullets: [
        '$ TODAY + current call tick every second (in-call)',
        'MINS TODAY / LEFT / OFF CALL with live seconds',
        'Heavy odometer strip removed (fewer nodes, no jitter)',
      ] }],
    },
  },  {
    version: '4.95.3',
    id: 'hud-inspector-off-by-default-v1',
    highlightElementIds: ['hud-inspector-toggle'],
    es: {
      title: 'Inspector apagado por defecto',
      intro: 'v4.95.3 — El inspector ⌖ de selectores ya viene APAGADO (estaba prendido y molestaba en trabajo). Se prende desde Ajustes > Display o con Alt+I.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '⌖ apagado por defecto (antes prendido)',
        'Toggle en Ajustes > Display para prenderlo cuando lo necesites',
      ] }],
    },
    en: {
      title: 'Inspector off by default',
      intro: 'v4.95.3 — The ⌖ selector inspector now ships OFF (it was ON and getting in the way at work). Turn it on via Settings > Display or Alt+I.',
      sections: [{ heading: 'What changed', bullets: [
        '⌖ off by default (was on)',
        'Toggle in Settings > Display when you need it',
      ] }],
    },
  },  {
    version: '4.95.1',
    id: 'meter-hud-mode-v1',
    highlightElementIds: ['header-meter-hud-btn'],
    es: {
      title: 'HUD de solo medidor',
      intro: 'v4.95.1 — Tercer modo de HUD en llamadas: 📊 arriba a la derecha alterna compacto ↔ solo medidor. Solo medidor = cronómetro de jornada grande (ON/OFF/LEFT) + metas 💵⏱☕. También separa métricas vs barra I/O off-call.',
      sections: [{ heading: 'Nuevo', bullets: [
        '📊 toggle persistente (recordado entre llamadas)',
        'Medidor legible: fuente grande, ya no queda detrás del HUD',
      ] }],
    },
    en: {
      title: 'Meter-only HUD',
      intro: 'v4.95.1 — Third HUD mode during calls: 📊 top-right toggles compact ↔ meter-only. Meter-only = big workday timeline (ON/OFF/LEFT) + 💵⏱☕ targets. Also separates metrics strip vs I/O bar off-call.',
      sections: [{ heading: 'New', bullets: [
        '📊 persistent toggle (remembered across calls)',
        'Readable meter: big font, no longer stuck behind the HUD',
      ] }],
    },
  },
  {
    version: '4.94.1',
    id: 'cpu-freeze-blank-row-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Congelamiento CPU arreglado',
      intro: 'v4.94.1 — Ya no se congela el CPU: una fila de transcripción vacía quedaba atrapada en el estado y se volvía a registrar ("CAT VANISH") en cada render, 4×/seg durante toda la llamada. Las filas vacías ya no llegan a la UI y cada id se registra una sola vez.',
      sections: [
        { heading: 'Qué cambió', bullets: [
          'Las filas de transcripción vacías se eliminan en el motor, no en el render',
          'Log CAT VANISH de filas vacías: una vez por id (antes: cada render)',
          'Reloj del tablero: 1s en vez de 250ms (menos renders por llamada)',
        ] },
      ],
    },
    en: {
      title: 'CPU freeze fixed',
      intro: 'v4.94.1 — No more freeze: an empty transcript row got stuck in state and was re-logged ("CAT VANISH") on every render, 4×/sec all call long. Blank rows never reach the UI now, and each id logs once.',
      sections: [
        { heading: 'What changed', bullets: [
          'Blank transcript rows are dropped in the engine, not at render time',
          'CAT VANISH blank-row log: once per id (was: every render)',
          'Board clock: 1s instead of 250ms (fewer renders per call)',
        ] },
      ],
    },
  },
  {
    version: '4.93.0',
    id: 'no-check-badges-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Adiós [⚠ Check: …] — transcripciones legibles',
      intro: 'v4.93.0 — ELIMINADOS los badges "[⚠ Check: 7 minutes]" que ensuciaban la traducción. Eran falsos positivos ("7 minutes" no es una dirección). El texto queda limpio; la protección de dígitos sigue (mantiene la traducción buena anterior).',
      sections: [
        { heading: 'Qué cambió', bullets: [
          'Cero badges [⚠ Check: …] en la transcripción/traducción',
          '"7 minutes", "1 of", "5 to" ya no cuentan como datos sensibles',
          'Teléfonos/fechas/dosis reales: si se pierden, se conserva la traducción buena previa (sin marcadores)',
          'Textos viejos guardados con badges también se limpian al mostrarlos',
        ] },
      ],
    },
    en: {
      title: 'RIP [⚠ Check: …] — readable transcripts',
      intro: 'v4.93.0 — The "[⚠ Check: 7 minutes]" badges flooding your translation are GONE. They were false positives ("7 minutes" is not an address). Text stays clean; digit-loss safety keeps working via preserve-previous-good.',
      sections: [
        { heading: 'What changed', bullets: [
          'Zero [⚠ Check: …] badges in transcription/translation',
          '"7 minutes", "1 of", "5 to" no longer count as sensitive tokens',
          'Real phones/dates/doses: if lost, previous good translation is kept (no markers)',
          'Old saved text with badges is cleaned on display too',
        ] },
      ],
    },
  },
  {
    version: '4.92.0',
    id: 'idle-ear-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Oreja siempre prendida: la llamada se conecta sola',
      intro: 'v4.92.0 — Ya no precCONNECT entre llamadas: después de STOP las orejas quedan prendidas (Deepgram NO recibe audio, solo pings = no gasta nada) y con que el provider hable, la llamada arranca sola.',
      sections: [
        { heading: 'Cómo funciona', bullets: [
          'STOP → sockets calientes + VAD local escucha (sin audio enviado = $0)',
          'Voz detectada (~0,3s) → grabadora vuelve → llamada arranca sola',
          'Un solo CONNECT por sesión del navegador (regla del navegador)',
          'Settings → Speech Auto Connect debe estar prendido',
        ] },
      ],
    },
    en: {
      title: 'Always-on ear: calls start themselves',
      intro: 'v4.92.0 — No more pressing CONNECT between calls: after STOP the app keeps listening (Deepgram receives NO audio, only pings = zero usage). When speech appears, the call starts by itself.',
      sections: [
        { heading: 'How it works', bullets: [
          'STOP → warm sockets + local VAD (no audio sent = $0)',
          'Speech detected (~0.3s) → recorder resumes → call auto-starts',
          'One CONNECT press per browser session (browser rule)',
          'Settings → Speech Auto Connect must be ON',
        ] },
      ],
    },
  },
  {
    version: '4.91.0',
    id: 'daily-targets-smart-tooltip-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Tooltips vivos en las metas del día',
      intro: 'v4.91.0 — Pasá el mouse por 💵 ⏱ ☕ en la barra de abajo: panel instantáneo con TODO en USD — ganado vs target, minutos que faltan ≈ $, costo del break ($0.13/min), mes y piso 5500m.',
      sections: [
        { heading: 'Qué ves', bullets: [
          '💵 ganado hoy / target hoy (%)',
          '⏱ minutos on-call · faltantes ≈ $',
          '☕ break tomado · el que cabe por 18:00 · costo por minuto',
          '📅 mes en curso vs $1200 · piso 5500m/mo',
        ] },
      ],
    },
    en: {
      title: 'Smart tooltips on the daily targets chip',
      intro: 'v4.91.0 — Hover the 💵 ⏱ ☕ chips in the bottom bar: an instant panel spells it all out in USD — earned vs target, minutes to go ≈ $, break cost ($0.13/min), month and 5500m floor.',
      sections: [
        { heading: 'What you see', bullets: [
          '💵 earned today / target today (%)',
          '⏱ on-call minutes · remaining ≈ $',
          '☕ break taken · what fits by 18:00 · cost per minute',
          '📅 month vs $1200 · 5500m/mo floor',
        ] },
      ],
    },
  },
  {
    version: '4.90.0',
    id: 'auto-break-v1',
    highlightElementIds: ['stop-break-btn'],
    es: {
      title: 'Break automático: cuenta TODO el tiempo sin transcripción',
      intro: 'v4.90.0 — El break ahora cuenta solo: 3s sin transcripción = break corre. Hold (frases del provider: "one moment", "please hold") lo pausa. Vuelve la voz → se banca solo. STOP BREAK = gracia de 10 min.',
      sections: [
        { heading: 'Reglas', bullets: [
          'Sin transcripción ≥3s → ☕ corre (en llamada y fuera de llamada)',
          'Hold del provider → ☕ pausado (eso es trabajo, no break)',
          'Silencio ≥5 min → reinicia el contador "trabajando sin break"',
          'STOP BREAK → 10 min sin auto-break (trabajo de escritorio)',
        ] },
      ],
    },
    en: {
      title: 'Auto break: counts ALL no-transcription time',
      intro: 'v4.90.0 — Break now counts itself: 3s with no transcription = break ticks. Hold (provider phrases: "one moment", "please hold") pauses it. Speech returns → banks itself. STOP BREAK = 10 min grace.',
      sections: [
        { heading: 'Rules', bullets: [
          'No transcription ≥3s → ☕ ticks (in-call and off-call)',
          'Provider hold → ☕ paused (that is work, not break)',
          'Silence ≥5 min → restarts the "working without break" clock',
          'STOP BREAK → 10 min auto-break suppression (desk work)',
        ] },
      ],
    },
  },
  {
    version: '4.89.2',
    id: 'hud-inspector-default-on-v1',
    highlightElementIds: ['hud-inspector-toggle'],
    es: {
      title: 'Inspector siempre activo',
      intro: 'v4.89.2 — El inspector ⌖ ahora viene PRENDIDO: pasá el mouse sobre lo que sea y ves nombre + selector, clic para copiar. Para apagarlo: ⌖ o Alt+I.',
      sections: [{ heading: 'Detalle', bullets: ['Sin fricción: nada que activar antes de reportar'] }],
    },
    en: {
      title: 'Inspector on by default',
      intro: 'v4.89.2 — The ⌖ inspector is now ON out of the box: hover anything for name + selector, click to copy. Turn off via ⌖ or Alt+I.',
      sections: [{ heading: 'Detail', bullets: ['Zero friction: nothing to enable before reporting'] }],
    },
  },
  {
    version: '4.89.1',
    id: 'hold-auto-resume-v1',
    highlightElementIds: ['study-cue-cards'],
    es: {
      title: 'Hold ya no te atrapa',
      intro: 'v4.89.1 — Clic fuera de la tarjeta de estudio = llamada resumida. Y si hablás (cualquiera de los dos), el hold se levanta solo. La tarjeta lo dice: 🔊.',
      sections: [{ heading: 'Reglas', bullets: ['Clic fuera / Enter / Escape → resume', 'Voz detectada (<2s silencio) → resume solo'] }],
    },
    en: {
      title: 'Hold no longer traps you',
      intro: 'v4.89.1 — Click outside the study card = call resumed. And any detected speech auto-lifts hold. The card says it: 🔊.',
      sections: [{ heading: 'Rules', bullets: ['Click outside / Enter / Escape → resume', 'Speech detected (<2s silence) → auto-resume'] }],
    },
  },
  {
    version: '4.89.0',
    id: 'hud-inspector-v1',
    highlightElementIds: ['hud-inspector-toggle'],
    es: {
      title: 'Inspector HUD',
      intro: 'v4.89.0 — Botón ⌖ abajo a la derecha (o Alt+I): pasá el mouse sobre CUALQUIER elemento, incluso divs contenedores, y ves su nombre + selector. Clic en el tooltip para copiarlo y pegarlo al reportar fallas.',
      sections: [{ heading: 'Uso', bullets: ['Funciona también durante la llamada', 'Tecla C copia el selector bajo el mouse'] }],
    },
    en: {
      title: 'HUD inspector',
      intro: 'v4.89.0 — ⌖ button bottom-right (or Alt+I): hover ANY element, even container divs, to see its name + selector. Click the tooltip to copy it for bug reports.',
      sections: [{ heading: 'Use', bullets: ['Works during calls too', 'Press C to copy the hovered selector'] }],
    },
  },
  {
    version: '4.88.4',
    id: 'dedupe-timers-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Menos repetición',
      intro: 'v4.88.4 — Se eliminaron duplicados: los tiempos 📞/📡 y $ aparecen una sola vez (fila pegada + franja de la barra de estado). El resumen del marcador ahora solo muestra % del mes.',
      sections: [{ heading: 'Limpieza', bullets: ['Centro inactivo vacío (el timer ámbar ya indica el estado)'] }],
    },
    en: {
      title: 'Less repetition',
      intro: 'v4.88.4 — Duplicates removed: 📞/📡 timers and $ now appear once (sticky row + status-bar strip). Scoreboard summary shows only monthly %.',
      sections: [{ heading: 'Cleanup', bullets: ['Idle center emptied (amber off-call timer already implies state)'] }],
    },
  },
  {
    version: '4.88.3',
    id: 'status-bar-targets-strip-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Barra de estado legible',
      intro: 'v4.88.3 — La barra de estado ahora muestra 3 pares actual/objetivo bien legibles: 💵 ganado/$objetivo · ⏱ hecho/objetivo · ☕ descanso tomado/máximo (para llegar a las 18h).',
      sections: [{ heading: 'Nuevo', bullets: [
        '☕ objetivo = descanso TOTAL posible hoy y aún cumplir el ritmo de $1200 a las 18h',
        'Pasá el mouse: piso 5500m y tiempo libre si terminás a las 23h',
      ] }],
    },
    en: {
      title: 'Readable status bar',
      intro: 'v4.88.3 — Status bar now shows 3 readable current/target pairs: 💵 earned/$target · ⏱ done/target · ☕ break taken/max (to still hit 18:00).',
      sections: [{ heading: 'New', bullets: [
        '☕ target = TOTAL break you can take today and still hit the $1200 pace by 18:00',
        'Hover: 5500m fallback floor and slack if you finish by 23:00',
      ] }],
    },
  },
  {
    version: '4.88.2',
    id: 'endgame-plan-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Plan de cierre del día',
      intro: 'v4.88.2 — Debajo de la celda ⏱️ del scoreboard: cuánto tiempo en llamada te falta HOY para el ritmo de $1200, y cuánto descanso te queda si terminas a las 18h o a las 23h.',
      sections: [{ heading: 'Nuevo', bullets: [
        '🏁 need XhYYm on call: lo que falta hoy para el ritmo de $1200/mes',
        'off≤18h / off≤23h: descanso posible si terminás a esa hora',
      ] }],
    },
    en: {
      title: 'Endgame plan',
      intro: 'v4.88.2 — Under the ⏱️ scoreboard cell: on-call time still needed today for the $1200 pace, and how much time off you can take finishing by 18:00 or 23:00.',
      sections: [{ heading: 'New', bullets: [
        '🏁 need XhYYm on call: what today still owes to the $1200/mo pace',
        'off≤18h / off≤23h: break time possible if you finish by that hour',
      ] }],
    },
  },
  {
    version: '4.88.1',
    id: 'daily-targets-chip-v1',
    highlightElementIds: ['daily-targets-chip'],
    es: {
      title: 'Meta diaria siempre visible',
      intro: 'v4.88.1 — La barra de estado muestra cuántos minutos y USD necesitas HOY para llegar a $1200/mes, y cuánto falta en el mes. Pasa el mouse para ver el piso de 5500m.',
      sections: [{ heading: 'Nuevo', bullets: [
        'Meta principal: $1200/mes (~9231m a $0.13/min)',
        'Fallo de respaldo: 5500m/mes (mantiene tu tarifa)',
      ] }],
    },
    en: {
      title: 'Daily targets always visible',
      intro: 'v4.88.1 — Status bar now shows the minutes and USD you need TODAY to hit $1200/mo, plus what is left this month. Hover for the 5500m fallback floor.',
      sections: [{ heading: 'New', bullets: [
        'Primary goal: $1200/mo (~9231m @ $0.13/min)',
        'Fallback floor: 5500m/mo (keeps your rate)',
      ] }],
    },
  },
  {
    version: '4.88.0',
    id: 'study-cue-cards-v1',
    highlightElementIds: ['study-cue-cards'],
    es: {
      title: 'Tarjetas de estudio',
      intro: 'v4.88.0 — Entre llamadas y en espera: tarjetas de glosario EN→ES, avisos NO-SAY, siglas y recordatorios de calidad. Elige el dominio (chips) antes del turno.',
      sections: [{ heading: 'Nuevo', bullets: [
        'Rotación automática cada 10s; toca la tarjeta para revelar la respuesta',
        'Dominios: auto, seguros, educación, servicios, finanzas, social, médico',
        'Ajustes → Pantalla para ocultar las tarjetas',
      ] }],
    },
    en: {
      title: 'Study cue cards',
      intro: 'v4.88.0 — Between calls and on hold: EN→ES glossary cards, NO-SAY warnings, acronyms, and QA reminders. Pick a domain (chips) before your shift.',
      sections: [{ heading: 'New', bullets: [
        'Auto-rotates every 10s; tap the card to reveal the answer',
        'Domains: auto, insurance, education, utilities, financial, social, medical',
        'Settings → Display to hide the cards',
      ] }],
    },
  },
  {
    version: '4.87.5',
    id: 'call-log-import-authoritative-v1',
    highlightElementIds: ['settings-data-import'],
    es: {
      title: 'Importar call log ahora corrige',
      intro: 'v4.87.5 — Pegar el historial (una campo por línea o filas) ahora sobreescribe los minutos de HOY (arriba o abajo) y repinta la barra de progreso.',
      sections: [{ heading: 'Arreglado', bullets: [
        'Importar es autoritativo: corrige sobre- y sub-contos',
        'HOY también entra al timeline/heatmap',
      ] }],
    },
    en: {
      title: 'Call-log import now corrects',
      intro: 'v4.87.5 — Pasting call history (one field per line or rows) now overwrites TODAY\'s minutes (up or down) and repaints the progress bar.',
      sections: [{ heading: 'Fixed', bullets: [
        'Import is authoritative: fixes over- and under-counts',
        'TODAY also lands in the timeline/heatmap',
      ] }],
    },
  },
  {
    version: '4.87.3',
    id: 'interpreter-cue-highlight-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Mensajes al intérprete en celeste',
      intro: 'v4.87.3 — Si un mensaje empieza con "Intérprete," la burbuja se pinta celeste (borde, fondo y texto) para que no lo leas como si fuera del paciente.',
      sections: [{ heading: 'Nuevo', bullets: [
        'Detecta "Interpreter," / "Intérprete," (EN/ES) al inicio del mensaje',
        'Celeste gana sobre el color de idioma y sobre las alertas de longitud',
      ] }],
    },
    en: {
      title: 'Interpreter-addressed messages in light blue',
      intro: 'v4.87.3 — Messages starting with "Interpreter," now render light blue (border, background and text) so you never read them as patient speech.',
      sections: [{ heading: 'New', bullets: [
        'Detects "Interpreter," / "Intérprete," (EN/ES) at the start of a message',
        'Light blue wins over language color and length warnings',
      ] }],
    },
  },
  {
    version: '4.87.2',
    id: 'speech-autostart-stale-closure-v1',
    highlightElementIds: ['header-calldetect-btn'],
    es: {
      title: 'Auto-inicio por voz: reloj de llamada arreglado',
      intro: 'v4.87.2 — Cuando la llamada arrancaba sola por voz (audio adjunto sin llamada), cada transcripción reiniciaba el cronómetro a 0. Ahora el estado EN llamada se mantiene y el tiempo acumula.',
      sections: [{ heading: 'Fix', bullets: [
        'Auto-start por voz ya no se dispara repetidamente dentro de la llamada',
        'Timer de llamada, timeline y sonidos estables tras el auto-start',
      ] }],
    },
    en: {
      title: 'Speech auto-start: call timer fixed',
      intro: 'v4.87.2 — When a call auto-started from speech (audio attached, no call yet), every transcript reset the call timer to 0. ON-call state now sticks and time accumulates.',
      sections: [{ heading: 'Fix', bullets: [
        'Speech auto-start no longer re-fires repeatedly during the call',
        'Call timer, timeline and sounds stable after auto-start',
      ] }],
    },
  },
  {
    version: '4.87.1',
    id: 'handbook-scripts-vb-pick-v1',
    highlightElementIds: ['workspace-soundboard-pane', 'audio-route-sink-select'],
    es: {
      title: 'Scripts del manual + salida VB elegible',
      intro: 'Soundboard Studio trae los scripts verbales del manual pre-cargados para grabar. El selector 🔊 muestra nombres reales y tu elección se mantiene.',
      sections: [{ heading: 'Nuevo', bullets: [
        'Studio: 14 scripts del manual (apertura, repetición, ghost, cierre…) listos para grabar',
        '🔊 VB out: nombres recordados + la elección manual ya no se auto-cambia',
        'Datos → importación de planilla del cliente para el scoreboard',
      ] }],
    },
    en: {
      title: 'Handbook scripts + selectable VB out',
      intro: 'Soundboard Studio ships the handbook verbatim scripts preloaded for recording. The 🔊 picker shows real names and your pick sticks.',
      sections: [{ heading: 'New', bullets: [
        'Studio: 14 handbook scripts (openers, repeat, ghost, closing…) ready to record',
        '🔊 VB out: remembered names + hand pick never auto-overridden',
        'Data → client call-log paste import for the scoreboard',
      ] }],
    },
  },
  {
    version: '4.87.0',
    id: 'income-bar-month-target-v1',
    highlightElementIds: ['header-daily-income', 'metric-m7'],
    es: {
      title: 'Ganancia del día + meta mensual editable',
      intro: 'Número naranja grande con lo ganado hoy junto a 📞/📡. La meta mensual (5500m) ahora visible y editable en la celda $ MES. Sonido: ruta por defecto vuelve a passthrough (v4.86.2 la cambió y garbleaba).',
      sections: [{ heading: 'Nuevo', bullets: [
        'Barra de estado: $ ganado hoy (naranja) + 📞 total en llamada + 📡 total fuera',
        'Scoreboard celda 7: minutos del mes / meta — click en ✎ para editar',
      ] }],
    },
    en: {
      title: 'Daily income + editable month target',
      intro: 'Big orange $ earned-today next to 📞/📡 in the status bar. Month target minutes (5500m) now visible and editable in the $ MONTH cell. Soundboard default route back to passthrough (v4.86.2 switch was garbling).',
      sections: [{ heading: 'New', bullets: [
        'Status bar: $ earned today (orange) + 📞 total on-call + 📡 total off-call',
        'Scoreboard cell 7: month minutes / target — click ✎ to edit',
      ] }],
    },
  },
  {
    version: '4.86.6',
    id: 'center-timers-seed-v1',
    highlightElementIds: ['header-oncall-timers-center'],
    es: {
      title: 'Timers al centro',
      intro: 'El centro muestra 📞/📡 en vez de Disconnected; historial de hoy precargado en local.',
      sections: [{ heading: 'Hoy', bullets: ['15 llamadas = 172m sembradas (solo localhost)'] }],
    },
    en: {
      title: 'Timers in the center',
      intro: 'Center shows 📞/📡 instead of Disconnected; today\u2019s call history preloaded locally.',
      sections: [{ heading: 'Today', bullets: ['15 calls = 172m seeded (localhost only)'] }],
    },
  },
  {
    version: '4.86.5',
    id: 'scoreboard-grab-bar-v1',
    highlightElementIds: ['header-oncall-timers'],
    es: {
      title: 'Scoreboard a tu medida',
      intro: 'Arrastra la barra inferior del scoreboard para cambiar su altura; se recuerda.',
      sections: [{ heading: 'Tambien', bullets: ['Timers 📞/📡 junto al boton Connect', 'Tooltips inteligentes en la franja'] }],
    },
    en: {
      title: 'Scoreboard your size',
      intro: 'Drag the bottom bar of the scoreboard to resize it; the height is remembered.',
      sections: [{ heading: 'Also', bullets: ['📞/📡 timers next to the Connect button', 'Smart tooltips on the strip'] }],
    },
  },
  {
    version: '4.86.4',
    id: 'strip-declutter-v1',
    highlightElementIds: ['header-metrics-expand-btn'],
    es: {
      title: 'Franja sin duplicados',
      intro: 'Con el HUD grande, la franja muestra solo progreso del dia y timers.',
      sections: [{ heading: 'Notas', bullets: ['Boton Metrics oculto donde ya no hacia nada'] }],
    },
    en: {
      title: 'Strip without duplicates',
      intro: 'With the big HUD, the strip shows only day progress and timers.',
      sections: [{ heading: 'Notes', bullets: ['Metrics button hidden where it did nothing'] }],
    },
  },
  {
    version: '4.86.3',
    id: 'oncall-timers-v1',
    highlightElementIds: ['header-metrics-expand-btn'],
    es: {
      title: 'Timers on/off-call visibles',
      intro: 'La franja muestra 📞 minutos en llamada y 📡 fuera de llamada de hoy.',
      sections: [{ heading: 'Tambien', bullets: ['Boton Connect ahora 2x de ancho para su doble emoji'] }],
    },
    en: {
      title: 'On/off-call timers visible',
      intro: 'The strip shows today\u2019s 📞 on-call and 📡 off-call minutes at a glance.',
      sections: [{ heading: 'Also', bullets: ['Connect button now 2x wide for its two emojis'] }],
    },
  },
  {
    version: '4.86.2',
    id: 'scoreboard-fit-fix-v1',
    highlightElementIds: ['header-metrics-expand-btn'],
    es: {
      title: 'Cuadricula 12 completa',
      intro: 'La cuadricula de 12 metricas ya no se corta: mas alto, celdas compactas.',
      sections: [{ heading: 'Ajustes', bullets: ['Panel expandido hasta 38vh/260px', 'Celdas y fuente mas compactas'] }],
    },
    en: {
      title: 'Full 12-cell grid',
      intro: 'The 12-metric grid no longer clips: taller panel, compact cells.',
      sections: [{ heading: 'Changes', bullets: ['Expanded panel up to 38vh/260px', 'Tighter cells and font'] }],
    },
  },
  {
    version: '4.86.1',
    id: 'local-translate-gateway-v1',
    highlightElementIds: ['header-settings-btn'],
    es: {
      title: 'Traduccion en desarrollo local',
      intro: 'npm run gateway levanta el gateway de traduccion local; npm start lo usa automaticamente.',
      sections: [{ heading: 'Uso', bullets: ['Terminal 1: npm run gateway', 'Terminal 2: npm start (reiniciar)'] }],
    },
    en: {
      title: 'Local dev translation',
      intro: 'npm run gateway starts the local translation gateway; npm start uses it automatically.',
      sections: [{ heading: 'Usage', bullets: ['Terminal 1: npm run gateway', 'Terminal 2: npm start (restart)'] }],
    },
  },
  {
    version: '4.86.0',
    id: 'scoreboard-single-toggle-v1',
    highlightElementIds: ['header-metrics-expand-btn'],
    es: {
      title: 'Scoreboard sin duplicados',
      intro: 'Fuera de llamada, Metrics abre el panel de score sin repetir barras ni botones.',
      sections: [{ heading: 'Cambios', bullets: ['Barras y fila rapida solo donde no estan duplicadas', 'Regla 20/80 pasa a guia: el scoreboard puede crecer fuera de llamada'] }],
    },
    en: {
      title: 'Scoreboard without duplicates',
      intro: 'Off-call, Metrics opens the score panel without repeating bars or buttons.',
      sections: [{ heading: 'Changes', bullets: ['Bars and quick row only where not duplicated', '20/80 rule is now a guideline: scoreboard may grow off-call'] }],
    },
  },
  {
    version: '4.85.17',
    id: 'deepgram-locked-key-recovery-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Recuperar llave Deepgram',
      intro: 'Si la llave guardada esta bloqueada, Connect abre Unlock directamente.',
      sections: [{ heading: 'En llamada', bullets: ['Presione Unlock. Si la contraseña ya esta escrita, un clic restaura transcripcion.'] }],
    },
    en: {
      title: 'Recover Deepgram key',
      intro: 'If the saved key is locked, Connect opens Unlock directly.',
      sections: [{ heading: 'In a call', bullets: ['Press Unlock. If the password is already entered, one click restores transcription.'] }],
    },
  },
  {
    version: '4.85.16',
    id: 'deepgram-console-outage-logs-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Logs de Deepgram',
      intro: 'La consola ahora muestra inicio, sockets y errores de Deepgram.',
      sections: [{ heading: 'Outage', bullets: ['Abra DevTools Console y filtre por Deepgram.'] }],
    },
    en: {
      title: 'Deepgram logs',
      intro: 'Console now shows Deepgram startup, sockets, and errors.',
      sections: [{ heading: 'Outage', bullets: ['Open DevTools Console and filter by Deepgram.'] }],
    },
  },
  {
    version: '4.85.15',
    id: 'ghost-call-close-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Cierre de llamada olvidada',
      intro: 'Tras 7 minutos sin habla y tres avisos, la llamada se cierra sola.',
      sections: [{ heading: 'Seguro', bullets: ['En espera no se cierra. Se detienen el contador y Deepgram.'] }],
    },
    en: {
      title: 'Forgotten-call close',
      intro: 'After 7 minutes without speech and three warnings, the call closes itself.',
      sections: [{ heading: 'Safe', bullets: ['Holds are excluded. Both the timer and Deepgram stop.'] }],
    },
  },
  {
    version: '4.85.14',
    id: 'quiet-local-translation-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'TraducciÃ³n local',
      intro: 'La traducciÃ³n usa primero el servicio local, una frase por vez.',
      sections: [{ heading: 'Sin ruido', bullets: ['No mÃ¡s errores Azure 401 ni Google CORS en el navegador.'] }],
    },
    en: {
      title: 'Local translation',
      intro: 'Translation uses the local service first, one mouthful at a time.',
      sections: [{ heading: 'Quiet', bullets: ['No more Azure 401 or Google CORS browser errors.'] }],
    },
  },
  {
    version: '4.85.13',
    id: 'vb-auto-route-v1',
    highlightElementIds: ['audio-route-active-vb-btn'],
    es: {
      title: 'VB para trabajar',
      intro: 'VB encuentra CABLE Output automáticamente y no usa el micrófono físico.',
      sections: [{ heading: 'Uso', bullets: ['Dejá el call tab en CABLE Input y tocá VB. Sin picker de pestaña.'] }],
    },
    en: {
      title: 'VB work route',
      intro: 'VB finds CABLE Output automatically and never uses the physical mic.',
      sections: [{ heading: 'Use', bullets: ['Keep the call tab on CABLE Input and press VB. No tab picker.'] }],
    },
  },
  {
    version: '4.85.12',
    id: 'translation-browser-safety-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Traducción sin ruido',
      intro: 'El navegador ya no prueba claves pagas ni Google directamente.',
      sections: [{ heading: 'Ruta', bullets: ['Gateway seguro → un respaldo gratuito. Sin 401 ni bloqueos CORS del navegador.'] }],
    },
    en: {
      title: 'Quiet translation',
      intro: 'The browser no longer probes paid keys or Google directly.',
      sections: [{ heading: 'Route', bullets: ['Secure gateway → one free fallback. No browser 401s or Google CORS blocks.'] }],
    },
  },
  {
    version: '4.85.11',
    id: 'translation-request-guard-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Traducción tranquila',
      intro: 'La app espera una frase corta y envía una traducción por vez.',
      sections: [{ heading: 'Protección', bullets: ['Mínimo 2 palabras · actualizaciones live cada 10 palabras nuevas · sin ráfagas.'] }],
    },
    en: {
      title: 'Calm translation',
      intro: 'The app waits for a short phrase and sends one translation at a time.',
      sections: [{ heading: 'Guard', bullets: ['At least 2 words · live updates every 10 new words · no bursts.'] }],
    },
  },
  {
    version: '4.85.10',
    id: 'simple-translation-fallback-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Traducción simple lista',
      intro: 'La traducción ahora tiene una ruta corta y segura de respaldo.',
      sections: [{ heading: 'Orden', bullets: ['Gateway seguro → Google → MyMemory. Si una ruta falla, prueba la siguiente.'] }],
    },
    en: {
      title: 'Simple translation ready',
      intro: 'Translation now has a short, safe fallback route.',
      sections: [{ heading: 'Order', bullets: ['Secure gateway → Google → MyMemory. If one route fails, it tries the next.'] }],
    },
  },
  {
    version: '4.85.9',
    id: 'cat-status-beacon-v1',
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Gato de estado',
      intro: 'El gato del encabezado ahora muestra el estado de la app.',
      sections: [{ heading: 'Colores', bullets: ['Verde: STT live · azul: conectando · naranja: revisar · rojo: error · gris: listo.'] }],
    },
    en: {
      title: 'Status cat',
      intro: 'The header cat now shows the app state.',
      sections: [{ heading: 'Colors', bullets: ['Green: STT live · blue: connecting · amber: check · red: error · gray: ready.'] }],
    },
  },
  {
    version: '4.85.8',
    id: 'tab-vb-active-switcher-v1',
    highlightElementIds: ['audio-route-active-tab-btn', 'audio-route-active-vb-btn'],
    es: {
      title: 'Fuente STT de llamada',
      intro: 'La fila fija muestra TAB y VB; Mic no puede tomar una llamada.',
      sections: [{ heading: 'Cambio seguro', bullets: ['El nuevo audio se obtiene antes de soltar el actual. Si falla, el texto sigue.'] }],
    },
    en: {
      title: 'Live-call STT source',
      intro: 'The fixed row shows TAB and VB; Mic cannot take a work call.',
      sections: [{ heading: 'Safe switch', bullets: ['New audio is acquired before releasing the current stream. On failure, captions continue.'] }],
    },
  },
  {
    version: '4.85.7',
    id: 'tab-only-call-start-v1',
    highlightElementIds: ['audio-route-force-tab-btn'],
    es: {
      title: 'Llamadas por pestaña',
      intro: 'Una prueba de micrófono anterior ya no puede tomar la siguiente llamada.',
      sections: [{ heading: 'Salida rápida', bullets: ['Si Mic aparece durante una llamada, pulse USE TAB'] }],
    },
    en: {
      title: 'Tab-only call start',
      intro: 'A previous microphone test can no longer take over the next call.',
      sections: [{ heading: 'Quick exit', bullets: ['If Mic appears during a call, press USE TAB'] }],
    },
  },
  {
    version: '4.85.6',
    id: 'scoreboard-grid-budget-v1',
    highlightElementIds: ['header-metrics-expand-btn', 'header-app-logo-btn'],
    es: {
      title: 'Cuadrícula sin takeover',
      intro: 'Metrics abre directamente las 12 métricas dentro de un panel acotado.',
      sections: [{ heading: 'Verificación', bullets: ['Pase el mouse por el ícono de CatIntAssist para ver la versión'] }],
    },
    en: {
      title: 'Grid without takeover',
      intro: 'Metrics opens directly on the 12 metrics inside a capped panel.',
      sections: [{ heading: 'Verification', bullets: ['Hover the CatIntAssist icon to see the version'] }],
    },
  },
  {
    version: '4.85.5',
    id: 'scoreboard-small-screen-restore-v1',
    highlightElementIds: ['header-metrics-expand-btn'],
    es: {
      title: 'Scoreboard restaurado',
      intro: 'En pantallas chicas vuelve el botón Metrics para abrir las 12 métricas y las 3 barras.',
      sections: [{ heading: 'Uso', bullets: ['Fuera de llamada: Metrics abre la cuadrícula y las barras'] }],
    },
    en: {
      title: 'Scoreboard restored',
      intro: 'On small screens, Metrics again opens all 12 metrics and the three progress bars.',
      sections: [{ heading: 'Use', bullets: ['Off-call: Metrics opens the grid and bars'] }],
    },
  },
  {
    version: '4.85.4',
    id: 'compact-hud-clarity-v1',
    highlightElementIds: ['compact-call-goal-meter'],
    es: {
      title: 'HUD de llamada claro',
      intro: 'En llamada, la barra muestra solo prueba de Tab, Deepgram y ON/OFF/LEFT.',
      sections: [{ heading: 'Sin ruido', bullets: ['Los controles de dispositivos quedan fuera de la vista de llamada', 'Los tiempos no muestran decimales'] }],
    },
    en: {
      title: 'Clear call HUD',
      intro: 'During a call, the bar shows only Tab proof, Deepgram, and ON/OFF/LEFT.',
      sections: [{ heading: 'No clutter', bullets: ['Device setup stays out of the call view', 'Timers never show decimals'] }],
    },
  },
  {
    version: '4.85.3',
    id: 'disconnected-shift-totals-v1',
    highlightElementIds: ['audio-route-day-totals'],
    es: {
      title: 'Totales de turno',
      intro: 'Con Deepgram desconectado ver\u00e1s ON (en llamada) y OFF (disponible + descanso) del d\u00eda.',
      sections: [{ heading: 'Cuota', bullets: ['Deepgram se cierra entre llamadas; Tab queda listo'] }],
    },
    en: {
      title: 'Shift totals',
      intro: 'With Deepgram disconnected, see today ON (calls) and OFF (available + break) time.',
      sections: [{ heading: 'Quota', bullets: ['Deepgram closes between calls; Tab stays ready'] }],
    },
  },
  {
    version: '4.85.2',
    id: 'stop-keeps-tab-ready-v1',
    highlightElementIds: ['header-stop-btn'],
    es: {
      title: 'Tab listo entre llamadas',
      intro: 'STOP cierra Deepgram, pero conserva la pesta\u00f1a elegida. CONNECT la reutiliza sin pedirla otra vez.',
      sections: [{ heading: 'Suelta Tab solo cuando', bullets: ['Cambias fuente o detienes el uso compartido en el navegador'] }],
    },
    en: {
      title: 'Tab stays ready between calls',
      intro: 'STOP closes Deepgram but preserves the selected tab. CONNECT reuses it without asking again.',
      sections: [{ heading: 'Tab releases only when', bullets: ['You switch source or stop browser sharing'] }],
    },
  },
  {
    version: '4.85.1',
    id: 'always-visible-workday-line-v1',
    highlightElementIds: ['compact-call-goal-meter'],
    es: {
      title: 'L\u00ednea de jornada',
      intro: 'Siempre visible: azul = llamada, naranja = disponible, rojo = descanso; tambi\u00e9n ON, OFF y tiempo restante.',
      sections: [{ heading: 'De un vistazo', bullets: ['La l\u00ednea blanca marca la hora actual'] }],
    },
    en: {
      title: 'Workday line',
      intro: 'Always visible: blue = call, orange = available, red = break; with ON, OFF, and time left.',
      sections: [{ heading: 'At a glance', bullets: ['The white line marks the current time'] }],
    },
  },
  {
    version: '4.85.0',
    id: 'translation-outage-gateway-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Respaldo de traducci\\u00f3n',
      intro: 'La app usa una puerta privada: Azure, DeepL, Google y Amazon antes de los respaldos de navegador.',
      sections: [{ heading: 'Seguro', bullets: ['Las nuevas claves y el texto pasan por la puerta privada'] }],
    },
    en: {
      title: 'Translation backup',
      intro: 'The app uses a private gateway: Azure, DeepL, Google, and Amazon before browser fallbacks.',
      sections: [{ heading: 'Safe', bullets: ['New keys and call text use the private gateway'] }],
    },
  },
  {
    version: '4.84.49',
    id: 'live-translation-every-ten-words-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Traducci\\u00f3n en vivo',
      intro: 'Mientras hablan, la traducci\\u00f3n sale cada 10 palabras nuevas; no espera siempre al final.',
      sections: [{ heading: 'Seguro', bullets: ['Un eco del idioma fuente nunca cuenta como traducci\\u00f3n'] }],
    },
    en: {
      title: 'Live translation',
      intro: 'While they speak, translation runs every 10 new words instead of always waiting for the end.',
      sections: [{ heading: 'Safe', bullets: ['A source-language echo never counts as a translation'] }],
    },
  },
  {
    version: '4.84.48',
    id: 'reject-cached-translation-echo-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Sin eco guardado',
      intro: 'Un texto en ingl\\u00e9s guardado por error ya no puede mostrarse como traducci\\u00f3n al espa\\u00f1ol.',
      sections: [{ heading: 'Protecci\\u00f3n', bullets: ['Los ecos viejos se descartan y se vuelve a traducir'] }],
    },
    en: {
      title: 'No cached echo',
      intro: 'An old English echo can no longer appear as a Spanish translation.',
      sections: [{ heading: 'Protection', bullets: ['Old echoes are discarded and translation retries'] }],
    },
  },
  {
    version: '4.84.47',
    id: 'hide-source-translation-fallback-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Sin texto duplicado',
      intro: 'Si falla la traducci\\u00f3n, no repetimos el idioma fuente. El carril central queda ambar durante el reintento.',
      sections: [{ heading: 'Lectura', bullets: ['La segunda columna solo muestra traducci\\u00f3n real'] }],
    },
    en: {
      title: 'No duplicate source text',
      intro: 'If translation fails, the source language is not repeated. The center rail turns amber while retrying.',
      sections: [{ heading: 'Reading', bullets: ['The second column only shows a real translation'] }],
    },
  },
  {
    version: '4.84.46',
    id: 'small-screen-call-chrome-v1',
    highlightElementIds: ['compact-call-goal-meter', 'audio-route-tab-proof'],
    es: {
      title: 'Llamada compacta',
      intro: 'La ruta STT queda visible. Azul = llamadas cerradas; naranja = llamada actual. Saludos van abajo.',
      sections: [{ heading: 'Pantalla chica', bullets: ['Sin filas que tapen la transcripci\\u00f3n'] }],
    },
    en: {
      title: 'Compact call view',
      intro: 'The STT route stays visible. Blue = banked calls; orange = current call. Greetings move to the bottom.',
      sections: [{ heading: 'Small screen', bullets: ['No rows cover the transcript'] }],
    },
  },
  {
    version: '4.84.45',
    id: 'release-notes-utf8-fix-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Texto en espa\\u00f1ol correcto',
      intro: 'Las notas ahora usan caracteres seguros: traducci\\u00f3n, se\\u00f1al y revisi\\u00f3n se ven correctamente.',
      sections: [{ heading: 'Listo', bullets: ['Sin caracteres rotos ni texto mojibake'] }],
    },
    en: {
      title: 'Correct Spanish text',
      intro: 'Release notes now use safe characters, so Spanish renders correctly.',
      sections: [{ heading: 'Done', bullets: ['No broken or mojibake characters'] }],
    },
  },
  {
    version: '4.84.44',
    id: 'translation-source-fallback-label-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'TraducciÃ³n honesta',
      intro: 'Si un motor falla, la segunda columna dice SOURCE Â· RETRYING. Nunca parece una traducciÃ³n real.',
      sections: [{ heading: 'Chequeo', bullets: ['Texto sin etiqueta = traducciÃ³n; SOURCE = reintento activo'] }],
    },
    en: {
      title: 'Truthful translation state',
      intro: 'If an engine fails, the second column says SOURCE Â· RETRYING. It never looks like a real translation.',
      sections: [{ heading: 'Check', bullets: ['No label = translation; SOURCE = active retry'] }],
    },
  },
  {
    version: '4.84.43',
    id: 'live-text-soft-cues-v1',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Texto vivo mÃ¡s claro',
      intro: 'Las palabras nuevas y corregidas entran con una seÃ±al suave. Lo que ya leÃ­ste no se mueve ni desaparece.',
      sections: [{ heading: 'Lectura', bullets: ['Transiciones cortas, sin rebote ni destello repetido'] }],
    },
    en: {
      title: 'Clearer live text',
      intro: 'New and corrected words get a soft cue. Text you already read does not move or disappear.',
      sections: [{ heading: 'Reading', bullets: ['Short transitions, with no bounce or repeated flash'] }],
    },
  },
  {
    version: '4.84.42',
    id: 'tab-proof-chip-v1',
    highlightElementIds: ['audio-route-tab-proof', 'audio-route-tab-mode-btn'],
    es: {
      title: 'Prueba de Tab',
      intro: 'Un chip confirma cada paso: elegir pestaña, conexión a Deepgram y texto en vivo.',
      sections: [{ heading: 'Bueno', bullets: ['TAB ✓ · TEXT ✓ = está funcionando'] }],
    },
    en: {
      title: 'Tab proof',
      intro: 'One chip confirms each step: pick tab, Deepgram connection, and live text.',
      sections: [{ heading: 'Good', bullets: ['TAB ✓ · TEXT ✓ = working'] }],
    },
  },
  {
    version: '4.84.41',
    id: 'work-safe-silence-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Silencio de trabajo',
      intro: 'Apagamos todos los efectos sintéticos. Audio de llamada, TTS y saludos siguen igual.',
      sections: [{ heading: 'Seguro', bullets: ['No monedas, pings ni alertas automáticas'] }],
    },
    en: {
      title: 'Work-safe silence',
      intro: 'All synthetic effects are off. Call audio, TTS, and greetings are unchanged.',
      sections: [{ heading: 'Safe', bullets: ['No automatic coins, pings, or alerts'] }],
    },
  },
  {
    version: '4.84.40',
    id: 'always-visible-stt-route-v1',
    highlightElementIds: ['audio-route-tab-mode-btn', 'audio-route-stt-in-badge', 'audio-route-stt-summary'],
    es: {
      title: 'Ruta STT siempre visible',
      intro: 'En llamada, la barra I/O queda arriba: Tab/Cable/Mic, entrada STT y estado Deepgram.',
      sections: [{ heading: 'Chequeo', bullets: ['🔖✓ + Tab STT + DG EN·ES = audio de pestaña conectado'] }],
    },
    en: {
      title: 'STT route always visible',
      intro: 'During a call, the I/O strip stays at the top: Tab/Cable/Mic, STT input, and Deepgram state.',
      sections: [{ heading: 'Check', bullets: ['🔖✓ + Tab STT + DG EN·ES = tab audio connected'] }],
    },
  },
  {
    version: '4.84.39',
    id: 'tab-stt-fail-closed-v1',
    highlightElementIds: ['audio-route-tab-mode-btn', 'header-connect-btn'],
    es: {
      title: 'Tab primero',
      intro: 'Si la pestaña no comparte audio, CatIntAssist muestra error. Nunca cambia solo al micrófono físico.',
      sections: [{ heading: 'Llamadas', bullets: ['🔖 Tab → CONNECT → pestaña de llamada → Compartir audio'] }],
    },
    en: {
      title: 'Tab first',
      intro: 'If a tab is not sharing audio, CatIntAssist shows an error. It never switches itself to the physical mic.',
      sections: [{ heading: 'Calls', bullets: ['🔖 Tab → CONNECT → call tab → Share audio'] }],
    },
  },
  {
    version: '4.84.38',
    id: 'stop-rapid-celebration-audio-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Audio sin loop',
      intro: 'Quitamos el sonido de monedas que se repetía varias veces por segundo.',
      sections: [{ heading: 'Ahora', bullets: ['Los sonidos solo salen por eventos o una vez por minuto'] }],
    },
    en: {
      title: 'No rapid audio loop',
      intro: 'Removed the coin sound that repeated several times per second.',
      sections: [{ heading: 'Now', bullets: ['Sounds only play on events or once per minute'] }],
    },
  },
  {
    version: '4.84.37',
    id: 'tab-stt-route-recovery-v1',
    highlightElementIds: ['audio-route-tab-mode-btn', 'header-connect-btn'],
    es: {
      title: 'Tab STT corregido',
      intro: 'Elegir Marcador apaga Mic STT antes de CONNECT.',
      sections: [{ heading: 'Outage', bullets: ['Marcador (🔖) → CONNECT → pestaña de llamada', 'Marcá Compartir audio en Chrome'] }],
    },
    en: {
      title: 'Tab STT fixed',
      intro: 'Selecting Tab turns off Mic STT before CONNECT.',
      sections: [{ heading: 'Outage', bullets: ['Tab (🔖) → CONNECT → call tab', 'Check Share audio in Chrome'] }],
    },
  },
  {
    version: '4.84.34',
    id: 'mobile-mic-connect-v1',
    highlightElementIds: ['header-connect-btn', 'audio-route-mic-mode-btn'],
    es: {
      title: 'Mic en celular',
      intro: 'CONNECT en el teléfono pide el micrófono de inmediato (ya no se pierde el gesto).',
      sections: [
        {
          heading: 'Qué cambió',
          bullets: [
            'Un toque al botón verde → prompt de mic al toque',
            'Modo 🎤 gana sobre VB-Cable guardado',
            'Si el mic guardado falla, usa el mic por defecto',
          ],
        },
      ],
    },
    en: {
      title: 'Mobile mic connect',
      intro: 'CONNECT on phone requests the mic immediately (user gesture no longer lost).',
      sections: [
        {
          heading: 'What changed',
          bullets: [
            'One tap green → mic prompt right away',
            '🎤 mic mode wins over saved VB-Cable',
            'Stale mic deviceId falls back to default mic',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.33',
    id: 'greeting-preflight-v1',
    highlightElementIds: ['sb-preflight-check'],
    es: {
      title: 'Checklist de saludos',
      intro: 'Off-call: 3 pasos claros — calidad, tú escuchas, caller escucha.',
      sections: [
        {
          heading: 'Flujo',
          bullets: [
            '1 Check · 2 Hear · 3 Send + CALL OK',
            'Tiles = altavoces hasta terminar checklist',
            'Beep cable = prueba VB sin clip',
          ],
        },
      ],
    },
    en: {
      title: 'Greeting preflight checklist',
      intro: 'Off-call: one 3-step panel — quality, you hear it, caller hears it.',
      sections: [
        {
          heading: 'Flow',
          bullets: [
            '1 Check · 2 Hear · 3 Send + CALL OK',
            'Tiles = speakers until checklist done',
            'Beep cable = test VB path without a clip',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.30',
    id: 'app-confirm-dialogs-v1',
    highlightElementIds: ['quick-notes-textarea'],
    es: {
      title: 'Confirmaciones en la app',
      intro: 'Borrar notas y limpiar el log ya no usan el popup feo del navegador.',
      sections: [
        {
          heading: 'Dónde',
          bullets: [
            'Notas: 🗑️ → diálogo en la app',
            'Transcripción: Clear log → diálogo en la app',
          ],
        },
      ],
    },
    en: {
      title: 'In-app confirm dialogs',
      intro: 'Clear notes and clear log no longer use the ugly browser popup.',
      sections: [
        {
          heading: 'Where',
          bullets: [
            'Notes: 🗑️ → in-app dialog',
            'Transcript: Clear log → in-app dialog',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.28',
    id: 'stt-medical-filler-fix-v1',
    highlightElementIds: ['audio-route-stt-summary', 'audio-route-zap-btn'],
    es: {
      title: 'STT arreglado — modelo medical roto',
      intro:
        'El socket EN usaba nova-3-medical con filler_words. Deepgram solo permite fillers en modelos general → EN muerto/basura. Ahora ambas pistas: nova-3-general.',
      sections: [
        {
          heading: 'Qué hacer',
          bullets: [
            'Recargá y mirá v4.84.28 arriba a la derecha',
            'Entre llamadas: desconectar/conectar STT (o Zap)',
          ],
        },
      ],
    },
    en: {
      title: 'STT fixed — medical model broke EN',
      intro:
        'EN socket used nova-3-medical with filler_words. Deepgram only allows fillers on general models → EN dead/garbage. Both lanes now nova-3-general.',
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Reload and confirm v4.84.28 top-right',
            'Between calls: disconnect/reconnect STT (or Zap)',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.27',
    id: 'vb-route-hear-myself-v1',
    highlightElementIds: [
      'audio-route-sink-select',
      'audio-route-fix-sink-btn',
      'sb-test-mode-toggle',
    ],
    es: {
      title: 'VB-Cable: por qué no te oís',
      intro:
        'Si Windows “Escuchar este dispositivo” está en el cable pero VB out = parlantes, el saludo nunca entra al cable → silencio. VB out debe ser CABLE Input.',
      sections: [
        {
          heading: 'Receta',
          bullets: [
            '📥 STT in = CABLE Output · 🎤 mic real · 🔊 VB out = CABLE Input',
            'Chip ⚠ + Fix → CABLE In si VB out está mal',
            'Para oírte ya: 🧪 Test + 🔊 You (Local)',
          ],
        },
      ],
    },
    en: {
      title: 'VB-Cable: why you can’t hear greetings',
      intro:
        'Windows “Listen to this device” on the cable hears nothing if VB out = speakers — greetings never enter the cable. VB out must be CABLE Input.',
      sections: [
        {
          heading: 'Recipe',
          bullets: [
            '📥 STT in = CABLE Output · 🎤 real mic · 🔊 VB out = CABLE Input',
            '⚠ chip + Fix → CABLE In when VB out is wrong',
            'Hear yourself now: 🧪 Test + 🔊 You (Local)',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.25',
    id: 'soundboard-gallery-v1',
    highlightElementIds: ['audio-route-soundboard-btn', 'workspace-soundboard-pane'],
    es: {
      title: 'Soundboard galería + LIVE',
      intro:
        'Las miniaturas son la galería. Etiquetas al hover (o toggle Labels). En llamada: thumbs chicos + tamaño. Banner ▶ LIVE cuando el paciente escucha.',
      sections: [
        {
          heading: 'Qué ver',
          bullets: [
            'Studio: slider Size + Labels; banner LIVE / local con barra de progreso.',
            'En llamada: expandí Greetings → thumbs; slider de tamaño; ▶ LIVE en el toggle.',
          ],
        },
      ],
    },
    en: {
      title: 'Soundboard gallery + LIVE',
      intro:
        'Thumbnails are the gallery. Labels on hover (or Labels toggle). On-call: small thumbs + size. ▶ LIVE banner while patient hears the clip.',
      sections: [
        {
          heading: 'What to look for',
          bullets: [
            'Studio: Size slider + Labels; LIVE/local banner with progress.',
            'On-call: expand Greetings → thumbs; size slider; ▶ LIVE on the toggle.',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.24',
    id: 'sticky-bottom-v1',
    highlightElementIds: ['sticky-bottom-toggle'],
    es: {
      title: 'Sticky bottom — seguir la última línea',
      intro:
        'El panel de transcripción sigue el texto en vivo por defecto. Botón ⬇ sticky para pausar/reanudar.',
      sections: [
        {
          heading: 'Qué cambió',
          bullets: [
            'Antes solo hacía scroll en burbujas nuevas/finales — el texto en vivo se perdía abajo.',
            'Sticky ON por defecto; si subís a leer, se pausa; tocá ⬇ sticky para volver.',
          ],
        },
      ],
    },
    en: {
      title: 'Sticky bottom — follow the latest line',
      intro:
        'Transcript pane follows live text by default. ⬇ sticky toggles pause/resume.',
      sections: [
        {
          heading: 'What changed',
          bullets: [
            'Before: scroll only on new/final bubbles — live growth scrolled out of view.',
            'Sticky ON by default; scrolling up pauses; tap ⬇ sticky to re-follow.',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.23',
    id: 'connect-btn-mode-robot-v1',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'Connect: icono de modo + robot',
      intro:
        'El botón verde muestra el modo STT (marcador / auriculares / mic) y un robot cuando Deepgram está listo.',
      sections: [
        {
          heading: 'Iconos',
          bullets: [
            'Marcador = pestaña · Auriculares = VB · Mic = micrófono',
            'Robot = clave Deepgram desbloqueada / disponible',
          ],
        },
      ],
    },
    en: {
      title: 'Connect: mode + robot icons',
      intro:
        'Green Connect shows STT mode (bookmark / headset / mic) and a robot when Deepgram is ready.',
      sections: [
        {
          heading: 'Icons',
          bullets: [
            'Bookmark = tab · Headset = VB · Mic = microphone',
            'Robot = Deepgram key unlocked / available',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.22',
    id: 'stt-route-three-way-v1',
    highlightElementIds: [
      'audio-route-tab-mode-btn',
      'audio-route-cable-mode-btn',
      'audio-route-mic-mode-btn',
    ],
    es: {
      title: 'Ruta STT: 🔖 · 🎧 · 🎤',
      intro:
        'Micrófono ahora vive en el mismo interruptor que Tab y VB-Cable. Un toque elige el modo; los otros se apagan.',
      sections: [
        {
          heading: 'Barra I/O',
          bullets: [
            '🔖 — compartir pestaña del navegador',
            '🎧 — VB-Cable (CABLE Output → Deepgram)',
            '🎤 — micrófono del dispositivo (teléfono / sin tab)',
            'Tecla M sigue alternando mic. El botón 🎤 del encabezado se quitó.',
          ],
        },
      ],
    },
    en: {
      title: 'STT route: 🔖 · 🎧 · 🎤',
      intro:
        'Mic now lives in the same toggle as Tab and VB-Cable. One tap picks the mode; the others clear.',
      sections: [
        {
          heading: 'I/O strip',
          bullets: [
            '🔖 — browser tab share',
            '🎧 — VB-Cable (CABLE Output → Deepgram)',
            '🎤 — device mic (phone / no tab)',
            'Hotkey M still toggles mic. Header mic button removed.',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.21',
    id: 'off-call-tips-audio-mode-v1',
    highlightElementIds: [
      'audio-route-cable-mode-btn',
      'audio-route-tab-mode-btn',
    ],
    es: {
      title: 'Consejos off-call según modo de audio',
      intro:
        'El panel en espera ya no dice “modo pestaña” si estás en VB-Cable o micrófono. Tips y checklist siguen el modo activo.',
      sections: [
        {
          heading: 'Qué cambia',
          bullets: [
            'VB Cable → tips de CABLE Output (sin selector de pestaña).',
            '🎤 Mic → tips de micrófono / altavoces locales.',
            'Tab → tips de compartir pestaña (como antes).',
            'VB y mic siguen separados (ruta de reproducción distinta), pero ambos son “entrada de dispositivo”.',
          ],
        },
      ],
    },
    en: {
      title: 'Off-call tips follow audio mode',
      intro:
        'Idle pane no longer says “Tab mode” while you are on VB-Cable or mic. Tips and checklist match the active mode.',
      sections: [
        {
          heading: 'What changed',
          bullets: [
            'VB Cable → CABLE Output tips (no tab picker).',
            '🎤 Mic → microphone / local-speaker tips.',
            'Tab → tab-share tips (unchanged).',
            'VB and mic stay separate (playback differs) but share “device input” framing.',
          ],
        },
      ],
    },
  },
  {
    version: '4.84.20',
    id: 'vb-cable-route-ux-v1',
    highlightElementIds: [
      'audio-route-cable-mode-btn',
      'audio-route-tab-mode-btn',
      'audio-route-tab-backup-btn',
      'audio-route-sink-select',
    ],
    es: {
      title: 'Ruta VB-Cable + respaldo por pestaña',
      intro:
        'Nueva barra de audio en el encabezado: elige cómo entra el audio del paciente a Deepgram y cómo volver a compartir pestaña si falla el cable.',
      sections: [
        {
          heading: 'Botones principales (barra I/O)',
          bullets: [
            'VB Cable — activa STT por cable virtual. Muestra VB ON (seleccionado) y VB ✓ (conectado).',
            'Tab — STT por compartir pestaña del navegador. Tab ✓ cuando el audio está adjunto.',
            '→ Tab — solo en modo cable: cambio en vivo a pestaña y abre el selector de Chrome.',
          ],
        },
        {
          heading: 'Dispositivos',
          bullets: [
            '📥 Cable in — CABLE Output (audio de la plataforma hacia Deepgram).',
            '🎤 Mic — tu micrófono físico hacia el paciente vía VB out.',
            '🔊 VB out — CABLE Input (saludos y TTS hacia la llamada).',
            'More → Test VB out — tono de prueba por la misma ruta que escucha el paciente.',
          ],
        },
        {
          heading: 'Flujo recomendado',
          bullets: [
            '1) Pulsa VB Cable (debe verse VB ON en naranja).',
            '2) Verifica 📥 y 🔊 (auto-detectan CABLE si Windows muestra nombres).',
            '3) Connect — badge Cable STT en verde.',
            '4) Si el cable falla en llamada: → Tab (un clic, sin perder la sesión previa hasta que elijas pestaña).',
            '5) Si cancelas el selector de pestaña: mensaje tranquilo, sin error rojo — Connect cuando quieras.',
          ],
        },
        {
          heading: 'Respaldo OS (sin depender de la app)',
          bullets: [
            'Salida de la plataforma → CABLE Input en mezclador de Windows.',
            'Escuchar CABLE Output en audífonos (Listen to this device) — sigues oyendo al paciente si Chrome cae.',
            'Docs: docs/development/audio-routing-no-spof.md',
          ],
        },
      ],
    },
    en: {
      title: 'VB-Cable route + tab fallback',
      intro:
        'New header audio bar: pick how patient audio reaches Deepgram, and how to fall back to tab share if the cable acts up.',
      sections: [
        {
          heading: 'Main buttons (I/O strip)',
          bullets: [
            'VB Cable — virtual-cable STT. Shows VB ON (selected) then VB ✓ (connected).',
            'Tab — browser tab-share STT. Tab ✓ when audio is attached.',
            '→ Tab — cable mode only: live switch to tab STT + opens Chrome picker.',
          ],
        },
        {
          heading: 'Device pickers',
          bullets: [
            '📥 Cable in — CABLE Output (platform audio into Deepgram).',
            '🎤 Mic — your physical mic to the patient via VB out.',
            '🔊 VB out — CABLE Input (greetings + TTS to the call).',
            'More → Test VB out — test tone on the same path patients hear.',
          ],
        },
        {
          heading: 'Recommended flow',
          bullets: [
            '1) Tap VB Cable (orange VB ON highlight).',
            '2) Check 📥 and 🔊 (auto-pick CABLE when Windows labels devices).',
            '3) Connect — Cable STT badge turns green.',
            '4) Cable dies mid-call? → Tab (one click; safe swap after you pick a tab).',
            '5) Cancel the tab picker? Calm message, no red error — Connect when ready.',
          ],
        },
        {
          heading: 'OS-level backup (app-independent)',
          bullets: [
            'Platform output → CABLE Input in Windows volume mixer.',
            'Listen to CABLE Output on your headset — you still hear the patient if Chrome crashes.',
            'Docs: docs/development/audio-routing-no-spof.md',
          ],
        },
      ],
    },
  },
];

export const DEFAULT_RELEASE_NOTES_LANG = 'es';

export const getReleaseNoteForVersion = (version = APP_VERSION) =>
  RELEASE_NOTES_CATALOG.find((n) => n.version === version) || null;

export const getCopyForLang = (note, lang = DEFAULT_RELEASE_NOTES_LANG) => {
  if (!note) return null;
  return lang === 'en' ? note.en : note.es;
};
