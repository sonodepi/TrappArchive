import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetTombstones, loadTombstones, recordTombstone, withTombstones, TOMBSTONES_KEY,
} from './tombstones';
import { reconcile } from './sync';
import type { SyncMeta } from './schema';

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

interface Voce { id: string; updatedAt: number; titolo?: string }

const voce = (id: string, updatedAt: number, titolo = 'x'): Voce & SyncMeta =>
  ({ id, updatedAt, titolo });

function sincronizza(local: (Voce & SyncMeta)[], remote: (Voce & SyncMeta)[], lastSyncAt: number) {
  return reconcile<Voce & SyncMeta>({
    local, remote, lastSyncAt,
    updatedAtOf: v => v.updatedAt,
    isDeleted: v => v.deleted === true,
  });
}

describe('le cancellazioni non devono risorgere dal cloud', () => {
  it('senza lapide una traccia cancellata torna indietro: e’ il difetto', () => {
    // Cancellata qui alle 500: sparita dall'elenco locale e basta. Il cloud ce
    // l'ha ancora, e la riconciliazione la legge per quello che sembra - una
    // voce arrivata da un altro dispositivo. La rimette dentro.
    const r = sincronizza([], [voce('a', 100)], 200);
    expect(r.toApply.map(v => v.id)).toEqual(['a']);
  });

  it('con la lapide la cancellazione sale al cloud, e la voce non torna', () => {
    recordTombstone('tracks', 'a', 500);
    const locali = withTombstones<Voce>([], 'tracks', loadTombstones());

    const r = sincronizza(locali as (Voce & SyncMeta)[], [voce('a', 100)], 200);
    expect(r.toApply).toEqual([]);
    expect(r.toPush.map(v => v.id)).toEqual(['a']);
    expect(r.toPush[0].deleted).toBe(true);
  });

  it('l’altro dispositivo riceve la lapide e toglie la voce anche da lui', () => {
    recordTombstone('tracks', 'a', 500);
    const lapide = withTombstones<Voce>([], 'tracks', loadTombstones())[0];

    // Sull'altro dispositivo la traccia c'e' ancora, piu' vecchia della lapide.
    const r = sincronizza([voce('a', 100)], [lapide as Voce & SyncMeta], 200);
    expect(r.toDelete).toEqual(['a']);
    expect(r.toApply).toEqual([]);
  });

  it('una modifica fatta altrove dopo la cancellazione vince sulla lapide', () => {
    // Vince chi ha toccato per ultimo: se qualcuno ha lavorato su quella
    // traccia dopo che io l'avevo cancellata, il suo lavoro non si butta.
    recordTombstone('tracks', 'a', 300);
    const locali = withTombstones<Voce>([], 'tracks', loadTombstones());

    const r = sincronizza(locali as (Voce & SyncMeta)[], [voce('a', 900, 'riscritta')], 200);
    expect(r.toApply.map(v => v.titolo)).toEqual(['riscritta']);
    expect(r.toPush).toEqual([]);
  });
});

describe('registro delle lapidi', () => {
  it('sopravvive al riavvio dell’app', () => {
    recordTombstone('albums', 'disco-1', 700);
    expect(loadTombstones()).toEqual([{ kind: 'albums', id: 'disco-1', updatedAt: 700 }]);
  });

  it('una seconda cancellazione della stessa voce sostituisce la prima', () => {
    recordTombstone('tracks', 'a', 100);
    recordTombstone('tracks', 'a', 900);
    expect(loadTombstones()).toEqual([{ kind: 'tracks', id: 'a', updatedAt: 900 }]);
  });

  it('tiene separate le raccolte: una bozza non e’ una traccia', () => {
    recordTombstone('tracks', 'stesso-id', 100);
    recordTombstone('drafts', 'stesso-id', 200);

    const graves = loadTombstones();
    expect(withTombstones<Voce>([], 'tracks', graves).map(v => v.updatedAt)).toEqual([100]);
    expect(withTombstones<Voce>([], 'drafts', graves).map(v => v.updatedAt)).toEqual([200]);
    expect(withTombstones<Voce>([], 'albums', graves)).toEqual([]);
  });

  it('lascia cadere la lapide di una voce che qui e’ di nuovo viva', () => {
    // Ricreata o riscaricata dopo la cancellazione: comanda l'elenco vero,
    // altrimenti la manderemmo via una seconda volta.
    recordTombstone('tracks', 'a', 100);
    const locali = withTombstones<Voce>([voce('a', 900)], 'tracks', loadTombstones());
    expect(locali).toHaveLength(1);
    expect(locali[0].deleted).toBeUndefined();
  });

  it('dopo la sincronizzazione dimentica solo quelle risolte', () => {
    recordTombstone('tracks', 'a', 100);
    recordTombstone('drafts', 'b', 200);

    forgetTombstones([{ kind: 'tracks', id: 'a', updatedAt: 100 }]);
    expect(loadTombstones()).toEqual([{ kind: 'drafts', id: 'b', updatedAt: 200 }]);
  });

  it('non tocca niente se non c’e’ niente da dimenticare', () => {
    recordTombstone('tracks', 'a', 100);
    forgetTombstones([]);
    expect(loadTombstones()).toHaveLength(1);
  });

  it('archivio vuoto: nessuna lapide e nessun errore', () => {
    expect(loadTombstones()).toEqual([]);
  });

  it('archivio corrotto: nessuna lapide e nessun errore', () => {
    localStorage.setItem(TOMBSTONES_KEY, '{non json');
    expect(loadTombstones()).toEqual([]);
  });

  it('scarta le voci malformate e tiene le buone', () => {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify([
      { kind: 'tracks', id: 'buona', updatedAt: 10 },
      { kind: 'inventata', id: 'x', updatedAt: 10 },
      { kind: 'tracks', updatedAt: 10 },
      { kind: 'tracks', id: 'senza-data' },
      'spazzatura',
    ]));
    expect(loadTombstones()).toEqual([{ kind: 'tracks', id: 'buona', updatedAt: 10 }]);
  });
});
