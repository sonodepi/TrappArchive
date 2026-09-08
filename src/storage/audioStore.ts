/**
 * Archivio dei file audio su IndexedDB.
 *
 * Prima l'app salvava `URL.createObjectURL(file)`, cioè un riferimento valido
 * solo per la sessione corrente del browser: dopo un ricaricamento puntava nel
 * vuoto e l'audio era perso, insieme alla possibilità di riprodurlo, analizzarlo
 * o trascriverlo. Qui si conservano i byte veri.
 *
 * IndexedDB e non localStorage perché quest'ultimo accetta solo stringhe e sta
 * in pochi MB: un MP3 non ci entra.
 */

const DB_NAME = 'trapparchive';
const DB_VERSION = 1;
const STORE = 'audioFiles';

export type AudioStoreErrorKind = 'unavailable' | 'quota' | 'not-found' | 'unknown';

/** Errore già scritto per essere mostrato all'utente così com'è. */
export class AudioStoreError extends Error {
  constructor(message: string, readonly kind: AudioStoreErrorKind) {
    super(message);
    this.name = 'AudioStoreError';
  }
}

export interface StoredAudio {
  blob: Blob;
  name: string;
  mimeType: string;
  sizeBytes: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Apre il database. In modalità privata di alcuni browser IndexedDB esiste ma
 * fallisce all'apertura: in quel caso l'errore è esplicito, così i chiamanti
 * possono degradare invece di andare in crash.
 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new AudioStoreError(
          "Questo browser non permette di archiviare file audio (IndexedDB non disponibile).",
          'unavailable',
        ),
      );
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(
        new AudioStoreError(
          "Archiviazione dei file audio non disponibile in questa finestra del browser.",
          'unavailable',
        ),
      );
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new AudioStoreError(
          "Impossibile aprire l'archivio dei file audio.",
          'unavailable',
        ),
      );
    request.onblocked = () =>
      reject(
        new AudioStoreError(
          "L'archivio è in uso da un'altra scheda: chiudila e riprova.",
          'unavailable',
        ),
      );
  });

  // Un fallimento non deve restare memorizzato per sempre: un nuovo tentativo
  // dopo che l'utente ha chiuso l'altra scheda deve poter riuscire.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Traduce gli errori di IndexedDB in messaggi che hanno senso per l'utente. */
function translateError(err: unknown): AudioStoreError {
  if (err instanceof AudioStoreError) return err;

  const name = err instanceof DOMException ? err.name : '';
  if (name === 'QuotaExceededError') {
    return new AudioStoreError(
      'Spazio esaurito: il browser non accetta altri file audio. Elimina qualche traccia, oppure svuota i dati del sito, e riprova.',
      'quota',
    );
  }
  return new AudioStoreError(
    "Errore durante l'accesso all'archivio dei file audio.",
    'unknown',
  );
}

/** Salva (o sostituisce) il file audio di una traccia. */
export async function putAudio(trackId: string, file: Blob, name: string): Promise<StoredAudio> {
  const record: StoredAudio = {
    blob: file,
    name,
    mimeType: file.type || 'audio/mpeg',
    sizeBytes: file.size,
    savedAt: Date.now(),
  };

  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    // La quota si manifesta sull'abort della transazione, non sempre sulla
    // richiesta: vanno ascoltati entrambi o l'errore sfugge.
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    tx.objectStore(STORE).put(record, trackId);
    await done;
    return record;
  } catch (err) {
    throw translateError(err);
  }
}

/** Legge il file audio di una traccia, o null se non c'è. */
export async function getAudio(trackId: string): Promise<StoredAudio | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const result = await runRequest<StoredAudio | undefined>(
      tx.objectStore(STORE).get(trackId),
    );
    return result ?? null;
  } catch (err) {
    throw translateError(err);
  }
}

/** Elimina il file audio di una traccia. Non è un errore se non esisteva. */
export async function deleteAudio(trackId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    tx.objectStore(STORE).delete(trackId);
    await done;
  } catch (err) {
    throw translateError(err);
  }
}

/** Tutti gli id presenti in archivio. Serve a trovare i file orfani. */
export async function listAudioIds(): Promise<string[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const keys = await runRequest<IDBValidKey[]>(tx.objectStore(STORE).getAllKeys());
    return keys.map(String);
  } catch (err) {
    throw translateError(err);
  }
}

/**
 * Elimina i file che non appartengono più ad alcuna traccia.
 *
 * Senza questa pulizia lo spazio cresce a ogni traccia cancellata e non si
 * libera mai: la cancellazione della traccia e quella del suo file possono
 * divergere (un import, una scheda chiusa a metà operazione).
 */
export async function pruneOrphans(liveTrackIds: Iterable<string>): Promise<number> {
  const live = new Set(liveTrackIds);
  const stored = await listAudioIds();
  const orphans = stored.filter(id => !live.has(id));
  for (const id of orphans) {
    await deleteAudio(id);
  }
  return orphans.length;
}

/** Spazio usato e disponibile, quando il browser lo espone. */
export async function estimateUsage(): Promise<{ usedBytes: number; quotaBytes: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined) return null;
    return { usedBytes: usage, quotaBytes: quota };
  } catch {
    return null;
  }
}

/** Solo per i test: dimentica la connessione memorizzata. */
export function resetForTests(): void {
  dbPromise = null;
}
