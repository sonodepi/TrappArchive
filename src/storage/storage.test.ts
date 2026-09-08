import { beforeEach, describe, expect, it } from 'vitest';
import { migrateAudioSource, parseDraft, parseList, parseTrack } from './migrate';
import { ALBUMS_KEY, DRAFTS_KEY, TRACKS_KEY, loadCatalog, saveCatalog } from './catalog';
import type { Track } from '../types';

/** localStorage minimo: i test girano in Node, dove non esiste. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('migrateAudioSource', () => {
  it('tratta un blob: URL salvato come audio non piu’ disponibile', () => {
    // E' il cuore del difetto: quel riferimento muore con la sessione, quindi
    // non puo' essere presentato come un file valido.
    expect(migrateAudioSource({ audioFilePath: 'blob:http://localhost/9f3a-1234' }))
      .toEqual({ kind: 'unavailable' });
  });

  it('conserva un indirizzo remoto, che resta valido', () => {
    expect(migrateAudioSource({ audioFilePath: 'https://esempio.it/base.mp3' }))
      .toEqual({ kind: 'remote', url: 'https://esempio.it/base.mp3' });
  });

  it('non inventa una sorgente quando il campo e’ vuoto', () => {
    expect(migrateAudioSource({ audioFilePath: '' })).toBeUndefined();
    expect(migrateAudioSource({ audioFilePath: '   ' })).toBeUndefined();
    expect(migrateAudioSource({})).toBeUndefined();
  });

  it('lascia intatta una sorgente gia’ nel formato nuovo', () => {
    const source = { kind: 'local', name: 'beat.mp3', mimeType: 'audio/mpeg', sizeBytes: 4096 };
    expect(migrateAudioSource({ audio: source })).toEqual(source);
  });

  it('non si fida dei campi di una sorgente locale malformata', () => {
    const result = migrateAudioSource({ audio: { kind: 'local' } });
    expect(result).toEqual({ kind: 'local', name: 'audio', mimeType: 'audio/mpeg', sizeBytes: 0 });
  });
});

describe('parseTrack', () => {
  it('scarta cio’ che non ha un id, perche’ non sarebbe indirizzabile', () => {
    expect(parseTrack({ title: 'Senza id' })).toBeNull();
    expect(parseTrack(null)).toBeNull();
    expect(parseTrack('una stringa')).toBeNull();
    expect(parseTrack([])).toBeNull();
  });

  it('recupera una traccia con campi mancanti invece di buttarla', () => {
    const track = parseTrack({ id: 'a1' });
    expect(track).not.toBeNull();
    expect(track!.title).toBe('Senza titolo');
    expect(track!.featurings).toEqual([]);
    expect(track!.durationMs).toBe(0);
  });

  it('ignora i tipi sbagliati senza propagarli nello stato', () => {
    const track = parseTrack({
      id: 'a1', title: 42, featurings: ['Tizio', 7, null], durationMs: 'molto', bpm: 'tanti',
    });
    expect(track!.title).toBe('Senza titolo');
    expect(track!.featurings).toEqual(['Tizio']);
    expect(track!.durationMs).toBe(0);
    expect(track!.bpm).toBeUndefined();
  });

  it('converte il vecchio campo audioFilePath', () => {
    const track = parseTrack({ id: 'a1', audioFilePath: 'blob:http://x/1' });
    expect(track!.audio).toEqual({ kind: 'unavailable' });
  });
});

describe('parseList', () => {
  it('conta le voci scartate invece di farle sparire in silenzio', () => {
    const result = parseList([{ id: 'a' }, { nope: true }, { id: 'b' }, null], parseTrack);
    expect(result.items).toHaveLength(2);
    expect(result.skipped).toBe(2);
  });

  it('restituisce una lista vuota se il dato non e’ un array', () => {
    expect(parseList({ id: 'a' }, parseTrack)).toEqual({ items: [], skipped: 0 });
  });
});

describe('catalogo su localStorage', () => {
  const track: Track = {
    id: 't1', title: 'Bandana', producer: 'NKO', mainArtist: 'Tizio',
    featurings: [], lyrics: 'versi', durationMs: 1000, createdAt: 1,
  };

  it('rilegge cio’ che ha scritto', () => {
    expect(saveCatalog([track], [], []).ok).toBe(true);
    const loaded = loadCatalog();
    expect(loaded.tracks).toHaveLength(1);
    expect(loaded.tracks[0].title).toBe('Bandana');
    expect(loaded.problems).toHaveLength(0);
  });

  it('non cancella i dati illeggibili e segnala il problema', () => {
    // Il codice precedente aveva un `catch {}`: il catalogo spariva senza
    // spiegazione e il primo salvataggio successivo rendeva la perdita
    // definitiva.
    localStorage.setItem(TRACKS_KEY, '{rotto');
    const loaded = loadCatalog();

    expect(loaded.tracks).toEqual([]);
    expect(loaded.problems).toHaveLength(1);

    const recoveryKey = loaded.problems[0].recoveryKey;
    expect(recoveryKey).toBeDefined();
    expect(localStorage.getItem(recoveryKey!)).toBe('{rotto');
  });

  it('segnala le voci incomplete scartate', () => {
    localStorage.setItem(TRACKS_KEY, JSON.stringify([{ id: 'ok' }, { senzaId: true }]));
    const loaded = loadCatalog();
    expect(loaded.tracks).toHaveLength(1);
    expect(loaded.problems[0].message).toContain('1 voci');
  });

  it('parte da vuoto senza inventare problemi', () => {
    const loaded = loadCatalog();
    expect(loaded).toMatchObject({ tracks: [], albums: [], drafts: [], problems: [] });
  });

  it('legge le tre collezioni in modo indipendente', () => {
    localStorage.setItem(ALBUMS_KEY, JSON.stringify([{ id: 'al1', title: 'Disco' }]));
    localStorage.setItem(DRAFTS_KEY, JSON.stringify([{ id: 'd1', title: 'Bozza' }]));
    const loaded = loadCatalog();
    expect(loaded.albums).toHaveLength(1);
    expect(loaded.drafts).toHaveLength(1);
    expect(loaded.tracks).toHaveLength(0);
  });
});

describe('bozze', () => {
  it('non richiede piu’ un codice di sessione', () => {
    // shareCode prometteva una connessione che non e' mai esistita: una bozza
    // senza codice deve restare perfettamente valida.
    const draft = parseDraft({ id: 'd1', title: 'Mia bozza' });
    expect(draft).not.toBeNull();
    expect(draft).not.toHaveProperty('shareCode');
  });

  it('converte le vecchie due colonne in blocchi, senza perdere testo', () => {
    const draft = parseDraft({
      id: 'd1', ownerLyrics: 'strofa mia', collaboratorLyrics: 'strofa sua',
    });
    expect(draft!.blocks).toHaveLength(2);
    expect(draft!.blocks.map(b => b.text)).toEqual(['strofa mia', 'strofa sua']);
    expect(draft!.blocks[0].label).toBe('Strofa 1');
  });

  it('recupera anche il testo di chi scriveva da solo', () => {
    const draft = parseDraft({ id: 'd1', lyrics: 'scritto per conto mio' });
    expect(draft!.blocks).toHaveLength(1);
    expect(draft!.blocks[0].text).toBe('scritto per conto mio');
  });

  it('non fa entrare piu’ di quattro persone', () => {
    const draft = parseDraft({
      id: 'd1',
      authors: Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, name: `A${i}` })),
    });
    expect(draft!.authors).toHaveLength(4);
  });
});
