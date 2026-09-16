/**
 * Operazioni pure sulle sporche quando il testo cambia.
 *
 * Una sporca è agganciata a "dopo la parola N della riga R". Qui vivono le
 * regole che tengono quell'aggancio vivo (o lo dichiarano perso) quando chi
 * scrive tocca il testo: non toccano mai `lyrics`, che resta la stringa che
 * l'utente ha scritto, intatta.
 *
 * `ORPHAN_LINE` è la sentinella per "non agganciata": una sporca con quel
 * valore in `riga` non punta più a nessuna riga, ma il suo testo non è
 * perso. Non viene mai riassegnata da sola, nemmeno se righe aggiunte in
 * seguito la riporterebbero in range: solo l'utente decide.
 */

import type { Sporca } from '../../types';

export const ORPHAN_LINE = -1;

/** Numero di parole di una riga, con la stessa tokenizzazione usata ovunque. */
export function countWords(line: string): number {
  const trimmed = line.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Le sporche ancora agganciate a una riga che esiste davvero. */
export function anchoredSporche(sporche: Sporca[], totalLines: number): Sporca[] {
  return sporche.filter(s => s.riga >= 0 && s.riga < totalLines);
}

/** Le sporche che non trovano più la loro riga: da mostrare, non da perdere. */
export function orphanedSporche(sporche: Sporca[], totalLines: number): Sporca[] {
  return sporche.filter(s => s.riga === ORPHAN_LINE || s.riga < 0 || s.riga >= totalLines);
}

/**
 * Le parole di una riga sono cambiate (il numero di righe no). Le sporche di
 * quella riga restano; se `dopoParola` supera le parole rimaste, scala a
 * fine riga (si ridisegna in colonna invece che in mezzo al verso).
 */
export function reflowLineEdit(sporche: Sporca[], riga: number, newLineText: string): Sporca[] {
  const words = countWords(newLineText);
  return sporche.map(s => (s.riga === riga && s.dopoParola > words ? { ...s, dopoParola: words } : s));
}

/** Una riga nuova è entrata in posizione `atIndex`: chi sta sotto si sposta giù di uno. */
export function reflowLineInsert(sporche: Sporca[], atIndex: number): Sporca[] {
  return sporche.map(s => (s.riga >= atIndex ? { ...s, riga: s.riga + 1 } : s));
}

/**
 * La riga in posizione `atIndex` è stata cancellata. Le sue sporche non
 * spariscono in silenzio: diventano "non agganciate". Chi sta sotto si
 * sposta su di uno, per restare allineato alla riga giusta.
 */
export function reflowLineDelete(sporche: Sporca[], atIndex: number): Sporca[] {
  return sporche.map(s => {
    if (s.riga === atIndex) return { ...s, riga: ORPHAN_LINE };
    if (s.riga > atIndex) return { ...s, riga: s.riga - 1 };
    return s;
  });
}

/**
 * Il testo è cambiato in un modo non tracciabile riga per riga (incollato da
 * capo, o più righe toccate insieme). Le sporche il cui indice esiste ancora
 * restano agganciate a quella posizione, con `dopoParola` riportato dentro i
 * limiti della nuova riga; le altre diventano "non agganciate" — stesso
 * trattamento di una riga cancellata, mai la perdita silenziosa.
 */
export function reflowFullReplace(sporche: Sporca[], newLines: string[]): Sporca[] {
  return sporche.map(s => {
    if (s.riga < 0 || s.riga >= newLines.length) return { ...s, riga: ORPHAN_LINE };
    const words = countWords(newLines[s.riga]);
    return s.dopoParola > words ? { ...s, dopoParola: words } : s;
  });
}

/**
 * Punto d'ingresso unico: confronta il testo prima e dopo e sceglie la
 * regola giusta. Isola la modifica cercando il prefisso e il suffisso di
 * righe rimaste identiche; se ne resta esattamente una riga aggiunta o
 * tolta in mezzo, è un inserimento o una cancellazione puntuale. Qualunque
 * cosa di più ampio (incolla, taglia più righe insieme) ricade sul
 * trattamento generale di `reflowFullReplace`.
 */
export function reflowOnTextChange(sporche: Sporca[], oldLyrics: string, newLyrics: string): Sporca[] {
  if (oldLyrics === newLyrics) return sporche;
  const oldLines = oldLyrics.split('\n');
  const newLines = newLyrics.split('\n');

  if (oldLines.length === newLines.length) {
    let result = sporche;
    for (let i = 0; i < newLines.length; i++) {
      if (oldLines[i] !== newLines[i]) result = reflowLineEdit(result, i, newLines[i]);
    }
    return result;
  }

  let prefix = 0;
  const maxCommon = Math.min(oldLines.length, newLines.length);
  while (prefix < maxCommon && oldLines[prefix] === newLines[prefix]) prefix++;

  let suffix = 0;
  const maxSuffix = maxCommon - prefix;
  while (
    suffix < maxSuffix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removed = oldLines.length - prefix - suffix;
  const added = newLines.length - prefix - suffix;

  if (removed === 1 && added === 0) return reflowLineDelete(sporche, prefix);
  if (removed === 0 && added === 1) return reflowLineInsert(sporche, prefix);
  return reflowFullReplace(sporche, newLines);
}
