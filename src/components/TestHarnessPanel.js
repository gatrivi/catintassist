import React, { useMemo, useRef, useState } from "react";
import { useSession } from "../contexts/SessionContext";
import {
  TRANSCRIPTION_FIXTURE_LIST,
  getTranscriptionFixture,
} from "../fixtures/transcription";
import {
  replayFixtureEvents,
  replayFixtureEventsTimed,
  assertFixtureExpect,
} from "../utils/fixtureReplay";
import { INPUT_SOURCE_KINDS, acquireInputSource } from "../utils/inputSource";
import { APP_VERSION } from "../constants/version";

export const isTestHarnessEnabled = () => {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.REACT_APP_DEV_TEST_HARNESS === "true";
};

const tabBtn = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: 10,
};

/**
 * Dev-only: replay Deepgram fixtures through applyDeepgramTranscriptPayload
 * (same path as live STT). No tab capture required.
 */
export function TestHarnessPanel() {
  const { updateCaptions, startSession, isActive } = useSession();
  const [fixtureId, setFixtureId] = useState("phone-number");
  const [sourceKind, setSourceKind] = useState("fixture");
  const [status, setStatus] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const abortRef = useRef(null);
  const mockCleanupRef = useRef(null);

  const fixture = useMemo(() => getTranscriptionFixture(fixtureId), [fixtureId]);

  const pushRows = (rows) => {
    try {
      updateCaptions?.(rows);
    } catch (_) {}
  };

  const ensureCall = () => {
    if (!isActive && typeof startSession === "function") {
      try {
        startSession(false);
      } catch (_) {}
    }
  };

  const runSync = () => {
    if (!fixture) return;
    ensureCall();
    const { rows, steps } = replayFixtureEvents(fixture);
    pushRows(rows);
    const check = assertFixtureExpect(rows, fixture.expect || {});
    setLastResult({
      ok: check.ok,
      failures: check.failures,
      interimSteps: steps.filter((s) => s.interim).length,
      finalSteps: steps.filter((s) => s.final).length,
      finals: check.finals?.length || 0,
    });
    setStatus(check.ok ? `OK — ${fixture.id}` : `FAIL — ${check.failures.join("; ")}`);
  };

  const runTimed = async () => {
    if (!fixture || playing) return;
    ensureCall();
    setPlaying(true);
    setStatus(`Playing ${fixture.id}…`);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { rows } = await replayFixtureEventsTimed(fixture, {
        signal: ac.signal,
        speed: 2,
        onStep: ({ rows: stepRows }) => pushRows(stepRows),
      });
      const check = assertFixtureExpect(rows, fixture.expect || {});
      setLastResult({
        ok: check.ok,
        failures: check.failures,
        finals: check.finals?.length || 0,
      });
      setStatus(check.ok ? `OK — ${fixture.id}` : `FAIL — ${check.failures.join("; ")}`);
    } finally {
      setPlaying(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort?.();
    setPlaying(false);
    setStatus("Stopped");
  };

  const reset = () => {
    stop();
    pushRows([]);
    setLastResult(null);
    setStatus("Reset");
  };

  const tryMockAttach = async () => {
    if (mockCleanupRef.current) {
      try {
        mockCleanupRef.current();
      } catch (_) {}
      mockCleanupRef.current = null;
    }
    if (sourceKind !== "mockStream" && sourceKind !== "audioFile") {
      setStatus(`Source ${sourceKind}: use fixture replay (no media attach)`);
      return;
    }
    try {
      const { stream } = await acquireInputSource(sourceKind);
      if (stream?.__catintMockCleanup) {
        mockCleanupRef.current = stream.__catintMockCleanup;
      }
      setStatus(
        sourceKind === "mockStream"
          ? "mockStream acquired (no browser permission prompt)"
          : "audioFile stream acquired",
      );
    } catch (err) {
      setStatus(`Attach failed: ${err?.message || err}`);
    }
  };

  if (!isTestHarnessEnabled()) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 11, color: "#86efac", marginBottom: 6 }}>
        Test Harness (engine path) · v{APP_VERSION}
      </div>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: "0 0 8px", lineHeight: 1.4 }}>
        Replays Deepgram-shaped fixtures through{" "}
        <code style={{ color: "#fcd34d" }}>applyDeepgramTranscriptPayload</code>. Fake PHI only. No tab
        capture required.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
          Fixture
          <select
            value={fixtureId}
            onChange={(e) => setFixtureId(e.target.value)}
            style={{ fontSize: 10, padding: "2px 4px", maxWidth: 180 }}
          >
            {TRANSCRIPTION_FIXTURE_LIST.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label || f.id}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
          InputSource
          <select
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value)}
            style={{ fontSize: 10, padding: "2px 4px" }}
          >
            {INPUT_SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <button type="button" style={tabBtn} onClick={runSync} disabled={playing}>
          Play sync
        </button>
        <button type="button" style={tabBtn} onClick={runTimed} disabled={playing}>
          Play timed
        </button>
        <button type="button" style={tabBtn} onClick={stop} disabled={!playing}>
          Stop
        </button>
        <button type="button" style={tabBtn} onClick={reset}>
          Reset
        </button>
        <button type="button" style={tabBtn} onClick={tryMockAttach}>
          Try mock attach
        </button>
      </div>

      {status ? (
        <div style={{ fontSize: 10, color: lastResult?.ok === false ? "#fca5a5" : "#a7f3d0" }}>
          {status}
        </div>
      ) : null}
      {lastResult ? (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          finals={lastResult.finals}
          {lastResult.interimSteps != null ? ` · interimSteps=${lastResult.interimSteps}` : ""}
          {lastResult.finalSteps != null ? ` · finalSteps=${lastResult.finalSteps}` : ""}
        </div>
      ) : null}
    </div>
  );
}
