# MASTER PROMPT — TrappArchive → applicazione realmente funzionante

> **Come si usa questo file.** Tutto ciò che sta sotto la riga `=== INIZIO PROMPT ===`
> va incollato in Google AI Studio come singola direttiva operativa. Non è una
> recensione: è una specifica tecnica + QA plan + direttiva di rimozione.
> Il testo sopra quella riga è per te, non per il modello.

**Baseline verificata il 2026-09-08** sul branch `claude/trapparchive-app-review-x38gkz`:
`npm audit` = 0 vulnerabilità · `tsc --noEmit` (strict) = 0 errori · 23/23 test passano ·
build di produzione OK · smoke test in Chromium headless = 0 errori in console.
Il prompt parte da questo stato e **vieta esplicitamente di rifarlo**.

---

=== INIZIO PROMPT ===

# RUOLO

Sei l'ingegnere responsabile della messa in produzione di **TrappArchive**, una
PWA local-first per catalogare tracce rap/trap (metadati, testi, BPM, tonalità,
album, bozze di scrittura).

Non sei un assistente che propone miglioramenti. Sei l'ingegnere che porta questa
codebase da "sembra funzionare" a "funziona davvero", e che risponde di ogni
affermazione che l'interfaccia fa all'utente.

Il tuo criterio di giudizio è uno solo:

> **L'interfaccia non deve mai affermare qualcosa di falso all'utente.**

Un pulsante che promette un'azione deve compierla. Un messaggio di successo deve
seguire un successo verificato. Un grafico deve rappresentare dati reali. Un
codice di sessione deve connettere a qualcosa. Dove non è possibile, l'elemento
va **rimosso**, non mascherato.

---

# STATO DI PARTENZA — NON RIFARE QUESTO LAVORO

Le seguenti aree sono già state riscritte, testate e verificate. **Non
rifattorizzarle, non riscriverle, non "migliorarle".** Toccale solo se un tuo
intervento le rompe, o dove questo documento lo richiede esplicitamente.

| Area | Stato | File |
|---|---|---|
| Motore DSP: BPM, tonalità, Camelot | Completo, 23 test su segnali sintetici | `src/audio/` |
| Client Gemini per trascrizione testi | Completo, chiave dell'utente, mai nel bundle | `src/services/gemini*.ts` |
| Schermata Impostazioni | Completa | `src/components/Settings.tsx` |
| Sicurezza dipendenze | 0 vulnerabilità, dipendenze inutili rimosse | `package.json` |
| TypeScript strict | Attivo, 0 errori | `tsconfig.json` |

Comandi di verifica che devono restare verdi **dopo ogni tua modifica**:

```
npx tsc --noEmit      # 0 errori
npx vitest run        # 23/23 passano (più quelli che aggiungerai)
npx vite build        # build completa
npm audit             # 0 vulnerabilità
```

Se una tua modifica fa fallire uno di questi comandi, non hai finito il task.

---

# PARTE 1 — DIFETTI ACCERTATI DA CORREGGERE

Ognuno di questi è stato verificato leggendo il codice. Non sono ipotesi. Sono
elencati in ordine di priorità: **non passare al successivo finché il precedente
non è chiuso e verificato**.

---

## D1 — CRITICO — L'audio caricato si perde a ogni ricaricamento

**Dove:** `src/components/TrackEditor.tsx` (`handleFileUpload`), `src/App.tsx` (persistenza)

**Cosa succede:** il file audio viene salvato come `URL.createObjectURL(file)`,
cioè un URL `blob:`. Quel riferimento vive solo nella sessione corrente del
browser. In `localStorage` finisce una stringa tipo
`blob:http://localhost/9f3a-...` che dopo un F5 **non punta più a nulla**.

**Perché è il difetto più grave:** da solo produce quattro sintomi che sembrano
bug distinti ma hanno un'unica causa:

1. La riproduzione non parte (D2).
2. Il visualizzatore ripiega su dati finti (D3).
3. L'analisi BPM/tonalità non è più rieseguibile.
4. La trascrizione AI non è più disponibile.

**Correzione richiesta:** persistere i **byte reali** del file, non il suo URL.

- Usa **IndexedDB** (l'unica API browser che memorizza `Blob`/`File` in modo
  durevole e con capienza adeguata a file audio; `localStorage` accetta solo
  stringhe ed è limitato a pochi MB).
- Struttura: un object store `audioFiles`, chiave = `track.id`, valore = il
  `Blob` più `{ mimeType, sizeBytes, originalName }`.
- In `Track` sostituisci `audioFilePath: string` con un riferimento esplicito
  che distingua i due casi possibili, così il codice non può più confonderli:
  un file locale in IndexedDB, oppure un URL remoto inserito a mano.
- Al caricamento della traccia, ricostruisci un object URL **fresco** dal blob
  letto da IndexedDB, e revocalo (`URL.revokeObjectURL`) allo smontaggio del
  componente per non accumulare memoria.
- Quando una traccia viene eliminata, elimina anche il suo blob: altrimenti lo
  storage cresce senza limite con file orfani.

**Gestione degli errori obbligatoria** (non opzionale, sono casi reali):

- **Quota superata** (`QuotaExceededError`): messaggio esplicito che dice quanto
  spazio serve e cosa fare. Non fallire in silenzio.
- **IndexedDB non disponibile** (modalità privata di alcuni browser): l'app deve
  continuare a funzionare per tutto il resto, dichiarando che i file audio non
  verranno conservati. Non deve andare in crash né mostrare una schermata bianca.
- **Blob mancante** per una traccia che dice di averlo (dati incoerenti da un
  import): stato visibile "file non disponibile, ricaricalo", non un errore muto.

**Migrazione:** le tracce già salvate hanno un `blob:` URL morto. Rilevalo
(`path.startsWith('blob:')`) e converti quel campo in uno stato esplicito
"audio mancante" con invito a ricaricare il file. **Non cancellare la traccia**:
i metadati e il testo scritti dall'utente sono la parte di valore e vanno
preservati.

**Test di accettazione (tutti devono passare):**
1. Carico un MP3 → chiudo completamente il browser → riapro → **l'audio si
   riproduce ancora**.
2. Carico un file, elimino la traccia, controllo IndexedDB → **nessun blob orfano**.
3. Simulo `QuotaExceededError` → **messaggio chiaro**, app viva.
4. Apro un catalogo salvato prima della modifica → **le tracce ci sono ancora**,
   con lo stato "audio mancante" al posto del `blob:` morto.

---

## D2 — CRITICO — L'import di un backup dichiara successo e poi perde i dati

**Dove:** `src/components/ExportSection.tsx:60-101` (`handleImportFile`),
`src/App.tsx:82-86` (effetto di salvataggio), `src/App.tsx:89-95` (listener storage)

**Cosa succede, passo per passo:**

1. `handleImportFile` scrive le tracce importate **direttamente in
   `localStorage`**, scavalcando lo stato React.
2. Lo stato `tracks` di `App.tsx` resta quello vecchio: la UI non mostra nulla
   di nuovo.
3. Il codice tenta di rimediare con `window.dispatchEvent(new Event('storage'))`
   (riga 94). **Non funziona.** Un `Event` generico non ha la proprietà `key`,
   che il listener di `App.tsx:90` legge per decidere cosa aggiornare. Nessun
   ramo scatta. La riga è codice morto. (In più, per specifica l'evento
   `storage` nativo è pensato per notificare le *altre* schede, non la propria.)
4. L'utente vede comunque il messaggio **"Importazione completata con
   successo"** (riga 91).
5. Alla prima modifica successiva — aggiungere una traccia, modificarne una,
   qualsiasi cosa — l'effetto di `App.tsx:82-86` riscrive `localStorage`
   partendo dallo stato vecchio: **i dati importati vengono cancellati
   definitivamente**.

Questo è esattamente il caso "successo dichiarato senza verifica" e va trattato
come tale.

**Correzione richiesta:**

- L'import **non deve scrivere in `localStorage`**. Deve risalire allo stato
  React tramite callback (`onImport(tracks, albums, drafts)`), lasciando che sia
  `App.tsx` l'unico proprietario della scrittura. Una sola fonte di verità.
- Rimuovi la riga `window.dispatchEvent(new Event('storage'))`: è morta.
- **Valida il file prima di importarlo.** Oggi basta un JSON sintatticamente
  valido. Verifica che sia un backup di TrappArchive (campo `app`), che la
  versione sia gestibile, e che ogni traccia abbia i campi obbligatori. Scarta
  le voci malformate contando quante ne hai scartate.
- **Il messaggio finale deve riportare numeri veri**, contati dopo l'inserimento
  effettivo: quante importate, quante saltate perché già presenti, quante
  scartate perché non valide. Se sono state importate 0 voci, il messaggio non
  può dire "completata con successo".
- **Chiedi conferma prima di procedere**, mostrando cosa sta per succedere
  ("stai per aggiungere 34 tracce e 3 album"). Usa una modale coerente con
  quelle già presenti nell'app.

**Test di accettazione:**
1. Esporto un catalogo, cancello tutto, reimporto → **tutto torna**, e resta
   dopo un ricaricamento.
2. Importo lo stesso file due volte → la seconda dice **"0 importate, N già
   presenti"**, e non crea duplicati.
3. Importo un JSON valido ma non di TrappArchive → **rifiutato con messaggio
   comprensibile**, catalogo intatto.
4. Importo un file troncato/corrotto → **errore gestito**, catalogo intatto.
5. Importo, poi **subito aggiungo una traccia** → i dati importati **sono ancora
   lì** (questo è il test che oggi fallisce).

---

## D3 — GRAVE — Il visualizzatore mostra uno spettro inventato

**Dove:** `src/components/AudioVisualizer.tsx:196-208`

**Cosa succede:** quando non c'è audio reale ma lo stato dice "in riproduzione",
il codice **genera uno spettro finto** con seni, esponenziali e `Math.random()`,
agganciato a un tempo fisso di 125 BPM cablato alla riga 147. Il commento alla
riga 197 lo chiama "High-precision organic musical procedural simulation".

Per l'utente è **indistinguibile da un analizzatore di spettro reale**. E, a
causa di D1, questo è il ramo che si attiva nella maggior parte delle sessioni
reali: l'utente guarda quasi sempre un'animazione decorativa credendo di vedere
il proprio brano.

**Correzione richiesta:**

- **Elimina completamente il ramo di simulazione** (righe 196-208) e la costante
  `beatTempo` a 125 BPM se non serve altrove.
- Quando non ci sono dati reali dall'`AnalyserNode`, mostra uno **stato vuoto
  onesto**: barre a riposo e un'etichetta che dice perché ("nessun audio in
  riproduzione" / "file non disponibile").
- Mantieni intatto il percorso reale (`getByteFrequencyData`, righe 136-144):
  quello è corretto e va conservato.
- Il file è di 629 righe per una sola funzione: dopo la rimozione, verifica che
  non resti codice morto (gradienti, modalità, buffer usati solo dal ramo finto).

**Test di accettazione:**
1. Nessuna traccia in riproduzione → barre a riposo, **nessuna animazione che
   simuli un segnale**.
2. Traccia in riproduzione con audio reale → lo spettro **reagisce al volume e
   si ferma in silenzio** (verificalo su un brano con una pausa netta).
3. Traccia il cui file manca → stato esplicito, **non un'animazione finta**.

---

## D4 — GRAVE — La collaborazione "a 4 mani" non connette nessuno

**Dove:** `src/components/WorkingOn.tsx:32` (`createDraft`), `60-86` (`handleJoin`),
`173` (testo dell'interfaccia)

**Cosa succede:** l'app genera un codice di sessione a 6 cifre, lo mostra in
grande (riga 423), e promette "collabora a 4 mani" (riga 173). Ma
`handleJoin` alla riga 64 cerca il codice **dentro l'array locale dei propri
draft**. Non esiste alcun trasporto di rete che possa collegare due dispositivi:
in tutta la codebase le sole chiamate uscenti sono il proxy Tunebat
(`utils/tunebat.ts:265`), una `fetch` su percorso locale
(`TrackEditor.tsx:112`) e l'SDK Gemini per la trascrizione. Nessun WebSocket,
nessun WebRTC, nessun server.

Peggio: se il codice non viene trovato (righe 65-81), l'app **crea una nuova
bozza vuota** chiamata `Collab Bozza (123456)` e la apre. L'operazione **non
fallisce mai**. Due persone su due dispositivi diversi che si scambiano il
codice ottengono ciascuna una bozza vuota separata, convinte di essere
connesse, e ognuna scrive nel vuoto.

**Decisione di prodotto — scegli UNA delle due, non una via di mezzo:**

**Opzione A (raccomandata): rimuovere la finzione, preservare il caso d'uso.**

La collaborazione in tempo reale richiede un server di segnalazione. Questo
contraddice il requisito local-first e introduce infrastruttura da mantenere.
Rimuovila, ma **non buttare il bisogno che c'era sotto** — scrivere un pezzo in
due resta legittimo. Sostituiscila con uno scambio esplicito basato su file:

- "Esporta bozza" → produce un file `.json` da mandare al collaboratore con
  qualunque mezzo (WhatsApp, mail, AirDrop).
- "Importa bozza" → la apre, mostrando **entrambe le parti** (`ownerLyrics` e
  `collaboratorLyrics`) e chi ha scritto cosa.
- Il modello dati a due voci già presente (`ownerLyrics`/`collaboratorLyrics`,
  `ownerReady`/`collabReady`) **si conserva**: cambia solo il trasporto.

Da rimuovere: `shareCode`, `handleJoin`, il campo per inserire il codice, il
riquadro che mostra il codice, `trapparchive_owned`, e la frase "collabora a 4
mani" se non descrive più il comportamento reale.

**Opzione B: implementarla davvero.** Solo se puoi realizzare WebRTC con un
server di segnalazione funzionante, gestione della riconnessione, risoluzione
dei conflitti sul testo concorrente e stato di presenza. Se non puoi portare a
termine **tutti** questi punti, scegli A. **Non è ammessa una terza via** in cui
il codice resta visibile ma non connette.

**Test di accettazione (Opzione A):**
1. Esporto una bozza, la importo su un altro profilo browser → **entrambi i
   testi ci sono**, attribuiti correttamente.
2. Nessun elemento dell'interfaccia promette più sincronizzazione in tempo reale.
3. Cerco `shareCode` nel sorgente → **nessuna occorrenza residua**.

---

## D5 — MEDIO — Google Drive è promesso e non esiste

**Dove:** `src/components/ExportSection.tsx:112` e `:132`

Il sottotitolo dice *"Scarica i backup del catalogo in formato JSON locale o
**sincronizza con Google Drive**"* e un commento intitola la card "Full Database
Backup **& Google Drive**". Nell'intera codebase non esiste una sola chiamata
all'API Drive, nessun OAuth, nessuna dipendenza Google.

**Correzione:** riscrivi il sottotitolo descrivendo **solo ciò che i due
pulsanti fanno davvero** (esportare e importare un JSON locale). Correggi il
commento. Non implementare Drive: richiederebbe OAuth, gestione di token e
refresh, revoca, scopes minimi e un flusso di consenso — infrastruttura che
contraddice il principio local-first per un beneficio che l'export su file già
copre.

**Test:** cerca `Drive` nel sorgente → nessuna occorrenza che prometta una
funzione inesistente.

---

## D6 — MEDIO — La riproduzione fallisce in silenzio

**Dove:** `src/components/Player.tsx:54` e `:77`

Entrambe le chiamate a `play()` terminano con `.catch(console.error)`. Quando
fallisce — file mancante, `blob:` morto, formato non supportato, autoplay
bloccato dal browser — l'utente **preme play e non succede nulla**. Nessun
messaggio. La console non la guarda nessuno.

**Correzione:** gestisci il rifiuto con uno stato di errore visibile nel player,
distinguendo almeno: file non disponibile, formato non supportato, riproduzione
bloccata dal browser (in quest'ultimo caso serve un gesto dell'utente, quindi il
messaggio deve invitare a premere di nuovo). Aggiungi anche un handler
sull'evento `error` dell'elemento `<audio>`, perché non tutti i fallimenti
passano dalla promise di `play()`.

**Test:** metto in riproduzione una traccia il cui file non esiste → **messaggio
comprensibile**, e il pulsante torna in uno stato coerente (non resta bloccato
su "in riproduzione").

---

## D7 — MEDIO — Privacy: lo scraping Tunebat passa da un proxy di terze parti

**Dove:** `src/utils/tunebat.ts:264`

Le richieste passano da `https://api.allorigins.win`, un proxy CORS pubblico non
affiliato. Ogni ricerca invia titolo e artista del brano a un operatore terzo
non dichiarato all'utente.

Nota che questa funzione è ormai **ridondante**: il motore di analisi locale
(`src/audio/analyze.ts`) calcola BPM e tonalità sul dispositivo, senza rete.

**Correzione:** valuta la rimozione completa di `scrapeTunebatUrl` e del proxy.
Se la mantieni come confronto manuale opzionale, l'interfaccia **deve dichiarare
esplicitamente** che i dati passano da un servizio di terze parti, prima che
la richiesta parta. Mantieni invece `getTunebatSearchUrl`, che apre un link nel
browser dell'utente e non invia nulla a nessuno.

---

## D8 — MINORE — Corse e incoerenze nella persistenza

**Dove:** `src/App.tsx:65-86`

L'effetto di salvataggio (righe 82-86) gira anche al primo render, quando
`tracks` è ancora `[]`, scrivendo un array vuoto in `localStorage` prima che
l'effetto di caricamento (righe 65-79) abbia applicato lo stato. Nel flusso
normale il render successivo ripristina il contenuto, ma la finestra di
inconsistenza è reale: se la scheda viene chiusa in quell'istante, o se il
caricamento fallisce, il catalogo risulta azzerato.

Inoltre i tre `catch {}` alle righe 71, 74 e 77 ingoiano un `localStorage`
corrotto **senza dirlo a nessuno**: l'utente vedrebbe un catalogo vuoto senza
alcuna spiegazione, e il salvataggio successivo cementerebbe la perdita.

**Correzione:**
- Non scrivere finché il caricamento iniziale non è completato (un flag
  `hasLoaded`, o carica lo stato con l'inizializzatore pigro di `useState`
  invece che in un effetto).
- Su dati corrotti: **non sovrascrivere**. Conserva il valore illeggibile sotto
  una chiave di recupero e informa l'utente che il catalogo non è stato letto,
  invece di ripartire da zero in silenzio.

---

# PARTE 2 — VERIFICA SISTEMATICA (nessuna eccezione)

Le correzioni sopra sono quelle già accertate. Devi comunque passare tutta
l'applicazione al setaccio: l'elenco non è esaustivo per costruzione.

## 2.1 Ogni elemento interattivo

La codebase contiene circa **105 gestori `onClick`**, così distribuiti:

| File | Interazioni |
|---|---|
| `WorkingOn.tsx` | 20 |
| `TrackEditor.tsx` | 19 |
| `Player.tsx` | 13 |
| `Library.tsx` | 13 |
| `Albums.tsx` | 11 |
| `AudioVisualizer.tsx` | 9 |
| `Sidebar.tsx` / `PWAInstallButton.tsx` / `ExportSection.tsx` | 5 ciascuno |
| `Settings.tsx` | 4 |
| `App.tsx` | 1 |

Per **ognuno**, rispondi e correggi dove serve:

1. Compie l'azione che il suo testo promette?
2. Modifica realmente lo stato dell'applicazione?
3. Il cambiamento **sopravvive a un ricaricamento**?
4. Cosa succede al doppio click, o al click durante un'operazione in corso? Le
   operazioni lunghe devono disabilitare il proprio controllo.
5. Dà un riscontro visibile? Un'azione senza conseguenze percepibili è un bug.
6. Gestisce il proprio fallimento **nell'interfaccia**, non solo in console?
7. È disabilitato quando non è utilizzabile, con un `title` che spiega perché?
8. Serve davvero, o esiste solo perché "potrebbe servire"?

Un controllo che non supera i punti 1, 2 o 5 va corretto o rimosso.

## 2.2 Ogni funzionalità — classificala

Compila questa matrice e **allegala al risultato finale**. Nessuna funzione può
restare senza verdetto.

| Funzione | Stato | Evidenza | Azione |
|---|---|---|---|

Stati ammessi: `FUNZIONANTE` · `PARZIALE` · `ROTTA` · `INCOMPLETA` · `INUTILE` ·
`DUPLICATA` · `NON VERIFICABILE` · `DA RIMUOVERE`.

**"Il codice esiste" non è evidenza.** L'evidenza è: ho eseguito questo flusso e
ho osservato questo risultato. Se non puoi verificare una funzione, il suo stato
è `NON VERIFICABILE` e va dichiarato — non promosso a funzionante.

## 2.3 Scenari obbligatori

Ogni funzione va provata in tutti questi stati, non solo nel percorso felice:

- **Percorso felice** — uso normale.
- **Stato vuoto** — prima installazione, nessun dato. Nessuna schermata vuota
  senza spiegazione e senza un'azione suggerita.
- **Input non valido** — campi vuoti, testo dove serve un numero, BPM negativo,
  titolo di 5000 caratteri, caratteri Unicode ed emoji, file non audio caricato
  come audio, file audio corrotto.
- **Valori limite** — 0 tracce, 1 traccia, 1000 tracce (la lista deve restare
  utilizzabile), file da 200 MB, brano di 10 secondi, brano di 20 minuti.
- **Azioni ripetute** — doppio click, click durante il caricamento, annulla e
  rilancia subito.
- **Riavvio** — chiudo e riapro: **cosa sopravvive e cosa no?** Documentalo.
- **Offline** — modalità aereo: l'app deve avviarsi, tutto il locale deve
  funzionare, e ciò che richiede rete deve dirlo chiaramente **prima** di essere
  tentato, non dopo il fallimento.
- **Recupero dall'errore** — dopo un fallimento, l'utente può riprovare senza
  ricaricare la pagina?
- **Navigazione** — cambio sezione a metà di un'operazione; il tasto indietro del
  browser; il lavoro non salvato deve essere protetto o preservato.
- **Mobile** — schermo da 360 px, rotazione, tastiera virtuale che copre i campi,
  area di tocco di almeno 44×44 px.

---

# PARTE 3 — REGOLE PERMANENTI

## 3.1 Local-first

Ogni funzione che può essere realizzata sul dispositivo **deve** esserlo. La rete
è ammessa solo dove è funzionalmente indispensabile. Oggi c'è **un solo** caso
legittimo: la trascrizione AI, che per natura richiede il servizio Gemini.

Prima di introdurre qualunque dipendenza di rete, dimostra che il risultato non è
ottenibile localmente.

## 3.2 Sicurezza e dati sensibili — vincoli non negoziabili

- **Nessuna chiave API, token, password o credenziale nel sorgente, nel bundle,
  nei log o nei file distribuiti.** La chiave Gemini appartiene all'utente, vive
  solo nel suo `localStorage`, sotto una chiave di storage separata da quella
  del catalogo, così che **i backup non possano esportarla**. Questo assetto
  esiste già: non indebolirlo.
- Non stampare mai una chiave, nemmeno parziale, nemmeno in un messaggio di
  errore.
- Valida ogni input dell'utente. Non costruire HTML da stringhe fornite
  dall'utente; nessun `dangerouslySetInnerHTML` su contenuto non sanificato.
- Un file importato è **input non fidato**: validane la struttura prima di
  usarlo.
- Non aggiungere analytics, crash reporting o telemetria. Nessun dato di questa
  applicazione deve lasciare il dispositivo senza un'azione esplicita
  dell'utente.
- Non introdurre sicurezza teatrale: niente offuscamento di valori che restano
  comunque leggibili, niente "cifratura" con chiave presente nel client. Se una
  protezione non regge a un'analisi seria, dichiara il limite invece di
  simularlo.

## 3.3 Compatibilità Android e iOS

L'obiettivo dichiarato è una build installabile su Android e iOS (l'ipotesi di
lavoro è Capacitor). Ogni scelta va valutata rispetto a questo vincolo:

- **IndexedDB** funziona nella WebView di entrambe le piattaforme: è la scelta
  giusta per D1.
- **Web Audio API — rischio concreto di audio muto su iOS.** In
  `AudioVisualizer.tsx:68-70` la riproduzione viene instradata dentro
  l'`AudioContext`: `createMediaElementSource(audio)` → `analyser` →
  `destination`. Da quel momento **il suono esce solo attraverso il contesto**.
  Su iOS l'`AudioContext` nasce sospeso e si sblocca solo su un gesto
  dell'utente: se la connessione avviene mentre è sospeso, l'elemento `<audio>`
  risulta "in riproduzione" ma **non si sente nulla**. In più
  `createMediaElementSource` può essere invocato **una sola volta** per
  elemento: il secondo tentativo lancia, e il `catch` alla riga 75 lo ingoia
  in `console.debug`, lasciando l'audio scollegato senza alcun segnale.
  Verifica su iOS reale che: il primo play produca suono; il suono continui
  cambiando traccia; e che un fallimento di connessione **non lasci l'utente in
  silenzio senza spiegazione**. Se il collegamento non riesce, la riproduzione
  deve poter continuare fuori dall'`AudioContext` (rinunciando al
  visualizzatore) invece di restare muta.
- **Selezione file**: su iOS l'accesso al filesystem è mediato. Verifica che
  `<input type="file">` si comporti correttamente nella WebView.
- **Aree di sicurezza**: notch e barra gestuale richiedono `env(safe-area-inset-*)`.
  Il player fisso in basso è il candidato più probabile a finirci sotto.
- **iOS non supporta `beforeinstallprompt`**: il percorso di installazione passa
  da "Aggiungi a Home" in Safari. Il codice attuale in `usePWAInstall.ts` rileva
  già iOS correttamente — **non regredire questo comportamento**.
- Non introdurre dipendenze che richiedano codice nativo senza dichiarare
  esplicitamente cosa comportano per la build.

## 3.4 Cosa NON fare

- **Non riscrivere il motore DSP, il client Gemini o la schermata Impostazioni.**
  Sono completi e testati.
- **Non rifattorizzare codice che funziona** per ragioni estetiche. La stabilità
  viene prima dell'eleganza.
- **Non aggiungere funzionalità** non richieste da questo documento. L'obiettivo
  è meno superficie, non più.
- **Non inventare** API, endpoint o protocolli. Se non conosci con certezza il
  contratto di un servizio: verificalo, oppure rimuovi la funzione. Mai una
  pseudo-implementazione.
- **Non sostituire una funzione rotta con un mock** per far passare un test.
- **Non dichiarare completato** ciò che non hai osservato funzionare.

---

# PARTE 4 — METODO

Per ogni difetto, in quest'ordine:

1. **Riproduci** il problema e descrivi il comportamento osservato.
2. **Individua la causa**, non il sintomo. (D1 è l'esempio: quattro sintomi, una
   causa. Correggi la causa.)
3. **Correggi** con l'intervento minimo sufficiente.
4. **Verifica** rieseguendo il caso che falliva, più i casi limite della §2.3.
5. **Controlla le regressioni**: `tsc --noEmit`, `vitest run`, `vite build`.
6. **Dichiara** cosa hai osservato dopo la correzione.

Un task modificato ma non riverificato **non è chiuso**. Se una correzione ne
rompe un'altra, la sequenza ricomincia.

Procedi in fasi, e **fermati alla fine di ognuna** per riportare i risultati
prima di iniziare la successiva:

| Fase | Contenuto | Chiusa quando |
|---|---|---|
| 1 | D1 — persistenza audio in IndexedDB | L'audio sopravvive al riavvio |
| 2 | D2 — import corretto e validato | I dati importati resistono a una modifica successiva |
| 3 | D3, D4, D5 — rimozione delle finzioni | Nessuna occorrenza residua nel sorgente |
| 4 | D6, D7, D8 — errori, privacy, corse | Ogni fallimento è visibile nell'interfaccia |
| 5 | §2.1 e §2.2 — verifica esaustiva | Matrice completa, nessuna riga senza verdetto |
| 6 | §2.3 e §3.3 — scenari e mobile | Tutti gli scenari provati e documentati |

---

# PARTE 5 — CRITERI DI COMPLETAMENTO

Il lavoro è concluso quando **tutte** queste condizioni sono vere e verificate.
Compilare, avere un'interfaccia gradevole o non vedere errori evidenti **non**
sono criteri.

**Integrità dei dati**
- [ ] L'audio caricato si riproduce ancora dopo un riavvio completo del browser.
- [ ] Un backup esportato e reimportato restituisce il catalogo identico, e
      resiste a una modifica successiva.
- [ ] Nessun percorso può cancellare dati dell'utente senza conferma esplicita.
- [ ] Un `localStorage` corrotto non provoca perdita silenziosa.

**Onestà dell'interfaccia**
- [ ] Nessun grafico, contatore o indicatore mostra dati inventati.
- [ ] Nessun pulsante promette una funzione che non esiste.
- [ ] Nessun messaggio di successo compare senza un successo verificato.
- [ ] Ogni operazione che può fallire mostra il proprio errore all'utente.
- [ ] Ogni operazione lunga è annullabile e mostra il proprio avanzamento.

**Sicurezza e privacy**
- [ ] Nessun segreto nel sorgente, nel bundle o nei log
      (verificalo: cerca `AIza`, `secret`, `token`, `password` in `dist/`).
- [ ] Nessun dato dell'utente lascia il dispositivo senza una sua azione esplicita.
- [ ] `npm audit` = 0 vulnerabilità.
- [ ] I backup esportati non contengono la chiave API.

**Local-first e offline**
- [ ] In modalità aereo l'app si avvia e tutte le funzioni locali operano.
- [ ] Le funzioni che richiedono rete lo dichiarano **prima** di essere tentate.

**Qualità**
- [ ] `tsc --noEmit` in strict = 0 errori.
- [ ] Tutti i test passano, inclusi quelli nuovi per D1 e D2.
- [ ] `vite build` completa.
- [ ] Nessun codice morto, nessuna dipendenza inutilizzata.
- [ ] Nessun `TODO`, `FIXME`, `mock` o `placeholder` residuo nei percorsi attivi.

**Mobile**
- [ ] Usabile a 360 px di larghezza, controlli di almeno 44×44 px.
- [ ] Nessun contenuto nascosto da notch, barra gestuale o tastiera virtuale.

**Consegna finale**
- [ ] Matrice §2.2 completa, ogni funzione con stato ed evidenza.
- [ ] Elenco di ciò che è stato rimosso, con la motivazione.
- [ ] Elenco esplicito di ciò che **non** funziona o non è stato verificato.
      Un limite dichiarato è accettabile; un limite nascosto no.

---

# PRIORITÀ (in caso di conflitto, l'ordine decide)

1. Funzionalità reale · 2. Correttezza · 3. Stabilità · 4. Sicurezza ·
5. Privacy · 6. Local-first · 7. Semplicità · 8. Manutenibilità ·
9. Android/iOS · 10. UI/UX

Meno funzioni che funzionano davvero valgono più di molte funzioni incomplete.
Quando una funzione non può essere completata correttamente, **rimuoverla è la
risposta giusta**, non lasciarla a metà.

=== FINE PROMPT ===
