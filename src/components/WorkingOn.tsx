import React, { useState } from 'react';
import { WorkspaceState } from '../types';
import { extractYoutubeId } from '../utils';
import { Youtube, AlignLeft, Save } from 'lucide-react';

export function WorkingOn({ 
  workspace, 
  setWorkspace 
}: { 
  workspace: WorkspaceState, 
  setWorkspace: (ws: WorkspaceState) => void 
}) {
  const [urlInput, setUrlInput] = useState(workspace.beatUrl);
  
  const handleLoadBeat = () => {
    setWorkspace({ ...workspace, beatUrl: urlInput });
  };

  const ytId = extractYoutubeId(workspace.beatUrl);

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto pb-32">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
            <AlignLeft className="text-blue-500" />
            Working On (Scratchpad)
          </h2>
          <p className="text-slate-400 mt-2">Write your lyrics in real-time while looping a beat from YouTube.</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
        
        {/* Lyrics Editor */}
        <div className="flex flex-col bg-white/[0.02] border border-black rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          <div className="px-4 py-3 bg-black/40 border-b border-black flex justify-between items-center shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lyrics Draft</span>
            <span className="text-xs text-slate-500">Auto-saved locally</span>
          </div>
          <textarea 
            className="flex-1 w-full bg-transparent p-6 focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 custom-scrollbar"
            placeholder="Start writing your verses here..."
            value={workspace.lyricsDraft}
            onChange={(e) => setWorkspace({ ...workspace, lyricsDraft: e.target.value })}
          />
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
            <p className="text-xs text-slate-500 mt-3">
              Loads via YouTube's privacy-enhanced mode without ads. Automatically loops.
            </p>
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
