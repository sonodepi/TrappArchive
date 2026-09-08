import { magnitudeSpectrum } from './fft';

/** Finestra di Hann di lunghezza n (periodica). */
export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
  }
  return w;
}

export interface Spectrogram {
  /** frames[t][k] = magnitudine del bin k al frame t. */
  frames: Float32Array[];
  /** Numero di bin per frame: frameSize/2 + 1. */
  numBins: number;
  /** Frame al secondo. */
  frameRate: number;
  frameSize: number;
  hopSize: number;
  sampleRate: number;
}

/**
 * Spettrogramma di magnitudine con finestratura di Hann.
 * `frameSize` deve essere una potenza di due.
 */
export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  frameSize: number,
  hopSize: number,
): Spectrogram {
  const window = hannWindow(frameSize);
  const numFrames =
    samples.length >= frameSize
      ? 1 + Math.floor((samples.length - frameSize) / hopSize)
      : 0;

  const frames: Float32Array[] = [];
  const buffer = new Float32Array(frameSize);

  for (let t = 0; t < numFrames; t++) {
    const offset = t * hopSize;
    for (let i = 0; i < frameSize; i++) {
      buffer[i] = samples[offset + i] * window[i];
    }
    frames.push(magnitudeSpectrum(buffer));
  }

  return {
    frames,
    numBins: (frameSize >> 1) + 1,
    frameRate: sampleRate / hopSize,
    frameSize,
    hopSize,
    sampleRate,
  };
}

/** Frequenza centrale del bin k. */
export function binFrequency(k: number, frameSize: number, sampleRate: number): number {
  return (k * sampleRate) / frameSize;
}
