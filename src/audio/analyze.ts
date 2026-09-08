/**
 * API pubblica dell'analisi audio: un file dentro, BPM e tonalità fuori.
 *
 * Tutto locale, nessuna rete: funziona identico in modalità aereo. È la
 * differenza sostanziale rispetto allo scraping di Tunebat, che dipende da un
 * proxy esterno.
 */

import { centerWindow, decodeToMono } from './decode';
import type { KeyProfileName } from './analysis/key';
import { detectKey } from './analysis/key';
import { detectTempo } from './analysis/tempo';
import type { AnalyzeRequest, AnalyzeResponse, AnalyzeSuccess } from './analysis/worker';

/** Frequenza di analisi: l'informazione ritmica e armonica utile sta sotto gli 11 kHz. */
const ANALYSIS_SAMPLE_RATE = 22050;

/** Quanti secondi analizzare, presi dal centro del brano. */
const ANALYSIS_WINDOW_SECONDS = 60;

export interface AudioAnalysis {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: number[];
  key: string;
  keyConfidence: number;
  keyAlternative: string;
  camelot: string;
  /** Durata reale del file: sostituisce la durata generata a caso. */
  durationMs: number;
  /** Quanto audio è stato effettivamente analizzato. */
  analyzedMs: number;
  profile: KeyProfileName;
}

let worker: Worker | null = null;
let requestId = 0;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./analysis/worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      return null; // Si ricade sull'esecuzione sul thread principale.
    }
  }
  return worker;
}

/** Risolve con il risultato, oppure rigetta: nessun controllo di stato dal chiamante. */
function runInWorker(
  w: Worker,
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalyzeSuccess> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<AnalyzeResponse>) => {
      const data = event.data;
      if (data.id !== request.id) return;
      cleanup();
      if (data.ok) {
        resolve(data);
      } else {
        reject(new Error(data.error));
      }
    };
    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message));
    };
    const onAbort = () => {
      cleanup();
      // Il worker viene ricreato: interrompere un calcolo in corso non è
      // altrimenti possibile, e lasciarlo girare sprecherebbe CPU.
      w.terminate();
      worker = null;
      reject(new DOMException('Annullato', 'AbortError'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort);

    // Trasferimento zero-copy del buffer dei campioni.
    w.postMessage(request, [request.samples.buffer]);
  });
}

export async function analyzeAudio(
  file: Blob,
  profile: KeyProfileName = 'temperley',
  signal?: AbortSignal,
): Promise<AudioAnalysis> {
  const decoded = await decodeToMono(file, ANALYSIS_SAMPLE_RATE, signal);
  // slice() e non subarray(): serve un ArrayBuffer proprio da trasferire.
  const window = centerWindow(
    decoded.samples,
    decoded.sampleRate,
    ANALYSIS_WINDOW_SECONDS,
  ).slice();

  const analyzedMs = Math.round((window.length / decoded.sampleRate) * 1000);
  const id = ++requestId;

  const w = getWorker();
  let tempo: ReturnType<typeof detectTempo>;
  let key: ReturnType<typeof detectKey>;

  if (w) {
    const response = await runInWorker(
      w,
      { id, samples: window, sampleRate: decoded.sampleRate, profile },
      signal,
    );
    tempo = response.tempo;
    key = response.key;
  } else {
    // Ambienti senza Worker (test, browser molto vecchi): stesso risultato,
    // ma sul thread principale.
    tempo = detectTempo(window, decoded.sampleRate);
    key = detectKey(window, decoded.sampleRate, profile);
  }

  return {
    bpm: tempo.bpm,
    bpmConfidence: tempo.confidence,
    bpmCandidates: tempo.candidates,
    key: key.key,
    keyConfidence: key.confidence,
    keyAlternative: key.alternative,
    camelot: key.camelot,
    durationMs: decoded.durationMs,
    analyzedMs,
    profile,
  };
}

/** Etichetta leggibile per una confidenza, da mostrare accanto al numero. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.6) return 'alta';
  if (confidence >= 0.3) return 'media';
  return 'incerta';
}
