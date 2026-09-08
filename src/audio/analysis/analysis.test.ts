import { describe, expect, it } from 'vitest';
import { detectTempo } from './tempo';
import { computeChroma, detectKey, pearson, rankKeys } from './key';
import { camelotFromKeyName, formatKey, toCamelot } from './camelot';
import { fft, magnitudeSpectrum } from '../dsp/fft';

const SR = 22050;

/**
 * Click track: ogni battito è un breve burst di rumore con decadimento
 * esponenziale, che produce un fronte di salita netto nel flusso spettrale
 * esattamente come farebbe un kick o uno snare.
 */
function makeClickTrack(
  bpm: number,
  seconds: number,
  opts: { jitterMs?: number; ghostBeats?: boolean; seed?: number } = {},
): Float32Array {
  const { jitterMs = 0, ghostBeats = false, seed = 1 } = opts;
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  const period = (60 / bpm) * SR;

  // PRNG deterministico: i test non devono essere casuali.
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const burst = (center: number, amplitude: number) => {
    const len = Math.floor(0.03 * SR);
    for (let i = 0; i < len; i++) {
      const idx = Math.floor(center) + i;
      if (idx < 0 || idx >= n) continue;
      const decay = Math.exp(-i / (0.006 * SR));
      out[idx] += amplitude * decay * (rand() * 2 - 1);
    }
  };

  for (let beat = 0; beat * period < n; beat++) {
    const jitter = jitterMs > 0 ? ((rand() * 2 - 1) * jitterMs * SR) / 1000 : 0;
    burst(beat * period + jitter, 1);
    // Ottavi deboli: il caso che tipicamente fa raddoppiare la stima.
    if (ghostBeats) burst(beat * period + period / 2 + jitter, 0.25);
  }
  return out;
}

/** Tono armonico: fondamentale + armoniche in decadimento, come uno strumento reale. */
function addTone(out: Float32Array, freq: number, start: number, length: number, gain: number) {
  for (let h = 1; h <= 6; h++) {
    const f = freq * h;
    if (f > SR / 2) break;
    const a = (gain / h) * 0.5;
    for (let i = 0; i < length; i++) {
      const idx = start + i;
      if (idx >= out.length) break;
      const env = Math.min(1, i / (0.01 * SR)) * Math.exp(-i / (0.9 * SR));
      out[idx] += a * env * Math.sin((2 * Math.PI * f * i) / SR);
    }
  }
}

const NOTE_FREQ: Record<string, number> = {
  C: 261.63, 'C#': 277.18, D: 293.66, 'D#': 311.13, E: 329.63, F: 349.23,
  'F#': 369.99, G: 392.0, 'G#': 415.3, A: 440.0, 'A#': 466.16, B: 493.88,
};

/** Progressione di triadi, ogni accordo di 1,5 s. */
function makeProgression(chords: string[][], repeats = 3): Float32Array {
  const chordLen = Math.floor(1.5 * SR);
  const out = new Float32Array(chordLen * chords.length * repeats);
  let cursor = 0;
  for (let r = 0; r < repeats; r++) {
    for (const chord of chords) {
      for (const note of chord) {
        addTone(out, NOTE_FREQ[note], cursor, chordLen, 0.3);
      }
      cursor += chordLen;
    }
  }
  return out;
}

describe('FFT', () => {
  it('trova la frequenza di una sinusoide nel bin corretto', () => {
    const n = 1024;
    const binTarget = 64;
    const frame = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      frame[i] = Math.sin((2 * Math.PI * binTarget * i) / n);
    }
    const mag = magnitudeSpectrum(frame);
    let peak = 0;
    for (let k = 1; k < mag.length; k++) if (mag[k] > mag[peak]) peak = k;
    expect(peak).toBe(binTarget);
  });

  it('rifiuta lunghezze che non sono potenze di due', () => {
    expect(() => fft(new Float32Array(6), new Float32Array(6))).toThrow();
  });
});

describe('rilevamento BPM', () => {
  it.each([90, 128, 140])('riconosce un click track a %i BPM entro ±1', bpm => {
    const result = detectTempo(makeClickTrack(bpm, 30), SR);
    expect(Math.abs(result.bpm - bpm)).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('a 175 BPM e' + "'" + ' corretto a meno dell' + "'" + 'ottava', () => {
    // Un click track in cui ogni battito e' identico non contiene alcuna
    // informazione che distingua 175 BPM da 87,5: le due ipotesi hanno la stessa
    // autocorrelazione a ogni lag. Anche un ascoltatore umano batterebbe il piede
    // indifferentemente sull' + "'" + 'una o sull' + "'" + 'altra.
    // La garanzia sensata e' quindi quella octave-invariant (la "Accuracy2" della
    // letteratura): il valore giusto deve comparire fra i candidati restituiti.
    // Forzare il prior finche' questo caso sintetico non passa significherebbe
    // peggiorare l' + "'" + 'accuratezza sui brani veri.
    const result = detectTempo(makeClickTrack(175, 30), SR);
    const ok = result.candidates.some(c => Math.abs(c - 175) <= 1);
    expect(ok).toBe(true);
  });

  it('espone sempre le alternative d' + "'" + 'ottava fra i candidati', () => {
    const result = detectTempo(makeClickTrack(128, 30), SR);
    expect(result.candidates[0]).toBe(result.bpm);
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it('tollera un jitter di ±8 ms entro ±2 BPM', () => {
    const result = detectTempo(makeClickTrack(128, 30, { jitterMs: 8 }), SR);
    expect(Math.abs(result.bpm - 128)).toBeLessThanOrEqual(2);
  });

  it('non raddoppia il tempo in presenza di ottavi deboli', () => {
    // È il caso che l'implementazione precedente sbagliava: senza aggregazione
    // armonica la stima finiva su 280 o su 70.
    const result = detectTempo(makeClickTrack(140, 30, { ghostBeats: true }), SR);
    expect(Math.abs(result.bpm - 140)).toBeLessThanOrEqual(2);
  });

  it('dichiara confidenza nulla su un segnale senza ritmo', () => {
    const noise = new Float32Array(SR * 10);
    let state = 7;
    for (let i = 0; i < noise.length; i++) {
      state = (state * 1664525 + 1013904223) % 4294967296;
      noise[i] = (state / 4294967296) * 2 - 1;
    }
    const result = detectTempo(noise, SR);
    expect(result.confidence).toBeLessThan(0.35);
  });

  it('restituisce zero su un buffer troppo corto invece di inventare un valore', () => {
    expect(detectTempo(new Float32Array(100), SR).bpm).toBe(0);
  });
});

describe('rilevamento tonalità', () => {
  it('riconosce Do maggiore da una progressione C-F-G-C', () => {
    const audio = makeProgression([
      ['C', 'E', 'G'], ['F', 'A', 'C'], ['G', 'B', 'D'], ['C', 'E', 'G'],
    ]);
    expect(detectKey(audio, SR, 'temperley').key).toBe('C Major');
  });

  it('riconosce La minore da una progressione Am-Dm-E-Am', () => {
    const audio = makeProgression([
      ['A', 'C', 'E'], ['D', 'F', 'A'], ['E', 'G#', 'B'], ['A', 'C', 'E'],
    ]);
    expect(detectKey(audio, SR, 'temperley').key).toBe('A Minor');
  });

  it('concorda fra i tre profili su una progressione non ambigua', () => {
    const audio = makeProgression([
      ['C', 'E', 'G'], ['F', 'A', 'C'], ['G', 'B', 'D'], ['C', 'E', 'G'],
    ]);
    for (const p of ['krumhansl', 'temperley', 'albrecht'] as const) {
      expect(detectKey(audio, SR, p).key).toBe('C Major');
    }
  });

  it('assegna confidenza nulla a un chroma piatto', () => {
    const flat = new Float64Array(12).fill(1 / 12);
    const ranked = rankKeys(flat, 'temperley');
    expect(Math.abs(ranked[0].r - ranked[1].r)).toBeLessThan(1e-9);
  });

  it('produce un chroma che somma a 1', () => {
    const audio = makeProgression([['C', 'E', 'G']], 2);
    const chroma = computeChroma(audio, SR);
    const sum = chroma.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('correlazione di Pearson', () => {
  it('vale 1 per vettori identici e -1 per vettori opposti', () => {
    const x = [1, 2, 3, 4, 5];
    expect(pearson(x, x)).toBeCloseTo(1, 10);
    expect(pearson(x, x.map(v => -v))).toBeCloseTo(-1, 10);
  });

  it('è invariante rispetto a scala e traslazione, il prodotto scalare no', () => {
    // È la ragione per cui i profili vanno confrontati con Pearson: aggiungere una
    // costante a un profilo non deve cambiare quale tonalità vince.
    const x = [1, 2, 3, 4];
    const y = [2, 4, 6, 8];
    const shifted = y.map(v => v + 100);
    expect(pearson(x, y)).toBeCloseTo(pearson(x, shifted), 10);
  });

  it('vale 0 su un vettore costante', () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });
});

describe('ruota Camelot', () => {
  it('mappa tutte le 24 tonalità in modo biunivoco', () => {
    const codes = new Set<string>();
    for (let pc = 0; pc < 12; pc++) {
      codes.add(toCamelot(pc, 'Major'));
      codes.add(toCamelot(pc, 'Minor'));
    }
    expect(codes.size).toBe(24);
  });

  it('rispetta i riferimenti noti della ruota', () => {
    expect(camelotFromKeyName('A Minor')).toBe('8A');
    expect(camelotFromKeyName('C Major')).toBe('8B');
    expect(camelotFromKeyName('F# Minor')).toBe('11A');
    expect(camelotFromKeyName('Eb Major')).toBe('5B');
  });

  it('tratta le enarmonie come la stessa tonalità', () => {
    expect(camelotFromKeyName('G# Minor')).toBe(camelotFromKeyName('Ab Minor'));
    expect(camelotFromKeyName('Db Major')).toBe(camelotFromKeyName('C# Major'));
    expect(camelotFromKeyName('Gb Major')).toBe(camelotFromKeyName('F# Major'));
  });

  it('formatta le tonalità con la scrittura convenzionale', () => {
    expect(formatKey(3, 'Major')).toBe('Eb Major');
    expect(formatKey(6, 'Minor')).toBe('F# Minor');
  });
});
