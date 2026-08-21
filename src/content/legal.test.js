import { LEGAL_CONTACT, LEGAL_SECTIONS, LEGAL_VERSION } from './legal';

describe('legal content', () => {
  test('exposes a semver version', () => {
    expect(LEGAL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('contains the four required sections in stable order', () => {
    expect(LEGAL_SECTIONS.map((s) => s.id)).toEqual([
      'terms',
      'privacy',
      'disclaimer',
      'data',
    ]);
  });

  test('every section has a title and non-empty blocks', () => {
    for (const section of LEGAL_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.blocks.length).toBeGreaterThan(0);
      for (const block of section.blocks) {
        expect(['p', 'ul', 'h']).toContain(block.type);
        if (block.type === 'ul') {
          expect(block.items.length).toBeGreaterThan(0);
        } else {
          expect(block.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('terms cover the load-bearing promises', () => {
    const terms = JSON.stringify(LEGAL_SECTIONS.find((s) => s.id === 'terms'));
    // BYOK disclosure — the product never bills or proxies third-party APIs.
    expect(terms).toMatch(/bring-your-own-key/i);
    // No-warranty + STT imperfection disclaimer.
    expect(terms).toMatch(/as is/i);
    expect(terms).toMatch(/imperfect/i);
  });

  test('privacy policy matches actual data flows', () => {
    const privacy = JSON.stringify(LEGAL_SECTIONS.find((s) => s.id === 'privacy'));
    // Local-first: transcripts stay on device.
    expect(privacy).toMatch(/IndexedDB/i);
    // Third-party egress is user-keyed.
    expect(privacy).toMatch(/Deepgram/i);
    // Cloud sync is prefs-only.
    expect(privacy).toMatch(/no transcripts/i);
    expect(privacy).toMatch(/no API keys/i);
  });

  test('disclaimer states not-a-medical-device and interpreter responsibility', () => {
    const disclaimer = JSON.stringify(LEGAL_SECTIONS.find((s) => s.id === 'disclaimer'));
    expect(disclaimer).toMatch(/NOT a medical device/i);
    expect(disclaimer).toMatch(/solely responsible|remains fully responsible/i);
  });

  test('contact block is present', () => {
    expect(LEGAL_CONTACT.email).toMatch(/@/);
    expect(LEGAL_CONTACT.owner.length).toBeGreaterThan(0);
  });
});
