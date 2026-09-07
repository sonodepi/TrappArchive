import React from 'react';
import { Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Track } from '../types';

export function Player({ currentTrack }: { currentTrack: Track | null }) {
  return (
    <div className="h-24 bg-[#03060d] border-t border-black flex items-center px-6 justify-between shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] relative z-20">
      <div className="w-1/3 flex items-center gap-4">
        {currentTrack ? (
          <>
            <div className="w-14 h-14 bg-black border border-slate-900 rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
              <span className="text-slate-600 text-[10px] uppercase font-bold">Cover</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{currentTrack.title || 'Untitled Track'}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{currentTrack.mainArtist || 'Unknown Artist'}</p>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-600 font-medium">No track selected</div>
        )}
      </div>
      
      <div className="flex flex-col items-center flex-1 max-w-xl">
        <div className="flex items-center gap-6 mb-2">
          <button className="text-slate-400 hover:text-slate-100 transition-colors"><SkipBack size={20} /></button>
          <button className="w-10 h-10 rounded-full bg-slate-100 text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Play size={20} className="ml-1" />
          </button>
          <button className="text-slate-400 hover:text-slate-100 transition-colors"><SkipForward size={20} /></button>
        </div>
        <div className="w-full flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span>0:00</span>
          <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden cursor-pointer group relative border border-slate-800">
            <div className="w-1/3 h-full bg-blue-600 group-hover:bg-blue-400 transition-colors relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md"></div>
            </div>
          </div>
          <span>-:-</span>
        </div>
      </div>
      
      <div className="w-1/3 flex justify-end items-center gap-3">
        <Volume2 size={18} className="text-slate-400" />
        <div className="w-24 h-1.5 bg-black rounded-full overflow-hidden cursor-pointer group border border-slate-800 relative">
          <div className="w-2/3 h-full bg-slate-300 group-hover:bg-blue-500 transition-colors relative">
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
