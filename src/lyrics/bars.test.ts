import { describe, expect, it } from 'vitest';
import {
  applyCellInput, countBars, joinLines, mergeIntoPrevious, mergeNext,
  parseBars, readBar, segmentBar, writeBar,
} from './bars';

describe('cosa e’ ad lib e cosa no', () => {
  it('una barra senza parentesi e’ tutta del writer', () => {
    expect(segmentBar('Sto in studio dalle sei')).toEqual([
      { kind: 'writer', text: 'Sto in studio dalle sei' },
    ]);
  });

  it('riconosce la ad lib in mezzo alla barra, parentesi comprese', () => {
    // Le parentesi restano dentro il pezzo giallo: a video si devono vedere.
    expect(segmentBar('Sto in studio (ehi) dalle sei')).toEqual([
      { kind: 'writer', text: 'Sto in studio ' },
      { kind: 'adlib', text: '(ehi)' },
      { kind: 'writer', text: ' dalle sei' },
    ]);
  });

  it('una parentesi aperta e mai chiusa colora fino a fine riga', () => {
    // E’ il caso di chi sta ancora scrivendo: il giallo parte subito.
    expect(segmentBar('Sto in studio (eh')).toEqual([
      { kind: 'writer', text: 'Sto in studio ' },
      { kind: 'adlib', text: '(eh' },
    ]);
  });

  it('le parentesi annidate restano una ad lib sola', () => {
    expect(segmentBar('(ehi (forte))')).toEqual([{ kind: 'adlib', text: '(ehi (forte))' }]);
  });

  it('una parentesi chiusa senza la sua aperta non colora niente', () => {
    expect(segmentBar('smile :) sempre')).toEqual([
      { kind: 'writer', text: 'smile :) sempre' },
    ]);
  });

  it('una barra fatta solo di ad libs e’ tutta gialla', () => {
    expect(segmentBar('(skrrt, skrrt)')).toEqual([{ kind: 'adlib', text: '(skrrt, skrrt)' }]);
  });
});

describe('numero delle barre', () => {
  it('numera le righe scritte, una per una', () => {
    const bars = parseBars('prima\nseconda\nterza');
    expect(bars.map(b => b.number)).toEqual([1, 2, 3]);
  });

  it('una barra lunga resta una barra sola, per quanto vada a capo a video', () => {
    // Il numero conta le righe del testo, non quelle dello schermo: e’ il punto
    // di tutta la numerazione.
    const lunga = 'parola '.repeat(60).trim();
    expect(countBars(lunga)).toBe(1);
    expect(parseBars(lunga).map(b => b.number)).toEqual([1]);
  });

  it('le righe vuote separano le strofe e non sono barre', () => {
    const bars = parseBars('prima\n\nseconda');
    expect(bars.map(b => b.number)).toEqual([1, null, 2]);
    expect(countBars('prima\n\nseconda')).toBe(2);
  });

  it('una riga di soli spazi non e’ una barra', () => {
    expect(parseBars('prima\n   \nseconda').map(b => b.number)).toEqual([1, null, 2]);
  });

  it('una barra di sole ad libs conta come barra', () => {
    expect(countBars('(skrrt)')).toBe(1);
  });
});

describe('le due colonne sono una proiezione, non un secondo formato', () => {
  it('una riga senza ad libs esce identica a com’e’ entrata', () => {
    // Nessuna ripulitura: mentre si scrive il testo non deve cambiare sotto le
    // dita, nemmeno di uno spazio.
    const line = '  due  spazi  e uno finale ';
    expect(readBar(line)).toEqual({ writer: line, adlibs: '' });
    expect(writeBar(readBar(line))).toBe(line);
  });

  it('separa testo e ad libs, e le ricompone identiche', () => {
    const line = 'Sto in studio (ehi)';
    expect(readBar(line)).toEqual({ writer: 'Sto in studio ', adlibs: 'ehi' });
    expect(writeBar(readBar(line))).toBe(line);
  });

  it('chiude il buco lasciato da una ad lib tolta di mezzo', () => {
    expect(readBar('Sto in studio (ehi) dalle sei')).toEqual({
      writer: 'Sto in studio dalle sei',
      adlibs: 'ehi',
    });
  });

  it('raccoglie piu’ gruppi di ad libs in una colonna sola', () => {
    // Lo spazio in fondo e’ quello che separava il testo dall’ultima ad lib:
    // resta li’ perche’ ricomponendo la barra torni esattamente alla riga di
    // partenza. A video non si vede, e il cursore ci sta dentro senza problemi.
    expect(readBar('Sto (ehi) in studio (ouu)')).toEqual({
      writer: 'Sto in studio ',
      adlibs: 'ehi ouu',
    });
    expect(writeBar(readBar('Sto in studio (ehi ouu)'))).toBe('Sto in studio (ehi ouu)');
  });

  it('rimette le ad libs in fondo alla barra, con lo spazio davanti', () => {
    expect(writeBar({ writer: 'Sto in studio', adlibs: 'ehi' })).toBe('Sto in studio (ehi)');
  });

  it('una barra di sole ad libs non si porta dietro spazi', () => {
    expect(writeBar({ writer: '', adlibs: 'skrrt' })).toBe('(skrrt)');
  });

  it('senza ad libs non compaiono parentesi vuote', () => {
    expect(writeBar({ writer: 'Sto in studio', adlibs: '' })).toBe('Sto in studio');
  });
});

describe('scrivere dentro una colonna', () => {
  it('cambiare il testo lascia stare le ad libs della stessa barra', () => {
    const { lines } = applyCellInput(['Sto in studio (ehi)'], 0, 'writer', 'Sto in cabina', 13);
    expect(lines).toEqual(['Sto in cabina (ehi)']);
  });

  it('cambiare le ad libs lascia stare il testo', () => {
    const { lines } = applyCellInput(['Sto in studio (ehi)'], 0, 'adlibs', 'ouu', 3);
    expect(lines).toEqual(['Sto in studio (ouu)']);
  });

  it('non tocca nemmeno un carattere delle altre barre', () => {
    // Le barre con le ad libs in mezzo vengono normalizzate solo quando le
    // modifichi: quelle che nessuno tocca restano com’erano.
    const before = ['Sto (ehi) in studio (ouu)', 'seconda barra', 'terza barra'];
    const { lines } = applyCellInput(before, 1, 'writer', 'seconda barra!', 14);
    expect(lines[0]).toBe(before[0]);
    expect(lines[2]).toBe(before[2]);
  });

  it('l’invio spezza la barra in due, e le ad libs restano su quella di sopra', () => {
    const out = applyCellInput(['Sto in studio (ehi)'], 0, 'writer', 'Sto in\nstudio', 7);
    expect(out.lines).toEqual(['Sto in (ehi)', 'studio']);
    expect(out.focus).toEqual({ index: 1, column: 'writer', caret: 0 });
  });

  it('un testo incollato su piu’ righe diventa piu’ barre', () => {
    const out = applyCellInput([''], 0, 'writer', 'prima\nseconda\nterza', 19);
    expect(out.lines).toEqual(['prima', 'seconda', 'terza']);
    expect(out.focus).toEqual({ index: 2, column: 'writer', caret: 5 });
  });

  it('un testo incollato con le parentesi si divide da solo fra le colonne', () => {
    // Incollare un testo gia’ scritto nella colonna bianca non richiede di
    // sistemare niente a mano: le ad libs vanno al loro posto al primo giro.
    const out = applyCellInput([''], 0, 'writer', 'Sto in studio (ehi)\nCon la banda (banda)', 40);
    expect(out.lines).toEqual(['Sto in studio (ehi)', 'Con la banda (banda)']);
    expect(parseBars(joinLines(out.lines)).map(b => b.adlibs)).toEqual(['ehi', 'banda']);
  });

  it('svuotare una cella non cancella l’altra colonna', () => {
    const { lines } = applyCellInput(['Sto in studio (ehi)'], 0, 'writer', '', 0);
    expect(lines).toEqual(['(ehi)']);
  });
});

describe('unire due barre', () => {
  it('attacca la barra a quella sopra, colonna per colonna', () => {
    const out = mergeIntoPrevious(['Sto in studio (ehi)', 'con la banda (banda)'], 1, 'writer');
    expect(out?.lines).toEqual(['Sto in studio con la banda (ehi banda)']);
  });

  it('lascia il cursore nel punto di giuntura', () => {
    const out = mergeIntoPrevious(['Sto in ', 'studio'], 1, 'writer');
    expect(out?.lines).toEqual(['Sto in studio']);
    expect(out?.focus).toEqual({ index: 0, column: 'writer', caret: 7 });
  });

  it('nella colonna gialla il cursore finisce in fondo alle ad libs di sopra', () => {
    const out = mergeIntoPrevious(['Sto (ehi)', 'in studio (ouu)'], 1, 'adlibs');
    expect(out?.focus).toEqual({ index: 0, column: 'adlibs', caret: 3 });
  });

  it('sulla prima barra non c’e’ niente sopra: non fa niente', () => {
    expect(mergeIntoPrevious(['Sto in studio'], 0, 'writer')).toBeNull();
  });

  it('Canc a fine barra tira su quella dopo', () => {
    const out = mergeNext(['Sto in ', 'studio'], 0, 'writer');
    expect(out?.lines).toEqual(['Sto in studio']);
    expect(out?.focus).toEqual({ index: 0, column: 'writer', caret: 7 });
  });

  it('sull’ultima barra non c’e’ niente sotto: non fa niente', () => {
    expect(mergeNext(['Sto in studio'], 0, 'writer')).toBeNull();
  });

  it('unire su una riga vuota non lascia spazi in testa', () => {
    const out = mergeIntoPrevious(['', 'studio'], 1, 'writer');
    expect(out?.lines).toEqual(['studio']);
    expect(out?.focus).toEqual({ index: 0, column: 'writer', caret: 0 });
  });
});
