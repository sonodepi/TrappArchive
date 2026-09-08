/**
 * Lettura e scrittura del catalogo su localStorage.
 *
 * Due problemi del codice precedente sono risolti qui:
 *
 * 1. Il caricamento avveniva in un effetto, mentre l'effetto di salvataggio
 *    girava già al primo render con lo stato ancora vuoto: c'era una finestra in
 *    cui localStorage veniva riscritto con `[]`. Ora il caricamento è sincrono e
 *    va usato come inizializzatore di `useState`, quindi la finestra non esiste.
 * 2. I dati illeggibili venivano ingoiati da `catch {}`: l'utente vedeva un
 *    catalogo vuoto senza spiegazione, e il primo salvataggio successivo
 *    rendeva la perdita definitiva. Ora il contenuto illeggibile viene messo da
 *    parte sotto una chiave di recupero e il problema viene riportato.
 */

import type { Album, DraftProject, Track } from '../types';
import { parseAlbum, parseDraft, parseList, parseTrack } from './migrate';

export const TRACKS_KEY = 'trapparchive_tracks';
export const ALBUMS_KEY = 'trapparchive_albums';
export const DRAFTS_KEY = 'trapparchive_drafts';

export interface CatalogProblem {
  key: string;
  message: string;
  /** Chiave sotto cui il contenuto illeggibile è stato conservato. */
  recoveryKey?: string;
}

export interface Catalog {
  tracks: Track[];
  albums: Album[];
  drafts: DraftProject[];
  problems: CatalogProblem[];
}

export const EMPTY_CATALOG: Catalog = { tracks: [], albums: [], drafts: [], problems: [] };

/**
 * Mette da parte un valore illeggibile invece di perderlo.
 *
 * Se anche questo fallisce (spazio esaurito) il valore originale resta comunque
 * al suo posto: non viene mai cancellato in questo percorso.
 */
function quarantine(key: string): string | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    const recoveryKey = `${key}_illeggibile_${Date.now()}`;
    localStorage.setItem(recoveryKey, raw);
    return recoveryKey;
  } catch {
    return undefined;
  }
}

function readKey<T>(
  key: string,
  parse: (item: unknown) => T | null,
  problems: CatalogProblem[],
  label: string,
): T[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    problems.push({ key, message: `Impossibile leggere ${label}: archivio del browser non accessibile.` });
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const recoveryKey = quarantine(key);
    problems.push({
      key,
      recoveryKey,
      message: `I dati di ${label} sono illeggibili e non sono stati caricati. Non sono stati cancellati: restano salvati a parte, in attesa di recupero.`,
    });
    return [];
  }

  const result = parseList(parsed, parse);
  if (result.skipped > 0) {
    problems.push({
      key,
      message: `${result.skipped} voci di ${label} sono state scartate perché incomplete.`,
    });
  }
  return result.items;
}

/** Da usare come inizializzatore di `useState`, non dentro un effetto. */
export function loadCatalog(): Catalog {
  const problems: CatalogProblem[] = [];
  return {
    tracks: readKey(TRACKS_KEY, parseTrack, problems, 'tracce'),
    albums: readKey(ALBUMS_KEY, parseAlbum, problems, 'album'),
    drafts: readKey(DRAFTS_KEY, parseDraft, problems, 'bozze'),
    problems,
  };
}

export type SaveOutcome = { ok: true } | { ok: false; message: string };

export function saveCatalog(tracks: Track[], albums: Album[], drafts: DraftProject[]): SaveOutcome {
  try {
    localStorage.setItem(TRACKS_KEY, JSON.stringify(tracks));
    localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    return { ok: true };
  } catch (err) {
    const quota = err instanceof DOMException && err.name === 'QuotaExceededError';
    return {
      ok: false,
      message: quota
        ? "Spazio esaurito: le ultime modifiche non sono state salvate. Libera spazio eliminando qualche traccia, poi riprova."
        : "Le ultime modifiche non sono state salvate: l'archivio del browser non è accessibile.",
    };
  }
}

/**
 * Migrazione una tantum dalle vecchie chiavi `trackstudio_`.
 * Va eseguita prima di `loadCatalog`.
 */
export function migrateLegacyKeys(): void {
  try {
    if (localStorage.getItem('trapparchive_migrated') === 'true') return;

    const pairs: Array<[string, string]> = [
      ['trackstudio_tracks', TRACKS_KEY],
      ['trackstudio_albums', ALBUMS_KEY],
      ['trackstudio_drafts', DRAFTS_KEY],
    ];
    for (const [oldKey, newKey] of pairs) {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(oldKey);
    }
    localStorage.setItem('trapparchive_migrated', 'true');
  } catch {
    // Una migrazione fallita non deve impedire l'avvio: il catalogo nuovo
    // viene comunque letto dalle chiavi correnti.
  }
}
