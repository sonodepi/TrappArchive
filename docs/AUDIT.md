# TrappArchive — Audit del codice e Roadmap verso il rilascio iOS / Android

> Revisione eseguita sul commit `77ec705` (branch `main`).
> Verifiche eseguite: `bun install` (546 pacchetti, OK), `tsc --noEmit` (0 errori), `vite build`
> (build production OK, bundle 339 kB / 93 kB gzip, service worker generato con 18 entry di precache).

---

## 1. Come funziona l'app oggi

### 1.1 Stack reale

| Livello | Tecnologia effettivamente usata |
|---|---|
| Build | Vite 6 + `@vitejs/plugin-react` + `@tailwindcss/vite` (Tailwind 4) |
| UI | React 19, `lucide-react` per le icone, Tailwind inline (nessun design system) |
| PWA | `vite-plugin-pwa` in modalità `generateSW` (Workbox), `registerType: 'autoUpdate'` |
| Stato | Esclusivamente `useState` in `src/App.tsx` — nessuno store, nessun context |
| Persistenza | **Solo `localStorage`** (chiavi `trapparchive_*`) |
| Backend | **Nessuno** |
| AI | **Nessuna** chiamata a Gemini nel codice |

### 1.2 Flusso dei dati

Tutto lo stato vive in `src/App.tsx` e viene passato per props ai cinque schermi:

```
App.tsx  ──(props)──►  WorkingOn   (bozze, co-op, base YouTube, Tunebat)
         ├──────────►  Library     (elenco tracce, ordinamento, play/edit/delete)
         ├──────────►  TrackEditor (metadati, upload audio, BPM/key, testo)
         ├──────────►  Albums      (creazione/modifica album, assegnazione tracce)
         ├──────────►  ExportSection (export/import JSON, install PWA)
         └──────────►  Player      (elemento <audio> singolo + AudioVisualizer)
```

Persistenza (`src/App.tsx:62-100`), tre `useEffect`:

1. **Migrazione** una tantum delle chiavi `trackstudio_*` → `trapparchive_*`.
2. **Load** al mount: legge `trapparchive_tracks|albums|drafts` da `localStorage`.
3. **Save**: ad ogni cambio di `tracks`/`albums`/`drafts` riscrive *tutti e tre* gli array interi.
4. **Sync fra tab**: listener su `StorageEvent` che ricarica lo stato quando un'altra scheda scrive.

### 1.3 Le cinque sezioni

- **Bozze & Cowork** (`WorkingOn.tsx`, 745 righe) — crea bozze con un `shareCode` a 6 cifre, incolla
  un link YouTube che viene messo in loop in un iframe `youtube-nocookie` mentre scrivi, modalità
  "co-op" con due pannelli (le tue barre / le barre del feat), flag "pronto" e fase di unione finale.
  Link esterni verso `cobalt.tools` e `vocalremover.org` come strumenti audio.
- **Libreria** (`Library.tsx`) — ordinamento per titolo / data / durata / BPM, layout mobile a righe
  compatte e desktop a griglia, play / edit / delete.
- **Aggiungi Traccia** (`TrackEditor.tsx`) — metadati (titolo, artista, producer, featuring N),
  upload file audio, BPM e key (manuali, da analisi audio, o da link Tunebat), testo.
- **Album** (`Albums.tsx`) — CRUD album, assegnazione tracce con distinzione fra tracce libere e già
  assegnate ad altri album.
- **Esporta & Backup** (`ExportSection.tsx`) — download JSON (catalogo completo, singolo album,
  singola traccia), import JSON, card di installazione PWA.

### 1.4 Il motore "Tunebat" (`src/utils/tunebat.ts`)

È la parte più interessante del codice ed è **tutta client-side**:

- `analyzeAudioFile()` → decodifica il file con Web Audio API e stima:
  - **BPM** per autocorrelazione sull'inviluppo di ampiezza sottocampionato a 100 Hz (range 70–180);
  - **Tonalità** con chromagram a 12 bin + correlazione con i profili **Krumhansl-Schmuckler**,
    poi mappata sulla ruota **Camelot**.
- `parseBpmAndKeyFromText()` → estrae BPM/key dal titolo o dal nome file (`"..._140bpm_Am.wav"`, `"8A"`).
- `scrapeTunebatUrl()` → scarica una pagina tunebat.com **attraverso il proxy CORS pubblico
  `api.allorigins.win`** e ne fa scraping via regex.

### 1.5 Il visualizer (`AudioVisualizer.tsx`, 629 righe)

`createMediaElementSource` sull'elemento `<audio>` del player → `AnalyserNode` (fftSize 128) →
canvas con tre modalità (`bars`, `wave`, `mirror`), quattro temi colore, peak-hold e modale a
schermo intero. Se il Web Audio non si aggancia, cade su un'animazione sintetica.

---

## 2. Stato della milestone: cosa c'è e cosa manca

| Requisito dichiarato | Stato | Nota |
|---|---|---|
| GUI completa e responsive | 🟢 **Fatta** | Mobile / tablet / desktop, touch target ≥ 44 px, bottom-nav |
| Catalogo tracce e album | 🟢 Fatto | CRUD completo |
| Bozze e testi | 🟢 Fatto | Con base YouTube in loop |
| Analisi BPM / tonalità | 🟡 Parziale | Funziona sui file locali; il "Tunebat online" è scraping fragile |
| PWA installabile | 🟡 Parziale | Manifest + SW OK, ma vedi §3.7 (manifest duplicato) |
| Funzionamento offline | 🔴 **Apparente** | Il guscio è offline, ma l'audio **non** è salvato (§3.1) |
| **Database** | 🔴 **Assente** | Solo `localStorage`: ~5 MB, solo stringhe, nessun indice, nessuna query |
| **Middleware / backend** | 🔴 **Assente** | Nessun `server.js`, nessuna API, nessuna auth |
| **App "intelligente" (Gemini)** | 🔴 **Assente** | Zero chiamate AI: il bottone "AI Auto-Transcribe" è un placeholder |
| Collaborazione reale | 🔴 **Simulata** | Il codice a 6 cifre funziona solo fra tab dello **stesso** browser |
| **Pacchetto iOS / Android** | 🔴 Assente | Nessun Capacitor / Cordova / React Native: solo PWA |
| Sync Google Drive | 🔴 Assente | Promessa in `.env.example` e nel testo della UI, mai implementata |

**Sintesi onesta della milestone:** il *front-end* è a circa l'80 %. Il *back-end*, il *database* e
il *packaging nativo* sono a **0 %**. Le tre dipendenze che dovrebbero abilitarli
(`firebase`, `@google/genai`, `express` + `dotenv`) sono installate ma **mai importate** in `src/`.

---

## 3. Bug e criticità, in ordine di gravità

### 3.1 🔴 CRITICO — L'audio caricato si perde a ogni ricarica

`src/components/TrackEditor.tsx:133`

```ts
const localUrl = URL.createObjectURL(file);
// ... poi salvato in track.audioFilePath e persistito in localStorage
```

Un `blob:` URL vive solo finché vive il documento che l'ha creato. Dopo un refresh (o alla riapertura
della PWA) `audioFilePath` punta a un blob inesistente: **il player non riprodurrà più nulla** e la
libreria diventa un elenco di metadati orfani. Per un "archivio audio locale" è il difetto numero uno.

> **Fix**: salvare il `Blob` reale in **IndexedDB** (o su filesystem nativo con Capacitor) e tenere in
> DB solo l'`id`, ricreando l'object URL a runtime al momento della riproduzione.

### 3.2 🔴 CRITICO — L'import di un backup può essere cancellato subito dopo

`src/components/ExportSection.tsx:94` fa `window.dispatchEvent(new Event('storage'))`, ma:

- l'evento `storage` **non viene emesso nella stessa scheda** che ha scritto, e
- l'`Event` sintetico non ha `key`/`newValue`, quindi l'handler in `src/App.tsx:87-97` esce senza fare nulla.

Risultato: dopo l'import lo stato React resta quello vecchio. Alla prima modifica successiva l'effetto
di salvataggio (`src/App.tsx:79-83`) riscrive `localStorage` con lo stato stale, **distruggendo i dati
appena importati**. L'utente vede solo il messaggio "Importazione completata con successo".

> **Fix**: l'import deve risalire allo stato React (callback `onImport(tracks, albums, drafts)` verso
> `App`), non scrivere direttamente in `localStorage`.

### 3.3 🔴 ALTO — Nessun vero database

`localStorage` è sincrono, limitato a ~5 MB per origine, memorizza solo stringhe e viene riscritto
per intero a ogni keystroke (in `WorkingOn` ogni carattere digitato nel testo serializza l'intero
array di bozze). Non regge: copertine, audio, cataloghi grandi, ricerca, relazioni.

> **Fix**: **IndexedDB** (consigliato `dexie` o `idb`) con store `tracks`, `albums`, `drafts`,
> `audioBlobs`, `settings` + indici su `createdAt`, `bpm`, `title`. In Capacitor, alternativa
> `@capacitor-community/sqlite` per query SQL reali.

### 3.4 🟠 MEDIO-ALTO — La collaborazione "co-op" non è reale

`src/components/WorkingOn.tsx:60-86`: `handleJoin` cerca il codice fra le bozze **locali**; se non lo
trova ne crea una nuova vuota con lo stesso codice. Due dispositivi diversi non si vedranno **mai**,
ma l'interfaccia ("Feat sta componendo…", "Pronto per Unire") suggerisce il contrario.

> **Fix**: o si implementa una sincronizzazione reale (Firestore è già una dipendenza installata,
> oppure WebRTC/Yjs peer-to-peer per restare "liberi e locali"), o si riformula la UI come
> "sessione locale a due mani sullo stesso dispositivo".

### 3.5 🟠 MEDIO — Player: bug e limiti

- `src/components/Player.tsx:27,51` — `crossOrigin = 'anonymous'` è impostato **sempre**. Su un URL
  audio remoto che non risponde con header CORS, questo fa **fallire del tutto la riproduzione**
  (senza crossOrigin partirebbe, solo senza visualizer). Va impostato solo per sorgenti CORS-safe.
- `src/components/Player.tsx:206` e `:357` — il pulsante **SkipForward chiama `handleSkipBack`**:
  "traccia successiva" riporta all'inizio.
- Non esiste una **coda di riproduzione**: `onPlayTrack` imposta una singola traccia, quindi niente
  next/prev, shuffle, repeat, autoplay dell'album.
- Nessuna **Media Session API**: sul telefono non compaiono i controlli in lock-screen/notifica,
  e la riproduzione in background non è gestita.

### 3.6 🟠 MEDIO — Il "Tunebat online" dipende da un proxy pubblico di terze parti

`src/utils/tunebat.ts:264` passa da `https://api.allorigins.win/get?url=…`. Comporta: dipendenza da un
servizio gratuito senza SLA, invio dell'URL a terzi, **non funziona offline** (in contraddizione con la
promessa "100 % offline") e parsing a regex che si rompe al primo restyle di tunebat.com.

Note minori sullo stesso file:
- `tunebat.ts:182-184` — i rami di normalizzazione `< 70` / `> 180` sono **codice morto**: la ricerca
  di autocorrelazione è già vincolata a quel range.
- L'autocorrelazione non sottrae la media dell'inviluppo (componente DC), il che sbilancia la stima
  del BPM; l'estrazione della tonalità usa una DFT a passo 4 su finestre non sovrapposte, quindi è
  soggetta ad aliasing. Sono euristiche accettabili, ma la `confidence: 0.92` restituita è arbitraria.
- `autoDetectTunebatData()` non interroga mai Tunebat online nonostante il nome e il campo
  `source: 'tunebat-online'`.

### 3.7 🟡 BASSO — Due manifest PWA in conflitto

`index.html:14` dichiara `<link rel="manifest" href="/manifest.json">` e `vite-plugin-pwa` ne inietta
un secondo (`/manifest.webmanifest`). Nel `dist/index.html` compaiono entrambi: il browser usa il
primo e ignora quello generato dal plugin. Le due definizioni oggi coincidono, ma divergeranno alla
prima modifica di `vite.config.ts`.

> **Fix**: eliminare `public/manifest.json` e il `<link>` statico, lasciando la sola sorgente di
> verità in `vite.config.ts`.

### 3.8 🟡 BASSO — Difetti di UI/UX e accessibilità

- `index.html:23` — il `<body>` ha `select-none`: **in un'app di testi non si possono selezionare né
  copiare le liriche**. Va rimosso, o limitato alla sola chrome dell'interfaccia.
- `src/App.tsx:106` — se la durata è mancante viene generata **casualmente**
  (`Math.random() * 180000 + 120000`): la libreria mostra durate inventate e l'ordinamento per durata
  è privo di senso.
- **Nessun routing**: `activeTab` è solo stato locale. Su Android il tasto "indietro" **chiude l'app**
  invece di tornare alla schermata precedente, e non esistono deep link. Da sistemare prima del
  packaging nativo.
- `src/components/Sidebar.tsx:98` — condizione morta `isTabletExpanded || true`.
- `src/components/Albums.tsx:61` — `coverArt` è sempre `''`: il campo esiste nel modello ma non c'è
  interfaccia per caricare una copertina.
- Quasi nessun `aria-label` sui pulsanti icon-only; niente gestione del focus nelle modali (non si
  chiudono con `Esc`, il focus non è intrappolato).
- `alert()` per la validazione del titolo (`TrackEditor.tsx:184`), mentre altrove si usano modali
  custom: incoerenza.

### 3.9 🟡 BASSO — Igiene del progetto

- **Dipendenze installate e mai usate**: `firebase`, `@google/genai`, `express`, `dotenv`, `motion`,
  `esbuild`, `tsx`, `sharp`, `autoprefixer`. Lo script `clean` cancella un `server.js` che non esiste:
  sono residui del template AI Studio.
- `metadata.json` dichiara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, ma non esiste alcun lato server.
- `firebase-applet-config.json` è committato con `apiKey` e `oAuthClientId`. Per Firebase Web le
  chiavi non sono segreti (la protezione sono le Security Rules), ma il file oggi è **inutilizzato**:
  o si usa, o si rimuove.
- Nessun **README**, nessun **test**, nessun **linter** (solo `tsc --noEmit`), nessuna **CI**.
- `vite` compare sia in `dependencies` che in `devDependencies`.

---

## 4. Il divario rispetto all'obiettivo: "scaricabile per iOS e Android, libera e locale"

Oggi il progetto è una **PWA**. Va detto chiaramente cosa questo implica:

- **Android** — la PWA è installabile da Chrome ("Aggiungi a schermata Home") e funziona bene, ma
  **non è un file `.apk` scaricabile** e non finisce sul Play Store.
- **iOS** — Safari non supporta `beforeinstallprompt` (per questo `PWAInstallButton` mostra la guida
  manuale "Condividi → Aggiungi a Home"). Soprattutto: lo storage di una PWA iOS può essere
  **eliminato dal sistema** dopo alcuni giorni di inutilizzo. Per un archivio personale è inaccettabile
  finché i dati non stanno su filesystem nativo.

### Il percorso consigliato: **Capacitor**

Capacitor incapsula *esattamente* la build Vite già esistente e produce progetti Xcode e Android
Studio nativi. Non richiede di riscrivere la UI e non toglie nulla alla PWA, che continua a funzionare.

```bash
bun add @capacitor/core @capacitor/app @capacitor/filesystem @capacitor/preferences
bun add -d @capacitor/cli
npx cap init TrappArchive com.trapparchive.app --web-dir=dist
bun add @capacitor/android && npx cap add android
bun add @capacitor/ios     && npx cap add ios      # richiede macOS + Xcode
vite build && npx cap sync
```

Cosa serve concretamente per distribuire:

| Piattaforma | Requisiti | Distribuzione "libera" |
|---|---|---|
| **Android** | Solo Android Studio (anche su Linux/Windows) | ✅ `.apk` firmato con una chiave tua, scaricabile da GitHub Releases e installabile via sideload. Nessun costo. |
| **iOS** | **Mac obbligatorio** + Xcode | ⚠️ Con Apple ID gratuito si installa sul proprio dispositivo ma la firma **scade dopo 7 giorni**. Per una distribuzione stabile (TestFlight o App Store) serve l'Apple Developer Program, **99 $/anno**. In alternativa: restare sulla PWA su iOS. |

I plugin da aggiungere per colmare i buchi funzionali: `@capacitor/filesystem` (audio salvato davvero
sul dispositivo), `@capacitor-community/sqlite` **oppure** IndexedDB (database), `@capacitor/share`,
`@capacitor/haptics`, e un plugin di background audio per la riproduzione a schermo spento.

---

## 5. Roadmap proposta — dalla milestone attuale al rilascio

Le fasi sono ordinate per dipendenza: ogni fase è pensata come **un prompt autonomo** da dare in
AI Studio, perché il salto di contesto sia gestibile per il modello.

### Fase 1 — Rendere i dati veri (sbloccante, nulla ha senso prima)
1. Introdurre uno strato di persistenza `src/db/` su **IndexedDB** (`dexie` o `idb`), con store
   `tracks`, `albums`, `drafts`, `audioBlobs`, `settings` e una migrazione automatica dai dati
   `localStorage` esistenti (senza perderli).
2. Salvare i file audio come **Blob in IndexedDB**, rigenerando l'object URL alla riproduzione
   → risolve §3.1.
3. Sostituire i tre `useEffect` di `App.tsx` con hook asincroni (`useTracks`, `useAlbums`,
   `useDrafts`) e correggere il percorso di import → risolve §3.2.

### Fase 2 — Correzione dei bug bloccanti
4. Player: crossOrigin condizionale, tasto "successiva" reale, **coda di riproduzione**,
   **Media Session API** → risolve §3.5.
5. Rimuovere `select-none` dal body e la durata casuale → risolve §3.8.
6. Unificare il manifest PWA su un'unica sorgente → risolve §3.7.
7. Ripulire le dipendenze non usate e scrivere il **README**.

### Fase 3 — Navigazione pronta per il nativo
8. Introdurre un router (`react-router` in `HashRouter`, il più sicuro dentro una webview) con una
   rotta per sezione, e gestire il **tasto indietro Android** via `@capacitor/app`.

### Fase 4 — Packaging iOS / Android
9. Aggiungere Capacitor, generare i progetti `android/` e `ios/`, spostare lo storage audio su
   `@capacitor/filesystem` quando gira in nativo (mantenendo IndexedDB come fallback web).
10. Icone e splash screen (`@capacitor/assets`), build `.apk` firmato, workflow GitHub Actions che
    pubblica l'APK nelle Releases → **l'obiettivo "scaricabile e libera" è raggiunto su Android**.

### Fase 5 — Il livello "intelligente" (Gemini)
11. Decidere l'architettura, e la scelta è netta:
    - **Chiave lato client** = la chiave è pubblica nel bundle. Accettabile solo se ogni utente
      inserisce la *propria* chiave in una schermata Impostazioni (coerente con "libera e locale").
    - **Middleware** (Cloud Run / Vercel Function con `express` già in dipendenze) = la chiave resta
      sul server, ma l'app **non è più autonoma offline**.
    > Consigliata: **chiave dell'utente salvata in locale**, con degradazione elegante quando manca.
12. Funzioni AI concrete: trascrizione del testo dall'audio, suggerimento rime/metrica sulla bozza,
    generazione di titoli e tag, riepilogo del catalogo.

### Fase 6 — Collaborazione (opzionale, da decidere)
13. O sincronizzazione reale (Firestore, già in dipendenze), o P2P (Yjs + WebRTC) per non tradire il
    "locale", o riformulazione onesta della UI → §3.4.

### Fase 7 — Qualità
14. Vitest sulle funzioni pure (`tunebat.ts`, `utils.ts`), ESLint, GitHub Action con
    typecheck + build + test.

---

## 6. Le tre decisioni da prendere adesso

1. **iOS**: si accetta la spesa di 99 $/anno per una vera app installabile, oppure su iOS si resta
   sulla PWA e la distribuzione nativa parte solo da Android?
2. **AI**: chiave Gemini inserita dall'utente (resta tutto locale) oppure middleware server
   (si perde l'autonomia offline)?
3. **Co-op**: sincronizzazione reale in cloud, P2P, oppure si dichiara che la modalità è locale?

Le Fasi 1–4 sono indipendenti da queste risposte e possono partire subito.
