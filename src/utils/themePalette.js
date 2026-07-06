export const THEME_PALETTE_KEY = 'catint_theme_palette_v1';

export const THEME_PALETTES = {
  clinical: {
    id: 'clinical',
    name: 'Clinical',
    accent: '#38bdf8',
    accentHover: '#7dd3fc',
    panel: 'rgba(7, 14, 35, 0.64)',
    border: 'rgba(56, 189, 248, 0.20)',
    glow1: 'rgba(56, 189, 248, 0.18)',
    glow2: 'rgba(16, 185, 129, 0.12)',
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    accent: '#6ee7b7',
    accentHover: '#a7f3d0',
    panel: 'rgba(6, 32, 38, 0.68)',
    border: 'rgba(110, 231, 183, 0.22)',
    glow1: 'rgba(34, 197, 94, 0.16)',
    glow2: 'rgba(56, 189, 248, 0.10)',
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    accent: '#fca5a5',
    accentHover: '#fecaca',
    panel: 'rgba(15, 23, 42, 0.72)',
    border: 'rgba(148, 163, 184, 0.22)',
    glow1: 'rgba(148, 163, 184, 0.14)',
    glow2: 'rgba(59, 130, 246, 0.10)',
  },
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s, l };
};

export const hslToRgb = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
};

export const buildPaletteFromRgb = (r, g, b) => {
  const { h, s, l } = rgbToHsl(r, g, b);
  const sat = clamp(Math.max(s, 0.45), 0.45, 0.72);
  const accentRgb = hslToRgb(h, sat, 0.68);
  const hoverRgb = hslToRgb(h, clamp(sat + 0.08, 0.45, 0.82), 0.78);
  const glowRgb = hslToRgb(h, sat, 0.55);
  return {
    id: 'derived',
    name: 'Background',
    accent: rgbToHex(...accentRgb),
    accentHover: rgbToHex(...hoverRgb),
    panel: `rgba(${Math.round(r * 0.12)}, ${Math.round(g * 0.12)}, ${Math.round(b * 0.12)}, 0.72)`,
    border: `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.24)`,
    glow1: `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, 0.18)`,
    glow2: `rgba(${hoverRgb[0]}, ${hoverRgb[1]}, ${hoverRgb[2]}, 0.10)`,
    sourceLuma: Number(l.toFixed(3)),
  };
};

export const applyThemePalette = (palette) => {
  if (!palette || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', palette.accent);
  root.style.setProperty('--accent-hover', palette.accentHover || palette.accent);
  root.style.setProperty('--accent-glow', palette.glow1 || 'rgba(56, 189, 248, 0.18)');
  root.style.setProperty('--panel-bg', palette.panel);
  root.style.setProperty('--panel-border', palette.border);
  root.style.setProperty('--glow-1', palette.glow1);
  root.style.setProperty('--glow-2', palette.glow2);
};

export const saveThemePalette = (palette) => {
  if (!palette) return palette;
  try {
    localStorage.setItem(THEME_PALETTE_KEY, JSON.stringify(palette));
  } catch (_) {}
  applyThemePalette(palette);
  try {
    window.dispatchEvent(new CustomEvent('catint_theme_palette_changed', { detail: palette }));
  } catch (_) {}
  return palette;
};

export const loadThemePalette = () => {
  try {
    const raw = localStorage.getItem(THEME_PALETTE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return THEME_PALETTES.clinical;
};

export const parseCssBackgroundUrl = (backgroundImage) => {
  const match = String(backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/);
  return match ? match[1] : '';
};

export const derivePaletteFromImageUrl = (url) =>
  new Promise((resolve, reject) => {
    if (!url || typeof Image === 'undefined') {
      reject(new Error('No background image found'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 48;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let best = { score: -1, r: 56, g: 189, b: 248 };
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const { s, l } = rgbToHsl(r, g, b);
        if (l < 0.16 || l > 0.86) continue;
        const score = s * 1.4 + (1 - Math.abs(l - 0.48));
        if (score > best.score) best = { score, r, g, b };
      }
      resolve(buildPaletteFromRgb(best.r, best.g, best.b));
    };
    img.onerror = () => reject(new Error('Could not read background image'));
    img.src = url;
  });
