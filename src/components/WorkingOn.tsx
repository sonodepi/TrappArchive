import React, { useState, useEffect } from 'react';
import { DraftProject } from '../types';
import { extractYoutubeId } from '../utils';
import { 
  Youtube, AlignLeft, ArrowLeft, Plus, Eye, EyeOff, Hash, 
  LogIn, Users, CheckCircle, Lock, PenTool, Trash2, ArrowRightToLine,
  Activity, Music, ExternalLink, RefreshCw, X, AlertTriangle 
} from 'lucide-react';
import { autoDetectTunebatData, getTunebatSearchUrl } from '../utils/tunebat';

export function WorkingOn({ 
  drafts, 
  setDrafts,
  onSendToTrack
}: { 
  drafts: DraftProject[], 
  setDrafts: (d: DraftProject[]) => void,
  onSendToTrack?: (draft: DraftProject) => void
}) {
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [draftToDelete, setDraftToDelete] = useState<DraftProject | null>(null);
  const [isDetectingTunebat, setIsDetectingTunebat] = useState(false);
  
  const [ownedDraftIds, setOwnedDraftIds] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('trapparchive_owned') || '[]');
  });

  const createDraft = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newDraft: DraftProject = {
      id: crypto.randomUUID(),
      title: 'Nuova Bozza',
      lyrics: '',
      ownerLyrics: '',
      collaboratorLyrics: '',
      isCoopMode: false,
      ownerReady: false,
      collabReady: false,
      beatUrl: '',
      shareCode: code,
      updatedAt: Date.now(),
      bpm: 140,
      key: 'C Minor'
    };
    setDrafts([...drafts, newDraft]);
    setActiveDraftId(newDraft.id);
    setUrlInput('');
    
    setOwnedDraftIds(prev => {
      const next = [...prev, newDraft.id];
      localStorage.setItem('trapparchive_owned', JSON.stringify(next));
      return next;
    });
  };

  const handleJoin = () => {
    const cleanCode = joinCode.replace(/\D/g, '').substring(0, 6);
    if (cleanCode.length !== 6) return;
    
    let draft = drafts.find(d => d.shareCode === cleanCode);
    if (!draft) {
      draft = {
        id: crypto.randomUUID(),
        title: `Collab Bozza (${cleanCode})`,
        lyrics: '',
        ownerLyrics: '',
        collaboratorLyrics: '',
        isCoopMode: false,
        ownerReady: false,
        collabReady: false,
        beatUrl: '',
        shareCode: cleanCode,
        updatedAt: Date.now(),
        bpm: 140,
        key: 'C Minor'
      };
      setDrafts([...drafts, draft]);
    }
    setActiveDraftId(draft.id);
    setUrlInput(draft.beatUrl);
    setJoinCode('');
  };

  const activeDraft = drafts.find(d => d.id === activeDraftId);

  const updateActiveDraft = (updates: Partial<DraftProject>) => {
    if (!activeDraft) return;
    const updatedDrafts = drafts.map(d => 
      d.id === activeDraft.id ? { ...d, ...updates, updatedAt: Date.now() } : d
    );
    setDrafts(updatedDrafts);
  };

  // Load beat and auto-detect BPM/Key via Tunebat
  const handleLoadBeat = async () => {
    if (!activeDraft) return;
    updateActiveDraft({ beatUrl: urlInput });

    if (urlInput) {
      setIsDetectingTunebat(true);
      try {
        const result = await autoDetectTunebatData({
          title: activeDraft.title,
          audioUrl: urlInput
        });
        if (result) {
          updateActiveDraft({
            beatUrl: urlInput,
            bpm: result.bpm,
            key: result.key
          });
        }
      } catch (e) {
        console.error('Tunebat auto-detect failed:', e);
      } finally {
        setIsDetectingTunebat(false);
      }
    }
  };

  // Remove beat from draft
  const handleRemoveBeat = () => {
    setUrlInput('');
    updateActiveDraft({ beatUrl: '' });
  };

  const confirmDeleteDraft = () => {
    if (draftToDelete) {
      setDrafts(drafts.filter(d => d.id !== draftToDelete.id));
      if (activeDraftId === draftToDelete.id) {
        setActiveDraftId(null);
      }
      setDraftToDelete(null);
    }
  };

  // =========================================================================
  // VIEW 1: Grid list of all drafts (1 col mobile, 2 col tablet, 3 col desktop)
  // Adaptive card height based on content
  // =========================================================================
  if (!activeDraft) {
    return (
      <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col max-w-7xl mx-auto pb-36">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
              <AlignLeft className="text-blue-500 shrink-0" />
              Bozze & Sessioni Co-op
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Scrivi testi, sincronizza con basi YouTube e collabora a 4 mani.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center">
              <input 
                type="text"
                placeholder="Codice 6 cifre"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="w-32 bg-black/40 border border-slate-900 rounded-xl px-3 py-2.5 text-xs font-mono tracking-widest focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-slate-200 min-h-[44px]"
              />
              <button 
                onClick={handleJoin}
                disabled={joinCode.length !== 6}
                className="ml-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-white/5 min-h-[44px]"
              >
                <LogIn size={15} /> Unisciti
              </button>
            </div>

            <button 
              onClick={createDraft}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 flex items-center gap-2 min-h-[44px]"
            >
              <Plus size={18} /> Nuova Bozza
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="text-slate-500 text-center py-24 border border-slate-900 bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-6">
            <AlignLeft className="w-12 h-12 mx-auto mb-4 text-slate-700" />
            <p className="text-lg font-medium text-slate-300">Nessuna bozza attiva</p>
            <p className="text-sm mt-1 max-w-sm mx-auto text-slate-500">
              Crea una nuova bozza o unisciti a una sessione inserendo il codice di condivisione a 6 cifre.
            </p>
            <button 
              onClick={createDraft}
              className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md min-h-[44px]"
            >
              <Plus size={16} /> Inizia a scrivere
            </button>
          </div>
        ) : (
          /* Drafts Grid: 1 col on mobile, 2 on tablet, 3 on desktop, adaptive height */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {drafts.map(d => (
              <div 
                key={d.id}
                onClick={() => {
                  setActiveDraftId(d.id);
                  setUrlInput(d.beatUrl);
                }}
                className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 hover:bg-white/[0.04] transition-all cursor-pointer relative group shadow-md flex flex-col justify-between h-auto min-h-[200px]"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                      <Hash size={13} className="text-blue-500" /> {d.shareCode}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {d.isCoopMode && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-semibold flex items-center gap-1">
                          <Users size={11} /> Co-op
                        </span>
                      )}
                      
                      {/* Delete Draft Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftToDelete(d);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Elimina bozza"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-100 mb-2 truncate">
                    {d.title || 'Nuova Bozza'}
                  </h3>

                  {/* Tunebat details preview */}
                  {(d.bpm || d.key) && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mb-3">
                      {d.bpm && <span className="text-blue-400 font-semibold">{d.bpm} BPM</span>}
                      {d.key && <span>• {d.key}</span>}
                    </div>
                  )}

                  {/* Lyrics Snippet */}
                  <p className="text-xs text-slate-400 font-mono line-clamp-4 leading-relaxed bg-black/30 p-3 rounded-xl border border-slate-900/80 mb-3">
                    {d.isCoopMode ? (
                      d.lyrics || (d.ownerLyrics ? `[Autore]: ${d.ownerLyrics}` : 'Bozza vuota in attesa di rime...')
                    ) : (
                      d.lyrics || 'Nessun testo presente. Clicca per comporre.'
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-900/80">
                  <span className="flex items-center gap-1">
                    <Youtube size={12} className={d.beatUrl ? 'text-red-500' : 'text-slate-700'} />
                    {d.beatUrl ? 'Base collegata' : 'Nessuna base'}
                  </span>
                  <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Draft Confirmation Modal */}
        {draftToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-150">
              <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={20} />
                Elimina Bozza
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Sei sicuro di voler eliminare definitivamente il progetto <strong className="text-slate-200">"{draftToDelete.title}"</strong>?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDraftToDelete(null)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDeleteDraft}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium transition-colors shadow-md min-h-[44px]"
                >
                  Elimina Definitivamente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Inside Open Draft
  // Desktop: Editor and YouTube side-by-side
  // Mobile: Stacked vertically (Editor first, then YouTube player below)
  // YouTube player: aspect-video (16:9)
  // Co-op mode: panels stacked vertically on mobile, side-by-side on desktop
  // =========================================================================
  const ytId = extractYoutubeId(activeDraft.beatUrl);
  const isOwner = ownedDraftIds.includes(activeDraft.id);
  const myLyrics = isOwner ? (activeDraft.ownerLyrics || '') : (activeDraft.collaboratorLyrics || '');
  const friendLyrics = isOwner ? (activeDraft.collaboratorLyrics || '') : (activeDraft.ownerLyrics || '');
  const myReady = isOwner ? activeDraft.ownerReady : activeDraft.collabReady;
  const friendReady = isOwner ? activeDraft.collabReady : activeDraft.ownerReady;
  const bothReady = activeDraft.ownerReady && activeDraft.collabReady;

  const handleMyLyricsChange = (text: string) => {
    if (isOwner) updateActiveDraft({ ownerLyrics: text });
    else updateActiveDraft({ collaboratorLyrics: text });
  };

  const toggleReady = () => {
    if (isOwner) updateActiveDraft({ ownerReady: !activeDraft.ownerReady });
    else updateActiveDraft({ collabReady: !activeDraft.collabReady });
  };

  const tunebatSearchUrl = getTunebatSearchUrl(activeDraft.title);

  return (
    <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col max-w-7xl mx-auto pb-36">
      {/* Session Top Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setActiveDraftId(null)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Torna all'elenco bozze"
          >
            <ArrowLeft size={20} />
          </button>
          
          <input 
            type="text" 
            value={activeDraft.title}
            onChange={(e) => updateActiveDraft({ title: e.target.value })}
            className="text-lg sm:text-2xl font-bold tracking-tight text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 p-0 max-w-[200px] sm:max-w-xs truncate min-h-[44px]"
          />

          {/* Tunebat BPM & Key badges */}
          <div className="flex items-center gap-1.5 bg-black/60 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-blue-400 font-mono font-bold">{activeDraft.bpm || 140} BPM</span>
            <span className="text-slate-600">•</span>
            <span className="text-purple-400 font-mono font-bold">{activeDraft.key || 'C Minor'}</span>
            <a 
              href={tunebatSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-1 text-slate-500 hover:text-slate-300"
              title="Cerca su Tunebat"
            >
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button
              onClick={() => {
                if (onSendToTrack) onSendToTrack(activeDraft);
              }}
              className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-colors border border-blue-500/20 flex items-center gap-1.5 text-xs font-semibold min-h-[40px]"
              title="Esporta in Aggiungi Traccia"
            >
              <ArrowRightToLine size={16} />
              <span className="hidden sm:inline">Esporta in Traccia</span>
            </button>
            <button
              onClick={() => setDraftToDelete(activeDraft)}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors border border-rose-500/20 flex items-center gap-1.5 text-xs font-semibold min-h-[40px] min-w-[40px] justify-center"
              title="Elimina questa bozza"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={() => updateActiveDraft({ isCoopMode: !activeDraft.isCoopMode })}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm min-h-[44px] ${
              activeDraft.isCoopMode 
                ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/50 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Users size={16} /> {activeDraft.isCoopMode ? 'Co-op Attivo' : 'Attiva Co-op'}
          </button>

          <div className="flex items-center gap-2 bg-black/60 border border-slate-800 rounded-xl p-1 pl-3 shadow-inner min-h-[44px]">
            <span className={`font-mono text-base tracking-widest transition-all ${showCode ? 'text-blue-400' : 'text-slate-500 blur-[4px]'}`}>
              {activeDraft.shareCode.slice(0,3)} - {activeDraft.shareCode.slice(3,6)}
            </span>
            <button 
              onClick={() => setShowCode(!showCode)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
              title={showCode ? "Nascondi codice" : "Mostra codice"}
            >
              {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Editor + Beat Layout: 1 col on mobile (Editor first, then YouTube), 2 cols on desktop */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 min-h-0">
        
        {/* Lyrics Editor (Left Side on Desktop, Top on Mobile) */}
        <div className="flex flex-col bg-white/[0.02] border border-slate-900 rounded-2xl overflow-hidden shadow-md relative min-h-[320px]">
          <div className="px-4 py-3 bg-black/40 border-b border-slate-900 flex justify-between items-center shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {activeDraft.isCoopMode ? (bothReady ? 'Fase Unione Testi' : 'Scrittura a 4 Mani (Co-op)') : 'Testo della Canzone'}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Auto-salvato
            </span>
          </div>
          
          {!activeDraft.isCoopMode ? (
            <textarea 
              className="flex-1 w-full bg-transparent p-4 sm:p-6 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 custom-scrollbar relative z-10 min-h-[250px]"
              placeholder="Inizia a comporre le tue barre qui..."
              value={activeDraft.lyrics}
              onChange={(e) => updateActiveDraft({ lyrics: e.target.value })}
            />
          ) : bothReady ? (
            /* Merge Phase (Stacked on mobile, side-by-side on desktop) */
            <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto custom-scrollbar">
              {isOwner ? (
                <>
                  <div className="flex flex-col md:flex-row gap-3 min-h-[160px]">
                    <div className="flex-1 bg-black/40 rounded-xl p-3 overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase text-blue-400 font-bold mb-1">Le Tue Barre</div>
                      <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap">{myLyrics}</div>
                    </div>
                    <div className="flex-1 bg-black/40 rounded-xl p-3 overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase text-purple-400 font-bold mb-1">Barre del Feat</div>
                      <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap">{friendLyrics}</div>
                    </div>
                  </div>
                  <textarea 
                    className="flex-1 w-full bg-black/40 border border-slate-800 rounded-xl p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 custom-scrollbar shadow-inner min-h-[180px]"
                    placeholder="Unisci e incastra le due parti nel testo definitivo..."
                    value={activeDraft.lyrics}
                    onChange={(e) => updateActiveDraft({ lyrics: e.target.value })}
                  />
                  <button 
                    onClick={() => updateActiveDraft({ isCoopMode: false, ownerReady: false, collabReady: false })}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg border border-blue-400/30 flex items-center justify-center gap-2 text-sm min-h-[44px]"
                  >
                    <CheckCircle size={16} /> Finalizza Testo Unito
                  </button>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                  <Lock size={32} className="text-slate-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-200 mb-1">L'autore principale sta unendo il testo...</h3>
                  <p className="text-slate-400 text-xs max-w-xs mb-4">
                    Visualizzerai qui in tempo reale come vengono incastrate le rime.
                  </p>
                  <div className="w-full text-left bg-black/40 rounded-xl p-4 flex-1 overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner min-h-[200px]">
                    <div className="font-mono text-xs sm:text-sm text-slate-300 whitespace-pre-wrap">{activeDraft.lyrics}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Co-op Drafting: Stacked on mobile, side-by-side on desktop */
            <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-y-auto custom-scrollbar">
              <div className="flex-1 flex flex-col bg-black/30 rounded-xl border border-slate-800 overflow-hidden min-h-[200px]">
                <div className="px-3 py-2 border-b border-slate-800 bg-black/20 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1.5">
                    <PenTool size={13} /> Le Mie Barre
                  </span>
                  {myReady && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">PRONTO</span>}
                </div>
                <textarea 
                  className={`flex-1 w-full bg-transparent p-3 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-700 custom-scrollbar min-h-[140px] ${myReady ? 'opacity-50' : ''}`}
                  placeholder="Scrivi le tue idee..."
                  value={myLyrics}
                  onChange={(e) => handleMyLyricsChange(e.target.value)}
                  disabled={myReady}
                />
                <div className="p-2.5 bg-black/40 border-t border-slate-800 shrink-0">
                  <button 
                    onClick={toggleReady}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-colors border min-h-[44px] ${
                      myReady 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                        : 'bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-[0_0_10px_rgba(22,163,74,0.3)]'
                    }`}
                  >
                    {myReady ? 'Annulla Pronto' : 'Pronto per Unire'}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col bg-black/30 rounded-xl border border-slate-800 overflow-hidden min-h-[200px]">
                <div className="px-3 py-2 border-b border-slate-800 bg-black/20 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-purple-400 uppercase flex items-center gap-1.5">
                    <Users size={13} /> Barre del Feat
                  </span>
                  {friendReady && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">PRONTO</span>}
                </div>
                <div className="flex-1 w-full bg-transparent p-3 overflow-y-auto custom-scrollbar min-h-[140px]">
                  {friendLyrics ? (
                    <div className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{friendLyrics}</div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 italic text-xs font-mono py-8">
                      In attesa che l'amico scriva...
                    </div>
                  )}
                </div>
                <div className="p-2.5 bg-black/40 border-t border-slate-800 flex items-center justify-center min-h-[44px] shrink-0">
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${friendReady ? 'text-green-400' : 'text-slate-500'}`}>
                    {friendReady ? <><CheckCircle size={14} /> Feat pronto a unire</> : 'Feat sta componendo...'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Beat / Instrumental & YouTube Player (Right on Desktop, Below on Mobile) */}
        <div className="flex flex-col gap-6">
          
          {/* Beat URL Input & Tunebat Controls */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Carica Base (YouTube o Beat URL)
              </label>
              {activeDraft.beatUrl && (
                <button
                  onClick={handleRemoveBeat}
                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs flex items-center gap-1 transition-colors min-h-[36px]"
                  title="Rimuovi base audio"
                >
                  <Trash2 size={13} />
                  <span>Rimuovi base</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  className="w-full bg-black/50 border border-slate-900 rounded-xl pl-10 pr-8 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 shadow-inner text-slate-200 min-h-[44px]"
                  placeholder="https://youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadBeat()}
                />
                {urlInput && (
                  <button
                    onClick={() => setUrlInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button 
                onClick={handleLoadBeat}
                disabled={isDetectingTunebat}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shadow-md border border-blue-400/50 flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[44px]"
              >
                {isDetectingTunebat ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                <span>Carica & Auto-Detect</span>
              </button>
            </div>

            {/* Tunebat Auto-Compilation Box */}
            <div className="p-3 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Tunebat BPM</span>
                  <input
                    type="number"
                    value={activeDraft.bpm || 140}
                    onChange={(e) => updateActiveDraft({ bpm: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 bg-transparent text-sm font-mono font-bold text-blue-400 focus:outline-none border-b border-blue-500/30"
                  />
                </div>
                <div className="w-px h-6 bg-slate-800" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Tunebat Key</span>
                  <input
                    type="text"
                    value={activeDraft.key || 'C Minor'}
                    onChange={(e) => updateActiveDraft({ key: e.target.value })}
                    className="w-24 bg-transparent text-sm font-mono font-bold text-purple-400 focus:outline-none border-b border-purple-500/30"
                  />
                </div>
              </div>

              <a
                href={tunebatSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-slate-400 hover:text-blue-400 flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg transition-colors border border-white/5 min-h-[36px]"
              >
                <span>Tunebat</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* YouTube Embed Player: Strict aspect-video (16:9) rather than fixed height */}
          <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-900 shadow-lg relative shrink-0">
            {ytId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&controls=1&modestbranding=1`}
                title="YouTube video player"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                <Youtube className="w-12 h-12 mb-2 opacity-40 text-slate-500" />
                <p className="text-xs font-medium text-slate-400">Nessuna base inserita</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Incolla un link YouTube per mandarla in loop mentre scrivi</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Delete Draft Confirmation Modal */}
      {draftToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} />
              Elimina Bozza
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Sei sicuro di voler eliminare definitivamente il progetto <strong className="text-slate-200">"{draftToDelete.title}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDraftToDelete(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteDraft}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium transition-colors shadow-md min-h-[44px]"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
