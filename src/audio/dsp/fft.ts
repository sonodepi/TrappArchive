/**
 * FFT radix-2 iterativa, in-place (Cooley-Tukey, decimazione nel tempo).
 *
 * Sostituisce la DFT diretta della versione precedente, che campionava i
 * campioni con passo 4 per stare nei tempi: quel sottocampionamento senza filtro
 * introduceva aliasing e falsava il chromagram.
 */

/** True se n è una potenza di due maggiore di zero. */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Potenza di due maggiore o uguale a n. */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Trasformata in-place. `re` e `im` devono avere la stessa lunghezza,
 * che deve essere una potenza di due.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n !== im.length) throw new Error('fft: re e im devono avere la stessa lunghezza');
  if (!isPowerOfTwo(n)) throw new Error('fft: la lunghezza deve essere una potenza di due');
  if (n === 1) return;

  // Permutazione bit-reversal.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Farfalle, stadio per stadio.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRealStep = Math.cos(ang);
    const wImagStep = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half] * wRe - im[i + k + half] * wIm;
        const bIm = re[i + k + half] * wIm + im[i + k + half] * wRe;

        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe;
        im[i + k + half] = aIm - bIm;

        const nextRe = wRe * wRealStep - wIm * wImagStep;
        wIm = wRe * wImagStep + wIm * wRealStep;
        wRe = nextRe;
      }
    }
  }
}

/**
 * Spettro di magnitudine di un segnale reale.
 * Restituisce n/2 + 1 bin (da DC a Nyquist).
 */
export function magnitudeSpectrum(frame: Float32Array): Float32Array {
  const n = frame.length;
  const re = new Float32Array(n);
  re.set(frame);
  const im = new Float32Array(n);
  fft(re, im);

  const bins = (n >> 1) + 1;
  const out = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    out[k] = Math.hypot(re[k], im[k]);
  }
  return out;
}
