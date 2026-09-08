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

export interface DraftProject {
  id: string;
  title: string;
  lyrics: string;
  ownerLyrics?: string;
  collaboratorLyrics?: string;
  isCoopMode?: boolean;
  ownerReady?: boolean;
  collabReady?: boolean;
  beatUrl: string;
  updatedAt: number;
  bpm?: number;
  key?: string;
}
