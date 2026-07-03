# Audio Greeting Editor — export pack

**Origen CatIntAssist v4.77.0** — copia lista para otra app React. **No modifica** el código de CatIntAssist.

## Qué incluye

| Archivo | Rol |
|---------|-----|
| `AudioEditorPanel.jsx` | Editor completo: waveform, play, crop, silencios, re-grabación |
| `WaveformCanvas.jsx` | Canvas de barras interactivo (selección, playhead, zonas rojas) |
| `ClipWaveform.jsx` | Mini waveform SVG para listas (con progreso de playback) |
| `audioEditorCore.js` | Lógica pura: peaks, silencios, splice, WAV export |
| `audioProcessing.js` | Cadena Web Audio (EQ + compresor + noise gate) |
| `waveformPeaks.js` | `buildWaveformPeaks(blob)` para thumbnails |
| `audio-greeting-editor.css` | Estilos mínimos (prefijo `age-`) |

## Origen en CatIntAssist

```
src/components/AudioEditorPanel.js   → editor + canvas + utils inline
src/components/GreetingsPanel.js     → ClipWaveform + buildWaveformPeaks
src/utils/audioProcessing.js         → cadena de voz
```

## Uso mínimo (otra app React)

```jsx
import AudioEditorPanel from './exports/audio-greeting-editor/src/AudioEditorPanel.jsx';
import './exports/audio-greeting-editor/audio-greeting-editor.css';

function MyEditor({ blob, onSaved }) {
  return (
    <AudioEditorPanel
      blob={blob}
      label="Mi saludo"
      localVolume={1}
      onSave={async (editedBlob) => {
        // editedBlob = audio/wav
        await saveToYourStorage(editedBlob);
        onSaved();
      }}
      onClose={() => {}}
    />
  );
}
```

## Mini waveform en lista de clips

```jsx
import { ClipWaveform, buildWaveformPeaks } from './exports/audio-greeting-editor';

const [peaks, setPeaks] = useState(null);
useEffect(() => {
  buildWaveformPeaks(blob, 56).then(setPeaks);
}, [blob]);

<ClipWaveform peaks={peaks} progress={0.4} height={28} />
```

## Solo lógica (sin UI)

```js
import {
  detectSilences,
  spliceAudioBuffer,
  removeSilenceRegions,
  audioBufferToBlob,
} from './exports/audio-greeting-editor/src/audioEditorCore.js';

const ctx = new AudioContext();
const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
const silences = detectSilences(buf); // [{ start, end }] en segundos
const trimmed = removeSilenceRegions(ctx, buf, silences);
const outBlob = await audioBufferToBlob(trimmed);
```

## Funciones del editor

| Acción | Cómo |
|--------|------|
| Ver waveform | `buildEditorPeaks(channel, 680)` → `WaveformCanvas` |
| Seleccionar región | Arrastrar en canvas (pointer events) |
| Play todo / selección | Botones Play + checkbox "Selection only" |
| Recortar | Crop to selection |
| Borrar tramo | Delete selection (`spliceAudioBuffer` con `replacement=null`) |
| Quitar silencios | RMS &lt; 0.015, ventana 20ms, mín 0.25s — zonas rojas |
| Re-grabar tramo | Selección → countdown 3s → mic → splice nuevo buffer |
| Exportar | `audioBufferToBlob` → WAV mono 16-bit |

## Cadena de audio (grabación / playback)

`createSpeechProcessingGraph`: highpass 80Hz → peaking 2.5k/4k → compresor → gain.

`createNoiseGate`: compresor como gate en grabación de reemplazo.

## Dependencias

- React 17+
- **Solo APIs del navegador**: Web Audio API, Canvas, MediaRecorder, getUserMedia
- Sin npm packages extra

## CSS en CatIntAssist (referencia)

Si integrás dentro de CatIntAssist sin el export, las clases originales están en `src/index.css`:

- `.clip-waveform`, `.sb-editor-overlay`, `.sb-editor-modal`

El export usa prefijo `age-` para no chocar.

## Modal (patrón GreetingsPanel)

```jsx
<div className="age-editor-overlay" role="dialog">
  <div className="age-editor-modal">
    <AudioEditorPanel blob={blob} onSave={...} onClose={...} />
  </div>
</div>
```

## Parámetros tunables

En `audioEditorCore.js` → `detectSilences(buffer, threshold, minDuration)`:

- `threshold` default `0.015` (RMS)
- `minDuration` default `0.25` s

## Licencia

Mismo repo que CatIntAssist — uso interno / spin-off del autor.
