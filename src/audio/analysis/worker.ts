/**
 * Web Worker di analisi.
 *
 * decodeAudioData e OfflineAudioContext esistono solo sul thread principale,
 * mentre FFT e correlazioni sono puro calcolo: la divisione è quindi netta.
 * Il thread principale decodifica e trasferisce i campioni senza copia, il
 * worker esegue tutto il DSP. La UI non si blocca mai, nemmeno su file lunghi.
 */

import { detectKey, type KeyProfileName } from './key';
import { detectTempo } from './tempo';

export interface AnalyzeRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
  profile: KeyProfileName;
}

export interface AnalyzeSuccess {
  id: number;
  ok: true;
  tempo: ReturnType<typeof detectTempo>;
  key: ReturnType<typeof detectKey>;
}

export interface AnalyzeFailure {
  id: number;
  ok: false;
  error: string;
}

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeFailure;

self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const { id, samples, sampleRate, profile } = event.data;
  try {
    const tempo = detectTempo(samples, sampleRate);
    const key = detectKey(samples, sampleRate, profile);
    const response: AnalyzeSuccess = { id, ok: true, tempo, key };
    self.postMessage(response);
  } catch (err) {
    const response: AnalyzeFailure = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Errore di analisi',
    };
    self.postMessage(response);
  }
};
