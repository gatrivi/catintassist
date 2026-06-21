import { createDevCaption, DEV_SIM_PRESETS } from './devSimulateCaptions';

describe('createDevCaption', () => {
  it('builds EN bubble with text and lang', () => {
    const cap = createDevCaption({ text: 'Hello world.', lang: 'en' });
    expect(cap.text).toContain('Hello');
    expect(cap.lang).toBe('en');
    expect(cap.isFinal).toBe(true);
    expect(cap.enFinalized).toBeTruthy();
  });

  it('stores mock translation when provided', () => {
    const cap = createDevCaption({
      text: 'Test.',
      lang: 'en',
      mockTranslation: 'Prueba.',
    });
    expect(cap._devMockTranslation).toBe('Prueba.');
  });
});

describe('DEV_SIM_PRESETS', () => {
  it('includes split and phone scenarios', () => {
    expect(DEV_SIM_PRESETS.phone_digits).toBeDefined();
    expect(DEV_SIM_PRESETS.split_same_turn.steps.length).toBeGreaterThan(1);
  });
});
