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
2. **Sessione locale** (VS Code / terminale): il repo vero, in
   `~/Scrivania/code/progetti/TrappArchive/…`. Lì gira `bun run dev` e si vede
   l'app in tempo reale.

Prima di dare per scontato dove ti trovi: `pwd` e `git remote -v`.

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

### Cosa è stato scartato di proposito

L'editor **Writer / AD Libs con le "sporche" agganciate al testo**, che sta su
`claude/pensive-einstein-e78xle`. È stato sostituito, su richiesta esplicita
dell'utente, dall'editor unico descritto sopra. Quel branch resta come archivio:
**non va rimesso dentro**. Tutto il resto di quel branch è già qui.

## ⚠️ Cose che vanno sapute, e che non sono nel repository

### 1. La "Feature 3 — da registrare" non è committata da nessuna parte

Una sessione locale ha implementato lo stato `status?: 'da-registrare' |
'registrata'` (in `types.ts`, più modifiche a `TrackEditor.tsx` e `Library.tsx`)
dentro una **copia sciolta che non è un repository git**:

```
~/Scrivania/code/progetti/TrappArchive/TrappArchive-claude-trapparchive-app-review-x38gkz
```

Quel lavoro **non esiste su nessun branch e su nessun remoto**. Se quella
cartella viene cancellata o sovrascritta, sparisce senza lasciare traccia.

**Prima di qualunque pulizia**: copiare da lì `src/types.ts`,
`src/components/TrackEditor.tsx` e `src/components/Library.tsx`, portarli nel
clone vero e committarli.

### 2. La sincronizzazione cloud non è mai stata provata sul serio

La logica è pura e coperta da test, e il difetto delle cancellazioni è stato
riparato, ma **nessuno ha mai fatto un giro completo con un progetto Firebase
reale e due dispositivi**. Finché non succede, trattarla come non verificata.

### 3. Nessun umano ha ancora riletto questo lavoro

Condivisione cifrata e sincronizzazione sono state scritte e verificate da
sessioni automatiche. Una rilettura umana di `src/drafts/share.ts` e
`src/cloud/` è la cosa più utile che possa fare una persona su questo progetto.

## Prossimo passo consigliato

Nell'ordine:

1. **Salvare la Feature 3** dalla copia sciolta (rischio di perdita reale).
2. **Provare la sincronizzazione** con un progetto Firebase vero, incollando
   `firestore.rules` nella console Firebase, e con due dispositivi: creare,
   modificare, **cancellare** e verificare che la cancellazione regga.
3. **Usare l'app per scrivere davvero un pezzo**, e segnare cosa dà fastidio:
   è il tipo di difetto che i test non trovano (il player sovrapposto ai comandi
   l'ha trovato l'utente, non la suite).
4. Se si vuole l'allineamento esatto col CI, installare `bun` sul PC invece di
   usare `npm`.

## Dove guardare

| File | Cosa contiene |
|---|---|
| `CLAUDE.md` | Le regole, incluso cosa fare **prima** di scrivere codice |
| `docs/REGISTRO_SESSIONI.md` | Chi ha fatto cosa, su quale branch |
| `docs/AUDIT.md` | L'ultimo controllo completo e i difetti ancora aperti |
| `docs/PROMPT_AGENTE_LOCALE.md` | Prompt pronti per lavorare da un terminale locale |
| `docs/storico/` | Documenti superati. Raccontano il passato, non danno istruzioni |
