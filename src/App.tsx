/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Track, Album, DraftProject } from './types';
import { Sidebar, BottomNav } from './components/Sidebar';
import { Player } from './components/Player';
import { Library } from './components/Library';
import { TrackEditor } from './components/TrackEditor';
import { WorkingOn } from './components/WorkingOn';
import { Albums } from './components/Albums';
import { ExportSection } from './components/ExportSection';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Settings } from './components/Settings';
import { useSettings } from './settings/store';
import { loadCatalog, migrateLegacyKeys, saveCatalog } from './storage/catalog';
import { deleteAudio, pruneOrphans } from './storage/audioStore';
import { AlertTriangle, Disc, Settings as SettingsIcon, X } from 'lucide-react';

// Le chiavi legacy vanno spostate prima della lettura, non in un effetto che
// gira dopo il primo render.
migrateLegacyKeys();

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('working-on');
  const { settings, update: updateSettings } = useSettings();

  /**
   * Il catalogo si carica una sola volta, in modo sincrono, come stato
   * iniziale. Prima veniva letto in un effetto mentre l'effetto di salvataggio
   * girava gia' con lo stato vuoto: c'era una finestra in cui localStorage
   * veniva sovrascritto con un array vuoto.
   */
  const [initial] = useState(loadCatalog);
  const [tracks, setTracks] = useState<Track[]>(initial.tracks);
  const [albums, setAlbums] = useState<Album[]>(initial.albums);
  const [drafts, setDrafts] = useState<DraftProject[]>(initial.drafts);

  /** Problemi di lettura o scrittura da mostrare all'utente, non da ingoiare. */
  const [storageNotice, setStorageNotice] = useState<string | null>(
    initial.problems.length > 0 ? initial.problems.map(p => p.message).join(' ') : null,
  );

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [draftToTrack, setDraftToTrack] = useState<DraftProject | null>(null);

  // Salvataggio: se fallisce, l'utente lo deve sapere subito. Il codice
  // precedente scriveva senza controllare l'esito.
  useEffect(() => {
    const outcome = saveCatalog(tracks, albums, drafts);
    if (!outcome.ok) setStorageNotice(outcome.message);
  }, [tracks, albums, drafts]);

  // Pulizia dei file audio rimasti senza traccia (una traccia cancellata in
  // un'altra scheda, un'operazione interrotta a meta').
  useEffect(() => {
    pruneOrphans(tracks.map(t => t.id)).catch(() => {
      // L'archivio puo' essere non disponibile: non e' un errore da mostrare,
      // la pulizia riprovera' al prossimo avvio.
    });
    // Volutamente solo al montaggio: e' una manutenzione, non una reazione
    // a ogni modifica del catalogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizzazione tra schede del browser.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.newValue === null) return;
      const fresh = loadCatalog();
      if (e.key === 'trapparchive_tracks') setTracks(fresh.tracks);
      if (e.key === 'trapparchive_albums') setAlbums(fresh.albums);
      if (e.key === 'trapparchive_drafts') setDrafts(fresh.drafts);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /**
   * Import di un backup. Passa dallo stato React, non da localStorage: e' il
   * punto in cui il codice precedente perdeva i dati, perche' scriveva
   * direttamente nell'archivio e il primo salvataggio successivo lo
   * sovrascriveva partendo dallo stato vecchio.
   */
  const handleImport = useCallback((incoming: {
    tracks: Track[];
    albums: Album[];
    drafts: DraftProject[];
  }) => {
    setTracks(prev => {
      const known = new Set(prev.map(t => t.id));
      return [...prev, ...incoming.tracks.filter(t => !known.has(t.id))];
    });
    setAlbums(prev => {
      const known = new Set(prev.map(a => a.id));
      return [...prev, ...incoming.albums.filter(a => !known.has(a.id))];
    });
    setDrafts(prev => {
      const known = new Set(prev.map(d => d.id));
      return [...prev, ...incoming.drafts.filter(d => !known.has(d.id))];
    });
  }, []);

  const handleSaveTrack = (newTrack: Track) => {
    // La durata arriva dalla decodifica reale del file. Se non c'e' resta 0 e la
    // libreria mostra "--:--": meglio un dato assente che uno inventato, come
    // faceva il precedente Math.random().
    const trackToSave: Track = {
      ...newTrack,
      createdAt: Date.now(),
    };
    setTracks(prev => [...prev, trackToSave]);
    setActiveTab('library');
  };

  const handleUpdateTrack = (updated: Track) => {
    setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingTrack(null);
    setActiveTab('library');
  };

  const handleDeleteTrack = (id: string) => {
    // Il file audio va rimosso con la traccia: senza questo l'archivio cresce
    // a ogni cancellazione e non si libera mai.
    deleteAudio(id).catch(() => {
      /* Un file gia' assente non e' un errore da mostrare. */
    });
    setTracks(prev => prev.filter(t => t.id !== id));
    setAlbums(prev => prev.map(a => ({
      ...a,
      trackIds: a.trackIds.filter(tid => tid !== id)
    })));
    if (currentTrack?.id === id) setCurrentTrack(null);
    if (editingTrack?.id === id) {
      setEditingTrack(null);
      setActiveTab('library');
    }
  };

  const handleSaveAlbum = (newAlbum: Album) => {
    setAlbums(prev => [...prev, newAlbum]);
  };

  const handleUpdateAlbum = (updated: Album) => {
    setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleDeleteAlbum = (id: string) => {
    setAlbums(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gradient-to-br from-[#060b19] to-black text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* Desktop & Tablet Sidebar (w-64 on desktop >=1024px, w-16 on tablet 768-1023px, hidden on mobile <768px) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 min-h-0 overflow-hidden">
        
        {/* Mobile-Only Top Brand & Install Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-[#03060d] border-b border-slate-900/80 shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
              <Disc className="text-white w-4 h-4 animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100">TrappArchive</h1>
              <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Audio Catalog</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label="Impostazioni"
              className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
              }`}
            >
              <SettingsIcon size={16} />
            </button>
            <PWAInstallButton compact />
          </div>
        </header>

        {/* Avviso di archiviazione: un problema sui dati non resta mai muto. */}
        {storageNotice && (
          <div className="mx-4 mt-3 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-100 shrink-0">
            <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
            <p className="flex-1">{storageNotice}</p>
            <button
              type="button"
              onClick={() => setStorageNotice(null)}
              aria-label="Chiudi avviso"
              className="p-1 text-amber-300/70 hover:text-amber-100 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Scrollable Workspace View Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0">
          {activeTab === 'working-on' && (
            <WorkingOn 
              drafts={drafts} 
              setDrafts={setDrafts} 
              onSendToTrack={(draft) => {
                setDraftToTrack(draft);
                setEditingTrack(null);
                setActiveTab('editor');
              }}
            />
          )}
          {activeTab === 'library' && (
            <Library 
              tracks={tracks} 
              onPlayTrack={(track) => setCurrentTrack(track)}
              onEditTrack={(track) => {
                setEditingTrack(track);
                setDraftToTrack(null);
                setActiveTab('editor');
              }}
              onDeleteTrack={handleDeleteTrack}
            />
          )}
          {activeTab === 'editor' && (
            <TrackEditor 
              onSave={handleSaveTrack}
              editTrack={editingTrack}
              initialDraft={draftToTrack}
              onUpdate={handleUpdateTrack}
              onDelete={handleDeleteTrack}
              settings={settings}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'albums' && (
            <Albums 
              albums={albums} 
              tracks={tracks} 
              onSaveAlbum={handleSaveAlbum}
              onUpdateAlbum={handleUpdateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
            />
          )}
          {activeTab === 'export' && (
            <ExportSection
              albums={albums}
              tracks={tracks}
              drafts={drafts}
              onImport={handleImport}
            />
          )}
          {activeTab === 'settings' && (
            <Settings settings={settings} onUpdate={updateSettings} />
          )}
        </div>

        {/* Player Component: 56px (h-14) on mobile above bottom-nav; 96px (h-24) on desktop */}
        <Player currentTrack={currentTrack} />

        {/* Mobile Bottom Navigation Bar (h-16 = 64px, visible only on mobile <768px) */}
        <BottomNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        {/* Offline Status Badge */}
        <OfflineIndicator />
      </main>
    </div>
  );
}
