import React from 'react';
import {
  Cloud, ExternalLink, RefreshCw, Settings as SettingsIcon,
} from 'lucide-react';

import { KEY_PROFILES } from '../audio/analysis/key';
import type { AppSettings, KeyProfileName } from '../settings/types';

export function Settings({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <SettingsIcon className="text-blue-500 shrink-0" />
          Impostazioni
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Parametri dell'analisi audio e sincronizzazione facoltativa.
        </p>
      </div>

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

      {/* ================= Sincronizzazione fra dispositivi ================= */}
      <section className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Cloud size={17} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100">Sincronizzazione (facoltativa)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ritrovi catalogo, testi e bozze su ogni dispositivo. Senza, l&rsquo;app
              funziona esattamente come adesso, solo su questo telefono.
            </p>
          </div>
        </div>

        <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-[11px] text-amber-100/90 space-y-1.5">
          <p>
            <strong>Cosa sale e cosa no.</strong> Vanno nel cloud i metadati: titoli,
            BPM, tonalit&agrave;, testi, album, bozze. <strong>I file audio restano
            qui</strong>: un documento Firestore arriva a 1 MB e un MP3 &egrave; molto di
            pi&ugrave;. Sul secondo dispositivo ritrovi la traccia, ma l&rsquo;audio va
            ricaricato.
          </p>
          <p>
            Questi valori <strong>non sono segreti</strong>: identificano il progetto e
            finiscono comunque nel codice che gira nel browser. A proteggere i dati
            sono le regole di Firestore, nel file <code>firestore.rules</code> del
            repository: copiale nella console Firebase prima di usare la
            sincronizzazione, altrimenti il database resta aperto.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['projectId', 'ID progetto', 'es. trapparchive-1a2b3'],
            ['apiKey', 'Chiave API web', 'AIza...'],
            ['authDomain', 'Dominio di autenticazione', 'progetto.firebaseapp.com'],
            ['appId', 'ID applicazione', '1:123...:web:abc...'],
          ] as const).map(([field, label, placeholder]) => (
            <div key={field}>
              <label
                htmlFor={`fb-${field}`}
                className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
              >
                {label}
              </label>
              <input
                id={`fb-${field}`}
                type="text"
                spellCheck={false}
                autoComplete="off"
                value={settings.firebase?.[field] ?? ''}
                placeholder={placeholder}
                onChange={e =>
                  onUpdate({
                    firebase: {
                      apiKey: '', authDomain: '', projectId: '', appId: '',
                      ...settings.firebase,
                      [field]: e.target.value.trim(),
                    },
                  })
                }
                className="w-full bg-black/40 border border-slate-900 px-3 py-2.5 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5"
          >
            Crea un progetto su Firebase <ExternalLink size={12} />
          </a>
          {settings.firebase && (
            <button
              type="button"
              onClick={() => onUpdate({ firebase: undefined })}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors min-h-[36px]"
            >
              Rimuovi configurazione
            </button>
          )}
        </div>
      </section>
    </div>
  );
}