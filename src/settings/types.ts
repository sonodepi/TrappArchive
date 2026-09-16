/**
 * Impostazioni dell'applicazione.
 */

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
}

export const DEFAULT_SETTINGS: AppSettings = {
  authorId: '',
  authorName: '',
  keyProfile: 'temperley',
};

export const SETTINGS_STORAGE_KEY = 'trapparchive_settings';
