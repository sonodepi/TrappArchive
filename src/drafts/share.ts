/**
 * Condivisione delle bozze senza server: un codice cifrato al posto del file.
 *
 * Il trasporto e' un'unica stringa opaca (il "codice") che chi scrive si
 * scambia per qualsiasi canale — messaggio, mail, appunti — esattamente come
 * prima si scambiava il file. Dentro c'e' la bozza intera, cifrata con
 * AES-GCM; la chiave si deriva da una password (l'OTP, generata qui, non
 * scelta dall'utente) con PBKDF2. Il codice da solo non serve a niente:
 * senza la password non si apre. Codice e password vanno mandati per due
 * canali diversi (es. messaggio + chiamata), altrimenti chi intercetta uno
 * intercetta anche l'altro.
 *
 * La "finestra" e' il permesso di unire un codice nella propria bozza, e sono
 * due cose distinte:
 *
 *   - `shareSessionId` e' l'id del canale della bozza. Nasce la prima volta
 *     che il capo apre la finestra e poi non cambia piu'. Un codice entra solo
 *     in una bozza con lo stesso id: e' cio' che impedisce di unire per
 *     sbaglio un pezzo che appartiene a un'altra bozza.
 *   - `shareOpen` dice se adesso si accettano unioni. Chiudere lo mette a
 *     false e **non** tocca l'id.
 *
 * Perche' chiudere non cancella l'id: se lo cancellasse, riaprendo si
 * genererebbe un id nuovo e tutti i codici gia' in giro — compresi quelli che
 * i collaboratori devono ancora rimandare indietro — resterebbero morti per
 * sempre, in tutte e due le direzioni. E un collaboratore non ha nemmeno il
 * pulsante per riaprire: la finestra la governa solo chi ha creato la bozza.
 * Chiudere e riaprire vuol dire "adesso non accetto" e poi "accetto di nuovo",
 * non "butto via il canale".
 *
 * Attenzione a cosa "chiudere" NON fa: non e' una revoca crittografica. Chi
 * ha gia' in mano un codice e la password puo' sempre decifrarlo e leggerlo
 * — non esiste modo di impedirlo senza un server che tenga il conto di chi
 * ha ancora accesso, e qui non c'e' nessun server. Chiudere impedisce solo
 * che quel codice venga UNITO in questa bozza finche' resta chiusa.
 */

import type { DraftProject } from '../types';
import { parseDraft } from '../storage/migrate';

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const CODE_PREFIX = 'TAv1.';

/** Niente 0/O/1/I: sono le coppie che si confondono di piu' a voce o a mano. */
const PASSPHRASE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Password monouso leggibile ad alta voce, per derivare la chiave di cifratura. */
export function generatePassphrase(groups = 3, groupSize = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(groups * groupSize));
  const words: string[] = [];
  for (let g = 0; g < groups; g++) {
    let word = '';
    for (let i = 0; i < groupSize; i++) {
      word += PASSPHRASE_ALPHABET[bytes[g * groupSize + i] % PASSPHRASE_ALPHABET.length];
    }
    words.push(word);
  }
  return words.join('-');
}

/**
 * Apre la finestra. L'id del canale si crea solo la prima volta: riaprendo
 * resta quello di prima, cosi' i codici gia' distribuiti tornano validi.
 */
export function openShareWindow(draft: DraftProject): DraftProject {
  return {
    ...draft,
    shareSessionId: draft.shareSessionId ?? crypto.randomUUID(),
    shareOpen: true,
  };
}

/** Chiude la finestra: finche' resta chiusa non entra nessun codice. L'id resta. */
export function closeShareWindow(draft: DraftProject): DraftProject {
  return { ...draft, shareOpen: false };
}

/**
 * Un codice ricevuto si puo' unire solo se la mia finestra e' aperta adesso e
 * il codice appartiene allo stesso canale. Guarda sempre lo stato ATTUALE di
 * `mine`, non quello di quando il codice e' stato generato: e' cio' che rende
 * efficace la chiusura anche su un codice gia' in giro.
 */
export function canMergeIntoOpenWindow(mine: DraftProject, incoming: DraftProject): boolean {
  return (
    mine.shareOpen === true &&
    !!mine.shareSessionId &&
    mine.shareSessionId === incoming.shareSessionId
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra la bozza intera in un codice opaco. Serve la stessa password per riaprirlo. */
export async function encryptDraft(draft: DraftProject, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const payload = JSON.stringify({ app: 'TrappArchive', kind: 'draft', version: 2, draft });
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(payload),
  );
  return `${CODE_PREFIX}${toBase64Url(salt)}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export type DecryptFailure = 'formato' | 'password';

export type DecryptResult =
  | { ok: true; draft: DraftProject }
  | { ok: false; reason: DecryptFailure };

/**
 * Decifra un codice. AES-GCM autentica il testo cifrato: una password
 * sbagliata fa fallire la decifratura invece di restituire testo corrotto in
 * silenzio, quindi si distingue davvero un codice malformato da una password
 * sbagliata.
 */
export async function decryptDraft(code: string, passphrase: string): Promise<DecryptResult> {
  if (!code.startsWith(CODE_PREFIX)) return { ok: false, reason: 'formato' };
  const parts = code.slice(CODE_PREFIX.length).split('.');
  if (parts.length !== 3) return { ok: false, reason: 'formato' };

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    [salt, iv, ciphertext] = parts.map(fromBase64Url);
  } catch {
    return { ok: false, reason: 'formato' };
  }

  const key = await deriveKey(passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource);
  } catch {
    return { ok: false, reason: 'password' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return { ok: false, reason: 'formato' };
  }

  const draft = parseDraft((parsed as { draft?: unknown } | null)?.draft ?? parsed);
  if (!draft) return { ok: false, reason: 'formato' };
  return { ok: true, draft };
}
