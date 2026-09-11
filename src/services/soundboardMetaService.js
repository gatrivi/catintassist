/** Soundboard text metadata only — no audio blobs. v4.74.0 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

export const SOUNDBOARD_META_STORAGE_KEY = 'catint_soundboard_meta_v1';
export const SOUNDBOARD_META_CHANGED_EVENT = 'cat_soundboard_meta_changed';
export const SOUNDBOARD_DOC_VERSION = 1;

/**
 * Default labels/text for built-in soundboard actions (metadata sync only).
 * v4.87.0: verbatim handbook scripts (scripts.txt, "By the Book") — the text
 * the interpreter reads to record each greeting. Placeholders ([First name],
 * [ID], ______) are filled in by the user; edit freely in Studio afterwards.
 * v4.99.3: dedup — `open_client` was byte-identical to `greeting_en`, so it
 * is retired (canonical: `greeting_en`, which keeps the AM/PM/Eve variants).
 * v4.101.0: dedup — `open_lep` is the English-reading duplicate of `greeting_es`
 * (the handbook LEP greeting is delivered in the LEP's language), so it is
 * retired (canonical: `greeting_es`).
 * Near-dupes with different handbook tails are kept but relabeled so Studio
 * reads in call order (Opener–… / Closing–… / Legacy–…).
 */
export const RETIRED_SOUNDBOARD_IDS = ['open_client', 'open_lep'];
export const CANONICAL_SOUNDBOARD_ID = { open_client: 'greeting_en', open_lep: 'greeting_es' };
const PRE_DEDUP_LABELS = {
  greeting_en: 'Greeting',
  greeting_es: 'Greeting',
  open_lep: 'LEP Open',
  direct_dial: 'Direct Dial',
  closing: 'Closing',
  sign_off: 'Sign Off',
  signoff_lep: 'LEP Bye',
  anyone: 'Anyone?',
  callout: 'Callout',
  closer_louder: 'Louder',
};
export const DEFAULT_SOUNDBOARD_ITEMS = [
  // v4.101.0: dynamic greetings carry slotText — the time word matches the
  // recording slot (morning/afternoon/evening); `text` stays the base script.
  {
    id: 'greeting_en', label: 'Opener – Client', category: 'greeting', lang: 'en', hotkey: '',
    text: 'Good morning, my name is [First name], interpreter ID [ID], and I will be your [language] interpreter. Please speak in clear, short sentences so that I can interpret everything. Before we begin, I need to ask you a few questions.',
    slotText: {
      morning: 'Good morning, my name is [First name], interpreter ID [ID], and I will be your [language] interpreter. Please speak in clear, short sentences so that I can interpret everything. Before we begin, I need to ask you a few questions.',
      afternoon: 'Good afternoon, my name is [First name], interpreter ID [ID], and I will be your [language] interpreter. Please speak in clear, short sentences so that I can interpret everything. Before we begin, I need to ask you a few questions.',
      evening: 'Good evening, my name is [First name], interpreter ID [ID], and I will be your [language] interpreter. Please speak in clear, short sentences so that I can interpret everything. Before we begin, I need to ask you a few questions.',
    },
  },
  {
    id: 'greeting_es', label: 'Opener – LEP (ES)', category: 'greeting', lang: 'es', hotkey: '',
    text: 'Buenos días, seré su intérprete de [idioma]. Todo lo que diga será confidencial. Por favor hable en oraciones claras y cortas para poder interpretar todo.',
    slotText: {
      morning: 'Buenos días, seré su intérprete de [idioma]. Todo lo que diga será confidencial. Por favor hable en oraciones claras y cortas para poder interpretar todo.',
      afternoon: 'Buenas tardes, seré su intérprete de [idioma]. Todo lo que diga será confidencial. Por favor hable en oraciones claras y cortas para poder interpretar todo.',
      evening: 'Buenas noches, seré su intérprete de [idioma]. Todo lo que diga será confidencial. Por favor hable en oraciones claras y cortas para poder interpretar todo.',
    },
  },
  { id: 'intake', label: 'Intake Qs', text: 'May I have your full name and date of birth, please?', hotkey: '1', category: 'call-control', lang: 'en' },
  { id: 'hold_policy', label: 'Hold Policy', text: 'I will place you on a brief hold while I connect with the provider.', hotkey: '2', category: 'call-control', lang: 'en' },
  { id: 'hold_exc_en', label: 'Hold Exc', text: 'Thank you for holding. I appreciate your patience.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'hold_exc_es', label: 'Hold Exc', text: 'Gracias por esperar. Aprecio su paciencia.', hotkey: '', category: 'call-control', lang: 'es' },
  { id: 'sign_off', label: 'Closing – Sign off', text: 'My name is ______, ID ______, thank you for using our services.', hotkey: '3', category: 'call-control', lang: 'en' },
  { id: 'anyone', label: 'Legacy – Anyone?', text: 'Is anyone else there who would like to speak?', hotkey: '4', category: 'call-control', lang: 'en' },
  { id: 'callout', label: 'Legacy – Callout', text: 'One moment, I need to clarify something with you.', hotkey: '5', category: 'call-control', lang: 'en' },
  { id: 'closer_louder', label: 'Legacy – Louder', text: 'Could you please speak a little louder?', hotkey: '6', category: 'call-control', lang: 'en' },
  { id: 'limit_40_en', label: '40 Word Limit', text: 'Please keep your answers to about forty words so I can interpret accurately.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'limit_40_es', label: '40 Word Limit', text: 'Por favor responda en unas cuarenta palabras para poder interpretar con precisión.', hotkey: '', category: 'call-control', lang: 'es' },
  // v4.101.0: open_lep retired — English-reading dupe of greeting_es (canonical).
  { id: 'direct_dial', label: 'Opener – Direct dial', text: 'Good morning, I will be your [language] interpreter. Everything you say will stay confidential. Please speak in clear, short sentences so that I can interpret everything. What is the phone number you are trying to reach?', hotkey: '', category: 'greeting', lang: 'en' },
  { id: 'repeat', label: 'Repeat', text: 'Ma\'am, this is the interpreter, could you repeat what you said please?', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'segments', label: 'Segments', text: 'This is the interpreter speaking, I do apologize for interrupting, but for the sake of accuracy, would you mind providing me with shorter segments please?', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'interrupt', label: 'Interrupt', text: "I do apologize for interrupting, please go ahead.", hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'static_cover', label: 'Static', text: 'This is the interpreter, I am sorry, there is some static on the line, I am checking my settings to see if I can improve my audio quality, would you mind repeating the information one more time please?', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'ghost', label: 'Ghost', text: 'This is the interpreter speaking, I do apologize for the inconvenience, but since I am not able to hear my client on the line, I will disengage. My name is [name], my ID [ID], have a great day!', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'disengage_offer', label: 'Stay/Leave', text: 'This is the interpreter speaking. I am sorry Sir, it seems you are able to communicate with your customer/patient. Would you like me to remain on the line with you, or should I disconnect? I would be happy to remain on the line — it\'s just that we need to make sure services are still needed. Thank you.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'blocked_intake', label: 'Blocked', text: 'I do apologize for the inconvenience, but the system will not let me proceed without the information needed. Please call us back when you have the information and we will be happy to assist. Once again, I do apologize for the inconvenience.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'voicemail', label: 'Voicemail', text: 'Good morning, this is an interpreter in Dr. Michael\'s representation, this message is for Mrs. Maria Espinoza, her appointment will be in the Kaiser Permanent Hospital at 8:30 in the morning. If you cannot attend, please reach out to us at your earliest convenience at this phone number 333.333.3333. Have a good day.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'operator_12241', label: 'Operator', text: 'Hello. This is the interpreter speaking. One moment please, while I introduce myself to the LEP/patient.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'closing', label: 'Closing – More help?', text: 'Is there anything else I can do to assist you?', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'signoff_lep', label: 'Closing – LEP bye', text: "Thank you for using our services, have a nice day. Goodbye Sir/Ma'am.", hotkey: '', category: 'call-control', lang: 'en' },
];

const sanitizeItem = (item) => {
  if (!item?.id) return null;
  const fallback = DEFAULT_SOUNDBOARD_ITEMS.find((d) => d.id === item.id);
  return {
    id: String(item.id),
    label: String(item.label || fallback?.label || item.id),
    text: String(item.text ?? fallback?.text ?? ''),
    hotkey: String(item.hotkey ?? fallback?.hotkey ?? ''),
    category: String(item.category || fallback?.category || 'call-control'),
    lang: String(item.lang || fallback?.lang || 'en'),
    // v4.101.0: keep slot-aware scripts (AM/PM/Eve greeting word).
    slotText: item.slotText && typeof item.slotText === 'object' ? item.slotText : fallback?.slotText,
  };
};

export const mergeSoundboardItems = (remoteItems = []) => {
  const byId = Object.fromEntries(DEFAULT_SOUNDBOARD_ITEMS.map((d) => [d.id, { ...d }]));
  remoteItems.forEach((item) => {
    if (RETIRED_SOUNDBOARD_IDS.includes(item?.id)) return; // v4.99.3: retired dupe drops out of Studio
    const clean = sanitizeItem(item);
    if (clean && byId[clean.id]) byId[clean.id] = clean;
  });
  return DEFAULT_SOUNDBOARD_ITEMS.map((d) => byId[d.id]);
};

/**
 * One-time handbook reseed (v4.87.0): stored texts predate the verbatim
 * scripts, and stored items win over defaults on load — so without this,
 * existing profiles would never see the handbook. Overwrites TEXTS ONLY
 * (recorded audio blobs live in separate file storage and are untouched).
 * Clears legibility health for reseeded keys (old recordings vs new script).
 * v4.101.0 (seed 4): retires the `open_lep` dupe and reseeds the dynamic
 * openers with slot-aware scripts (morning/afternoon/evening greeting word).
 * v4.99.3 (seed 3): dropped the retired `open_client` dupe from stored meta
 * and relabels untouched tiles to the dedup names (custom user labels kept).
 * Audio/health/CALL OK carry-over for the retired clip runs in GreetingsPanel.
 */
export const SOUNDBOARD_TEXT_SEED = 4;
const TEXT_SEED_KEY = 'catint_soundboard_text_seed_v1';
const HEALTH_KEY = 'catint_audio_health';

export const ensureHandbookSeed = () => {
  try {
    if (Number(localStorage.getItem(TEXT_SEED_KEY) || 0) >= SOUNDBOARD_TEXT_SEED) return false;
    const defaults = Object.fromEntries(DEFAULT_SOUNDBOARD_ITEMS.map((d) => [d.id, d]));
    const raw = localStorage.getItem(SOUNDBOARD_META_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const seen = new Set();
    const changed = [];
    // v4.99.3: retired dupe never carries forward in stored meta.
    const next = items.flatMap((it) => {
      if (!it?.id) return [];
      if (RETIRED_SOUNDBOARD_IDS.includes(it.id)) return [];
      if (!defaults[it.id]) return [it];
      seen.add(it.id);
      let out = it;
      if (it.text !== defaults[it.id].text) {
        changed.push(it.id);
        out = { ...out, text: defaults[it.id].text };
      }
      // Relabel only tiles the user never renamed (stored label == pre-dedup label).
      if (PRE_DEDUP_LABELS[it.id] && it.label === PRE_DEDUP_LABELS[it.id] && out.label !== defaults[it.id].label) {
        out = { ...out, label: defaults[it.id].label };
      }
      return [out];
    });
    DEFAULT_SOUNDBOARD_ITEMS.forEach((d) => {
      // New ids have no old recordings — no health to clear.
      if (!seen.has(d.id)) next.push({ ...d });
    });
    localStorage.setItem(SOUNDBOARD_META_STORAGE_KEY, JSON.stringify({ items: next }));
    if (changed.length) {
      try {
        const h = JSON.parse(localStorage.getItem(HEALTH_KEY) || '{}');
        let touched = false;
        changed.forEach((id) => {
          [id, `${id}_morning`, `${id}_afternoon`, `${id}_evening`].forEach((k) => {
            if (k in h) { delete h[k]; touched = true; }
          });
        });
        if (touched) localStorage.setItem(HEALTH_KEY, JSON.stringify(h));
      } catch (_) {}
    }
    localStorage.setItem(TEXT_SEED_KEY, String(SOUNDBOARD_TEXT_SEED));
    try {
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_META_CHANGED_EVENT, { detail: mergeSoundboardItems(next) }));
    } catch (_) {}
    return true;
  } catch {
    return false;
  }
};

export const loadSoundboardMetaLocal = () => {
  try {
    ensureHandbookSeed();
    const raw = localStorage.getItem(SOUNDBOARD_META_STORAGE_KEY);
    if (!raw) return mergeSoundboardItems();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items)) return mergeSoundboardItems(parsed.items);
  } catch {
    /* ignore */
  }
  return mergeSoundboardItems();
};

export const saveSoundboardMetaLocal = (items) => {
  const merged = mergeSoundboardItems(items);
  try {
    localStorage.setItem(SOUNDBOARD_META_STORAGE_KEY, JSON.stringify({ items: merged }));
    window.dispatchEvent(new CustomEvent(SOUNDBOARD_META_CHANGED_EVENT, { detail: merged }));
  } catch {
    /* ignore */
  }
  return merged;
};

export const getSoundboardItem = (id, items = loadSoundboardMetaLocal()) =>
  items.find((item) => item.id === id) || null;

/**
 * v4.101.0: script text for a clip key. Keys carry an optional slot suffix
 * (greeting_en_afternoon) — dynamic greetings then read their slotText so the
 * recorded greeting actually says "Good afternoon", etc. Falls back to `text`.
 */
export const getScriptForClip = (key, items = loadSoundboardMetaLocal()) => {
  const raw = String(key || '');
  const m = raw.match(/_(morning|afternoon|evening)$/);
  const item = getSoundboardItem(m ? raw.slice(0, -m[0].length) : raw, items);
  if (!item) return '';
  return (m && item.slotText?.[m[1]]) || item.text || '';
};

export const soundboardDocRef = (uid) => {
  if (!db || !uid) return null;
  return doc(db, 'users', uid, 'soundboard', 'main');
};

export const pullSoundboardFromCloud = async (uid) => {
  if (!isFirebaseConfigured() || !uid) return null;
  const ref = soundboardDocRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const items = mergeSoundboardItems(Array.isArray(data?.items) ? data.items : []);
  saveSoundboardMetaLocal(items);
  return { ...data, items };
};

export const pushSoundboardToCloud = async (uid, items = loadSoundboardMetaLocal()) => {
  if (!isFirebaseConfigured() || !uid) return false;
  const ref = soundboardDocRef(uid);
  if (!ref) return false;
  const merged = mergeSoundboardItems(items);
  await setDoc(
    ref,
    {
      v: SOUNDBOARD_DOC_VERSION,
      items: merged,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  saveSoundboardMetaLocal(merged);
  return true;
};

export const importLocalSoundboardToCloud = async (uid) => {
  const items = loadSoundboardMetaLocal();
  await pushSoundboardToCloud(uid, items);
  return items.length;
};
