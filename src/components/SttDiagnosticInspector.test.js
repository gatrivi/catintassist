import React from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import {
  STT_DIAGNOSTIC_VERSION,
  beginSttSession,
  clearSttAudio,
  clearSttTraces,
  linkDisplayedCaption,
  recordSttEvent,
  setSttAudioRecording,
  setTraceEnabled,
} from '../utils/sttDiagnosticTrace';
import { SttDiagnosticInspector } from './SttDiagnosticInspector';

describe('SttDiagnosticInspector', () => {
  beforeEach(() => {
    localStorage.clear();
    setTraceEnabled(false);
    clearSttTraces();
    clearSttAudio();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:diagnostic-audio'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    clearSttTraces();
    clearSttAudio();
  });

  it('ignores Ctrl+Alt+D when disabled', () => {
    render(<SttDiagnosticInspector />);
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with Ctrl+Alt+D when enabled and shows the full linked event', () => {
    setTraceEnabled(true);
    const sessionId = beginSttSession();
    const event = recordSttEvent({
      text: 'raw diagnostic words',
      providerStart: 12.5,
      providerDuration: 2.25,
      wallClockMs: 1700000000000,
      lane: 'patient-es',
      socket: 'socket-3',
      confidence: 0.87,
      final: true,
    });
    linkDisplayedCaption(event.id, 'caption-42', 'visible diagnostic words');
    setSttAudioRecording(true);
    render(<SttDiagnosticInspector />);

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    expect(screen.getByRole('dialog', { name: 'STT diagnostic inspector' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(STT_DIAGNOSTIC_VERSION))).toBeInTheDocument();
    expect(screen.getByText(sessionId)).toBeInTheDocument();
    expect(screen.getByText(event.id)).toBeInTheDocument();
    expect(screen.getByText('raw diagnostic words')).toBeInTheDocument();
    expect(screen.getByText('caption-42')).toBeInTheDocument();
    expect(screen.getByText('visible diagnostic words')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('patient-es');
    expect(dialog).toHaveTextContent('socket-3');
    expect(dialog).toHaveTextContent('0.87');
    expect(dialog).toHaveTextContent('Finaltrue');
    expect(screen.getByTestId('stt-audio-recording-status')).toHaveTextContent('ACTIVE');
  });

  it('closes with Escape and automatic disabling closes it', () => {
    setTraceEnabled(true);
    render(<SttDiagnosticInspector />);
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, altKey: true });
    act(() => setTraceEnabled(false));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
