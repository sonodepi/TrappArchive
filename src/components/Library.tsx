import React, { useState, useMemo } from 'react';
import { Track } from '../types';
import { formatDuration } from '../utils';
import { Play, Mic2, Disc3, ArrowDownAZ, ArrowUpZA, Clock, CalendarDays, ArrowUp, ArrowDown } from 'lucide-react';

type SortBy = 'title' | 'date' | 'duration';
type SortDir = 'asc' | 'desc';

export function Library({ tracks, onPlay }: { tracks: Track[], onPlay: (t: Track) => void }) {
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'date') {
        comparison = a.createdAt - b.createdAt;
      } else if (sortBy === 'duration') {
        comparison = (a.durationMs || 0) - (b.durationMs || 0);
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [tracks, sortBy, sortDir]);

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">Library</h2>
          <p className="text-slate-400 mt-2">{tracks.length} track{tracks.length !== 1 && 's'} in your local catalog.</p>
        </div>
        
        {tracks.length > 0 && (
          <div className="flex items-center gap-3 bg-white/[0.02] p-1.5 rounded-lg border border-black shadow-md">
            <div className="flex bg-black/40 rounded-md p-0.5 border border-black/50">
              <button 
                onClick={() => setSortBy('title')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm flex items-center gap-1.5 transition-colors ${sortBy === 'title' ? 'bg-white/[0.08] text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <ArrowDownAZ size={14} /> Title
              </button>
              <button 
                onClick={() => setSortBy('date')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm flex items-center gap-1.5 transition-colors ${sortBy === 'date' ? 'bg-white/[0.08] text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <CalendarDays size={14} /> Date
              </button>
              <button 
                onClick={() => setSortBy('duration')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm flex items-center gap-1.5 transition-colors ${sortBy === 'duration' ? 'bg-white/[0.08] text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Clock size={14} /> Length
              </button>
            </div>
            
            <div className="w-px h-5 bg-black mx-1"></div>
            
            <button 
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] rounded-md transition-colors mr-1"
              title={`Toggle direction (currently ${sortDir})`}
            >
              {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>
          </div>
        )}
      </div>
      
      {tracks.length === 0 ? (
        <div className="text-slate-500 text-center py-24 border border-black bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl">
          <Disc3 className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-lg font-medium text-slate-300">Your library is empty</p>
          <p className="text-sm mt-2">Go to "Add Track" to start building your catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedTracks.map(t => (
            <div 
              key={t.id} 
              className="bg-white/[0.02] border border-black rounded-2xl p-4 hover:bg-white/[0.04] transition-all group cursor-pointer shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]" 
              onClick={() => onPlay(t)}
            >
              <div className="w-full aspect-square bg-black border border-slate-900 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] transform scale-75 group-hover:scale-100 transition-all border border-blue-400">
                    <Play className="ml-1 w-6 h-6" />
                  </button>
                </div>
                <Disc3 className="w-12 h-12 text-slate-700" />
              </div>
              
              <div className="flex justify-between items-start">
                <div className="truncate pr-4 flex-1">
                  <h3 className="font-semibold text-slate-100 truncate" title={t.title || 'Untitled'}>{t.title || 'Untitled'}</h3>
                  <p className="text-sm text-slate-400 mt-1 truncate">{t.mainArtist || 'Unknown Artist'}</p>
                </div>
                {t.lyrics && <Mic2 size={16} className="text-slate-600 mt-1 shrink-0" title="Has Lyrics" />}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(t.durationMs)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

