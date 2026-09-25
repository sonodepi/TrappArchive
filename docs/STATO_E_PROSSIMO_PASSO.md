# Stato del progetto e prossimo passo

Aggiornato il **17 settembre 2026**, quando il lavoro sparso su più branch è
stato unito e portato su `main`.

---

## In due righe

L'app è una PWA local-first per catalogare tracce e scrivere testi, anche in
gruppo. Adesso `main` contiene tutto il lavoro buono: editor del testo nuovo,
condivisione delle bozze con codice cifrato, niente più Gemini, e la
sincronizzazione che non fa più risorgere quello che cancelli.

## Due macchine, da non confondere

Il lavoro passa da **due ambienti che non condividono niente**:

1. **Sessione cloud** (claude.ai/code): contenitore effimero, repo clonato in
   `/home/user/TrappArchive`, `bun` disponibile, push diretto su GitHub. **Non
   vede il PC dell'utente.**
2. **Sessione locale** (VS Code / terminale): il clone vero sul PC. **Il suo
   percorso non è scontato, e al 25 settembre i candidati sono due** — è già capitato di cercarlo dove non era, e di
   finire dentro un `git init` accidentale in una cartella superiore. Si trova
   così, senza toccare niente:

   ```bash
   find ~ -maxdepth 4 -name .git -type d 2>/dev/null | while read g; do
     d=$(dirname "$g"); printf '%s → ' "$d"
     git -C "$d" remote get-url origin 2>/dev/null || echo "(nessun remoto)"
   done
   ```

   Su quella macchina c'è **npm**, non bun: i comandi sono `npm install`,
   `npm run lint`, `npm test`, `npm run build`, `npm run dev`.

Prima di dare per scontato dove ti trovi: `pwd` e `git remote -v`. Se il remoto
non è `sonodepi/TrappArchive`, sei nel posto sbagliato.

**Per aprire una sessione locale da zero**, il passaggio di consegne completo —
dove cercare il clone, cosa mettere al sicuro prima di toccare qualcosa, su
quale branch si lavora — è la **sezione 0 di `docs/PROMPT_AGENTE_LOCALE.md`**,
già pronta da incollare.

## Cosa c'è su `main` adesso

- **Editor del testo, uno solo.** Il testo di una canzone è una stringa sola:
  quello fra parentesi è una ad lib e si vede in giallo, il resto è la barra. Il
  numero nel margine conta le barre, non le righe dello schermo: una barra lunga
  che va a capo resta una barra sola. Il pulsante **Format preference** divide la
  stessa identica stringa in due colonne — barre a sinistra, ad libs a destra —
  con l'altezza di ogni barra condivisa fra le due, e le rimette insieme. È una
  preferenza di lettura, salvata, e vale in tutte le schermate dove si scrive.
- **Condivisione delle bozze con un codice cifrato**, al posto dello scambio di
  file: AES-GCM + PBKDF2, password generata dall'app, da mandare per un canale
  diverso dal codice. Il capo apre e chiude la finestra delle unioni.
- **Niente più Gemini.** La trascrizione AI è stata rimossa del tutto dopo che la
  chiave del progetto Google era finita nella storia pubblica del repository ed
  è stata revocata. **Non va ripristinata** senza parlarne.
- **Le cancellazioni non tornano indietro.** Vedi `docs/AUDIT.md` §2.1.
- **Player e schermate sistemati** alle larghezze intermedie.
- **Un hook che stampa lo stato a ogni sessione**, così nessuno riparte alla
  cieca: branch esistenti, chi lavora su cosa, e l'avviso se il branch assegnato
  è indietro rispetto a `main`. Funziona anche dentro un worktree.
- **Controlli sui branch e sulle pull request** (`.github/workflows/ci.yml`),
  non solo dopo la pubblicazione.
- **Passata di sicurezza mirata** con la skill di Cloudflare: tre difetti
  riparati, due punti lasciati aperti e scritti. Vedi `docs/AUDIT.md`.

### Cosa è stato scartato di proposito

L'editor **Writer / AD Libs con le "sporche" agganciate al testo**, che sta su
`claude/pensive-einstein-e78xle`. È stato sostituito, su richiesta esplicita
dell'utente, dall'editor unico descritto sopra. Quel branch resta come archivio:
**non va rimesso dentro**. Tutto il resto di quel branch è già qui.

## ⚠️ Cose che vanno sapute, e che non sono nel repository

### 1. La "Feature 3 — da registrare": salvata (26 settembre)

Era committata solo nel clone del PC (`dc1b666`, 24/09) e mai pushata, mentre
sul remoto il branch andava avanti con altri documenti: i due lati si erano
divisi dopo `f502527`. Il 26/09 sono stati riuniti con un merge sul branch
**`trapparchivebranch`**, pushato. Le copie sciolte (Scrivania, Scaricati,
archivio del 24, zip nel cestino) non contengono più niente che non sia in
git: dettagli e confronti in `docs/registro/2026-09-26-trapparchivebranch.md`.

### 2. La sincronizzazione cloud non è mai stata provata sul serio

La logica è pura e coperta da test, e il difetto delle cancellazioni è stato
riparato, ma **nessuno ha mai fatto un giro completo con un progetto Firebase
reale e due dispositivi**. Finché non succede, trattarla come non verificata.

### 3. Nessun umano ha ancora riletto questo lavoro

Condivisione cifrata e sincronizzazione sono state scritte e verificate da
sessioni automatiche. Una rilettura umana di `src/drafts/share.ts` e
`src/cloud/` è la cosa più utile che possa fare una persona su questo progetto.

## Voicebox: la dettatura c'è già, la trascrizione è una strada aperta

[Voicebox](https://github.com/jamiepine/voicebox) (MIT) è uno studio vocale che
gira **tutto sul dispositivo**: Whisper per capire il parlato, niente chiave,
niente cloud. **Non può diventare una dipendenza di TrappArchive** — è un'app
desktop con un backend Python e modelli da giga, questa è una PWA su GitHub
Pages senza server. Ma due cose sono vere:

- **Dettare le barre, oggi, senza scrivere una riga di codice.** La dettatura
  globale con push-to-talk scrive nel campo che hai sotto il cursore: anche
  nell'editor del testo. Non serve nessuna integrazione.
- **È la risposta locale alla trascrizione che abbiamo tolto.** Quella con
  Gemini è stata rimossa dopo che la chiave era finita nella storia pubblica
  del repository. Whisper in locale rispetterebbe la regola local-first.
  **Resta una decisione dell'utente** («toglila, vedremo in avanti»): è segnata
  come strada possibile, non come lavoro da fare.
  **E prima di prometterla va verificata una cosa**: una pagina servita in
  `https://` che chiama `http://127.0.0.1:17493` può essere bloccata dal
  browser come contenuto misto. Non l'ho provato, quindi non lo do per buono.

## Prossimo passo consigliato

Nell'ordine:

1. **Portare `trapparchivebranch` su `main`** (fast-forward), che la pubblica.
2. **Portare `vitest` a 4.1.11 o oltre**, da solo, con il suo commit:
   [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).
   È un cambio di versione maggiore sotto 146 test, quindi non va infilato in
   coda a nient'altro. Non arriva a chi usa l'app: `vitest` non finisce nel
   pacchetto pubblicato.
3. **Provare la sincronizzazione** con un progetto Firebase vero, incollando
   `firestore.rules` nella console Firebase, e con due dispositivi: creare,
   modificare, **cancellare** e verificare che la cancellazione regga.
4. **Usare l'app per scrivere davvero un pezzo**, e segnare cosa dà fastidio:
   è il tipo di difetto che i test non trovano (il player sovrapposto ai comandi
   l'ha trovato l'utente, non la suite).
5. Se si vuole l'allineamento esatto col CI, installare `bun` sul PC invece di
   usare `npm`. È anche il motivo per cui `npm audit` qui non gira (`ENOLOCK`:
   c'è `bun.lock`, non `package-lock.json`).

## Dove guardare

| File | Cosa contiene |
|---|---|
| `CLAUDE.md` | Le regole, incluso cosa fare **prima** di scrivere codice |
| `docs/REGISTRO_SESSIONI.md` | Chi ha fatto cosa, su quale branch |
| `docs/AUDIT.md` | L'ultimo controllo completo e i difetti ancora aperti |
| `docs/PROMPT_AGENTE_LOCALE.md` | **§0 = il passaggio di consegne da incollare** in una sessione locale; poi lavori specifici e il verdetto sui repository controllati |
| `docs/UFFICIO_AGENTI.md` | Far lavorare più agenti insieme (Munder Difflin): le scrivanie, le loro skill, le regole |
| `docs/registro/` | Una sessione per file, e `IN_CORSO.md` con chi lavora adesso |
| `docs/storico/` | Documenti superati. Raccontano il passato, non danno istruzioni |
