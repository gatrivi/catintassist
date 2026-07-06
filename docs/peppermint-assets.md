# Peppermint assets

Generated mascot assets for CatIntAssist.

## Saved in repo

- `src/assets/peppermintAssets.js`
  - `appIconSvg` — main Peppermint app icon.
  - `breakIconSvg` — break/coffee mug icon.
  - `guideConnectSvg` — “Tap Connect to start.”
  - `guideBreakSvg` — “Tap Break off-call.”
  - `guideGoalsSvg` — “Goals + Notes stay handy.”
  - `guideHelpSvg` — “Tap me for help.”
  - `PEPPERMINT_NAV_SPEC` — intended header/nav mapping.

## Intended UI mapping

Left header buttons:

1. Peppermint app icon — always visible, upper-left.
2. Connect.
3. Break.
4. Goals.
5. Notes.

Right header buttons:

1. Language.
2. Key.
3. Logoff — two-tap confirmation to prevent misclicks.
4. Settings.

## Safety notes

- Do not hide the app icon behind responsive collapse.
- Do not let Break replace Connect.
- Keep Logoff two-tap only.
- Use celebratory proportional sound for goals/break wins; keep it gentle during live calls.

## Local follow-up

The generated PNG/GIF masters are not committed here because this tool path writes text safely. The repo now has SVG/data-URI assets that can be imported immediately. For production polish, decode or replace these with real PNG/WebP files under:

```txt
public/icons/peppermint-app-icon.png
public/icons/peppermint-break-icon.png
public/icons/ppm-guide-connect.png
public/icons/ppm-guide-break.png
public/icons/ppm-guide-goals.png
public/icons/ppm-guide-help.png
public/icons/ppm-speaking.gif
```

Then wire:

```html
<link rel="icon" href="/icons/peppermint-app-icon.png" />
<link rel="apple-touch-icon" href="/icons/peppermint-app-icon.png" />
```
