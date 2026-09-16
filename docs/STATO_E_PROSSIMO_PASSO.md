# Stato del progetto e prossimo passo

Questo file esiste perché sessioni precedenti lo citavano come già presente
("regole del progetto, decisioni già prese") ma su questo branch non c'era
mai stato scritto. Lo scrivo ora, da una sessione cloud, per passare lo stato
reale a chi riprende — locale o cloud che sia — senza doverlo ricostruire a
memoria.

## Due macchine, non confonderle

Questo lavoro è stato fatto in **due ambienti diversi**, che NON condividono
filesystem:

1. **Sessione cloud** (questa): sandbox effimero, repo clonato in
   `/home/user/TrappArchive`, gestore `bun` disponibile. Push diretto su
   GitHub. Non ha accesso al PC dell'utente.
2. **Sessione locale** (VS Code, sul PC): repo vero in `~/TrappArchive`. Il
   percorso `~/Scrivania/code/progetti/TrappArchive/TrappArchive-claude-...`
   citato in prompt precedenti **non è un repository git**: è una copia
   sciolta, usata per un audit ma non collegata a nessun remoto. `bun` non è
   installato lì: le sessioni locali hanno usato `npm install` come
   ripiego — funziona, ma il `bun.lock` non garantisce le stesse versioni
   esatte del CI. Se conta, installare `bun` sul PC.

Qualunque sessione futura: verificare `pwd` e `git remote -v` prima di
assumere di essere nell'uno o nell'altro.

## Repository e branch

- `sonodepi/TrappArchive` su GitHub.
- Branch di lavoro: `claude/pensive-einstein-e78xle`, avanti rispetto a
  `main`. Nessuna pull request aperta finora.
- `main` **non ha** nessuna delle feature descritte sotto: né le sporche, né
  la condivisione a codice, né la rimozione di Gemini.

## Cosa è stato fatto su questo branch

1. **Editor Writer / AD Libs con le sporche** (`src/components/LyricsEditor.tsx`,
   `src/components/lyrics/sporche.ts` + test, `Track.sporche` opzionale in
   `types.ts`, letto in modo difensivo da `parseTrack` in `storage/migrate.ts`).
   Una sporca si aggancia a "dopo la parola N della riga R"; se N supera le
   parole della riga si vede in colonna, altrimenti in mezzo al verso. Righe
   cancellate o testo incollato da capo non fanno sparire le sporche: finiscono
   in una zona "Non agganciate", mai perse in silenzio. Verificato dal vivo
   (scrittura, reload di pagina, taglio di parole, cancellazione di righe).

2. **Condivisione delle bozze a codice cifrato**, al posto dello
   scambio-file (`src/drafts/share.ts` + test). AES-GCM + PBKDF2 (210k
   iterazioni), password OTP generata dall'app. Il capo apre/chiude una
   "finestra" (`DraftProject.shareSessionId`, opzionale): un codice generato
   mentre è aperta entra solo se l'id combacia con quello **attualmente**
   aperto su chi lo riceve, non con quello di quando è stato cifrato — quindi
   chiudere ha un effetto reale anche su un codice già in giro. **Non è una
   revoca crittografica**: chi ha già codice e password può sempre leggerli,
   solo non unirli più. Riusa `mergeDrafts`/`describeMerge`
   (`drafts/collab.ts`) e `parseDraft` (`storage/migrate.ts`) senza
   riscriverli. Verificato dal vivo con due profili browser separati (due
   "dispositivi" con storage indipendente).

3. **Rimossa la trascrizione AI con Gemini**, interamente. La chiave del
   progetto Google `gen-lang-client-0184037090`, finita nella storia pubblica
   del repository, è stata **revocata dall'utente** (confermato: non
   funziona più) e la feature che la usava è stata tolta, non solo la chiave:
   `src/services/gemini.ts`, `gemini-types.ts`, `src/audio/wav.ts` (usato solo
   da Gemini) eliminati; dipendenza `@google/genai` tolta da `package.json`;
   UI e stato relativi spariti da `TrackEditor.tsx` e `Settings.tsx`; campi
   `geminiApiKey`/`geminiModel`/`transcriptionLanguage` tolti da
   `settings/types.ts`. **Firebase (sync cloud) non è stato toccato**: è un
   prodotto Google diverso, con chiave pubblica non segreta (vedi il commento
   in `src/cloud/firebase.ts`), e non era coinvolto nella fuga. Verificato:
   lint pulito, 110 test verdi, giro dal vivo senza errori console.

## Cosa NON è qui, e va saputo

### Feature 3 ("da registrare") esiste solo in una copia locale non committata

Una sessione locale ha implementato lo stato `status?: 'da-registrare' |
'registrata'` (in `types.ts`, più modifiche a `TrackEditor.tsx` e
`Library.tsx`) **nella copia sciolta** `~/Scrivania/code/progetti/
TrappArchive/TrappArchive-claude-trapparchive-app-review-x38gkz`. Quella
copia **non è un repository git**: quel lavoro non è committato da nessuna
parte, su nessun branch, su nessun remoto. Se quella cartella viene
cancellata o sovrascritta, quel lavoro sparisce senza lasciare traccia.

**Prima di qualunque pulizia di quella cartella**: copiare `types.ts`,
`TrackEditor.tsx` e `Library.tsx` da lì, o meglio ancora inizializzare un
repo/patch e applicarlo su `~/TrappArchive` (il clone vero), poi committare.

### Difetto verificato nella sincronizzazione cloud: le cancellazioni non si propagano

Un audit di una sessione locale ha segnalato tre difetti (etichettati M1,
C1, C2, C3 nel suo rapporto) sui quattro file di `src/cloud/`. Non ho quel
rapporto — **ma ho verificato il nucleo del problema direttamente sul codice
di questo branch**, ed è reale:

- `tombstone()` è definita in `src/cloud/schema.ts:90` e usata nei test
  (`sync.test.ts`), ma **non viene mai chiamata nel percorso vero
  dell'applicazione**.
- `handleDeleteTrack` (`App.tsx:146`) e `handleDeleteAlbum` (`App.tsx:172`)
  cancellano la voce dall'elenco locale con un semplice `.filter(...)` — non
  scrivono nessuna lapide (`{ ...voce, deleted: true }`) da mandare al cloud.
  Stesso schema per le bozze in `WorkingOn.tsx` (`confirmDelete`).
- Conseguenza: alla sincronizzazione successiva, `reconcile()`
  (`cloud/sync.ts`) trova la voce ancora presente e non cancellata sul
  cloud, non la trova più in locale, e la considera "arrivata da un altro
  dispositivo" — **la fa tornare** (`cloud/sync.ts:96-103`,
  `useCloudSync.ts:172-176`). Una traccia, un album o una bozza cancellati
  su un dispositivo **risorgono** al primo sync da un altro.

Riguarda tutte e tre le collezioni (tracce, album, bozze): è verosimilmente
quello che l'audit locale chiamava C1/C2/C3. Non l'ho corretto in questa
sessione — è un cambiamento che tocca il flusso di cancellazione in tre
punti diversi e merita la sua sessione dedicata, non un'aggiunta di corsa in
coda a un handoff.

**Il fix, in breve**: prima di rimuovere una voce dall'elenco locale in
`handleDeleteTrack`/`handleDeleteAlbum`/`confirmDelete`, se la sincronizzazione
cloud è configurata va creata una lapide con `tombstone()` e tenuta da
qualche parte finché non viene inviata al cloud (oggi la voce sparisce
subito dallo stato React, quindi non c'è più niente da mandare al prossimo
sync). Il modo più semplice è probabilmente marcare la voce come `deleted:
true` invece di toglierla dall'array, lasciare che il prossimo sync la
mandi come lapide, e solo allora toglierla per davvero dall'elenco locale —
ma è una scelta di design da fare con calma, non da improvvisare qui.

## Regole non negoziabili del progetto

- Locale prima di tutto: nessun server obbligatorio, nessun account
  obbligatorio.
- Mai perdere testo scritto dall'utente. Un editor o una sincronizzazione che
  perde una strofa è un bug bloccante.
- Interfaccia in italiano, commenti nel codice in italiano.
- L'app deve fare quello che l'interfaccia promette.
- Test verdi non bastano da soli: verificare sempre a mano (`bun run dev` /
  `npm run dev`), perché in questo progetto sono già passati mentre qualcosa
  di reale era rotto.

## Prossimo passo consigliato

Nell'ordine:

1. **Salvare la Feature 3** dalla copia locale non committata (rischio di
   perdita reale, vedi sopra) prima di qualunque altra cosa.
2. **Decidere se aprire una pull request** per `claude/pensive-einstein-e78xle`
   verso `main`: il branch è avanti di quattro commit, testato e verificato
   dal vivo ad ogni passo, ma nessuno l'ha ancora guardato con occhi umani.
3. **Affrontare il difetto della sincronizzazione cloud** (sopra): tocca
   tracce, album e bozze, tre punti di codice diversi, va fatto con
   attenzione e con nuovi test in `sync.test.ts` che riproducano prima il
   difetto e poi il fix.
4. Se si vuole allineare `bun.lock` a quanto gira davvero in CI, installare
   `bun` sulla macchina locale invece di continuare con `npm`.
