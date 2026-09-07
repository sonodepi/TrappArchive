import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, BarChart2, Waves, Maximize2, X, Volume2, Sparkles, Sliders } from 'lucide-react';

export type VisualizerMode = 'bars' | 'wave' | 'mirror';

interface AudioVisualizerProps {
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  trackTitle?: string;
  artist?: string;
}

export function AudioVisualizer({
  isPlaying,
  volume,
  currentTime,
  audioRef,
  trackTitle = 'Track',
  artist = 'Unknown Artist',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<VisualizerMode>('bars');
  const [isExpanded, setIsExpanded] = useState(false);
  const [colorTheme, setColorTheme] = useState<'cyan' | 'amber' | 'purple' | 'emerald'>('cyan');

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const isWebAudioConnected = useRef(false);

  // Animation & audio state refs
  const animationFrameId = useRef<number | null>(null);
  const modalAnimationFrameId = useRef<number | null>(null);
  const barsDataRef = useRef<number[]>(new Array(32).fill(0));
  const peaksDataRef = useRef<number[]>(new Array(32).fill(0));
  const peakHoldsRef = useRef<number[]>(new Array(32).fill(0));

  // Initialize Web Audio API on user gesture or play
  const initWebAudio = useCallback(() => {
    if (isWebAudioConnected.current || !audioRef?.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      if (!analyserRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128; // 64 frequency bins, lightweight & punchy
        analyser.smoothingTimeConstant = 0.78;
        analyserRef.current = analyser;
      }

      if (!sourceNodeRef.current && audioRef.current) {
        // Try connecting media element
        try {
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          sourceNodeRef.current = source;
          isWebAudioConnected.current = true;
        } catch (e) {
          // If already connected or restricted by CORS, gracefully continue
          console.debug('MediaElementSource initialization notice:', e);
        }
      }
    } catch (err) {
      console.debug('Web Audio API unavailable, utilizing harmonic synthesis fallback:', err);
    }
  }, [audioRef]);

  useEffect(() => {
    if (isPlaying) {
      initWebAudio();
    }
  }, [isPlaying, initWebAudio]);

  // Color schemes for professional studio look
  const getThemeGradients = useCallback((ctx: CanvasRenderingContext2D, height: number, theme: string) => {
    const grad = ctx.createLinearGradient(0, height, 0, 0);
    if (theme === 'amber') {
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, '#fef08a');
      return { grad, peak: '#fde047', glow: 'rgba(245, 158, 11, 0.4)' };
    }
    if (theme === 'purple') {
      grad.addColorStop(0, '#4c1d95');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#f3e8ff');
      return { grad, peak: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)' };
    }
    if (theme === 'emerald') {
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(0.5, '#10b981');
      grad.addColorStop(1, '#a7f3d0');
      return { grad, peak: '#34d399', glow: 'rgba(16, 185, 129, 0.4)' };
    }
    // Default Cyan / Electric Blue
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(0.4, '#2563eb');
    grad.addColorStop(0.8, '#38bdf8');
    grad.addColorStop(1, '#e0f2fe');
    return { grad, peak: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.45)' };
  }, []);

  // Core Render Routine for a given canvas
  const renderFrame = useCallback((
    canvas: HTMLCanvasElement,
    numBars: number,
    renderMode: VisualizerMode,
    theme: string,
    showGrid: boolean = false
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Compute raw audio frequency data
    const freqData = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 64);
    let hasRealAudio = false;

    if (analyserRef.current && isPlaying) {
      analyserRef.current.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) sum += freqData[i];
      if (sum > 50) hasRealAudio = true;
    }

    const now = performance.now() * 0.001;
    const beatTempo = 125 / 60; // 125 BPM tempo
    const kick = Math.pow(Math.max(0, Math.sin(now * Math.PI * 2 * beatTempo)), 4);
    const effectiveVolume = isPlaying ? volume : 0;

    // Draw background grid if expanded studio mode
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;

      // Horizontal dB lines
      const dbLines = [0.2, 0.4, 0.6, 0.8];
      dbLines.forEach((frac) => {
        const y = Math.round(height * (1 - frac));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });

      // Vertical octave lines
      for (let x = width / 6; x < width; x += width / 6) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x), 0);
        ctx.lineTo(Math.round(x), height);
        ctx.stroke();
      }
    }

    const { grad, peak: peakColor, glow } = getThemeGradients(ctx, height, theme);

    // Update bar target values
    const currentBars = barsDataRef.current;
    if (currentBars.length !== numBars) {
      barsDataRef.current = new Array(numBars).fill(0);
      peaksDataRef.current = new Array(numBars).fill(0);
      peakHoldsRef.current = new Array(numBars).fill(0);
    }

    let isStillActive = false;

    for (let i = 0; i < numBars; i++) {
      let target = 0;

      if (hasRealAudio) {
        const binIndex = Math.min(
          Math.floor((i / numBars) * freqData.length),
          freqData.length - 1
        );
        target = (freqData[binIndex] / 255) * effectiveVolume;
      } else if (isPlaying) {
        // High-precision organic musical procedural simulation
        const normIndex = i / numBars;
        // Sub-bass resonance (low bands)
        const subBass = Math.exp(-normIndex * 6) * kick * 0.95;
        // Melodic mid-frequency rolling harmonics
        const midWave = Math.sin(now * 3.5 + normIndex * 8) * 0.3 + 0.35;
        // High frequency transient sparkle
        const highSizzle = Math.sin(now * 12 + normIndex * 24) * 0.15 + (Math.random() * 0.08);
        // Combine with frequency curve tilt
        const curve = 1 - Math.pow(normIndex, 0.7) * 0.6;

        target = Math.max(0.04, (subBass + midWave * 0.6 + highSizzle * 0.4) * curve * effectiveVolume);
      } else {
        target = 0; // decay to 0 when paused
      }

      // Smooth interpolation (lerp / gravity)
      const current = barsDataRef.current[i] || 0;
      if (target > current) {
        barsDataRef.current[i] = current * 0.4 + target * 0.6; // fast rise
      } else {
        barsDataRef.current[i] = current * 0.82 + target * 0.18; // smooth decay
      }

      if (barsDataRef.current[i] > 0.005) {
        isStillActive = true;
      }

      // Peak hold logic
      const val = barsDataRef.current[i];
      if (val >= (peaksDataRef.current[i] || 0)) {
        peaksDataRef.current[i] = val;
        peakHoldsRef.current[i] = 16; // hold for 16 frames
      } else {
        if (peakHoldsRef.current[i] > 0) {
          peakHoldsRef.current[i]--;
        } else {
          peaksDataRef.current[i] = Math.max(0, (peaksDataRef.current[i] || 0) - 0.015);
        }
      }
    }

    // DRAWING: Mode 1 - Spectrum Bars
    if (renderMode === 'bars') {
      const gap = Math.max(1.5, Math.floor(width / (numBars * 6)));
      const barWidth = Math.max(2, (width - (numBars - 1) * gap) / numBars);

      for (let i = 0; i < numBars; i++) {
        const x = Math.round(i * (barWidth + gap));
        const barHeight = Math.max(2, Math.round(barsDataRef.current[i] * (height - 4)));
        const y = Math.round(height - barHeight);

        // Draw bar with gradient
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        // Draw floating peak cap
        const peakVal = peaksDataRef.current[i] || 0;
        if (peakVal > 0.03) {
          const peakY = Math.max(1, Math.round(height - (peakVal * (height - 4)) - 2));
          ctx.fillStyle = peakColor;
          ctx.fillRect(x, peakY, barWidth, 2);
        }
      }
    }

    // DRAWING: Mode 2 - Waveform Oscilloscope
    else if (renderMode === 'wave') {
      ctx.save();
      ctx.beginPath();
      const step = width / (numBars - 1);

      ctx.moveTo(0, height / 2);
      for (let i = 0; i < numBars; i++) {
        const x = i * step;
        const norm = (barsDataRef.current[i] || 0);
        const waveOffset = Math.sin((i / numBars) * Math.PI * 4 + now * 6) * norm * (height * 0.4);
        const y = height / 2 - waveOffset;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = (i - 1) * step;
          const prevNorm = (barsDataRef.current[i - 1] || 0);
          const prevY = height / 2 - (Math.sin(((i - 1) / numBars) * Math.PI * 4 + now * 6) * prevNorm * (height * 0.4));
          const midX = (prevX + x) / 2;
          const midY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }
      }

      ctx.strokeStyle = peakColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Subtle filled gradient underneath wave
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fill();
      ctx.restore();
    }

    // DRAWING: Mode 3 - Mirrored Stereo EQ
    else if (renderMode === 'mirror') {
      const gap = Math.max(1.5, Math.floor(width / (numBars * 6)));
      const barWidth = Math.max(2, (width - (numBars - 1) * gap) / numBars);
      const centerY = height / 2;

      for (let i = 0; i < numBars; i++) {
        const x = Math.round(i * (barWidth + gap));
        const halfHeight = Math.max(1, Math.round((barsDataRef.current[i] * (centerY - 3))));

        ctx.fillStyle = grad;
        // Upper bar
        ctx.fillRect(x, centerY - halfHeight, barWidth, halfHeight);
        // Lower mirror bar
        ctx.fillRect(x, centerY, barWidth, halfHeight);

        // Dual Peak Caps
        const peakVal = peaksDataRef.current[i] || 0;
        if (peakVal > 0.04) {
          const peakHalf = Math.round(peakVal * (centerY - 3));
          ctx.fillStyle = peakColor;
          ctx.fillRect(x, centerY - peakHalf - 1, barWidth, 1.5);
          ctx.fillRect(x, centerY + peakHalf, barWidth, 1.5);
        }
      }
    }

    return isStillActive;
  }, [isPlaying, volume, getThemeGradients]);

  // Main embedded canvas animation loop
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      if (canvasRef.current) {
        const isDrawing = renderFrame(canvasRef.current, 28, mode, colorTheme, false);
        // If not playing and reached 0 rest, idle loop sleeps to save 100% CPU
        if (!isPlaying && !isDrawing) {
          return;
        }
      }
      animationFrameId.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      active = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, mode, colorTheme, renderFrame]);

  // Expanded modal canvas animation loop
  useEffect(() => {
    if (!isExpanded) return;
    let active = true;

    const modalLoop = () => {
      if (!active) return;
      if (modalCanvasRef.current) {
        renderFrame(modalCanvasRef.current, 48, mode, colorTheme, true);
      }
      modalAnimationFrameId.current = requestAnimationFrame(modalLoop);
    };

    modalLoop();

    return () => {
      active = false;
      if (modalAnimationFrameId.current) {
        cancelAnimationFrame(modalAnimationFrameId.current);
      }
    };
  }, [isExpanded, mode, colorTheme, renderFrame]);

  // Handle Resize for Embedded Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDPI = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(140, Math.floor(rect.width * dpr));
      canvas.height = Math.max(34, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    updateDPI();
    window.addEventListener('resize', updateDPI);
    return () => window.removeEventListener('resize', updateDPI);
  }, []);

  const cycleMode = () => {
    const modes: VisualizerMode[] = ['bars', 'wave', 'mirror'];
    const nextIndex = (modes.indexOf(mode) + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  return (
    <>
      {/* Compact Studio Player Visualizer Dock */}
      <div 
        id="player-audio-visualizer-dock"
        className="flex items-center gap-2.5 bg-black/50 border border-slate-800/90 rounded-xl px-3 py-1.5 shadow-[inset_0_1px_8px_rgba(0,0,0,0.6)] backdrop-blur-sm group hover:border-slate-700 transition-colors"
      >
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                isPlaying 
                  ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)] animate-pulse' 
                  : 'bg-slate-600'
              }`}
            />
            <span className="text-[9px] font-mono tracking-widest uppercase font-bold text-slate-400">
              {mode.toUpperCase()}
            </span>
          </div>
          <span className="text-[8px] font-mono text-slate-500">
            {isPlaying ? '20Hz-20kHz' : 'PAUSED'}
          </span>
        </div>

        {/* Canvas Visualizer Display */}
        <div 
          onClick={cycleMode}
          title={`Click to switch visualizer mode (Current: ${mode})`}
          className="relative w-36 sm:w-44 h-9 bg-black/80 rounded-lg border border-slate-900 overflow-hidden cursor-pointer shadow-inner flex items-center justify-center hover:border-blue-500/40 transition-colors"
        >
          <canvas 
            ref={canvasRef} 
            className="w-full h-full block pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          />
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
              <span className="text-[9px] font-mono text-slate-600 tracking-wider">CLICK TO SWITCH</span>
            </div>
          )}
        </div>

        {/* Visualizer Mode & Expand Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={cycleMode}
            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded transition-colors"
            title={`Mode: ${mode} (click to toggle)`}
          >
            {mode === 'bars' && <BarChart2 size={14} />}
            {mode === 'wave' && <Waves size={14} />}
            {mode === 'mirror' && <Activity size={14} />}
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded transition-colors"
            title="Expand Studio Mastering Spectrum"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Studio Spectrum Analyzer Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            id="studio-mastering-spectrum-modal"
            className="w-full max-w-4xl bg-[#070d1e] border border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    Studio Spectrum Analyzer & Visualizer
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono font-medium">
                      MASTERING GRADE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {trackTitle} • {artist}
                  </p>
                </div>
              </div>

              {/* Mode & Theme Selectors */}
              <div className="flex items-center gap-3">
                {/* Visualizer Mode Pills */}
                <div className="flex items-center bg-black/50 border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setMode('bars')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                      mode === 'bars' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BarChart2 size={13} /> Bars
                  </button>
                  <button
                    onClick={() => setMode('wave')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                      mode === 'wave' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Waves size={13} /> Wave
                  </button>
                  <button
                    onClick={() => setMode('mirror')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                      mode === 'mirror' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Activity size={13} /> Mirror
                  </button>
                </div>

                {/* Color Scheme Picker */}
                <div className="flex items-center gap-1.5 bg-black/50 border border-slate-800 rounded-lg px-2 py-1">
                  {(['cyan', 'amber', 'purple', 'emerald'] as const).map((th) => (
                    <button
                      key={th}
                      onClick={() => setColorTheme(th)}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        th === 'cyan' ? 'bg-sky-400' :
                        th === 'amber' ? 'bg-amber-400' :
                        th === 'purple' ? 'bg-purple-400' : 'bg-emerald-400'
                      } ${colorTheme === th ? 'scale-125 ring-2 ring-white/60' : 'opacity-60 hover:opacity-100'}`}
                      title={`${th.toUpperCase()} Palette`}
                    />
                  ))}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Canvas Stage */}
            <div className="p-6 flex flex-col gap-4 bg-gradient-to-b from-[#060a16] to-[#020409]">
              <div className="relative w-full h-64 bg-black/90 rounded-xl border border-slate-800/80 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col justify-between p-2">
                <canvas
                  ref={(el) => {
                    modalCanvasRef.current = el;
                    if (el) {
                      el.width = 800;
                      el.height = 240;
                    }
                  }}
                  className="w-full h-full block"
                  width={800}
                  height={240}
                />
                
                {/* dB Scale indicators overlay */}
                <div className="absolute left-3 top-3 bottom-3 flex flex-col justify-between text-[9px] font-mono text-slate-600 pointer-events-none select-none">
                  <span>0 dB</span>
                  <span>-6 dB</span>
                  <span>-18 dB</span>
                  <span>-36 dB</span>
                </div>
              </div>

              {/* Frequency Bands Legend */}
              <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-mono font-medium">
                <div className="bg-black/40 border border-slate-800/80 rounded-lg py-1.5 px-2">
                  <span className="text-slate-400">SUB-BASS</span>
                  <div className="text-slate-500 text-[9px]">20 - 60 Hz</div>
                </div>
                <div className="bg-black/40 border border-slate-800/80 rounded-lg py-1.5 px-2">
                  <span className="text-slate-400">BASS</span>
                  <div className="text-slate-500 text-[9px]">60 - 250 Hz</div>
                </div>
                <div className="bg-black/40 border border-slate-800/80 rounded-lg py-1.5 px-2">
                  <span className="text-slate-400">LOW MIDS</span>
                  <div className="text-slate-500 text-[9px]">250 - 1 kHz</div>
                </div>
                <div className="bg-black/40 border border-slate-800/80 rounded-lg py-1.5 px-2">
                  <span className="text-slate-400">HIGH MIDS</span>
                  <div className="text-slate-500 text-[9px]">1k - 4 kHz</div>
                </div>
                <div className="bg-black/40 border border-slate-800/80 rounded-lg py-1.5 px-2">
                  <span className="text-slate-400">PRESENCE / AIR</span>
                  <div className="text-slate-500 text-[9px]">4k - 20 kHz</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-black/50 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {isPlaying ? 'ENGINE ACTIVE • 60 FPS' : 'STANDBY'}
                </span>
                <span>•</span>
                <span className="font-mono">VOL: {Math.round(volume * 100)}%</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg transition-colors font-medium text-xs"
              >
                Close Spectrum
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
