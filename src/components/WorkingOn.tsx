import React, { useState, useEffect } from 'react';
import { DraftProject } from '../types';
import { extractYoutubeId } from '../utils';
import { Youtube, AlignLeft, ArrowLeft, Plus, Eye, EyeOff, Hash, LogIn, Users, CheckCircle, Lock, PenTool, Trash2, ArrowRightToLine } from 'lucide-react';

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
  
  const [ownedDraftIds, setOwnedDraftIds] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('trackstudio_owned') || '[]');
  });

  const createDraft = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newDraft: DraftProject = {
      id: crypto.randomUUID(),
      title: 'Untitled Draft',
      lyrics: '',
      ownerLyrics: '',
      collaboratorLyrics: '',
      isCoopMode: false,
      ownerReady: false,
      collabReady: false,
      beatUrl: '',
      shareCode: code,
      updatedAt: Date.now()
    };
    setDrafts([...drafts, newDraft]);
    setActiveDraftId(newDraft.id);
    setUrlInput('');
    
    setOwnedDraftIds(prev => {
      const next = [...prev, newDraft.id];
      localStorage.setItem('trackstudio_owned', JSON.stringify(next));
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
        title: `Collab Project (${cleanCode})`,
        lyrics: '',
        ownerLyrics: '',
        collaboratorLyrics: '',
        isCoopMode: false,
        ownerReady: false,
        collabReady: false,
        beatUrl: '',
        shareCode: cleanCode,
        updatedAt: Date.now()
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

  const handleLoadBeat = () => {
    updateActiveDraft({ beatUrl: urlInput });
  };

  if (!activeDraft) {
    return (
      <div className="p-8 h-full flex flex-col max-w-7xl mx-auto pb-32">
        <div className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3 mb-4">
              <AlignLeft className="text-blue-500" />
              Working On (Cowork)
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="w-32 bg-black/40 border border-black rounded-lg px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-slate-200"
                />
                <button 
                  onClick={handleJoin}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  title="Join Session"
                >
                  <LogIn size={14} />
                </button>
              </div>
              <p className="text-sm text-slate-400">Enter a 6-digit code to join</p>
            </div>
          </div>
          
          <button 
            onClick={createDraft}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 flex items-center gap-2"
          >
            <Plus size={16} /> New Session
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drafts.map(draft => (
            <div 
              key={draft.id} 
              onClick={() => {
                setActiveDraftId(draft.id);
                setUrlInput(draft.beatUrl);
              }}
              className="bg-white/[0.02] border border-black shadow-[0_4px_20px_rgb(0,0,0,0.3)] rounded-2xl p-6 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all cursor-pointer group flex flex-col h-48 relative overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this draft?')) {
                    setDrafts(drafts.filter(d => d.id !== draft.id));
                  }
                }}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-red-500/80 text-white rounded-md backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Delete Draft"
              >
                <Trash2 size={16} />
              </button>
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2 truncate z-10 pr-8">{draft.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-auto z-10 font-mono opacity-60">
                {draft.lyrics || 'No lyrics written yet...'}
              </p>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-black/50 z-10">
                <span className="text-xs font-mono text-slate-400 bg-black px-2 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
                  <Hash size={12} className="text-blue-500"/>
                  {draft.shareCode.slice(0,3)} - {draft.shareCode.slice(3,6)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(draft.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          
          {drafts.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              <AlignLeft className="w-12 h-12 mb-4 opacity-20" />
              <p>No active sessions.</p>
              <button onClick={createDraft} className="text-blue-500 mt-2 hover:underline">Start writing</button>
            </div>
          )}
        </div>
      </div>
    );
  }

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

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto pb-32">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveDraftId(null)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <input 
            type="text" 
            value={activeDraft.title}
            onChange={(e) => updateActiveDraft({ title: e.target.value })}
            className="text-2xl font-bold tracking-tight text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 p-0 max-w-[200px]"
          />
          <div className="flex items-center gap-1 border-l border-white/10 pl-4 ml-2">
            <button
              onClick={() => {
                if (onSendToTrack) onSendToTrack(activeDraft);
              }}
              className="p-2 bg-white/5 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors border border-transparent hover:border-blue-500/30"
              title="Send to Add Track (Export)"
            >
              <ArrowRightToLine size={18} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this draft completely?')) {
                  setDrafts(drafts.filter(d => d.id !== activeDraft.id));
                  setActiveDraftId(null);
                }
              }}
              className="p-2 bg-white/5 hover:bg-red-500/20 text-red-400 rounded-md transition-colors border border-transparent hover:border-red-500/30"
              title="Delete Draft"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => updateActiveDraft({ isCoopMode: !activeDraft.isCoopMode })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
              activeDraft.isCoopMode 
                ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/50 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Users size={16} /> {activeDraft.isCoopMode ? 'Co-op Active' : 'Enable Co-op'}
          </button>

          <div className="flex items-center gap-3 bg-black/40 border border-black rounded-lg p-1.5 pl-4 shadow-inner">
            <span className={`font-mono text-lg tracking-widest transition-all ${showCode ? 'text-blue-400' : 'text-slate-500 blur-[4px]'}`}>
              {activeDraft.shareCode.slice(0,3)} - {activeDraft.shareCode.slice(3,6)}
            </span>
            <button 
              onClick={() => setShowCode(!showCode)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-md transition-colors text-slate-300"
              title={showCode ? "Hide share code" : "Reveal share code"}
            >
              {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
        
        {/* Lyrics Editor */}
        <div className="flex flex-col bg-white/[0.02] border border-black rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative">
          <div className="px-4 py-3 bg-black/40 border-b border-black flex justify-between items-center shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {activeDraft.isCoopMode ? (bothReady ? 'Merge Phase' : 'Co-op Draft') : 'Lyrics'}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Live sync active
            </span>
          </div>
          
          {!activeDraft.isCoopMode ? (
            <textarea 
              className="flex-1 w-full bg-transparent p-6 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 custom-scrollbar relative z-10"
              placeholder="Start writing your verses here..."
              value={activeDraft.lyrics}
              onChange={(e) => updateActiveDraft({ lyrics: e.target.value })}
            />
          ) : bothReady ? (
            // MERGE MODE
            <div className="flex-1 flex flex-col p-6 gap-4">
              {isOwner ? (
                <>
                  <div className="flex gap-4 h-32">
                    <div className="flex-1 bg-black/40 rounded-lg p-3 overflow-y-auto custom-scrollbar border border-black/60 shadow-inner">
                      <div className="text-[10px] uppercase text-blue-500 font-bold mb-1 opacity-70">Your Verses</div>
                      <div className="font-mono text-xs text-slate-400 whitespace-pre-wrap">{myLyrics}</div>
                    </div>
                    <div className="flex-1 bg-black/40 rounded-lg p-3 overflow-y-auto custom-scrollbar border border-black/60 shadow-inner">
                      <div className="text-[10px] uppercase text-purple-400 font-bold mb-1 opacity-70">Friend's Verses</div>
                      <div className="font-mono text-xs text-slate-400 whitespace-pre-wrap">{friendLyrics}</div>
                    </div>
                  </div>
                  <textarea 
                    className="flex-1 w-full bg-black/20 border border-black/50 rounded-lg p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 custom-scrollbar shadow-inner"
                    placeholder="Combine the verses here into the final lyrics..."
                    value={activeDraft.lyrics}
                    onChange={(e) => updateActiveDraft({ lyrics: e.target.value })}
                  />
                  <button 
                    onClick={() => updateActiveDraft({ isCoopMode: false, ownerReady: false, collabReady: false })}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg border border-blue-400/30 flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} /> Finalize Merge
                  </button>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center">
                  <Lock size={32} className="text-slate-600 mb-4" />
                  <h3 className="text-lg font-bold text-slate-300 mb-2">Owner is Merging...</h3>
                  <p className="text-slate-500 text-sm max-w-xs mb-8">
                    The owner is currently merging both drafts. You can watch the final result below.
                  </p>
                  <div className="w-full text-left bg-black/40 rounded-lg p-4 flex-1 overflow-y-auto custom-scrollbar border border-black/60 shadow-inner">
                    <div className="font-mono text-sm text-slate-400 whitespace-pre-wrap">{activeDraft.lyrics}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // DRAFTING MODE
            <div className="flex-1 flex gap-4 p-4">
              {/* My Side */}
              <div className="flex-1 flex flex-col bg-black/20 rounded-lg border border-black/40 overflow-hidden relative">
                <div className="px-3 py-2 border-b border-black/40 bg-black/20 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-500 uppercase flex items-center gap-2">
                    <PenTool size={12} /> My Verses
                  </span>
                  {myReady && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Ready</span>}
                </div>
                <textarea 
                  className={`flex-1 w-full bg-transparent p-4 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-700 custom-scrollbar ${myReady ? 'opacity-50' : ''}`}
                  placeholder="Write your ideas here..."
                  value={myLyrics}
                  onChange={(e) => handleMyLyricsChange(e.target.value)}
                  disabled={myReady}
                />
                <div className="p-3 bg-black/40 border-t border-black/40 backdrop-blur-sm">
                  <button 
                    onClick={toggleReady}
                    className={`w-full py-2 rounded font-medium text-sm transition-colors border ${
                      myReady 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                        : 'bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-[0_0_10px_rgba(22,163,74,0.3)]'
                    }`}
                  >
                    {myReady ? 'Cancel Ready' : 'Ready to Merge'}
                  </button>
                </div>
                {myReady && <div className="absolute inset-0 z-20" />}
              </div>
              
              {/* Friend Side */}
              <div className="flex-1 flex flex-col bg-black/20 rounded-lg border border-black/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-black/40 bg-black/20 flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-500 uppercase flex items-center gap-2">
                    <Users size={12} /> Friend's Verses
                  </span>
                  {friendReady && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Ready</span>}
                </div>
                <div className="flex-1 w-full bg-transparent p-4 overflow-y-auto custom-scrollbar">
                  {friendLyrics ? (
                    <div className="font-mono text-sm leading-relaxed text-slate-400 whitespace-pre-wrap">{friendLyrics}</div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 italic text-sm font-mono">
                      Waiting for input...
                    </div>
                  )}
                </div>
                <div className="p-3 bg-black/40 border-t border-black/40 flex items-center justify-center">
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${friendReady ? 'text-green-400' : 'text-slate-500'}`}>
                    {friendReady ? <><CheckCircle size={14} /> Friend is ready to merge</> : 'Friend is writing...'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Beat Player / YouTube Embed */}
        <div className="flex flex-col gap-6">
          <div className="bg-white/[0.02] border border-black rounded-2xl p-6 shadow-md">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Load Beat (YouTube URL)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text"
                  className="w-full bg-black/40 border border-black rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 shadow-inner text-slate-200"
                  placeholder="https://youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadBeat()}
                />
              </div>
              <button 
                onClick={handleLoadBeat}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50"
              >
                Load & Loop
              </button>
            </div>
          </div>

          <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-black shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative min-h-[300px]">
            {ytId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&controls=1&modestbranding=1`}
                title="YouTube video player"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                <Youtube className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-sm font-medium">No beat loaded</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
