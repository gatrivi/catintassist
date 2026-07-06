import {
  buildPaletteFromRgb,
  parseCssBackgroundUrl,
  rgbToHex,
  rgbToHsl,
} from './themePalette';

describe('themePalette', () => {
  test('rgbToHex clamps and formats', () => {
    expect(rgbToHex(56, 189, 248)).toBe('#38bdf8');
    expect(rgbToHex(-1, 300, 16)).toBe('#00ff10');
  });

  test('rgbToHsl detects saturated color', () => {
    const hsl = rgbToHsl(56, 189, 248);
    expect(hsl.s).toBeGreaterThan(0.7);
    expect(hsl.l).toBeGreaterThan(0.5);
  });

  test('buildPaletteFromRgb returns css variable-ready values', () => {
    const p = buildPaletteFromRgb(56, 189, 248);
    expect(p.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.panel).toMatch(/^rgba\(/);
    expect(p.border).toContain('0.24');
  });

  test('parseCssBackgroundUrl extracts first url', () => {
    expect(parseCssBackgroundUrl('url("/bg/cat.jpg")')).toBe('/bg/cat.jpg');
  });
});
