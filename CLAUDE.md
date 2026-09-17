# TrappArchive — regole per chi ci lavora

Questo file lo legge da sola ogni sessione di Claude Code che si apre in questa
cartella, locale o cloud che sia. Chi lo legge è tenuto a seguirlo.

---

## 1. Prima di scrivere una riga di codice: dove siamo

Il disordine più costoso di questo progetto non è mai stato il codice: è stato
**non sapere cosa avevano fatto le altre sessioni**. È già successo che una
sessione partisse da `main` e riscrivesse da zero una cosa che su un altro
branch era già fatta, perché nessuno gliel'aveva detto.

Quindi, ogni volta, nell'ordine:

```bash
pwd && git remote -v          # sono nel clone vero o in una copia sciolta?
git fetch --all --prune
git branch -r                 # quali branch esistono davvero
git log --oneline origin/main -5
```

Poi leggi, in questo ordine:

1. `docs/REGISTRO_SESSIONI.md` — chi ha fatto cosa, su quale branch;
2. `docs/STATO_E_PROSSIMO_PASSO.md` — lo stato vero e cosa manca;
3. `docs/AUDIT.md` — l'ultimo controllo, con i difetti ancora aperti.

**Se il branch su cui ti hanno messo è indietro rispetto a un altro che
contiene lavoro vero: fermati e dillo all'utente.** Non ripartire da `main`
facendo finta di niente: è esattamente così che sono nati editor doppi e
funzioni riscritte due volte.

**Prima di chiudere la sessione**, aggiungi la tua riga in
`docs/REGISTRO_SESSIONI.md`: data, branch, cosa hai fatto, cosa resta aperto.
Vale anche se non hai committato niente.

## 2. Branch

- `main` è l'unica fonte di verità, ed è ciò che viene pubblicato.
- I branch `claude/*` sono temporanei: o finiscono in `main`, o vengono
  dichiarati morti nel registro, con il motivo.
- Non lasciare lavoro solo in locale e non committato. Una copia non-git non è
  un posto dove tenere del lavoro: si perde, ed è già successo.

## 3. Regole del progetto, non negoziabili

- **Local-first.** Nessun server obbligatorio, nessun account obbligatorio.
  Tutto deve funzionare offline, sul dispositivo.
- **Mai perdere — né resuscitare — roba dell'utente.** Un editor che mangia una
  strofa o una sincronizzazione che fa tornare una traccia cancellata è un bug
  bloccante, non un dettaglio.
- **L'interfaccia non promette cose che non fa.** Se un pulsante non può
  funzionare, si toglie: non si lascia lì a mentire.
- **Italiano**: interfaccia e commenti nel codice. I commenti spiegano *perché*,
  non *cosa*.
- **I test verdi da soli non bastano.** In questo progetto sono già passati
  mentre qualcosa di reale era rotto: prova sempre dal vivo quello che tocchi.

## 4. Comandi

```bash
bun install          # o npm install se bun non c'è
bunx tsc --noEmit    # tipi, strict
bunx vitest run      # test
bunx vite build      # build di produzione
bun run dev          # sviluppo su http://localhost:3000
```

Un push su `main` ripubblica l'app su https://sonodepi.github.io/TrappArchive/
tramite `.github/workflows/deploy.yml`. Da un branch non pubblica niente.

## 5. Com'è fatta l'app, in breve

PWA React + TypeScript (strict) + Vite + Tailwind 4. Nessun backend.

| Cartella | Cosa c'è |
|---|---|
| `src/components/` | Le schermate. `Player`, `Library`, `TrackEditor`, `WorkingOn` (bozze), `Albums`, `ExportSection`, `Settings`, `LyricsEditor`, `AudioVisualizer` |
| `src/lyrics/` | Barre e ad libs: `bars.ts` è il parser, con i suoi test |
| `src/drafts/` | Scrittura in gruppo: `collab.ts` (unione) e `share.ts` (codice cifrato) |
| `src/audio/` | Decodifica e analisi locale di BPM e tonalità (DSP, con test) |
| `src/storage/` | localStorage e IndexedDB, più `migrate.ts` che valida tutto ciò che entra |
| `src/cloud/` | Sincronizzazione Firestore **facoltativa**: `sync.ts` (puro, testato), `tombstones.ts`, `firebase.ts` |
| `src/settings/` | Impostazioni locali, identità dell'autore |

Cose da sapere prima di toccarle:

- **Il testo di una canzone è una stringa sola.** Quello fra parentesi è una ad
  lib, il resto è la barra. La vista a due colonne è una proiezione, non un
  secondo formato salvato (`src/lyrics/bars.ts`).
- **La chiave Firebase non è un segreto** (vedi il commento in
  `src/cloud/firebase.ts`): a proteggere i dati sono le regole in
  `firestore.rules`.
- **La trascrizione AI con Gemini è stata rimossa** e non va ripristinata senza
  parlarne con l'utente: la chiave del progetto Google era finita nella storia
  pubblica del repository ed è stata revocata.
- **I file audio non salgono sul cloud**: un documento Firestore arriva a 1 MiB.
  Sale solo la scheda della traccia.

## 6. Documenti

| File | Cosa contiene |
|---|---|
| `docs/STATO_E_PROSSIMO_PASSO.md` | Stato attuale, rischi noti, prossimo passo |
| `docs/REGISTRO_SESSIONI.md` | Registro delle sessioni: data, branch, esito |
| `docs/AUDIT.md` | Ultimo controllo completo, con i difetti ancora aperti |
| `docs/PROMPT_AGENTE_LOCALE.md` | Prompt pronti per far girare audit e lavori da un terminale locale |
| `docs/storico/` | Documenti superati, tenuti per capire come si è arrivati qui. **Non** sono istruzioni valide |
