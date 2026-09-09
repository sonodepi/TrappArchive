/**
 * Come i dati stanno su Firestore, e perché così.
 *
 * ARCHITETTURA: il telefono resta la fonte di verità. Tutto continua a
 * funzionare offline sull'archivio locale; il cloud è una copia che si
 * allinea quando c'è connessione e l'utente ha fatto l'accesso. Questo è il
 * motivo per cui non ci sono transazioni distribuite né lock: due copie che
 * divergono si riconciliano confrontando `updatedAt`, come già fanno le bozze
 * che si scambiano per file.
 *
 * FORMA DEI DATI. Firestore è un database a documenti, non relazionale: le
 * regole di normalizzazione di SQL qui non si applicano allo stesso modo.
 *
 *   users/{uid}/tracks/{trackId}   una traccia
 *   users/{uid}/albums/{albumId}   un album
 *   users/{uid}/drafts/{draftId}   una bozza, con i suoi blocchi dentro
 *
 * I blocchi di una bozza stanno **dentro** il documento invece che in una
 * sottoraccolta: sono pochi, si leggono e si scrivono sempre insieme, e così
 * un salvataggio è una scrittura sola e atomica. In SQL sarebbero una tabella
 * separata con una chiave esterna; qui sarebbe solo più lento e più fragile.
 *
 * Gli autori sono invece duplicati dentro ogni bozza (nome e colore, non solo
 * l'id). È ridondanza voluta: senza, mostrare "chi ha scritto questa strofa"
 * richiederebbe una seconda lettura per ogni collaboratore. Il costo è che un
 * nome cambiato non si propaga alle bozze vecchie — accettabile, perché lì
 * conta chi ha scritto allora.
 *
 * COSA NON SALE. I file audio restano solo sul dispositivo: un documento
 * Firestore arriva a 1 MiB e un MP3 è molto di più. Servirebbe Firebase
 * Storage, che è un altro servizio con altri costi. Sincronizziamo i metadati
 * (titolo, BPM, tonalità, testo, nome del file); il file va ricaricato sul
 * secondo dispositivo. L'interfaccia deve dirlo, non lasciarlo scoprire.
 */

import type { Album, DraftProject, Track } from '../types';

/** Raccolte sotto il documento dell'utente. */
export const COLLECTIONS = {
  tracks: 'tracks',
  albums: 'albums',
  drafts: 'drafts',
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

/** Percorso di una raccolta per un utente. */
export function collectionPath(uid: string, name: CollectionName): string {
  return `users/${uid}/${COLLECTIONS[name]}`;
}

/**
 * Ogni documento porta con sé quando è stato toccato l'ultima volta.
 * È l'unico campo su cui si decide chi vince in caso di divergenza.
 */
export interface SyncMeta {
  /** Millisecondi. Sul locale è già presente; per le tracce si deriva. */
  updatedAt: number;
  /** Segna un documento eliminato, invece di farlo sparire (vedi sotto). */
  deleted?: boolean;
}

export type SyncedTrack = Track & SyncMeta;
export type SyncedAlbum = Album & SyncMeta;
export type SyncedDraft = DraftProject & SyncMeta;

/**
 * Le tracce non hanno un `updatedAt` proprio: nascono con `createdAt` e basta.
 * Finché non ce l'hanno, la data di creazione fa da riferimento: è corretta
 * per una traccia mai modificata, ed è comunque un ordinamento stabile.
 */
export function trackUpdatedAt(track: Track & Partial<SyncMeta>): number {
  return track.updatedAt ?? track.createdAt;
}

export function albumUpdatedAt(album: Album & Partial<SyncMeta>): number {
  return album.updatedAt ?? album.createdAt;
}

/**
 * Perché le eliminazioni sono marcate e non rimosse.
 *
 * Se cancellassi il documento e basta, il dispositivo che non era collegato
 * quando è avvenuta la cancellazione lo rivedrebbe come "documento che il
 * cloud non ha ancora" e lo ricaricherebbe: la traccia eliminata tornerebbe
 * indietro a ogni sincronizzazione. La lapide dice invece "questo è stato
 * eliminato, e quando": chi la riceve la applica se è più recente della sua
 * copia.
 */
export function tombstone<T extends { id: string }>(item: T): T & SyncMeta {
  return { ...item, deleted: true, updatedAt: Date.now() };
}
