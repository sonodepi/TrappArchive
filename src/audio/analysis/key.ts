/**
 * Rilevamento della tonalità.
 *
 * Correzioni rispetto all'implementazione precedente:
 *  3. il chromagram nasceva da una DFT che sottocampionava i campioni (n += 4)
 *     senza filtro anti-alias, e analizzava solo 30 finestre non sovrapposte
 *     prese dall'inizio del brano, dove spesso c'è solo l'intro;
 *  4. il confronto con i profili usava il prodotto scalare invece della
 *     correlazione di Pearson: senza centrare le variabili sulle rispettive
 *     medie si premiano i profili con media alta, non quelli con la forma giusta.
 */

import { binFrequency, computeSpectrogram } from '../dsp/stft';
import { formatKey, toCamelot, type Scale } from './camelot';

export const KEY_FRAME_SIZE = 4096;
export const KEY_HOP_SIZE = 2048;

/** Intervallo analizzato: C2 - C7. Sotto ci sono i bassi, sopra soprattutto timbro. */
const MIN_FREQ = 65;
const MAX_FREQ = 2100;

/** Fattore di compressione logaritmica: attenua il dominio di timbro e percussioni. */
const LOG_COMPRESSION_GAMMA = 100;

/**
 * Pesi della sommazione armonica (h = 1..6), decrescenti come 1/h.
 *
 * Serve a riportare l'energia degli armonici sulla fondamentale che li ha
 * generati. Senza, un DO con armoniche forti deposita molta energia sul SOL
 * (terza armonica) e la tonalità stimata scivola sulla dominante: è esattamente
 * l'errore che i test rilevavano su una progressione C-F-G-C.
 */
const HARMONIC_WEIGHTS = [1, 0.5, 1 / 3, 0.25, 0.2, 1 / 6];

export type KeyProfileName = 'krumhansl' | 'temperley' | 'albrecht';

interface ProfilePair {
  major: number[];
  minor: number[];
  label: string;
}

/**
 * I tre profili pubblicati più usati. Sono indicizzati rispetto alla tonica:
 * profile[0] è il peso della tonica, profile[1] della seconda minore, ecc.
 */
export const KEY_PROFILES: Record<KeyProfileName, ProfilePair> = {
  // Krumhansl & Kessler 1982, da esperimenti su ascoltatori.
  krumhansl: {
    label: 'Krumhansl-Schmuckler',
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  },
  // Temperley 1999, ricalibrato sul corpus Kostka-Payne: più adatto alla musica popolare.
  temperley: {
    label: 'Temperley',
    major: [0.748, 0.060, 0.488, 0.082, 0.670, 0.460, 0.096, 0.715, 0.104, 0.366, 0.057, 0.400],
    minor: [0.712, 0.084, 0.474, 0.618, 0.049, 0.460, 0.105, 0.747, 0.404, 0.067, 0.133, 0.330],
  },
  // Albrecht & Shanahan 2013, ricavato da un corpus ampio.
  albrecht: {
    label: 'Albrecht-Shanahan',
    major: [0.238, 0.006, 0.111, 0.006, 0.137, 0.094, 0.016, 0.214, 0.009, 0.080, 0.008, 0.081],
    minor: [0.220, 0.006, 0.104, 0.123, 0.019, 0.103, 0.012, 0.214, 0.062, 0.022, 0.061, 0.052],
  },
};

export interface KeyResult {
  key: string;
  scale: Scale;
  pitchClass: number;
  camelot: string;
  confidence: number;
  /** Seconda ipotesi, utile quando la confidenza è bassa. */
  alternative: string;
  profile: KeyProfileName;
}

/**
 * Chromagram a 12 classi di altezza.
 * Nessun sottocampionamento: ogni bin dello spettro contribuisce alla propria
 * classe di altezza, calcolata sulla scala MIDI (nota 60 = C4, e 60 mod 12 = 0 = C).
 */
export function computeChroma(samples: Float32Array, sampleRate: number): Float64Array {
  const spec = computeSpectrogram(samples, sampleRate, KEY_FRAME_SIZE, KEY_HOP_SIZE);
  const chroma = new Float64Array(12);
  if (spec.frames.length === 0) return chroma;

  // Mappa precalcolata bin → contributi (classe di altezza, peso), che include
  // la sommazione armonica. Si calcola una volta sola per tutti i frame.
  const contributions: { pc: number; weight: number }[][] = [];
  for (let k = 0; k < spec.numBins; k++) {
    const freq = binFrequency(k, spec.frameSize, sampleRate);
    const list: { pc: number; weight: number }[] = [];
    if (freq >= MIN_FREQ && freq <= MAX_FREQ) {
      for (let h = 1; h <= HARMONIC_WEIGHTS.length; h++) {
        // Se questo bin fosse l'armonica h-esima, la fondamentale starebbe a freq/h.
        const fundamental = freq / h;
        if (fundamental < MIN_FREQ / 2) break;
        const midi = 69 + 12 * Math.log2(fundamental / 440);
        list.push({
          pc: ((Math.round(midi) % 12) + 12) % 12,
          weight: HARMONIC_WEIGHTS[h - 1],
        });
      }
    }
    contributions.push(list);
  }

  for (const frame of spec.frames) {
    for (let k = 0; k < frame.length; k++) {
      const list = contributions[k];
      if (list.length === 0) continue;
      const energy = Math.log(1 + LOG_COMPRESSION_GAMMA * frame[k]);
      if (energy <= 0) continue;
      for (const c of list) {
        chroma[c.pc] += energy * c.weight;
      }
    }
  }

  const total = chroma.reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= total;
  }
  return chroma;
}

/** Coefficiente di correlazione di Pearson fra due vettori della stessa lunghezza. */
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

interface Candidate {
  pitchClass: number;
  scale: Scale;
  r: number;
}

/** Correla il chroma con le 24 rotazioni dei profili e restituisce la classifica. */
export function rankKeys(
  chroma: ArrayLike<number>,
  profileName: KeyProfileName,
): Candidate[] {
  const profile = KEY_PROFILES[profileName];
  const rotated = new Float64Array(12);
  const candidates: Candidate[] = [];

  for (let root = 0; root < 12; root++) {
    for (const scale of ['Major', 'Minor'] as const) {
      const reference = scale === 'Major' ? profile.major : profile.minor;
      for (let i = 0; i < 12; i++) {
        rotated[i] = chroma[(root + i) % 12];
      }
      candidates.push({ pitchClass: root, scale, r: pearson(rotated, reference) });
    }
  }

  candidates.sort((a, b) => b.r - a.r);
  return candidates;
}

export function detectKey(
  samples: Float32Array,
  sampleRate: number,
  profileName: KeyProfileName = 'temperley',
): KeyResult {
  const chroma = computeChroma(samples, sampleRate);
  const ranked = rankKeys(chroma, profileName);
  const best = ranked[0];
  const second = ranked[1];

  // Confidenza dal margine fra prima e seconda ipotesi. Un chroma piatto produce
  // correlazioni tutte simili e quindi confidenza ~0: nessuna finta precisione.
  const margin = best.r - second.r;
  const confidence = Math.max(0, Math.min(1, margin * 4));

  return {
    key: formatKey(best.pitchClass, best.scale),
    scale: best.scale,
    pitchClass: best.pitchClass,
    camelot: toCamelot(best.pitchClass, best.scale),
    confidence: Math.round(confidence * 100) / 100,
    alternative: formatKey(second.pitchClass, second.scale),
    profile: profileName,
  };
}
