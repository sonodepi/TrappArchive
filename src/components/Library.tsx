import React, { useState, useMemo } from 'react';
import { Track } from '../types';
import { formatDuration } from '../utils';
import { 
  Play, Disc3, ArrowDownAZ, CalendarDays, Clock, 
  ArrowUp, ArrowDown, Pencil, Trash2, Activity, Music2, AlertTriangle 
} from 'lucide-react';

type SortBy = 'title' | 'date' | 'duration' | 'bpm';
type SortDir = 'asc' | 'desc';

export function Library({ 
  tracks, 
  onPlayTrack,
  onEditTrack,
  onDeleteTrack
}: { 
  tracks: Track[], 
  onPlayTrack: (t: Track) => void,
  onEditTrack?: (t: Track) => void,
  onDeleteTrack?: (id: string) => void
}) {
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'date') {
        comparison = a.createdAt - b.createdAt;
      } else if (sortBy === 'duration') {
        comparison = (a.durationMs || 0) - (b.durationMs || 0);
      } else if (sortBy === 'bpm') {
        comparison = (a.bpm || 0) - (b.bpm || 0);
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [tracks, sortBy, sortDir]);

  const confirmDelete = () => {
    if (trackToDelete && onDeleteTrack) {
      onDeleteTrack(trackToDelete.id);
      setTrackToDelete(null);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-7xl mx-auto">
      {/* Header & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Music2 className="text-blue-500 shrink-0" />
            Libreria Tracce
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {tracks.length} tracci{tracks.length === 1 ? 'a' : 'e'} nel catalogo personale.
          </p>
        </div>
        
        {tracks.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {/* Mobile Dropdown Menu (< 768px) */}
            <div className="md:hidden flex items-center gap-2 w-full">
              <select
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-') as [SortBy, SortDir];
                  setSortBy(field);
                  setSortDir(dir);
                }}
                className="flex-1 bg-black/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-medium min-h-[44px] focus:outline-none focus:border-blue-500"
              >
                <option value="date-desc">Recenti prima</option>
                <option value="date-asc">Meno recenti prima</option>
                <option value="title-asc">Titolo (A-Z)</option>
                <option value="title-desc">Titolo (Z-A)</option>
                <option value="bpm-desc">BPM (più veloci)</option>
                <option value="bpm-asc">BPM (più lenti)</option>
                <option value="duration-desc">Durata (più lunghe)</option>
                <option value="duration-asc">Durata (più corte)</option>
              </select>
            </div>

            {/* Desktop / Tablet Button Controls (>= 768px) */}
            <div className="hidden md:flex items-center gap-2 bg-white/[0.02] p-1.5 rounded-xl border border-slate-900 shadow-md">
              <div className="flex bg-black/40 rounded-lg p-0.5 border border-slate-900">
                <button 
                  onClick={() => setSortBy('title')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors min-h-[36px] ${
                    sortBy === 'title' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowDownAZ size={14} /> Titolo
                </button>
                <button 
                  onClick={() => setSortBy('bpm')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors min-h-[36px] ${
                    sortBy === 'bpm' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity size={14} /> BPM
                </button>
                <button 
                  onClick={() => setSortBy('date')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors min-h-[36px] ${
                    sortBy === 'date' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarDays size={14} /> Data
                </button>
                <button 
                  onClick={() => setSortBy('duration')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors min-h-[36px] ${
                    sortBy === 'duration' ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock size={14} /> Durata
                </button>
              </div>
              
              <div className="w-px h-5 bg-slate-800 mx-0.5" />
              
              <button 
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="p-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                title={`Inverti ordinamento (${sortDir})`}
              >
                {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Empty State */}
      {tracks.length === 0 ? (
        <div className="text-slate-500 text-center py-24 border border-slate-900 bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-6">
          <Disc3 className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-lg font-medium text-slate-300">La tua libreria è vuota</p>
          <p className="text-sm mt-1 text-slate-500 max-w-sm mx-auto">
            Aggiungi la tua prima traccia con BPM e chiave Tunebat automatici per iniziare.
          </p>
        </div>
      ) : (
        <>
          {/* ====================================================================== */}
          {/* MOBILE VIEW (< 768px): Compact Horizontal Track Rows                   */}
          {/* Mini thumbnail left, title/artist center, duration right, actions visible */}
          {/* ====================================================================== */}
          <div className="flex md:hidden flex-col gap-2.5">
            {sortedTracks.map(t => (
              <div 
                key={t.id}
                onClick={() => onPlayTrack(t)}
                className="bg-white/[0.02] border border-slate-900 hover:border-slate-800 rounded-xl p-3 flex items-center gap-3 transition-colors cursor-pointer min-h-[64px]"
              >
                {/* Mini Thumbnail */}
                <div className="w-12 h-12 bg-black rounded-lg border border-slate-900 flex items-center justify-center shrink-0 shadow-inner relative">
                  <Disc3 className="w-6 h-6 text-slate-600" />
                  <div className="absolute inset-0 bg-blue-600/20 rounded-lg flex items-center justify-center opacity-80">
                    <Play size={14} className="text-blue-400 ml-0.5" />
                  </div>
                </div>

                {/* Info Center */}
                <div className="flex-1 min-w-0 pr-1">
                  <h3 className="font-semibold text-sm text-slate-100 truncate">{t.title || 'Untitled'}</h3>
                  <p className="text-xs text-slate-400 truncate">{t.mainArtist || 'Unknown Artist'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    {t.bpm && <span className="text-blue-400 font-semibold">{t.bpm} BPM</span>}
                    {t.key && <span>• {t.key}</span>}
                  </div>
                </div>

                {/* Right: Duration & Always-Visible Action Buttons (touch >= 44px) */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs font-mono text-slate-400 pr-1">
                    {formatDuration(t.durationMs || 0)}
                  </span>

                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEditTrack) onEditTrack(t);
                    }}
                    className="p-2.5 text-slate-400 hover:text-white active:bg-blue-600/20 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Modifica"
                  >
                    <Pencil size={16} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackToDelete(t);
                    }}
                    className="p-2.5 text-slate-400 hover:text-rose-400 active:bg-rose-600/20 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Elimina"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ====================================================================== */}
          {/* TABLET / DESKTOP VIEW (≥ 768px): 2 cols on tablet, 3-4 cols on desktop */}
          {/* ====================================================================== */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {sortedTracks.map(t => (
              <div 
                key={t.id} 
                className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 hover:bg-white/[0.04] transition-all group cursor-pointer shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col justify-between" 
                onClick={() => onPlayTrack(t)}
              >
                <div>
                  {/* Artwork & Action Overlay */}
                  <div className="w-full aspect-square bg-black border border-slate-900 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden group">
                    <Disc3 className="w-14 h-14 text-slate-700 group-hover:scale-105 transition-transform" />
                    
                    {/* Hover Play button */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                      <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] transform scale-75 group-hover:scale-100 transition-all border border-blue-400">
                        <Play className="ml-1 w-6 h-6" />
                      </div>
                    </div>
                    
                    {/* Edit & Delete Actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditTrack) onEditTrack(t);
                        }}
                        className="p-1.5 bg-black/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg backdrop-blur-md transition-colors border border-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Modifica traccia"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackToDelete(t);
                        }}
                        className="p-1.5 bg-black/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg backdrop-blur-md transition-colors border border-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Elimina traccia"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Tunebat BPM & Key Overlay Pill */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono font-bold pointer-events-none z-10">
                      {t.bpm ? (
                        <span className="bg-black/80 backdrop-blur-md text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                          {t.bpm} BPM
                        </span>
                      ) : <span />}
                      {t.key && (
                        <span className="bg-black/80 backdrop-blur-md text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
                          {t.key}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Track Details */}
                  <h3 className="font-semibold text-slate-100 truncate text-base">{t.title}</h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{t.mainArtist || 'Unknown Artist'}</p>
                  {t.producer && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                      Prod. {t.producer}
                    </p>
                  )}
                </div>

                {/* Bottom Meta */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-3 pt-3 border-t border-slate-900">
                  <span>{formatDuration(t.durationMs || 0)}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirmation Modal for Track Deletion */}
      {trackToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} />
              Elimina Traccia Audio
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Sei sicuro di voler rimuovere la traccia <strong className="text-slate-200">"{trackToDelete.title}"</strong> dal catalogo? Questa operazione è irreversibile.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setTrackToDelete(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
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
