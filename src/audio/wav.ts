/**
 * Encoder WAV (RIFF / PCM 16 bit).
 *
 * Serve alla trascrizione: Gemini ricampiona internamente ogni input audio a
 * 16 kHz mono, quindi convertire prima dell'invio non perde nulla di ciò che il
 * modello userebbe, garantisce un MIME sempre supportato (anche partendo da .m4a)
 * e riduce la richiesta a 32 KB al secondo di audio.
 */

/** Converte campioni float [-1,1] in un Blob WAV PCM 16 bit mono. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');

  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // dimensione del chunk fmt
  view.setUint16(20, 1, true); // formato 1 = PCM interi
  view.setUint16(22, 1, true); // canali
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte al secondo
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);

  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp prima della conversione: un campione fuori scala altrimenti wrappa
    // e produce un click udibile.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Codifica un Blob in base64 puro (senza il prefisso data:). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
