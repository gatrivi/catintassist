# Novedades / What's new (v4.84.20)

Modal bilingüe en la app (ES por defecto, toggle EN). Docs estáticas aquí.

**Código:** `src/content/releaseNotes.js` · **UI:** `ReleaseNotesModal` · **Reabrir:** `window.catintShowReleaseNotes()` en consola

---

## Español (predeterminado)

### Ruta VB-Cable + respaldo por pestaña

Al cargar **v4.84.20** (fuera de llamada) verás un resumen con toggle **ES | EN**.

| Botón | Ubicación | Función |
|--------|-----------|---------|
| **VB Cable** | Barra I/O del encabezado | Activa STT por cable. **VB ON** = seleccionado · **VB ✓** = conectado |
| **Tab** | Misma barra | STT por compartir pestaña · **Tab ✓** = audio adjunto |
| **→ Tab** | Solo en modo cable | Respaldo en vivo: cambia a pestaña y abre el selector |
| **📥 Cable in** | Modo cable | CABLE Output → Deepgram |
| **🔊 VB out** | Siempre | CABLE Input → paciente (saludos/TTS) |
| **More → Test VB out** | Panel expandido | Tono de prueba por la ruta del paciente |

### Flujo recomendado

1. Pulsa **VB Cable** (resaltado naranja **VB ON**).
2. Confirma **📥** y **🔊** (auto-detectan CABLE si Windows muestra nombres).
3. **Connect** → badge **Cable STT** verde.
4. ¿Falla el cable? **→ Tab** (un clic).
5. ¿Cancelaste el selector de pestaña? Mensaje tranquilo — sin error rojo.

### Modal — tres acciones

| Acción | Efecto |
|--------|--------|
| **Entendido** | No volver a mostrar esta versión; los botones relevantes **brillan** ~45 s |
| **Ver después** | Ocultar 24 h |
| **No mostrar de nuevo** | Nunca más este resumen (id `vb-cable-route-ux-v1`) |

### Respaldo sin depender de la app

Ver [`audio-routing-no-spof.md`](../development/audio-routing-no-spof.md): plataforma → CABLE Input; escuchar CABLE Output en audífonos.

### Al publicar una versión nueva

1. Subir `APP_VERSION` en `src/constants/version.js` + `package.json`.
2. Añadir entrada en `src/content/releaseNotes.js` (es + en + `highlightElementIds`).
3. Opcional: ampliar este doc.

---

## English

### VB-Cable route + tab fallback

On load of **v4.84.20** (off-call) you get a summary modal with **ES | EN** toggle (Spanish default).

| Button | Location | Role |
|--------|----------|------|
| **VB Cable** | Header I/O strip | Virtual-cable STT · **VB ON** / **VB ✓** |
| **Tab** | Same strip | Tab-share STT · **Tab ✓** when attached |
| **→ Tab** | Cable mode only | Live fallback → tab picker |
| **📥 Cable in** | Cable mode | CABLE Output → Deepgram |
| **🔊 VB out** | Always | CABLE Input → patient path |
| **More → Test VB out** | Expanded panel | Test tone on patient route |

### Recommended flow

1. Tap **VB Cable** (**VB ON** orange).
2. Check **📥** and **🔊** (auto-pick when labeled).
3. **Connect** → green **Cable STT**.
4. Cable fails? **→ Tab**.
5. Cancelled tab picker? Calm message — no red error state.

### Modal actions

| Action | Effect |
|--------|--------|
| **Got it** | Dismiss this version; highlight target buttons ~45 s |
| **Show later** | Snooze 24 h |
| **Don't show again** | Never show this note id again |

### OS-level backup

See [`audio-routing-no-spof.md`](../development/audio-routing-no-spof.md).

### Shipping a new release note

1. Bump `APP_VERSION`.
2. Add catalog entry in `src/content/releaseNotes.js`.
3. Update this file if needed.
