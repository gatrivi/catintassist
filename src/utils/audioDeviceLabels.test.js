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

  // v4.107.0: identical labels (Voicemeeter Standard + Potato ghosts) get an id tail.
  test("twin endpoints with identical labels are told apart", () => {
    const twins = [
      { deviceId: "live-device-1111", label: "Voicemeeter Input (VB-Audio Voicemeeter VAIO)" },
      { deviceId: "ghost-device-2222", label: "Voicemeeter Input (VB-Audio Voicemeeter VAIO)" },
    ];
    expect(displayDeviceName(twins[0], 0, "out", null, twins)).toMatch(/#1111$/);
    expect(displayDeviceName(twins[1], 1, "out", null, twins)).toMatch(/#2222$/);
    // No siblings → no suffix (backwards compatible).
    expect(displayDeviceName(twins[0], 0, "out")).toBe("Voicemeeter Input (VB-Audi…");
    // Unique labels → no suffix even with siblings passed.
    const mixed = [...twins, { deviceId: "c expressed", label: "CABLE Input (VB-Audio Virtual Cable)" }];
    expect(displayDeviceName(mixed[2], 2, "out", null, mixed)).toBe("CABLE Input (VB-Audio Virt…");
  });
});
