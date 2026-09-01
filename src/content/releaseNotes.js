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
