/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { Disc, Settings as SettingsIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('working-on');
  const { settings, update: updateSettings } = useSettings();
  
  // App State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [drafts, setDrafts] = useState<DraftProject[]>([]);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [draftToTrack, setDraftToTrack] = useState<DraftProject | null>(null);

  // One-time Migration from trackstudio_ to trapparchive_ keys
  useEffect(() => {
    try {
      const isMigrated = localStorage.getItem('trapparchive_migrated');
      if (isMigrated !== 'true') {
        const oldTracks = localStorage.getItem('trackstudio_tracks');
        const oldAlbums = localStorage.getItem('trackstudio_albums');
        const oldDrafts = localStorage.getItem('trackstudio_drafts');

        if (oldTracks && !localStorage.getItem('trapparchive_tracks')) {
          localStorage.setItem('trapparchive_tracks', oldTracks);
        }
        if (oldAlbums && !localStorage.getItem('trapparchive_albums')) {
          localStorage.setItem('trapparchive_albums', oldAlbums);
        }
        if (oldDrafts && !localStorage.getItem('trapparchive_drafts')) {
          localStorage.setItem('trapparchive_drafts', oldDrafts);
        }

        // Clean up legacy keys
        localStorage.removeItem('trackstudio_tracks');
        localStorage.removeItem('trackstudio_albums');
        localStorage.removeItem('trackstudio_drafts');
        localStorage.setItem('trapparchive_migrated', 'true');
      }
    } catch (e) {
      console.warn('Migration warning:', e);
    }
  }, []);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedTracks = localStorage.getItem('trapparchive_tracks');
    const savedAlbums = localStorage.getItem('trapparchive_albums');
    const savedDrafts = localStorage.getItem('trapparchive_drafts');

    if (savedTracks) {
      try { setTracks(JSON.parse(savedTracks)); } catch {}
    }
    if (savedAlbums) {
      try { setAlbums(JSON.parse(savedAlbums)); } catch {}
    }
    if (savedDrafts) {
      try { setDrafts(JSON.parse(savedDrafts)); } catch {}
    }
  }, []);

  // Save to LocalStorage on change (Offline First Persistence)
  useEffect(() => {
    localStorage.setItem('trapparchive_tracks', JSON.stringify(tracks));
    localStorage.setItem('trapparchive_albums', JSON.stringify(albums));
    localStorage.setItem('trapparchive_drafts', JSON.stringify(drafts));
  }, [tracks, albums, drafts]);

  // Sync across browser tabs via StorageEvent
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'trapparchive_drafts' && e.newValue) {
        try { setDrafts(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'trapparchive_tracks' && e.newValue) {
        try { setTracks(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'trapparchive_albums' && e.newValue) {
        try { setAlbums(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
