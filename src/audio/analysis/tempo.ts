/**
 * Rilevamento del tempo (BPM).
 *
 * Correzioni rispetto all'implementazione precedente:
 *  1. l'inviluppo veniva autocorrelato senza rimuovere la componente continua,
 *     che dominava il prodotto e premiava i lag lunghi a prescindere dal ritmo;
 *  2. non esisteva disambiguazione d'ottava: 140 e 70 BPM correlano allo stesso
 *     modo, e i rami di normalizzazione erano codice morto perché la ricerca era
 *     già vincolata a 70-180.
 *
 * Qui: onset detection function a flusso spettrale, sottrazione della media
 * mobile, autocorrelazione su segnale centrato, aggregazione armonica a pettine
 * e prior percettivo sul tempo.
 */

import { computeSpectrogram } from '../dsp/stft';

export const TEMPO_FRAME_SIZE = 1024;
export const TEMPO_HOP_SIZE = 256;

/** Intervallo di ricerca. Più ampio dei 70-180 precedenti. */
export const MIN_BPM = 60;
export const MAX_BPM = 200;

/** Centro del prior percettivo del tempo, in BPM. */
const TEMPO_PRIOR_CENTER = 125;
/** Ampiezza del prior, in ottave di tempo. */
const TEMPO_PRIOR_SIGMA = 0.9;

/** Pesi dell'aggregazione armonica: il periodo vero riceve energia dai multipli. */
const COMB_WEIGHTS = [1, 0.5, 0.25, 0.125];

export interface TempoResult {
  /** BPM frazionario, es. 140.3. */
  bpm: number;
  /** 0..1, derivata dalla prominenza reale del picco. */
  confidence: number;
  /** Alternative d'ottava, la prima è quella scelta. */
  candidates: number[];
}

/**
 * Onset detection function: flusso spettrale rettificato a mezza onda.
 * Isola gli aumenti di energia, cioè gli attacchi, ignorando i decadimenti.
 */
export function onsetStrength(samples: Float32Array, sampleRate: number): {
  odf: Float32Array;
  odfRate: number;
} {
  const spec = computeSpectrogram(samples, sampleRate, TEMPO_FRAME_SIZE, TEMPO_HOP_SIZE);
  const n = spec.frames.length;
  if (n < 2) {
    return { odf: new Float32Array(0), odfRate: spec.frameRate };
  }

  const odf = new Float32Array(n - 1);
  for (let t = 1; t < n; t++) {
    const cur = spec.frames[t];
    const prev = spec.frames[t - 1];
    let flux = 0;
    for (let k = 0; k < cur.length; k++) {
      const diff = cur[k] - prev[k];
      if (diff > 0) flux += diff;
    }
    odf[t - 1] = flux;
  }

  return { odf, odfRate: spec.frameRate };
}

/**
 * Sottrae la media mobile e rettifica.
 * È la correzione del difetto 1: senza questo passaggio l'ODF resta tutto
 * positivo e la sua componente continua domina l'autocorrelazione.
 */
export function normalizeOdf(odf: Float32Array, odfRate: number): Float32Array {
  const n = odf.length;
  if (n === 0) return odf;

  const halfWin = Math.max(1, Math.round(0.25 * odfRate)); // finestra ~0,5 s
  const out = new Float32Array(n);

  // Somma prefissa per una media mobile in tempo lineare.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + odf[i];

  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - halfWin);
    const to = Math.min(n, i + halfWin + 1);
    const mean = (prefix[to] - prefix[from]) / (to - from);
    const v = odf[i] - mean;
    out[i] = v > 0 ? v : 0;
  }
  return out;
}

/** Autocorrelazione normalizzata di un segnale centrato sulla propria media. */
export function autocorrelate(signal: Float32Array, minLag: number, maxLag: number): Float64Array {
  const n = signal.length;
  const result = new Float64Array(maxLag + 1);
  if (n === 0) return result;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i];
  mean /= n;

  const centered = new Float64Array(n);
  for (let i = 0; i < n; i++) centered[i] = signal[i] - mean;

  let energy = 0;
  for (let i = 0; i < n; i++) energy += centered[i] * centered[i];
  if (energy <= 0) return result;

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let sum = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      sum += centered[i] * centered[i + lag];
    }
    // Normalizzazione per il numero di termini: senza, i lag lunghi sarebbero
    // sistematicamente penalizzati dalla minore sovrapposizione.
    result[lag] = sum / (limit * (energy / n));
  }
  return result;
}

function tempoPrior(bpm: number): number {
  const octaves = Math.log2(bpm / TEMPO_PRIOR_CENTER);
  return Math.exp(-0.5 * (octaves / TEMPO_PRIOR_SIGMA) ** 2);
}

/** Interpolazione parabolica attorno al massimo, per un BPM frazionario. */
function parabolicPeak(values: Float64Array, index: number): number {
  const yPrev = values[index - 1] ?? values[index];
  const y = values[index];
  const yNext = values[index + 1] ?? values[index];
  const denom = yPrev - 2 * y + yNext;
  if (denom === 0) return index;
  const delta = (0.5 * (yPrev - yNext)) / denom;
  // Un delta oltre mezzo campione significa che il massimo non è qui: si ignora.
  return Math.abs(delta) <= 0.5 ? index + delta : index;
}

export function detectTempo(samples: Float32Array, sampleRate: number): TempoResult {
  const { odf, odfRate } = onsetStrength(samples, sampleRate);
  if (odf.length < 4) {
    return { bpm: 0, confidence: 0, candidates: [] };
  }

  const novelty = normalizeOdf(odf, odfRate);

  const minLag = Math.max(1, Math.floor((60 / MAX_BPM) * odfRate));
  const maxLag = Math.min(
    Math.ceil((60 / MIN_BPM) * odfRate),
    Math.floor(novelty.length / 2),
  );
  if (maxLag <= minLag) {
    return { bpm: 0, confidence: 0, candidates: [] };
  }

  // L'autocorrelazione arriva fino al quarto armonico del lag più lungo: senza,
  // i candidati lenti avrebbero meno termini nel pettine e la normalizzazione
  // finirebbe per premiarli, che è esattamente l'errore d'ottava da evitare.
  const acMaxLag = Math.min(maxLag * COMB_WEIGHTS.length, novelty.length - 1);
  const ac = autocorrelate(novelty, minLag, acMaxLag);
  const totalCombWeight = COMB_WEIGHTS.reduce((a, b) => a + b, 0);

  // Aggregazione armonica: il periodo di battuta vero riceve contributo da tutti
  // i suoi multipli, un sottomultiplo casuale no. È la correzione del difetto 2.
  const score = new Float64Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let m = 0; m < COMB_WEIGHTS.length; m++) {
      const harmonicLag = lag * (m + 1);
      if (harmonicLag > acMaxLag) break;
      sum += COMB_WEIGHTS[m] * ac[harmonicLag];
    }
    // Divisione per il peso TOTALE, non per quello effettivamente usato: un
    // candidato i cui armonici cadono fuori range non deve guadagnarci.
    const bpm = (60 * odfRate) / lag;
    score[lag] = (sum / totalCombWeight) * tempoPrior(bpm);
  }

  let bestLag = minLag;
  let bestScore = -Infinity;
  let scoreSum = 0;
  let scoreCount = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    scoreSum += score[lag];
    scoreCount++;
    if (score[lag] > bestScore) {
      bestScore = score[lag];
      bestLag = lag;
    }
  }

  const refinedLag = parabolicPeak(score, bestLag);
  const bpm = (60 * odfRate) / refinedLag;

  const meanScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
  const prominence = meanScore > 0 ? bestScore / meanScore : 0;
  const confidence = Math.max(0, Math.min(1, (prominence - 1) / 2));

  const candidates = [bpm, bpm / 2, bpm * 2]
    .filter(b => b >= MIN_BPM && b <= MAX_BPM)
    .map(b => Math.round(b * 10) / 10);

  return {
    bpm: Math.round(bpm * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    candidates,
  };
}
