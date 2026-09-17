/**
 * Le cancellazioni fatte qui, in attesa di essere raccontate al cloud.
 *
 * IL DIFETTO CHE QUESTO FILE CHIUDE. Cancellare una traccia la toglieva e
 * basta dall'elenco locale. Alla sincronizzazione successiva il cloud ce
 * l'aveva ancora, qui non c'era piu', e `reconcile` la leggeva per quello che
 * sembrava: una voce arrivata da un altro dispositivo. La rimetteva dentro.
 * Cancellavi una traccia sul telefono e ricompariva dal PC, a ogni sync.
 *
 * `tombstone()` in `schema.ts` esisteva gia' ed era pure testata, ma non la
 * chiamava nessuno nel percorso vero: mancava il posto dove tenere la lapide
 * fra il momento della cancellazione e la sincronizzazione. E' questo.
 *
 * PERCHE' UN REGISTRO A PARTE e non un campo `deleted` dentro il catalogo:
 * cosi' le schermate continuano a ricevere solo roba viva, e non c'e' nessun
 * elenco da filtrare - una schermata che si dimenticasse il filtro mostrerebbe
 * una traccia cancellata, che e' peggio del difetto di partenza. Qui la voce
 * sparisce subito e per davvero; della lapide si ricorda solo chi sincronizza.
 *
 * Le lapidi si scrivono solo quando il cloud e' configurato: chi lavora solo
 * in locale non ha niente da raccontare a nessuno, e il suo archivio non si
 * riempie di registri inutili.
 */

import type { CollectionName } from './schema';
import type { SyncMeta } from './schema';

export const TOMBSTONES_KEY = 'trapparchive_tombstones';

/** Una cancellazione avvenuta qui e non ancora mandata al cloud. */
export interface Tombstone {
  kind: CollectionName;
  id: string;
  /** Quando e' stata cancellata: decide chi vince contro una modifica altrui. */
  updatedAt: number;
}

function isTombstone(raw: unknown): raw is Tombstone {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Partial<Tombstone>;
  return (
    (t.kind === 'tracks' || t.kind === 'albums' || t.kind === 'drafts') &&
    typeof t.id === 'string' && t.id.length > 0 &&
    typeof t.updatedAt === 'number' && Number.isFinite(t.updatedAt)
  );
}

/** Legge il registro, tollerando archivio assente, corrotto o disabilitato. */
export function loadTombstones(): Tombstone[] {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTombstone) : [];
  } catch {
    // Un registro illeggibile non deve impedire di usare l'app: al massimo
    // una cancellazione vecchia non viene propagata.
    return [];
  }
}

function save(graves: Tombstone[]): void {
  try {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(graves));
  } catch (err) {
    // Spazio esaurito o archivio disabilitato: la cancellazione locale resta
    // valida, solo non verra' propagata. Non e' fatale e non va ingoiato.
    console.warn('Impossibile registrare la cancellazione da sincronizzare:', err);
  }
}

/**
 * Registra una cancellazione. Una seconda lapide per la stessa voce sostituisce
 * la prima: conta l'ultima volta, non la prima.
 */
export function recordTombstone(kind: CollectionName, id: string, at = Date.now()): void {
  const graves = loadTombstones().filter(g => !(g.kind === kind && g.id === id));
  graves.push({ kind, id, updatedAt: at });
  save(graves);
}

/**
 * Dimentica le lapidi che la sincronizzazione ha risolto.
 *
 * Risolta vuol dire due cose: o e' stata mandata al cloud (e da li' la vedono
 * gli altri dispositivi), oppure ha perso contro una modifica piu' recente
 * fatta altrove - in quel caso la voce e' tornata, ed e' giusto cosi': vince
 * chi ha toccato per ultimo, e la cancellazione era la piu' vecchia delle due.
 */
export function forgetTombstones(done: Tombstone[]): void {
  if (done.length === 0) return;
  const risolte = new Set(done.map(g => `${g.kind}:${g.id}`));
  save(loadTombstones().filter(g => !risolte.has(`${g.kind}:${g.id}`)));
}

/**
 * Rimette le lapidi nell'elenco che va a `reconcile`.
 *
 * Il catalogo che vedono le schermate non le contiene: entrano solo qui, un
 * attimo prima del confronto col cloud, e non tornano mai nello stato dell'app.
 * Una lapide per una voce che qui e' di nuovo viva viene lasciata cadere: vuol
 * dire che e' stata ricreata o riscaricata dopo, e l'elenco vero ha ragione.
 */
export function withTombstones<T extends { id: string }>(
  items: T[],
  kind: CollectionName,
  graves: Tombstone[],
): (T & SyncMeta)[] {
  const vivi = new Set(items.map(i => i.id));
  const lapidi = graves
    .filter(g => g.kind === kind && !vivi.has(g.id))
    .map(g => ({ id: g.id, updatedAt: g.updatedAt, deleted: true } as unknown as T & SyncMeta));
  return [...(items as (T & SyncMeta)[]), ...lapidi];
}
