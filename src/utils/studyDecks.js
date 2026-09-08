/**
 * Study cue cards (v4.88.0) — glossary flashcards shown between calls + on hold.
 * Sources: LanguagesCX glossary seeds below; full deck can be pasted/extended here.
 * Spaced repetition deferred — cards carry optional `difficulty` field for later.
 */

export const STUDY_DOMAINS = [
  { id: 'all', label: 'All' },
  { id: 'auto', label: 'Auto' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'education', label: 'Education' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'financial', label: 'Financial' },
  { id: 'social', label: 'Social' },
  { id: 'medical', label: 'Medical' },
];

/**
 * Card shapes:
 *  glossary { type, domain, en, es }
 *  nosay    { type, domain, wrong, right, note? }   — never say X, always say Y
 *  acronym  { type, domain, abbr, expansion, es }
 *  qa       { type, domain:'general', text }        — always shown in any domain
 */
export const STUDY_CARDS = [
  // ── NO-SAY (high value) ──────────────────────────────────────────────
  { type: 'nosay', domain: 'insurance', wrong: 'aseguranza', right: 'seguro', note: 'Spanglish — patients understand "seguro".' },
  { type: 'nosay', domain: 'insurance', wrong: 'enrolarse', right: 'inscribirse', note: 'Enroll = inscribirse.' },
  { type: 'nosay', domain: 'general', wrong: 'tú / tú-forms', right: 'usted / usted-forms', note: 'Always formal register.' },
  { type: 'nosay', domain: 'general', wrong: 'third person ("he says…")', right: 'first person', note: 'Interpret in first person.' },

  // ── QA reminders ─────────────────────────────────────────────────────
  { type: 'qa', domain: 'general', text: 'First person — interpret "I", never "he/she says".' },
  { type: 'qa', domain: 'general', text: 'No fillers: um, uh, like, you know, bueno, pues — drop them.' },
  { type: 'qa', domain: 'general', text: 'Everything: interpret everything, add nothing, omit nothing.' },
  { type: 'qa', domain: 'general', text: 'Protected tokens (phones, doses, money) — read digit-grouped, never paraphrase.' },

  // ── Insurance ────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'insurance', en: 'insurance policy', es: 'póliza de seguro' },
  { type: 'glossary', domain: 'insurance', en: 'deductible', es: 'deducible' },
  { type: 'glossary', domain: 'insurance', en: 'premium', es: 'prima' },
  { type: 'glossary', domain: 'insurance', en: 'copay', es: 'copago' },
  { type: 'glossary', domain: 'insurance', en: 'claim', es: 'reclamación' },
  { type: 'glossary', domain: 'insurance', en: 'coverage', es: 'cobertura' },
  { type: 'glossary', domain: 'insurance', en: 'policyholder', es: 'titular de la póliza' },
  { type: 'glossary', domain: 'insurance', en: 'beneficiary', es: 'beneficiario' },

  // ── Auto ─────────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'auto', en: 'driver’s license', es: 'licencia de conducir' },
  { type: 'glossary', domain: 'auto', en: 'airbag', es: 'bolsa de aire' },
  { type: 'glossary', domain: 'auto', en: 'seat belt', es: 'cinturón de seguridad' },
  { type: 'glossary', domain: 'auto', en: 'fender bender', es: 'choque leve' },
  { type: 'glossary', domain: 'auto', en: 'tow truck', es: 'grúa' },
  { type: 'glossary', domain: 'auto', en: 'traffic ticket', es: 'multa de tránsito' },
  { type: 'glossary', domain: 'auto', en: 'roadside assistance', es: 'asistencia en carretera' },

  // ── Education ────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'education', en: 'enrollment', es: 'inscripción' },
  { type: 'glossary', domain: 'education', en: 'tuition', es: 'colegiatura / matrícula' },
  { type: 'glossary', domain: 'education', en: 'transcript', es: 'expediente académico' },
  { type: 'glossary', domain: 'education', en: 'financial aid', es: 'ayuda financiera' },
  { type: 'glossary', domain: 'education', en: 'parent-teacher conference', es: 'reunión de padres y maestros' },

  // ── Utilities ────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'utilities', en: 'utility bill', es: 'recibo de servicios' },
  { type: 'glossary', domain: 'utilities', en: 'power outage', es: 'apagón / corte de luz' },
  { type: 'glossary', domain: 'utilities', en: 'late fee', es: 'cargo por mora' },
  { type: 'glossary', domain: 'utilities', en: 'meter reading', es: 'lectura del medidor' },
  { type: 'glossary', domain: 'utilities', en: 'shut-off notice', es: 'aviso de corte de servicio' },

  // ── Financial ────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'financial', en: 'interest rate', es: 'tasa de interés' },
  { type: 'glossary', domain: 'financial', en: 'loan', es: 'préstamo' },
  { type: 'glossary', domain: 'financial', en: 'credit score', es: 'historial crediticio' },
  { type: 'glossary', domain: 'financial', en: 'overdraft', es: 'sobregiro' },
  { type: 'glossary', domain: 'financial', en: 'direct deposit', es: 'depósito directo' },
  { type: 'glossary', domain: 'financial', en: 'wage garnishment', es: 'embargo de salario' },

  // ── Social services ──────────────────────────────────────────────────
  { type: 'glossary', domain: 'social', en: 'food stamps (SNAP)', es: 'cupones de alimentos' },
  { type: 'glossary', domain: 'social', en: 'welfare', es: 'asistencia pública' },
  { type: 'glossary', domain: 'social', en: 'foster care', es: 'hogar de guarda' },
  { type: 'glossary', domain: 'social', en: 'child support', es: 'pensión alimenticia' },
  { type: 'glossary', domain: 'social', en: 'disability benefits', es: 'beneficios por discapacidad' },

  // ── Medical ──────────────────────────────────────────────────────────
  { type: 'glossary', domain: 'medical', en: 'prescription', es: 'receta médica' },
  { type: 'glossary', domain: 'medical', en: 'dosage', es: 'dosis' },
  { type: 'glossary', domain: 'medical', en: 'primary care physician', es: 'médico de atención primaria' },
  { type: 'glossary', domain: 'medical', en: 'referral', es: 'remisión / referencia médica' },
  { type: 'glossary', domain: 'medical', en: 'copay exemption', es: 'exención de copago' },

  // ── Acronyms ─────────────────────────────────────────────────────────
  { type: 'acronym', domain: 'insurance', abbr: 'EOB', expansion: 'Explanation of Benefits', es: 'explicación de beneficios' },
  { type: 'acronym', domain: 'insurance', abbr: 'PIP', expansion: 'Personal Injury Protection', es: 'protección contra lesiones personales' },
  { type: 'acronym', domain: 'financial', abbr: 'APR', expansion: 'Annual Percentage Rate', es: 'tasa de porcentaje anual' },
  { type: 'acronym', domain: 'social', abbr: 'SNAP', expansion: 'Supplemental Nutrition Assistance Program', es: 'programa de asistencia nutricional' },
  { type: 'acronym', domain: 'social', abbr: 'WIC', expansion: 'Women, Infants, and Children', es: 'programa para mujeres, infantes y niños' },
  { type: 'acronym', domain: 'medical', abbr: 'ED', expansion: 'Emergency Department', es: 'departamento de emergencias' },
  { type: 'acronym', domain: 'medical', abbr: 'PCP', expansion: 'Primary Care Physician', es: 'médico de atención primaria' },
  { type: 'acronym', domain: 'medical', abbr: 'OTC', expansion: 'Over The Counter', es: 'de venta libre' },
];

// ── Deck hygiene ───────────────────────────────────────────────────────

/** lowercase, trim, collapse spaces — dedupe key basis */
export const normalizeTerm = (t = '') => t.toLowerCase().trim().replace(/\s+/g, ' ');

/** Returns { errors: [], warnings: [] } — run in tests to keep the deck clean. */
export const validateDecks = (cards = STUDY_CARDS) => {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  cards.forEach((c, i) => {
    const where = `#${i} (${c.type}/${c.domain})`;
    if (!c.type || !c.domain) errors.push(`${where}: missing type or domain`);
    if (c.type === 'glossary') {
      if (!c.en || !c.es) errors.push(`${where}: glossary needs en + es`);
      const key = `gl:${normalizeTerm(c.en)}`;
      if (seen.has(key)) errors.push(`${where}: duplicate EN term "${c.en}" (also #${seen.get(key)}) — airbag/appointment/license dupes go here`);
      else seen.set(key, i);
    } else if (c.type === 'nosay') {
      if (!c.wrong || !c.right) errors.push(`${where}: nosay needs wrong + right`);
    } else if (c.type === 'acronym') {
      if (!c.abbr || !c.expansion || !c.es) errors.push(`${where}: acronym needs abbr + expansion + es`);
      const key = `ab:${normalizeTerm(c.abbr)}:${c.domain}`;
      if (seen.has(key)) errors.push(`${where}: duplicate acronym "${c.abbr}" in ${c.domain}`);
      else seen.set(key, i);
    } else if (c.type === 'qa') {
      if (!c.text) errors.push(`${where}: qa needs text`);
    } else {
      errors.push(`${where}: unknown type "${c.type}"`);
    }
    if (c.type !== 'qa' && c.domain !== 'general' && !STUDY_DOMAINS.some((d) => d.id === c.domain)) {
      errors.push(`${where}: unknown domain "${c.domain}"`);
    }
  });
  return { errors, warnings };
};

// ── Card selection ─────────────────────────────────────────────────────

/** qa cards show in every domain selection; otherwise domain filter (or all). */
export const cardsForDomain = (cards = STUDY_CARDS, domain = 'all') => {
  if (!domain || domain === 'all') return cards;
  return cards.filter((c) => c.domain === domain || c.type === 'qa');
};

/** Deterministic pseudo-shuffle (mulberry32) so tests + reloads are stable per seed. */
export const seededShuffle = (list = [], seed = 1) => {
  const arr = [...list];
  let t = seed >>> 0;
  const rand = () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ── Domain preference persistence ──────────────────────────────────────

export const STUDY_DOMAIN_KEY = 'catint_study_domain_v1';
export const STUDY_DOMAIN_CHANGED_EVENT = 'catint_study_domain_changed';

export const readStudyDomain = () => {
  try {
    const v = localStorage.getItem(STUDY_DOMAIN_KEY);
    return STUDY_DOMAINS.some((d) => d.id === v) ? v : 'all';
  } catch {
    return 'all';
  }
};

export const writeStudyDomain = (domain) => {
  if (!STUDY_DOMAINS.some((d) => d.id === domain)) return readStudyDomain();
  try {
    localStorage.setItem(STUDY_DOMAIN_KEY, domain);
    window.dispatchEvent(new CustomEvent(STUDY_DOMAIN_CHANGED_EVENT, { detail: { domain } }));
  } catch {
    /* ignore */
  }
  return domain;
};
