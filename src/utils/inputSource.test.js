import { INPUT_SOURCE_KINDS, mapLegacySourceToKind, acquireInputSource } from "./inputSource";

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
});
