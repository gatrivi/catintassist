import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { writeReleaseNotesLangPref } from '../utils/releaseNotesStorage';

const mockNote = {
  version: '4.84.20',
  id: 'test-note',
  highlightElementIds: [],
  es: {
    title: 'Título ES',
    intro: 'Intro ES',
    sections: [{ heading: 'Sección', bullets: ['punto uno'] }],
  },
  en: {
    title: 'Title EN',
    intro: 'Intro EN',
    sections: [{ heading: 'Section', bullets: ['bullet one'] }],
  },
};

describe('ReleaseNotesModal', () => {
  beforeEach(() => {
    localStorage.clear();
    writeReleaseNotesLangPref('es');
  });

  test('renders Spanish by default', () => {
    render(
      <ReleaseNotesModal open note={mockNote} onGotIt={() => {}} onLater={() => {}} onNever={() => {}} />,
    );
    expect(screen.getByText('Título ES')).toBeInTheDocument();
    expect(screen.getByText('Entendido')).toBeInTheDocument();
  });

  test('toggles to English', () => {
    render(
      <ReleaseNotesModal open note={mockNote} onGotIt={() => {}} onLater={() => {}} onNever={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText('Title EN')).toBeInTheDocument();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  test('got it fires callback', () => {
    const onGotIt = jest.fn();
    render(
      <ReleaseNotesModal open note={mockNote} onGotIt={onGotIt} onLater={() => {}} onNever={() => {}} />,
    );
    fireEvent.click(screen.getByText('Entendido'));
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });

  test('later and never fire callbacks', () => {
    const onLater = jest.fn();
    const onNever = jest.fn();
    render(
      <ReleaseNotesModal open note={mockNote} onGotIt={() => {}} onLater={onLater} onNever={onNever} />,
    );
    fireEvent.click(screen.getByText('Ver después'));
    fireEvent.click(screen.getByText('No mostrar de nuevo'));
    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onNever).toHaveBeenCalledTimes(1);
  });

  test('hidden when closed', () => {
    const { container } = render(
      <ReleaseNotesModal open={false} note={mockNote} onGotIt={() => {}} onLater={() => {}} onNever={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
