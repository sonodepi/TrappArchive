import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Track } from '../types';

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Player({ currentTrack }: { currentTrack: Track | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack?.audioFilePath) {
      audio.src = currentTrack.audioFilePath;
      audio.load();
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    } else if (audio && !currentTrack) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 0.8);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    audio.currentTime = percent * duration;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-24 bg-[#03060d] border-t border-black flex items-center px-6 justify-between shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] relative z-20">
      <div className="w-1/3 flex items-center gap-4">
        {currentTrack ? (
          <>
            <div className="w-14 h-14 bg-black border border-slate-900 rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
              <span className="text-slate-600 text-[10px] uppercase font-bold">Cover</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{currentTrack.title || 'Untitled Track'}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{currentTrack.mainArtist || 'Unknown Artist'}</p>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-600 font-medium">No track selected</div>
        )}
      </div>
      
      <div className="flex flex-col items-center flex-1 max-w-xl">
        <div className="flex items-center gap-6 mb-2">
          <button onClick={handleSkipBack} className="text-slate-400 hover:text-slate-100 transition-colors"><SkipBack size={20} /></button>
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-slate-100 text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
          </button>
          <button className="text-slate-400 hover:text-slate-100 transition-colors"><SkipForward size={20} /></button>
        </div>
        <div className="w-full flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span>{formatTime(currentTime)}</span>
          <div onClick={handleProgressClick} className="flex-1 h-1.5 bg-black rounded-full overflow-hidden cursor-pointer group relative border border-slate-800">
            <div style={{ width: `${progressPercent}%` }} className="h-full bg-blue-600 group-hover:bg-blue-400 transition-colors relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md"></div>
            </div>
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="w-1/3 flex justify-end items-center gap-3">
        <button onClick={toggleMute} className="text-slate-400 hover:text-slate-100 transition-colors">
          {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input 
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-24 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
        />
      </div>
    </div>
  );
}
