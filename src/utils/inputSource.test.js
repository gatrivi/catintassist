import {
  INPUT_SOURCE_KINDS,
  mapLegacySourceToKind,
  acquireInputSource,
  resolveVirtualCableInputDeviceId,
} from "./inputSource";

describe("inputSource", () => {
  test("kinds include audioFile not file", () => {
    expect(INPUT_SOURCE_KINDS).toContain("audioFile");
    expect(INPUT_SOURCE_KINDS).not.toContain("file");
    expect(INPUT_SOURCE_KINDS).toEqual([
      "tab",
      "mic",
      "virtualCable",
      "mockStream",
      "audioFile",
      "fixture",
    ]);
  });

  test("mapLegacySourceToKind", () => {
    expect(mapLegacySourceToKind("mic")).toBe("mic");
    expect(mapLegacySourceToKind("virtualCable")).toBe("virtualCable");
    expect(mapLegacySourceToKind("tab")).toBe("tab");
    expect(mapLegacySourceToKind("other")).toBe("tab");
  });

  test("mic falls back when exact deviceId is overconstrained", async () => {
    const mockStream = { id: "fallback" };
    let calls = 0;
    const getUserMedia = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("overconstrained");
        err.name = "OverconstrainedError";
        throw err;
      }
      return mockStream;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    localStorage.setItem("CATINTASSIST_MIC_ID", "stale-id");

    const result = await acquireInputSource("mic");
    expect(result.stream).toBe(mockStream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  test("VB auto-selects CABLE Output and never selects the default mic", async () => {
    const deviceId = await resolveVirtualCableInputDeviceId({
      savedDeviceId: '',
      enumerateDevicesFn: async () => [
        { kind: 'audioinput', deviceId: 'real-mic', label: 'Microphone (HS-220U)' },
        { kind: 'audioinput', deviceId: 'cable-output', label: 'CABLE Output (VB-Audio Virtual Cable)' },
      ],
    });
    expect(deviceId).toBe('cable-output');
    expect(localStorage.getItem('CATINTASSIST_VIRTUAL_CABLE_INPUT_DEVICE_ID')).toBe('cable-output');
  });

  test("VB refuses to start when CABLE Output is absent", async () => {
    await expect(resolveVirtualCableInputDeviceId({
      savedDeviceId: '',
      enumerateDevicesFn: async () => [{ kind: 'audioinput', deviceId: 'real-mic', label: 'Microphone' }],
    })).rejects.toThrow(/CABLE Output was not found/);
  });

  test("VB drops a stale saved ID (other origin) and re-picks CABLE Output", async () => {
    const deviceId = await resolveVirtualCableInputDeviceId({
      savedDeviceId: 'prod-origin-stale-id',
      enumerateDevicesFn: async () => [
        { kind: 'audioinput', deviceId: 'real-mic', label: 'Microphone (HS-220U)' },
        { kind: 'audioinput', deviceId: 'cable-output-3001', label: 'CABLE Output (VB-Audio Virtual Cable)' },
      ],
    });
    expect(deviceId).toBe('cable-output-3001');
    expect(localStorage.getItem('CATINTASSIST_VIRTUAL_CABLE_INPUT_DEVICE_ID')).toBe('cable-output-3001');
  });

  test("VB keeps a saved ID that still exists (no relabel churn)", async () => {
    const getUserMedia = jest.fn();
    const deviceId = await resolveVirtualCableInputDeviceId({
      savedDeviceId: 'cable-output',
      enumerateDevicesFn: async () => [
        { kind: 'audioinput', deviceId: 'cable-output', label: 'CABLE Output (VB-Audio Virtual Cable)' },
      ],
      getUserMediaFn: getUserMedia,
    });
    expect(deviceId).toBe('cable-output');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  test("VB prompts once for labels when enumeration is blank, then picks cable", async () => {
    let enumerated = 0;
    const stop = jest.fn();
    const deviceId = await resolveVirtualCableInputDeviceId({
      savedDeviceId: '',
      enumerateDevicesFn: async () => {
        enumerated += 1;
        return enumerated === 1
          ? [{ kind: 'audioinput', deviceId: 'x', label: '' }]
          : [{ kind: 'audioinput', deviceId: 'cable-output', label: 'CABLE Output (VB-Audio Virtual Cable)' }];
      },
      getUserMediaFn: jest.fn(async () => ({ getTracks: () => [{ stop }] })),
    });
    expect(deviceId).toBe('cable-output');
    expect(stop).toHaveBeenCalled();
  });

  test("VB acquire retries with a fresh pick after stale-ID OverconstrainedError", async () => {
    const mockStream = { id: 'cable-live' };
    const seen = [];
    localStorage.setItem('CATINTASSIST_VIRTUAL_CABLE_INPUT_DEVICE_ID', 'stale-prod-id');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'real-mic', label: 'Microphone (HS-220U)' },
          { kind: 'audioinput', deviceId: 'cable-fresh', label: 'CABLE Output (VB-Audio Virtual Cable)' },
        ],
        getUserMedia: jest.fn(async (constraints) => {
          seen.push(constraints?.audio?.deviceId?.exact);
          if (seen.length === 1) {
            const err = new Error('stale device');
            err.name = 'OverconstrainedError';
            throw err;
          }
          return mockStream;
        }),
      },
    });
    const result = await acquireInputSource('virtualCable');
    expect(result.stream).toBe(mockStream);
    expect(result.kind).toBe('virtualCable');
    expect(seen).toEqual(['cable-fresh', 'cable-fresh']);
    expect(localStorage.getItem('CATINTASSIST_VIRTUAL_CABLE_INPUT_DEVICE_ID')).toBe('cable-fresh');
  });
});
