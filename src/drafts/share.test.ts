import { describe, expect, it } from 'vitest';
import type { DraftProject } from '../types';
import {
  canMergeIntoOpenWindow, closeShareWindow, decryptDraft, encryptDraft,
  generatePassphrase, openShareWindow,
} from './share';

const CAPO = 'autore-capo';

function draft(over: Partial<DraftProject> = {}): DraftProject {
  return {
    id: 'd1', title: 'Pezzo', lyrics: 'una strofa scritta con cura', ownerId: CAPO,
    authors: [{ id: CAPO, name: 'Capo', colorIndex: 0 }],
    blocks: [], beatUrl: '', updatedAt: 1000, ...over,
  };
}

describe('generatePassphrase', () => {
  it('produce codici diversi ogni volta', () => {
    const a = generatePassphrase();
    const b = generatePassphrase();
    expect(a).not.toBe(b);
  });

  it('non usa caratteri che si confondono a voce (0/O/1/I)', () => {
    const passphrase = generatePassphrase(10, 8);
    expect(passphrase).not.toMatch(/[0O1I]/);
  });
});

describe('openShareWindow / closeShareWindow', () => {
  it('aprire assegna un id e apre, chiudere lascia l’id e chiude', () => {
    const opened = openShareWindow(draft());
    expect(opened.shareSessionId).toBeTruthy();
    expect(opened.shareOpen).toBe(true);

    const closed = closeShareWindow(opened);
    expect(closed.shareOpen).toBe(false);
    expect(closed.shareSessionId).toBe(opened.shareSessionId);
  });

  it('riaprire non cambia il canale: i codici gia’ in giro restano validi', () => {
    // Se riaprire generasse un id nuovo, dopo un chiudi/riapri nessuno
    // riuscirebbe piu' a unire niente - ne' il capo ne' i collaboratori, che
    // fra l'altro non hanno nemmeno il pulsante per riaprire.
    const aperta = openShareWindow(draft());
    const codiceInGiro = draft({ shareSessionId: aperta.shareSessionId });

    const riaperta = openShareWindow(closeShareWindow(aperta));
    expect(riaperta.shareSessionId).toBe(aperta.shareSessionId);
    expect(canMergeIntoOpenWindow(riaperta, codiceInGiro)).toBe(true);
  });
});

describe('encryptDraft / decryptDraft', () => {
  it('cifra e decifra la bozza intera, testo compreso', async () => {
    const d = draft({ lyrics: 'strofa uno\nstrofa due' });
    const code = await encryptDraft(d, 'password-di-prova');
    const result = await decryptDraft(code, 'password-di-prova');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.lyrics).toBe('strofa uno\nstrofa due');
      expect(result.draft.id).toBe(d.id);
      expect(result.draft.title).toBe(d.title);
    }
  });

  it('con la password sbagliata non decifra, e lo dice: non torna testo corrotto', async () => {
    const code = await encryptDraft(draft(), 'password-giusta');
    const result = await decryptDraft(code, 'password-sbagliata');
    expect(result).toEqual({ ok: false, reason: 'password' });
  });

  it('un codice manomesso viene rifiutato come password sbagliata (AES-GCM autentica)', async () => {
    const code = await encryptDraft(draft(), 'password');
    const tampered = code.slice(0, -4) + 'AAAA';
    const result = await decryptDraft(tampered, 'password');
    expect(result.ok).toBe(false);
  });

  it('un codice senza il prefisso giusto viene scartato come formato invalido', async () => {
    const result = await decryptDraft('non-e-un-codice-trapparchive', 'qualunque');
    expect(result).toEqual({ ok: false, reason: 'formato' });
  });

  it("porta con se' l'id della finestra aperta al momento della cifratura", async () => {
    const opened = openShareWindow(draft());
    const code = await encryptDraft(opened, 'password');
    const result = await decryptDraft(code, 'password');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.shareSessionId).toBe(opened.shareSessionId);
  });
});

describe('canMergeIntoOpenWindow', () => {
  it('accetta un codice il cui id combacia con la finestra aperta', () => {
    const mine = openShareWindow(draft());
    const incoming = draft({ shareSessionId: mine.shareSessionId });
    expect(canMergeIntoOpenWindow(mine, incoming)).toBe(true);
  });

  it("rifiuta un codice se la finestra e' chiusa, anche se l'id combaciava prima di chiudere", () => {
    const opened = openShareWindow(draft());
    const incoming = draft({ shareSessionId: opened.shareSessionId });
    const closed = closeShareWindow(opened);
    expect(canMergeIntoOpenWindow(closed, incoming)).toBe(false);
  });

  it('rifiuta un codice che appartiene a un altro canale', () => {
    const mine = openShareWindow(draft());
    const incoming = draft({ shareSessionId: 'un-altro-canale' });
    expect(canMergeIntoOpenWindow(mine, incoming)).toBe(false);
  });

  it("rifiuta sempre se la finestra non e' mai stata aperta", () => {
    const mine = draft();
    const incoming = draft({ shareSessionId: undefined });
    expect(canMergeIntoOpenWindow(mine, incoming)).toBe(false);
  });

  it('una bozza salvata prima di questa versione risulta chiusa, non aperta', () => {
    // Retrocompatibilita': c'e' l'id ma non il flag. Meglio chiedere al capo
    // di riaprire che accettare unioni che non ha autorizzato.
    const vecchia = draft({ shareSessionId: 'canale-vecchio' });
    const incoming = draft({ shareSessionId: 'canale-vecchio' });
    expect(canMergeIntoOpenWindow(vecchia, incoming)).toBe(false);
  });
});
