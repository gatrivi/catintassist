/**
 * Legal content for CatIntAssist — Terms of Use, Privacy Policy,
 * Medical Disclaimer, and Data & API-key disclosure.
 *
 * Single source of truth: rendered by `LegalModal` (consent gate + Settings).
 * Bump `LEGAL_VERSION` whenever the substance changes; the consent gate
 * re-prompts users whose accepted version is older.
 *
 * NOT LEGAL ADVICE — have counsel review before commercial sale.
 */

export const LEGAL_VERSION = '1.0.0';

export const LEGAL_CONTACT = {
  product: 'CatIntAssist',
  owner: 'Gaston Alejandro Trivi',
  email: 'gatrivi@gmail.com',
};

const p = (text) => ({ type: 'p', text });
const ul = (items) => ({ type: 'ul', items });

export const LEGAL_SECTIONS = [
  {
    id: 'terms',
    title: 'Terms of Use',
    blocks: [
      p('By using CatIntAssist ("the Software") you agree to these Terms of Use. If you do not agree, do not use the Software.'),
      p(`${LEGAL_CONTACT.product} is a productivity workspace for professional interpreters. It organizes live speech-to-text captions, translations, timers, and personal statistics in your browser. It is a support tool only: it does not interpret for you and it does not replace your professional judgment.`),
      { type: 'h', text: '1. Your account and your API keys' },
      ul([
        'The Software runs entirely in your browser. Speech-to-text and translation are performed by third-party providers (e.g., Deepgram, DeepL, OpenAI) using API keys that you obtain and enter yourself ("bring-your-own-key").',
        'You are responsible for your own provider accounts, their cost, their terms of service, and keeping your keys safe. The Software never issues, proxies, or bills third-party API usage.',
      ]),
      { type: 'h', text: '2. Acceptable use' },
      ul([
        'Use the Software only where all participants on a call have been properly notified that transcription/translation tools may be in use, and where such use complies with your contracts, employer policies, and applicable law (including privacy and health-information rules).',
        'Do not use the Software to unlawfully record, transcribe, or redistribute other people\'s speech.',
      ]),
      { type: 'h', text: '3. No warranty' },
      p('The Software is provided "as is" without warranties of any kind, express or implied. Speech recognition and machine translation are inherently imperfect; output may be wrong or incomplete. You remain solely responsible for the accuracy and completeness of your interpretation work.'),
      { type: 'h', text: '4. Limitation of liability' },
      p('To the maximum extent permitted by law, the author is not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, revenue, or goodwill arising from your use of or inability to use the Software — including reliance on transcription or translation output.'),
      { type: 'h', text: '5. Changes and termination' },
      p('These terms may be updated; material changes will be surfaced in the app and the consent prompt will reappear with a new version. You may stop using the Software at any time; clearing the site\'s browser data removes all locally stored information.'),
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    blocks: [
      p(`This policy describes what ${LEGAL_CONTACT.product} stores and where it goes. Short version: your transcripts stay on your device; cloud sync carries UI preferences only.`),
      { type: 'h', text: '1. Stored on your device (never sent to us)' },
      ul([
        'Live transcript bubbles and pinned segments — browser IndexedDB.',
        'Translation cache fragments — browser localStorage.',
        'Taught corrections / glossary — browser localStorage.',
        'Productivity stats, timers, notes, soundboard clips — browser localStorage / IndexedDB.',
        'Your API keys — browser localStorage (optional encrypted vault for the Deepgram key).',
      ]),
      { type: 'h', text: '2. Sent to third parties by your own configuration' },
      ul([
        'Audio captured for captioning is streamed to the speech-to-text provider you configure (by default Deepgram) using your own API key and under your own account and agreements with that provider.',
        'Transcript text may be sent to the translation provider you configure, using your own API key.',
        'We never see, store, or bill this traffic.',
      ]),
      { type: 'h', text: '3. Synced to our cloud (optional, signed in)' },
      ul([
        'If you sign in with Google (Firebase Auth), a strict allow-list of UI preferences is synced to Firestore (language pair, layout, theme, device/volume choices, scoreboard preset, etc.).',
        'The sync payload contains no transcripts, no translations, no notes, no statistics, and no API keys.',
      ]),
      { type: 'h', text: '4. What we never do' },
      ul([
        'We do not receive, store, or process your call audio or transcripts on our servers.',
        'We do not sell or share personal data. There is no advertising or tracking in the Software.',
      ]),
      { type: 'h', text: '5. Deleting your data' },
      ul([
        'Local data: clear the site\'s browser data (or use the in-app clear-log / reset controls).',
        'Cloud prefs: sign out and request deletion via the contact below; the Firestore settings document is deleted with the account.',
      ]),
      p(`Questions or deletion requests: ${LEGAL_CONTACT.email}`),
    ],
  },
  {
    id: 'disclaimer',
    title: 'Medical & Professional Disclaimer',
    blocks: [
      p('CatIntAssist is NOT a medical device. It is not cleared, approved, or registered by the FDA or any health regulator, and it makes no clinical decisions, diagnoses, or recommendations.'),
      p('It is also not legal advice, and nothing in the Software or its documentation creates a business associate relationship. If you work under HIPAA or similar regimes, you are the data controller: evaluate your vendors (including your speech-to-text and translation providers), execute any required agreements such as a Business Associate Agreement directly with them, and follow your organization\'s policies.'),
      ul([
        'Speech-to-text and machine-translation output can be wrong, drop words, or misrender numbers, dosages, and names despite built-in safeguards.',
        'Always verify safety-critical details (doses, dates, phone numbers, addresses) against the live audio — never against the caption pane alone.',
        'The interpreter using the Software remains fully responsible for the interpretation delivered on every call.',
      ]),
    ],
  },
  {
    id: 'data',
    title: 'Data & API Keys',
    blocks: [
      p('How your information lives in CatIntAssist:'),
      ul([
        'Bring-your-own-key: you paste your own Deepgram / DeepL / OpenAI keys in Settings. They are stored in your browser only — localStorage, with an optional encrypted remember-me vault for the Deepgram key. Keys are never included in cloud sync.',
        'Transcripts live in IndexedDB on this device. After a call ends, a short grace window lets you reconnect quickly; afterwards the transcript, translation cache, pins, and notes are purged automatically (and can be cleared manually at any time with [CLEAR_LOG]).',
        'Shared computers: use a private browser profile, lock your screen, and clear site data at shift end. Anyone with access to this browser profile can read locally stored data.',
        'Browser extensions and XSS are standard SPA risks: only install extensions you trust; they can potentially read page storage.',
      ]),
      p('Incident plan: if a device is lost or compromised, revoke your provider keys from the provider dashboards and clear this site\'s browser data remotely or at next access.'),
    ],
  },
];
