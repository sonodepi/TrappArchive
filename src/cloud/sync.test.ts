import { describe, expect, it } from 'vitest';
import { describeSync, reconcile, type Reconciliation } from './sync';
import { tombstone, trackUpdatedAt } from './schema';

interface Row { id: string; updatedAt: number; deleted?: boolean; text?: string }

const at = (id: string, updatedAt: number, over: Partial<Row> = {}): Row =>
  ({ id, updatedAt, ...over });

function run(local: Row[], remote: Row[], lastSyncAt: number): Reconciliation<Row> {
  return reconcile<Row>({
    local, remote, lastSyncAt,
    updatedAtOf: r => r.updatedAt,
    isDeleted: r => r.deleted === true,
  });
}

describe('riconciliazione locale/cloud', () => {
  it('non fa niente quando le due copie coincidono', () => {
    const r = run([at('a', 100)], [at('a', 100)], 200);
    expect(r.toPush).toEqual([]);
    expect(r.toApply).toEqual([]);
    expect(r.unchanged).toBe(1);
  });

  it('carica quello che ho modificato solo io', () => {
    const r = run([at('a', 500)], [at('a', 100)], 200);
    expect(r.toPush.map(x => x.id)).toEqual(['a']);
    expect(r.conflicts).toEqual([]);
  });

  it('applica quello che e’ stato modificato su un altro dispositivo', () => {
    const r = run([at('a', 100)], [at('a', 500)], 200);
    expect(r.toApply.map(x => x.id)).toEqual(['a']);
    expect(r.conflicts).toEqual([]);
  });

  it('carica una voce nuova che il cloud non ha', () => {
    // Creata dopo l'ultima sincronizzazione: e' nuova, non e' stata eliminata.
    const r = run([at('nuova', 900)], [], 200);
    expect(r.toPush.map(x => x.id)).toEqual(['nuova']);
    expect(r.toDelete).toEqual([]);
  });

  it('scarica una voce arrivata da un altro dispositivo', () => {
    const r = run([], [at('altrui', 900)], 200);
    expect(r.toApply.map(x => x.id)).toEqual(['altrui']);
  });

  it('rimuove qui cio’ che e’ stato eliminato altrove', () => {
    const r = run([at('a', 100)], [tombstone(at('a', 100))], 200);
    expect(r.toDelete).toEqual(['a']);
    expect(r.toApply).toEqual([]);
  });

  it('non fa resuscitare una voce eliminata', () => {
    // Senza la lapide, il dispositivo che era offline durante la cancellazione
    // la ricaricherebbe come "voce che il cloud non ha": tornerebbe indietro a
    // ogni sincronizzazione.
    const eliminata = tombstone(at('a', 50));
    const r = run([], [eliminata], 200);
    expect(r.toApply).toEqual([]);
    expect(r.toPush).toEqual([]);
  });

  it('toglie quello che esisteva gia’ e il cloud non ha piu’', () => {
    // Non modificata dopo l'ultimo allineamento: se il cloud non ce l'ha,
    // e' perche' e' stata eliminata, non perche' e' nuova.
    const r = run([at('vecchia', 50)], [], 200);
    expect(r.toDelete).toEqual(['vecchia']);
    expect(r.toPush).toEqual([]);
  });

  it('dichiara il conflitto quando entrambi hanno modificato', () => {
    // Il confronto con lastSyncAt e' cio' che distingue questo caso da
    // "modificata solo da una parte": senza, sarebbero identici.
    const r = run([at('a', 300, { text: 'mia' })], [at('a', 500, { text: 'sua' })], 200);
    expect(r.conflicts).toEqual(['a']);
    expect(r.toApply[0].text).toBe('sua');
  });

  it('non chiama conflitto una modifica avvenuta da un lato solo', () => {
    // Locale toccato dopo l'allineamento, remoto fermo da prima.
    const r = run([at('a', 300)], [at('a', 100)], 200);
    expect(r.conflicts).toEqual([]);
    expect(r.toPush.map(x => x.id)).toEqual(['a']);
  });

  it('regge la prima sincronizzazione, quando non ce n’e’ mai stata una', () => {
    const r = run([at('a', 100), at('b', 200)], [at('c', 300)], 0);
    expect(r.toPush.map(x => x.id).sort()).toEqual(['a', 'b']);
    expect(r.toApply.map(x => x.id)).toEqual(['c']);
    expect(r.toDelete).toEqual([]);
    expect(r.conflicts).toEqual([]);
  });

  it('gestisce insieme piu’ casi diversi', () => {
    const r = run(
      [at('uguale', 100), at('mia', 500), at('sua', 100), at('nuova', 900)],
      [at('uguale', 100), at('mia', 100), at('sua', 500), at('altrui', 400)],
      200,
    );
    expect(r.unchanged).toBe(1);
    expect(r.toPush.map(x => x.id).sort()).toEqual(['mia', 'nuova']);
    expect(r.toApply.map(x => x.id).sort()).toEqual(['altrui', 'sua']);
  });
});

describe('data di riferimento delle tracce', () => {
  it('usa la creazione finche’ non c’e’ una modifica', () => {
    expect(trackUpdatedAt({ createdAt: 111 } as never)).toBe(111);
    expect(trackUpdatedAt({ createdAt: 111, updatedAt: 222 } as never)).toBe(222);
  });
});

describe('resoconto della sincronizzazione', () => {
  const vuoto: Reconciliation<unknown> =
    { toPush: [], toApply: [], toDelete: [], conflicts: [], unchanged: 0 };

  it('dice chiaramente quando non c’era niente da fare', () => {
    expect(describeSync([{ label: 'tracce', r: vuoto }]))
      .toContain('Già allineato');
  });

  it('riporta numeri veri, divisi per direzione', () => {
    const text = describeSync([
      { label: 'tracce', r: { ...vuoto, toPush: [1, 2], toApply: [3] } },
      { label: 'bozze', r: { ...vuoto, toDelete: ['x'] } },
    ]);
    expect(text).toContain('2 inviate');
    expect(text).toContain('1 ricevute');
    expect(text).toContain('1 rimosse');
  });

  it('avvisa dei conflitti indicando dove', () => {
    const text = describeSync([
      { label: 'bozze', r: { ...vuoto, toApply: [1], conflicts: ['d1'] } },
    ]);
    expect(text).toContain('1 in bozze');
    expect(text).toContain('due dispositivi');
  });
});
