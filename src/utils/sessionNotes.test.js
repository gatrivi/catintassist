import { archiveAndClearNotes, NOTES_KEY, NOTES_TRASH_PREFIX, NOTES_CLEARED_EVENT } from './sessionNotes';

beforeEach(() => localStorage.clear());

test('moves notes to trash, empties pad, fires cleared event', () => {
  localStorage.setItem(NOTES_KEY, 'DOB 03/14/1980');
  const onCleared = jest.fn();
  window.addEventListener(NOTES_CLEARED_EVENT, onCleared);
  archiveAndClearNotes();
  window.removeEventListener(NOTES_CLEARED_EVENT, onCleared);
  expect(localStorage.getItem(NOTES_KEY)).toBe('');
  const trash = Object.keys(localStorage).filter((k) => k.startsWith(NOTES_TRASH_PREFIX));
  expect(trash).toHaveLength(1);
  expect(localStorage.getItem(trash[0])).toBe('DOB 03/14/1980');
  expect(onCleared).toHaveBeenCalledTimes(1);
});

test('empty pad: no trash entry', () => {
  archiveAndClearNotes();
  expect(Object.keys(localStorage).some((k) => k.startsWith(NOTES_TRASH_PREFIX))).toBe(false);
});
