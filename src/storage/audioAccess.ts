/**
 * Accesso ai byte dell'audio di una traccia, in un punto solo.
 *
 * Player, analisi BPM/tonalità e trascrizione hanno tutti bisogno della stessa
 * cosa: il contenuto del file. Prima ognuno se lo procurava a modo suo a partire
 * da una stringa ambigua. Qui la risoluzione è una sola, e i casi in cui l'audio
 * non c'è hanno un messaggio dedicato invece di un fallimento generico.
 */

import { useEffect, useState } from 'react';
import type { AudioSource, Track } from '../types';
import { AudioStoreError, getAudio } from './audioStore';

/** Recupera i byte dell'audio, qualunque sia la sua provenienza. */
export async function loadAudioBlob(track: Track): Promise<Blob> {
  const source = track.audio;
  if (!source) {
    throw new AudioStoreError('Questa traccia non ha un file audio associato.', 'not-found');
  }

  if (source.kind === 'unavailable') {
    throw new AudioStoreError(
      `Il file audio${source.name ? ` "${source.name}"` : ''} non è più disponibile: ricaricalo dalla scheda della traccia.`,
      'not-found',
    );
  }

  if (source.kind === 'remote') {
    const response = await fetch(source.url).catch(() => null);
    if (!response || !response.ok) {
      throw new AudioStoreError(
        "Impossibile scaricare l'audio da questo indirizzo.",
        'not-found',
      );
    }
    return response.blob();
  }

  const stored = await getAudio(track.id);
  if (!stored) {
    throw new AudioStoreError(
      `Il file "${source.name}" risulta associato alla traccia ma non è presente in archivio: ricaricalo.`,
      'not-found',
    );
  }
  return stored.blob;
}

export type AudioUrlState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; message: string };

/**
 * Espone un URL riproducibile per una traccia, e lo revoca quando non serve più.
 *
 * L'object URL viene ricreato a ogni montaggio a partire dai byte in archivio:
 * è questa la differenza con il codice precedente, che salvava l'URL e lo
 * ritrovava morto dopo un ricaricamento.
 */
export function useAudioUrl(track: Track | null): AudioUrlState {
  const [state, setState] = useState<AudioUrlState>({ status: 'none' });
  const source: AudioSource | undefined = track?.audio;

  useEffect(() => {
    if (!track || !source) {
      setState({ status: 'none' });
      return;
    }

    // Un indirizzo remoto è già riproducibile: non serve scaricarlo due volte.
    if (source.kind === 'remote') {
      setState({ status: 'ready', url: source.url });
      return;
    }

    if (source.kind === 'unavailable') {
      setState({
        status: 'error',
        message: `File audio non disponibile${source.name ? ` (${source.name})` : ''}: ricaricalo.`,
      });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });

    getAudio(track.id)
      .then(stored => {
        if (cancelled) return;
        if (!stored) {
          setState({
            status: 'error',
            message: `Il file "${source.name}" non è presente in archivio: ricaricalo.`,
          });
          return;
        }
        objectUrl = URL.createObjectURL(stored.blob);
        setState({ status: 'ready', url: objectUrl });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            err instanceof AudioStoreError
              ? err.message
              : "Impossibile leggere il file audio dall'archivio.",
        });
      });

    return () => {
      cancelled = true;
      // Senza la revoca il browser trattiene il blob in memoria per tutta la
      // durata della pagina, a ogni cambio di traccia.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `source` è derivato da `track`: le dipendenze sono i campi che contano.
  }, [track?.id, source?.kind, source && 'name' in source ? source.name : null,
      source && 'url' in source ? source.url : null]);

  return state;
}
