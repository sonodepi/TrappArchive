/**
 * Scrittura a piu' mani senza server.
 *
 * Il modello e' a turni: ognuno lavora sui propri blocchi, si passa il file, e
 * chi lo riceve unisce. Non c'e' niente in tempo reale e non c'e' niente da
 * mantenere online: la bozza viaggia come qualsiasi altro file.
 *
 * La divisione in blocchi e' cio' che impedisce a due persone di scrivere una
 * sopra l'altra. Al ritorno, ogni blocco viene confrontato per `updatedAt`:
 * vince la versione piu' recente, e chi unisce vede quante ne sono cambiate.
 */

import { MAX_AUTHORS, type DraftAuthor, type DraftBlock, type DraftProject } from '../types';

/** Tavolozza per distinguere gli autori. Indici, non colori, cosi' il tema resta libero. */
export const AUTHOR_COLORS = [
  { name: 'blu', dot: 'bg-blue-400', text: 'text-blue-300', border: 'border-blue-500/40', soft: 'bg-blue-500/10' },
  { name: 'ambra', dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/40', soft: 'bg-amber-500/10' },
  { name: 'verde', dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-500/40', soft: 'bg-emerald-500/10' },
  { name: 'viola', dot: 'bg-violet-400', text: 'text-violet-300', border: 'border-violet-500/40', soft: 'bg-violet-500/10' },
] as const;

export function authorColor(colorIndex: number) {
  return AUTHOR_COLORS[colorIndex % AUTHOR_COLORS.length];
}

/** Etichette proposte per i nuovi blocchi, nell'ordine tipico di un pezzo. */
const BLOCK_LABELS = ['Strofa 1', 'Ritornello', 'Strofa 2', 'Bridge', 'Strofa 3', 'Outro'];

export function nextBlockLabel(existing: DraftBlock[]): string {
  const used = new Set(existing.map(b => b.label));
  const free = BLOCK_LABELS.find(l => !used.has(l));
  return free ?? `Blocco ${existing.length + 1}`;
}

export function makeBlock(label: string, authorId: string | null): DraftBlock {
  return {
    id: crypto.randomUUID(),
    label,
    authorId,
    text: '',
    done: false,
    updatedAt: Date.now(),
  };
}

/** Chi puo' scrivere in un blocco: chi ce l'ha assegnato, o chiunque se e' libero. */
export function canEditBlock(block: DraftBlock, authorId: string): boolean {
  return block.authorId === null || block.authorId === authorId;
}

/** Solo chi ha creato la bozza riorganizza e unisce. */
export function isOwner(draft: DraftProject, authorId: string): boolean {
  return draft.ownerId === authorId;
}

export function canAddAuthor(draft: DraftProject): boolean {
  return draft.authors.length < MAX_AUTHORS;
}

/**
 * Unisce i blocchi nel testo finale.
 *
 * I blocchi vuoti non entrano: un'etichetta senza versi sotto sporcherebbe il
 * testo. Ogni blocco resta separato dalla sua intestazione, cosi' si vede la
 * struttura del pezzo invece di un muro di parole.
 */
export function mergeBlocks(blocks: DraftBlock[]): string {
  return blocks
    .filter(b => b.text.trim().length > 0)
    .map(b => `[${b.label}]\n${b.text.trim()}`)
    .join('\n\n');
}

export interface MergeReport {
  draft: DraftProject;
  /** Blocchi in cui e' entrata la versione dell'altro. */
  updated: number;
  /** Blocchi nuovi, che non avevo. */
  added: number;
  /** Autori nuovi entrati nella bozza. */
  newAuthors: number;
  /** Persone lasciate fuori perche' oltre il limite. */
  rejectedAuthors: string[];
  /**
   * Blocchi cambiati da entrambi dall'ultimo scambio: ha vinto il piu' recente,
   * ma chi unisce deve saperlo.
   */
  conflicts: string[];
}

/**
 * Fonde la bozza ricevuta nella propria.
 *
 * Regola: per ogni blocco vince `updatedAt` piu' alto. E' sufficiente per uno
 * scambio a turni, dove le due parti lavorano su blocchi diversi; quando invece
 * lo stesso blocco e' stato toccato da entrambi, la perdita viene dichiarata
 * invece di avvenire in silenzio.
 */
export function mergeDrafts(mine: DraftProject, incoming: DraftProject): MergeReport {
  const report: MergeReport = {
    draft: mine,
    updated: 0,
    added: 0,
    newAuthors: 0,
    rejectedAuthors: [],
    conflicts: [],
  };

  // Autori: si aggiungono quelli nuovi, fino al limite.
  const authors: DraftAuthor[] = [...mine.authors];
  for (const author of incoming.authors) {
    if (authors.some(a => a.id === author.id)) continue;
    if (authors.length >= MAX_AUTHORS) {
      report.rejectedAuthors.push(author.name);
      continue;
    }
    authors.push({ ...author, colorIndex: authors.length });
    report.newAuthors++;
  }
  const knownAuthors = new Set(authors.map(a => a.id));

  const byId = new Map(mine.blocks.map(b => [b.id, b]));
  const blocks: DraftBlock[] = mine.blocks.map(b => ({ ...b }));

  for (const block of incoming.blocks) {
    const existing = byId.get(block.id);

    if (!existing) {
      blocks.push({
        ...block,
        // Un blocco assegnato a qualcuno che non e' entrato resta senza padrone,
        // invece di puntare a un autore che non esiste in questa copia.
        authorId: block.authorId && knownAuthors.has(block.authorId) ? block.authorId : null,
      });
      report.added++;
      continue;
    }

    if (block.updatedAt > existing.updatedAt) {
      // Testo diverso da entrambe le parti: qualcosa si perde, e va detto.
      if (existing.text.trim() !== block.text.trim() && existing.text.trim().length > 0) {
        report.conflicts.push(existing.label);
      }
      const index = blocks.findIndex(b => b.id === block.id);
      blocks[index] = {
        ...block,
        authorId: block.authorId && knownAuthors.has(block.authorId) ? block.authorId : existing.authorId,
      };
      report.updated++;
    }
  }

  report.draft = {
    ...mine,
    authors,
    blocks,
    // Il titolo e la base restano di chi possiede la bozza; si prendono
    // dall'altro solo se qui mancano.
    title: mine.title || incoming.title,
    beatUrl: mine.beatUrl || incoming.beatUrl,
    bpm: mine.bpm ?? incoming.bpm,
    key: mine.key ?? incoming.key,
    updatedAt: Date.now(),
  };
  return report;
}

/**
 * Riassume l'esito di un'unione in una frase sola.
 * Il messaggio dice sempre cosa e' successo davvero, zero compreso.
 */
export function describeMerge(report: MergeReport): string {
  const parts: string[] = [];
  if (report.updated > 0) parts.push(`${report.updated} blocchi aggiornati`);
  if (report.added > 0) parts.push(`${report.added} blocchi nuovi`);
  if (report.newAuthors > 0) parts.push(`${report.newAuthors} autori aggiunti`);
  if (parts.length === 0) parts.push('nessuna novità rispetto alla tua copia');

  let text = `${parts.join(', ')}.`;
  if (report.conflicts.length > 0) {
    text += ` Attenzione: ${report.conflicts.join(', ')} ${
      report.conflicts.length === 1 ? 'era stato modificato' : 'erano stati modificati'
    } da entrambi, ha vinto la versione più recente.`;
  }
  if (report.rejectedAuthors.length > 0) {
    text += ` ${report.rejectedAuthors.join(', ')} non ${
      report.rejectedAuthors.length === 1 ? 'è entrato' : 'sono entrati'
    }: la bozza è già al massimo di ${MAX_AUTHORS} persone.`;
  }
  return text;
}
