import React, { useState, useEffect, useRef } from 'react';
import { Track, DraftProject } from '../types';
import { 
  Save, Folder, Mic, AlertCircle, Plus, Minus, Trash2, 
  Sparkles, ExternalLink, Activity, Music2, X, RefreshCw, CheckCircle2 
} from 'lucide-react';
import { autoDetectTunebatData, getTunebatSearchUrl, scrapeTunebatUrl } from '../utils/tunebat';

export function TrackEditor({ 
  onSave, 
  editTrack, 
  initialDraft,
  onUpdate, 
  onDelete 
}: { 
  onSave: (t: Track) => void,
  editTrack?: Track | null,
  initialDraft?: DraftProject | null,
  onUpdate?: (t: Track) => void,
  onDelete?: (id: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const defaultTrack: Track = {
    id: crypto.randomUUID(),
    title: '',
    producer: '',
    mainArtist: '',
    featurings: [],
    lyrics: '',
    audioFilePath: '',
    durationMs: 0,
    createdAt: Date.now(),
    bpm: 140,
    key: 'C Minor'
  };

  const [track, setTrack] = useState<Track>(defaultTrack);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [tunebatNotice, setTunebatNotice] = useState<string | null>(null);
  const [tunebatInput, setTunebatInput] = useState<string>('');

  useEffect(() => {
    if (editTrack) {
      setTrack({
        ...defaultTrack,
        ...editTrack,
        bpm: editTrack.bpm || 140,
        key: editTrack.key || 'C Minor'
      });
    } else if (initialDraft) {
      const draftTrack: Track = {
        ...defaultTrack,
        id: crypto.randomUUID(),
        title: initialDraft.title !== 'Untitled Draft' ? initialDraft.title : '',
        lyrics: initialDraft.lyrics,
        audioFilePath: initialDraft.beatUrl,
        bpm: initialDraft.bpm || 140,
        key: initialDraft.key || 'C Minor'
      };
      setTrack(draftTrack);
    } else {
      setTrack({ ...defaultTrack, id: crypto.randomUUID() });
    }
  }, [editTrack, initialDraft]);

  const handleScrapeTunebat = async () => {
    if (!tunebatInput) return;
    setIsAnalyzingAudio(true);
    setTunebatNotice(null);
    try {
      const result = await scrapeTunebatUrl(tunebatInput);
      if (result) {
        setTrack(prev => ({
          ...prev,
          bpm: result.bpm || prev.bpm,
          key: result.key || prev.key
        }));
        setTunebatNotice(
          `Tunebat estratto: ${result.bpm || track.bpm} BPM • ${result.key || track.key}`
        );
      } else {
        setTunebatNotice('Impossibile estrarre i dati da questo link Tunebat.');
      }
    } catch (err) {
      console.error('Tunebat scrape error:', err);
      setTunebatNotice('Errore durante l\'estrazione da Tunebat.');
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // Tunebat auto-fill function
  const triggerTunebatAutoFill = async (
    title: string, 
    artist: string, 
    audioUrl?: string, 
    file?: File
  ) => {
    if (!file) return; // Only run auto-detect if a file is actually uploaded
    setIsAnalyzingAudio(true);
    setTunebatNotice(null);
    try {
      const result = await autoDetectTunebatData({
        title,
        artist,
        audioUrl,
        audioFile: file
      });
      if (result) {
        setTrack(prev => ({
          ...prev,
          bpm: result.bpm,
          key: result.key
        }));
        setTunebatNotice(
          `Analisi Audio: ${result.bpm} BPM • ${result.key}${result.camelot ? ` (${result.camelot})` : ''} rilevati!`
        );
      }
    } catch (err) {
      console.error('Tunebat detection error:', err);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // When a local audio file is uploaded/selected
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    
    const tempAudio = new Audio(localUrl);
    tempAudio.onloadedmetadata = () => {
      const dur = Math.round(tempAudio.duration * 1000);
      setTrack(prev => ({ ...prev, durationMs: dur }));
    };

    setTrack(prev => ({
      ...prev,
      audioFilePath: localUrl,
      title: prev.title || file.name.replace(/\.[^/.]+$/, '')
    }));

    await triggerTunebatAutoFill(track.title || file.name, track.mainArtist, localUrl, file);
  };

  const handleRemoveAudio = () => {
    setTrack(prev => ({
      ...prev,
      audioFilePath: '',
      durationMs: 0
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTunebatNotice(null);
  };

  const addFeaturing = () => {
    setTrack(prev => ({ ...prev, featurings: [...prev.featurings, ''] }));
  };

  const removeFeaturing = (index: number) => {
    setTrack(prev => {
      const newFeats = [...prev.featurings];
      newFeats.splice(index, 1);
      return { ...prev, featurings: newFeats };
    });
  };

  const handleFeatChange = (index: number, value: string) => {
    setTrack(prev => {
      const newFeats = [...prev.featurings];
      newFeats[index] = value;
      return { ...prev, featurings: newFeats };
    });
  };

  const handleSave = () => {
    if (!track.title) {
      alert('Inserisci un titolo per la traccia.');
      return;
    }
    if (editTrack && onUpdate) {
      onUpdate(track);
    } else {
      onSave(track);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-7xl mx-auto">
      {/* Header & Quick Save */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Music2 className="text-blue-500 shrink-0" />
            {editTrack ? 'Modifica Traccia' : 'Aggiungi Nuova Traccia'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestione metadati, file audio, analisi Tunebat automatica e testo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {editTrack && onDelete && (
            <button 
              type="button"
              onClick={() => onDelete(editTrack.id)}
              className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border border-rose-500/20 min-h-[44px]"
            >
              <Trash2 size={16} />
              <span>Elimina</span>
            </button>
          )}

          <button 
            type="button"
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 min-h-[44px]"
          >
            <Save size={18} />
            <span>{editTrack ? 'Aggiorna' : 'Salva Traccia'}</span>
          </button>
        </div>
      </div>

      {/* Main Form: Stacked 1 Column on Mobile, 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left / Top Column: Metadata & Audio */}
        <div className="space-y-4">
          
          {/* Title */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Titolo Traccia *
              </label>
              <input 
                type="text" 
                className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-sm min-h-[44px]"
                placeholder="es. Bandana Freestyle"
                value={track.title}
                onChange={e => {
                  const newTitle = e.target.value;
                  setTrack({ ...track, title: newTitle });
                }}
              />
            </div>

            {/* Artist & Producer (Side-by-side on desktop/tablet, stacked on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Artista Principale
                </label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-sm min-h-[44px]"
                  placeholder="es. Rondodasosa"
                  value={track.mainArtist}
                  onChange={e => {
                    const newArtist = e.target.value;
                    setTrack({ ...track, mainArtist: newArtist });
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Produttore (Beatmaker)
                </label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-slate-900 px-4 py-3 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-sm min-h-[44px]"
                  placeholder="es. NKO"
                  value={track.producer}
                  onChange={e => setTrack({ ...track, producer: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Tunebat Auto-Compilation Section (BPM & Key) */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Activity size={15} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Tunebat Auto-Detection
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Inserisci link per estrarre o analizza file
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerTunebatAutoFill(track.title, track.mainArtist, track.audioFilePath)}
                  disabled={isAnalyzingAudio || !track.audioFilePath}
                  className="px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-colors border border-blue-500/20 disabled:opacity-50 min-h-[36px]"
                  title="Analizza file locale"
                >
                  <RefreshCw size={12} className={isAnalyzingAudio ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Audio</span>
                </button>
                <a
                  href={getTunebatSearchUrl(track.title || '', track.mainArtist || '')}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                  title="Apri Tunebat.com"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="text"
                placeholder="Incolla link Tunebat per auto-compilare..."
                value={tunebatInput}
                onChange={(e) => setTunebatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScrapeTunebat()}
                className="flex-1 bg-black/60 border border-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors text-slate-300 min-h-[36px]"
              />
              <button
                type="button"
                onClick={handleScrapeTunebat}
                disabled={isAnalyzingAudio || !tunebatInput}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 min-h-[36px] flex items-center gap-1.5"
              >
                {isAnalyzingAudio ? <RefreshCw size={12} className="animate-spin" /> : <Activity size={12} />}
                <span>Estrai</span>
              </button>
            </div>

            {tunebatNotice && (
              <div className="p-2.5 bg-emerald-900/20 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <span>{tunebatNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  BPM (Battiti per minuto)
                </label>
                <input 
                  type="number"
                  value={track.bpm || ''}
                  onChange={e => setTrack({ ...track, bpm: parseInt(e.target.value, 10) || undefined })}
                  placeholder="140"
                  className="w-full bg-black/40 border border-slate-900 px-3 py-2 rounded-xl text-blue-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Chiave Musicale (Key)
                </label>
                <input 
                  type="text"
                  value={track.key || ''}
                  onChange={e => setTrack({ ...track, key: e.target.value })}
                  placeholder="es. C Minor / 5A"
                  className="w-full bg-black/40 border border-slate-900 px-3 py-2 rounded-xl text-purple-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Audio File Selection & Removal */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Traccia Audio
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  File MP3, WAV, M4A o URL audio
                </p>
              </div>

              {track.audioFilePath && (
                <button 
                  type="button"
                  onClick={handleRemoveAudio}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs flex items-center gap-1.5 transition-colors min-h-[36px]"
                  title="Rimuovi traccia audio"
                >
                  <Trash2 size={13} />
                  <span>Rimuovi audio</span>
                </button>
              )}
            </div>

            <input 
              ref={fileInputRef}
              type="file" 
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-black hover:bg-slate-900 text-slate-200 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors border border-slate-800 shrink-0 min-h-[44px]"
              >
                <Folder className="w-4 h-4 text-blue-400" />
                <span>Sfoglia file</span>
              </button>

              <div className="relative flex-1">
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-slate-900 px-4 py-2.5 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500 placeholder:text-slate-600 min-h-[44px]"
                  placeholder="Percorso locale o URL audio"
                  value={track.audioFilePath}
                  onChange={e => {
                    const newPath = e.target.value;
                    setTrack({ ...track, audioFilePath: newPath });
                    if (newPath) triggerTunebatAutoFill(track.title, track.mainArtist, newPath);
                  }}
                />
                {track.audioFilePath && (
                  <button
                    type="button"
                    onClick={handleRemoveAudio}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Svuota"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Featurings */}
          <div className="p-4 sm:p-5 bg-white/[0.02] rounded-2xl border border-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Featurings</label>
                <p className="text-xs text-slate-500 mt-0.5">Artisti ospiti nella traccia</p>
              </div>
              <button 
                type="button"
                onClick={addFeaturing}
                className="flex items-center justify-center w-9 h-9 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors min-h-[36px] min-w-[36px]"
                title="Aggiungi Featuring"
              >
                <Plus size={16} />
              </button>
            </div>
            
            {track.featurings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-900">
                {track.featurings.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 w-12 shrink-0">Feat {idx + 1}</span>
                    <input 
                      type="text" 
                      className="flex-1 bg-black/40 border border-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-slate-200 min-h-[44px]"
                      placeholder="Nome artista"
                      value={feat}
                      onChange={e => handleFeatChange(idx, e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => removeFeaturing(idx)}
                      className="flex items-center justify-center w-9 h-9 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors shrink-0 min-h-[36px] min-w-[36px]"
                      title="Rimuovi"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right / Bottom Column: Lyrics (Min height 250px on mobile) */}
        <div className="flex flex-col space-y-4">
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm flex-1 flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Testo & Rime (Lyrics)
              </label>
              
              <button 
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium transition-colors border border-blue-500/20 min-h-[36px]"
                onClick={() => setIsTranscribing(!isTranscribing)}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>AI Auto-Transcribe</span>
              </button>
            </div>
            
            {isTranscribing && (
              <div className="mb-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-xs text-blue-200 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                <p>
                  <strong>Microfono richiesto:</strong> utilizza il parlato o la riproduzione per trascrivere i versi.
                </p>
              </div>
            )}

            <textarea 
              className="w-full flex-1 bg-black/40 border border-slate-900 rounded-xl p-4 focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder:text-slate-600 font-mono text-sm leading-relaxed text-slate-200 shadow-inner custom-scrollbar min-h-[250px]"
              placeholder="Incolla o scrivi qui il testo della canzone, strofe e ritornelli..."
              value={track.lyrics}
              onChange={e => setTrack({ ...track, lyrics: e.target.value })}
            />
          </div>

          {/* Bottom Action Save Button */}
          <button 
            type="button"
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(37,99,235,0.3)] border border-blue-400/50 min-h-[44px]"
          >
            <Save className="w-5 h-5" />
            <span>{editTrack ? 'Aggiorna Traccia' : 'Salva Traccia nel Catalogo'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
