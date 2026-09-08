import React, { useState, useEffect, useRef } from 'react';
import { Track, DraftProject } from '../types';
import {
  Save, Folder, AlertCircle, Plus, Minus, Trash2,
  ExternalLink, Activity, Music2, X, RefreshCw, CheckCircle2,
  Loader2, KeyRound, Gauge, StopCircle, AlertTriangle, Wand2,
} from 'lucide-react';
import { getTunebatSearchUrl, scrapeTunebatUrl } from '../utils/tunebat';
import { analyzeAudio, confidenceLabel, type AudioAnalysis } from '../audio/analyze';
import { PHASE_LABELS, type TranscribePhase } from '../services/gemini-types';
import type { AppSettings } from '../settings/types';
import { hasAiCredentials } from '../settings/store';

/** Cosa fare quando la trascrizione arriva ma un testo esiste già. */
type PendingLyrics = { text: string; existing: string } | null;

export function TrackEditor({
  onSave,
  editTrack,
  initialDraft,
  onUpdate,
  onDelete,
  settings,
  onOpenSettings,
}: {
  onSave: (t: Track) => void,
  editTrack?: Track | null,
  initialDraft?: DraftProject | null,
  onUpdate?: (t: Track) => void,
  onDelete?: (id: string) => void,
  settings: AppSettings,
  onOpenSettings: () => void,
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Il File selezionato in questa sessione. Serve perché analisi e trascrizione
   * lavorano sui byte, non sul percorso: audioFilePath contiene un blob: URL che
   * non sopravvive a un ricaricamento della pagina.
   */
  const audioFileRef = useRef<File | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);

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

  // Analisi locale (BPM e tonalità): non richiede rete.
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Trascrizione AI: richiede chiave e rete.
  const [transcribePhase, setTranscribePhase] = useState<TranscribePhase | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [pendingLyrics, setPendingLyrics] = useState<PendingLyrics>(null);

  const [tunebatNotice, setTunebatNotice] = useState<string | null>(null);
  const [tunebatInput, setTunebatInput] = useState<string>('');
  const [showTunebatScrape, setShowTunebatScrape] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const aiReady = hasAiCredentials(settings);

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

  /**
   * Recupera i byte dell'audio. Preferisce il File selezionato in questa sessione;
   * altrimenti prova a rileggere il percorso salvato. Un blob: URL di una sessione
   * precedente è morto e fetch fallisce: in quel caso lo diciamo, invece di
   * mostrare un errore generico.
   */
  const resolveAudioBlob = async (): Promise<Blob> => {
    if (audioFileRef.current) return audioFileRef.current;
    const path = track.audioFilePath;
    if (!path) throw new Error('Nessun file audio associato a questa traccia.');
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(String(response.status));
      return await response.blob();
    } catch {
      throw new Error(
        path.startsWith('blob:')
          ? "Il file audio non è più disponibile: ricaricalo con Sfoglia file."
          : "Impossibile leggere l'audio da questo indirizzo.",
      );
    }
  };

  /** Analisi locale di BPM e tonalità. Nessuna rete, funziona anche offline. */
  const runAnalysis = async (file?: Blob) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const blob = file ?? (await resolveAudioBlob());
      const result = await analyzeAudio(blob, settings.keyProfile, controller.signal);
      setAnalysis(result);
      setTrack(prev => ({
        ...prev,
        bpm: result.bpm > 0 ? Math.round(result.bpm) : prev.bpm,
        key: result.key,
        durationMs: result.durationMs || prev.durationMs,
      }));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setAnalysisError(err instanceof Error ? err.message : "Analisi non riuscita.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    analysisAbortRef.current?.abort();
    setIsAnalyzing(false);
  };

  /** Trascrizione del testo con Gemini. */
  const runTranscription = async () => {
    if (!aiReady) {
      setTranscribeError('Configura la tua chiave Gemini in Impostazioni.');
      return;
    }
    transcribeAbortRef.current?.abort();
    const controller = new AbortController();
    transcribeAbortRef.current = controller;

    setTranscribeError(null);
    setTranscribePhase('decoding');
    try {
      const blob = await resolveAudioBlob();
      // Import dinamico: l'SDK Gemini (~400 kB) viene scaricato solo ora, non
      // all'avvio dell'app. Chi non usa l'AI non lo paga mai.
      const { transcribeAudio } = await import('../services/gemini');
      const result = await transcribeAudio({
        audio: blob,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
        language: settings.transcriptionLanguage,
        signal: controller.signal,
        onPhase: setTranscribePhase,
      });

      // Mai sovrascrivere in silenzio un testo già scritto.
      if (track.lyrics.trim()) {
        setPendingLyrics({ text: result.lyrics, existing: track.lyrics });
      } else {
        setTrack(prev => ({ ...prev, lyrics: result.lyrics }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setTranscribePhase(null);
        return;
      }
      // Gli errori del client sono già messaggi pronti per l'utente.
      setTranscribeError(
        err instanceof Error ? err.message : 'Trascrizione non riuscita.',
      );
    } finally {
      setTranscribePhase(null);
    }
  };

  const cancelTranscription = () => {
    transcribeAbortRef.current?.abort();
    setTranscribePhase(null);
  };

  const applyPendingLyrics = (mode: 'replace' | 'append') => {
    if (!pendingLyrics) return;
    setTrack(prev => ({
      ...prev,
      lyrics:
        mode === 'replace'
          ? pendingLyrics.text
          : `${pendingLyrics.existing.trimEnd()}\n\n${pendingLyrics.text}`,
    }));
    setPendingLyrics(null);
  };

  /**
   * Estrazione manuale da un link Tunebat. Retrocessa a conferma su richiesta:
   * passa da un proxy pubblico di terze parti e non funziona offline, mentre
   * l'analisi locale qui sopra è sempre disponibile.
   */
  const handleScrapeTunebat = async () => {
    if (!tunebatInput) return;
    setTunebatNotice(null);
    try {
      const result = await scrapeTunebatUrl(tunebatInput);
      if (result) {
        setTrack(prev => ({
          ...prev,
          bpm: result.bpm || prev.bpm,
          key: result.key || prev.key,
        }));
        setTunebatNotice(`Tunebat: ${result.bpm ?? '?'} BPM - ${result.key ?? '?'}`);
      } else {
        setTunebatNotice('Impossibile estrarre i dati da questo link.');
      }
    } catch {
      setTunebatNotice("Errore durante l'estrazione da Tunebat.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    audioFileRef.current = file;
    const localUrl = URL.createObjectURL(file);

    setTrack(prev => ({
      ...prev,
      audioFilePath: localUrl,
      title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
    }));
    setAnalysis(null);
    setTranscribeError(null);

    // L'analisi restituisce anche la durata reale: non serve un secondo passaggio
    // con un elemento <audio> nascosto.
    await runAnalysis(file);
  };

  const handleRemoveAudio = () => {
    cancelAnalysis();
    cancelTranscription();
    if (track.audioFilePath.startsWith('blob:')) {
      URL.revokeObjectURL(track.audioFilePath);
    }
    audioFileRef.current = null;
    setTrack(prev => ({ ...prev, audioFilePath: '', durationMs: 0 }));
    setAnalysis(null);
    setAnalysisError(null);
    setTunebatNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (!track.title.trim()) {
      setTitleError(true);
      document.getElementById('track-title')?.focus();
      return;
    }
    setTitleError(false);
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
            Metadati, file audio, analisi locale di BPM e tonalità, trascrizione AI del testo.
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
                id="track-title"
                type="text"
                aria-invalid={titleError}
                aria-describedby={titleError ? 'track-title-error' : undefined}
                className={`w-full bg-black/40 border px-4 py-3 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors shadow-inner text-sm min-h-[44px] ${
                  titleError
                    ? 'border-rose-500/60 focus:border-rose-500'
                    : 'border-slate-900 focus:border-blue-500'
                }`}
                placeholder="es. Bandana Freestyle"
                value={track.title}
                onChange={e => {
                  setTrack({ ...track, title: e.target.value });
                  if (titleError) setTitleError(false);
                }}
              />
              {titleError && (
                <p id="track-title-error" className="mt-1.5 text-xs text-rose-400">
                  Il titolo è obbligatorio per salvare la traccia.
                </p>
              )}
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

          {/* Analisi audio locale: BPM, tonalità e Camelot */}
          <div className="bg-white/[0.02] border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Gauge size={15} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Analisi audio
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    BPM e tonalità calcolati sul dispositivo, anche offline
                  </p>
                </div>
              </div>

              {isAnalyzing ? (
                <button
                  type="button"
                  onClick={cancelAnalysis}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors min-h-[36px] shrink-0"
                >
                  <StopCircle size={13} />
                  <span>Annulla</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => runAnalysis()}
                  disabled={!track.audioFilePath}
                  title={track.audioFilePath ? 'Analizza il file audio' : 'Carica prima un file audio'}
                  className="px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors border border-blue-500/20 disabled:opacity-40 min-h-[36px] shrink-0"
                >
                  <RefreshCw size={13} />
                  <span>Analizza</span>
                </button>
              )}
            </div>

            {isAnalyzing && (
              <div className="p-2.5 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center gap-2 text-xs text-blue-200">
                <Loader2 size={15} className="shrink-0 animate-spin text-blue-400" />
                <span>Analisi in corso, l'interfaccia resta utilizzabile...</span>
              </div>
            )}

            {analysisError && (
              <div className="p-2.5 bg-rose-900/20 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-200">
                <AlertTriangle size={15} className="shrink-0 text-rose-400 mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}

            {analysis && !isAnalyzing && (
              <div className="p-3 bg-black/40 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="font-mono">
                    <span className="text-blue-400 font-bold">{analysis.bpm} BPM</span>
                    <span className="text-slate-500"> - confidenza {confidenceLabel(analysis.bpmConfidence)}</span>
                  </span>
                  <span className="font-mono">
                    <span className="text-purple-400 font-bold">{analysis.key}</span>
                    {analysis.camelot && <span className="text-slate-400"> ({analysis.camelot})</span>}
                    <span className="text-slate-500"> - confidenza {confidenceLabel(analysis.keyConfidence)}</span>
                  </span>
                </div>

                {/* Se la stima è debole va detto, invece di presentarla come un fatto. */}
                {analysis.keyConfidence < 0.3 && (
                  <p className="text-amber-300/80">
                    Tonalità incerta: la seconda ipotesi è <strong>{analysis.keyAlternative}</strong>.
                  </p>
                )}
                {analysis.bpmCandidates.length > 1 && (
                  <p className="text-slate-500">
                    Alternative d'ottava: {analysis.bpmCandidates.slice(1).join(' - ')} BPM
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="track-bpm" className="block text-xs font-semibold text-slate-400 mb-1">
                  BPM (Battiti per minuto)
                </label>
                <input
                  id="track-bpm"
                  type="number"
                  value={track.bpm ?? ''}
                  onChange={e => setTrack({ ...track, bpm: parseInt(e.target.value, 10) || undefined })}
                  placeholder="140"
                  className="w-full bg-black/40 border border-slate-900 px-3 py-2 rounded-xl text-blue-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label htmlFor="track-key" className="block text-xs font-semibold text-slate-400 mb-1">
                  Chiave Musicale (Key)
                </label>
                <input
                  id="track-key"
                  type="text"
                  value={track.key ?? ''}
                  onChange={e => setTrack({ ...track, key: e.target.value })}
                  placeholder="es. C Minor / 5A"
                  className="w-full bg-black/40 border border-slate-900 px-3 py-2 rounded-xl text-purple-400 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>
            </div>

            {/* Verifica manuale su Tunebat: opzionale, e onesta sui suoi limiti. */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTunebatScrape(v => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink size={12} />
                {showTunebatScrape ? 'Nascondi' : 'Confronta con Tunebat (richiede rete)'}
              </button>

              {showTunebatScrape && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[11px] text-amber-300/70">
                    L'estrazione da Tunebat passa da un proxy pubblico di terze parti:
                    non funziona offline e può smettere di funzionare senza preavviso.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Incolla un link tunebat.com"
                      value={tunebatInput}
                      onChange={e => setTunebatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleScrapeTunebat()}
                      aria-label="Link Tunebat"
                      className="flex-1 bg-black/60 border border-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors text-slate-300 min-h-[36px]"
                    />
                    <button
                      type="button"
                      onClick={handleScrapeTunebat}
                      disabled={!tunebatInput}
                      className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 min-h-[36px] flex items-center gap-1.5"
                    >
                      <Activity size={12} />
                      <span>Estrai</span>
                    </button>
                    <a
                      href={getTunebatSearchUrl(track.title || '', track.mainArtist || '')}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Cerca su Tunebat.com"
                      className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  {tunebatNotice && (
                    <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 size={14} className="shrink-0 text-slate-400" />
                      <span>{tunebatNotice}</span>
                    </div>
                  )}
                </div>
              )}
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
                    // Nessuna analisi automatica a ogni tasto premuto: si lancia
                    // con il pulsante Analizza, quando il percorso è completo.
                    audioFileRef.current = null;
                    setTrack({ ...track, audioFilePath: e.target.value });
                    setAnalysis(null);
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
              
              {transcribePhase ? (
                <button
                  type="button"
                  onClick={cancelTranscription}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-full text-xs font-medium transition-colors border border-rose-500/20 min-h-[36px]"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>Annulla</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runTranscription}
                  disabled={!track.audioFilePath}
                  title={
                    !track.audioFilePath
                      ? 'Carica prima un file audio'
                      : !aiReady
                        ? 'Richiede una chiave Gemini: configurala in Impostazioni'
                        : 'Trascrivi il testo con Gemini'
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium transition-colors border border-blue-500/20 disabled:opacity-40 min-h-[36px]"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Trascrivi con AI</span>
                </button>
              )}
            </div>
            
            {transcribePhase && (
              <div className="mb-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center gap-2.5 text-xs text-blue-200 shrink-0">
                <Loader2 className="w-4 h-4 shrink-0 text-blue-400 animate-spin" />
                <span>{PHASE_LABELS[transcribePhase]}</span>
              </div>
            )}

            {!aiReady && !transcribePhase && (
              <div className="mb-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300 shrink-0">
                <KeyRound className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                <p>
                  La trascrizione automatica richiede una chiave Gemini.{' '}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    Configurala in Impostazioni
                  </button>
                  . Tutto il resto funziona senza.
                </p>
              </div>
            )}

            {transcribeError && (
              <div className="mb-3 p-3 bg-rose-900/20 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="min-w-0">
                  <p>{transcribeError}</p>
                  <button
                    type="button"
                    onClick={() => setTranscribeError(null)}
                    className="mt-1 text-rose-300/80 hover:text-rose-200 underline underline-offset-2"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            )}

            {/* Un testo già scritto non viene mai sovrascritto in silenzio. */}
            {pendingLyrics && (
              <div className="mb-3 p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2.5 text-xs shrink-0">
                <p className="text-amber-200">
                  La trascrizione è pronta, ma questa traccia ha già un testo.
                  Cosa vuoi farne?
                </p>
                <div className="max-h-24 overflow-y-auto custom-scrollbar bg-black/40 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {pendingLyrics.text}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyPendingLyrics('replace')}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors min-h-[36px]"
                  >
                    Sostituisci
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPendingLyrics('append')}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg font-semibold transition-colors min-h-[36px]"
                  >
                    Accoda
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingLyrics(null)}
                    className="px-3 py-2 text-slate-400 hover:text-slate-200 transition-colors min-h-[36px]"
                  >
                    Annulla
                  </button>
                </div>
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
