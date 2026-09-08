import React, { useRef, useState } from 'react';
import { Album, DraftProject, Track } from '../types';
import {
  Download, Upload, Disc, Music2, Library,
  CheckCircle2, Laptop, Smartphone, Wifi, HardDrive, Sparkles, AlertTriangle,
  Cloud, LogIn, RefreshCw,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { parseAlbum, parseDraft, parseList, parseTrack } from '../storage/migrate';
import type { useCloudSync } from '../cloud/useCloudSync';

/** Riepilogo di cosa contiene un file, mostrato prima di importarlo. */
interface PendingImport {
  fileName: string;
  tracks: Track[];
  albums: Album[];
  drafts: DraftProject[];
  /** Voci presenti nel file ma inutilizzabili. */
  skipped: number;
  /** Voci gia' presenti nel catalogo, che non verranno duplicate. */
  duplicates: number;
}

export function ExportSection({
  albums,
  tracks,
  drafts,
  onImport,
  cloud,
}: {
  albums: Album[];
  tracks: Track[];
  drafts: DraftProject[];
  onImport: (data: { tracks: Track[]; albums: Album[]; drafts: DraftProject[] }) => void;
  cloud: ReturnType<typeof useCloudSync>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importNotice, setImportNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAlbum = (album: Album) => {
    const populatedTracks = album.trackIds
      .map(id => tracks.find(t => t.id === id))
      .filter(Boolean);

    downloadJson(
      { ...album, tracks: populatedTracks },
      `trapparchive_album_${album.title.replace(/\s+/g, '_').toLowerCase()}.json`,
    );
  };

  const exportTrack = (track: Track) => {
    downloadJson(
      track,
      `trapparchive_track_${(track.title || 'untitled').replace(/\s+/g, '_').toLowerCase()}.json`,
    );
  };

  const exportFullCatalog = () => {
    downloadJson(
      {
        app: 'TrappArchive',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        albums,
        tracks,
        drafts,
      },
      `trapparchive_full_catalog_${Date.now()}.json`,
    );
  };

  /**
   * Legge e valida un backup senza applicarlo.
   *
   * Il codice precedente si accontentava di un JSON sintatticamente valido,
   * scriveva direttamente in localStorage e dichiarava "completata con
   * successo" a prescindere dall'esito. Qui il file viene prima verificato e
   * riassunto, e l'utente conferma sapendo cosa succedera'.
   */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Permette di riselezionare lo stesso file dopo un annullamento.
    e.target.value = '';

    setImportNotice(null);
    const reader = new FileReader();

    reader.onerror = () =>
      setImportNotice({ kind: 'error', text: 'Impossibile leggere il file selezionato.' });

    reader.onload = event => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.target?.result ?? ''));
      } catch {
        setImportNotice({
          kind: 'error',
          text: 'Il file non e\u2019 un JSON valido. Il catalogo non e\u2019 stato modificato.',
        });
        return;
      }

      if (typeof parsed !== 'object' || parsed === null) {
        setImportNotice({
          kind: 'error',
          text: 'Il file non ha la struttura di un backup TrappArchive. Il catalogo non e\u2019 stato modificato.',
        });
        return;
      }

      const raw = parsed as Record<string, unknown>;
      const hasAnyCollection =
        Array.isArray(raw.tracks) || Array.isArray(raw.albums) || Array.isArray(raw.drafts);
      if (!hasAnyCollection) {
        setImportNotice({
          kind: 'error',
          text: 'Nel file non ci sono tracce, album o bozze da importare. Il catalogo non e\u2019 stato modificato.',
        });
        return;
      }

      const parsedTracks = parseList(raw.tracks, parseTrack);
      const parsedAlbums = parseList(raw.albums, parseAlbum);
      const parsedDrafts = parseList(raw.drafts, parseDraft);

      const knownTracks = new Set(tracks.map(t => t.id));
      const knownAlbums = new Set(albums.map(a => a.id));
      const knownDrafts = new Set(drafts.map(d => d.id));

      const newTracks = parsedTracks.items.filter(t => !knownTracks.has(t.id));
      const newAlbums = parsedAlbums.items.filter(a => !knownAlbums.has(a.id));
      const newDrafts = parsedDrafts.items.filter(d => !knownDrafts.has(d.id));

      const duplicates =
        parsedTracks.items.length - newTracks.length +
        (parsedAlbums.items.length - newAlbums.length) +
        (parsedDrafts.items.length - newDrafts.length);

      setPending({
        fileName: file.name,
        tracks: newTracks,
        albums: newAlbums,
        drafts: newDrafts,
        skipped: parsedTracks.skipped + parsedAlbums.skipped + parsedDrafts.skipped,
        duplicates,
      });
    };

    reader.readAsText(file);
  };

  /** Applica l'import confermato e riporta numeri reali, contati qui. */
  const confirmImport = () => {
    if (!pending) return;
    const { tracks: t, albums: a, drafts: d, duplicates, skipped } = pending;
    onImport({ tracks: t, albums: a, drafts: d });

    const added = t.length + a.length + d.length;
    const parts = [
      added === 0
        ? 'Nessuna voce nuova da importare'
        : `Importate ${t.length} tracce, ${a.length} album e ${d.length} bozze`,
    ];
    if (duplicates > 0) parts.push(`${duplicates} gia\u2019 presenti, non duplicate`);
    if (skipped > 0) parts.push(`${skipped} scartate perche\u2019 incomplete`);

    setImportNotice({ kind: added === 0 ? 'error' : 'ok', text: `${parts.join('. ')}.` });
    setPending(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-36 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Download className="text-blue-500 shrink-0" />
          Export & Backup Center
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Salva e ripristina il catalogo con file JSON sul tuo dispositivo.
        </p>
      </div>

      {importNotice && (
        <div
          className={`mb-6 p-4 border rounded-2xl flex items-center gap-3 text-xs sm:text-sm shrink-0 ${
            importNotice.kind === 'ok'
              ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
          }`}
        >
          {importNotice.kind === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span className="flex-1">{importNotice.text}</span>
          <button
            onClick={() => setImportNotice(null)}
            className="text-xs hover:text-white px-2 py-1 rounded bg-white/5 min-h-[32px]"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Conferma dell'import: l'utente vede cosa sta per succedere prima che succeda. */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#0a0f1c] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Confermi l&rsquo;importazione?</h3>
            <p className="text-xs text-slate-400 break-all">Da: {pending.fileName}</p>

            <ul className="text-sm text-slate-200 space-y-1.5">
              <li>Tracce da aggiungere: <strong>{pending.tracks.length}</strong></li>
              <li>Album da aggiungere: <strong>{pending.albums.length}</strong></li>
              <li>Bozze da aggiungere: <strong>{pending.drafts.length}</strong></li>
            </ul>

            {(pending.duplicates > 0 || pending.skipped > 0) && (
              <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
                {pending.duplicates > 0 && (
                  <p>{pending.duplicates} voci sono gi&agrave; nel catalogo e verranno ignorate.</p>
                )}
                {pending.skipped > 0 && (
                  <p>{pending.skipped} voci del file sono incomplete e verranno scartate.</p>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500">
              Nulla viene sostituito: le voci esistenti restano come sono.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPending(null)}
                className="px-4 py-2.5 text-slate-300 hover:text-white rounded-xl text-sm transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={confirmImport}
                disabled={pending.tracks.length + pending.albums.length + pending.drafts.length === 0}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
              >
                Importa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Sincronizzazione fra dispositivi: facoltativa, e onesta sui limiti. */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-black border border-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                <Cloud className="text-amber-400 w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">
                  Sincronizzazione fra dispositivi
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {!cloud.configured
                    ? 'Non configurata: l\u2019app lavora solo su questo dispositivo.'
                    : cloud.user
                      ? `Collegato come ${cloud.user.email || cloud.user.displayName}`
                      : 'Configurata. Collegati per sincronizzare.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {cloud.configured && !cloud.user && (
                <button
                  onClick={cloud.connect}
                  disabled={cloud.status.state === 'working'}
                  className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 min-h-[44px] flex items-center gap-2"
                >
                  <LogIn size={15} /> Collegati
                </button>
              )}
              {cloud.user && (
                <>
                  <button
                    onClick={cloud.sync}
                    disabled={cloud.status.state === 'working'}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 min-h-[44px] flex items-center gap-2"
                  >
                    <RefreshCw size={15} className={cloud.status.state === 'working' ? 'animate-spin' : ''} />
                    Sincronizza ora
                  </button>
                  <button
                    onClick={cloud.disconnect}
                    className="px-3 py-2.5 text-slate-400 hover:text-slate-200 text-xs transition-colors min-h-[44px]"
                  >
                    Scollega
                  </button>
                </>
              )}
            </div>
          </div>

          {cloud.status.state === 'working' && (
            <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl flex items-center gap-2.5 text-xs text-blue-200">
              <RefreshCw size={14} className="animate-spin shrink-0 text-blue-400" />
              <span>{cloud.status.step}</span>
            </div>
          )}
          {cloud.status.state === 'done' && (
            <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
              <CheckCircle2 size={14} className="shrink-0 text-blue-400 mt-0.5" />
              <span>{cloud.status.message}</span>
            </div>
          )}
          {cloud.status.state === 'error' && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-100">
              <AlertTriangle size={14} className="shrink-0 text-amber-400 mt-0.5" />
              <span>{cloud.status.message}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Sincronizza metadati, testi, album e bozze. <strong className="text-slate-400">I
            file audio restano su questo dispositivo</strong> e vanno ricaricati altrove:
            non passano dal cloud. Per il backup completo usa il file JSON qui sotto.
          </p>
        </div>

        {/* Card 1: backup completo del catalogo, su file locale */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black border border-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <Library className="text-blue-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-100">Backup Completo Catalogo</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Esporta {tracks.length} tracce, {albums.length} album e tutte le bozze in un unico file JSON.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <button 
              onClick={exportFullCatalog}
              className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-400/50 min-h-[44px]"
            >
              <Download size={18} />
              <span>Scarica JSON Completo</span>
            </button>

            {/* Hidden File Input for Import */}
            <input 
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border border-slate-800 min-h-[44px]"
            >
              <Upload size={18} className="text-purple-400" />
              <span>Importa Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Card 2: Download & Install App (PWA) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-blue-950/20 via-slate-900/40 to-indigo-950/20 border border-blue-900/40 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shrink-0">
          <div className="flex items-start gap-4 max-w-2xl">
            <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-blue-400 mt-1">
              <Download className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Scarica TrappArchive come Applicazione</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Sparkles size={11} />
                  PWA NATIVA
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Wifi size={11} />
                  100% OFFLINE
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Puoi installare TrappArchive direttamente su computer (Windows, Mac, Linux) o smartphone (iPhone, Android). L'app funziona autonomamente a schermo intero senza barre del browser e non dipende da server esterni: tutti i tuoi brani, testi e album rimangono al sicuro sul tuo dispositivo.
              </p>

              <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Laptop size={13} className="text-blue-400" /> Desktop Chrome / Edge
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Smartphone size={13} className="text-indigo-400" /> Android & Safari iOS
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <HardDrive size={13} className="text-emerald-400" /> Archiviazione locale istantanea
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            <PWAInstallButton className="w-full sm:w-auto text-sm py-3 px-6" />
          </div>
        </div>

        {/* Card 3: Albums List Export */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2 flex flex-col bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md min-h-[250px]">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
            <Disc size={16} className="text-blue-400" /> Esporta Singoli Album
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
            {albums.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs border border-slate-900 bg-black/20 rounded-xl">
                Nessun album presente da esportare.
              </div>
            ) : (
              albums.map(a => (
                <div 
                  key={a.id} 
                  className="bg-black/40 border border-slate-900 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors shadow-sm min-h-[48px]"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center border border-slate-800 shrink-0">
                      <Disc className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="truncate">
                      <h4 className="font-medium text-xs sm:text-sm text-slate-200 truncate">{a.title}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{a.trackIds.length} tracce • {a.year}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => exportAlbum(a)}
                    className="p-2.5 text-slate-400 hover:text-blue-400 bg-black border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Esporta Album JSON"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 4: Single Tracks Export */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1 flex flex-col bg-white/[0.02] border border-slate-900 rounded-2xl p-4 md:p-6 shadow-md min-h-[250px]">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0">
            <Music2 size={16} className="text-purple-400" /> Esporta Singole Tracce
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {tracks.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs border border-slate-900 bg-black/20 rounded-xl">
                Nessuna traccia presente.
              </div>
            ) : (
              tracks.map(t => (
                <div 
                  key={t.id} 
                  className="flex items-center justify-between p-2.5 bg-black/40 border border-slate-900 rounded-xl hover:bg-white/[0.04] transition-colors shadow-sm min-h-[44px]"
                >
                  <div className="truncate pr-2">
                    <h4 className="font-medium text-xs text-slate-300 truncate">{t.title || 'Untitled'}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{t.mainArtist || 'Unknown'}</p>
                  </div>
                  <button 
                    onClick={() => exportTrack(t)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Esporta traccia"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
