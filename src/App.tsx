/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Track, Album, DraftProject } from './types';
import { Sidebar } from './components/Sidebar';
import { Player } from './components/Player';
import { Library } from './components/Library';
import { TrackEditor } from './components/TrackEditor';
import { WorkingOn } from './components/WorkingOn';
import { Albums } from './components/Albums';
import { ExportSection } from './components/ExportSection';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('working-on');
  
  // App State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [drafts, setDrafts] = useState<DraftProject[]>([]);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [draftToTrack, setDraftToTrack] = useState<DraftProject | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedTracks = localStorage.getItem('trackstudio_tracks');
    const savedAlbums = localStorage.getItem('trackstudio_albums');
    const savedDrafts = localStorage.getItem('trackstudio_drafts');

    if (savedTracks) setTracks(JSON.parse(savedTracks));
    if (savedAlbums) setAlbums(JSON.parse(savedAlbums));
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts));
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('trackstudio_tracks', JSON.stringify(tracks));
    localStorage.setItem('trackstudio_albums', JSON.stringify(albums));
    localStorage.setItem('trackstudio_drafts', JSON.stringify(drafts));
  }, [tracks, albums, drafts]);

  // Sync across tabs for multi-window Cowork simulation
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'trackstudio_drafts' && e.newValue) setDrafts(JSON.parse(e.newValue));
      if (e.key === 'trackstudio_tracks' && e.newValue) setTracks(JSON.parse(e.newValue));
      if (e.key === 'trackstudio_albums' && e.newValue) setAlbums(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSaveTrack = (newTrack: Track) => {
    const trackToSave = {
      ...newTrack,
      createdAt: Date.now(),
      durationMs: Math.floor(Math.random() * 180000) + 120000 // Mock duration 2-5 mins
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
    <div className="flex h-screen bg-gradient-to-br from-[#060b19] to-black text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <main className="flex-1 flex flex-col relative min-w-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
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
              onPlay={setCurrentTrack} 
              onEdit={(t) => {
                setEditingTrack(t);
                setActiveTab('editor');
              }}
              onDelete={handleDeleteTrack}
            />
          )}
          {activeTab === 'editor' && (
            <TrackEditor 
              onSave={(t) => {
                handleSaveTrack(t);
                setDraftToTrack(null);
              }}
              editTrack={editingTrack}
              initialDraft={draftToTrack}
              onUpdate={handleUpdateTrack}
              onDelete={handleDeleteTrack}
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
            <ExportSection albums={albums} tracks={tracks} />
          )}
        </div>
        <Player currentTrack={currentTrack} />
      </main>

    </div>
  );
}
