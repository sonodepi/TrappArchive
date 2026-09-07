import React, { useRef, useState } from 'react';
import { Album, Track } from '../types';
import { 
  Download, Upload, Disc, Music2, Library, 
  CheckCircle2, FileJson, Laptop, Smartphone, Wifi, HardDrive, Sparkles 
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export function ExportSection({ 
  albums, 
  tracks,
}: { 
  albums: Album[]; 
  tracks: Track[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

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
    downloadJson(exportData, `trapparchive_album_${album.title.replace(/\s+/g, '_').toLowerCase()}.json`);
  };

  const exportTrack = (track: Track) => {
    downloadJson(track, `trapparchive_track_${(track.title || 'untitled').replace(/\s+/g, '_').toLowerCase()}.json`);
  };

  const exportFullCatalog = () => {
    const drafts = JSON.parse(localStorage.getItem('trapparchive_drafts') || '[]');
    downloadJson({ 
      app: 'TrappArchive',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      albums, 
      tracks,
      drafts
    }, `trapparchive_full_catalog_${Date.now()}.json`);
  };

  // Import JSON Catalog
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let importedTracksCount = 0;
        let importedAlbumsCount = 0;

        if (Array.isArray(parsed.tracks)) {
          const currentTracks: Track[] = JSON.parse(localStorage.getItem('trapparchive_tracks') || '[]');
          const trackIds = new Set(currentTracks.map(t => t.id));
          const toAdd = parsed.tracks.filter((t: Track) => !trackIds.has(t.id));
          const updated = [...currentTracks, ...toAdd];
          localStorage.setItem('trapparchive_tracks', JSON.stringify(updated));
          importedTracksCount = toAdd.length;
        }

        if (Array.isArray(parsed.albums)) {
          const currentAlbums: Album[] = JSON.parse(localStorage.getItem('trapparchive_albums') || '[]');
          const albumIds = new Set(currentAlbums.map(a => a.id));
          const toAdd = parsed.albums.filter((a: Album) => !albumIds.has(a.id));
          const updated = [...currentAlbums, ...toAdd];
          localStorage.setItem('trapparchive_albums', JSON.stringify(updated));
          importedAlbumsCount = toAdd.length;
        }

        setImportNotice(`Importazione completata con successo: +${importedTracksCount} tracce, +${importedAlbumsCount} album. Ricarica la pagina se necessario.`);
        
        // Trigger storage event so other tabs and App update
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Import error:', err);
        setImportNotice('Errore durante la lettura del file JSON. Assicurati che sia un backup valido di TrappArchive.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Download className="text-blue-500 shrink-0" />
          Export & Backup Center
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Scarica i backup del catalogo in formato JSON locale o sincronizza con Google Drive.
        </p>
      </div>

      {importNotice && (
        <div className="mb-6 p-4 bg-blue-950/40 border border-blue-500/40 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-blue-200 shrink-0">
          <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
          <span className="flex-1">{importNotice}</span>
          <button 
            onClick={() => setImportNotice(null)}
            className="text-xs text-blue-400 hover:text-white px-2 py-1 rounded bg-white/5"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Card 1: Full Database Backup & Google Drive */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black border border-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <Library className="text-blue-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-100">Backup Completo Catalogo</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Esporta {tracks.length} tracce, {albums.length} album e tutte le bozze in un unico file JSON.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <button 
              onClick={exportFullCatalog}
              className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 min-h-[44px]"
            >
              <Download size={18} />
              <span>Scarica JSON Completo</span>
            </button>

            {/* Hidden File Input for Import */}
            <input 
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border border-slate-800 min-h-[44px]"
            >
              <Upload size={18} className="text-purple-400" />
              <span>Importa Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Card 2: Download & Install App (PWA) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-blue-950/20 via-slate-900/40 to-indigo-950/20 border border-blue-900/40 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shrink-0">
          <div className="flex items-start gap-4 max-w-2xl">
            <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-blue-400 mt-1">
              <Download className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Scarica TrappArchive come Applicazione</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Sparkles size={11} />
                  PWA NATIVA
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Wifi size={11} />
                  100% OFFLINE
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Puoi installare TrappArchive direttamente su computer (Windows, Mac, Linux) o smartphone (iPhone, Android). L'app funziona autonomamente a schermo intero senza barre del browser e non dipende da server esterni: tutti i tuoi brani, testi e album rimangono al sicuro sul tuo dispositivo.
              </p>

              <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Laptop size={13} className="text-blue-400" /> Desktop Chrome / Edge
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Smartphone size={13} className="text-indigo-400" /> Android & Safari iOS
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <HardDrive size={13} className="text-emerald-400" /> Archiviazione locale istantanea
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            <PWAInstallButton className="w-full sm:w-auto text-sm py-3 px-6" />
          </div>
        </div>

        {/* Card 3: Albums List Export */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2 flex flex-col bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md min-h-[250px]">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
            <Disc size={16} className="text-blue-400" /> Esporta Singoli Album
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
            {albums.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs border border-slate-900 bg-black/20 rounded-xl">
                Nessun album presente da esportare.
              </div>
            ) : (
              albums.map(a => (
                <div 
                  key={a.id} 
                  className="bg-black/40 border border-slate-900 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors shadow-sm min-h-[48px]"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center border border-slate-800 shrink-0">
                      <Disc className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="truncate">
                      <h4 className="font-medium text-xs sm:text-sm text-slate-200 truncate">{a.title}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{a.trackIds.length} tracce • {a.year}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => exportAlbum(a)}
                    className="p-2.5 text-slate-400 hover:text-blue-400 bg-black border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Esporta Album JSON"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 4: Single Tracks Export */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1 flex flex-col bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md min-h-[250px]">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
            <Music2 size={16} className="text-purple-400" /> Esporta Singole Tracce
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {tracks.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs border border-slate-900 bg-black/20 rounded-xl">
                Nessuna traccia presente.
              </div>
            ) : (
              tracks.map(t => (
                <div 
                  key={t.id} 
                  className="flex items-center justify-between p-2.5 bg-black/40 border border-slate-900 rounded-xl hover:bg-white/[0.04] transition-colors shadow-sm min-h-[44px]"
                >
                  <div className="truncate pr-2">
                    <h4 className="font-medium text-xs text-slate-300 truncate">{t.title || 'Untitled'}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{t.mainArtist || 'Unknown'}</p>
                  </div>
                  <button 
                    onClick={() => exportTrack(t)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Esporta traccia"
                  >
                    <Download size={14} />
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
