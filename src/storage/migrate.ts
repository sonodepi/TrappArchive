/**
 * Lettura difensiva di ciò che c'è in localStorage.
 *
 * I dati salvati dalle versioni precedenti hanno una forma diversa e possono
 * essere corrotti. Queste funzioni sono pure: prendono `unknown` e restituiscono
 * dati validi più il conto di ciò che è stato scartato, così il chiamante può
 * dirlo all'utente invece di far sparire il catalogo in silenzio.
 */

import type { Album, AudioSource, DraftAuthor, DraftBlock, DraftProject, Track } from '../types';
import { MAX_AUTHORS } from '../types';

export interface ParseResult<T> {
  items: T[];
  /** Voci scartate perché irrecuperabili. */
  skipped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Converte il vecchio `audioFilePath` nella nuova sorgente esplicita.
 *
 * Un blob: URL salvato da una sessione precedente è morto per costruzione: non
 * esiste modo di recuperarlo, quindi diventa `unavailable`. La traccia però si
 * conserva: metadati e testo sono la parte di valore, e cancellarli per un file
 * mancante sarebbe una perdita molto peggiore.
 */
export function migrateAudioSource(raw: Record<string, unknown>): AudioSource | undefined {
  const existing = raw.audio;
  if (isRecord(existing) && typeof existing.kind === 'string') {
    if (existing.kind === 'local') {
      return {
        kind: 'local',
        name: asString(existing.name, 'audio'),
        mimeType: asString(existing.mimeType, 'audio/mpeg'),
        sizeBytes: asNumber(existing.sizeBytes),
      };
    }
    if (existing.kind === 'remote' && typeof existing.url === 'string' && existing.url) {
      return { kind: 'remote', url: existing.url };
    }
    if (existing.kind === 'unavailable') {
      return { kind: 'unavailable', name: asString(existing.name) || undefined };
    }
    return undefined;
  }

  const legacyPath = asString(raw.audioFilePath).trim();
  if (!legacyPath) return undefined;
  if (legacyPath.startsWith('blob:')) return { kind: 'unavailable' };
  return { kind: 'remote', url: legacyPath };
}

/** Una traccia è recuperabile se ha almeno un id e un titolo utilizzabili. */
export function parseTrack(raw: unknown): Track | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;

  return {
    id,
    title: asString(raw.title, 'Senza titolo'),
    producer: asString(raw.producer),
    mainArtist: asString(raw.mainArtist),
    featurings: Array.isArray(raw.featurings)
      ? raw.featurings.filter((f): f is string => typeof f === 'string')
      : [],
    lyrics: asString(raw.lyrics),
    audio: migrateAudioSource(raw),
    durationMs: asNumber(raw.durationMs),
    createdAt: asNumber(raw.createdAt, Date.now()),
    bpm: typeof raw.bpm === 'number' ? raw.bpm : undefined,
    key: typeof raw.key === 'string' ? raw.key : undefined,
  };
}

export function parseAlbum(raw: unknown): Album | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;

  return {
    id,
    title: asString(raw.title, 'Senza titolo'),
    coverArt: asString(raw.coverArt),
    year: asNumber(raw.year, new Date().getFullYear()),
    genre: asString(raw.genre),
    trackIds: Array.isArray(raw.trackIds)
      ? raw.trackIds.filter((t): t is string => typeof t === 'string')
      : [],
    createdAt: asNumber(raw.createdAt, Date.now()),
  };
}

function parseAuthor(raw: unknown, index: number): DraftAuthor | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, `Autore ${index + 1}`),
    colorIndex: asNumber(raw.colorIndex, index),
  };
}

function parseBlock(raw: unknown): DraftBlock | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    label: asString(raw.label, 'Blocco'),
    authorId: typeof raw.authorId === 'string' && raw.authorId ? raw.authorId : null,
    text: asString(raw.text),
    done: raw.done === true,
    updatedAt: asNumber(raw.updatedAt, Date.now()),
  };
}

/**
 * Converte una bozza a due colonne nel modello a blocchi.
 *
 * Il vecchio formato aveva `ownerLyrics` e `collaboratorLyrics`: due caselle
 * fisse, quindi al massimo due persone e nessuna struttura interna. Diventano
 * due blocchi, e il testo scritto non si perde.
 */
function blocksFromLegacy(raw: Record<string, unknown>, ownerId: string): DraftBlock[] {
  const blocks: DraftBlock[] = [];
  const updatedAt = asNumber(raw.updatedAt, Date.now());

  const owner = asString(raw.ownerLyrics).trim();
  const collab = asString(raw.collaboratorLyrics).trim();
  const plain = asString(raw.lyrics).trim();

  if (owner) {
    blocks.push({
      id: `${ownerId}-legacy-owner`, label: 'Strofa 1', authorId: ownerId,
      text: owner, done: raw.ownerReady === true, updatedAt,
    });
  }
  if (collab) {
    blocks.push({
      id: `${ownerId}-legacy-collab`, label: 'Strofa 2', authorId: null,
      text: collab, done: raw.collabReady === true, updatedAt,
    });
  }
  // Il campo `lyrics` singolo era il testo di chi scriveva da solo: si conserva
  // solo se non e' gia' rappresentato dalle due colonne.
  if (!blocks.length && plain) {
    blocks.push({
      id: `${ownerId}-legacy-lyrics`, label: 'Strofa 1', authorId: ownerId,
      text: plain, done: false, updatedAt,
    });
  }
  return blocks;
}

export function parseDraft(raw: unknown): DraftProject | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;

  // Le bozze vecchie non hanno un proprietario: chi le apre e' chi le ha
  // create, quindi l'id della bozza fa da proprietario stabile.
  const ownerId = asString(raw.ownerId) || `legacy-${id}`;

  const authors = Array.isArray(raw.authors)
    ? raw.authors
        .map((a, i) => parseAuthor(a, i))
        .filter((a): a is DraftAuthor => a !== null)
        .slice(0, MAX_AUTHORS)
    : [];

  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map(parseBlock).filter((b): b is DraftBlock => b !== null)
    : blocksFromLegacy(raw, ownerId);

  return {
    id,
    title: asString(raw.title, 'Bozza senza titolo'),
    lyrics: asString(raw.lyrics),
    ownerId,
    authors,
    blocks,
    beatUrl: asString(raw.beatUrl),
    updatedAt: asNumber(raw.updatedAt, Date.now()),
    bpm: typeof raw.bpm === 'number' ? raw.bpm : undefined,
    key: typeof raw.key === 'string' ? raw.key : undefined,
  };
}

/** Applica un parser a un array sconosciuto, contando gli scarti. */
export function parseList<T>(raw: unknown, parse: (item: unknown) => T | null): ParseResult<T> {
  if (!Array.isArray(raw)) return { items: [], skipped: 0 };
  const items: T[] = [];
  let skipped = 0;
  for (const entry of raw) {
    const parsed = parse(entry);
    if (parsed) items.push(parsed);
    else skipped++;
  }
  return { items, skipped };
}
