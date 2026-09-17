/**
 * Controlla ogni schermata dell'app a piu' larghezze e dice cosa sfora.
 *
 * Misura le posizioni reali degli elementi invece di guardarle a occhio: un
 * pulsante che finisce mezzo fuori dal bordo si vede in un numero, non in una
 * schermata guardata di sfuggita.
 *
 * LA REGOLA CHE QUESTO SCRIPT ESISTE PER RICORDARE: il primo livello di una
 * schermata non e' la schermata. I due difetti veri trovati finora - il
 * visualizzatore sopra i comandi del player, e i pulsanti fuori dai pannelli
 * della bozza - stavano tutti e due dentro una vista che si apre solo dopo un
 * clic. Una passata che si ferma all'elenco non li vede.
 *
 * Uso:
 *   npm run build && npx vite preview --port 4173 &
 *   node .claude/skills/verifica-dal-vivo/controlla-schermate.mjs
 *
 * Serve Playwright:  npm i -D playwright && npx playwright install chromium
 * (non e' fra le dipendenze del progetto: serve solo a chi verifica, e
 * scaricarlo costerebbe a tutti gli altri.)
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const INDIRIZZO = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const CARTELLA = '.tmp/verifiche';
const LARGHEZZE = [390, 768, 900, 1024, 1050, 1180, 1280, 1440, 1600];

mkdirSync(CARTELLA, { recursive: true });

/** Dati veri: una schermata vuota non prova niente. */
const SEMI = () => {
  const ora = Date.now();
  localStorage.setItem('trapparchive_settings', JSON.stringify({
    authorId: 'io', authorName: 'depi', keyProfile: 'temperley', lyricsFormat: 'mixed',
  }));
  localStorage.setItem('trapparchive_tracks', JSON.stringify([{
    id: 't1', title: 'Traccia con un titolo lungo che mette in difficolta la colonna',
    producer: 'NKO', mainArtist: 'Depi', featurings: ['Ospite Uno', 'Ospite Due'],
    lyrics: 'prima barra (ehi)\nseconda barra molto piu lunga che va a capo di sicuro (skrrt)',
    durationMs: 183000, createdAt: ora, bpm: 140, key: 'C Minor',
  }]));
  localStorage.setItem('trapparchive_albums', JSON.stringify([{
    id: 'a1', title: 'Album di prova', coverArt: '', year: 2026, genre: 'Trap',
    trackIds: ['t1'], createdAt: ora,
  }]));
  localStorage.setItem('trapparchive_drafts', JSON.stringify([{
    id: 'd1', title: 'Nuova Bozza', lyrics: '', ownerId: 'io',
    authors: [{ id: 'io', name: 'depi', colorIndex: 0 }],
    blocks: [{ id: 'b1', label: 'Strofa 1', authorId: 'io', text: 'una barra (ehi)', done: false, updatedAt: ora }],
    beatUrl: '', updatedAt: ora,
  }]));
};

/** Cosa sfora dal bordo, e quali comandi si sovrappongono fra loro. */
const MISURA = () => {
  const W = window.innerWidth;
  const descrivi = el => {
    const r = el.getBoundingClientRect();
    const testo = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 24);
    return `${el.tagName.toLowerCase()}[${testo}] ${Math.round(r.left)}→${Math.round(r.right)}`;
  };

  const fuori = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return r.right > W + 1 || r.left < -1;
  }).map(descrivi);

  /**
   * Il rettangolo che si vede davvero, non quello teorico.
   *
   * Un pulsante in fondo a un'area che scorre ha un rettangolo che continua
   * sotto il bordo, dove pero' e' tagliato: confrontare quello con la barra
   * del player che sta li' sotto produce sovrapposizioni che a schermo non
   * esistono. Qui il rettangolo viene tagliato con quello di ogni antenato che
   * nasconde il traboccamento, cosi' resta solo la parte visibile.
   */
  const visibile = el => {
    let r = el.getBoundingClientRect();
    for (let p = el.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      r = {
        left: Math.max(r.left, pr.left), right: Math.min(r.right, pr.right),
        top: Math.max(r.top, pr.top), bottom: Math.min(r.bottom, pr.bottom),
      };
      if (r.right <= r.left || r.bottom <= r.top) return null;
    }
    // E fuori dallo schermo non conta comunque.
    r = {
      left: Math.max(r.left, 0), right: Math.min(r.right, window.innerWidth),
      top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight),
    };
    return (r.right - r.left > 4 && r.bottom - r.top > 4) ? r : null;
  };

  /**
   * Una barra fissa che sta sopra al contenuto che scorre non e' un difetto:
   * e' come sono fatti il player e la navigazione in fondo. Il contenuto ci
   * passa sotto per costruzione. Quindi si confrontano solo elementi che
   * vivono nello stesso piano: o tutti e due dentro qualcosa di fisso, o
   * nessuno dei due.
   */
  const dentroQualcosaDiFisso = el => {
    for (let p = el; p; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  };

  // Due comandi che si coprono a vicenda: uno dei due e' inutilizzabile.
  const comandi = [...document.querySelectorAll('button, input, textarea, select, a')]
    .map(el => ({ el, r: getComputedStyle(el).visibility === 'hidden' ? null : visibile(el), fisso: dentroQualcosaDiFisso(el) }))
    .filter(c => c.r);
  const scontri = [];
  for (let i = 0; i < comandi.length; i++) {
    for (let j = i + 1; j < comandi.length; j++) {
      const a = comandi[i], b = comandi[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.fisso !== b.fisso) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 3 && y > 3) scontri.push(`${descrivi(a.el)}  ×  ${descrivi(b.el)}`);
    }
  }

  return {
    scorrimentoOrizzontale: document.documentElement.scrollWidth - W,
    fuori: [...new Set(fuori)].slice(0, 5),
    scontri: [...new Set(scontri)].slice(0, 5),
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errori = [];
page.on('pageerror', e => errori.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errori.push(m.text()); });

try {
  await page.goto(INDIRIZZO, { waitUntil: 'networkidle' });
} catch {
  // Capita di lanciarlo senza aver avviato l'app: meglio dirlo in una riga
  // che stampare mezza pagina di stack.
  console.error(`Non risponde niente su ${INDIRIZZO}. Avvia prima l'app:

    npm run build && npx vite preview --port 4173

  oppure passa un altro indirizzo:  APP_URL=http://localhost:3000 node ...`);
  await browser.close();
  process.exit(2);
}
await page.evaluate(SEMI);
await page.reload({ waitUntil: 'networkidle' });

/**
 * Ogni voce apre una vista diversa. Quelle con `dentro` sono le sotto-viste:
 * sono loro che nascondono i difetti, ed e' per questo che ci sono.
 */
const VISTE = [
  { nome: 'bozze (elenco)', vai: /Bozze/ },
  { nome: 'bozze (dentro una bozza)', vai: /Bozze/, dentro: p => p.getByText('Nuova Bozza').first().click() },
  { nome: 'libreria', vai: /Libreria/ },
  { nome: 'libreria (traccia in modifica)', vai: /Libreria/, dentro: p => p.getByRole('button', { name: /Modifica/i }).first().click() },
  { nome: 'nuova traccia', vai: /Aggiungi Traccia|^Nuovo/ },
  { nome: 'album', vai: /Album/ },
  { nome: 'backup', vai: /Esporta|Backup/ },
  { nome: 'impostazioni', vai: /Impostazioni/ },
];

let problemi = 0;
for (const larghezza of LARGHEZZE) {
  await page.setViewportSize({ width: larghezza, height: 950 });
  for (const vista of VISTE) {
    const voce = page.getByRole('button', { name: vista.vai }).first();
    if (await voce.count()) await voce.click().catch(() => {});
    await page.waitForTimeout(250);
    if (vista.dentro) {
      await vista.dentro(page).catch(() => {});
      await page.waitForTimeout(350);
    }
    const m = await page.evaluate(MISURA);
    const rotto = m.scorrimentoOrizzontale > 0 || m.fuori.length > 0 || m.scontri.length > 0;
    if (rotto) {
      problemi++;
      console.log(`⚠ ${larghezza}px · ${vista.nome}`);
      if (m.scorrimentoOrizzontale > 0) console.log(`   scorrimento orizzontale: +${m.scorrimentoOrizzontale}px`);
      for (const f of m.fuori) console.log(`   fuori dal bordo: ${f}`);
      for (const s of m.scontri) console.log(`   sovrapposti: ${s}`);
      await page.screenshot({ path: `${CARTELLA}/${larghezza}-${vista.nome.replace(/[^a-z]+/gi, '-')}.png` });
    }
  }
}

console.log(problemi === 0
  ? `nessun problema su ${LARGHEZZE.length} larghezze × ${VISTE.length} viste`
  : `${problemi} viste da sistemare: le schermate sono in ${CARTELLA}/`);
console.log('errori in console:', errori.length ? [...new Set(errori)] : 'nessuno');

await browser.close();
process.exit(problemi === 0 && errori.length === 0 ? 0 : 1);
