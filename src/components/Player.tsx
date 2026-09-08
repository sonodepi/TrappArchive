import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, Disc, AlertTriangle } from 'lucide-react';
import { Track } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { useAudioUrl } from '../storage/audioAccess';

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

  // Mobile Expanded Player Modal Overlay
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  /**
   * L'URL viene ricostruito dai byte in archivio a ogni cambio di traccia.
   * Prima si riusava la stringa salvata nel catalogo, che dopo un
   * ricaricamento era un blob: URL morto.
   */
  const audioUrl = useAudioUrl(currentTrack);

  /**
   * Errore di riproduzione mostrato all'utente. Prima ogni fallimento finiva in
   * `.catch(console.error)`: si premeva play e non succedeva nulla, senza alcun
   * messaggio.
   */
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  /** Traduce il rifiuto di play() in qualcosa di azionabile. */
  const reportPlayFailure = (err: unknown) => {
    setIsPlaying(false);
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      setPlaybackError('Il browser ha bloccato la riproduzione automatica: premi di nuovo play.');
      return;
    }
    if (err instanceof DOMException && err.name === 'NotSupportedError') {
      setPlaybackError('Formato audio non supportato da questo browser.');
      return;
    }
    setPlaybackError('Riproduzione non riuscita.');
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    // Un file corrotto o un codec mancante non fanno rigettare play():
    // l'errore arriva solo da qui.
    const handleError = () => {
      setIsPlaying(false);
      setPlaybackError('Il file audio non puo\u2019 essere riprodotto: potrebbe essere danneggiato o in un formato non supportato.');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackError(null);
    setCurrentTime(0);

    if (audioUrl.status === 'ready') {
      audio.crossOrigin = 'anonymous';
      audio.src = audioUrl.url;
      audio.load();
      audio.play().then(() => setIsPlaying(true)).catch(reportPlayFailure);
      return;
    }

    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setIsPlaying(false);

    if (audioUrl.status === 'error') setPlaybackError(audioUrl.message);
  }, [audioUrl.status, audioUrl.status === 'ready' ? audioUrl.url : null]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setPlaybackError(null);
      audio.play().then(() => setIsPlaying(true)).catch(reportPlayFailure);
    }
  };

  const handleSkipBack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 0.8);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    audio.currentTime = percent * duration;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* ====================================================================== */}
      {/* AUDIO PLAYER BAR: Compact (h-14 = 56px) on Mobile, h-24 on Desktop/Tablet */}
      {/* On mobile sits above bottom-nav (bottom-16), never overlapping!        */}
      {/* ====================================================================== */}
      <footer 
        id="app-audio-player-bar"
        className="fixed md:relative bottom-16 md:bottom-auto left-0 right-0 h-14 md:h-24 bg-[#03060d] border-t border-slate-900/90 flex items-center px-3 sm:px-6 justify-between shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.6)] z-20 select-none"
      >
        {/* ========================================================= */}
        {/* MOBILE VIEW (< 768px): Strictly Single Row, 56px (h-14)    */}
        {/* Thumbnail, truncated title, and ONLY play/pause button.   */}
        {/* No volume, no progress bar. Touch target >= 44px.         */}
        {/* ========================================================= */}
        <div 
          className="flex md:hidden items-center justify-between w-full h-full cursor-pointer py-1"
          onClick={() => {
            if (currentTrack) setIsMobileExpanded(true);
          }}
        >
          {/* Mini Track Info & Artwork */}
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <Disc className={`w-5 h-5 ${isPlaying ? 'text-blue-400 animate-[spin_4s_linear_infinite]' : 'text-slate-500'}`} />
            </div>
            <div className="min-w-0 flex-1 truncate">
              <h4 className="text-xs font-semibold text-slate-100 truncate">
                {currentTrack ? (currentTrack.title || 'Untitled') : 'Nessuna traccia'}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">
                {currentTrack ? (currentTrack.mainArtist || 'Artista sconosciuto') : 'Seleziona dalla libreria'}
              </p>
            </div>
          </div>

          {/* ONLY Play/Pause Button on Mobile (< 768px) */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={togglePlay} 
              disabled={audioUrl.status !== 'ready'}
              aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
              title={audioUrl.status === 'ready' ? undefined : 'Nessun file audio riproducibile'}
              className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-slate-100 text-black flex items-center justify-center hover:bg-white active:scale-95 transition-transform shadow-md disabled:opacity-30"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TABLET / DESKTOP VIEW (≥ 768px): 3-Column Standard Layout */}
        {/* ========================================================= */}
        <div className="hidden md:flex items-center justify-between w-full h-full gap-4">
          
          {/* Column 1: Info */}
          <div className="w-1/3 flex items-center gap-3.5 min-w-0">
            {currentTrack ? (
              <>
                <div className="w-13 h-13 bg-black border border-slate-900 rounded-xl flex items-center justify-center overflow-hidden shadow-inner relative group shrink-0">
                  <Disc className={`w-7 h-7 ${isPlaying ? 'text-blue-400 animate-[spin_6s_linear_infinite]' : 'text-slate-600'}`} />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-blue-950/40 flex items-end justify-center gap-0.5 pb-2 pointer-events-none">
                      <span className="w-1 h-3 bg-blue-400 animate-pulse rounded-full" />
                      <span className="w-1 h-5 bg-sky-300 animate-pulse rounded-full [animation-delay:150ms]" />
                      <span className="w-1 h-2 bg-blue-500 animate-pulse rounded-full [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-sm font-semibold text-slate-100 truncate">{currentTrack.title || 'Untitled'}</h4>
                  {playbackError ? (
                    <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1.5 truncate" title={playbackError}>
                      <AlertTriangle size={11} className="shrink-0" />
                      <span className="truncate">{playbackError}</span>
                    </p>
                  ) : audioUrl.status === 'loading' ? (
                    <p className="text-xs text-slate-500 mt-0.5">Caricamento del file&hellip;</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{currentTrack.mainArtist || 'Unknown Artist'}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 font-medium italic">Nessuna traccia in riproduzione</div>
            )}
          </div>
          
          {/* Column 2: Controls & Progress */}
          <div className="flex flex-col items-center flex-1 max-w-xl px-4">
            <div className="flex items-center gap-5 mb-1.5">
              <button 
                onClick={handleSkipBack} 
                className="text-slate-400 hover:text-slate-100 transition-colors p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Riavvia traccia"
              >
                <SkipBack size={18} />
              </button>
              <button 
                onClick={togglePlay} 
                disabled={audioUrl.status !== 'ready'}
                title={
                  audioUrl.status === 'ready'
                    ? (isPlaying ? 'Pausa' : 'Riproduci')
                    : audioUrl.status === 'loading'
                      ? 'Caricamento del file audio'
                      : 'Nessun file audio riproducibile per questa traccia'
                }
                className="w-10 h-10 rounded-full bg-slate-100 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-30 min-h-[40px] min-w-[40px]"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <button 
                onClick={handleSkipBack} 
                className="text-slate-400 hover:text-slate-100 transition-colors p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Ricomincia"
              >
                <SkipForward size={18} />
              </button>
            </div>
            <div className="w-full flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span className="w-9 text-right">{formatTime(currentTime)}</span>
              <div 
                onClick={handleProgressClick} 
                className="flex-1 h-1.5 bg-black rounded-full overflow-hidden cursor-pointer group relative border border-slate-800"
              >
                <div style={{ width: `${progressPercent}%` }} className="h-full bg-blue-600 group-hover:bg-blue-400 transition-colors relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md"></div>
                </div>
              </div>
              <span className="w-9 text-left">{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Column 3: Visualizer Dock + Volume Slider */}
          <div className="w-1/3 flex justify-end items-center gap-4 shrink-0">
            {/* Real-time Canvas Audio Visualizer */}
            <AudioVisualizer
              isPlaying={isPlaying}
              volume={volume}
              currentTime={currentTime}
              audioRef={audioRef}
              trackTitle={currentTrack?.title}
              artist={currentTrack?.mainArtist}
            />

            <div className="flex items-center gap-2 border-l border-slate-800/80 pl-3">
              <button 
                onClick={toggleMute} 
                className="text-slate-400 hover:text-slate-100 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center" 
                title={volume === 0 ? "Riattiva audio" : "Muto"}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 lg:w-24 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* MOBILE EXPANDED FULL-SCREEN PLAYER MODAL (< 768px)        */}
      {/* ========================================================= */}
      {isMobileExpanded && (
        <div 
          id="mobile-player-expanded-overlay"
          className="md:hidden fixed inset-0 z-50 bg-[#060b19] flex flex-col justify-between p-6 animate-in slide-in-from-bottom duration-300 select-none overflow-y-auto"
        >
          {/* Top Bar with Dismiss */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-900/80">
            <button 
              onClick={() => setIsMobileExpanded(false)}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronDown size={24} />
            </button>
            <div className="text-center truncate px-2">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">TrappArchive Player</span>
              <p className="text-xs font-semibold text-slate-300 truncate max-w-[200px]">
                {currentTrack?.title || 'Traccia'}
              </p>
            </div>
            <div className="w-10" />
          </div>

          {/* Center Cover Art & Visualizer */}
          <div className="my-auto py-6 flex flex-col items-center">
            <div className="w-52 h-52 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden mb-6">
              <Disc className={`w-28 h-28 ${isPlaying ? 'text-blue-400 animate-[spin_8s_linear_infinite]' : 'text-slate-700'}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>

            {/* Mobile Visualizer In-Overlay */}
            <div className="w-full max-w-xs flex justify-center mb-4">
              <AudioVisualizer
                isPlaying={isPlaying}
                volume={volume}
                currentTime={currentTime}
                audioRef={audioRef}
                trackTitle={currentTrack?.title}
                artist={currentTrack?.mainArtist}
              />
            </div>

            {/* Title & Artist */}
            <div className="text-center px-4 w-full">
              <h3 className="text-xl font-bold text-slate-100 truncate">
                {currentTrack?.title || 'Nessuna Traccia'}
              </h3>
              <p className="text-sm text-slate-400 mt-1 truncate">
                {currentTrack?.mainArtist || 'Artista Sconosciuto'}
              </p>
              {currentTrack?.producer && (
                <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
                  Prod. {currentTrack.producer}
                </p>
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-6 pt-2">
            {/* Seek Bar */}
            <div className="space-y-1.5">
              <div 
                onClick={handleProgressClick}
                className="w-full h-2 bg-slate-900 rounded-full cursor-pointer relative overflow-hidden border border-slate-800 min-h-[16px] flex items-center"
              >
                <div 
                  style={{ width: `${progressPercent}%` }} 
                  className="h-2 bg-blue-500 relative rounded-full"
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {playbackError && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-100">
                <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                <span>{playbackError}</span>
              </div>
            )}

            {/* Playback Action Buttons (touch target >= 44px) */}
            <div className="flex items-center justify-center gap-8 py-2">
              <button 
                onClick={handleSkipBack} 
                className="p-3 text-slate-300 hover:text-white transition-transform active:scale-90 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <SkipBack size={28} />
              </button>
              <button 
                onClick={togglePlay}
                disabled={audioUrl.status !== 'ready'}
                className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 active:scale-95 transition-all shadow-[0_0_25px_rgba(37,99,235,0.5)] border border-blue-400 min-h-[44px]"
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
              </button>
              <button 
                onClick={handleSkipBack} 
                className="p-3 text-slate-300 hover:text-white transition-transform active:scale-90 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <SkipForward size={28} />
              </button>
            </div>

            {/* Volume Control In-Overlay */}
            <div className="flex items-center gap-4 bg-black/40 border border-slate-900 px-4 py-3 rounded-xl min-h-[44px]">
              <button onClick={toggleMute} className="text-slate-400 hover:text-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center">
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs font-mono text-slate-400 w-9 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
