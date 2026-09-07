import React, { useState, useMemo } from 'react';
import { Album, Track } from '../types';
import { Disc, Plus, Music2, FolderPlus, X, Trash2, Pencil } from 'lucide-react';

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
  const [newAlbum, setNewAlbum] = useState<Partial<Album>>({ title: '', genre: '', year: new Date().getFullYear(), trackIds: [] });

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
    setIsPanelOpen(!isPanelOpen);
  };

  const openEditPanel = (album: Album) => {
    setNewAlbum({ ...album });
    setEditingAlbumId(album.id);
    setIsPanelOpen(true);
  };

  return (
    <div className="p-8 pb-32 max-w-7xl w-full mx-auto flex flex-col h-full">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">Albums & Projects</h2>
          <p className="text-slate-400 mt-2">Organize your tracks into cohesive releases.</p>
        </div>
        
        <button 
          onClick={openCreatePanel}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${isPanelOpen && !editingAlbumId ? 'bg-black text-slate-300 border-slate-700 hover:bg-slate-900' : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}
        >
          {isPanelOpen && !editingAlbumId ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Album</>}
        </button>
      </div>

      {isPanelOpen ? (
        <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-[600px]">
          {/* Main Column: Album Details & Unassigned Tracks */}
          <div className="flex-1 bg-white/[0.02] border border-black rounded-2xl p-6 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.4)] min-h-[400px] relative">
            <button onClick={() => setIsPanelOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-slate-300"><X size={20} /></button>
            <h3 className="text-lg font-semibold text-slate-100 mb-6 border-b border-black/50 pb-4">{editingAlbumId ? 'Edit Project' : 'Create New Project'}</h3>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Album Title</label>
              <input 
                type="text" 
                placeholder="e.g. The Blue Room EP"
                value={newAlbum.title}
                onChange={e => setNewAlbum({...newAlbum, title: e.target.value})}
                className="w-full bg-black/40 border border-black rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[250px]">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Available Tracks (Unassigned)</label>
              <div className="flex-1 overflow-y-auto bg-black/20 border border-black rounded-xl p-2 space-y-1 shadow-inner custom-scrollbar">
                {unassignedTracks.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4 text-center">No unassigned tracks available in the library.</p>
                ) : (
                  unassignedTracks.map(t => {
                    const isSelected = newAlbum.trackIds?.includes(t.id);
                    return (
                      <div 
                        key={t.id}
                        onClick={() => toggleTrackSelection(t.id)}
                        className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors border ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'bg-transparent border-transparent hover:bg-white/[0.03]'}`}
                      >
                        <div>
                          <h4 className={`text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>{t.title || 'Untitled'}</h4>
                          <p className="text-xs text-slate-500">{t.mainArtist}</p>
                        </div>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700'}`}>
                          {isSelected && <Plus size={14} className="rotate-45" />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <button 
              onClick={handleSave}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 transition-colors"
            >
              {editingAlbumId ? 'Save Changes' : 'Save Album'}
            </button>
          </div>

          {/* Right Sidebar: Assigned Tracks */}
          <div className="w-full lg:w-80 bg-white/[0.01] border border-black rounded-2xl p-6 flex flex-col shadow-inner min-h-[300px]">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FolderPlus size={16} /> Already in Albums
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {assignedTracks.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No tracks are currently assigned to other albums.</p>
              ) : (
                assignedTracks.map(t => {
                  const isSelected = newAlbum.trackIds?.includes(t.id);
                  return (
                    <div 
                      key={t.id}
                      onClick={() => toggleTrackSelection(t.id)}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/40 border-black hover:border-slate-800'}`}
                    >
                      <h4 className={`text-xs font-medium truncate ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>{t.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate">Tap to include here too</p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {albums.length === 0 ? (
            <div className="text-slate-500 text-center py-24 border border-black bg-white/[0.02] shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-2xl">
              <Disc className="w-12 h-12 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-medium text-slate-300">No albums yet</p>
              <p className="text-sm mt-2">Group your tracks into albums, EPs, or mixtapes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {albums.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => openEditPanel(a)}
                  className="bg-white/[0.02] border border-black shadow-[0_4px_20px_rgb(0,0,0,0.3)] rounded-2xl p-4 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all cursor-pointer relative group"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteAlbum && window.confirm('Are you sure you want to delete this album?')) {
                        onDeleteAlbum(a.id);
                      }
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-500/80 text-white rounded-md backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="w-full aspect-square bg-black border border-slate-900 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all border border-slate-700">
                        <Pencil size={18} />
                      </div>
                    </div>
                    <Disc className="w-12 h-12 text-slate-700" />
                  </div>
                  <h3 className="font-semibold text-slate-100 truncate">{a.title}</h3>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                    <Music2 size={12} /> {a.trackIds.length} tracks
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
