/**
 * Impostazioni dell'applicazione.
 */

// La preferenza di formato appartiene al testo, non alle impostazioni: qui
// viene solo conservata, e si riesporta perche' le schermate la leggono da qui.
import type { LyricsFormat } from '../lyrics/bars';
export type { LyricsFormat };

export type KeyProfileName = 'krumhansl' | 'temperley' | 'albrecht';

export interface AppSettings {
  /**
   * Identita' locale di chi scrive, per la collaborazione sulle bozze.
   * Vive solo su questo dispositivo: nessun account, nessun server. Serve
   * unicamente a sapere di chi e' un blocco quando le bozze si scambiano.
   */
  authorId: string;
  authorName: string;

  /**
   * Progetto Firebase per la sincronizzazione, facoltativo.
   *
   * Questi valori non sono segreti: sono identificatori pubblici del progetto
   * e finiscono comunque nel codice che gira nel browser. A proteggere i dati
   * sono le regole di Firestore (firestore.rules), non la loro segretezza.
   * Stanno qui, e non nel bundle, perche' ogni utente punti al proprio
   * progetto invece che a uno comune da mantenere.
   */
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
  /** Profilo di riferimento per il rilevamento della tonalità. */
  keyProfile: KeyProfileName;
  /**
   * Come mostrare il testo: tutto insieme con le ad libs in giallo, oppure
   * diviso in due colonne. E' solo una preferenza di lettura - il testo
   * salvato non cambia - e vale per tutte le schermate in cui si scrive.
   */
  lyricsFormat: LyricsFormat;
}

export const DEFAULT_SETTINGS: AppSettings = {
  authorId: '',
  authorName: '',
  keyProfile: 'temperley',
  lyricsFormat: 'mixed',
};

export const SETTINGS_STORAGE_KEY = 'trapparchive_settings';
