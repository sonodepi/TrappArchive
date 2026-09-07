import React, { useState, useMemo } from 'react';
import { Album, Track } from '../types';
import { Disc, Plus, Music2, FolderPlus, X, Trash2, Pencil, Calendar, Tag, Check, AlertTriangle } from 'lucide-react';

export function Albums({ 
  albums, 
  tracks, 
  onSaveAlbum,
  onUpdateAlbum,
  onDeleteAlbum
}: { 
  albums: Album[], 
  tracks: Track[],
  onSaveAlbum: (a: Album) => void,
  onUpdateAlbum?: (a: Album) => void,
  onDeleteAlbum?: (id: string) => void
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [newAlbum, setNewAlbum] = useState<Partial<Album>>({ 
    title: '', 
    genre: '', 
    year: new Date().getFullYear(), 
    trackIds: [] 
  });
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);

  // Calculate assigned tracks from OTHER albums
  const assignedTrackIds = useMemo(() => {
    const otherAlbums = albums.filter(a => a.id !== editingAlbumId);
    return new Set(otherAlbums.flatMap(a => a.trackIds));
  }, [albums, editingAlbumId]);
  
  const unassignedTracks = tracks.filter(t => !assignedTrackIds.has(t.id));
  const assignedTracks = tracks.filter(t => assignedTrackIds.has(t.id));

  const toggleTrackSelection = (trackId: string) => {
    setNewAlbum(prev => {
      const ids = prev.trackIds || [];
      if (ids.includes(trackId)) {
        return { ...prev, trackIds: ids.filter(id => id !== trackId) };
      } else {
        return { ...prev, trackIds: [...ids, trackId] };
      }
    });
  };

  const handleSave = () => {
    if (!newAlbum.title) return;
    
    if (editingAlbumId && onUpdateAlbum) {
      onUpdateAlbum({
        ...(newAlbum as Album),
        title: newAlbum.title,
        trackIds: newAlbum.trackIds || []
      });
    } else {
      const albumToSave: Album = {
        id: crypto.randomUUID(),
        title: newAlbum.title || 'Untitled Album',
        coverArt: '',
        year: newAlbum.year || new Date().getFullYear(),
        genre: newAlbum.genre || '',
        trackIds: newAlbum.trackIds || [],
        createdAt: Date.now()
      };
      onSaveAlbum(albumToSave);
    }
    
    setNewAlbum({ title: '', genre: '', year: new Date().getFullYear(), trackIds: [] });
    setEditingAlbumId(null);
    setIsPanelOpen(false);
  };

  const openCreatePanel = () => {
    setNewAlbum({ title: '', genre: '', year: new Date().getFullYear(), trackIds: [] });
    setEditingAlbumId(null);
    setIsPanelOpen(true);
  };

  const openEditPanel = (album: Album) => {
    setNewAlbum({ ...album });
    setEditingAlbumId(album.id);
    setIsPanelOpen(true);
  };

  const confirmDeleteAlbum = () => {
    if (albumToDelete && onDeleteAlbum) {
      onDeleteAlbum(albumToDelete.id);
      setAlbumToDelete(null);
      if (editingAlbumId === albumToDelete.id) {
        setIsPanelOpen(false);
        setEditingAlbumId(null);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Disc className="text-blue-500 shrink-0" />
            Albums & Collections
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {albums.length} album{albums.length !== 1 && 's'} in your discography.
          </p>
        </div>
        
        <button 
          onClick={openCreatePanel}
          className="self-start sm:self-auto bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 flex items-center gap-2 min-h-[44px]"
        >
          <Plus size={18} /> New Album
        </button>
      </div>

      {isPanelOpen ? (
        /* ====================================================================== */
        /* Create / Edit Album Panel: Strict flex-col / overflow-y-auto hierarchy */
        /* ====================================================================== */
        <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 mb-8 flex flex-col lg:flex-row gap-6 shadow-xl max-h-[calc(100vh-220px)] overflow-hidden shrink-0">
          
          {/* Main Column: Album Form (Header, Inputs, Scrollable Track List, Action Button OUTSIDE) */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
            
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {editingAlbumId ? 'Edit Album' : 'Create New Album'}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {editingAlbumId && onDeleteAlbum && (
                  <button 
                    onClick={() => {
                      const cur = albums.find(a => a.id === editingAlbumId);
                      if (cur) setAlbumToDelete(cur);
                    }}
                    className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-500 hover:text-white text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-500/20 min-h-[40px]"
                    title="Elimina questo album"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Elimina Album</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Chiudi"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Inputs: Title, Genre, Year */}
            <div className="space-y-3 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Album Title *
                </label>
                <input 
                  type="text" 
                  value={newAlbum.title || ''}
                  onChange={e => setNewAlbum({ ...newAlbum, title: e.target.value })}
                  placeholder="e.g. Rockstar (Deluxe)"
                  className="w-full bg-black/40 border border-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors text-slate-200 placeholder:text-slate-600 shadow-inner text-sm min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Genre
                  </label>
                  <input 
                    type="text" 
                    value={newAlbum.genre || ''}
                    onChange={e => setNewAlbum({ ...newAlbum, genre: e.target.value })}
                    placeholder="e.g. Trap / Hip-Hop"
                    className="w-full bg-black/40 border border-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors text-slate-200 placeholder:text-slate-600 shadow-inner text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Release Year
                  </label>
                  <input 
                    type="number" 
                    value={newAlbum.year || new Date().getFullYear()}
                    onChange={e => setNewAlbum({ ...newAlbum, year: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                    className="w-full bg-black/40 border border-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors text-slate-200 shadow-inner text-sm min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            {/* Selection Label */}
            <div className="flex items-center justify-between shrink-0 pt-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Tracks ({newAlbum.trackIds?.length || 0} selected)
              </label>
              <span className="text-[11px] text-slate-500">Tap track to include/exclude</span>
            </div>

            {/* Scrollable Track List Container (flex-1, min-h-0, overflow-y-auto, bounded) */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1 border border-slate-900/80 bg-black/20 rounded-xl space-y-2 max-h-48 sm:max-h-56 lg:max-h-64">
              {tracks.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nessuna traccia presente nella libreria. Aggiungi prima delle tracce per inserirle nell'album.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tracks.map(t => {
                    const isSelected = newAlbum.trackIds?.includes(t.id);
                    return (
                      <div 
                        key={t.id}
                        onClick={() => toggleTrackSelection(t.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between min-h-[44px] select-none ${
                          isSelected 
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' 
                            : 'bg-black/40 border-slate-900 hover:border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <h4 className="text-xs font-semibold truncate">{t.title || 'Untitled'}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{t.mainArtist || 'No artist'}</p>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-1 rounded shrink-0 flex items-center gap-1 ${
                          isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSelected ? (
                            <>
                              <Check size={11} />
                              <span>INCLUSO</span>
                            </>
                          ) : (
                            <span>+ AGGIUNGI</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Save Button: MUST BE OUTSIDE SCROLLABLE LIST, shrink-0, ALWAYS VISIBLE */}
            <div className="pt-2 shrink-0">
              <button 
                type="button"
                onClick={handleSave}
                disabled={!newAlbum.title}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/40 min-h-[44px] flex items-center justify-center gap-2"
              >
                <Disc size={18} />
                <span>{editingAlbumId ? 'Salva Modifiche Album' : 'Crea Album'}</span>
              </button>
            </div>
          </div>

          {/* Secondary Column: "In Other Albums" (Stacked below on mobile/tablet, side on desktop) */}
          <div className="w-full lg:w-72 bg-black/40 border border-slate-900 rounded-2xl p-4 flex flex-col shrink-0 min-h-0 overflow-hidden shadow-inner">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
              <FolderPlus size={14} className="text-blue-400" /> Already In Other Albums
            </h4>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 custom-scrollbar max-h-36 sm:max-h-48 lg:max-h-none pr-1">
              {assignedTracks.length === 0 ? (
                <p className="text-xs text-slate-600 italic py-2">Nessuna traccia assegnata ad altri album.</p>
              ) : (
                assignedTracks.map(t => {
                  const isSelected = newAlbum.trackIds?.includes(t.id);
                  return (
                    <div 
                      key={t.id}
                      onClick={() => toggleTrackSelection(t.id)}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors min-h-[40px] flex items-center justify-between ${
                        isSelected ? 'bg-blue-600/15 border-blue-500/40 text-blue-300' : 'bg-black/50 border-slate-900 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="min-w-0 pr-2 truncate">
                        <h5 className="text-xs font-medium truncate">{t.title}</h5>
                        <span className="text-[10px] text-slate-500 block truncate">{t.mainArtist || 'Artist'}</span>
                      </div>
                      <span className="text-[9px] text-blue-400 font-mono shrink-0">
                        {isSelected ? '✓' : '+'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Albums Grid View */
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {albums.length === 0 ? (
            <div className="text-slate-500 text-center py-20 border border-slate-900 bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl p-6">
              <Disc className="w-12 h-12 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-medium text-slate-300">Nessun album presente</p>
              <p className="text-sm mt-1 max-w-sm mx-auto text-slate-500">
                Organizza la tua produzione musicale creando album, EP o mixtape.
              </p>
              <button 
                onClick={openCreatePanel}
                className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md min-h-[44px]"
              >
                <Plus size={16} /> Crea il tuo primo album
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {albums.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => openEditPanel(a)}
                  className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 hover:bg-white/[0.04] transition-all cursor-pointer relative group shadow-[0_4px_20px_rgb(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col justify-between"
                >
                  <div>
                    <div className="w-full aspect-square bg-black border border-slate-900 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden shadow-inner">
                      <Disc className="w-16 h-16 text-slate-700 group-hover:scale-105 transition-transform" />
                      
                      {/* Edit Hover Indicator */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                        <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border border-blue-400">
                          <Pencil size={18} />
                        </div>
                      </div>

                      {/* Delete Album button (Always accessible) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlbumToDelete(a);
                        }}
                        className="absolute top-2 right-2 p-2 bg-black/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl backdrop-blur-md transition-colors border border-slate-800 z-10 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Elimina album"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <h3 className="font-semibold text-slate-100 truncate text-base">{a.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Music2 size={12} className="text-blue-400" /> {a.trackIds.length} track{a.trackIds.length !== 1 && 's'}
                      </span>
                      {a.genre && (
                        <>
                          <span>•</span>
                          <span className="truncate">{a.genre}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-3 pt-3 border-t border-slate-900">
                    <span>{a.year || new Date(a.createdAt).getFullYear()}</span>
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Album Deletion */}
      {albumToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="text-rose-500" size={20} />
              Elimina Album
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Sei sicuro di voler eliminare l'album <strong className="text-slate-200">"{albumToDelete.title}"</strong>? Le tracce rimarranno salvate nella tua Library.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setAlbumToDelete(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteAlbum}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-medium transition-colors shadow-md min-h-[44px]"
              >
                Elimina Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
