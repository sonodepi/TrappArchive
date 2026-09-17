import React, { useMemo, useState } from 'react';
import { MAX_AUTHORS, type DraftBlock, type DraftProject } from '../types';
import { extractYoutubeId } from '../utils';
import {
  AlignLeft, ArrowLeft, Plus, Users, CheckCircle, Lock, LockOpen, PenTool, Trash2,
  ArrowRightToLine, X, AlertTriangle, KeyRound, Copy, ClipboardPaste, Youtube, Merge,
  UserPlus, Hand, Loader2,
} from 'lucide-react';
import {
  authorColor, canAddAuthor, canEditBlock, describeMerge, isOwner,
  makeBlock, mergeBlocks, mergeDrafts, nextBlockLabel,
} from '../drafts/collab';
import {
  canMergeIntoOpenWindow, closeShareWindow, decryptDraft, encryptDraft,
  generatePassphrase, openShareWindow,
} from '../drafts/share';
import type { AppSettings, LyricsFormat } from '../settings/types';
import { countBars } from '../lyrics/bars';
import { isConfigured } from '../cloud/firebase';
import { recordTombstone } from '../cloud/tombstones';
import { FormatPreferenceButton, LyricsEditor } from './LyricsEditor';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function WorkingOn({
  drafts,
  setDrafts,
  onSendToTrack,
  settings,
  onUpdateSettings,
}: {
  drafts: DraftProject[];
  setDrafts: React.Dispatch<React.SetStateAction<DraftProject[]>>;
  onSendToTrack?: (draft: DraftProject) => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}) {
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [urlInput, setUrlInput] = useState('');
  const [draftToDelete, setDraftToDelete] = useState<DraftProject | null>(null);
  const [nameInput, setNameInput] = useState(settings.authorName);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const me = settings.authorId;
  const myName = settings.authorName.trim();

  const activeDraft = drafts.find(d => d.id === activeDraftId) ?? null;

  const updateDraft = (id: string, patch: Partial<DraftProject>) => {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)));
  };

  const updateBlock = (draft: DraftProject, blockId: string, patch: Partial<DraftBlock>) => {
    updateDraft(draft.id, {
      blocks: draft.blocks.map(b =>
        b.id === blockId ? { ...b, ...patch, updatedAt: Date.now() } : b,
      ),
    });
  };

  const createDraft = () => {
    const draft: DraftProject = {
      id: crypto.randomUUID(),
      title: 'Nuova Bozza',
      lyrics: '',
      ownerId: me,
      authors: [{ id: me, name: myName || 'Io', colorIndex: 0 }],
      blocks: [makeBlock('Strofa 1', me)],
      beatUrl: '',
      updatedAt: Date.now(),
      bpm: undefined,
      key: undefined,
    };
    setDrafts([...drafts, draft]);
    setActiveDraftId(draft.id);
    setUrlInput('');
  };

  /**
   * Un codice ricevuto: o e' una bozza nuova (ci entro come collaboratore) o
   * e' un aggiornamento di una che ho gia' (la unisco). Sostituisce lo
   * scambio-file: stessa logica di prima, cambia solo il trasporto.
   */
  const handleIncomingCode = async (code: string, passphrase: string): Promise<boolean> => {
    setNotice(null);
    const trimmedCode = code.trim();
    if (!trimmedCode || !passphrase) {
      setNotice({ kind: 'error', text: 'Servono sia il codice sia la password.' });
      return false;
    }

    const result = await decryptDraft(trimmedCode, passphrase);
    if (!result.ok) {
      setNotice({
        kind: 'error',
        text: result.reason === 'password'
          ? 'Codice o password sbagliati: non si apre.'
          : 'Questo codice non è valido o è incompleto.',
      });
      return false;
    }
    const incoming = result.draft;

    /**
     * Da qui in avanti si scrive con aggiornamenti funzionali, mai sull'elenco
     * catturato prima dell'attesa. Decifrare costa 210.000 giri di PBKDF2:
     * centinaia di millisecondi in cui l'utente continua a scrivere nei
     * blocchi, e ogni tasto battuto in quella finestra andrebbe perso.
     */
    const mine = drafts.find(d => d.id === incoming.id);
    if (!mine) {
      // Bozza di qualcun altro: entro come collaboratore, e mi aggiungo agli
      // autori se c'e' ancora posto.
      const hasRoom = canAddAuthor(incoming) && !incoming.authors.some(a => a.id === me);
      const joined = hasRoom
        ? {
            ...incoming,
            authors: [...incoming.authors, {
              id: me, name: myName || 'Io', colorIndex: incoming.authors.length,
            }],
          }
        : incoming;
      setDrafts(prev => (prev.some(d => d.id === joined.id) ? prev : [...prev, joined]));
      setActiveDraftId(joined.id);
      setUrlInput(joined.beatUrl);
      setNotice({
        kind: 'ok',
        text: hasRoom || incoming.authors.some(a => a.id === me)
          ? `Sei entrato in "${joined.title}".`
          : `Aperta "${joined.title}" in sola lettura: è già al massimo di ${MAX_AUTHORS} persone.`,
      });
      return true;
    }

    if (!canMergeIntoOpenWindow(mine, incoming)) {
      setNotice({
        kind: 'error',
        text: 'La finestra di condivisione di questa bozza è chiusa: riaprila prima di incollare un codice.',
      });
      return false;
    }

    // L'unione si rifa' sulla versione piu' fresca: `mine` puo' essere
    // invecchiata mentre la decifratura era in corso.
    let report = mergeDrafts(mine, incoming);
    setDrafts(prev => prev.map(d => {
      if (d.id !== incoming.id) return d;
      report = mergeDrafts(d, incoming);
      return report.draft;
    }));
    setActiveDraftId(report.draft.id);
    setNotice({
      kind: report.conflicts.length > 0 ? 'error' : 'ok',
      text: describeMerge(report),
    });
    return true;
  };

  const confirmDelete = () => {
    if (!draftToDelete) return;
    // La cancellazione va raccontata al cloud, altrimenti la bozza torna
    // indietro alla prima sincronizzazione da un altro dispositivo.
    if (isConfigured(settings.firebase)) recordTombstone('drafts', draftToDelete.id);
    setDrafts(prev => prev.filter(d => d.id !== draftToDelete.id));
    if (activeDraftId === draftToDelete.id) setActiveDraftId(null);
    setDraftToDelete(null);
  };

  const deleteDialog = draftToDelete ? (
    <DeleteDialog
      title={draftToDelete.title}
      onCancel={() => setDraftToDelete(null)}
      onConfirm={confirmDelete}
    />
  ) : null;

  // ==========================================================================
  // Serve un nome prima di scrivere in gruppo: senza, i blocchi sarebbero
  // "di qualcuno" e nessuno saprebbe di chi.
  // ==========================================================================
  if (!myName) {
    const confirmName = () => {
      const clean = nameInput.trim();
      if (clean) onUpdateSettings({ authorName: clean });
    };
    return (
      <div className="p-4 md:p-8 h-full flex items-center justify-center max-w-lg mx-auto">
        <div className="w-full bg-white/[0.02] border border-slate-900 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <PenTool className="text-blue-400 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Come ti chiami?</h2>
              <p className="text-xs text-slate-400">Serve solo a firmare le tue strofe.</p>
            </div>
          </div>

          <input
            type="text"
            autoFocus
            value={nameInput}
            maxLength={24}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmName()}
            aria-label="Il tuo nome"
            placeholder="es. Depi"
            className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-[44px]"
          />

          <p className="text-[11px] text-slate-500">
            Resta su questo dispositivo. Non è un account: non c’è niente da
            registrare, e nessuno lo vede finché non mandi tu una bozza a qualcuno.
          </p>

          <button
            onClick={confirmName}
            disabled={!nameInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-4 py-3 rounded-xl transition-colors min-h-[44px]"
          >
            Continua
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Elenco delle bozze
  // ==========================================================================
  if (!activeDraft) {
    return (
      <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col max-w-7xl mx-auto pb-36">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
              <AlignLeft className="text-blue-500 shrink-0" />
              Bozze &amp; Scrittura in gruppo
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Fino a {MAX_AUTHORS} persone sullo stesso pezzo. Ognuno ha i suoi blocchi,
              tutti vedono tutto, chi ha creato la bozza unisce.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowImportPanel(v => !v)}
              className="bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-white/5 min-h-[44px]"
              title="Incolla il codice che ti ha mandato chi scrive con te"
            >
              <ClipboardPaste size={16} /> Incolla un codice
            </button>
            <button
              onClick={createDraft}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 flex items-center gap-2 min-h-[44px]"
            >
              <Plus size={18} /> Nuova Bozza
            </button>
          </div>
        </div>

        {showImportPanel && (
          <ImportCodePanel
            onSubmit={handleIncomingCode}
            onClose={() => setShowImportPanel(false)}
          />
        )}

        {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

        {drafts.length === 0 ? (
          <div className="text-slate-500 text-center py-24 border border-slate-900 bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-6">
            <AlignLeft className="w-12 h-12 mx-auto mb-4 text-slate-700" />
            <p className="text-lg font-medium text-slate-300">Nessuna bozza attiva</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              Crea una bozza per iniziare a scrivere, oppure apri quella che ti ha
              mandato un collaboratore.
            </p>
            <button
              onClick={createDraft}
              className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-3 rounded-xl text-sm transition-colors inline-flex items-center gap-2 min-h-[44px]"
            >
              <Plus size={18} /> Inizia a scrivere
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {drafts.map(d => {
              const filled = d.blocks.filter(b => b.text.trim()).length;
              const done = d.blocks.filter(b => b.done).length;
              return (
                <div
                  key={d.id}
                  onClick={() => { setActiveDraftId(d.id); setUrlInput(d.beatUrl); }}
                  className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 hover:bg-white/[0.04] transition-all cursor-pointer relative group shadow-md flex flex-col justify-between min-h-[190px]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(d.updatedAt).toLocaleDateString('it-IT', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {isOwner(d, me) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          tua
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-100 truncate">{d.title}</h3>

                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {d.authors.map(a => {
                        const c = authorColor(a.colorIndex);
                        return (
                          <span
                            key={a.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${c.soft} ${c.border} ${c.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            {a.id === me ? 'tu' : a.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-900">
                    <span className="text-xs text-slate-500">
                      {d.blocks.length} blocchi &middot; {filled} scritti &middot; {done} chiusi
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setDraftToDelete(d); }}
                      aria-label={`Elimina ${d.title}`}
                      className="p-2 text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {deleteDialog}
      </div>
    );
  }

  // ==========================================================================
  // Vista di scrittura
  // ==========================================================================
  return (
    <DraftEditor
      // Senza chiave, passando da una bozza all'altra React riusa la stessa
      // istanza: codice e password generati per la bozza di prima restavano a
      // video, etichettati come se fossero di questa.
      key={activeDraft.id}
      draft={activeDraft}
      me={me}
      myName={myName}
      urlInput={urlInput}
      setUrlInput={setUrlInput}
      notice={notice}
      setNotice={setNotice}
      format={settings.lyricsFormat}
      onFormatChange={lyricsFormat => onUpdateSettings({ lyricsFormat })}
      onBack={() => setActiveDraftId(null)}
      onUpdateDraft={patch => updateDraft(activeDraft.id, patch)}
      onUpdateBlock={(blockId, patch) => updateBlock(activeDraft, blockId, patch)}
      onImportCode={handleIncomingCode}
      onSendToTrack={onSendToTrack}
      onDelete={() => setDraftToDelete(activeDraft)}
      deleteDialog={deleteDialog}
    />
  );
}

// ============================================================================

function NoticeBar({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  return (
    <div
      className={`mb-5 p-3 border rounded-xl flex items-start gap-2.5 text-xs shrink-0 ${
        notice.kind === 'ok'
          ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
          : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
      }`}
    >
      {notice.kind === 'ok'
        ? <CheckCircle size={15} className="shrink-0 text-blue-400 mt-0.5" />
        : <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />}
      <span className="flex-1">{notice.text}</span>
      <button onClick={onClose} aria-label="Chiudi" className="p-1 hover:text-white transition-colors shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

function DeleteDialog({
  title, onCancel, onConfirm,
}: { title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-[#0a0f1c] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        <h3 className="text-base font-bold text-slate-100">Eliminare la bozza?</h3>
        <p className="text-sm text-slate-400">
          &laquo;<strong className="text-slate-200">{title}</strong>&raquo; e tutti i suoi
          blocchi verranno eliminati. L&rsquo;operazione non si può annullare.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2.5 text-slate-300 hover:text-white rounded-xl text-sm min-h-[44px]">
            Annulla
          </button>
          <button onClick={onConfirm} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold min-h-[44px]">
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Codice + password per sbloccare una bozza ricevuta. `compact` la rende
 * adatta alla colonna laterale di una bozza già aperta (per incollare un
 * aggiornamento); senza, e' il pannello a tutta larghezza dell'elenco bozze
 * (per entrare in una bozza nuova).
 */
function ImportCodePanel({
  onSubmit, onClose, compact,
}: {
  onSubmit: (code: string, passphrase: string) => Promise<boolean>;
  onClose?: () => void;
  compact?: boolean;
}) {
  const [code, setCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const ok = await onSubmit(code, passphrase);
      if (ok) {
        setCode('');
        setPassphrase('');
        onClose?.();
      }
    } finally {
      // Qualunque cosa vada storta, il pulsante torna premibile: altrimenti
      // resta disabilitato fino a un ricaricamento della pagina.
      setBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'space-y-2 pt-2 border-t border-slate-900'
          : 'mb-5 p-4 bg-white/[0.02] border border-slate-900 rounded-2xl space-y-2.5'
      }
    >
      {compact ? (
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Incolla un codice ricevuto</h4>
      ) : (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Incolla un codice ricevuto</h3>
          {onClose && (
            <button onClick={onClose} aria-label="Chiudi" className="text-slate-500 hover:text-slate-200 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Incolla qui il codice..."
        rows={compact ? 2 : 3}
        className="w-full bg-black/40 border border-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          placeholder="Password"
          className="flex-1 bg-black/40 border border-slate-900 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 min-h-[36px]"
        />
        <button
          onClick={submit}
          disabled={busy || !code.trim() || !passphrase}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[36px] shrink-0"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ClipboardPaste size={13} />}
          Sblocca
        </button>
      </div>
    </div>
  );
}

/** Un campo di sola lettura con un bottone «Copia»: per il codice e la password generati. */
function CopyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Senza clipboard API il testo resta comunque selezionabile a mano.
    }
  };

  return (
    <div>
      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            readOnly
            aria-label={label}
            value={value}
            rows={3}
            onFocus={e => e.target.select()}
            className="flex-1 bg-black/40 border border-slate-900 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 resize-none custom-scrollbar"
          />
        ) : (
          <input
            readOnly
            aria-label={label}
            value={value}
            onFocus={e => e.target.select()}
            className="flex-1 bg-black/40 border border-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
          />
        )}
        <button
          onClick={copy}
          className="shrink-0 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 min-h-[36px]"
        >
          <Copy size={12} /> {copied ? 'Copiato' : 'Copia'}
        </button>
      </div>
    </div>
  );
}

function DraftEditor({
  draft, me, myName, urlInput, setUrlInput, notice, setNotice, format, onFormatChange,
  onBack, onUpdateDraft, onUpdateBlock, onImportCode, onSendToTrack, onDelete, deleteDialog,
}: {
  draft: DraftProject;
  me: string;
  myName: string;
  urlInput: string;
  setUrlInput: (v: string) => void;
  notice: Notice;
  setNotice: (n: Notice) => void;
  format: LyricsFormat;
  onFormatChange: (format: LyricsFormat) => void;
  onBack: () => void;
  onUpdateDraft: (patch: Partial<DraftProject>) => void;
  onUpdateBlock: (blockId: string, patch: Partial<DraftBlock>) => void;
  onImportCode: (code: string, passphrase: string) => Promise<boolean>;
  onSendToTrack?: (draft: DraftProject) => void;
  onDelete: () => void;
  deleteDialog: React.ReactNode;
}) {
  const owner = isOwner(draft, me);
  const ytId = extractYoutubeId(draft.beatUrl);
  const authorById = useMemo(
    () => new Map(draft.authors.map(a => [a.id, a])),
    [draft.authors],
  );

  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharePassphrase, setSharePassphrase] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const shareOpen = draft.shareOpen === true;

  const handleOpenShare = () => {
    onUpdateDraft(openShareWindow(draft));
    setShareCode(null);
    setSharePassphrase(null);
  };

  const handleCloseShare = () => {
    onUpdateDraft(closeShareWindow(draft));
    setShareCode(null);
    setSharePassphrase(null);
  };

  const handleGenerateCode = async () => {
    setShareBusy(true);
    try {
      const passphrase = generatePassphrase();
      const code = await encryptDraft(draft, passphrase);
      setSharePassphrase(passphrase);
      setShareCode(code);
    } catch (err) {
      // Senza `finally` un errore della cifratura lasciava il pulsante girare
      // per sempre, senza dire niente a nessuno.
      setNotice({
        kind: 'error',
        text: err instanceof Error && err.message
          ? `Codice non generato: ${err.message}`
          : 'Codice non generato: la cifratura non è riuscita su questo dispositivo.',
      });
    } finally {
      setShareBusy(false);
    }
  };

  const addBlock = () => {
    onUpdateDraft({ blocks: [...draft.blocks, makeBlock(nextBlockLabel(draft.blocks), null)] });
  };

  const removeBlock = (blockId: string) => {
    onUpdateDraft({ blocks: draft.blocks.filter(b => b.id !== blockId) });
  };

  const doMerge = () => {
    const text = mergeBlocks(draft.blocks);
    onUpdateDraft({ lyrics: text });
    setNotice({
      kind: text ? 'ok' : 'error',
      text: text
        ? `Testo unito: ${draft.blocks.filter(b => b.text.trim()).length} blocchi.`
        : 'Non c’è ancora niente da unire: i blocchi sono tutti vuoti.',
    });
  };

  const openBlocks = draft.blocks.filter(b => !b.done).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col max-w-7xl mx-auto pb-36">
      {/* Intestazione */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            aria-label="Torna alle bozze"
            className="p-2 text-slate-400 hover:text-white transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={draft.title}
              onChange={e => onUpdateDraft({ title: e.target.value })}
              aria-label="Titolo della bozza"
              className="w-full bg-transparent text-xl md:text-2xl font-bold text-slate-100 focus:outline-none focus:border-b focus:border-blue-500 truncate"
            />
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {draft.authors.map(a => {
                const c = authorColor(a.colorIndex);
                return (
                  <span
                    key={a.id}
                    className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${c.soft} ${c.border} ${c.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {a.id === me ? `${myName} (tu)` : a.name}
                    {a.id === draft.ownerId && <Lock size={9} className="opacity-60" />}
                  </span>
                );
              })}
              {canAddAuthor(draft) ? (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <UserPlus size={11} />
                  {MAX_AUTHORS - draft.authors.length} posti liberi
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">al completo</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {owner && (
            <button
              onClick={doMerge}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/50 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
              title="Unisci tutti i blocchi nel testo finale"
            >
              <Merge size={15} /> Unisci
            </button>
          )}
          <FormatPreferenceButton format={format} onChange={onFormatChange} />
          <button
            onClick={onDelete}
            aria-label="Elimina bozza"
            className="p-2.5 text-slate-500 hover:text-rose-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

      {!owner && (
        <div className="mb-5 p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
          <Users size={15} className="shrink-0 text-slate-400 mt-0.5" />
          <p>
            Questa bozza è di{' '}
            <strong>{authorById.get(draft.ownerId)?.name ?? 'un altro autore'}</strong>.
            Scrivi nei tuoi blocchi e rimandagliela: solo chi l&rsquo;ha creata può
            riorganizzare e unire il testo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0">
        {/* Blocchi */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-1">
          {draft.blocks.length === 0 && (
            <div className="text-center text-slate-500 py-12 border border-slate-900 rounded-2xl bg-white/[0.02]">
              <p className="text-sm">
                Nessun blocco. {owner ? 'Aggiungine uno per iniziare.' : 'Aspetta che ne crei chi ha fatto la bozza.'}
              </p>
            </div>
          )}

          {draft.blocks.map(b => {
            const author = b.authorId ? authorById.get(b.authorId) : null;
            const c = author ? authorColor(author.colorIndex) : null;
            const mine = canEditBlock(b, me);

            return (
              <div
                key={b.id}
                className={`border rounded-2xl overflow-hidden transition-colors shrink-0 ${
                  mine && c ? `${c.border} bg-white/[0.03]` : 'border-slate-900 bg-white/[0.01]'
                }`}
              >
                <div className="px-3.5 py-2.5 bg-black/40 border-b border-slate-900 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {owner ? (
                      <input
                        type="text"
                        value={b.label}
                        onChange={e => onUpdateBlock(b.id, { label: e.target.value })}
                        aria-label="Nome del blocco"
                        className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-200 focus:outline-none focus:border-b focus:border-blue-500 w-28"
                      />
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{b.label}</span>
                    )}

                    {author && c ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${c.soft} ${c.border} ${c.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {author.id === me ? 'tuo' : author.name}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 shrink-0">
                        libero
                      </span>
                    )}

                    {b.text.trim() && (
                      <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                        {countBars(b.text)} {countBars(b.text) === 1 ? 'barra' : 'barre'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!b.authorId && (
                      <button
                        onClick={() => onUpdateBlock(b.id, { authorId: me })}
                        className="text-[11px] px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 rounded-lg font-semibold transition-colors flex items-center gap-1 min-h-[32px]"
                      >
                        <Hand size={11} /> Lo prendo
                      </button>
                    )}
                    {mine && b.text.trim() && (
                      <button
                        onClick={() => onUpdateBlock(b.id, { done: !b.done })}
                        title={b.done ? 'Riapri il blocco' : 'Segna come finito'}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 border min-h-[32px] ${
                          b.done
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
                        }`}
                      >
                        <CheckCircle size={11} /> {b.done ? 'Finito' : 'Segna finito'}
                      </button>
                    )}
                    {owner && (
                      <button
                        onClick={() => removeBlock(b.id)}
                        aria-label={`Elimina blocco ${b.label}`}
                        className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/*
                  Tutti vedono il testo di tutti: e' la scelta presa. Chi non ha
                  il blocco lo legge e basta, cosi' nessuno scrive sopra un altro.
                */}
                <LyricsEditor
                  value={b.text}
                  onChange={text => onUpdateBlock(b.id, { text })}
                  readOnly={!mine}
                  format={format}
                  framed={false}
                  showBarCount={false}
                  minHeightClass="min-h-[9rem]"
                  placeholder={mine ? 'Scrivi qui la tua parte...' : 'Ancora niente.'}
                />
              </div>
            );
          })}

          {owner && (
            <button
              onClick={addBlock}
              className="border border-dashed border-slate-800 hover:border-blue-500/50 text-slate-400 hover:text-blue-400 rounded-2xl py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Plus size={16} /> Aggiungi blocco
            </button>
          )}
        </div>

        {/* Colonna laterale: condivisione, base e testo unito */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              {shareOpen ? <LockOpen size={14} className="text-emerald-400" /> : <KeyRound size={14} className="text-slate-400" />}
              Condivisione
            </h3>

            {owner ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  {shareOpen
                    ? 'Finestra aperta: i codici di questa sessione possono essere uniti.'
                    : 'Finestra chiusa: nessun codice entra nella bozza finché non la riapri.'}
                </p>
                <button
                  onClick={shareOpen ? handleCloseShare : handleOpenShare}
                  className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors min-h-[36px] border ${
                    shareOpen
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {shareOpen ? 'Chiudi' : 'Apri'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Solo {authorById.get(draft.ownerId)?.name ?? 'chi ha creato la bozza'} può aprire o
                chiudere la condivisione.
              </p>
            )}

            {shareOpen && (
              <div className="space-y-2 pt-1 border-t border-slate-900">
                <button
                  onClick={handleGenerateCode}
                  disabled={shareBusy}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 rounded-lg text-[11px] font-semibold transition-colors min-h-[36px] disabled:opacity-50"
                >
                  {shareBusy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                  {shareCode ? 'Rigenera codice (con le modifiche di adesso)' : 'Genera codice da mandare'}
                </button>
                {shareCode && (
                  <div className="space-y-2">
                    <CopyField label="Password (mandala per un altro canale)" value={sharePassphrase ?? ''} />
                    <CopyField label="Codice" value={shareCode} multiline />
                    <p className="text-[10px] text-slate-500">
                      Manda codice e password separati — un messaggio e una chiamata, non lo stesso posto.
                    </p>
                  </div>
                )}
              </div>
            )}

            <ImportCodePanel compact onSubmit={onImportCode} />
          </div>

          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Youtube size={14} className="text-rose-500" /> Base
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onUpdateDraft({ beatUrl: urlInput })}
                aria-label="Link della base"
                placeholder="Link YouTube della base"
                className="flex-1 bg-black/40 border border-slate-900 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 min-h-[40px]"
              />
              <button
                onClick={() => onUpdateDraft({ beatUrl: urlInput })}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg text-xs font-semibold min-h-[40px]"
              >
                Carica
              </button>
            </div>

            {ytId ? (
              <div className="aspect-video rounded-xl overflow-hidden border border-slate-900">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title="Base"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Nessuna base caricata. Il video parte da YouTube: serve la connessione.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor="draft-bpm" className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">BPM</label>
                <input
                  id="draft-bpm"
                  type="number"
                  value={draft.bpm ?? ''}
                  onChange={e => onUpdateDraft({ bpm: parseInt(e.target.value, 10) || undefined })}
                  placeholder="—"
                  className="w-full bg-black/40 border border-slate-900 rounded-lg px-2.5 py-2 text-blue-400 font-mono text-sm focus:outline-none focus:border-blue-500 min-h-[40px]"
                />
              </div>
              <div>
                <label htmlFor="draft-key" className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tonalità</label>
                <input
                  id="draft-key"
                  type="text"
                  value={draft.key ?? ''}
                  onChange={e => onUpdateDraft({ key: e.target.value })}
                  placeholder="—"
                  className="w-full bg-black/40 border border-slate-900 rounded-lg px-2.5 py-2 text-purple-400 font-mono text-sm focus:outline-none focus:border-blue-500 min-h-[40px]"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Per calcolarli davvero, carica il file della base nella scheda della
              traccia: l&rsquo;analisi gira sul dispositivo. Da un link YouTube l&rsquo;audio
              non è leggibile.
            </p>
          </div>

          {/* Testo unito */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Testo unito</h3>
              {openBlocks > 0 && (
                <span className="text-[10px] text-amber-400 shrink-0">{openBlocks} blocchi aperti</span>
              )}
            </div>

            {draft.lyrics ? (
              <pre className="flex-1 overflow-y-auto custom-scrollbar text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {draft.lyrics}
              </pre>
            ) : (
              <p className="text-[11px] text-slate-500 flex-1">
                {owner
                  ? 'Premi «Unisci» quando i blocchi sono pronti.'
                  : 'Il testo unito lo produce chi ha creato la bozza.'}
              </p>
            )}

            {onSendToTrack && draft.lyrics && (
              <button
                onClick={() => onSendToTrack(draft)}
                className="mt-3 w-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <ArrowRightToLine size={14} /> Porta in una traccia
              </button>
            )}
          </div>
        </div>
      </div>

      {deleteDialog}
    </div>
  );
}
