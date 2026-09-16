import { describe, expect, it } from 'vitest';
import type { Sporca } from '../../types';
import {
  ORPHAN_LINE,
  anchoredSporche,
  countWords,
  orphanedSporche,
  reflowFullReplace,
  reflowLineDelete,
  reflowLineEdit,
  reflowLineInsert,
  reflowOnTextChange,
} from './sporche';

function s(over: Partial<Sporca> & Pick<Sporca, 'riga' | 'dopoParola'>): Sporca {
  return { id: over.id ?? crypto.randomUUID(), testo: over.testo ?? 'yeah', ...over };
}

describe('countWords', () => {
  it('conta le parole ignorando gli spazi doppi e ai bordi', () => {
    expect(countWords('  ciao   mondo  ')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('una')).toBe(1);
  });
});

describe('anchoredSporche / orphanedSporche', () => {
  it('separa le sporche che puntano a una riga che esiste da quelle che non la trovano più', () => {
    const sporche = [s({ riga: 0, dopoParola: 1 }), s({ riga: 2, dopoParola: 0 }), s({ riga: ORPHAN_LINE, dopoParola: 0 })];
    expect(anchoredSporche(sporche, 2)).toHaveLength(1);
    expect(orphanedSporche(sporche, 2)).toHaveLength(2);
  });
});

describe('reflowLineEdit', () => {
  it('lascia intatta una sporca se la riga ha ancora abbastanza parole', () => {
    const sporche = [s({ riga: 1, dopoParola: 2 })];
    const result = reflowLineEdit(sporche, 1, 'tre parole qui');
    expect(result[0].dopoParola).toBe(2);
  });

  it('togliere parole da una riga non fa sparire la sua sporca: scala a fine riga', () => {
    const sporche = [s({ riga: 1, dopoParola: 3, testo: '(yeah)' })];
    const result = reflowLineEdit(sporche, 1, 'una sola');
    expect(result).toHaveLength(1);
    expect(result[0].dopoParola).toBe(2);
    expect(result[0].testo).toBe('(yeah)');
  });

  it('non tocca le sporche di altre righe', () => {
    const sporche = [s({ riga: 0, dopoParola: 5 })];
    const result = reflowLineEdit(sporche, 1, 'x');
    expect(result[0].dopoParola).toBe(5);
  });
});

describe('reflowLineInsert', () => {
  it("sposta giu' di uno le sporche sotto la riga inserita", () => {
    const sporche = [s({ riga: 0, dopoParola: 1 }), s({ riga: 2, dopoParola: 0 })];
    const result = reflowLineInsert(sporche, 1);
    expect(result.find(x => x.dopoParola === 1)!.riga).toBe(0);
    expect(result.find(x => x.dopoParola === 0)!.riga).toBe(3);
  });
});

describe('reflowLineDelete', () => {
  it('manda in "non agganciate" le sporche della riga cancellata, non le perde', () => {
    const sporche = [s({ riga: 1, dopoParola: 0, testo: '(skrrt)' })];
    const result = reflowLineDelete(sporche, 1);
    expect(result[0].riga).toBe(ORPHAN_LINE);
    expect(result[0].testo).toBe('(skrrt)');
  });

  it('sposta su di uno le sporche sotto la riga cancellata', () => {
    const sporche = [s({ riga: 3, dopoParola: 0 })];
    const result = reflowLineDelete(sporche, 1);
    expect(result[0].riga).toBe(2);
  });
});

describe('reflowFullReplace', () => {
  it("orfaneggia le sporche il cui indice non esiste piu'", () => {
    const sporche = [s({ riga: 5, dopoParola: 0 })];
    const result = reflowFullReplace(sporche, ['sola riga']);
    expect(result[0].riga).toBe(ORPHAN_LINE);
  });

  it('clampa dopoParola alla nuova lunghezza della riga', () => {
    const sporche = [s({ riga: 0, dopoParola: 10 })];
    const result = reflowFullReplace(sporche, ['due parole']);
    expect(result[0].riga).toBe(0);
    expect(result[0].dopoParola).toBe(2);
  });
});

describe('reflowOnTextChange', () => {
  it('modifica di parole sulla stessa riga: la sporca resta, si clampa se serve', () => {
    const sporche = [s({ riga: 1, dopoParola: 3 })];
    const result = reflowOnTextChange(sporche, 'prima riga\nseconda riga qui', 'prima riga\nsolo due');
    expect(result[0].riga).toBe(1);
    expect(result[0].dopoParola).toBe(2);
  });

  it('inserire una riga sopra sposta gli indici delle sporche sotto', () => {
    const sporche = [s({ riga: 1, dopoParola: 0 })];
    const result = reflowOnTextChange(sporche, 'a\nb', 'a\nnuova\nb');
    expect(result[0].riga).toBe(2);
  });

  it('cancellare una riga con sporche le manda in "non agganciate", non le perde', () => {
    const sporche = [s({ riga: 0, dopoParola: 0, testo: '(uh)' })];
    const result = reflowOnTextChange(sporche, 'a\nb\nc', 'b\nc');
    expect(result[0].riga).toBe(ORPHAN_LINE);
    expect(result[0].testo).toBe('(uh)');
  });

  it("incollare tutto il testo da capo orfaneggia cio' che non trova piu' posto", () => {
    const sporche = [s({ riga: 4, dopoParola: 0 })];
    const result = reflowOnTextChange(sporche, 'a\nb\nc\nd\ne', 'tutto nuovo');
    expect(result[0].riga).toBe(ORPHAN_LINE);
  });

  it("non cambia nulla se il testo non e' cambiato", () => {
    const sporche = [s({ riga: 0, dopoParola: 0 })];
    expect(reflowOnTextChange(sporche, 'x', 'x')).toBe(sporche);
  });
});
