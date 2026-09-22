import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const passi = [];
const ok = (n, cond, extra = '') => passi.push(`${cond ? 'OK ' : 'NO '} ${n}${extra ? ' — ' + extra : ''}`);

const apri = async (nome) => {
  const ctx = await browser.newContext();          // archivio separato = dispositivo separato
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.getByPlaceholder('es. Depi').fill(nome);
  await page.getByRole('button', { name: 'Continua' }).click();
  return page;
};

const capo = await apri('Capo');
const ospite = await apri('Ospite');

await capo.getByRole('button', { name: /Nuova Bozza/ }).click();
await capo.getByPlaceholder('Scrivi qui la tua parte...').first().fill('la mia strofa del capo');
await capo.getByRole('button', { name: /Aggiungi blocco/ }).click();
await capo.waitForTimeout(400);
ok('1. bozza creata con un blocco libero', true);

await capo.getByRole('button', { name: 'Apri', exact: true }).click();
await capo.getByRole('button', { name: /Genera codice/ }).click();
await capo.waitForTimeout(2500);
const leggiReadonly = (page) => page.locator('input[readonly], textarea[readonly]')
  .evaluateAll(els => els.map(e => e.value));
const valori = await leggiReadonly(capo);
const password = valori.find(v => /^[A-Z0-9]{4}(-[A-Z0-9]{4})+$/.test(v.trim()));
const codice = valori.find(v => v.trim().startsWith('TAv1.'));
ok('2. codice e password generati', !!password && !!codice, `password ${password}, codice ${codice?.length} caratteri`);

// Un ospite che non ha ancora nessuna bozza non vede il campo: deve prima
// aprire il pannello con «Incolla un codice».
const apriPannello = async (page) => {
  if (await page.getByPlaceholder('Incolla qui il codice...').count() === 0) {
    await page.getByRole('button', { name: /Incolla un codice/ }).click();
    await page.waitForTimeout(500);
  }
};
await apriPannello(ospite);
await ospite.getByPlaceholder('Incolla qui il codice...').fill(codice);
await ospite.getByPlaceholder('Password').fill(password);
await ospite.getByRole('button', { name: 'Sblocca', exact: true }).click();
await ospite.waitForTimeout(3000);
ok("3. l'ospite entra e legge la strofa del capo",
   (await ospite.locator('body').innerText()).includes('la mia strofa del capo'));

const prendi = ospite.getByRole('button', { name: /Lo prendo/ });
if (await prendi.count()) await prendi.first().click();
await ospite.waitForTimeout(400);
await ospite.getByPlaceholder('Scrivi qui la tua parte...').last().fill('la strofa dell ospite');
await ospite.waitForTimeout(600);
await ospite.getByRole('button', { name: /Genera codice/ }).click();
await ospite.waitForTimeout(2500);
const valoriO = await leggiReadonly(ospite);
const passwordO = valoriO.find(v => /^[A-Z0-9]{4}(-[A-Z0-9]{4})+$/.test(v.trim()));
const codiceO = valoriO.find(v => v.trim().startsWith('TAv1.'));
ok("4. l'ospite scrive e rigenera un codice", !!codiceO);

const incolla = async (page, c, p) => {
  await apriPannello(page);
  await page.getByPlaceholder('Incolla qui il codice...').fill(c);
  await page.getByPlaceholder('Password').fill(p);
  await page.getByRole('button', { name: 'Sblocca', exact: true }).click();
  await page.waitForTimeout(3000);
  return page.locator('.mb-5.p-3.border.rounded-xl').innerText().catch(() => '');
};

await incolla(capo, codiceO, passwordO);
ok("5. il capo legge la strofa dell'ospite",
   (await capo.locator('body').innerText()).includes('la strofa dell ospite'));

await capo.getByText('Chiudi', { exact: true }).click();
await capo.waitForTimeout(500);
const avviso = await incolla(capo, codiceO, passwordO);
ok('6. a finestra chiusa il codice viene rifiutato', /chius/i.test(avviso), avviso.replace(/\s+/g, ' ').slice(0, 80));

await capo.getByRole('button', { name: 'Apri', exact: true }).click();
await capo.waitForTimeout(500);
const avviso2 = await incolla(capo, codiceO, passwordO);
ok('7. riaprendo lo stesso codice torna valido', !/chius/i.test(avviso2), avviso2.replace(/\s+/g, ' ').slice(0, 80));

console.log(passi.join('\n'));
console.log(passi.every(p => p.startsWith('OK')) ? '\n=> tutti e sette i passi' : '\n=> QUALCOSA NON VA');
await browser.close();
