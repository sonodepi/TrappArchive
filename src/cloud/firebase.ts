/**
 * Accesso a Firestore. È l'unico file che parla con Firebase.
 *
 * SULLA CONFIGURAZIONE E LE CHIAVI. La `apiKey` di Firebase **non è un
 * segreto**: è un identificatore pubblico del progetto, Google stessa lo
 * documenta, e finisce comunque nel codice che gira nel browser. Ciò che
 * protegge i dati non è nasconderla, sono le regole di sicurezza di Firestore
 * (vedi `firestore.rules`): senza quelle, nascondere la chiave non servirebbe
 * a niente; con quelle, esporla non fa danno.
 *
 * È diverso dalla chiave Gemini, che invece è un segreto di fatturazione e per
 * questo sta solo in `localStorage` e non entra mai nel bundle.
 *
 * La configurazione la mette l'utente nelle Impostazioni: così ognuno punta al
 * proprio progetto Firebase e l'app resta libera, senza un backend comune da
 * mantenere.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { collectionPath, type CollectionName } from './schema';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export type CloudErrorKind =
  | 'not-configured'
  | 'auth'
  | 'permission'
  | 'offline'
  | 'quota'
  | 'unknown';

/** Errore già scritto per essere mostrato all'utente così com'è. */
export class CloudError extends Error {
  constructor(message: string, readonly kind: CloudErrorKind) {
    super(message);
    this.name = 'CloudError';
  }
}

export function isConfigured(config: Partial<FirebaseConfig> | undefined): config is FirebaseConfig {
  return !!(config?.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let activeProjectId = '';

/**
 * Carica l'SDK solo alla prima chiamata.
 *
 * Firebase pesa qualche centinaio di kB: con un import statico lo pagherebbe
 * anche chi usa l'app solo in locale, che è il caso normale.
 */
async function ensureApp(config: FirebaseConfig) {
  if (app && activeProjectId === config.projectId) return { app, auth: auth!, db: db! };

  const [{ initializeApp, deleteApp, getApps }, authMod, firestoreMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);

  // Cambio di progetto: si chiude il precedente invece di lasciarne due aperti.
  if (app) {
    await deleteApp(app).catch(() => {});
    app = null;
  }
  for (const existing of getApps()) {
    await deleteApp(existing).catch(() => {});
  }

  app = initializeApp(config);
  auth = authMod.getAuth(app);
  db = firestoreMod.getFirestore(app);
  activeProjectId = config.projectId;

  // La cache locale di Firestore rende le letture disponibili anche offline.
  try {
    await firestoreMod.enableIndexedDbPersistence(db);
  } catch {
    // Fallisce con più schede aperte o dove IndexedDB non c'è: non è fatale,
    // l'app funziona comunque, semplicemente senza cache offline di Firestore.
  }

  return { app, auth: auth!, db: db! };
}

function translate(err: unknown): CloudError {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) {
    return new CloudError(
      'Il progetto Firebase ha rifiutato la richiesta: controlla le regole di sicurezza di Firestore.',
      'permission',
    );
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return new CloudError('Nessuna connessione: la sincronizzazione riprenderà quando torni online.', 'offline');
  }
  if (code.includes('resource-exhausted')) {
    return new CloudError('Quota di Firestore esaurita per oggi.', 'quota');
  }
  if (code.startsWith('auth/')) {
    return new CloudError('Accesso non riuscito. Riprova.', 'auth');
  }
  return new CloudError('Errore durante la comunicazione con il cloud.', 'unknown');
}

export interface CloudUser {
  uid: string;
  displayName: string;
  email: string;
}

function toCloudUser(user: User): CloudUser {
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
  };
}

/** Accesso con Google. Apre la finestra del browser, non chiede password all'app. */
export async function signIn(config: FirebaseConfig): Promise<CloudUser> {
  try {
    const { auth } = await ensureApp(config);
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return toCloudUser(result.user);
  } catch (err) {
    throw translate(err);
  }
}

export async function signOutCloud(config: FirebaseConfig): Promise<void> {
  try {
    const { auth } = await ensureApp(config);
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  } catch (err) {
    throw translate(err);
  }
}

/** Utente già collegato da una sessione precedente, se c'è. */
export async function currentUser(config: FirebaseConfig): Promise<CloudUser | null> {
  try {
    const { auth } = await ensureApp(config);
    const { onAuthStateChanged } = await import('firebase/auth');
    return await new Promise<CloudUser | null>(resolve => {
      const stop = onAuthStateChanged(auth, user => {
        stop();
        resolve(user ? toCloudUser(user) : null);
      });
    });
  } catch {
    return null;
  }
}

/** Legge tutti i documenti di una raccolta dell'utente. */
export async function fetchCollection<T>(
  config: FirebaseConfig,
  uid: string,
  name: CollectionName,
): Promise<T[]> {
  try {
    const { db } = await ensureApp(config);
    const { collection, getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(collection(db, collectionPath(uid, name)));
    return snapshot.docs.map(d => d.data() as T);
  } catch (err) {
    throw translate(err);
  }
}

/**
 * Scrive e cancella in blocco.
 *
 * Firestore accetta al massimo 500 operazioni per batch: gli elenchi più lunghi
 * vengono spezzati, altrimenti la scrittura fallirebbe tutta insieme.
 */
export async function writeCollection<T extends { id: string }>(
  config: FirebaseConfig,
  uid: string,
  name: CollectionName,
  items: T[],
  deleteIds: string[] = [],
): Promise<void> {
  if (items.length === 0 && deleteIds.length === 0) return;

  try {
    const { db } = await ensureApp(config);
    const { doc, writeBatch } = await import('firebase/firestore');
    const path = collectionPath(uid, name);

    const operations: Array<{ id: string; data?: T }> = [
      ...items.map(item => ({ id: item.id, data: item })),
      ...deleteIds.map(id => ({ id })),
    ];

    const LIMIT = 450; // sotto il tetto di 500, con margine
    for (let i = 0; i < operations.length; i += LIMIT) {
      const batch = writeBatch(db);
      for (const op of operations.slice(i, i + LIMIT)) {
        const ref = doc(db, path, op.id);
        if (op.data) batch.set(ref, stripUndefined(op.data));
        else batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (err) {
    throw translate(err);
  }
}

/**
 * Firestore rifiuta i campi `undefined`, che in TypeScript sono normalissimi
 * per un campo facoltativo. Vengono tolti invece di essere salvati come null,
 * così un campo assente resta assente anche al ritorno.
 */
function stripUndefined<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v)
      ? v.map(item => (item && typeof item === 'object' ? stripUndefined(item as object) : item))
      : v && typeof v === 'object'
        ? stripUndefined(v as object)
        : v;
  }
  return out as T;
}
