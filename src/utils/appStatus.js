/** One-glance cat status. Kept conservative: silence is not an outage. */
export const getAppStatus = ({
  isActive = false,
  isZombieCall = false,
  apiKeyMissing = false,
  apiKeyRejected = false,
  connectionState = 'disconnected',
  connectProgress = {},
  virtualCableFailure = null,
} = {}) => {
  if (apiKeyMissing || apiKeyRejected || connectionState === 'error') {
    return { tone: 'error', label: 'STT needs attention', title: 'Cat is red: Deepgram needs attention.' };
  }
  if (isZombieCall || virtualCableFailure) {
    return { tone: 'warn', label: 'Audio needs attention', title: 'Cat is amber: reconnect or choose TAB/VB.' };
  }
  if (isActive && connectionState === 'connected') {
    const bothSocketsOpen = connectProgress.socketEn === 'open' && connectProgress.socketEs === 'open';
    return bothSocketsOpen
      ? { tone: 'live', label: 'STT live', title: 'Cat is green: audio and both Deepgram lanes are live.' }
      : { tone: 'warn', label: 'STT checking', title: 'Cat is amber: call is active but STT is still checking.' };
  }
  if (isActive || connectionState === 'connecting') {
    return { tone: 'connecting', label: 'STT connecting', title: 'Cat is blue: connecting audio and Deepgram.' };
  }
  return { tone: 'idle', label: 'Ready for TAB or VB', title: 'Cat is resting: ready for the next call.' };
};
