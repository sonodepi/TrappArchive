/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Track, Album, WorkspaceState } from './types';
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
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    lyricsDraft: '',
    beatUrl: ''
  });
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedTracks = localStorage.getItem('trackstudio_tracks');
    const savedAlbums = localStorage.getItem('trackstudio_albums');
    const savedWorkspace = localStorage.getItem('trackstudio_workspace');

    if (savedTracks) setTracks(JSON.parse(savedTracks));
    if (savedAlbums) setAlbums(JSON.parse(savedAlbums));
    if (savedWorkspace) setWorkspace(JSON.parse(savedWorkspace));
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('trackstudio_tracks', JSON.stringify(tracks));
    localStorage.setItem('trackstudio_albums', JSON.stringify(albums));
    localStorage.setItem('trackstudio_workspace', JSON.stringify(workspace));
  }, [tracks, albums, workspace]);

  const handleSaveTrack = (newTrack: Track) => {
    const trackToSave = {
      ...newTrack,
      createdAt: Date.now(),
      durationMs: Math.floor(Math.random() * 180000) + 120000 // Mock duration 2-5 mins
    };
    setTracks(prev => [...prev, trackToSave]);
    setActiveTab('library');
  };

  const handleSaveAlbum = (newAlbum: Album) => {
    setAlbums(prev => [...prev, newAlbum]);
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
            <WorkingOn workspace={workspace} setWorkspace={setWorkspace} />
          )}
          {activeTab === 'library' && (
            <Library tracks={tracks} onPlay={setCurrentTrack} />
          )}
          {activeTab === 'editor' && (
            <TrackEditor onSave={handleSaveTrack} />
          )}
          {activeTab === 'albums' && (
            <Albums albums={albums} tracks={tracks} onSaveAlbum={handleSaveAlbum} />
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
