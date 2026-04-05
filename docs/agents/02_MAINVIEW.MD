# 🎙️ Main View: Transcription & Translation
Updated: 2026-04-05

### ZERO-WASTE DESIGN
- [x] **Flush Alignment**: Transcription bubbles reach the bottom of the screen.
- [x] **Chrome Buffer**: Added a **24px (1 line)** safety spacer at the absolute bottom. This prevents the Chrome "2-Pane" label from occluding the latest message during split-view sessions.
- [x] **No Padding**: Removed redundant vertical margins in the `TranscriptionBoard` container to maximize space for text.
- [x] **Bubble Overlays**: Language badges (SPA/ENG) are rendered as faint overlays on the bubbles themselves, saving separate vertical lines for labels.

### FEATURES
- [x] **Pinning**: Important messages can be pinned to stay in view.
- [x] **Auto-scroll**: The board stays anchored to the latest transcript.
- [x] **Inactivity Detect**: Silence Guardian monitors this view for active audio flow.