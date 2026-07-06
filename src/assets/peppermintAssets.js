// CatIntAssist Peppermint visual assets.
// Text/SVG version saved safely through GitHub.
// Generated PNG masters remain in the ChatGPT artifact session.

const svgData = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const face = `
  <g id="peppermint-face" stroke="#07164f" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M170 204 L130 104 L218 158 Q256 134 294 158 L382 104 L342 204" fill="#2d292b"/>
    <path d="M151 125 L176 186 L124 162 Z" fill="#ffc6cd" stroke-width="5"/>
    <path d="M361 125 L336 186 L388 162 Z" fill="#ffc6cd" stroke-width="5"/>
    <circle cx="256" cy="261" r="132" fill="#2b2729"/>
    <path d="M256 142 C243 190 235 234 214 302 C230 358 282 358 298 302 C277 234 269 190 256 142 Z" fill="#ffffff" stroke="none"/>
    <path d="M243 152 C250 128 262 128 270 152 C263 165 251 166 243 152 Z" fill="#f6bd63" stroke="none"/>
    <path d="M141 250 C169 223 199 224 219 251" fill="none" stroke="#c99358" stroke-width="13" opacity=".9"/>
    <path d="M371 250 C343 223 313 224 293 251" fill="none" stroke="#c99358" stroke-width="13" opacity=".9"/>
    <path d="M178 176 C202 159 224 161 240 184" fill="none" stroke="#d8a05f" stroke-width="10" opacity=".85"/>
    <path d="M334 176 C310 159 288 161 272 184" fill="none" stroke="#d8a05f" stroke-width="10" opacity=".85"/>
    <ellipse cx="202" cy="260" rx="31" ry="39" fill="#e5e23d"/>
    <ellipse cx="310" cy="260" rx="31" ry="39" fill="#e5e23d"/>
    <ellipse cx="207" cy="260" rx="18" ry="27" fill="#07164f" stroke="none"/>
    <ellipse cx="315" cy="260" rx="18" ry="27" fill="#07164f" stroke="none"/>
    <circle cx="196" cy="242" r="8" fill="#fff" stroke="none"/>
    <circle cx="304" cy="242" r="8" fill="#fff" stroke="none"/>
    <path d="M235 316 Q256 292 277 316 Q256 338 235 316 Z" fill="#ff8ab5" stroke="none"/>
    <path d="M256 318 L256 341" fill="none"/>
    <path d="M256 341 Q235 365 214 341" fill="none"/>
    <path d="M256 341 Q277 365 298 341" fill="none"/>
    <path d="M151 315 C199 304 223 307 241 315" stroke="#fff" stroke-width="5" fill="none"/>
    <path d="M361 315 C313 304 289 307 271 315" stroke="#fff" stroke-width="5" fill="none"/>
    <path d="M149 338 C199 331 224 331 243 338" stroke="#b99cff" stroke-width="5" fill="none"/>
    <path d="M363 338 C313 331 288 331 269 338" stroke="#b99cff" stroke-width="5" fill="none"/>
  </g>`;

const headset = `
  <g id="headset" stroke="#07164f" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M158 210 C163 82 349 82 354 210"/>
    <path d="M126 238 C92 244 90 347 126 356" fill="#9b6cff"/>
    <path d="M386 238 C420 244 422 347 386 356" fill="#9b6cff"/>
    <path d="M386 354 C384 385 364 403 329 406"/>
    <path d="M306 402 h42" stroke-width="19"/>
  </g>`;

const shirt = `
  <g id="shirt" stroke="#b8c3d8" stroke-width="5" fill="#fff" stroke-linejoin="round">
    <path d="M138 512 C154 414 358 414 374 512 Z"/>
    <path d="M214 418 L256 486 L298 418" fill="#f8fafc"/>
    <path d="M204 421 L242 456 L218 489"/>
    <path d="M308 421 L270 456 L294 489"/>
  </g>`;

const mug = `
  <g id="coffee" stroke="#07164f" stroke-width="6" stroke-linejoin="round">
    <path d="M175 403 h150 v90 h-150 z" fill="#ff7a00"/>
    <ellipse cx="250" cy="403" rx="76" ry="18" fill="#ff9b26"/>
    <ellipse cx="250" cy="405" rx="60" ry="10" fill="#3a2018" stroke="none"/>
    <path d="M325 424 C374 416 374 478 325 468" fill="none"/>
    <path d="M225 382 C215 358 242 350 230 326" stroke="#ffffff" stroke-width="8" opacity=".45" fill="none"/>
    <path d="M269 382 C259 358 286 350 274 326" stroke="#ffffff" stroke-width="8" opacity=".45" fill="none"/>
  </g>`;

const bubble = (text) => `
  <g id="bubble">
    <path d="M316 48 h154 a20 20 0 0 1 20 20 v93 a20 20 0 0 1-20 20 h-37 l-42 38 10-38 h-85 a20 20 0 0 1-20-20 v-93 a20 20 0 0 1 20-20 z" fill="#fff" stroke="#07164f" stroke-width="6"/>
    <text x="393" y="94" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="28" text-anchor="middle" fill="#07164f">${text}</text>
  </g>`;

const baseSvg = ({ withMug = false, text = "" } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Peppermint CatIntAssist mascot">
  <rect x="18" y="18" width="476" height="476" rx="72" fill="#0055A4"/>
  ${shirt}
  ${headset}
  ${face}
  ${withMug ? mug : ""}
  ${text ? bubble(text) : ""}
</svg>`;

export const PEPPERMINT_ASSETS = {
  appIconSvg: svgData(baseSvg()),
  breakIconSvg: svgData(baseSvg({ withMug: true })),
  guideConnectSvg: svgData(baseSvg({ withMug: true, text: '<tspan x="393" dy="0">Tap Connect</tspan><tspan x="393" dy="34">to start.</tspan>' })),
  guideBreakSvg: svgData(baseSvg({ withMug: true, text: '<tspan x="393" dy="0">Tap Break</tspan><tspan x="393" dy="34">off-call.</tspan>' })),
  guideGoalsSvg: svgData(baseSvg({ withMug: true, text: '<tspan x="393" dy="0">Goals + Notes</tspan><tspan x="393" dy="34">stay handy.</tspan>' })),
  guideHelpSvg: svgData(baseSvg({ withMug: true, text: '<tspan x="393" dy="0">Tap me</tspan><tspan x="393" dy="34">for help.</tspan>' })),
};

export const PEPPERMINT_NAV_SPEC = {
  left: ['appIcon', 'connect', 'break', 'goals', 'notes'],
  right: ['language', 'key', 'logoffTwoTap', 'settings'],
  sound: 'celebratory-proportional-gentle',
};

export default PEPPERMINT_ASSETS;
