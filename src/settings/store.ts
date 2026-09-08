import { useCallback, useEffect, useState } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from './types';

/** Legge le impostazioni, tollerando storage assente, pieno o corrotto. */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Merge sui default: una versione futura può aggiungere campi senza rompere.
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
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

/** True se le funzioni AI sono utilizzabili. */
export function hasAiCredentials(settings: AppSettings): boolean {
  return settings.geminiApiKey.trim().length > 0;
}
