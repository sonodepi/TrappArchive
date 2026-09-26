import { describe, expect, it } from 'vitest';
import { extractYoutubeId } from './utils';

describe('extractYoutubeId', () => {
  it('riconosce i formati già supportati prima di questo fix', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    expect(extractYoutubeId('https://youtu.be/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    expect(extractYoutubeId('https://youtube.com/embed/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });

  it('non scambia un altro sito per YouTube solo perché contiene "youtu.be"', () => {
    // Il motivo dell'ancoraggio: senza, questo indirizzo passava per un video.
    expect(extractYoutubeId('https://altrosito.it/youtu.be/ABCDEFGHIJK')).toBeNull();
  });

  it('riconosce un link di YouTube Music (music.youtube.com)', () => {
    // Bug: prima funzionava, poi l'ancoraggio più stretto l'ha escluso.
    expect(extractYoutubeId('https://music.youtube.com/watch?v=ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });

  it('riconosce un embed da youtube-nocookie.com', () => {
    expect(extractYoutubeId('https://www.youtube-nocookie.com/embed/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    expect(extractYoutubeId('https://youtube-nocookie.com/embed/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });

  it('riconosce un link "shorts"', () => {
    expect(extractYoutubeId('https://www.youtube.com/shorts/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    // Con parametri dopo l'id, come quando lo shorts arriva da una condivisione.
    expect(extractYoutubeId('https://youtube.com/shorts/ABCDEFGHIJK?feature=share')).toBe('ABCDEFGHIJK');
  });

  it('ignora uno spazio incollato per sbaglio davanti al link', () => {
    expect(extractYoutubeId(' https://youtu.be/ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
  });

  it('resta null per un indirizzo vuoto o senza id riconoscibile', () => {
    expect(extractYoutubeId('')).toBeNull();
    expect(extractYoutubeId('https://esempio.it/pagina')).toBeNull();
  });

  it('T-02: si ferma all\'id e non si porta dietro un fragment con "#"', () => {
    // Bug: il gruppo di cattura non escludeva '#', quindi un timestamp
    // (#t=30s) restava attaccato all'id restituito.
    expect(extractYoutubeId('https://www.youtube.com/watch?v=ABCDEFGHIJK#t=30s')).toBe('ABCDEFGHIJK');
  });

  it('T-02: rifiuta un "id" che non ha la forma di un id YouTube reale', () => {
    // Un id vero è sempre 11 caratteri [A-Za-z0-9_-]; qualunque altra forma
    // (troncata, o allungata da qualcosa che l'ancoraggio ha lasciato passare)
    // non va restituita come se fosse valida.
    expect(extractYoutubeId('https://youtu.be/corto')).toBeNull();
    expect(extractYoutubeId('https://youtu.be/ABCDEFGHIJKLMNOP')).toBeNull();
  });
});
