import React, { useState, useEffect, useRef } from 'react';
import { Track, DraftProject } from '../types';
import {
  Save, Folder, AlertCircle, Plus, Minus, Trash2,
  ExternalLink, Music2, RefreshCw, CheckCircle2,
  Loader2, KeyRound, Gauge, StopCircle, AlertTriangle, Wand2,
} from 'lucide-react';
import { getTunebatSearchUrl } from '../utils/tunebat';
import { analyzeAudio, confidenceLabel, type AudioAnalysis } from '../audio/analyze';
import { AudioStoreError, deleteAudio, putAudio } from '../storage/audioStore';
import { loadAudioBlob } from '../storage/audioAccess';
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

  const [titleError, setTitleError] = useState(false);

  const aiReady = hasAiCredentials(settings);
  /** C'e' un audio su cui si puo' davvero lavorare. */
  const hasUsableAudio = !!track.audio && track.audio.kind !== 'unavailable';

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
        audio: initialDraft.beatUrl ? { kind: 'remote', url: initialDraft.beatUrl } : undefined,
        bpm: initialDraft.bpm || 140,
        key: initialDraft.key || 'C Minor'
      };
      setTrack(draftTrack);
    } else {
      setTrack({ ...defaultTrack, id: crypto.randomUUID() });
    }
  }, [editTrack, initialDraft]);

  /**
   * Recupera i byte dell'audio. Il File appena selezionato evita un giro
   * inutile in archivio; per tutto il resto decide `loadAudioBlob`, che e'
   * l'unico punto dell'app a sapere dove stanno i byte.
   */
  const resolveAudioBlob = async (): Promise<Blob> => {
    if (audioFileRef.current) return audioFileRef.current;
    return loadAudioBlob(track);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // permette di riselezionare lo stesso file

    audioFileRef.current = file;
    setAnalysis(null);
    setTranscribeError(null);
    setAnalysisError(null);

    // I byte vengono archiviati subito: e' cio' che li fa sopravvivere al
    // ricaricamento della pagina, al posto del blob: URL di prima.
    try {
      await putAudio(track.id, file, file.name);
      setTrack(prev => ({
        ...prev,
        audio: {
          kind: 'local',
          name: file.name,
          mimeType: file.type || 'audio/mpeg',
          sizeBytes: file.size,
        },
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
      }));
    } catch (err) {
      audioFileRef.current = null;
      setAnalysisError(
        err instanceof AudioStoreError
          ? err.message
          : "Impossibile archiviare il file audio.",
      );
      return;
    }

    // L'analisi restituisce anche la durata reale: non serve un secondo passaggio
    // con un elemento <audio> nascosto.
    await runAnalysis(file);
  };

  const handleRemoveAudio = () => {
    cancelAnalysis();
    cancelTranscription();
    audioFileRef.current = null;
    // Via anche dall'archivio: un file scollegato dalla traccia non e' piu'
    // raggiungibile da nessuna parte e occuperebbe spazio per sempre.
    deleteAudio(track.id).catch(() => {
      /* Un file mai archiviato non e' un errore. */
    });
    setTrack(prev => ({ ...prev, audio: undefined, durationMs: 0 }));
    setAnalysis(null);
    setAnalysisError(null);
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
                  disabled={!hasUsableAudio}
                  title={hasUsableAudio ? 'Analizza il file audio' : 'Carica prima un file audio'}
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

            {/*
              Tunebat resta come link, non come estrazione automatica.
              Il sito costruisce BPM e tonalita' con JavaScript dopo che la
              pagina e' arrivata: scaricando l'HTML si ottiene un guscio vuoto,
              quindi l'estrazione non poteva funzionare. Il link invece porta
              alla pagina vera, dove i valori si leggono e si copiano qui sopra.
            */}
            <a
              href={getTunebatSearchUrl(track.title || '', track.mainArtist || '')}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 pt-1"
            >
              <ExternalLink size={12} />
              Confronta su Tunebat.com
            </a>
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

              {track.audio && (
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

              {/* Indirizzo remoto: caso esplicito, distinto dal file locale. */}
              <input
                type="url"
                aria-label="Indirizzo audio remoto"
                className="flex-1 bg-black/40 border border-slate-900 px-4 py-2.5 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500 placeholder:text-slate-600 min-h-[44px]"
                placeholder="oppure incolla un URL audio"
                value={track.audio?.kind === 'remote' ? track.audio.url : ''}
                onChange={e => {
                  const url = e.target.value.trim();
                  audioFileRef.current = null;
                  setTrack(prev => ({
                    ...prev,
                    audio: url ? { kind: 'remote', url } : undefined,
                  }));
                  setAnalysis(null);
                  setAnalysisError(null);
                }}
              />
            </div>

            {/* Stato dell'audio: dice sempre cosa c'e' davvero. */}
            {track.audio?.kind === 'local' && (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-black/40 border border-slate-800 rounded-xl px-3 py-2">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                <span className="truncate">
                  <span className="text-slate-200">{track.audio.name}</span>
                  {track.audio.sizeBytes > 0 && (
                    <span className="text-slate-500">
                      {' '}&middot; {(track.audio.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </span>
                <span className="ml-auto text-slate-500 shrink-0">salvato sul dispositivo</span>
              </div>
            )}

            {track.audio?.kind === 'unavailable' && (
              <div className="flex items-start gap-2 text-xs text-amber-100 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3 py-2">
                <AlertTriangle size={14} className="shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Il file audio di questa traccia non e&rsquo; piu&rsquo; disponibile
                  {track.audio.name ? ` (${track.audio.name})` : ''}. Ricaricalo con
                  &laquo;Sfoglia file&raquo;: testo e metadati sono rimasti intatti.
                </span>
              </div>
            )}
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
                  disabled={!hasUsableAudio}
                  title={
                    !hasUsableAudio
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
