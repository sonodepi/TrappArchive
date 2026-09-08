/**
 * Decodifica audio condivisa fra la trascrizione AI (che invia a Gemini) e
 * l'analisi BPM/tonalità (che lavora sui campioni).
 *
 * Entrambe hanno bisogno della stessa cosa: campioni mono a una frequenza nota.
 * decodeAudioData e OfflineAudioContext esistono solo sul thread principale,
 * quindi la decodifica avviene qui e il Float32Array risultante viene poi
 * trasferito al Web Worker senza copia.
 */

export interface DecodedAudio {
  /** Campioni mono normalizzati in [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
  /** Canali della sorgente originale, prima del downmix. */
  sourceChannels: number;
  sourceSampleRate: number;
}

export class AudioDecodeError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AudioDecodeError';
  }
}

function getOfflineContextClass(): typeof OfflineAudioContext {
  const ctor =
    (typeof OfflineAudioContext !== 'undefined' && OfflineAudioContext) ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!ctor) {
    throw new AudioDecodeError(
      "Questo browser non supporta la Web Audio API, necessaria per analizzare l'audio.",
    );
  }
  return ctor;
}

/** decodeAudioData con supporto sia alla forma a promessa sia a quella con callback (Safari). */
function decodeAudioDataCompat(
  ctx: BaseAudioContext,
  buffer: ArrayBuffer,
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (b: AudioBuffer) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    const ko = (e: unknown) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    };
    try {
      const maybe = ctx.decodeAudioData(buffer, ok, ko as (e: DOMException) => void);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === 'function') {
        (maybe as Promise<AudioBuffer>).then(ok, ko);
      }
    } catch (e) {
      ko(e);
    }
  });
}

/**
 * Decodifica un file audio, lo somma in mono e lo ricampiona alla frequenza richiesta.
 *
 * Il downmix è affidato al motore Web Audio: collegando una sorgente a N canali a un
 * OfflineAudioContext a 1 canale si applicano le regole standard di mixdown
 * (per lo stereo: 0.5·(L+R)).
 */
export async function decodeToMono(
  file: Blob,
  targetSampleRate: number,
  signal?: AbortSignal,
): Promise<DecodedAudio> {
  if (signal?.aborted) throw new DOMException('Annullato', 'AbortError');

  const OfflineCtx = getOfflineContextClass();
  const arrayBuffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Annullato', 'AbortError');

  // Contesto minimo usato solo per decodificare: non renderizza nulla.
  const decodeCtx = new OfflineCtx(1, 1, 44100);

  let decoded: AudioBuffer;
  try {
    decoded = await decodeAudioDataCompat(decodeCtx, arrayBuffer);
  } catch (err) {
    throw new AudioDecodeError(
      'Formato audio non riconosciuto o file danneggiato. Formati supportati: MP3, WAV, M4A, AAC, OGG, FLAC.',
      err,
    );
  }

  if (decoded.length === 0) {
    throw new AudioDecodeError("Il file audio è vuoto.");
  }
  if (signal?.aborted) throw new DOMException('Annullato', 'AbortError');

  const frames = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
  const renderCtx = new OfflineCtx(1, frames, targetSampleRate);
  const source = renderCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(renderCtx.destination);
  source.start(0);

  const rendered = await renderCtx.startRendering();

  return {
    samples: rendered.getChannelData(0),
    sampleRate: targetSampleRate,
    durationMs: Math.round(decoded.duration * 1000),
    sourceChannels: decoded.numberOfChannels,
    sourceSampleRate: decoded.sampleRate,
  };
}

/**
 * Estrae una finestra centrale di al massimo `maxSeconds`.
 * L'inizio di un brano è spesso una intro senza batteria: analizzare il centro
 * dà stime di tempo e tonalità sensibilmente più stabili.
 */
export function centerWindow(
  samples: Float32Array,
  sampleRate: number,
  maxSeconds: number,
): Float32Array {
  const maxLen = Math.floor(maxSeconds * sampleRate);
  if (samples.length <= maxLen) return samples;
  const start = Math.floor((samples.length - maxLen) / 2);
  return samples.subarray(start, start + maxLen);
}
