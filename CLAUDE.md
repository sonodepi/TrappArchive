# TrappArchive — regole per chi ci lavora

Questo file lo legge da sola ogni sessione di Claude Code che si apre in questa
cartella, locale o cloud che sia. Chi lo legge è tenuto a seguirlo.

---

## 1. Prima di scrivere una riga di codice: dove siamo

Il disordine più costoso di questo progetto non è mai stato il codice: è stato
**non sapere cosa avevano fatto le altre sessioni**. È già successo che una
sessione partisse da `main` e riscrivesse da zero una cosa che su un altro
branch era già fatta, perché nessuno gliel'aveva detto.

**Questa parte adesso la fa l'hook**, non la tua buona volontà. All'apertura
di ogni sessione in questa cartella, `.claude/hooks/session-start.sh` esegue il
`fetch` e ti stampa davanti: i branch che esistono con la data dell'ultimo
commit, chi sta lavorando su cosa, e **un avviso se il branch su cui ti hanno
messo è indietro rispetto a `origin/main`**. Parte anche dentro un worktree, che
è come lavora un ufficio di agenti in parallelo.

Se quello stato non compare, l'hook non è partito: fallo partire a mano e
guarda perché, invece di lavorare alla cieca.

```bash
./.claude/hooks/session-start.sh
```

Il controllo che l'hook non può fare per te è **dove sei**:

```bash
pwd && git remote -v          # sono nel clone vero o in una copia sciolta?
```

**Se `git remote -v` non stampa `sonodepi/TrappArchive`, sei nel posto
sbagliato**: una copia sciolta, oppure dentro un `git init` fatto per sbaglio in
una cartella superiore (succede, e da lì `git pull` risponde
`'origin' does not appear to be a git repository`). Trova il clone vero prima di
lavorare:

```bash
find ~ -maxdepth 4 -name .git -type d 2>/dev/null | while read g; do
  d=$(dirname "$g"); printf '%s → ' "$d"
  git -C "$d" remote get-url origin 2>/dev/null || echo "(nessun remoto)"
done
```

Poi leggi, in questo ordine:

1. `docs/REGISTRO_SESSIONI.md` — l'indice di chi ha fatto cosa, e da lì il file
   della sessione che ti riguarda in `docs/registro/`;
2. `docs/STATO_E_PROSSIMO_PASSO.md` — lo stato vero e cosa manca;
3. `docs/AUDIT.md` — l'ultimo controllo, con i difetti ancora aperti.

**Se il branch su cui ti hanno messo è indietro rispetto a un altro che
contiene lavoro vero: fermati e dillo all'utente.** Non ripartire da `main`
facendo finta di niente: è esattamente così che sono nati editor doppi e
funzioni riscritte due volte.

**Aprendo**, scrivi la tua riga in `docs/registro/IN_CORSO.md`: branch,
macchina, su cosa stai per mettere le mani. È quello che l'hook stampa alla
sessione dopo la tua, ed è l'unico modo che ha per sapere che quel file è già
occupato.

**Prima di chiudere**, crea `docs/registro/AAAA-MM-GG-<ultimo pezzo del
branch>.md` con cosa hai fatto, cosa hai verificato **e come**, cosa resta
aperto; aggiungi la riga nell'indice `docs/REGISTRO_SESSIONI.md`; e **togli la
tua riga da `IN_CORSO.md`**, che se resta lì blocca un'altra sessione per
niente. Vale anche se non hai committato niente.

Un file per sessione, mai un file condiviso: con due sessioni in parallelo un
registro unico si scontra al merge ogni volta, e chi perde il conflitto perde
anche la riga dell'altro.

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
npm install          # oppure bun install, se bun c'è
npm run lint         # tipi (tsc --noEmit), strict
npm test             # test
npm run build        # build di produzione
npm run dev          # sviluppo su http://localhost:3000
```

Sono gli script di `package.json`, quindi le stesse righe funzionano con npm e
con bun (`bun install`, `bun run lint`, …). Il CI usa bun, ma **non dare per
scontato che bun sia installato sulla macchina dove ti trovi**: sul PC
dell'utente non c'è, e un documento pieno di `bunx` lì non gira.

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

## 6. Le skill del progetto

In `.claude/skills/` ci sono tre skill che arrivano con il repository: non c'e'
niente da installare, ogni sessione aperta qui le vede.

| Skill | A cosa serve |
|---|---|
| `verifica-dal-vivo` | Controllare l'app come la usa una persona: entrare nelle sotto-schermate e misurare le posizioni reali a nove larghezze. Contiene lo script che lo fa da solo |
| `condivisione-bozze` | Il giro completo fra due dispositivi, con i selettori giusti |
| `scrittura` | Come si scrive qui: commit, documenti, commenti, testi dell'interfaccia |

**Dopo ogni modifica all'interfaccia** si fa girare
`node .claude/skills/verifica-dal-vivo/controlla-schermate.mjs` (serve
Playwright, vedi la skill). I tre difetti che l'utente ha trovato prima di noi
stavano tutti dietro un clic e a larghezze intermedie: quella e' la passata che
li prende.

## 7. Documenti

| File | Cosa contiene |
|---|---|
| `docs/STATO_E_PROSSIMO_PASSO.md` | Stato attuale, rischi noti, prossimo passo |
| `docs/REGISTRO_SESSIONI.md` | **Indice** delle sessioni: data, branch, due righe |
| `docs/registro/` | Una sessione per file, e `IN_CORSO.md` con chi lavora adesso |
| `docs/AUDIT.md` | Ultimo controllo completo, con i difetti ancora aperti |
| `docs/PROMPT_AGENTE_LOCALE.md` | Prompt pronti per far girare audit e lavori da un terminale locale |
| `docs/storico/` | Documenti superati, tenuti per capire come si è arrivati qui. **Non** sono istruzioni valide |
