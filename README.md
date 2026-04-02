# 🐾 CatIntAssist: The Powerful Interpreter Workspace

**CatIntAssist** is a premium, high-density transcription and interpretation assistant designed specifically for medical interpreters. It combines real-time AI transcription, multi-service translation fallbacks, and comprehensive goal-tracking into a single, aesthetic dashboard.

![Premium Dashboard Interface](https://img.shields.io/badge/Aesthetics-Premium-blueviolet?style=for-the-badge)
![React Version](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
![Transcription](https://img.shields.io/badge/Transcription-Deepgram_Nova--2-10b981?style=for-the-badge)

---

## 🚀 Key Features

### 🎙️ High-Fidelity Transcription & Translation
- **80% Focus Area**: The primary viewport is dedicated to the **Livestream**, ensuring maximum readability during intense calls.
- **Bi-Directional Support**: Seamlessly handles English (Blue) and Spanish (Green) audio.
- **Deepgram Nova-2 Integration**: Leverages the latest AI models for industry-leading speed and accuracy in medical terminology.
- **Multi-Service Translation**: Intelligent fallback logic (Google Translate -> Lingva -> MyMemory) ensures you're never left without a translation.
- **Text Emphasis Modes**: Toggle between **Source Focus** (White) and **Translation Focus** (Deep Blue) to suit your interpreting style.

### 💰 Real-Time Goal & Income Tracking
- **20% Sidebar Dashboard**: The remaining viewport tracks your productivity without distracting from the transcription.
- **Smart Target Metrics**:
  - **Today's Progress**: Minutes worked / Target minutes.
  - **Today's Earnings**: Current $$ / Total $$ goal.
  - **Monthly Outlook**: Monthly minutes and income tracking.
- **Pace Calculator**: Know exactly how much you need to work per day and how much time is left to hit your monthly targets.
- **Dial Goal Selector**: A tactile, scrolling dial to set your weekly commitments and instantly see your projected income.

### 🎵 Immersive Soundscape Interpreter
An auditory feedback system designed to provide non-visual cues for call status and productivity:
- **Call Start**: A satisfying "purse opening" sound triggers on connection.
- **Income Ticks**: Every minute of work earns you a silver "coin" sound.
- **Progressive Wealth**: As the call continues, the coin sounds become richer and more resonant.
- **Call End**: A triumphant "crash of coins" into a purse celebrates the completion of a session.

### 🛠️ Intelligent UI Utilities
- **Smart Numbers**: All phone numbers and digital sequences are highlighted. **Click to instantly copy** them to your clipboard.
- **Instant Dictionary**: Double-click any word for an instant Linguee lookup popover.
- **Sticky Scroll**: Smart auto-scroll keeps the latest transcription in view, with a 15-second manual override for reviewing previous text.
- **Long Bubble Warnings**: Visual and auditory (ping) alerts when a speaker exceeds 40 words to help you manage memory and pacing.
- **Auto AI Mode**: Optional automatic Text-to-Speech (TTS) for incoming translations.

---

## 📱 Optimized Layouts
CatIntAssist is designed for versatility:
- **Desktop Mode**: High-density 80/20 split for maximum information throughput.
- **Mobile Mode**: Vertical layout optimization for smaller screens, ensuring transcription remains the priority.
- **Compact View**: Collapse the dashboard to focus purely on the text.

---

## 🛠️ Technology Stack
- **Core**: React 19 + Vanilla CSS (Glassmorphism & Rich Aesthetics)
- **Audio**: Web Audio API + `navigator.mediaDevices.getDisplayMedia`
- **AI**: Deepgram Nova-2 (Transcription) + Multi-API Translation Engine
- **Persistence**: `idb-keyval` for reliable browser-side data storage

---

## 🎨 Design Philosophy
> **"Simple enough for a toddler, powerful enough for a pro."**

The UI utilizes a "glass-panel" design with vibrant accents, smooth gradients, and micro-animations to create a premium feel that makes the workday more engaging.

---

## 📦 Installation & Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure your API keys in `.env`.
4. Start the engine: `npm start`

---
*Created with ❤️ by Antigravity for the Modern Interpreter.*
