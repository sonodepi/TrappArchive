/**
 * Da dove arriva l'audio di una traccia.
 *
 * Prima esisteva un solo campo `audioFilePath: string` che mescolava tre cose
 * diverse: un blob: URL locale, un indirizzo remoto e la stringa vuota. Il
 * codice non poteva distinguerle, e un blob: URL morto era indistinguibile da
 * uno vivo finché non falliva. Qui i tre casi sono espliciti e il compilatore
 * costringe a gestirli tutti.
 */
export type AudioSource =
  /** I byte sono in IndexedDB, sotto la chiave `track.id`. */
  | { kind: 'local'; name: string; mimeType: string; sizeBytes: number }
  /** Indirizzo remoto inserito a mano dall'utente. */
  | { kind: 'remote'; url: string }
  /** La traccia dichiarava un file locale che non è più recuperabile. */
  | { kind: 'unavailable'; name?: string };

export interface Track {
  id: string;
  title: string;
  producer: string;
  mainArtist: string;
  featurings: string[];
  lyrics: string;
  /** Assente quando alla traccia non è mai stato associato un audio. */
  audio?: AudioSource;
  durationMs: number; // For sorting by duration
  createdAt: number; // For sorting by date
  bpm?: number;
  key?: string;
  /** Sporche (ad-libs). Facoltativo: le tracce vecchie non ce l'hanno. */
  sporche?: Sporca[];
}

/**
 * Una sporca (ad-lib) agganciata al testo.
 *
 * L'ancoraggio è unico — "dopo la parola N della riga" — e si presta a due
 * rese: se `dopoParola` cade oltre l'ultima parola della riga, la sporca si
 * disegna nella colonna a destra; se cade in mezzo, si disegna in linea, nel
 * punto dove il verso si spezza. Stesso dato, due modi di vederlo.
 */
export interface Sporca {
  id: string;
  testo: string;
  /** Indice della riga di `lyrics` a cui è agganciata (0 = prima riga). */
  riga: number;
  /** Dopo quale parola della riga. Oltre l'ultima = colonna a destra. */
  dopoParola: number;
}

export interface Album {
  id: string;
  title: string;
  coverArt: string;
  year: number;
  genre: string;
  trackIds: string[]; // Relational link to tracks
  createdAt: number;
}

/** Numero massimo di persone su una bozza. Oltre, su telefono non si legge piu'. */
export const MAX_AUTHORS = 4;

/**
 * Chi scrive. L'identita' e' locale al dispositivo: niente account, niente
 * server. Serve solo a sapere di chi e' un blocco quando le bozze si scambiano.
 */
export interface DraftAuthor {
  id: string;
  name: string;
  /** Indice della tavolozza, per distinguere i blocchi a colpo d'occhio. */
  colorIndex: number;
}

/**
 * Un blocco di testo: una strofa, un ritornello, una quartina.
 *
 * E' la divisione che impedisce a due persone di scrivere una sopra l'altra.
 * Ognuno lavora sui propri blocchi, ma vede quelli di tutti.
 */
export interface DraftBlock {
  id: string;
  /** "Strofa 1", "Ritornello", ... */
  label: string;
  /** A chi e' assegnato. null = libero, lo prende chi vuole. */
  authorId: string | null;
  text: string;
  /** L'autore dichiara chiuso il blocco. */
  done: boolean;
  /** Ultima modifica: decide chi vince quando due versioni si incontrano. */
  updatedAt: number;
}

export interface DraftProject {
  id: string;
  title: string;
  /** Testo unito: lo produce il capo con "Unisci". */
  lyrics: string;
  /** Chi ha creato la bozza. Solo lui puo' unire e riorganizzare. */
  ownerId: string;
  authors: DraftAuthor[];
  blocks: DraftBlock[];
  beatUrl: string;
  updatedAt: number;
  bpm?: number;
  key?: string;
  /**
   * Id della finestra di condivisione aperta dal capo. Assente = chiusa.
   * Un codice cifrato porta con se' l'id di quando e' stato generato: si
   * puo' unire solo se combacia con quello attualmente aperto qui. Vedi
   * src/drafts/share.ts.
   */
  shareSessionId?: string;
}
