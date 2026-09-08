/**
 * Tipi ed errori della trascrizione, separati dal client.
 *
 * Il modulo gemini.ts trascina con sé l'SDK @google/genai (~400 kB). Tenendo qui
 * ciò che serve alla UI, i componenti possono importare tipi ed etichette senza
 * far entrare l'SDK nel bundle iniziale: quello viene caricato con un import
 * dinamico solo quando l'utente lancia davvero una trascrizione.
 */

import type { TranscriptionLanguage } from '../settings/types';

export type TranscribePhase =
  | 'decoding'
  | 'encoding'
  | 'uploading'
  | 'transcribing'
  | 'done';

export const PHASE_LABELS: Record<TranscribePhase, string> = {
  decoding: "Decodifica dell'audio…",
  encoding: 'Preparazione del file…',
  uploading: 'Invio a Gemini…',
  transcribing: 'Trascrizione in corso…',
  done: 'Completato',
};

export type GeminiErrorKind =
  | 'no-key'
  | 'invalid-key'
  | 'quota'
  | 'forbidden'
  | 'offline'
  | 'audio'
  | 'empty'
  | 'unknown';

/** Errore già tradotto e mostrabile all'utente così com'è. */
export class GeminiError extends Error {
  constructor(message: string, readonly kind: GeminiErrorKind) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface TranscribeParams {
  audio: Blob;
  apiKey: string;
  model: string;
  language: TranscriptionLanguage;
  signal?: AbortSignal;
  onPhase?: (phase: TranscribePhase) => void;
}

export interface LyricsSection {
  label: string;
  text: string;
}

export interface TranscriptionResult {
  lyrics: string;
  language: string;
  sections: LyricsSection[];
  model: string;
  durationMs: number;
}
