import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './store';
import { SETTINGS_STORAGE_KEY } from './types';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('identita’ locale per la collaborazione', () => {
  it('genera un id alla prima apertura, senza nulla in archivio', () => {
    // Senza questo, authorId restava vuoto per chiunque: due dispositivi
    // diversi risultavano la stessa persona, e ognuno poteva scrivere nei
    // blocchi degli altri.
    const settings = loadSettings();
    expect(settings.authorId).toBeTruthy();
    expect(settings.authorId.length).toBeGreaterThan(10);
  });

  it('lo conserva fra un avvio e l’altro', () => {
    const primo = loadSettings().authorId;
    expect(loadSettings().authorId).toBe(primo);
  });

  it('ne genera uno anche se l’archivio e’ corrotto', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{non json');
    expect(loadSettings().authorId).toBeTruthy();
  });

  it('ne genera uno per una configurazione salvata prima di questa versione', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ geminiApiKey: 'x' }));
    const settings = loadSettings();
    expect(settings.authorId).toBeTruthy();
    expect(settings.geminiApiKey).toBe('x');
  });

  it('due archivi distinti producono identita’ diverse', () => {
    const a = loadSettings().authorId;
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
    expect(loadSettings().authorId).not.toBe(a);
  });

  it('non perde l’identita’ salvando altre impostazioni', () => {
    const settings = loadSettings();
    saveSettings({ ...settings, authorName: 'Depi' });
    expect(loadSettings().authorId).toBe(settings.authorId);
    expect(loadSettings().authorName).toBe('Depi');
  });
});
