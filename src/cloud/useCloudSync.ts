/**
 * Orchestrazione della sincronizzazione.
 *
 * Tiene insieme tre pezzi che restano separati: `sync.ts` decide cosa fare
 * (puro, testato), `firebase.ts` parla con Firestore, e questo hook applica il
 * risultato allo stato dell'app.
 *
 * La sincronizzazione è **esplicita**: parte quando l'utente la chiede o
 * all'accesso, non in sottofondo a ogni tasto premuto. È una scelta: un sync
 * automatico e invisibile è comodo finché funziona, e incomprensibile quando
 * sbaglia. Qui si vede sempre quando è successo e cosa ha spostato.
 */

import { useCallback, useState } from 'react';
import type { Album, DraftProject, Track } from '../types';
import type { AppSettings } from '../settings/types';
import {
  CloudError, currentUser, fetchCollection, isConfigured, signIn, signOutCloud,
  writeCollection, type CloudUser, type FirebaseConfig,
} from './firebase';
import { albumUpdatedAt, trackUpdatedAt, type SyncMeta } from './schema';
import { describeSync, reconcile, type Reconciliation } from './sync';

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'working'; step: string }
  | { state: 'done'; message: string; at: number }
  | { state: 'error'; message: string };

export interface Catalog {
  tracks: Track[];
  albums: Album[];
  drafts: DraftProject[];
}

const LAST_SYNC_KEY = 'trapparchive_last_sync';

function readLastSync(): number {
  try {
    return Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSync(at: number): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(at));
  } catch {
    // Se non si può scrivere, la prossima sincronizzazione riparte da zero:
    // più lavoro, nessun dato perso.
  }
}

/**
 * Applica una riconciliazione a un elenco locale.
 * Quello che arriva dal cloud sostituisce, quello eliminato sparisce.
 */
function applyToLocal<T extends { id: string }>(
  local: T[],
  r: Reconciliation<T & SyncMeta>,
): T[] {
  const removed = new Set(r.toDelete);
  const incoming = new Map(r.toApply.map(item => [item.id, item]));

  const merged = local
    .filter(item => !removed.has(item.id))
    .map(item => (incoming.get(item.id) as T | undefined) ?? item);

  // Quelle che qui non c'erano proprio.
  const known = new Set(merged.map(item => item.id));
  for (const item of r.toApply) {
    if (!known.has(item.id)) merged.push(item as unknown as T);
  }
  return merged;
}

export function useCloudSync(
  settings: AppSettings,
  catalog: Catalog,
  onApply: (next: Catalog) => void,
) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' });

  const config = settings.firebase as FirebaseConfig | undefined;
  const configured = isConfigured(config);

  const fail = (err: unknown) => {
    setStatus({
      state: 'error',
      message: err instanceof CloudError || err instanceof Error
        ? err.message
        : 'Sincronizzazione non riuscita.',
    });
  };

  /** Riprende una sessione già aperta, senza chiedere di nuovo l'accesso. */
  const restore = useCallback(async () => {
    if (!isConfigured(config)) return;
    const existing = await currentUser(config);
    if (existing) setUser(existing);
  }, [config?.projectId]);

  const connect = useCallback(async () => {
    if (!isConfigured(config)) {
      setStatus({ state: 'error', message: 'Configura prima il progetto Firebase in Impostazioni.' });
      return;
    }
    setStatus({ state: 'working', step: 'Accesso in corso…' });
    try {
      setUser(await signIn(config));
      setStatus({ state: 'idle' });
    } catch (err) {
      fail(err);
    }
  }, [config?.projectId]);

  const disconnect = useCallback(async () => {
    if (!isConfigured(config)) return;
    try {
      await signOutCloud(config);
    } catch {
      // Anche se la disconnessione remota fallisce, qui l'utente esce.
    }
    setUser(null);
    setStatus({ state: 'idle' });
  }, [config?.projectId]);

  const sync = useCallback(async () => {
    if (!isConfigured(config) || !user) {
      setStatus({ state: 'error', message: 'Collegati prima di sincronizzare.' });
      return;
    }

    const lastSyncAt = readLastSync();
    try {
      setStatus({ state: 'working', step: 'Lettura dal cloud…' });

      const [remoteTracks, remoteAlbums, remoteDrafts] = await Promise.all([
        fetchCollection<Track & SyncMeta>(config, user.uid, 'tracks'),
        fetchCollection<Album & SyncMeta>(config, user.uid, 'albums'),
        fetchCollection<DraftProject & SyncMeta>(config, user.uid, 'drafts'),
      ]);

      const rTracks = reconcile<Track & SyncMeta>({
        local: catalog.tracks as (Track & SyncMeta)[],
        remote: remoteTracks, lastSyncAt,
        updatedAtOf: trackUpdatedAt,
        isDeleted: t => t.deleted === true,
      });
      const rAlbums = reconcile<Album & SyncMeta>({
        local: catalog.albums as (Album & SyncMeta)[],
        remote: remoteAlbums, lastSyncAt,
        updatedAtOf: albumUpdatedAt,
        isDeleted: a => a.deleted === true,
      });
      const rDrafts = reconcile<DraftProject & SyncMeta>({
        local: catalog.drafts as (DraftProject & SyncMeta)[],
        remote: remoteDrafts, lastSyncAt,
        updatedAtOf: d => d.updatedAt,
        isDeleted: d => d.deleted === true,
      });

      setStatus({ state: 'working', step: 'Invio delle modifiche…' });
      await Promise.all([
        writeCollection(config, user.uid, 'tracks', rTracks.toPush),
        writeCollection(config, user.uid, 'albums', rAlbums.toPush),
        writeCollection(config, user.uid, 'drafts', rDrafts.toPush),
      ]);

      onApply({
        tracks: applyToLocal(catalog.tracks, rTracks),
        albums: applyToLocal(catalog.albums, rAlbums),
        drafts: applyToLocal(catalog.drafts, rDrafts),
      });

      const at = Date.now();
      writeLastSync(at);
      setStatus({
        state: 'done',
        at,
        message: describeSync([
          { label: 'tracce', r: rTracks as Reconciliation<unknown> },
          { label: 'album', r: rAlbums as Reconciliation<unknown> },
          { label: 'bozze', r: rDrafts as Reconciliation<unknown> },
        ]),
      });
    } catch (err) {
      fail(err);
    }
  }, [config?.projectId, user?.uid, catalog, onApply]);

  return { user, status, configured, connect, disconnect, sync, restore, lastSyncAt: readLastSync() };
}
