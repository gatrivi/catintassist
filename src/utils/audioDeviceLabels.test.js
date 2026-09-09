import {
  DEVICE_LABELS_KEY,
  readKnownDeviceLabels,
  rememberDeviceLabels,
  displayDeviceName,
  hasHiddenLabels,
} from "./audioDeviceLabels";

describe("audioDeviceLabels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("remembers non-blank labels, ignores blanks", () => {
    rememberDeviceLabels([
      { deviceId: "a", label: "CABLE Input (VB-Audio)" },
      { deviceId: "b", label: "" },
      { deviceId: "c", label: "   " },
    ]);
    expect(JSON.parse(localStorage.getItem(DEVICE_LABELS_KEY))).toEqual({
      a: "CABLE Input (VB-Audio)",
    });
  });

  test("display prefers live, then remembered, then slot name (never raw id)", () => {
    expect(displayDeviceName({ deviceId: "a", label: "Live Name" }, 0, "out")).toBe("Live Name");
    rememberDeviceLabels([{ deviceId: "a", label: "CABLE Input (VB-Audio)" }]);
    expect(displayDeviceName({ deviceId: "a", label: "" }, 2, "out")).toBe("CABLE Input (VB-Audio)");
    expect(displayDeviceName({ deviceId: "zzz", label: "" }, 1, "out")).toBe("Output 2 · names hidden");
    expect(displayDeviceName({ deviceId: "zzz", label: "" }, 0, "mic")).toBe("Mic 1 · names hidden");
  });

  test("hasHiddenLabels spots fresh-origin lists", () => {
    expect(hasHiddenLabels([{ label: "" }])).toBe(true);
    expect(hasHiddenLabels([{ label: "CABLE Input" }])).toBe(false);
    expect(hasHiddenLabels([])).toBe(false);
  });

  test("corrupt memory reads as empty, never throws", () => {
    localStorage.setItem(DEVICE_LABELS_KEY, "{nope");
    expect(readKnownDeviceLabels()).toEqual({});
    expect(displayDeviceName({ deviceId: "a", label: "" }, 0, "out")).toBe("Output 1 · names hidden");
  });
});
