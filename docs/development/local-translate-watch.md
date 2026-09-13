# Local translator watch (v4.112.0)

One quiet tab replaces the 5-min Task Scheduler popup.

## Use

```
npm run local
```

- Checks `127.0.0.1:59200/health` every 30s, in THIS tab. No new windows, ever.
- If down: lifts hidden uvicorn inline (same lift as `catts/scripts/lift_catintassist.ps1`), waits 60s, smoke-tests EN->ES.
- Ctrl+C stops the watch; the API keeps running.
- Log tail: `E:\zengatrivi-drive-e\catts\data\cloud_agents\watch-local.log`
- Opts: `-IntervalSec 60` `-Port N` `-Once` (single check) `-CattsRoot <path>` (+`$env:CATTS_ROOT` / `$env:CATTS_API_PORT`).

## Retired

`\CatTS-API-Watchdog` (every 5 min `powershell -WindowStyle Hidden ... lift_catintassist.ps1`).
Hidden still flashes a console on interactive logon — that was the popup.
Disabled 2026-09-13. Re-enable: `schtasks /change /tn "CatTS-API-Watchdog" /enable`.
Do NOT re-enable while `npm run local` runs (both lifting = harmless but redundant).

## Later: app lifts its own backend

Browser JS cannot spawn processes, so "catintassist lifts it" needs a helper outside the page:

- **A. Desktop wrapper (recommended end-state):** Tauri/Electron shell; uvicorn becomes a sidecar process the app starts/stops. Real "desktop application".
- **B. Installed supervisor (cheap interim):** one-time `sc.exe create CatTS-Translator ...` Windows service (or Hidden scheduled task AT LOGON, not every 5 min) running the same lift loop with no window, independent of any tab.
- **C. Keep the tab:** costs nothing, user already lives in tabs. Valid until A/B.

Pick B when the tab gets annoying; pick A when packaging for others.

## Gotcha (PS 5.1)

BOM-less `.ps1` + any non-ASCII char (even an em-dash in a comment) = bogus
`The string is missing the terminator: "` surfacing lines AFTER the real spot.
Rule: keep `scripts/*.ps1` pure ASCII. (v4.112.0 burned 20 min on this.)
