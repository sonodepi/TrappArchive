/**
 * Barre e ad libs, in una stringa sola.
 *
 * Regola unica: quello che sta fra parentesi e' una ad lib, tutto il resto e'
 * la barra scritta. Non esistono due campi separati da tenere allineati, e non
 * esiste un secondo formato salvato: il testo resta quello che e' sempre stato
 * (`Track.lyrics`, `DraftBlock.text`), cosi' export, sincronizzazione,
 * trascrizione AI e unione delle bozze continuano a leggere la stessa cosa.
 *
 * La vista a due colonne e' una *proiezione* di questa stringa, non un altro
 * modo di conservarla: ogni modifica fatta in colonna viene ricomposta qui
 * dentro subito, riga per riga.
 *
 * Una riga = una barra. Se a video va a capo perche' e' lunga, resta una barra
 * sola: il numero nel margine conta le righe del testo, non quelle dello
 * schermo.
 */

/**
 * Come si guarda il testo. Non cambia cosa c'e' scritto: la stringa salvata e'
 * la stessa nei due casi.
 *
 * - `mixed`: una casella sola, barre e ad libs insieme come si scrivono.
 * - `split`: due colonne affiancate, barre a sinistra e ad libs a destra.
 */
export type LyricsFormat = 'mixed' | 'split';

export type SegmentKind = 'writer' | 'adlib';

/** Un pezzo omogeneo di barra: o testo scritto, o ad lib fra parentesi. */
export interface Segment {
  kind: SegmentKind;
  /** Per le ad libs le parentesi sono incluse: a video si vedono. */
  text: string;
}

/** Le due colonne della vista divisa. */
export type BarColumn = 'writer' | 'adlibs';

/** Il contenuto di una barra visto come due colonne. */
export interface BarText {
  writer: string;
  /** Ad libs senza parentesi: nella colonna gialla sono sottintese. */
  adlibs: string;
}

export interface Bar extends BarText {
  /** Indice della riga nel testo. */
  index: number;
  /** Numero mostrato nel margine. null = riga vuota, non e' una barra. */
  number: number | null;
  text: string;
  segments: Segment[];
}

/** Dove rimettere il cursore dopo una modifica che sposta le righe. */
export interface CaretTarget {
  index: number;
  column: BarColumn;
  caret: number;
}

export interface CellEdit {
  lines: string[];
  focus: CaretTarget;
}

export function splitLines(text: string): string[] {
  return text.split('\n');
}

export function joinLines(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Divide una barra in pezzi scritti e ad libs.
 *
 * Conta la profondita' delle parentesi, cosi' `(ehi (forte))` resta una ad lib
 * sola. Una parentesi aperta e mai chiusa colora fino a fine riga: e' il caso
 * di chi sta ancora scrivendo, e vedere il giallo partire subito e' il
 * comportamento giusto. Una parentesi chiusa senza la sua aperta non colora
 * niente: e' solo un carattere come un altro.
 */
export function segmentBar(line: string): Segment[] {
  const segments: Segment[] = [];
  let buffer = '';
  let kind: SegmentKind = 'writer';
  let depth = 0;

  const flush = () => {
    if (buffer) segments.push({ kind, text: buffer });
    buffer = '';
  };

  for (const ch of line) {
    if (ch === '(') {
      if (depth === 0) {
        flush();
        kind = 'adlib';
      }
      depth++;
      buffer += ch;
    } else if (ch === ')' && depth > 0) {
      buffer += ch;
      depth--;
      if (depth === 0) {
        flush();
        kind = 'writer';
      }
    } else {
      buffer += ch;
    }
  }
  flush();
  return segments;
}

/** Toglie le parentesi esterne a un gruppo di ad libs. */
function inner(group: string): string {
  const withoutOpen = group.startsWith('(') ? group.slice(1) : group;
  return withoutOpen.endsWith(')') ? withoutOpen.slice(0, -1) : withoutOpen;
}

/**
 * Proietta una barra sulle due colonne.
 *
 * Su una riga senza ad libs il testo esce identico a com'e' entrato: e' il caso
 * normale, e non deve cambiare di un carattere mentre si scrive. Quando invece
 * le ad libs ci sono e sono piu' d'una, togliendole restano doppi spazi dove
 * stavano: quelli si chiudono, altrimenti la colonna bianca mostra buchi che
 * l'utente non ha scritto.
 */
export function readBar(line: string): BarText {
  const segments = segmentBar(line);
  const groups = segments.filter(s => s.kind === 'adlib');
  if (groups.length === 0) return { writer: line, adlibs: '' };

  // Si chiude solo il punto in cui stava la ad lib - lo spazio prima e quello
  // dopo diventano uno. Gli spazi scritti apposta altrove nella riga non si
  // toccano: qualcuno incolonna le ad libs a mano, e non e' roba nostra.
  let writer = '';
  segments.forEach((segment, i) => {
    if (segment.kind === 'adlib') return;
    const dopoUnaAdLib = segments[i - 1]?.kind === 'adlib';
    const text = dopoUnaAdLib && writer.endsWith(' ') && segment.text.startsWith(' ')
      ? segment.text.slice(1)
      : segment.text;
    writer += text;
  });
  const adlibs = groups.map(g => inner(g.text)).join(' ');
  return { writer, adlibs };
}

/**
 * Ricompone la riga dalle due colonne.
 *
 * Le ad libs finiscono in fondo alla barra, in un gruppo solo. Una barra che le
 * aveva in mezzo viene quindi normalizzata - ma solo quando la si modifica
 * davvero: le righe che nessuno tocca non passano mai di qui (vedi
 * `applyCellInput`), e restano identiche al carattere.
 */
export function writeBar({ writer, adlibs }: BarText): string {
  if (!adlibs) return writer;
  const group = `(${adlibs})`;
  if (!writer) return group;
  return writer.endsWith(' ') ? writer + group : `${writer} ${group}`;
}

/**
 * Legge il testo come elenco di barre numerate.
 *
 * Le righe vuote separano le strofe: non sono barre, non prendono numero e non
 * fanno avanzare il conto.
 */
export function parseBars(text: string): Bar[] {
  let number = 0;
  return splitLines(text).map((line, index) => {
    const counts = line.trim().length > 0;
    if (counts) number++;
    return {
      index,
      number: counts ? number : null,
      text: line,
      segments: segmentBar(line),
      ...readBar(line),
    };
  });
}

/** Quante barre ha scritto: le righe vuote non contano. */
export function countBars(text: string): number {
  return splitLines(text).filter(l => l.trim().length > 0).length;
}

/**
 * Applica quello che l'utente ha appena scritto in una cella.
 *
 * Riscrive **solo** la riga toccata: le altre restano byte per byte quelle di
 * prima. Se il valore contiene degli a-capo - invio, oppure un testo incollato
 * - la cella si spezza in piu' barre, una per riga.
 */
export function applyCellInput(
  lines: string[],
  index: number,
  column: BarColumn,
  value: string,
  caret: number,
): CellEdit {
  const current = readBar(lines[index] ?? '');
  const parts = value.split('\n');
  const next = [...lines];

  const compose = (part: string, first: boolean): string =>
    column === 'writer'
      ? writeBar({ writer: part, adlibs: first ? current.adlibs : '' })
      : writeBar({ writer: first ? current.writer : '', adlibs: part });

  if (parts.length === 1) {
    next[index] = compose(value, true);
    return { lines: next, focus: { index, column, caret } };
  }

  next.splice(index, 1, ...parts.map((part, i) => compose(part, i === 0)));

  // Il cursore resta dove l'ha lasciato chi scrive: nella parte in cui e'
  // finito, non in fondo all'ultima riga incollata.
  let offset = caret;
  let part = 0;
  while (part < parts.length - 1 && offset > parts[part].length) {
    offset -= parts[part].length + 1;
    part++;
  }
  return {
    lines: next,
    focus: {
      index: index + part,
      column,
      caret: Math.max(0, Math.min(offset, parts[part].length)),
    },
  };
}

/** Unisce due gruppi di ad libs in uno: `(ehi)` + `(ouu)` -> `(ehi ouu)`. */
function joinAdlibs(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

/**
 * Backspace a inizio barra: la barra si attacca a quella sopra, colonna per
 * colonna, e il cursore resta nel punto di giuntura.
 */
export function mergeIntoPrevious(
  lines: string[],
  index: number,
  column: BarColumn,
): CellEdit | null {
  if (index <= 0 || index >= lines.length) return null;
  const previous = readBar(lines[index - 1]);
  const current = readBar(lines[index]);
  const merged: BarText = {
    writer: previous.writer + current.writer,
    adlibs: joinAdlibs(previous.adlibs, current.adlibs),
  };
  const next = [...lines];
  next.splice(index - 1, 2, writeBar(merged));
  return {
    lines: next,
    focus: {
      index: index - 1,
      column,
      caret: column === 'writer' ? previous.writer.length : previous.adlibs.length,
    },
  };
}

/** Canc a fine barra: tira su la barra seguente. */
export function mergeNext(
  lines: string[],
  index: number,
  column: BarColumn,
): CellEdit | null {
  return mergeIntoPrevious(lines, index + 1, column);
}
