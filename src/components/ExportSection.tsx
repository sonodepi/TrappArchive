import React, { useState } from 'react';
import { Album, Track } from '../types';
import { Download, Disc, Music2, Library } from 'lucide-react';

export function ExportSection({ albums, tracks }: { albums: Album[], tracks: Track[] }) {
  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAlbum = (album: Album) => {
    const populatedTracks = album.trackIds
      .map(id => tracks.find(t => t.id === id))
      .filter(Boolean);
    
    const exportData = {
      ...album,
      tracks: populatedTracks,
    };
    downloadJson(exportData, `album_${album.title.replace(/\s+/g, '_').toLowerCase()}.json`);
  };

  const exportTrack = (track: Track) => {
    downloadJson(track, `track_${track.title.replace(/\s+/g, '_').toLowerCase()}.json`);
  };

  const exportFullCatalog = () => {
    downloadJson({ albums, tracks, exportedAt: new Date().toISOString() }, `full_catalog_${Date.now()}.json`);
  };

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Download className="text-blue-500" />
          Export Center
        </h2>
        <p className="text-slate-400 mt-2">Download your catalog data, albums, or individual tracks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-white/[0.02] border border-black rounded-xl p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black border border-slate-800 rounded-xl flex items-center justify-center">
                 <Library className="text-blue-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Full Database Backup</h3>
                <p className="text-sm text-slate-400 mt-1">Export all {tracks.length} tracks and {albums.length} albums to JSON.</p>
              </div>
            </div>
            <button 
              onClick={exportFullCatalog}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50"
            >
              <Download size={18} /> Download All
            </button>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 flex flex-col bg-white/[0.02] border border-black rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Disc size={16} /> Export Albums
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 min-h-[200px]">
             {albums.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm border border-black bg-black/20 rounded-xl">No albums available.</div>
            ) : (
              albums.map(a => (
                <div key={a.id} className="bg-black/40 border border-black rounded-xl p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-md flex items-center justify-center border border-slate-800 shrink-0">
                      <Disc className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200">{a.title}</h4>
                      <p className="text-xs text-slate-500">{a.trackIds.length} tracks • {a.year}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => exportAlbum(a)}
                    className="p-2 text-slate-400 hover:text-blue-400 bg-black border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Export Album JSON"
                  >
                    <Download size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-1 flex flex-col bg-white/[0.02] border border-black rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Music2 size={16} /> Single Tracks
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 min-h-[200px]">
            {tracks.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm border border-black bg-black/20 rounded-xl">No tracks available.</div>
            ) : (
              tracks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-black/40 border border-black rounded-xl hover:bg-white/[0.04] transition-colors shadow-sm">
                  <div className="truncate pr-3">
                    <h4 className="font-medium text-sm text-slate-300 truncate">{t.title || 'Untitled'}</h4>
                    <p className="text-xs text-slate-500 truncate">{t.mainArtist}</p>
                  </div>
                  <button 
                    onClick={() => exportTrack(t)}
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors shrink-0"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
