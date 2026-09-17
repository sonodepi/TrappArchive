---
name: condivisione-bozze
description: Provare la condivisione delle bozze fra due dispositivi — codice cifrato, password, finestra che si apre e si chiude, unione del lavoro che torna indietro. Da usare ogni volta che si tocca src/drafts/share.ts, src/drafts/collab.ts o la schermata Bozze, perche' e' la funzione dove si perde il testo scritto dalle persone.
---

# Provare la condivisione delle bozze

Due persone scrivono sullo stesso pezzo scambiandosi un codice cifrato. Se
questa funzione sbaglia, qualcuno perde una strofa: è il difetto peggiore che
questo progetto possa avere.

Non si verifica leggendo il codice. Si verifica con **due dispositivi veri**,
cioè due contesti browser separati, che hanno archivi indipendenti come due
telefoni diversi.

## Come funziona, in breve

- Il **canale** della bozza è `shareSessionId`: nasce la prima volta che il capo
  apre la finestra e **non cambia più**. Un codice entra solo in una bozza con lo
  stesso canale.
- `shareOpen` dice se adesso si accettano unioni. Chiudere **non** cancella il
  canale: sospende e basta, così riaprendo i codici già in giro tornano validi.
  (Prima non era così, e dopo un chiudi/riapri nessuno riusciva più a unire
  niente, in nessuna direzione. Un collaboratore non ha nemmeno il pulsante per
  riaprire.)
- Chiudere **non è una revoca**: chi ha codice e password continua a leggerli.
  Impedisce solo di unirli.

## Il giro completo

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();

const apri = async (nome) => {
  const ctx = await browser.newContext();          // archivio separato = dispositivo separato
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.getByPlaceholder('es. Depi').fill(nome);
  await page.getByRole('button', { name: 'Continua' }).click();
  return page;
};
```

I selettori giusti, che trovarli è costato tre tentativi:

| Cosa | Selettore |
|---|---|
| Crea bozza | `getByRole('button', { name: /Nuova Bozza/ })` |
| Scrivi in un blocco | `getByPlaceholder('Scrivi qui la tua parte...')` — **non** `locator('textarea').last()`, che prende il campo del codice nella colonna a fianco |
| Blocco libero da prendere | `getByRole('button', { name: /Lo prendo/ })` |
| Apri / chiudi finestra | `getByRole('button', { name: 'Apri', exact: true })` · `getByText('Chiudi', { exact: true })` |
| Genera il codice | `getByRole('button', { name: /Genera codice/ })` |
| Codice e password generati | i due campi `input[readonly], textarea[readonly]`: la password è quella corta con i trattini, il codice è la stringa lunga |
| Incolla un codice | `getByPlaceholder('Incolla qui il codice...')` + `getByPlaceholder('Password')` |
| Conferma | `getByRole('button', { name: 'Sblocca', exact: true })` |
| Avviso dell'esito | il riquadro con classe `mb-5 p-3 border rounded-xl` |

Attenzione: `getByRole('button', { name: 'Carica' })` senza `exact: true` becca
anche "Scarica / Installa App" nella barra laterale.

## I sette passi, e cosa deve succedere

1. **Il capo** crea la bozza, scrive nel suo blocco e **lascia un blocco libero**
   con "Aggiungi blocco": senza quello l'ospite non ha dove scrivere, perché si
   può scrivere solo nei blocchi propri o liberi.
2. Apre la finestra e genera il codice → compaiono password (tipo `8Q6D-Y2F6-G33B`)
   e un codice lungo circa 1000 caratteri che comincia per `TAv1.`.
3. **L'ospite** incolla codice e password e preme Sblocca → «Sei entrato in
   "…"», la bozza compare, e **vede la strofa del capo**.
4. L'ospite prende il blocco libero, scrive, e genera un codice a sua volta.
5. Il capo incolla quel codice → «N blocchi aggiornati, 1 autori aggiunti», e
   **legge la strofa dell'ospite**.
6. Il capo chiude la finestra e riprova lo stesso codice → viene **rifiutato**,
   con il messaggio che la finestra è chiusa.
7. Il capo riapre → lo stesso codice viene **riaccettato**. Se resta rifiutato,
   è tornato il difetto del canale che si rigenera: guarda `openShareWindow` in
   `src/drafts/share.ts`.

Se uno solo di questi sette non si comporta così, non è un dettaglio: fermati e
dillo, non aggiustare a naso.

## Le cose che non si vedono, e vanno controllate lo stesso

- **Il testo battuto durante la decifratura non deve sparire.** Decifrare costa
  210.000 giri di PBKDF2, e il pannello per incollare i codici sta accanto
  all'editor: scrivi in un blocco *mentre* la decifratura è in corso e verifica
  che quelle lettere ci siano ancora dopo.
- **Codice e password non devono restare a video passando a un'altra bozza.**
  Genera un codice nella bozza A, apri la bozza B, e guarda che il pannello di B
  non offra il codice di A — sarebbe un clic dal mandare il pezzo sbagliato alla
  persona sbagliata.
- **I pulsanti non devono restare a girare** se la cifratura fallisce.

## I test automatici che già esistono

`src/drafts/share.test.ts` copre cifratura, password, canale e finestra senza
browser (`npm test`). Sono veloci e vanno tenuti verdi, ma **non** provano che
due dispositivi si scambino davvero il lavoro: quello lo prova solo il giro qui
sopra.
