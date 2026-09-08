import { describe, expect, it } from 'vitest';
import {
  canAddAuthor, canEditBlock, describeMerge, isOwner, mergeBlocks, mergeDrafts, nextBlockLabel,
} from './collab';
import { MAX_AUTHORS, type DraftBlock, type DraftProject } from '../types';

const CAPO = 'autore-capo';
const OSPITE = 'autore-ospite';

function block(over: Partial<DraftBlock> = {}): DraftBlock {
  return {
    id: 'b1', label: 'Strofa 1', authorId: CAPO, text: '', done: false, updatedAt: 1000, ...over,
  };
}

function draft(over: Partial<DraftProject> = {}): DraftProject {
  return {
    id: 'd1', title: 'Pezzo', lyrics: '', ownerId: CAPO,
    authors: [{ id: CAPO, name: 'Capo', colorIndex: 0 }],
    blocks: [], beatUrl: '', updatedAt: 1000, ...over,
  };
}

describe('permessi', () => {
  it('solo chi ha creato la bozza puo’ unire e riorganizzare', () => {
    const d = draft();
    expect(isOwner(d, CAPO)).toBe(true);
    expect(isOwner(d, OSPITE)).toBe(false);
  });

  it('si scrive nei propri blocchi e in quelli liberi, non in quelli altrui', () => {
    expect(canEditBlock(block({ authorId: OSPITE }), OSPITE)).toBe(true);
    expect(canEditBlock(block({ authorId: null }), OSPITE)).toBe(true);
    expect(canEditBlock(block({ authorId: CAPO }), OSPITE)).toBe(false);
  });

  it('il limite di persone e’ quattro', () => {
    const pieno = draft({
      authors: Array.from({ length: MAX_AUTHORS }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, colorIndex: i,
      })),
    });
    expect(canAddAuthor(pieno)).toBe(false);
    expect(canAddAuthor(draft())).toBe(true);
  });
});

describe('unione dei blocchi nel testo finale', () => {
  it('separa i blocchi con la loro intestazione', () => {
    const testo = mergeBlocks([
      block({ id: 'b1', label: 'Strofa 1', text: 'primo verso' }),
      block({ id: 'b2', label: 'Ritornello', text: 'il gancio' }),
    ]);
    expect(testo).toBe('[Strofa 1]\nprimo verso\n\n[Ritornello]\nil gancio');
  });

  it('non stampa le etichette dei blocchi vuoti', () => {
    const testo = mergeBlocks([
      block({ id: 'b1', label: 'Strofa 1', text: 'ci sono' }),
      block({ id: 'b2', label: 'Strofa 2', text: '   ' }),
    ]);
    expect(testo).toBe('[Strofa 1]\nci sono');
  });
});

describe('etichette proposte', () => {
  it('propone il prossimo pezzo della struttura senza ripetersi', () => {
    expect(nextBlockLabel([])).toBe('Strofa 1');
    expect(nextBlockLabel([block({ label: 'Strofa 1' })])).toBe('Ritornello');
  });
});

describe('fusione di due copie della stessa bozza', () => {
  it('prende il blocco piu’ recente dell’altro senza toccare il mio', () => {
    // Lo scenario normale: ognuno ha scritto nel proprio blocco.
    const mia = draft({
      blocks: [
        block({ id: 'b1', authorId: CAPO, text: 'la mia strofa', updatedAt: 2000 }),
        block({ id: 'b2', authorId: OSPITE, text: '', updatedAt: 1000 }),
      ],
    });
    const ricevuta = draft({
      authors: [
        { id: CAPO, name: 'Capo', colorIndex: 0 },
        { id: OSPITE, name: 'Ospite', colorIndex: 1 },
      ],
      blocks: [
        block({ id: 'b1', authorId: CAPO, text: 'vecchia', updatedAt: 1500 }),
        block({ id: 'b2', authorId: OSPITE, text: 'la sua strofa', updatedAt: 3000 }),
      ],
    });

    const report = mergeDrafts(mia, ricevuta);
    expect(report.draft.blocks.find(b => b.id === 'b1')!.text).toBe('la mia strofa');
    expect(report.draft.blocks.find(b => b.id === 'b2')!.text).toBe('la sua strofa');
    expect(report.updated).toBe(1);
    expect(report.conflicts).toEqual([]);
  });

  it('aggiunge i blocchi che non avevo', () => {
    const report = mergeDrafts(
      draft({ blocks: [block({ id: 'b1', text: 'mio' })] }),
      draft({ blocks: [
        block({ id: 'b1', text: 'mio' }),
        block({ id: 'b9', label: 'Bridge', text: 'nuovo', authorId: null }),
      ] }),
    );
    expect(report.added).toBe(1);
    expect(report.draft.blocks).toHaveLength(2);
  });

  it('dichiara il conflitto invece di far sparire il testo in silenzio', () => {
    // Entrambi hanno toccato lo stesso blocco: qualcosa si perde per forza,
    // ma chi unisce deve saperlo.
    const report = mergeDrafts(
      draft({ blocks: [block({ id: 'b1', label: 'Ritornello', text: 'la mia', updatedAt: 2000 })] }),
      draft({ blocks: [block({ id: 'b1', label: 'Ritornello', text: 'la sua', updatedAt: 5000 })] }),
    );
    expect(report.conflicts).toEqual(['Ritornello']);
    expect(report.draft.blocks[0].text).toBe('la sua');
    expect(describeMerge(report)).toContain('Ritornello');
  });

  it('non segnala conflitto se da parte mia il blocco era vuoto', () => {
    const report = mergeDrafts(
      draft({ blocks: [block({ id: 'b1', text: '', updatedAt: 1000 })] }),
      draft({ blocks: [block({ id: 'b1', text: 'scritto', updatedAt: 5000 })] }),
    );
    expect(report.conflicts).toEqual([]);
    expect(report.draft.blocks[0].text).toBe('scritto');
  });

  it('accoglie i nuovi autori fino al limite e dice chi resta fuori', () => {
    const mia = draft({
      authors: Array.from({ length: MAX_AUTHORS }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, colorIndex: i,
      })),
    });
    const ricevuta = draft({ authors: [{ id: 'extra', name: 'Quinto', colorIndex: 0 }] });

    const report = mergeDrafts(mia, ricevuta);
    expect(report.draft.authors).toHaveLength(MAX_AUTHORS);
    expect(report.rejectedAuthors).toEqual(['Quinto']);
    expect(describeMerge(report)).toContain('Quinto');
  });

  it('non lascia blocchi assegnati a un autore che non e’ nella bozza', () => {
    // Altrimenti l'interfaccia mostrerebbe un blocco di nessuno, non
    // modificabile da nessuno.
    const report = mergeDrafts(
      draft(),
      draft({ authors: [], blocks: [block({ id: 'b9', authorId: 'fantasma' })] }),
    );
    expect(report.draft.blocks[0].authorId).toBeNull();
  });

  it('dice chiaramente quando non e’ cambiato nulla', () => {
    const uguale = draft({ blocks: [block({ id: 'b1', text: 'x', updatedAt: 1000 })] });
    const report = mergeDrafts(uguale, uguale);
    expect(report.updated).toBe(0);
    expect(report.added).toBe(0);
    expect(describeMerge(report)).toContain('nessuna novità');
  });

  it('conserva titolo e base di chi possiede la bozza', () => {
    const report = mergeDrafts(
      draft({ title: 'Il mio titolo', beatUrl: 'mia-base' }),
      draft({ title: 'Il suo titolo', beatUrl: 'sua-base' }),
    );
    expect(report.draft.title).toBe('Il mio titolo');
    expect(report.draft.beatUrl).toBe('mia-base');
  });
});
