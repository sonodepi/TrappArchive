import { useCallback, useEffect, useState } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from './types';

/** Legge le impostazioni, tollerando storage assente, pieno o corrotto. */
/**
 * Campi di versioni precedenti che non devono restare sul dispositivo.
 *
 * `geminiApiKey` e' una credenziale a consumo: la funzione che la usava e'
 * stata rimossa, e con lei la schermata da cui si poteva cancellare. Senza
 * questa ripulitura resterebbe nel browser per sempre, riscritta a ogni
 * salvataggio delle impostazioni, per una funzione che non esiste piu'.
 */
const CAMPI_RITIRATI = ['geminiApiKey', 'geminiModel', 'transcriptionLanguage'] as const;

/** Toglie i campi ritirati. Dice anche se ne ha trovato qualcuno. */
function dropRetired(parsed: Record<string, unknown>): { clean: Record<string, unknown>; found: boolean } {
  let found = false;
  const clean: Record<string, unknown> = { ...parsed };
  for (const campo of CAMPI_RITIRATI) {
    if (campo in clean) {
      delete clean[campo];
      found = true;
    }
  }
  return { clean, found };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    // Anche alla prima apertura serve un'identita': uscire di qui senza
    // passare da withIdentity lasciava authorId vuoto per tutti, e due
    // dispositivi diversi risultavano la stessa persona.
    if (!raw) return withIdentity({ ...DEFAULT_SETTINGS });
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { clean, found } = dropRetired(parsed);
    // Merge sui default: una versione futura può aggiungere campi senza rompere.
    const settings = withIdentity({ ...DEFAULT_SETTINGS, ...(clean as Partial<AppSettings>) });
    // Riscrive subito, senza aspettare che l'utente cambi qualcosa: la
    // credenziale vecchia deve sparire dall'archivio, non solo dalla memoria.
    if (found) saveSettings(settings);
    return settings;
  } catch {
    return withIdentity({ ...DEFAULT_SETTINGS });
  }
}

/**
 * Garantisce un'identita' locale per la collaborazione sulle bozze.
 *
 * Viene generata al primo avvio e non lascia mai il dispositivo se non dentro
 * una bozza che l'utente decide di esportare. Non e' un account: non c'e' nulla
 * da registrare e nulla da verificare.
 */
function withIdentity(settings: AppSettings): AppSettings {
  if (settings.authorId) return settings;
  const withId = { ...settings, authorId: crypto.randomUUID() };
  saveSettings(withId);
  return withId;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    // Quota esaurita o storage disabilitato: non è fatale, l'app resta usabile.
    console.warn('Impossibile salvare le impostazioni:', err);
  }
}

/**
 * Hook di accesso alle impostazioni, sincronizzato fra le schede aperte.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) {
        setSettings(loadSettings());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
