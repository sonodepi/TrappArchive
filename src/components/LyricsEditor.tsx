import React, { useState } from 'react';
import { AlignLeft, Mic2, Plus, X } from 'lucide-react';
import type { Sporca } from '../types';
import { countWords, orphanedSporche, reflowOnTextChange } from './lyrics/sporche';

/**
 * Editor del testo con le sporche (ad-libs).
 *
 * Due modalità sullo stesso testo:
 * - Writer: il testo si scrive, semplice, con le righe numerate a sinistra.
 * - AD Libs: il testo si legge, e si aggancia una sporca a "dopo la parola
 *   N" di una riga. Se N cade in mezzo alla riga, si vede lì; se cade oltre
 *   l'ultima parola, si vede nella colonna a destra. Stesso dato, due rese —
 *   i due tratti verticali sono solo grafica, non due tipi di sporca.
 *
 * `lyrics` resta sempre una stringa semplice: le sporche vivono a parte, in
 * un elenco additivo, cosi' un aggancio sbagliato al massimo mette una
 * sporca nel posto sbagliato, mai il testo scritto a rischio.
 */

type Mode = 'writer' | 'adlibs';
type GapKey = string;

const gapKey = (riga: number, dopoParola: number): GapKey => `${riga}:${dopoParola}`;

export function LyricsEditor({
  lyrics,
  sporche,
  onChange,
}: {
  lyrics: string;
  sporche: Sporca[];
  onChange: (next: { lyrics: string; sporche: Sporca[] }) => void;
}) {
  const [mode, setMode] = useState<Mode>('writer');
  const [composingAt, setComposingAt] = useState<GapKey | null>(null);
  const [draftText, setDraftText] = useState('');

  const lines = lyrics.split('\n');

  const handleLyricsChange = (next: string) => {
    onChange({ lyrics: next, sporche: reflowOnTextChange(sporche, lyrics, next) });
  };

  const startComposing = (riga: number, dopoParola: number) => {
    setComposingAt(gapKey(riga, dopoParola));
    setDraftText('');
  };

  const confirmComposing = (riga: number, dopoParola: number) => {
    const testo = draftText.trim();
    setComposingAt(null);
    if (!testo) return;
    const words = countWords(lines[riga] ?? '');
    onChange({
      lyrics,
      sporche: [
        ...sporche,
        { id: crypto.randomUUID(), testo, riga, dopoParola: Math.min(dopoParola, words) },
      ],
    });
  };

  const removeSporca = (id: string) => {
    onChange({ lyrics, sporche: sporche.filter(s => s.id !== id) });
  };

  const orphans = orphanedSporche(sporche, lines.length);

  return (
    <div className="flex-1 flex flex-col min-h-[250px]">
      <div className="flex items-center gap-1 mb-3 shrink-0 bg-black/40 border border-slate-900 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('writer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === 'writer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlignLeft size={13} />
          <span>Writer</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('adlibs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            mode === 'adlibs' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic2 size={13} />
          <span>AD Libs</span>
        </button>
      </div>

      {mode === 'writer' ? (
        <div className="flex-1 flex bg-black/40 border border-slate-900 rounded-xl overflow-hidden">
          <div
            aria-hidden
            className="select-none text-right text-slate-600 font-mono text-sm leading-relaxed py-4 pl-3 pr-2 border-r border-slate-800 shrink-0"
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            className="w-full flex-1 bg-transparent p-4 focus:outline-none resize-none placeholder:text-slate-600 font-mono text-sm leading-relaxed text-slate-200 custom-scrollbar"
            placeholder="Incolla o scrivi qui il testo della canzone, strofe e ritornelli..."
            value={lyrics}
            onChange={e => handleLyricsChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="flex-1 bg-black/40 border border-slate-900 rounded-xl overflow-y-auto custom-scrollbar p-2">
          {lines.map((line, riga) => {
            const words = line.length ? line.split(/\s+/).filter(Boolean) : [];
            const wordCount = words.length;
            const endSporche = sporche.filter(s => s.riga === riga && s.dopoParola >= wordCount);

            return (
              <div key={riga} className="flex items-stretch text-sm font-mono leading-relaxed">
                <span className="select-none text-slate-600 text-right w-7 shrink-0 pt-1.5">{riga + 1}</span>

                {/* tubo chiaro: zona testo */}
                <div className="flex-1 flex flex-wrap items-center gap-x-1 border-l-2 border-slate-700 pl-3 py-1.5 min-h-[2rem]">
                  {wordCount === 0 ? (
                    <span className="text-slate-700">&nbsp;</span>
                  ) : (
                    words.map((word, idx) => {
                      const dopoParola = idx + 1;
                      const isLastWord = idx === wordCount - 1;
                      const inlineSporche = sporche.filter(
                        s => s.riga === riga && s.dopoParola === dopoParola && dopoParola < wordCount,
                      );
                      return (
                        <React.Fragment key={idx}>
                          <span className="text-slate-200">{word}</span>
                          {!isLastWord && (
                            <>
                              {inlineSporche.map(s => (
                                <SporcaChip key={s.id} sporca={s} onRemove={() => removeSporca(s.id)} />
                              ))}
                              {composingAt === gapKey(riga, dopoParola) ? (
                                <ComposeInput
                                  value={draftText}
                                  onChange={setDraftText}
                                  onConfirm={() => confirmComposing(riga, dopoParola)}
                                  onCancel={() => setComposingAt(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startComposing(riga, dopoParola)}
                                  title="Aggiungi una sporca qui"
                                  className="text-slate-700 hover:text-amber-400 transition-colors px-0.5"
                                >
                                  <Plus size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* tubo grigio: zona sporche, solo grafica, stesso dato */}
                <div className="w-36 shrink-0 flex flex-wrap items-center gap-1 border-l-2 border-slate-800 pl-3 py-1.5 min-h-[2rem]">
                  {endSporche.map(s => (
                    <SporcaChip key={s.id} sporca={s} onRemove={() => removeSporca(s.id)} />
                  ))}
                  {composingAt === gapKey(riga, wordCount) ? (
                    <ComposeInput
                      value={draftText}
                      onChange={setDraftText}
                      onConfirm={() => confirmComposing(riga, wordCount)}
                      onCancel={() => setComposingAt(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startComposing(riga, wordCount)}
                      title="Aggiungi una sporca a fine riga"
                      className="text-slate-700 hover:text-amber-400 transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {orphans.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-amber-500/30 px-2 pb-1">
              <p className="text-[11px] text-amber-400/80 font-semibold uppercase tracking-wider mb-1.5">
                Non agganciate
              </p>
              <p className="text-[11px] text-slate-500 mb-2">
                La riga a cui erano legate è cambiata o è stata cancellata: il testo non è perso.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {orphans.map(s => (
                  <SporcaChip key={s.id} sporca={s} onRemove={() => removeSporca(s.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SporcaChip({ sporca, onRemove }: { sporca: Sporca; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5 text-[11px] font-sans">
      {sporca.testo}
      <button type="button" onClick={onRemove} title="Rimuovi la sporca" className="text-amber-400/60 hover:text-amber-200">
        <X size={10} />
      </button>
    </span>
  );
}

function ComposeInput({
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onConfirm();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={onConfirm}
      placeholder="sporca..."
      className="bg-black/60 border border-amber-500/40 rounded-full px-2 py-0.5 text-[11px] text-amber-200 focus:outline-none w-24 font-sans"
    />
  );
}
