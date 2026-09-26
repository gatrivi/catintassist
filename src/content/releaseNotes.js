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
    version: '4.156.0',
    id: 'negation-guard',
    // The switch lives in Settings, not the header — the header is untouched
    // on purpose: with both guards off the app looks and behaves as before.
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Guarda de negaciones: marca la línea, nunca la inventa',
      intro: 'Cuando Deepgram pierde un “niega”, la transcripción dice lo contrario de lo que dijo el paciente. Ahora una ⚠ ámbar en la burbuja te avisa — y la app sigue sin escribir esa palabra nunca.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Nuevo “Negation guard” en Ajustes → Deepgram, apagado por defecto. Es de solo lectura: no cambia ni una palabra.',
        'La ⚠ aparece en el riel de la burbuja, en la misma línea del contador de palabras — cero espacio vertical robado a la transcripción.',
        'Al pasar el mouse te dice qué se esperaba (“no / denies / without”).',
        'Deliberadamente NO avisa en frases normales como “he is allergic to penicillin”: una alarma que grita siempre acaba silenciada. Las pruebas tienen más frases de “no debe avisar” que de “debe avisar”.',
        'La app jamás inventa un “denies” que se perdió: adivinar una negación sería inventar un diagnóstico.',
        'Métrica nueva en `npm run eval:stt`: recall 100% (2/2) y precision 100% (16/16 líneas limpias en silencio).',
      ] }],
    },
    en: {
      title: 'Negation guard: flags the line, never invents it',
      intro: 'When Deepgram loses a “denies”, the transcript says the opposite of what the patient said. An amber ⚠ on the bubble now tells you — and the app still never writes that word.',
      sections: [{ heading: 'What changed', bullets: [
        'New “Negation guard” in Settings → Deepgram, off by default. Read-only: it changes not one word.',
        'The ⚠ sits in the bubble rail, on the same line as the word count — zero vertical space taken from the transcript.',
        'Hover it to see what was expected (“no / denies / without”).',
        'It deliberately does NOT flag ordinary sentences like “he is allergic to penicillin”: an alarm that always fires ends up muted. The tests carry more must-not-warn sentences than must-warn ones.',
        'The app will never invent a lost “denies” — guessing a negation means inventing a diagnosis.',
        'New metric in `npm run eval:stt`: recall 100% (2/2), precision 100% (16/16 clean lines stayed quiet).',
      ] }],
    },
  },
  {
    version: '4.155.1',
    id: 'domain-lexicon-term-repair',
    // Nothing in the header moved on purpose: the switch ships OFF, so the app
    // looks and behaves exactly like v4.154.0 until you turn repair on.
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Léxico médico: corrige palabras, nunca números',
      intro: 'Deepgram escucha “albuterol” como “all but a roll”. Ahora hay un interruptor —apagado por defecto— que corrige esas palabras médicas y legales conocidas, sin tocar jamás una cifra.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Nuevo “Term repair” en Ajustes → Deepgram. Apagado por defecto: mientras esté apagado, la transcripción es exactamente la de Deepgram.',
        'Diccionario con ~40 términos EN/ES: fármacos (albuterol, amoxicilina, metformina…), clínicos y legales (exhibit, deductible, copayment).',
        'Nunca toca un dígito: si una corrección moviera un número, se descarta entera. Las dosis y constantes quedan intocables.',
        'Nunca inventa un “denies” que Deepgram omitió. Eso se reporta (consola `[domain-repair] negation gap?`) para que lo decida una persona.',
        'El reporte `npm run eval:stt` ahora pondera tu día real: ~95% médico, ~5% legal, y muestra cuánta palabra recuperó el léxico (repair +0.46).',
        'Arreglo: la alarma “CAT VANISH” ya no grita falso cada vez que Deepgram agrega una coma (“82,” vs “82”). Antes tapaba las alarmas reales.',
      ] }],
    },
    en: {
      title: 'Medical lexicon: fixes words, never numbers',
      intro: 'Deepgram hears “albuterol” as “all but a roll”. There is now a switch — off by default — that repairs known medical and legal words, and never touches a digit.',
      sections: [{ heading: 'What changed', bullets: [
        'New “Term repair” switch in Settings → Deepgram. OFF by default: while off, the transcript is exactly what Deepgram said.',
        '~40-term EN/ES table: drugs (albuterol, amoxicillin, metformin…), clinical terms, and the legal 3% (exhibit, deductible, copayment).',
        'It never touches a digit: if a repair would have moved a number, the whole repair is thrown away. Doses and vitals stay untouchable.',
        'It never invents a “denies” that Deepgram dropped. That is reported (console `[domain-repair] negation gap?`) for a human to decide.',
        '`npm run eval:stt` now weights your real day: ~95% medical, ~5% legal, and shows how many words the lexicon recovered (repair +0.46).',
        'Fix: the “CAT VANISH” alarm no longer fires falsely every time Deepgram adds a comma (“82,” vs “82”). It was drowning out the real alarms.',
      ] }],
    },
  },
  {
    version: '4.154.0',
    id: 'stt-eval-harness',
    // v4.154.0 is a metrics release: nothing in the header changed, so point the
    // post-dismiss shine at the element that tells you what you are running.
    highlightElementIds: ['header-app-logo-btn'],
    es: {
      title: 'Eval de transcripción: medicina y ahora',
      intro: 'Agregamos las primeras métricas reales de calidad de transcripción: WER, términos, dígitos y negaciones — medidas sobre el texto que realmente leés, no solo lo que devolvió Deepgram.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'WER, precisión de términos, de dígitos y de frases críticas (negaciones) — `npm run eval:stt` imprime el reporte.',
        'Métrica nueva “daño del pipeline”: lo que nuestra app le suma o resta al texto correcto de Deepgram. Hoy: 0.00 en los 6 casos médicos y legales.',
        'Corpus inicial: dosis, negaciones, constantes vitales, juramento, objeción legal, y en español “niega / no”.',
        'Los casos que fallan están a la vista (albuterol → “all but a roll”, exhibit → “exit bit”, 500 → 50, “denies” desaparecido) para corregir el orquestador y el Deepgram con nombre y apellido.',
        'Siguiente: léxicos por dominio + keyterms (documento en docs/stt-eval-plan.md).',
      ] }],
    },
    en: {
      title: 'Transcription eval: medicine and law',
      intro: 'The first real transcription-quality numbers: WER, term, digit and negation accuracy — measured on the text you actually read, not just what Deepgram returned.',
      sections: [{ heading: 'What changed', bullets: [
        'WER + term, digit and critical-phrase (negation) accuracy — `npm run eval:stt` prints the report.',
        'New “pipeline damage” metric: what our app adds or removes to Deepgram’s correct text. Today: 0.00 across all 6 medical and legal cases.',
        'Starter corpus: dosages, negations, vitals, the perjury oath, a legal objection, and Spanish “niega / no”.',
        'Known failures are now visible by name (albuterol → “all but a roll”, exhibit → “exit bit”, 500 → 50, “denies” dropped) so the lexicon and Deepgram can be fixed with evidence.',
        'Next: domain lexicons + keyterms (see docs/stt-eval-plan.md).',
      ] }],
    },
  },
  {
    version: '4.153.0',
    id: 'stt-really-starts',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'CONNECT ahora sí prende Deepgram',
      intro: 'Corregido: si apretabas CONNECT y no llegaba nada, era porque la app creía estar conectada cuando no había audio. Ahora una sola señal manda: Deepgram abierto Y audio fluyendo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'CONNECT solo arranca la llamada si Deepgram está de verdad transcribiendo. Antes, el “idle ear” fingía estar conectado y la llamada pasaba en silencio.',
        'Los dos sockets (EN y ES) abren en paralelo: antes colgar uno dejaba todo sin audio y sin aviso.',
        'Si la pestaña dejó de compartir audio o el micrófono está muteado, se vuelve a pedir en vez de reutilizar un audio muerto.',
        'Si 1,5 s después del CONNECT no hay audio, la app reconecta sola una vez.',
        'Nuevo aviso ámbar “DG up, no audio” cuando Deepgram está abierto pero no entra sonido.',
        'Si falló la pestaña, el mensaje dice cómo salir: “M (mic) yCONNECT”.',
      ] }],
    },
    en: {
      title: 'CONNECT now really starts Deepgram',
      intro: 'Fixed: pressing CONNECT with no text used to mean the app thought it was connected while no audio flowed. One signal rules now — sockets open AND audio flowing.',
      sections: [{ heading: 'What changed', bullets: [
        'CONNECT only starts the call when Deepgram is really transcribing. Idle-ear used to fake “connected”, so the call ran mute.',
        'Both language sockets (EN + ES) open in parallel — one hung socket used to mean no audio and no warning.',
        'A tab that stopped sharing audio, or a muted mic, is re-requested instead of reused as a dead stream.',
        'If 1.5 s after CONNECT nothing is streaming, the app rebuilds once by itself.',
        'New amber “DG up, no audio” chip when Deepgram is open but no sound arrives.',
        'If the tab failed, the message tells you the way out: “M (mic) then CONNECT”.',
      ] }],
    },
  },
  {
    version: '4.152.1',
    id: 'stt-route-resolver',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'CONNECT siempre por la ruta correcta',
      intro: 'Corregido: con el modo micrófono activo, CONNECT ya no intenta capturar pestaña o cable virtual — Deepgram arranca a la primera.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Un único resolvedor decide la ruta (micrófono > cable virtual > pestaña) para cada intento de conexión.',
        'Mensajes de estado honestos: en modo micrófono ahora dice “Requesting Microphone…”.',
        'Error claro si falla el permiso del micrófono, en vez de un mensaje de pestaña.',
      ] }],
    },
    en: {
      title: 'CONNECT always takes the right route',
      intro: 'Fixed: with mic mode active, CONNECT no longer tries tab capture or virtual cable — Deepgram starts on the first press.',
      sections: [{ heading: 'What changed', bullets: [
        'One resolver decides the route (mic > virtual cable > tab) for every connect attempt.',
        'Honest status messages: in mic mode it now says “Requesting Microphone…”.',
        'Clear error if the mic permission fails, instead of a tab-related message.',
      ] }],
    },
  },
  {
    version: '4.152.0',
    id: 'cross-message-repeat-dim',
    highlightElementIds: ['transcript-pane'],
    es: {
      title: 'Lo repetido, en gris',
      intro: 'Si dos mensajes contienen la misma secuencia de palabras, la copia de más abajo se muestra en gris para que no la leas dos veces.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Compara cada mensaje con el anterior: si repite una frase (4 palabras o más), esa parte queda en gris.',
        'Solo cambia el color — no se borra ni reordena nada, y los números siguen completos.',
        'Funciona en la transcripción y en su traducción.',
      ] }],
    },
    en: {
      title: 'Repeats, in gray',
      intro: 'When two messages share the same sequence of words, the later copy is shown in gray so you never read it twice.',
      sections: [{ heading: 'What changed', bullets: [
        'Each message is compared with the previous one: a repeated phrase (4+ words) is grayed out.',
        'Color only — nothing is removed or reordered, and numbers stay complete.',
        'Applies to both the transcription and its translation.',
      ] }],
    },
  },
  {
    version: '4.151.2',
    id: 'transcript-dedupe-supersede',
    highlightElementIds: ['transcript-pane'],
    es: {
      title: 'Una frase, un mensaje',
      intro: 'Deepgram reenvía o reformula el mismo tramo de audio. La app ya no lo muestra dos veces: corrige el mensaje que estaba repitiendo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Un tramo repetido o reformulado corrige su propio renglón: una sola línea por frase.',
        'Se muestra la redacción más nueva; la anterior se atenúa un instante en vez de quedar como un mensaje duplicado.',
        'Aunque cambie una palabra (need/have), sigue siendo un solo mensaje.',
        'Una frase ya escrita que Deepgram vuelve a mandar más tarde no se imprime de nuevo.',
        'Los números (teléfono, código, dosis) no se borran nunca, y nada de lo que ya estaba en el renglón se pierde.',
      ] }],
    },
    en: {
      title: 'One phrase, one message',
      intro: 'Deepgram re-sends or reworks the same audio span. The app no longer shows it twice: it corrects the message it was repeating.',
      sections: [{ heading: 'What changed', bullets: [
        'A repeated or reworded span corrects its own line: one line per phrase.',
        'The newest wording wins; the previous one is dimmed for a moment instead of staying as a duplicate message.',
        'Even when a word changes (need/have) it stays a single message.',
        'A sentence already on screen that Deepgram re-sends later is not printed again.',
        'Numbers (phone, code, dosage) never disappear, and nothing the line already showed is dropped.',
      ] }],
    },
  },
  {
    version: '4.151.1',
    id: 'mic-connect-restore',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: 'CONNECT en modo mic vuelve a funcionar',
      intro: 'Con modo mic activo, CONNECT pedía una pestaña (o VB-Cable) en vez del micrófono, y Deepgram no arrancaba.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'CONNECT en modo mic ahora pide el micrófono y arranca Deepgram.',
        'La ruta se decide en un solo lugar: mic > cable > pestaña, igual que el icono del header.',
        'Si el micrófono falla, el mensaje lo dice claro en vez de hablar de captura de pestaña.',
      ] }],
    },
    en: {
      title: 'Mic-mode CONNECT works again',
      intro: 'With mic mode on, CONNECT asked for a tab (or VB-Cable) instead of the microphone, so Deepgram never started.',
      sections: [{ heading: 'What changed', bullets: [
        'CONNECT in mic mode now requests the microphone and starts Deepgram.',
        'The route is decided in one place: mic > cable > tab, same as the header icon.',
        'If the microphone fails, the message says so instead of talking about tab capture.',
      ] }],
    },
  },
  {
    version: '4.151.0',
    id: 'transcript-dedupe-supersede',
    highlightElementIds: ['transcript-pane'],
    es: {
      title: 'Una frase, un mensaje',
      intro: 'Deepgram a veces reenvía el mismo tramo de audio, o lo devuelve reformulado. La app ya no lo muestra dos veces: reescribe el mensaje que estaba repitiendo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Un tramo repetido o reformulado corrige su propio mensaje: una sola línea por frase.',
        'Se muestra la redacción más nueva; la anterior se atenúa un instante en vez de quedar como un mensaje duplicado.',
        'Los números (teléfono, código, dosis) no se borran nunca de la pantalla.',
        'Un tramo reenviado idéntico (reconexión del socket) ya no crea un mensaje extra.',
      ] }],
    },
    en: {
      title: 'One phrase, one message',
      intro: 'Deepgram sometimes re-sends the same audio span, or returns it reworded. The app no longer shows it twice: it rewrites the message it was repeating.',
      sections: [{ heading: 'What changed', bullets: [
        'A repeated or reworded span corrects its own message: one line per phrase.',
        'The newest wording wins; the previous one is dimmed for a moment instead of staying as a duplicate message.',
        'Numbers (phone, code, dosage) never disappear from the screen.',
        'An identical re-delivered span (socket reconnect) no longer creates an extra message.',
      ] }],
    },
  },
  {
    version: '4.149.0',
    id: 'speech-evidence-zap',
    highlightElementIds: ['audio-route-zap-btn'],
    es: {
      title: 'Zap solo cuando sirve de algo',
      intro: 'La app ahora distingue si falló Deepgram o si se murió tu audio (mic/tablita/cable), y solo se reconecta en el primer caso.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Si alguien está hablando y Deepgram no manda nada por 15s → reconexión automática (~15-20s).',
        'Si nadie habla, no reconecta: el silencio no es una falla (antes podía hacer Zap en pausas largas).',
        'Si tu audio entra en silencio total 35s+, recupera igual por si el tubo murió sin nadie hablando.',
      ] }],
    },
    en: {
      title: 'Zap only when it can help',
      intro: 'The app now tells apart "Deepgram died" from "your audio went silent (mic/tab/cable)" and only reconnects in the first case.',
      sections: [{ heading: 'What changed', bullets: [
        'Someone is speaking and Deepgram sends nothing for 15s → auto-reconnect in ~15-20s.',
        'Nobody speaking → no reconnect: dead air is not a fault (long pauses can no longer trigger churn).',
        'Total silence for 35s+ still recovers, in case the pipe died while no one talked.',
      ] }],
    },
  },
  {
    version: '4.148.1',
    id: 'fast-auto-zap',
    highlightElementIds: ['audio-route-zap-btn'],
    es: {
      title: 'Recuperación automática en 35s',
      intro: 'Si Deepgram deja de enviar datos a mitad de llamada, la app se reconecta sola mucho antes.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Auto-Zap ahora actúa a los 35s sin mensajes de Deepgram (antes 65s) — el Zap sigue siendo instantáneo y no corta la llamada.',
        'Sigue exigiendo que tu audio siga fluyendo y deja un mínimo de 2 minutos entre recuperaciones.',
      ] }],
    },
    en: {
      title: 'Self-recovery now at 35s',
      intro: 'If Deepgram goes silent mid-call, the app reconnects itself far sooner.',
      sections: [{ heading: 'What changed', bullets: [
        'Auto-Zap now fires after 35s of zero Deepgram messages (was 65s) — Zap stays instant and never ends the call.',
        'Still requires your audio to keep flowing and keeps a 2-minute minimum between recoveries.',
      ] }],
    },
  },
  {
    version: '4.148.0',
    id: 'stt-evidence-inspector',
    highlightElementIds: ['header-hold-btn'],
    es: {
      title: 'Inspector de voz + contador visible de espera',
      intro: 'Diagnóstico opcional para encontrar exactamente dónde se pierde una transcripción, sin guardar audio ni texto en disco.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Settings → Audio → Admin STT diagnostics activa el rastro y, si hace falta, los últimos 60 segundos de audio local.',
        'Ctrl+Alt+D abre IDs, horas, confianza, texto original y texto visible de cada burbuja.',
        'El audio y el rastro quedan solo en memoria durante la llamada y se borran al detenerla.',
        'Si Deepgram no responde tras CONNECT, la app se reconecta sola en ~12s (antes: 60s en rojo y Zap manual).',
        'Modo Multilingüe: ya no marca "DG STUCK" en rojo — usa un solo socket y eso ya no cuenta como falla.',
        'El botón de espera ahora muestra H 00:42 y el tiempo transcurrido.',
      ] }],
    },
    en: {
      title: 'Speech evidence inspector + visible hold counter',
      intro: 'Optional diagnostics for finding exactly where a transcription disappears, without saving audio or text to disk.',
      sections: [{ heading: 'What changed', bullets: [
        'Settings → Audio → Admin STT diagnostics enables the trace and, when needed, the last 60 seconds of local audio.',
        'Ctrl+Alt+D opens IDs, timestamps, confidence, raw text, and visible text for each bubble.',
        'Audio and traces stay in memory during the call and are wiped on STOP.',
        'If Deepgram goes silent after CONNECT, the app now reconnects itself in ~12s (before: 60s red + manual Zap).',
        'Multilingual mode no longer shows a false red "DG STUCK" — one socket is normal there.',
        'The hold button now shows H 00:42 with elapsed time.',
      ] }],
    },
  },
  {
    version: '4.147.0',
    id: 'calm-hold-detector',
    highlightElementIds: ['header-hold-btn'],
    es: {
      title: 'El modo estudio ya no interrumpe por pausas cortas',
      intro: 'El detector de espera ahora exige 30 segundos completos de silencio después de una frase de espera.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'La ventana de espera pasó de 3 a 30 segundos de silencio continuo.',
        'Cualquier voz posterior y segura cancela una frase de espera antigua.',
        'La intención permanece activa durante 60 segundos y la voz aún reanuda inmediatamente.',
      ] }],
    },
    en: {
      title: 'Study mode no longer interrupts for short pauses',
      intro: 'Hold detection now requires 30 full seconds of silence after a hold phrase.',
      sections: [{ heading: 'What changed', bullets: [
        'The hold wait increased from 3 to 30 seconds of continuous silence.',
        'Any later confident, non-hold speech cancels an old hold phrase.',
        'Intent stays valid for 60 seconds, and speech still resumes immediately.',
      ] }],
    },
  },
  {
    version: '4.146.1',
    id: 'disconnect-autodetect-farewell',
    highlightElementIds: ['header-autopilot-chip'],
    es: {
      title: '🤖 La llamada cuelga sola: despedidas detectadas + números protegidos de nuevo',
      intro: 'Dos arreglos. (1) El auto-fin por despedida humana ("have a good day") existía en papel pero nunca se conectó al transcript — ahora sí: tras 2 min de silencio abre el aviso cancelable de 10 s. (2) El protector de teléfonos: un corte nuevo de burbujas (v4.141.0) partía el número dictado en dos burbujas y ya no se agrupaba 555-123-4567 — ahora los números vetan ese corte.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Despedida ("thank you", "have a good day", "take care") + 2 min sin voz → aviso "Auto-end in 10s" cancelable. Cualquier voz lo anula.',
        'El chip 🤖 AUTO se pone ámbar (🤖 END⏳) mientras la despedida está armada.',
        'Teléfonos/IDs dictados ya no se parten entre burbujas: la agrupación 555-123-4567 vuelve a funcionar.',
        'Requiere el toggle de Autopilot (Settings → Behavior) para el auto-fin.',
      ] }],
    },
    en: {
      title: '🤖 Calls hang up on their own: farewell detection + phone protector restored',
      intro: 'Two fixes. (1) The human-farewell auto-end ("have a good day") existed on paper but was never wired to the transcript — now it is: after 2 min of silence the 10s cancellable banner opens. (2) Phone protector: a new bubble split (v4.141.0) was cutting dictated numbers across two bubbles so 555-123-4567 never grouped — digits now veto that split.',
      sections: [{ heading: 'What changed', bullets: [
        'Farewell ("thank you", "have a good day", "take care") + 2 min of no speech → cancellable "Auto-end in 10s" banner. Any speech cancels it.',
        'The 🤖 AUTO chip turns amber (🤖 END⏳) while a farewell is armed.',
        'Dictated phones/IDs no longer split across bubbles: 555-123-4567 grouping works again.',
        'Auto-end needs the Autopilot toggle (Settings → Behavior).',
      ] }],
    },
  },

  {
    version: '4.145.0',
    id: 'sticky-bottom-follow',
    highlightElementIds: ['transcript-pane', 'sticky-bottom-toggle'],
    es: {
      title: '📌 El transcript ya no se queda atrás: la última línea siempre visible',
      intro: 'El scroll fijo se pausaba solo: cada vez que una burbuja crecía, el navegador movía el panel por su cuenta y el código lo leía como "el operador se fue hacia arriba". La última línea quedaba debajo del borde y no se podía interpretar.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Solo una acción real (rueda, arrastre, barra de scroll) pausa el seguimiento.',
        'El panel se desplaza directo a la última línea; el anclaje automático del navegador queda desactivado.',
        'Dos pasadas de ajuste (120 y 400 ms) atrapan la altura que llega después del render (traducción, reajuste de texto).',
        'Si estás leyendo hacia arriba, el botón se pone ámbar: "⬇ N new" — un clic te devuelve a lo último.',
      ] }],
    },
    en: {
      title: '📌 The transcript never falls behind: newest line always visible',
      intro: 'The sticky scroll paused itself: every time a bubble grew, the browser moved the pane on its own and the code read that as "the operator scrolled away". The newest line stayed below the fold — impossible to interpret.',
      sections: [{ heading: 'What changed', bullets: [
        'Only a real gesture (wheel, drag, scrollbar) pauses the follow.',
        'The pane scrolls straight to the newest line; browser scroll-anchoring is off.',
        'Two settle passes (120 and 400 ms) catch height that arrives after the render (translation line, re-wrap).',
        'If you are reading back, the button turns amber: "⬇ N new" — one click returns to the newest line.',
      ] }],
    },
  },
  {
    version: '4.144.0',
    id: 'bubble-flex-shrink-overlap',
    highlightElementIds: ['transcript-pane'],
    es: {
      title: '🫧 Fix: el texto ya no se monta sobre la burbuja siguiente',
      intro: 'Causa raíz: el panel del transcript es una columna flexible; cuando se llenaba, el navegador encogía la caja de cada burbuja y la última línea se pintaba encima de la burbuja siguiente.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Las burbujas ya no se encogen (flex-shrink: 0): cada una conserva su alto natural.',
        'Si el transcript llena la pantalla, ahora hace scroll en vez de aplastar las burbujas.',
        'La traducción y la transcripción completas quedan siempre legibles, sin texto encima de texto.',
      ] }],
    },
    en: {
      title: '🫧 Fix: text no longer paints over the next bubble',
      intro: 'Root cause: the transcript pane is a flex column — once it filled up, the browser squashed each bubble below its content height and the last line painted over the next bubble.',
      sections: [{ heading: 'What changed', bullets: [
        'Bubbles no longer shrink (flex-shrink: 0) — each keeps its natural height.',
        'When the transcript fills the pane it scrolls instead of crushing bubbles.',
        'Full transcription + translation stay readable — never text on top of text.',
      ] }],
    },
  },
  {
    version: '4.143.1',
    id: 'hotfix-key-paste-mic-dsp',
    highlightElementIds: ['transcript-pane', 'audio-route-mode-label'],
    es: {
      title: '🎙️ Hotfix: mic sin amortiguar + pegar clave de Deepgram',
      intro: 'Dos arreglos rápidos: el micrófono ya no suena "de teléfono" y la clave de Deepgram se puede pegar desde la interfaz cuando falta.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'La ruta de respaldo del micrófono ya no pasa por el EC/NS/AGC del navegador — antes dejaba la voz amortiguada.',
        'Sin clave de Deepgram configurada, Settings ofrece pegarla al instante (recorte del lapso sin clave).',
      ] }],
    },
    en: {
      title: '🎙️ Hotfix: unmuffled mic + paste Deepgram key',
      intro: 'Two quick fixes: the mic no longer sounds muffled, and the Deepgram key can be pasted in-app when none is configured.',
      sections: [{ heading: 'What changed', bullets: [
        'Mic fallback path no longer runs browser call-quality DSP (EC/NS/AGC) — voice was muffled.',
        'With no Deepgram API key configured, Settings now offers a paste button (outage recovery).',
      ] }],
    },
  },
  {
    version: '4.142.0',
    id: 'repeat-dim',
    highlightElementIds: ['transcript-pane'],
    es: {
      title: '👓 Frase repetida: se atenúa, nunca se borra',
      intro: 'Una burbuja podía imprimir la misma frase dos veces seguida (fragmento recortado a mitad de línea, filas guardadas de una sesión anterior, o el texto atenuado del reemplazo) y el renglón se volvía ilegible. Ahora la segunda copia se ve más suave, pero sigue legible.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Comparación simple de palabras: si una secuencia de 4 palabras o más ya apareció antes en el mismo texto, la copia posterior se atenúa.',
        'Se atenúa al 70%: sigue leyéndose. Nada de tachado ni de texto casi invisible.',
        'NUNCA se borra ni se reordena nada: las palabras permanecen en pantalla tal como se transcribieron.',
        'Números, teléfonos y dosis: si se repiten, se atenúan igual, pero siguen completos y legibles.',
        'Frases que se dicen una sola vez no se tocan. Repeticiones cortas ("no no", "gracias gracias") tampoco.',
        'El texto atenuado del reemplazo (v4.140.0) ahora también se ve al 70%: antes quedaba casi ilegible.',
      ] }],
    },
    en: {
      title: '👓 Repeated phrase: dimmed, never removed',
      intro: 'A bubble could print the same sentence twice in a row (a segment re-cut mid-line, rows saved from an earlier session, or the dimmed wording of a rewrite) and the line became impossible to read. The later copy is now softer, but still readable.',
      sections: [{ heading: 'What changed', bullets: [
        'Simple word compare: if a run of 4+ words already appeared earlier in the same text, the later copy is dimmed.',
        'Dimmed to 70%: it still reads. No strike-through, no almost-invisible text.',
        'Nothing is ever deleted or reordered: every word stays on screen exactly as transcribed.',
        'Numbers, phones and doses: when repeated they dim like anything else, but stay complete and readable.',
        'A phrase said once is left alone. Short repeats ("no no", "thank you thank you") are left alone too.',
        'The dimmed wording of a rewrite (v4.140.0) is now at 70% as well: it used to be nearly illegible.',
      ] }],
    },
  },
  {
    version: '4.141.0',
    id: 'restart-split',
    highlightElementIds: ['transcript-pane', 'audio-route-mode-label'],
    es: {
      title: '🔁 La misma frase ya no se imprime dos veces en una línea',
      intro: 'Cuando Deepgram reenviaba un fragmento que ya había cerrado (recorte de audio, reconexión), ese texto se pegaba a la línea anterior: la frase aparecía dos veces dentro de la misma burbuja y la traducción la copiaba igual.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'El fragmento reenviado ahora abre su propia burbuja: dos renglones limpios seguidos, cada palabra una vez.',
        'NO se borra nada: la línea ya cerrada conserva todas sus palabras tal como las leíste.',
        'Números, teléfonos y dosis quedan intactos (nunca se eliminan al reacomodar).',
        'Repeticiones clínicas ("epinephrine epinephrine") y palabras protegidas siguen sin tocarse.',
        'Menos renglones repetidos: una burbuja en vivo que termina en "?" ya no deja una copia sellada al lado.',
        'Reordenamientos: el texto gris atenuado ya no repite palabras que la línea actual ya muestra.',
      ] }],
    },
    en: {
      title: '🔁 The same sentence no longer prints twice in one line',
      intro: 'When Deepgram re-delivered a segment it had already finalized (audio re-cut, reconnect replay), that text was appended to the line before it: the phrase appeared twice inside one bubble and the translation copied it.',
      sections: [{ heading: 'What changed', bullets: [
        'A re-delivered segment now opens its own bubble: two clean rows, every word once.',
        'Nothing is deleted: the finalized line keeps every word exactly as you read it.',
        'Numbers, phones and doses stay untouched (never removed while re-routing).',
        'Clinical repeats ("epinephrine epinephrine") and protected words are still never pruned.',
        'Fewer repeated rows: a live draft ending in "?" no longer leaves a sealed copy beside it.',
        'Reorders: the dimmed grey wording no longer repeats words the current line already shows.',
      ] }],
    },
  },
  {
    version: '4.140.0',
    id: 'live-text-supersede',
    highlightElementIds: ['transcript-pane', 'audio-route-mode-label'],
    es: {
      title: '👀 El texto en vivo ya no desaparece mientras lo lees',
      intro: 'Cuando Deepgram reescribe una frase, las palabras reemplazadas se quedaban 480 ms y desaparecían de golpe. Ahora se quedan visibles en gris tenue y el reemplazo se marca con un marco claro.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Palabra reemplazada: queda en pantalla atenuada (~25%) durante 1,5 s y luego se desvanece — puedes terminar de leerla.',
        'Palabra nueva: entra con un marco/borde claro que se apaga solo.',
        'Números, teléfonos y dosis siguen a peso legible hasta que salen: nunca se borran mientras los lees.',
        'Si la reescritura NO tiene más confianza, se adopta en el lugar sin dejar dos versiones de la misma frase.',
        'Menos saltos: mientras la frase se revisa, el texto atenuado ya no parpadea ni se duplica.',
        'Con "reducir movimiento" activado, todo es instantáneo y sin animaciones.',
      ] }],
    },
    en: {
      title: '👀 Live text no longer vanishes while you read it',
      intro: 'When Deepgram rewrites a phrase, the replaced words used to linger 480 ms then pop out. Now they stay visible in dim grey and the replacement is marked with a bright frame.',
      sections: [{ heading: 'What changed', bullets: [
        'Replaced wording: stays on screen dimmed (~25%) for 1.5 s, then fades — enough to finish reading it.',
        'Replacing wording: arrives with a bright frame/edge that settles on its own.',
        'Numbers, phones and doses hold at readable weight until they leave — never blanked mid-read.',
        'If the rewrite is NOT higher-confidence it is adopted in place, so the pane never shows two versions of one phrase.',
        'Less jagged: while a phrase is being revised, the dimmed text no longer flickers back or duplicates.',
        'With reduced motion on, everything is instant and animation-free.',
      ] }],
    },
  },
  {
    version: '4.139.0',
    id: 'offcall-ui-cleanup',
    highlightElementIds: ['off-call-guidelines-btn', 'audio-route-mode-label'],
    es: {
      title: '🧹 Interfaz fuera de llamada más limpia',
      intro: 'Menos ruido antes de conectarte: el panel de verificación de micrófono ahora se puede ocultar, los botones Tab/VB/mic se mudaron a Ajustes y las notas se abren solas en llamada.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Mic verify ahora se oculta desde Ajustes → Pantalla (visualización de componentes).',
        'Los botones Tab/VB/mic ya no están en la barra de audio: solo queda una etiqueta informativa. El cambio de fuente se hace en Ajustes → Audio (la tecla M sigue alternando modo mic).',
        'Las notas de sesión se abren automáticamente al iniciar llamada y se cierran al terminar; el botón 📝 sigue funcionando.',
        'Nuevo botón 📖 Guidelines en el panel fuera de llamada: reabre la guía de QA/configuración cuando quieras.',
        'Sincronización navegador ↔ app Pake: los días laborables del objetivo se comparten por nube, los minutos se re-descargan al volver el foco a la ventana y el login de Google tiene respaldo si el popup es bloqueado.',
      ] }],
    },
    en: {
      title: '🧹 Cleaner off-call interface',
      intro: 'Less noise before you connect: mic verify is now hideable, the Tab/VB/mic pills moved to Settings, and session notes open automatically during calls.',
      sections: [{ heading: 'What changed', bullets: [
        'Mic verify can be hidden via Settings → Display (component visibility).',
        'Tab/VB/mic pills are gone from the audio bar — a read-only label remains. Switch sources in Settings → Audio (M key still toggles mic mode).',
        'Session notes auto-open when a call starts and auto-close when it ends; the 📝 toggle still works.',
        'New 📖 Guidelines button in the off-call pane reopens the QA/setup guided tour on demand.',
        'Browser ↔ Pake app sync: goal workdays now share via cloud, minutes re-pull when the window regains focus, and Google sign-in falls back to redirect if the popup is blocked.',
      ] }],
    },
  },
  {
    version: '4.138.0',
    id: 'honest-dg-status-idle-ear',
    highlightElementIds: ['audio-route-zap-btn'],
    es: {
      title: '🩺 El estado de Deepgram ya no miente',
      intro: 'El chip marcaba "DG STUCK" en rojo mientras el texto seguía fluyendo, y el oído en reposo se quedaba sordo con la pestaña de fondo. Ambos arreglados.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'TEXT ✓ cuenta CUALQUIER transcripción (antes solo confianza >0.4): nunca más "DG STUCK" con texto fluyendo.',
        'Zap reinicia los relojes: tras reconectar ves CONNECTING → DG EN/ES, no un STUCK viejo.',
        'DG QUIET = esperando voz, no es falla. STUCK solo si Deepgram no manda NADA 60s (los keepalives vacíos cuentan como vida).',
        'Auto-Zap ya no se dispara en silencios normales ni con detección de llamada apagada; solo en stall real con audio fluyendo.',
        'Zap durante el oído en reposo ya no deja un segundo grabador corriendo.',
        'La detección de voz ya funciona con la pestaña en segundo plano (timer en Web Worker); si el audio se bloquea, ahora avisa en vez de quedarse mudo.',
      ] }],
    },
    en: {
      title: '🩺 The Deepgram status no longer lies',
      intro: 'The chip flashed red "DG STUCK" while text was still flowing, and the idle ear went deaf in background tabs. Both fixed.',
      sections: [{ heading: 'What changed', bullets: [
        'TEXT ✓ now counts ANY transcript (before: confidence >0.4 only) — no more "DG STUCK" while text flows.',
        'Zap resets the clocks: after a reconnect you see CONNECTING → DG EN/ES, never a stale STUCK.',
        'DG QUIET = waiting for speech, not a fault. STUCK only when Deepgram sends NOTHING for 60s (empty keepalives count as life).',
        'Auto-Zap no longer fires on normal silence or with call detection off; only on a real stall while audio still flows.',
        'Zap during idle ear no longer leaves a second recorder racing the rebuilt sockets.',
        'Speech detection now works in background tabs (Web Worker timer); a blocked audio context warns instead of deaf-listening.',
      ] }],
    },
  },
  {
    version: '4.137.0',
    id: 'lane-flip-digit-guard',
    highlightElementIds: ['scroll-bottom-anchor'],
    es: {
      title: '🔢 Los dígitos ya no se borran',
      intro: 'Un cambio de pista EN/ES borraba números (ej. un zip code) que solo la otra pista había escuchado. Ahora los dígitos visibles nunca se borran.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Si la pista ganadora no tiene un número que ya se estaba mostrando, el globo conserva el texto con el número.',
        'Los zips dictados con coma ("93, 550") ya no se parten entre dos burbujas.',
        'Todo intento de borrado queda registrado en la traza (__CAT_DUMP("zip")).',
      ] }],
    },
    en: {
      title: '🔢 Digits can no longer vanish',
      intro: 'An EN/ES lane switch could erase a number (e.g. a zip code) that only the other lane had heard. Digits already on screen are now never dropped.',
      sections: [{ heading: 'What changed', bullets: [
        'If the winning lane lacks a number the bubble already showed, the bubble keeps the text with the number.',
        'Comma-dictated zips ("93, 550") are never torn across two bubbles.',
        'Every block attempt is logged to the vanish trace (__CAT_DUMP("zip")).',
      ] }],
    },
  },
  {
    version: '4.135.0',
    id: 'retroactive-debug-ring',
    highlightElementIds: ['goal-config-version-pill'],
    es: {
      title: '🔍 Grabadora de errores retroactiva',
      intro: 'Cuando un dato (ej. un zip code) desaparece, ya no importa que la consola estuviera inundada: la grabadora ya estaba corriendo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Nuevo anillo en memoria con los últimos ~500 eventos de consola (warn/error siempre conservados).',
        'Tras un incidente, abre la consola y ejecuta __CAT_DUMP("zip") para ver la traza completa.',
        'Etiquetas separadas por evento ([Deepgram:open], [Session:save]…) para poder filtrar.',
      ] }],
    },
    en: {
      title: '🔍 Retroactive debug recorder',
      intro: 'When data (e.g. a zip code) vanishes, it no longer matters that the console was flooded — the recorder was already running.',
      sections: [{ heading: 'What changed', bullets: [
        'New in-memory ring keeps the last ~500 console events (warn/error entries always retained).',
        'After an incident, open the console and run __CAT_DUMP("zip") to see the full trace.',
        'Labels split per event ([Deepgram:open], [Session:save]…) so they are filterable.',
      ] }],
    },
  },
  {
    version: '4.134.0',
    id: 'bubble-overlap-fix',
    highlightElementIds: ['scroll-bottom-anchor'],
    es: {
      title: '🫧 Burbujas que ya no se enciman',
      intro: 'A veces una burbuja del transcript se desbordaba sobre la siguiente y ninguna se podía leer.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'El bloqueo de altura de la burbuja viva ya no se traba con alturas medidas a mitad de animación.',
        'Las burbujas ahora ajustan su altura solo cuando el texto realmente crece.',
        'La última burbuja ya no se corta contra el borde inferior.',
      ] }],
    },
    en: {
      title: '🫧 Bubbles no longer overlap',
      intro: 'Transcript bubbles sometimes overflowed into the next bubble so neither was readable.',
      sections: [{ heading: 'What changed', bullets: [
        'The live-bubble height lock no longer traps heights measured mid-animation.',
        'Bubbles now resize only when the text actually grew.',
        'The last bubble no longer clips against the bottom edge.',
      ] }],
    },
  },
  {
    version: '4.133.1',
    id: 'greeting-editor-load-hotfix',
    highlightElementIds: ['gee-record-bar'],
    es: {
      title: '🛠 El editor de saludos ya no se bloquea',
      intro: 'Si el almacenamiento del navegador dañaba el valor del transcript, el editor de saludos quedaba trabado en "Load failed" para siempre.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Los valores que no son audio (transcript, sello de última llamada) ya no pueden romper la carga.',
        'Si un clip está ilegible, el resto carga igual y el editor te dice cuál regrabar.',
        'Tu transcript no se borra ni se toca.',
      ] }],
    },
    en: {
      title: '🛠 Greeting editor no longer bricks',
      intro: 'If browser storage corrupted the transcript value, the greeting editor got stuck on "Load failed" forever.',
      sections: [{ heading: 'What changed', bullets: [
        'Non-audio values (transcript, last-call seal) can no longer break the load.',
        'If a clip is unreadable, everything else still loads and the editor names the bad clip.',
        'Your transcript is never deleted or touched.',
      ] }],
    },
  },
  {
    version: '4.131.1',
    id: 'pacific-shift-clock',
    highlightElementIds: ['on-call-soundboard'],
    es: {
      title: '🕘 El saludo sigue tu hora del Pacífico',
      intro: 'Antes el saludo elegía mañana/tarde/noche con el reloj de tu computadora: en GMT-3 a las 13:02 disparaba el de la tarde cuando en el Pacífico eran las 09:02.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'El saludo ahora se elige con la hora del Pacífico (America/Los_Angeles), no con la hora de tu máquina.',
        'Mismos cortes de siempre: mañana antes de las 12:00, tarde antes de las 17:00, noche después.',
        'La tira de saludos y el Soundboard Studio usan la misma regla — nunca más eligen distintos.',
      ] }],
    },
    en: {
      title: '🕘 Greetings follow Pacific shift time',
      intro: 'The opener used to pick morning/afternoon/evening from your computer clock: on a GMT-3 machine at 13:02 it fired the afternoon take while Pacific time was still 09:02.',
      sections: [{ heading: 'What changed', bullets: [
        'The slot is now read from US Pacific time (America/Los_Angeles), never the machine clock.',
        'Same boundaries as before: morning before 12:00, afternoon before 17:00, evening after.',
        'The on-call strip and Soundboard Studio share one rule — they can no longer disagree.',
      ] }],
    },
  },
  {
    version: '4.130.2',
    id: 'reattach-per-mode',
    highlightElementIds: ['last-call-seal'],
    es: {
      title: '🟡 Re-attach habla tu idioma',
      intro: 'El aviso de reconexión ahora nombra tu ruta real: VB-Cable, mic o tab.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Si usás VB-Cable, el cartel dice "re-attach VB-Cable" — nunca más "re-attach tab".',
      ] }],
    },
    en: {
      title: '🟡 Re-attach speaks your route',
      intro: 'The reconnect banner now names your real route: VB-Cable, mic, or tab.',
      sections: [{ heading: 'What changed', bullets: [
        'On VB-Cable the banner says "re-attach VB-Cable" — never "re-attach tab" again.',
      ] }],
    },
  },
  {
    version: '4.131.0',
    id: 'studio-soundcheck-line',
    highlightElementIds: ['sb-soundcheck-line'],
    es: {
      title: '🔇 Soundboard sin ruido',
      intro: 'El estudio muestra una sola línea de estado; probar y arreglar vive en su propia vista.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Una línea: listo o qué falta (EN/ES) + botón Sound check →.',
        'El chequeo de 3 pasos, volúmenes y bocina se mudaron al Greeting Editor.',
        'Tus clips no se perdieron: viven por navegador — usa Download/Upload recordings para pasarlos entre live y localhost.',
      ] }],
    },
    en: {
      title: '🔇 Quieter soundboard',
      intro: 'Studio is one status line; test + fix live in their own view.',
      sections: [{ heading: 'What changed', bullets: [
        'One line: ready or what is missing (EN/ES) + Sound check → button.',
        'The 3-step check, volumes and beep moved to the Greeting Editor.',
        'Clips are per-browser — use Download/Upload recordings to move them between live and localhost.',
      ] }],
    },
  },
  {
    version: '4.130.1',
    id: 'last-call-seal',
    highlightElementIds: ['last-call-seal'],
    es: {
      title: '📞 La llamada queda guardada',
      intro: 'Al terminar, la transcripción queda sellada y legible hasta la próxima llamada.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'STOP / fin automático sellan la última llamada: se puede releer aunque se recargue.',
        'Se borra sola con la próxima llamada, al cerrar el día, o con 🗑.',
        'Sin Deepgram no se termina sola: corte o update ya no significan fin de llamada.',
      ] }],
    },
    en: {
      title: '📞 Last call is sealed',
      intro: 'After a call ends, its transcript stays readable until the next call.',
      sections: [{ heading: 'What changed', bullets: [
        'STOP / auto-end seals the last call — re-readable even after a refresh.',
        'Auto-expires on next call, End Day, or 🗑.',
        'No more auto-end while Deepgram is down: outage or update is not a call end.',
      ] }],
    },
  },
  {
    version: '4.129.1',
    id: 'connect-equals-break-box',
    highlightElementIds: ['header-connect-btn', 'header-break-btn'],
    es: {
      title: '🟰 Connect igual que BREAK',
      intro: 'Connect ahora comparte la caja exacta de BREAK: 26×26.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Connect y BREAK usan la misma regla: 26×26, padding 0, radio 4px (23px ≤1100px).',
        'La etiqueta BREAK de 90m sigue expandiéndose; Connect nunca crece.',
      ] }],
    },
    en: {
      title: '🟰 Connect = BREAK',
      intro: 'Connect now shares BREAK exact box: 26×26.',
      sections: [{ heading: 'What changed', bullets: [
        'Connect + BREAK share one rule: 26×26, padding 0, radius 4px (23px ≤1100px).',
        '90m BREAK label still expands; Connect never grows.',
      ] }],
    },
  },
  {
    version: '4.129.0',
    id: 'break-size-soundboard-buttons',
    highlightElementIds: ['audio-route-soundboard-btn', 'header-break-btn', 'header-connect-btn'],
    es: {
      title: '🎛 Botones chicos, fila fina',
      intro: 'Soundboard, Editor y Connect ya miden lo mismo que BREAK.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Soundboard (🎛) y Editor (✎) ahora son cuadrados de 26px como BREAK.',
        'Connect forzado a caja exacta 26×26 + glow sin escala (el flash lo agrandaba 3%).',
        'Nombre completo sigue en el tooltip.',
      ] }],
    },
    en: {
      title: '🎛 Small buttons, slim row',
      intro: 'Soundboard + Editor + Connect now match BREAK size.',
      sections: [{ heading: 'What changed', bullets: [
        'Soundboard (🎛) + Editor (✎) are 26px squares like BREAK.',
        'Connect forced to exact 26×26 box + glow without scale (flash grew it 3%).',
        'Full name stays in the tooltip.',
      ] }],
    },
  },
  {
    version: '4.128.0',
    id: 'sink-only-caller-audio',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: '📡 Saludos una sola vez',
      intro: 'Lo que va al paciente ya no suena en tus bocinas.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Disparar un saludo lo manda SOLO al paciente — antes sonaba doble.',
        'Si quieres escucharlo tú también, marca Monitor en la tira de saludos.',
        'Se cortó el retorno A1→cable: tus saludos ya no se transcriben solos.',
      ] }],
    },
    en: {
      title: '📡 Greetings play once',
      intro: 'Caller-bound audio no longer echoes on your speakers.',
      sections: [{ heading: 'What changed', bullets: [
        'Firing a greeting sends it to the patient ONLY — no more double-hear.',
        'Want to hear it too? Check Monitor on the greetings strip.',
        'Cut the A1→cable loop: greetings stop transcribing themselves.',
      ] }],
    },
  },
  {
    version: '4.127.0',
    id: 'uniform-header-buttons',
    highlightElementIds: ['header-connect-btn'],
    es: {
      title: '🔲 Botones parejos, fila fina',
      intro: 'Conectar, stop, hold, todo de 23px — también en llamada.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Todos los botones de la fila: mismo tamaño en llamada y fuera.',
        'Hold activo muestra H (el tiempo sigue en el tooltip).',
        'El centro off-call es una sola fila; el cartel de versión se fue (versión en el 🐱).',
      ] }],
    },
    en: {
      title: '🔲 Uniform buttons, slim rows',
      intro: 'Connect, stop, hold — all 23px, on-call too.',
      sections: [{ heading: 'What changed', bullets: [
        'Every sticky-row button the same size, on-call and off.',
        'Active hold shows H (time stays in the tooltip).',
        'Off-call center is one row; version pill gone (version on the 🐱).',
      ] }],
    },
  },
  {
    version: '4.126.0',
    id: 'slim-sticky-row',
    highlightElementIds: ['header-settings-btn'],
    es: {
      title: '🧹 Fila superior más limpia',
      intro: 'Notas, STT y llave viven en ⚙️ Ajustes — la fila no se achica a 900px.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '📝, STT y llave salieron de la fila superior → ⚙️ Ajustes.',
        'El interruptor de notas vive en Ajustes → Comportamiento.',
      ] },
      { heading: 'Más aire', bullets: [
        'STOP del mismo alto que CONNECT, doble ancho. Mic verify y estado I/O en Settings → audio.',
        'Las notas se cierran al terminar la llamada. El aviso de update espera a que cuelgues.',
      ] }],
    },
    en: {
      title: '🧹 Slimmer top row',
      intro: 'Notes, STT and key live in ⚙️ Settings — the row breathes at 900px.',
      sections: [{ heading: 'What changed', bullets: [
        '📝, STT and key left the sticky row → ⚙️ Settings.',
        'The notes toggle lives in Settings → Behavior.',
      ] },
      { heading: 'More breathing room', bullets: [
        'STOP matches CONNECT height at double width. Mic-verify + I/O status moved to Settings → audio.',
        'Notes auto-close on STOP. Update banner waits until you hang up.',
      ] }],
    },
  },
  {
    version: '4.125.0',
    id: 'hold-phrases-v1',
    highlightElementIds: ['header-hold-btn'],
    es: {
      title: '⏸ Hold automático que entiende la sala de espera',
      intro: '"wait for the provider", "un momento", "ya viene el doctor" activan hold.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Detecta frases de espera en inglés y español (antes: 7 fijas en inglés).',
        'La música de espera ya no rompe el hold.',
        'Sigue pidiendo 3s de silencio real antes de activarse.',
      ] }],
    },
    en: {
      title: '⏸ Auto-hold that understands the waiting room',
      intro: '"wait for the provider", "un momento", "doctor will be in" trigger hold.',
      sections: [{ heading: 'What changed', bullets: [
        'Waiting-room phrases in EN + ES (was: 7 hardcoded English).',
        'Hold music no longer breaks hold.',
        'Still needs 3s of real silence before engaging.',
      ] }],
    },
  },
  {
    version: '4.124.0',
    id: 'on-off-last-timers',
    highlightElementIds: ['off-call-gap-row'],
    es: {
      title: '⏱ OFF y LAST siempre visibles',
      intro: 'Fuera de llamada ves cuánto llevas libre y cuánto duró la última.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Fuera de llamada: 🚪 OFF en vivo · 📞 LAST (duración última llamada) · 📞/📡 del día.',
        'En llamada: el cronómetro lleva 📞 ON adelante.',
        'Los totales del día viajan en la misma fila (a ≤1100px el CSS los esconde).',
      ] }],
    },
    en: {
      title: '⏱ OFF and LAST always visible',
      intro: 'Off-call you see time since the last call and how long it was.',
      sections: [{ heading: 'What changed', bullets: [
        'Off-call: live 🚪 OFF · 📞 LAST (last call length) · day 📞/📡.',
        'On-call: live timer carries a 📞 ON prefix.',
        'Day totals ride the same row (CSS hides them at ≤1100px).',
      ] }],
    },
  },
  {
    version: '4.123.0',
    id: 'auto-start-any-speech',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '📞 La llamada arranca con cualquier voz',
      intro: 'Aunque el audio llegue dudoso, la llamada empieza y nada se pierde.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Cualquier voz audible inicia la llamada, aunque Deepgram dude (antes: se perdía).',
        'La confianza sigue mandando solo para facturación/actividad.',
      ] }],
    },
    en: {
      title: '📞 Calls start on any speech',
      intro: 'Even low-confidence openers start the call — no intake lost.',
      sections: [{ heading: 'What changed', bullets: [
        'Any audible speech starts the call, even when Deepgram is unsure (was: dropped).',
        'Confidence still gates billing/activity signals only.',
      ] }],
    },
  },
  {
    version: '4.122.0',
    id: 'fractions-percent-selfpay',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '½ Fracciones, porcentajes y sin seguro',
      intro: '"la mitad", "50 por ciento" y visitas self-pay protegidos.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"one half" → 1/2, "la mitad" → 1/2. "50 percent" → 50%.',
        '"self-pay, sin seguro, deductible" activan protección de precios.',
      ] }],
    },
    en: {
      title: '½ Fractions, percents & self-pay',
      intro: '"one half", "50 percent" and self-pay visits protected.',
      sections: [{ heading: 'What changed', bullets: [
        '"one half" → 1/2, "la mitad" → 1/2. "50 percent" → 50%.',
        '"self-pay, sin seguro, deductible" trigger price protection.',
      ] }],
    },
  },
  {
    version: '4.121.0',
    id: 'rooms-ranges-honest-yellow',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '📍 Rooms, horarios y amarillos honestos',
      intro: '"Room 402", "quarter to 3" y resaltado que solo marca duda real.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"Room 402, Bed 12, PO Box, ext" resaltan. "Case number" agrupa como ID.',
        '"quarter to 3" → 2:45, "3 en punto" → 3:00, "1 to 3" resalta.',
        'Amarillo solo donde Deepgram dudó de verdad; números llevan su peor dígito.',
      ] }],
    },
    en: {
      title: '📍 Rooms, ranges, honest yellow',
      intro: '"Room 402", "quarter to 3", and highlighting that only marks real doubt.',
      sections: [{ heading: 'What changed', bullets: [
        '"Room 402, Bed 12, PO Box, ext" highlight. "Case number" groups as ID.',
        '"quarter to 3" → 2:45, "3 o\'clock" → 3:00, "1 to 3" highlights.',
        'Yellow only where Deepgram truly doubted; numbers carry weakest digit.',
      ] }],
    },
  },
  {
    version: '4.120.0',
    id: 'dictation-magnitudes-vitals',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '🗣️ Dictados y vitales: oh/doble, cientos, NPI, presión',
      intro: '"8 oh 5", "dos mil", "NPI" y "120 over 80" ahora salen bien.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"8 oh 5" → 805, "double five" → 55. "One hundred 23" → 123, "dos mil 26" → 2026.',
        '"NPI 1234567890" no se deforma. "120 over 80" → 120/80.',
        'Peso, talla y temperatura resaltan y copian ("150 pounds", "37 grados").',
      ] }],
    },
    en: {
      title: '🗣️ Dictation & vitals: oh/double, hundreds, NPI, BP',
      intro: '"8 oh 5", "one hundred", "NPI" and "120 over 80" now come out right.',
      sections: [{ heading: 'What changed', bullets: [
        '"8 oh 5" → 805, "double five" → 55. "One hundred 23" → 123, "dos mil 26" → 2026.',
        '"NPI 1234567890" stays verbatim. "120 over 80" → 120/80.',
        'Weight, height and temp highlight + copy ("150 pounds", "37 grados").',
      ] }],
    },
  },
  {
    version: '4.119.0',
    id: 'address-repairs',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '📍 Direcciones que sobreviven: ZIP, E, suite',
      intro: '"3247 e Avenida, s 1, ... 93, 550" ahora sale "3247 E Avenida" + ZIP 93550 en un chip.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"California, 93, 550" → 93550 (solo junto a estado/ZIP/calle).',
        '"3247 e/and Avenida" → "3247 E Avenida". "s 1" y "apt 4B" copian bien.',
        'La dirección resalta en un chip: clic copia la línea completa.',
      ] }],
    },
    en: {
      title: '📍 Addresses that survive: ZIP, E, suite',
      intro: '"3247 e Avenida, s 1, ... 93, 550" now renders "3247 E Avenida" + ZIP 93550 in one chip.',
      sections: [{ heading: 'What changed', bullets: [
        '"California, 93, 550" → 93550 (only near state/ZIP/street cues).',
        '"3247 e/and Avenue" → "3247 E Avenue". "s 1" and "apt 4B" copy right.',
        'The street line highlights as one chip: click copies the full line.',
      ] }],
    },
  },
  {
    version: '4.117.0',
    id: 'request-memory-formatting',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '🧠 Recuerda qué pidió: teléfono/SSN se formatean solos',
      intro: '"¿Me da su teléfono?" arma el formato: los dígitos que lleguen después salen bien agrupados.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"Can I have your phone number / SSN" + dígitos en otra burbuja → se formatean igual.',
        'Duplicados de corte ("555 123 123 4567") colapsan a una copia.',
        'Cubre "me puede dar su número", "birth/born/DOB/age", "how old".',
      ] }],
    },
    en: {
      title: '🧠 Remembers what was asked: phone/SSN self-format',
      intro: '"Can I have your number?" arms formatting: digits arriving later still group correctly.',
      sections: [{ heading: 'What changed', bullets: [
        '"Can I have your phone number / SSN" + digits in a later bubble → still formatted.',
        'Cut duplicates ("555 123 123 4567") collapse to one copy.',
        'Covers "me puede dar su número", "birth/born/DOB/age", "how old".',
      ] }],
    },
  },
  {
    version: '4.116.0',
    id: 'never-destroy-numbers',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '🛡️ Duda = mostrar ambas, números nunca se borran',
      intro: 'Nueva regla: ante la duda se muestran ambas opciones y ningún número renderizado se destruye.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Fechas ambiguas copian ambas lecturas: "05/12/1980" → 1980-05-12 / 1980-12-05.',
        'Números raros (8, 12 dígitos) quedan como dictados salvo "phone/SSN" explícito.',
        'Solapes con dígitos no recortan; "5", "$" y "1:30" nunca se borran en vivo.',
      ] }],
    },
    en: {
      title: '🛡️ Doubt = show both, numbers never destroyed',
      intro: 'New rule: when in doubt both options show, and no rendered number is ever destroyed.',
      sections: [{ heading: 'What changed', bullets: [
        'Ambiguous dates copy both readings: "05/12/1980" → 1980-05-12 / 1980-12-05.',
        'Odd lengths (8, 12 digits) stay as dictated unless explicit phone/SSN cue.',
        'Digit overlaps never strip; "5", "$", "1:30" never blank live.',
      ] }],
    },
  },
  {
    version: '4.115.0',
    id: 'sensitive-data-round-2',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '🛡️ Números protegidos: DOB, dosis, dinero, emails',
      intro: 'Segunda ronda de protección de datos: fechas con espacios, dosis con palabras y emails dictados ya no se destruyen.',
      sections: [{ heading: 'Qué se arregló', bullets: [
        '"DOB 05 12 1980" y "05.12.1980" quedan intactos con copia ISO.',
        '"eighty two" → 82, "dos punto cinco mg" → 2.5 mg, "$1,234.56" de una pieza.',
        '"juan at gmail dot com" resalta y clic copia juan@gmail.com. "Calle 45" protegido.',
        '"half past two" → 2:30, "14:30" y "3pm" resaltan. ZIP+4 y MRNs no se deforman.',
      ] }],
    },
    en: {
      title: '🛡️ Protected numbers: DOB, doses, money, emails',
      intro: 'Second protection round: spaced dates, word doses and dictated emails survive.',
      sections: [{ heading: 'What got fixed', bullets: [
        '"DOB 05 12 1980" and "05.12.1980" stay intact with ISO copy.',
        '"eighty two" → 82, "two point five mg" → 2.5 mg, "$1,234.56" in one piece.',
        '"juan at gmail dot com" highlights and click-copies juan@gmail.com. "Calle 45" safe.',
        '"half past two" → 2:30, "14:30" and "3pm" highlight. ZIP+4 and MRNs untouched.',
      ] }],
    },
  },
  {
    version: '4.118.0',
    id: 'greeting-editor-view',
    highlightElementIds: ['audio-route-greeting-editor-btn'],
    es: {
      title: '✎ Editor de Saludos: un saludo a la vez',
      intro: 'Nueva vista enfocada: guion, onda, barras de salud y prueba al caller para UN saludo, sin el panel gigante.',
      sections: [{ heading: 'Cómo se usa', bullets: [
        'Botón ✎ Editor en la fila de chips del header (off-call) — o ✏️ en cualquier tile del Studio.',
        '◀ ▶ (o flechas) navega saludos; Escape sale. La barra lateral marca guardado/vacío por familia.',
        '🎙 Record · 🔊 You · 📡 Caller (CALL OK solo si la prueba llegó al final) · ⬆ Upload · editor de onda integrado.',
        'Los fallos se muestran en la vista, no solo en la consola. El Studio queda como catálogo.',
      ] }],
    },
    en: {
      title: '✎ Greeting Editor: one greeting at a time',
      intro: 'New focused view: script, waveform, health bars and caller test for ONE greeting — no giant panel.',
      sections: [{ heading: 'How to use', bullets: [
        '✎ Editor button on the header chips row (off-call) — or ✏️ on any Studio tile.',
        '◀ ▶ (or arrow keys) navigate greetings; Escape exits. The side rail shows saved/empty per family.',
        '🎙 Record · 🔊 You · 📡 Caller (CALL OK only when the test ran to the end) · ⬆ Upload · inline waveform editor.',
        'Failures show in the view, not just the console. The Studio stays as the catalog.',
      ] }],
    },
  },
  {
    version: '4.114.0',
    id: 'clerk-slot-times',
    highlightElementIds: ['main-transcript'],
    es: {
      title: '🕐 Horarios de clerk: 1 1 30 = 1:00 y 1:30',
      intro: 'Las horas dictadas en cadena ya no se destruyen: se expanden y se resaltan.',
      sections: [{ heading: 'Qué cambió', bullets: [
        '"we have 1 1 30, 2 2 30" ya no se destruye: se expande a 1:00, 1:30, 2:00, 2:30.',
        'Las horas salen resaltadas y clic copia. Teléfonos y SSNs siguen igual.',
      ] }],
    },
    en: {
      title: '🕐 Clerk slot times: 1 1 30 = 1:00 and 1:30',
      intro: 'Chained spoken times are no longer destroyed: they expand and highlight.',
      sections: [{ heading: 'What changed', bullets: [
        '"we have 1 1 30, 2 2 30" is no longer mangled: expands to 1:00, 1:30, 2:00, 2:30.',
        'Times highlight and click-to-copy. Phones and SSNs unchanged.',
      ] }],
    },
  },
  {
    version: '4.113.0',
    id: 'goal-tracking-view',
    highlightElementIds: ['header-goal-btn'],
    es: {
      title: '🎯 Vista de Metas: dial + calendario',
      intro: 'El selector de metas ahora tiene su propia vista completa, con calendario mensual y ritmo en vivo.',
      sections: [{ heading: 'Qué hay', bullets: [
        '🎯 en el header (o el chip de metas) abre la vista: dial a la izquierda, calendario a la derecha.',
        'El calendario muestra los minutos trabajados por día — clic en un día para corregirlos.',
        'El ritmo (need/día) se actualiza EN VIVO mientras mueves el dial o cambias 4/5/6/6.5/7 días por semana, contando lo ya trabajado.',
        'El gato 🐱 (o Escape) te devuelve a la transcripción. Fuera de llamada solamente.',
      ] }],
    },
    en: {
      title: '🎯 Goal Tracking view: dial + calendar',
      intro: 'The goal selector got its own full view, with a month calendar and live pace.',
      sections: [{ heading: "What's in it", bullets: [
        '🎯 in the header (or the targets chip) opens the view: dial left, calendar right.',
        'Calendar shows minutes worked per day — click a day to fix it.',
        'Pace (need/day) updates LIVE while you move the dial or switch 4/5/6/6.5/7 days per week, counting minutes banked so far.',
        'The cat 🐱 (or Escape) takes you back to transcription. Off-call only.',
      ] }],
    },
  },
  {
    version: '4.112.0',
    id: 'local-watch-single-tab',
    highlightElementIds: ['main-transcript'],
    es: {
      title: 'Sin más popup cada 5 minutos',
      intro: 'Una sola pestaña (`npm run local`) vigila el traductor local. Cero ventanas nuevas.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Apagada la tarea CatTS-API-Watchdog (flash de consola cada 5 min).',
        '`npm run local`: revisa :59200 cada 30s y lo levanta oculto si se cae.',
        'Tu traducción sigue igual; solo desaparece la interrupción.',
      ] }],
    },
    en: {
      title: 'No more 5-minute popup',
      intro: 'One tab (`npm run local`) watches the local translator. Zero new windows.',
      sections: [{ heading: 'What changed', bullets: [
        'CatTS-API-Watchdog task (console flash every 5 min) switched off.',
        '`npm run local`: checks :59200 every 30s, lifts it hidden if down.',
        'Translation itself unchanged; only the interruption is gone.',
      ] }],
    },
  },
  {
    version: '4.111.0',
    id: 'greetings-in-notes-rail',
    highlightElementIds: ['soundboard-dock'],
    es: {
      title: '🎚️ Saludos en el carril de notas, también en llamada',
      intro: 'Los saludos ahora viven en la mitad superior de las notas de sesión durante la llamada — y las miniaturas nunca esconden su título.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Con notas abiertas en llamada: saludos arriba, notas abajo — cero espacio robado a la transcripción.',
        'Los títulos de las miniaturas siempre visibles sobre un degradado sutil; la imagen queda limpia.',
        'EN/ES ahora con insignia de color (verde/azul) + ícono ☀/🌤/🌙 si suena la variante de otra franja horaria.',
      ] }],
    },
    en: {
      title: '🎚️ Greetings in the notes rail, in-call too',
      intro: 'Greetings now live in the top half of session notes during calls — and thumbnails never hide their title.',
      sections: [{ heading: 'What changed', bullets: [
        'Notes open during a call: greetings on top, notes below — zero space stolen from transcription.',
        'Thumbnail titles always visible on a subtle gradient; the image stays clean.',
        'EN/ES now color-coded badges (green/blue) + ☀/🌤/🌙 icon when a different time-of-day recording fires.',
      ] }],
    },
  },
  {
    version: '4.110.0',
    id: 'choppiness-verdict',
    highlightElementIds: ['sb-soundcheck-line'],
    es: {
      title: '〰️ Detector de audio entrecortado',
      intro: 'Ahora cada grabación también se evalúa por entrecortado (stutter), además del volumen.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Píldora 〰️ SMOOTH / SLIGHT CHOP / CHOPPY en Setup, al lado del volumen 🔊.',
        'En las tarjetas: rombo ◆ = entrecortado, círculo ● = volumen — imposible confundirlos.',
        'Detecta el patrón staccato de grabaciones entrecortadas; se aplica también a grabaciones viejas.',
      ] }],
    },
    en: {
      title: '〰️ Choppiness detector',
      intro: 'Every recording is now also checked for choppiness (stutter), on top of loudness.',
      sections: [{ heading: 'What changed', bullets: [
        '〰️ SMOOTH / SLIGHT CHOP / CHOPPY pill in Setup, next to the 🔊 loudness pill.',
        'On tiles: diamond ◆ = choppiness, circle ● = loudness — impossible to confuse.',
        'Detects the staccato pattern of garbled recordings; also applies to already-recorded clips.',
      ] }],
    },
  },
  {
    version: '4.109.0',
    id: 'loudness-verdict',
    highlightElementIds: ['sb-soundcheck-line'],
    es: {
      title: '🔊 Medidor de volumen de los saludos',
      intro: 'Cada grabación del soundboard ahora se evalúa localmente: ¿es suficientemente fuerte para escucharse claro?',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Píldora PEACHES/GOOD/SOFT/TOO QUIET con dB junto al chequeo de legibilidad en Setup.',
        'Punto de color en cada tarjeta del soundboard — verde audible, ámbar/naranja regrabar.',
        'Sin API ni clave: se mide el nivel real (RMS) al decodificar el audio.',
      ] }],
    },
    en: {
      title: '🔊 Greeting loudness meter',
      intro: 'Every soundboard recording is now evaluated locally: is it loud enough to be heard clearly?',
      sections: [{ heading: 'What changed', bullets: [
        'PEACHES/GOOD/SOFT/TOO QUIET pill with dB next to the legibility check in Setup.',
        'Color dot on every soundboard tile — green audible, amber/orange re-record.',
        'No API or key: real level (RMS) is measured while decoding the audio.',
      ] }],
    },
  },
  {
    version: '4.108.3',
    id: 'voicemeeter-input-not-in1',
    highlightElementIds: ['audio-route-sink-select'],
    es: {
      title: '🔊 Elegí Voicemeeter Input, sin número',
      intro: 'Para saludos por VAIO, elegí Voicemeeter Input (sin número). In 1–5 son entradas de extensión opcionales; la app las identificaba incorrectamente.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'La selección automática evita In 1–5 y muestra una advertencia si elegís una extensión.',
        '📡 Caller prueba la salida elegida también en modo Mic; los botones normales siguen reproduciendo localmente.',
      ] }],
    },
    en: {
      title: '🔊 Voicemeeter Input ≠ In 1',
      intro: 'For greetings through VAIO, choose Voicemeeter Input (no number). In 1–5 are optional extension inputs; the app previously misidentified them.',
      sections: [{ heading: 'What changed', bullets: [
        'Automatic selection skips In 1–5 and warns when an extension is selected.',
        '📡 Caller tests the selected output even in Mic mode; ordinary Mic-mode playback remains local.',
      ] }],
    },
  },
  {
    version: '4.108.2',
    id: 'direct-sink-voicemeeter-fix-v1',
    highlightElementIds: ['audio-route-sink-select'],
    es: {
      title: '🔊 Saludos: salida elegida y cancelación segura',
      intro: 'v4.108.2 — La ruta directa ahora aplica el VB out elegido antes de reproducir. Detener o cambiar la salida cancela los saludos pendientes, también en las rutas de respaldo. Falta comprobar la llegada al interlocutor en tu equipo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Cada saludo hace resume + setSinkId al VB out (Voicemeeter Input / CABLE Input)',
        'El navegador puede aceptar una salida inactiva: comprobá el medidor VAIO y la grabación de B1',
        'Detener, restaurar micrófono o cambiar salida cancela el disparo pendiente sin fallback',
      ] }],
    },
    en: {
      title: '🔊 Greetings: selected output and safe cancellation',
      intro: 'v4.108.2 — Direct playback now binds the selected VB out before playing. Stop or an output change cancels pending greetings, including fallback playback. Caller delivery still needs verification on your equipment.',
      sections: [{ heading: 'What changed', bullets: [
        'Every greeting resumes + setSinkId to VB out (Voicemeeter Input / CABLE Input)',
        'A browser can accept an inactive output: check the VAIO meter and a B1 recording',
        'Stop, Restore Mic, or an output change cancels pending playback without fallback',
      ] }],
    },
  },
  {
    version: '4.105.1',
    id: 'voicemeeter-naming-call-ok-v1',
    highlightElementIds: ['audio-route-sink-select'],
    es: {
      title: '🎙️ Nombres Voicemeeter nuevos + CALL OK que no caduca con la franja horaria',
      intro: "v4.105.1 — Tu Voicemeeter nombra los dispositivos 'Voicemeeter In 1/2' y captura los buses como 'Out B1/B2': la app ahora los reconoce (In 1 = VAIO estándar; Out B1/B2 válidos para STT). Y el CALL OK ya no se invalida solo porque cambió la franja horaria del saludo — morning/afternoon/evening comparten la misma prueba. Si un disparo no llega al sink, avisa LOCAL ONLY persistente.",
      sections: [{ heading: 'Qué cambió', bullets: [
        "Se reconoce 'Voicemeeter In 1' como el endpoint VAIO estándar (antes: solo 'Voicemeeter Input')",
        "STT admite 'Voicemeeter Out B1/B2' (los buses virtuales; A1-A5 siguen sin ser STT)",
        'CALL OK sobrevive el rotado de franja (morning/afternoon/evening comparten prueba)',
        'Disparo bloqueado = aviso LOCAL ONLY persistente, nunca parece que llegó al paciente',
      ] }],
    },
    en: {
      title: '🎙️ New Voicemeeter naming + CALL OK that survives slot rollover',
      intro: "v4.105.1 — Your Voicemeeter names devices 'Voicemeeter In 1/2' and captures buses as 'Out B1/B2': the app now recognizes them (In 1 = standard VAIO; Out B1/B2 valid for STT). And CALL OK no longer voids just because the greeting's time-of-day slot changed — morning/afternoon/evening share one proof. A fire that never reaches the sink shows a persistent LOCAL ONLY notice.",
      sections: [{ heading: 'What changed', bullets: [
        "'Voicemeeter In 1' recognized as the standard VAIO endpoint (before: only 'Voicemeeter Input')",
        "STT accepts 'Voicemeeter Out B1/B2' (virtual buses; A1-A5 still not STT)",
        'CALL OK survives slot rollover (morning/afternoon/evening share one proof)',
        'Denied fire = persistent LOCAL ONLY notice, never looks patient-delivered',
      ] }],
    },
  },
  {
    version: '4.105.0',
    id: 'recording-disk-backup-v1',
    highlightElementIds: ['sb-download-recordings', 'sb-upload-recordings'],
    es: {
      title: '💾 Respaldo de grabaciones a disco — archivos nombrados por ranura',
      intro: "v4.105.0 — Las grabaciones vivían solo dentro del navegador (IndexedDB): un borrado de datos del sitio o cambiar entre localhost y el sitio en vivo las perdía. Ahora Studio tiene 'Download recordings': guarda cada clip como archivo real con el nombre de su ranura (greeting_en_morning.webm), y 'Upload recordings' los re-asigna leyendo ese nombre — sin diálogos ni adivinanzas. El mismo paquete de archivos restaura en localhost o en el sitio en vivo.",
      sections: [{ heading: 'Qué cambió', bullets: [
        "Botón 'Download recordings' en Studio: un archivo por clip (greeting_en_morning.webm, thumb_intake.png, bg_app.jpg)",
        "Botón 'Upload recordings': selecciona varios archivos y cada uno aterriza en su ranura por nombre de archivo",
        'Nombres desconocidos se saltan con aviso — basura nunca aterriza en una ranura',
        'Funciona igual en localhost y en el sitio en vivo (mismo nombre = misma ranura)',
        'El respaldo JSON (Export/Import backup) sigue disponible como alternativa de un solo archivo',
      ] }],
    },
    en: {
      title: '💾 Disk backup for recordings — files named by slot',
      intro: "v4.105.0 — Recordings lived only inside the browser (IndexedDB): clearing site data or switching between localhost and the live site lost them. Studio now has 'Download recordings': saves each clip as a real file named by its slot (greeting_en_morning.webm), and 'Upload recordings' re-assigns them by reading that name — no dialogs, no guessing. The same file set restores on localhost or the live site.",
      sections: [{ heading: 'What changed', bullets: [
        "'Download recordings' button in Studio: one file per clip (greeting_en_morning.webm, thumb_intake.png, bg_app.jpg)",
        "'Upload recordings' button: pick multiple files, each lands in its slot by filename",
        'Unknown filenames are skipped with a notice — junk never lands in a slot',
        'Works identically on localhost and the live site (same name = same slot)',
        'The JSON backup (Export/Import backup) stays available as a one-file alternative',
      ] }],
    },
  },
  {
    version: '4.104.0',
    id: 'caller-route-quality-v1',
    highlightElementIds: ['audio-route-sink-select'],
    es: {
      title: '🔊 Ruta caller en calidad profesional — audio directo al sink (Voicemeeter listo)',
      intro: 'v4.104.0 — El botón 📡 Caller sonaba "en lata": el clip se reproducía como stream EN VIVO sobre el elemento compartido del mic (sin buffer, se cortaba). Ahora el clip se renderiza directo al dispositivo de salida vía AudioContext.setSinkId: con buffer, a 48 kHz, sin swaps. También: VB out acepta Voicemeeter Input (auto-pick lo prefiere sobre CABLE Input) y los avisos ya no dicen solo "VB-Cable".',
      sections: [{ heading: 'Qué cambió', bullets: [
        'Caller/Call Test: render directo al sink (con buffer) — se acabó el choppy "lata de atún"',
        'Un solo AudioContext persistente a 48 kHz por dispositivo — sin apertura/cierre por clip',
        'El mic se silencia durante el clip igual que antes, pero sin intercambio de stream (sin clics)',
        'VB out ahora admite Voicemeeter Input / AUX / VAIO3; auto-pick prefiere Voicemeeter Input > CABLE Input',
        'Fallback intacto: si el navegador no soporta setSinkId, se usa la ruta anterior',
        'Una vez: corre Call Test de nuevo tras cambiar el sink (CALL OK se liga al dispositivo)',
      ] }],
    },
    en: {
      title: '🔊 Caller route at professional quality — direct-to-sink audio (Voicemeeter ready)',
      intro: "v4.104.0 — The 📡 Caller button sounded 'in a can': the clip played as a LIVE stream over the shared mic element (no buffer, chopy). The clip now renders straight to the output device via AudioContext.setSinkId: buffered, 48 kHz, no swaps. Also: VB out accepts Voicemeeter Input (auto-pick prefers it over CABLE Input) and notices no longer say only 'VB-Cable'.",
      sections: [{ heading: 'What changed', bullets: [
        'Caller/Call Test: buffered direct-to-sink render — the choppy "can of tuna" is gone',
        'One persistent 48 kHz AudioContext per device — no per-clip open/close churn',
        'Mic still ducks during the clip, but without stream swaps (no clicks)',
        'VB out now accepts Voicemeeter Input / AUX / VAIO3; auto-pick prefers Voicemeeter Input > CABLE Input',
        'Fallback intact: without setSinkId support the previous path is used',
        'One-time: re-run Call Test after changing the sink (CALL OK is bound to the device)',
      ] }],
    },
  },
  {
    version: '4.103.1',
    id: 'hud-meter-crop-hotfix-v1',
    highlightElementIds: ['compact-call-goal-meter'],
    es: {
      title: '🔧 Hotfix HUD: el medidor ON/OFF/LEFT ya no se corta a mitad',
      intro: 'v4.103.1 — En ventanas ≤900px el encabezado en llamada tenía un tope de 88px que cortaba la fila del medidor (ON/OFF/LEFT + $) por la mitad. Ahora esa fila entra completa. Incluye además los saludos por franja horaria (AM/PM/Eve) y el dedup open_lep del soundboard.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'El medidor del día se ve completo en llamada, sin recorte vertical',
        'Saludos del soundboard según la hora: buenos días/tardes/noches automáticos',
        '"Opener – LEP" duplicado retirado (usa Opener – LEP (ES))',
        'Grabación con legibilidad baja: avisa pero NO bloquea — disparar el saludo es tu decisión',
        'Botón Soundboard siempre visible fuera de llamada, en la línea de chips del I/O',
      ] }],
    },
    en: {
      title: '🔧 HUD hotfix: ON/OFF/LEFT meter no longer half-cropped',
      intro: 'v4.103.1 — On windows ≤900px the in-call header had an 88px cap that cut the goal-meter row (ON/OFF/LEFT + $) in half. The row now fits fully. Also ships soundboard time-of-day greetings (AM/PM/Eve) and the open_lep dedup.',
      sections: [{ heading: 'What changed', bullets: [
        'In-call goal meter is fully visible again — no vertical clipping',
        'Soundboard greetings follow the time of day: good morning/afternoon/evening',
        'Duplicate "Opener – LEP" retired (use Opener – LEP (ES))',
        'Weak/failed legibility now warns but never blocks firing — your call',
        'Soundboard button always visible off-call on the I/O chips line',
      ] }],
    },
  },
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
    id: 'fresh-text-zap-always-v1',
    highlightElementIds: ['audio-route-zap-btn'],
    es: {
      title: '🔌 TEXT ✓ solo con datos frescos · ZAP siempre disponible',
      intro: 'v4.101.0 — TEXT ✓ ahora significa que llegó texto en los últimos 30s; con sockets calientes pero sin datos ves DG EN/ES (idle), no un TEXT mentiroso. ZAP reaparece siempre que Deepgram esté conectado pero sin datos (en llamada o fuera), y en error.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'TEXT ✓ = datos de los últimos 30s, no "alguna vez"',
        'ZAP visible en cualquier estancamiento conectado, también fuera de llamada',
      ] }],
    },
    en: {
      title: '🔌 TEXT ✓ only with fresh data · ZAP always available',
      intro: 'v4.101.0 — TEXT ✓ now means text arrived in the last 30s; warm sockets with no data show DG EN/ES (idle) instead of a lying TEXT. ZAP reappears whenever Deepgram is connected but stale — in-call or off-call — and on error.',
      sections: [{ heading: 'What changed', bullets: [
        'TEXT ✓ = data within the last 30s, not "at some point"',
        'ZAP visible on any connected stall, off-call included',
      ] }],
    },
  },
  {
    version: '4.103.0',
    id: 'soundboard-dedup-slotscripts-v1',
    highlightElementIds: ['workspace-soundboard-pane'],
    es: {
      title: '🎙 Soundboard: sin duplicados · guiones AM/PM/Eve · sin rojo',
      intro: 'v4.103.0 — Dediuplicado: el LEP Open en inglés se jubiló (el saludo al LEP va en su idioma; tu grabación migró a Opener – LEP (ES) AM). Los guiones de los saludos ahora cambian con la hora: el de la tarde dice "Buenas tardes / Good afternoon". Tiles no grabados en gris, EN verde, ES azul — nada en rojo.',
      sections: [{ heading: 'Qué cambió', bullets: [
        'open_lep (LEP Open) jubilado; grabación migrada a Opener – LEP (ES) si no había ninguna',
        'Guiones por franja: AM dice "Good morning", PM "Good afternoon", Eve "Good evening" (ES: buenos días/tardes/noches)',
        'Barra de saludos fija a la derecha (sobre las notas): dispara clips sin entrar al Studio; el gato pulsa en ámbar = clic para volver al trabajo',
        'En llamada: la barra de saludos vive sobre la transcripción — nunca pierdes de vista el texto',
        'El guion se ve en el tile antes de grabar, y en la tarjeta al grabar',
        'Colores: no grabado = gris, EN = verde, ES = azul; sin rojo en el soundboard',
        'Ajustes → Audio: 3 selectores de dispositivos — mic de transcripción, mic de grabación de saludos (propio, p.ej. Realtek), salida de reproducción',
      ] }],
    },
    en: {
      title: '🎙 Soundboard: deduped · AM/PM/Eve scripts · no red',
      intro: 'v4.103.0 — Deduped: the English-reading LEP Open is retired (the LEP greeting is delivered in the LEP language; your recording migrated to Opener – LEP (ES) AM). Greeting scripts now follow the time of day: the afternoon one says "Good afternoon". Unrecorded tiles are gray, EN green, ES blue — no red.',
      sections: [{ heading: 'What changed', bullets: [
        'open_lep (LEP Open) retired; recording migrated to Opener – LEP (ES) if you had none',
        'Slot scripts: AM says "Good morning", PM "Good afternoon", Eve "Good evening" (ES: buenos días/tardes/noches)',
        'Greetings dock fixed on the right (above notes): fire clips without entering the Studio; the cat pulses amber = click to get back to work',
        'In-call: the greetings strip lives above the transcript — you never lose sight of the text',
        'Script preview right on the tile before recording, and on the card while recording',
        'Colors: unrecorded = gray, EN = green, ES = blue; no red in the soundboard',
        'Settings → Audio: 3 device selectors — call transcription mic, greeting recording mic (own pick, e.g. Realtek), greeting playback output',
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
    highlightElementIds: ['sb-soundcheck-line'],
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
    highlightElementIds: ['sb-soundcheck-line'],
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
