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
