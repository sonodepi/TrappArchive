import React, { useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, HardDrive,
  KeyRound, Loader2, RefreshCw, Settings as SettingsIcon, ShieldCheck, Trash2,
} from 'lucide-react';

import { KEY_PROFILES } from '../audio/analysis/key';
import {
  SUGGESTED_GEMINI_MODELS,
  type AppSettings,
  type KeyProfileName,
  type TranscriptionLanguage,
} from '../settings/types';

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

const LANGUAGES: { value: TranscriptionLanguage; label: string }[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'Inglese' },
  { value: 'es', label: 'Spagnolo' },
  { value: 'fr', label: 'Francese' },
  { value: 'auto', label: 'Rileva automaticamente' },
];

export function Settings({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const runCheck = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCheck({ status: 'checking' });
    try {
      // Anche qui import dinamico: la schermata Impostazioni si apre istantanea
      // e l'SDK arriva solo se si preme davvero "Verifica chiave".
      const { verifyApiKey } = await import('../services/gemini');
      await verifyApiKey(settings.geminiApiKey, settings.geminiModel, controller.signal);
      setCheck({ status: 'ok' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setCheck({
        status: 'error',
        message: err instanceof Error ? err.message : 'Verifica non riuscita.',
      });
    }
  };

  const clearKey = () => {
    onUpdate({ geminiApiKey: '' });
    setCheck({ status: 'idle' });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <SettingsIcon className="text-blue-500 shrink-0" />
          Impostazioni
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Chiave Gemini per le funzioni AI e parametri dell'analisi audio.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Chiave Gemini                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <KeyRound size={17} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100">Chiave API Gemini</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Serve solo alla trascrizione automatica dei testi. Tutto il resto di
              TrappArchive, analisi BPM e tonalità comprese, funziona senza.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.geminiApiKey}
              onChange={e => {
                onUpdate({ geminiApiKey: e.target.value });
                setCheck({ status: 'idle' });
              }}
              placeholder="Incolla qui la tua chiave"
              autoComplete="off"
              spellCheck={false}
              aria-label="Chiave API Gemini"
              className="w-full bg-black/50 border border-slate-900 rounded-xl pl-4 pr-12 py-3 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              aria-label={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="button"
            onClick={runCheck}
            disabled={!settings.geminiApiKey.trim() || check.status === 'checking'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors border border-blue-400/50 flex items-center justify-center gap-2 min-h-[44px] shrink-0"
          >
            {check.status === 'checking'
              ? <Loader2 size={16} className="animate-spin" />
              : <ShieldCheck size={16} />}
            <span>Verifica chiave</span>
          </button>

          {settings.geminiApiKey && (
            <button
              type="button"
              onClick={clearKey}
              aria-label="Rimuovi la chiave"
              className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px] shrink-0"
            >
              <Trash2 size={15} />
              <span className="sm:hidden">Rimuovi</span>
            </button>
          )}
        </div>

        {check.status === 'ok' && (
          <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>Chiave valida: la trascrizione AI è attiva.</span>
          </div>
        )}
        {check.status === 'error' && (
          <div className="p-3 bg-rose-900/20 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
            <AlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            <span>{check.message}</span>
          </div>
        )}

        {/* Trasparenza sul modello di sicurezza: va detto, non nascosto. */}
        <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-200/90">
          <HardDrive size={15} className="shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong className="text-amber-200">Dove finisce questa chiave:</strong> resta
              su questo dispositivo, nell'archivio locale del browser, e viene inviata
              solo ai server di Google quando lanci una trascrizione. Non passa da
              nessun server di TrappArchive, che non esiste.
            </p>
            <p>
              Non è però una cassaforte: chi ha accesso fisico al dispositivo, o al
              profilo del browser, può leggerla. Non viene mai inclusa nei backup JSON
              che esporti.
            </p>
          </div>
        </div>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Ottieni una chiave gratuita su Google AI Studio
          <ExternalLink size={13} />
        </a>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Modello e lingua                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 mb-6">
        <h3 className="text-sm font-bold text-slate-100">Trascrizione</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="gemini-model"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Modello Gemini
            </label>
            <input
              id="gemini-model"
              type="text"
              list="gemini-model-suggestions"
              value={settings.geminiModel}
              onChange={e => {
                onUpdate({ geminiModel: e.target.value });
                setCheck({ status: 'idle' });
              }}
              spellCheck={false}
              className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition-colors min-h-[44px]"
            />
            <datalist id="gemini-model-suggestions">
              {SUGGESTED_GEMINI_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Campo libero: i nomi dei modelli cambiano nel tempo. L'elenco aggiornato è
              su{' '}
              <a
                href="https://ai.google.dev/gemini-api/docs/models"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                ai.google.dev
              </a>.
            </p>
          </div>

          <div>
            <label
              htmlFor="transcription-language"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Lingua dei testi
            </label>
            <select
              id="transcription-language"
              value={settings.transcriptionLanguage}
              onChange={e =>
                onUpdate({ transcriptionLanguage: e.target.value as TranscriptionLanguage })
              }
              className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors min-h-[44px]"
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Analisi audio                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
            <RefreshCw size={17} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Rilevamento tonalità</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Profilo di riferimento con cui viene confrontato il chromagram. Non
              richiede rete: l'analisi è interamente locale.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(Object.keys(KEY_PROFILES) as KeyProfileName[]).map(name => {
            const active = settings.keyProfile === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onUpdate({ keyProfile: name })}
                aria-pressed={active}
                className={`px-3 py-3 rounded-xl text-xs font-semibold transition-colors border text-left min-h-[44px] ${
                  active
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                    : 'bg-white/[0.02] text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className="block">{KEY_PROFILES[name].label}</span>
                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                  {name === 'temperley'
                    ? 'Consigliato per la musica popolare'
                    : name === 'krumhansl'
                      ? 'Profilo classico da esperimenti percettivi'
                      : 'Ricavato da un corpus ampio'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
