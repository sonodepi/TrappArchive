/**
 * Client Gemini per la trascrizione dei testi.
 *
 * SICUREZZA — regole rispettate in questo file:
 *  - la chiave arriva sempre come parametro, non viene mai letta da import.meta.env
 *    e non è mai inserita nel bundle;
 *  - non viene mai stampata nei log, nemmeno parzialmente, nemmeno negli errori:
 *    i messaggi di errore sono riscritti prima di essere mostrati;
 *  - il client viene costruito su ogni chiamata e non è mai memorizzato in un
 *    modulo globale che potrebbe finire in uno stato serializzato.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { decodeToMono } from '../audio/decode';
import { blobToBase64, encodeWav16 } from '../audio/wav';
import type { TranscriptionLanguage } from '../settings/types';
import {
  GeminiError,
  type TranscribeParams,
  type TranscriptionResult,
  type LyricsSection,
} from './gemini-types';

export * from './gemini-types';

/** Gemini ricampiona comunque a 16 kHz mono: inviare di più è solo banda sprecata. */
const TRANSCRIBE_SAMPLE_RATE = 16000;

/**
 * Soglia oltre la quale si passa alla Files API invece dell'inline.
 * A 16 kHz mono 16 bit servono 32 KB/s, quindi 15 MB ≈ 8 minuti di audio.
 */
const INLINE_LIMIT_BYTES = 15 * 1024 * 1024;

const LANGUAGE_NAMES: Record<TranscriptionLanguage, string> = {
  it: 'italiano',
  en: 'inglese',
  es: 'spagnolo',
  fr: 'francese',
  auto: 'la lingua che senti',
};

function systemInstructionFor(language: TranscriptionLanguage): string {
  return [
    'Sei un trascrittore di testi musicali specializzato in rap, trap e musica urban.',
    `Il brano è cantato in ${LANGUAGE_NAMES[language]}.`,
    'Trascrivi ESATTAMENTE ciò che senti, rispettando queste regole tassative:',
    '- Una barra per riga, seguendo la metrica di come viene rappata.',
    '- Marca le sezioni con etichette tipo [Strofa 1], [Ritornello], [Bridge], [Outro].',
    '- Conserva slang, dialetto, forme tronche ed espressioni volgari senza censurarle',
    '  né correggerle: fanno parte del testo e alterarle è un errore di trascrizione.',
    '- Non inventare nulla. Se un passaggio è incomprensibile scrivi [?].',
    '- Se una parte è strumentale, indicala come sezione [Strumentale] con testo vuoto.',
    '- Non aggiungere commenti, spiegazioni, traduzioni o preamboli.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: {
      type: Type.STRING,
      description: "Codice ISO 639-1 della lingua rilevata, es. 'it'",
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'es. [Strofa 1], [Ritornello]' },
          text: { type: Type.STRING, description: 'Le barre, una per riga' },
        },
        required: ['label', 'text'],
      },
    },
  },
  required: ['language', 'sections'],
};

/**
 * Traduce un errore dell'SDK in un messaggio utile, senza mai propagare il testo
 * grezzo (che in alcuni casi include l'URL della richiesta, chiave inclusa).
 */
function translateError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') throw err;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new GeminiError(
      'La trascrizione AI richiede una connessione a Internet. Il resto di TrappArchive funziona offline.',
      'offline',
    );
  }

  const raw = err instanceof Error ? err.message : String(err);
  const status =
    (err as { status?: number })?.status ??
    Number(raw.match(/\b(400|401|403|404|429|500|503)\b/)?.[1] ?? 0);

  if (status === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) {
    return new GeminiError(
      'Quota Gemini esaurita per questa chiave. Riprova più tardi o usa una chiave diversa.',
      'quota',
    );
  }
  if (/API_KEY_INVALID|api key not valid|invalid.*api.?key/i.test(raw) || status === 401) {
    return new GeminiError(
      'Chiave Gemini non valida. Controllala in Impostazioni.',
      'invalid-key',
    );
  }
  if (status === 403 || /PERMISSION_DENIED|SERVICE_DISABLED/i.test(raw)) {
    return new GeminiError(
      "Questa chiave non è abilitata all'API Gemini, oppure il modello scelto non è accessibile.",
      'forbidden',
    );
  }
  if (status === 404 || /not found|NOT_FOUND/i.test(raw)) {
    return new GeminiError(
      'Modello non trovato. Verifica il nome del modello in Impostazioni.',
      'unknown',
    );
  }
  if (status === 400) {
    return new GeminiError(
      'Richiesta rifiutata da Gemini. Verifica chiave e modello in Impostazioni.',
      'invalid-key',
    );
  }
  return new GeminiError(
    'Errore durante la comunicazione con Gemini. Riprova fra poco.',
    'unknown',
  );
}

/** Verifica che la chiave funzioni, con una richiesta minima. */
export async function verifyApiKey(
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!apiKey.trim()) {
    throw new GeminiError('Inserisci una chiave Gemini.', 'no-key');
  }
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
      config: { maxOutputTokens: 8, temperature: 0, abortSignal: signal },
    });
  } catch (err) {
    throw translateError(err);
  }
}

/**
 * Trascrive un file audio.
 *
 * L'audio viene sempre normalizzato a WAV 16 kHz mono prima dell'invio: risolve
 * insieme la compatibilità dei container (un .m4a non sarebbe accettato) e la
 * dimensione della richiesta, senza perdita utile per il modello.
 */
export async function transcribeAudio({
  audio,
  apiKey,
  model,
  language,
  signal,
  onPhase,
}: TranscribeParams): Promise<TranscriptionResult> {
  if (!apiKey.trim()) {
    throw new GeminiError(
      'Configura la tua chiave Gemini in Impostazioni per usare la trascrizione AI.',
      'no-key',
    );
  }

  onPhase?.('decoding');
  const decoded = await decodeToMono(audio, TRANSCRIBE_SAMPLE_RATE, signal);

  onPhase?.('encoding');
  const wav = encodeWav16(decoded.samples, decoded.sampleRate);
  if (signal?.aborted) throw new DOMException('Annullato', 'AbortError');

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  onPhase?.('uploading');
  let audioPart;
  if (wav.size <= INLINE_LIMIT_BYTES) {
    audioPart = {
      inlineData: { mimeType: 'audio/wav', data: await blobToBase64(wav) },
    };
  } else {
    // Oltre ~8 minuti si passa alla Files API, che non ha il limite della richiesta inline.
    try {
      const uploaded = await ai.files.upload({
        file: wav,
        config: { mimeType: 'audio/wav' },
      });
      if (!uploaded.uri) {
        throw new GeminiError("Caricamento del file non riuscito.", 'unknown');
      }
      audioPart = { fileData: { fileUri: uploaded.uri, mimeType: 'audio/wav' } };
    } catch (err) {
      throw translateError(err);
    }
  }
  if (signal?.aborted) throw new DOMException('Annullato', 'AbortError');

  onPhase?.('transcribing');
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Trascrivi il testo di questo brano seguendo le regole ricevute.' },
            audioPart,
          ],
        },
      ],
      config: {
        systemInstruction: systemInstructionFor(language),
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        abortSignal: signal,
      },
    });
    text = response.text;
  } catch (err) {
    throw translateError(err);
  }

  if (!text) {
    throw new GeminiError(
      'Gemini non ha restituito alcun testo: il brano potrebbe essere strumentale o troppo rumoroso.',
      'empty',
    );
  }

  const parsed = parseTranscription(text);
  onPhase?.('done');

  return {
    lyrics: sectionsToLyrics(parsed.sections),
    language: parsed.language,
    sections: parsed.sections,
    model,
    durationMs: decoded.durationMs,
  };
}

/** L'output è vincolato dallo schema, ma un modello può comunque incorniciarlo. */
function parseTranscription(text: string): { language: string; sections: LyricsSection[] } {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    const obj = JSON.parse(cleaned) as {
      language?: string;
      sections?: { label?: string; text?: string }[];
    };
    const sections = (obj.sections ?? [])
      .map(s => ({ label: (s.label ?? '').trim(), text: (s.text ?? '').trim() }))
      .filter(s => s.label || s.text);
    if (sections.length > 0) {
      return { language: obj.language ?? 'it', sections };
    }
  } catch {
    // Ricade sul testo grezzo qui sotto.
  }
  return { language: 'it', sections: [{ label: '', text: cleaned }] };
}

function sectionsToLyrics(sections: LyricsSection[]): string {
  return sections
    .map(s => {
      const label = s.label ? (s.label.startsWith('[') ? s.label : `[${s.label}]`) : '';
      return [label, s.text].filter(Boolean).join('\n');
    })
    .join('\n\n')
    .trim();
}
