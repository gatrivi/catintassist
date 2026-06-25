/** Soundboard text metadata only — no audio blobs. v4.74.0 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

export const SOUNDBOARD_META_STORAGE_KEY = 'catint_soundboard_meta_v1';
export const SOUNDBOARD_META_CHANGED_EVENT = 'cat_soundboard_meta_changed';
export const SOUNDBOARD_DOC_VERSION = 1;

/** Default labels/text for built-in soundboard actions (metadata sync only). */
export const DEFAULT_SOUNDBOARD_ITEMS = [
  { id: 'greeting_en', label: 'Greeting', text: 'Hello, this is your interpreter. How can I help you today?', hotkey: '', category: 'greeting', lang: 'en' },
  { id: 'greeting_es', label: 'Greeting', text: 'Hola, soy su intérprete. ¿En qué puedo ayudarle hoy?', hotkey: '', category: 'greeting', lang: 'es' },
  { id: 'intake', label: 'Intake Qs', text: 'May I have your full name and date of birth, please?', hotkey: '1', category: 'call-control', lang: 'en' },
  { id: 'hold_policy', label: 'Hold Policy', text: 'I will place you on a brief hold while I connect with the provider.', hotkey: '2', category: 'call-control', lang: 'en' },
  { id: 'hold_exc_en', label: 'Hold Exc', text: 'Thank you for holding. I appreciate your patience.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'hold_exc_es', label: 'Hold Exc', text: 'Gracias por esperar. Aprecio su paciencia.', hotkey: '', category: 'call-control', lang: 'es' },
  { id: 'sign_off', label: 'Sign Off', text: 'Thank you for calling. Have a good day.', hotkey: '3', category: 'call-control', lang: 'en' },
  { id: 'anyone', label: 'Anyone?', text: 'Is anyone else there who would like to speak?', hotkey: '4', category: 'call-control', lang: 'en' },
  { id: 'callout', label: 'Callout', text: 'One moment, I need to clarify something with you.', hotkey: '5', category: 'call-control', lang: 'en' },
  { id: 'closer_louder', label: 'Louder', text: 'Could you please speak a little louder?', hotkey: '6', category: 'call-control', lang: 'en' },
  { id: 'limit_40_en', label: '40 Word Limit', text: 'Please keep your answers to about forty words so I can interpret accurately.', hotkey: '', category: 'call-control', lang: 'en' },
  { id: 'limit_40_es', label: '40 Word Limit', text: 'Por favor responda en unas cuarenta palabras para poder interpretar con precisión.', hotkey: '', category: 'call-control', lang: 'es' },
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
  };
};

export const mergeSoundboardItems = (remoteItems = []) => {
  const byId = Object.fromEntries(DEFAULT_SOUNDBOARD_ITEMS.map((d) => [d.id, { ...d }]));
  remoteItems.forEach((item) => {
    const clean = sanitizeItem(item);
    if (clean) byId[clean.id] = clean;
  });
  return DEFAULT_SOUNDBOARD_ITEMS.map((d) => byId[d.id]);
};

export const loadSoundboardMetaLocal = () => {
  try {
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
