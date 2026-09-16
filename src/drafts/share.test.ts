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
  it('aprire assegna un id, chiudere lo svuota', () => {
    const opened = openShareWindow(draft());
    expect(opened.shareSessionId).toBeTruthy();
    const closed = closeShareWindow(opened);
    expect(closed.shareSessionId).toBeUndefined();
  });

  it("ogni apertura da' un id diverso dalla precedente", () => {
    const first = openShareWindow(draft());
    const second = openShareWindow(first);
    expect(second.shareSessionId).not.toBe(first.shareSessionId);
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

  it('rifiuta un codice di una finestra diversa da quella attualmente aperta', () => {
    const mine = openShareWindow(draft());
    const incoming = draft({ shareSessionId: 'una-sessione-diversa' });
    expect(canMergeIntoOpenWindow(mine, incoming)).toBe(false);
  });

  it("rifiuta sempre se la finestra non e' mai stata aperta", () => {
    const mine = draft();
    const incoming = draft({ shareSessionId: undefined });
    expect(canMergeIntoOpenWindow(mine, incoming)).toBe(false);
  });
});
