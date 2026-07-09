# Electron / Tauri — not used here

## Official
- Electron: https://www.electronjs.org/docs/latest
- Tauri: https://v2.tauri.app/

## This repo
**No desktop shell.** CatIntAssist runs as a browser (CRA) web app.
- Do not invent `ipcRenderer` / Tauri `invoke` bridges
- Audio/device quirks are browser + OS virtual-mic (e.g. Voicemod), not Electron
