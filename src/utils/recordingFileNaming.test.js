import { mimeToExt, extToMime, fileNameForBlob, keyFromFileName } from './recordingFileNaming';

describe('recordingFileNaming v4.105.0', () => {
  test('mimeToExt maps common audio/image types', () => {
    expect(mimeToExt('audio/webm;codecs=opus')).toBe('webm');
    expect(mimeToExt('audio/mpeg')).toBe('mp3');
    expect(mimeToExt('audio/mp4')).toBe('m4a');
    expect(mimeToExt('audio/wav')).toBe('wav');
    expect(mimeToExt('image/png')).toBe('png');
    expect(mimeToExt('image/jpeg')).toBe('jpg');
    expect(mimeToExt('')).toBe('bin');
    expect(mimeToExt('weird/type')).toBe('bin');
  });

  test('extToMime round-trips known extensions, empty otherwise', () => {
    expect(extToMime('greeting_en_morning.webm')).toBe('audio/webm');
    expect(extToMime('thumb_intake.PNG')).toBe('image/png');
    expect(extToMime('bg_app.jpg')).toBe('image/jpeg');
    expect(extToMime('mystery.bin')).toBe('');
    expect(extToMime('noext')).toBe('');
  });

  test('fileNameForBlob: filename IS the storage key', () => {
    expect(fileNameForBlob('greeting_en_morning', { type: 'audio/webm' })).toBe('greeting_en_morning.webm');
    expect(fileNameForBlob('thumb_intake', { type: 'image/png' })).toBe('thumb_intake.png');
    expect(fileNameForBlob('bg_app', { type: '' })).toBe('bg_app.bin');
  });

  test('keyFromFileName strips exactly one extension and any path', () => {
    expect(keyFromFileName('greeting_en_morning.webm')).toBe('greeting_en_morning');
    expect(keyFromFileName('C:\\backup\\intake.mp3')).toBe('intake');
    expect(keyFromFileName('/dl/thumb_intake.png')).toBe('thumb_intake');
    expect(keyFromFileName('noext')).toBe('noext');
    expect(keyFromFileName('')).toBe('');
  });

  test('round trip: key → filename → key is identity', () => {
    const key = 'greeting_es_afternoon';
    expect(keyFromFileName(fileNameForBlob(key, { type: 'audio/webm' }))).toBe(key);
  });
});
