/**
 * Impostazioni dell'applicazione.
 *
 * SICUREZZA: la chiave Gemini è fornita dall'utente e vive solo in localStorage,
 * su questo dispositivo. Non è mai inclusa nel bundle, non è mai scritta nei log,
 * e non entra MAI nei backup JSON esportati da ExportSection (che leggono solo le
 * chiavi trapparchive_tracks / _albums / _drafts, mai SETTINGS_STORAGE_KEY).
 */

export type KeyProfileName = 'krumhansl' | 'temperley' | 'albrecht';

export type TranscriptionLanguage = 'it' | 'en' | 'es' | 'fr' | 'auto';

export interface AppSettings {
  /**
   * Identita' locale di chi scrive, per la collaborazione sulle bozze.
   * Vive solo su questo dispositivo: nessun account, nessun server. Serve
   * unicamente a sapere di chi e' un blocco quando le bozze si scambiano.
   */
  authorId: string;
  authorName: string;
  /** Chiave API Gemini dell'utente. Stringa vuota = funzioni AI disattivate. */
  geminiApiKey: string;
  /** Id del modello Gemini. Modificabile a mano: i nomi cambiano nel tempo. */
  geminiModel: string;
  /** Lingua attesa nella trascrizione. */
  transcriptionLanguage: TranscriptionLanguage;
  /** Profilo di riferimento per il rilevamento della tonalità. */
  keyProfile: KeyProfileName;
}

/**
 * Modello predefinito: GA, accetta audio in input ed è la scelta economica per la
 * trascrizione. L'elenco aggiornato dei modelli è su
 * https://ai.google.dev/gemini-api/docs/models — per questo il campo resta editabile.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Suggerimenti mostrati nella UI. Non è un elenco chiuso. */
export const SUGGESTED_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

export const DEFAULT_SETTINGS: AppSettings = {
  authorId: '',
  authorName: '',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  transcriptionLanguage: 'it',
  keyProfile: 'temperley',
};

export const SETTINGS_STORAGE_KEY = 'trapparchive_settings';
