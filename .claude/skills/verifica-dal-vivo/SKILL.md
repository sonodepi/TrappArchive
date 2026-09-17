---
name: verifica-dal-vivo
description: Controllare l'app come la usa una persona, non come la vedono i test — avviarla, aprirla nel browser, entrare nelle sotto-schermate e misurare le posizioni reali degli elementi a piu' larghezze. Da usare dopo ogni modifica all'interfaccia, prima di dire che una cosa funziona, e quando l'utente segnala che qualcosa "esce dai box", si sovrappone o non si vede.
---

# Verificare dal vivo

In questo progetto i test verdi sono già passati mentre qualcosa di reale era
rotto, ed è successo più di una volta. Questa skill è il modo di guardare per
davvero.

## La regola che questa skill esiste per ricordare

**Il primo livello di una schermata non è la schermata.**

I tre difetti veri trovati finora stavano tutti dietro un clic:

| Difetto | Dove si nascondeva |
|---|---|
| Il visualizzatore stampato sopra il tasto play | solo con la finestra fra 768 e 1280 px |
| "Sblocca" e "Carica" tagliati a metà | solo **dentro** una bozza, non nell'elenco |
| "Unisci" sopra il titolo e la freccia indietro | solo dentro una bozza, solo a 390 px |

Tutti e tre li ha visti l'utente prima di me, perché la mia verifica si fermava
all'elenco e a due larghezze. Non farlo.

## Il controllo automatico

```bash
npm run build
npx vite preview --port 4173 &
node .claude/skills/verifica-dal-vivo/controlla-schermate.mjs
```

Apre otto viste (elenco bozze, **dentro** una bozza, libreria, **una traccia in
modifica**, nuova traccia, album, backup, impostazioni) a nove larghezze da 390
a 1600 px e dice cosa non va: elementi che escono dal bordo, comandi che si
coprono a vicenda, scorrimento orizzontale, errori in console. Le schermate dei
casi rotti finiscono in `.tmp/verifiche/`, che git ignora: aprile, o mandale
all'utente.

Serve Playwright, che **non** è fra le dipendenze del progetto — servirebbe solo
a chi verifica, e costerebbe a tutti gli altri un browser da scaricare:

```bash
npm i -D playwright && npx playwright install chromium
```

Esce con codice 1 se ha trovato qualcosa, quindi si può incatenare a un `&&`.

### Cosa il controllo non segnala, e perché

- **Il contenuto che passa sotto la barra del player o la navigazione in fondo**:
  quelle barre sono fisse e stanno sopra per costruzione. Vengono confrontati
  solo elementi dello stesso piano.
- **Il pezzo di un elemento tagliato dal bordo di un'area che scorre**: conta il
  rettangolo che si vede, non quello teorico.

Sono le due famiglie di falsi allarmi che rendono inutile uno strumento del
genere, ed è per questo che sono escluse.

## Quando serve l'occhio, non lo script

Lo script trova sovrapposizioni e sforamenti. **Non** trova: testo illeggibile,
spaziature storte, un pulsante che c'è ma non si capisce cosa fa, un'animazione
che dà fastidio. Per quelle cose si guarda, e si guarda alla larghezza in cui
lavora l'utente — che qui è una finestra di circa 1050 px, mezzo schermo, non
un monitor intero.

Per una schermata sola, in fretta:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1050, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:4173/');
// ... arrivaci come ci arriva una persona: clic dopo clic ...
await page.screenshot({ path: '.tmp/verifiche/prova.png' });
```

## Cose da sapere di questa app, per non perdere tempo

- **Prima cosa che chiede**: il nome (`Come ti chiami?`). Riempi
  `getByPlaceholder('es. Depi')` e premi `Continua`, altrimenti le bozze non si
  aprono nemmeno.
- **Semina i dati dall'interfaccia**, non scrivendo in `localStorage` a mano: una
  bozza scritta a mano in archivio si apre ma non si comporta come una vera, e
  si finisce a inseguire difetti che non esistono. (Successo. Un'ora persa.)
- **La verifica va fatta sulla build**, non su `npm run dev`: è quello che
  finisce online.
- **È una PWA**: dopo un cambiamento, se guardi a mano nel tuo browser, ricarica
  con Ctrl-Shift-R, se no il service worker ti mostra la versione vecchia.
- Una **sovrapposizione va misurata**, non guardata: `getBoundingClientRect()` di
  entrambi gli elementi e si confrontano i bordi. "Sembra a posto" non è un
  risultato.

## Come si riferisce quello che si è visto

Numeri, non aggettivi. Non «il player era rotto e ora è a posto», ma:

> A 1180 px la colonna dei comandi finiva a 848 e il visualizzatore partiva da
> 740: 108 px di sovrapposizione. Dopo: 830 contro 805, nessuna.

E se una cosa non è stata provata, si dice che non è stata provata.
