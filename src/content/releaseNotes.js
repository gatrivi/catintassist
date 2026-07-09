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
