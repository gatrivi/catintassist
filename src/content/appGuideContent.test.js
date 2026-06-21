import {
  GUIDE_STEP_IDS,
  getGuideSteps,
  GUIDE_UI,
} from './appGuideContent';

describe('appGuideContent', () => {
  test('en and es have same step count and ids', () => {
    const en = getGuideSteps('en');
    const es = getGuideSteps('es');
    expect(en.length).toBe(es.length);
    expect(en.length).toBe(GUIDE_STEP_IDS.length);
    en.forEach((step, i) => {
      expect(step.id).toBe(GUIDE_STEP_IDS[i]);
      expect(es[i].id).toBe(step.id);
      expect(step.title).toBeTruthy();
      expect(es[i].title).toBeTruthy();
      expect(step.body).toBeTruthy();
      expect(es[i].body).toBeTruthy();
    });
  });

  test('each step has target string or null', () => {
    getGuideSteps('en').forEach((step) => {
      expect(step.target === null || typeof step.target === 'string').toBe(true);
    });
  });

  test('GUIDE_UI has en and es labels', () => {
    expect(GUIDE_UI.en.done).toBe('Done');
    expect(GUIDE_UI.es.done).toBe('Listo');
  });
});
