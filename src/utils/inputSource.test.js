import { INPUT_SOURCE_KINDS, mapLegacySourceToKind } from "./inputSource";

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
});
