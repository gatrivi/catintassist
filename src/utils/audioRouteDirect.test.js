/** v4.104.0 — direct AudioContext.setSinkId clip playback. */
import {
  closeDirectContexts,
  decodeBlobOnContext,
  getDirectSinkContext,
  isDirectSinkSupported,
  playBufferDirect,
  playBlobToSinkDirect,
} from './audioRouteDirect';

class FakeAudioContext {
  constructor(opts = {}) {
    this.sampleRate = opts.sampleRate || 44100;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
    this.lastSinkId = undefined;
  }
  async resume() { this.resumed = true; }
  async setSinkId(id) { this.lastSinkId = id; }
  async close() { this.state = 'closed'; }
  createBufferSource() {
    const src = { buffer: null, connect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
    FakeAudioContext.lastSource = src;
    return src;
  }
  createGain() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
    };
  }
  async decodeAudioData() {
    return { duration: 0.5, numberOfChannels: 1, getChannelData: () => new Float32Array(8) };
  }
}

const fakeBlob = () => new Blob(['x'], { type: 'audio/webm' });

afterEach(() => {
  closeDirectContexts();
  delete window.AudioContext;
});

describe('audioRouteDirect', () => {
  test('unsupported when AudioContext lacks setSinkId', () => {
    window.AudioContext = class extends FakeAudioContext {};
    // setSinkId lives on the parent prototype — deleting from the subclass
    // prototype leaves the inherited method intact, so delete the parent's.
    delete FakeAudioContext.prototype.setSinkId;
    try {
      expect(isDirectSinkSupported()).toBe(false);
      expect(() => getDirectSinkContext('sink-1')).toThrow('direct_sink_unsupported');
    } finally {
      FakeAudioContext.prototype.setSinkId = async function setSinkId(id) { this.lastSinkId = id; };
    }
  });

  test('unsupported when AudioContext is missing entirely', () => {
    expect(isDirectSinkSupported()).toBe(false);
  });

  test('persistent 48k context per sink', async () => {
    window.AudioContext = FakeAudioContext;
    const a = getDirectSinkContext('sink-1');
    const b = getDirectSinkContext('sink-1');
    const c = getDirectSinkContext('sink-2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.sampleRate).toBe(48000);
  });

  test('playBlobToSinkDirect resumes, sets sink, resolves on source end', async () => {
    window.AudioContext = FakeAudioContext;
    const session = await playBlobToSinkDirect(fakeBlob(), 'sink-9', { normalize: false });
    expect(session.duration).toBe(0.5);
    // end the clip manually
    FakeAudioContext.lastSource.onended();
    await session.promise;
    const ctx = getDirectSinkContext('sink-9');
    expect(ctx.resumed).toBe(true);
    expect(ctx.lastSinkId).toBe('sink-9');
  });

  test('playBufferDirect rejects on missing args', () => {
    expect(playBufferDirect(null, null).promise).rejects.toThrow('missing direct args');
  });

  test('decodeBlobOnContext decodes via the given context', async () => {
    window.AudioContext = FakeAudioContext;
    const ctx = getDirectSinkContext('sink-1');
    const buffer = await decodeBlobOnContext(ctx, fakeBlob());
    expect(buffer.duration).toBe(0.5);
  });

  test('closeDirectContexts closes every context', async () => {
    window.AudioContext = FakeAudioContext;
    const ctx = getDirectSinkContext('sink-1');
    closeDirectContexts();
    expect(ctx.state).toBe('closed');
    const fresh = getDirectSinkContext('sink-1');
    expect(fresh).not.toBe(ctx);
  });
});
