# 16-17 settembre 2026 · `claude/pensive-pasteur-rb90qd` → `main` · sessione cloud

## Fatto

- Editor del testo riscritto: uno solo, le ad libs fra parentesi in giallo, i
  numeri di barra nel margine (una barra lunga che va a capo resta una barra
  sola). Il pulsante "Format preference" lo divide in due colonne affiancate,
  con l'altezza di ogni barra condivisa fra le due. `src/lyrics/bars.ts` + 34 test.
- Portati qui, da `claude/pensive-einstein-e78xle`: la **rimozione totale di
  Gemini** e la **condivisione delle bozze con codice cifrato**. **Scartato di
  proposito** il suo editor Writer/AD Libs con le "sporche": è quello che
  l'utente ha chiesto di sostituire.
- Riparato il difetto per cui **una traccia, un album o una bozza cancellati
  tornavano indietro** alla sincronizzazione successiva (`src/cloud/tombstones.ts`).
- Riparato il **player che si sovrapponeva ai comandi** a finestra stretta
  (segnalato dall'utente con due screenshot).
- Riparati otto difetti trovati dalla review del codice, fra cui: la finestra di
  condivisione che dopo un chiudi/riapri **bloccava le unioni per sempre**; il
  codice e la password di una bozza mostrati su un'altra; il testo battuto
  durante la decifratura che andava perso; la vecchia chiave Gemini che restava
  nel browser senza modo di cancellarla.
- Scritti `CLAUDE.md`, il registro, `docs/STATO_E_PROSSIMO_PASSO.md`,
  `docs/AUDIT.md` e `docs/PROMPT_AGENTE_LOCALE.md`. I quattro documenti
  precedenti sono passati in `docs/storico/` con un avviso in testa.

## Correzione in coda (17 settembre, pomeriggio)

L'utente ha provato a seguire le istruzioni appena scritte e non giravano: il
percorso del clone che gli avevo indicato non esisteva (si è ritrovato dentro un
`git init` accidentale in una cartella superiore, senza remoto e senza commit),
e tutti i comandi dei documenti usavano `bunx`, che su quella macchina non c'è.
`CLAUDE.md`, `docs/PROMPT_AGENTE_LOCALE.md` e l'hand-off ora usano gli script di
`package.json` (`npm run lint`, `npm test`, `npm run build`, `npm run dev`, che
funzionano anche con bun) e spiegano come **trovare** il clone invece di darne
per scontato il percorso. Provato con npm, non solo con bun.

## Seconda coda (17 settembre, sera): i difetti trovati dall'utente

Con due screenshot l'utente ha segnalato pulsanti tagliati dentro una bozza. Da
lì, misurando: i campi dentro le righe flex non potevano stringersi (mancava
`min-w-0`), e spingevano fuori il pulsante accanto — sette punti fra
`WorkingOn.tsx`, `TrackEditor.tsx` e `Library.tsx`. Sistemato anche il caso in
cui l'intestazione della bozza si accavallava a 390 px, e le due azioni che non
dicevano niente quando non potevano riuscire ("Carica" con un link non
riproducibile, "Sblocca" grigio senza spiegazione).

**Perché quei difetti erano sfuggiti**: la verifica responsive si fermava al
primo livello di ogni schermata e non entrava dentro una bozza né dentro una
traccia in modifica. Da qui le skill del progetto, in `.claude/skills/`:
`verifica-dal-vivo` (con lo script che apre otto viste a nove larghezze e misura
le posizioni vere, falsi allarmi delle barre fisse esclusi),
`condivisione-bozze` e `scrittura`.

Un falso allarme, per memoria: seminando una bozza a mano in `localStorage`
sembrava che l'app non salvasse più niente. Non era vero — con una bozza creata
dall'interfaccia si salva tutto e sopravvive al ricaricamento. Era il banco di
prova a essere sbagliato, ed è scritto nella skill perché non ricapiti.

## Come è nato il disordine che questa sessione ha ripulito

La sessione è partita su un branch nuovo creato da `main`, **senza che nessuno
le dicesse che il lavoro vero era su `claude/pensive-einstein-e78xle`**. Se ne è
accorta solo perché l'utente ha chiesto di controllare quale branch fosse il
migliore. Da qui la regola numero 1 in `CLAUDE.md`.

## Resta aperto

- Il fix delle cancellazioni copre tracce, album e bozze, ma la sincronizzazione
  vera con Firestore non è mai stata provata con un progetto reale.
- La **Feature 3 "da registrare"** non è mai stata committata: vive solo in una
  copia sciolta sul PC dell'utente.
- `claude/pensive-einstein-e78xle` resta come archivio del suo editor
  "sporche": tutto il resto di quel branch è stato portato qui.
