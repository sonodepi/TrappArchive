# PROGETTAZIONE — Trascrizione AI + Rilevamento BPM/Tonalità

> Documento di progettazione esecutiva. È scritto per essere **usato come prompt**: la §8 contiene i
> prompt pronti da incollare, uno per modulo. Ogni modulo è autonomo e ha criteri di accettazione
> verificabili.
>
> Base: commit `77ec705`. Verifiche già eseguite: `tsc --noEmit` 0 errori, `vite build` OK,
> `npm audit` → **3 vulnerabilità moderate**, tutte da `express` (pacchetto mai importato).

---

## 0. Perché questo documento esiste

Il lavoro richiesto tocca tre cose che sembrano indipendenti ma non lo sono:

1. **Le vulnerabilità** vanno chiuse prima di aggiungere codice, altrimenti si stratificano.
2. **La trascrizione AI** richiede una chiave Gemini, che richiede una schermata Impostazioni: senza
   quella non esiste un posto dove metterla, e metterla nel bundle sarebbe un errore di sicurezza.
3. **Il rilevamento BPM/tonalità** richiede la decodifica dell'audio, la stessa che serve alla
   trascrizione per normalizzare il file. Le due funzioni condividono lo strato di decodifica.

L'ordine dei moduli (A → B → C → D) è quindi vincolato dalle dipendenze, non arbitrario.

---

## 1. Vincoli e principi non negoziabili

| # | Principio | Conseguenza concreta |
|---|---|---|
| P1 | **L'app resta locale e gratuita** | Nessun backend obbligatorio. La chiave Gemini è **dell'utente**, inserita nelle Impostazioni e salvata solo sul dispositivo. Nessuna chiave nel bundle. |
| P2 | **Degradazione elegante** | Senza chiave o offline, l'app funziona identica meno le funzioni AI. Il rilevamento BPM/tonalità è **100 % locale** e funziona sempre, anche in aereo. |
| P3 | **Nessuna regressione** | `tsc --noEmit` e `vite build` devono restare verdi a ogni modulo. |
| P4 | **La UI non si blocca mai** | Ogni analisi audio pesante gira in un **Web Worker**. Nessun `alert()`, nessun freeze. |
| P5 | **Niente numeri inventati** | Se una stima non è affidabile si restituisce una confidenza bassa o `null`, non un valore di fantasia. Questo cancella sia la `confidence: 0.92` fissa attuale sia la durata generata con `Math.random()`. |
| P6 | **Annullabile** | Ogni operazione lunga (rete o CPU) accetta un `AbortSignal`. |

---

## 2. Modulo A — Chiusura delle vulnerabilità

### Diagnosi

`npm audit` riporta 3 vulnerabilità moderate, tutte sulla stessa catena:

```
express@4.22.2  →  body-parser@1.20.5  →  qs@6.15.x
   GHSA-x5fp-wj9c-mxmx   (bypass di array-limit via chiavi con virgola)
   GHSA-4mjr-xmp4-gh2g   (DoS via isBuffer controllato dall'attaccante)
```

**`express` non è mai importato in `src/`.** Non c'è nessun `server.js`. È un residuo del template
AI Studio. Aggiornare il lockfile non risolve: `express@4.22.2` è già l'ultima 4.x e resta vulnerabile.
L'unica correzione reale è **rimuovere il pacchetto**.

### Intervento

Rimuovere da `package.json` le dipendenze mai importate:

| Pacchetto | Dove stava | Perché si rimuove |
|---|---|---|
| `express`, `@types/express` | dep + devDep | **Origine di tutte e 3 le vulnerabilità.** Mai importato. |
| `dotenv` | dep | Vite gestisce già `.env` nativamente. |
| `firebase` | dep | Mai importato (~1 MB di sorgenti e decine di transitive). |
| `motion` | dep | Mai importato. |
| `esbuild` | devDep | Vite incorpora la propria copia. |
| `tsx` | devDep | Serviva a lanciare il `server.js` inesistente. |
| `sharp` | devDep | Le icone PWA sono già generate e committate in `public/`. |
| `autoprefixer` | devDep | Tailwind 4 ha la propria pipeline via `@tailwindcss/vite`. |
| `vite` (in `dependencies`) | dep | Duplicato: resta solo in `devDependencies`. |

Si **conserva** `@google/genai`: serve al Modulo C.

Aggiornare anche `scripts.clean`, che oggi cancella un `server.js` che non esiste.

### Verifica di accettazione

```bash
npm audit          # atteso: "found 0 vulnerabilities"
bun install && npx tsc --noEmit && npx vite build   # tutti verdi
```

> Esito già misurato su copia di lavoro: dopo la rimozione, **`found 0 vulnerabilities`**.

---

## 3. Modulo B — Impostazioni e chiave Gemini (prerequisito del Modulo C)

### File nuovi

```
src/settings/types.ts       AppSettings + valori di default
src/settings/store.ts       load/save su localStorage + hook useSettings()
src/components/Settings.tsx schermata Impostazioni
```

### Modello dati

```ts
export interface AppSettings {
  geminiApiKey: string;        // '' = funzioni AI disattivate
  geminiModel: string;         // default: DEFAULT_GEMINI_MODEL
  transcriptionLanguage: string; // 'it' | 'en' | 'auto'
  keyProfile: 'krumhansl' | 'temperley' | 'albrecht'; // profilo per la tonalità
}
```

Chiave di persistenza: `trapparchive_settings`.

### Note sul modello Gemini

`DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'` — GA, accetta audio in input, è la scelta economica per
la trascrizione. **Il campo deve restare modificabile a mano**: i nomi dei modelli Gemini cambiano
spesso e vanno verificati su `ai.google.dev/gemini-api/docs/models`. Non va inserito in codice un
nome di modello "sentito dire": se non è verificato, si lascia scegliere l'utente.

### UI

- Nuova voce di navigazione "Impostazioni" (icona `Settings` di lucide), in `NAV_ITEMS`.
- Campo chiave di tipo `password` con toggle mostra/nascondi e link a `aistudio.google.com/apikey`.
- Pulsante **"Verifica chiave"**: una chiamata minima (prompt di una parola) che distingue
  chiave valida / non valida / quota esaurita / rete assente.
- Avviso esplicito: *"La chiave resta su questo dispositivo e non viene mai inviata a nessuno tranne
  Google. Chi ha accesso fisico al dispositivo può leggerla."* — questo è il compromesso onesto di P1
  e va detto all'utente, non nascosto.

---

## 4. Modulo C — Trascrizione AI con Gemini

### 4.1 Il problema di formato che nessuno si aspetta

Gemini accetta audio nei MIME `audio/wav`, `audio/mp3`, `audio/aiff`, `audio/aac`, `audio/ogg`,
`audio/flac`, e **ricampiona internamente tutto a 16 kHz mono** (1 secondo = 32 token). Ne discendono
due conseguenze sfruttabili:

1. Un `.m4a` (container MP4) non è direttamente supportato → va convertito.
2. Inviare un MP3 stereo a 320 kbps è **spreco puro**: il modello lo butterà a 16 kHz mono comunque.

Quindi la mossa corretta è **decodificare e ri-codificare in WAV PCM 16 bit mono a 16 kHz prima
dell'invio**. Vantaggi: formato sempre supportato qualunque sia l'input, **nessuna perdita di qualità
percepita dal modello**, e dimensione che crolla a 32 KB/s (5 minuti ≈ 9,6 MB, ben sotto il limite
inline). Si risolvono il problema di compatibilità e quello di dimensione con un unico passaggio.

### 4.2 File nuovi

```
src/audio/decode.ts       decodeToMono(file, targetRate) → { samples: Float32Array, sampleRate, durationMs }
src/audio/wav.ts          encodeWav16(samples, sampleRate) → Blob  (RIFF/PCM 16 bit)
src/services/gemini.ts    client Gemini: transcribeAudio(), verifyApiKey()
```

`decodeToMono` usa `AudioContext.decodeAudioData` per decodificare e un `OfflineAudioContext` alla
frequenza obiettivo per ricampionare e sommare i canali in mono. È **condiviso con il Modulo D**.

### 4.3 API SDK — firme verificate su `@google/genai@2.21.0`

Verificate leggendo `node_modules/@google/genai/dist/genai.d.ts`, non a memoria:

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey });          // GoogleGenAIOptions

const res = await ai.models.generateContent({    // GenerateContentParameters
  model,                                          // string, obbligatorio
  contents: [{ role: 'user', parts: [
    { text: prompt },
    { inlineData: { mimeType: 'audio/wav', data: base64 } },  // Blob { data, mimeType }
  ]}],
  config: {                                       // GenerateContentConfig
    systemInstruction,
    temperature: 0.2,
    responseMimeType: 'application/json',
    responseSchema,
    abortSignal,                                  // AbortSignal, supportato nativamente
  },
});

res.text   // getter: testo del primo candidato
```

Per file oltre il limite inline esiste `ai.files.upload({ file, config })`, poi si passa
`{ fileData: { fileUri, mimeType } }`. Con la conversione a 16 kHz della §4.1 serve solo oltre i
~9 minuti di audio: implementarlo come fallback, non come percorso principale.

### 4.4 Contratto della funzione

```ts
export interface TranscribeParams {
  audio: Blob | File;
  apiKey: string;
  model: string;
  language: string;            // 'it' | 'en' | 'auto'
  signal?: AbortSignal;
  onPhase?: (p: TranscribePhase) => void;
}

export type TranscribePhase =
  | 'decoding'      // decodifica e ricampionamento locale
  | 'encoding'      // codifica WAV
  | 'uploading'     // invio a Gemini
  | 'transcribing'  // attesa risposta
  | 'done';

export interface TranscriptionResult {
  lyrics: string;                 // testo formattato, una barra per riga
  language: string;               // lingua rilevata
  sections: { label: string; text: string }[];  // [Strofa 1], [Ritornello], ...
  model: string;
  durationMs: number;
}
```

### 4.5 Prompt del modello

`systemInstruction` — il dominio conta, e un prompt generico produce risultati scadenti sul rap:

> Sei un trascrittore di testi musicali specializzato in rap e trap italiano. Trascrivi **esattamente**
> ciò che senti. Regole tassative:
> - Una barra per riga, rispettando la metrica di come è rappata.
> - Marca le sezioni con `[Strofa 1]`, `[Ritornello]`, `[Bridge]`, `[Outro]`.
> - Conserva slang, dialetto, forme tronche ed espressioni volgari **senza censurarle né correggerle**:
>   sono parte del testo.
> - Non inventare nulla. Se un passaggio è incomprensibile scrivi `[?]`.
> - Non aggiungere commenti, spiegazioni o traduzioni.

Output vincolato con `responseMimeType: 'application/json'` + `responseSchema`:

```ts
{
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      label: { type: Type.STRING }, text: { type: Type.STRING } }, required: ['label','text'] } },
  },
  required: ['language', 'sections'],
}
```

`lyrics` si ricompone dalle sezioni: questo evita il testo libero che il modello a volte incornicia
con preamboli tipo "Ecco la trascrizione:".

### 4.6 Gestione errori — mappatura obbligatoria

| Condizione | Messaggio all'utente |
|---|---|
| `apiKey` vuota | "Configura la tua chiave Gemini in Impostazioni." + scorciatoia alla schermata |
| HTTP 400 / `API_KEY_INVALID` | "Chiave Gemini non valida." |
| HTTP 429 | "Quota Gemini esaurita. Riprova più tardi o usa un'altra chiave." |
| HTTP 403 | "Questa chiave non è abilitata all'API Gemini." |
| `navigator.onLine === false` | "La trascrizione AI richiede una connessione. Il resto dell'app funziona offline." |
| `AbortError` | Nessun errore: annullamento richiesto dall'utente |
| Audio > 9 min | Passaggio automatico al percorso Files API |

### 4.7 Integrazione nella UI

In `TrackEditor.tsx` il bottone "AI Auto-Transcribe" oggi fa solo `setIsTranscribing(!isTranscribing)`
(riga 508): un placeholder. Va collegato davvero:

- Attivo solo se esiste `track.audioFilePath` **e** una chiave configurata; altrimenti disabilitato
  con un tooltip che spiega quale delle due manca.
- Durante l'esecuzione: barra di stato con la fase corrente (§4.4) e pulsante **Annulla**.
- A trascrizione conclusa, **non sovrascrivere silenziosamente** un testo già presente: mostrare un
  confronto e i pulsanti *Sostituisci* / *Accoda* / *Annulla*.

---

## 5. Modulo D — Rilevamento BPM e tonalità

### 5.1 Cosa c'è di sbagliato oggi, precisamente

`src/utils/tunebat.ts` contiene quattro difetti che ne compromettono l'accuratezza:

1. **Autocorrelazione senza rimozione della media** (`detectBpmFromBuffer`, riga 164-177): l'inviluppo
   è tutto positivo, quindi la sua componente continua domina il prodotto e la correlazione premia i
   lag lunghi indipendentemente dal ritmo reale.
2. **Nessuna disambiguazione d'ottava**: un brano a 140 BPM correla benissimo anche a 70. Non c'è
   niente che scelga fra i due. Le righe 182-184 che dovrebbero normalizzare sono **codice morto**,
   perché la ricerca è già vincolata a 70-180.
3. **Chroma con aliasing** (`detectKeyFromBuffer`, riga 216): la DFT campiona `n += 4`, cioè
   sottocampiona di 4 senza filtro anti-alias; inoltre analizza solo 30 finestre non sovrapposte prese
   dall'inizio del file, dove spesso c'è solo l'intro.
4. **Prodotto scalare al posto della correlazione** (righe 236-256): confronta il chroma con i profili
   Krumhansl-Schmuckler con un semplice prodotto scalare. È l'errore classico: senza centrare le
   variabili sulle rispettive medie si premiano i profili con media alta, non quelli con la *forma*
   giusta. L'algoritmo K-S richiede la **correlazione di Pearson**.

### 5.2 Architettura nuova

```
src/audio/decode.ts                (condiviso col Modulo C)
src/audio/dsp/fft.ts               FFT radix-2 iterativa in-place
src/audio/dsp/stft.ts              finestratura Hann + spettro di magnitudine
src/audio/analysis/tempo.ts        ODF a flusso spettrale → BPM
src/audio/analysis/key.ts          chromagram → tonalità
src/audio/analysis/camelot.ts      tabella Camelot completa + enarmonie
src/audio/analysis/worker.ts       Web Worker: riceve i campioni, restituisce l'analisi
src/audio/analyze.ts               API pubblica: analyzeAudio(file) → AudioAnalysis
```

**Perché un Worker**: `decodeAudioData` e `OfflineAudioContext` esistono solo sul thread principale,
mentre FFT e correlazioni sono puro calcolo. Divisione: il thread principale decodifica e ricampiona,
poi **trasferisce** (zero-copy, via `Transferable`) il `Float32Array` mono al worker, che esegue tutto
il DSP e restituisce il risultato. La UI non si blocca mai (P4).

### 5.3 Algoritmo BPM

1. Decodifica → mono, **22050 Hz** (sufficiente: l'informazione ritmica sta sotto gli 11 kHz).
2. Finestra di analisi: fino a 60 s presi dal **centro** del brano, non dall'inizio (l'intro è spesso
   priva di batteria).
3. **STFT**: finestra 1024, hop 512 → 43 frame/s. Finestra di Hann.
4. **Spectral flux ODF**: `odf[t] = Σ_k max(0, |X[t,k]| − |X[t−1,k]|)`. La rettificazione a mezza onda
   isola gli *aumenti* di energia, cioè gli attacchi.
5. **Normalizzazione**: sottrazione della media mobile (finestra ~0,5 s) e rettificazione. Questo
   corregge il difetto §5.1.1.
6. **Autocorrelazione** dell'ODF centrato sui lag corrispondenti a 60–200 BPM.
7. **Aggregazione armonica** (comb filter) — è questa a risolvere il problema d'ottava:
   `score(τ) = ac(τ) + 0.5·ac(2τ) + 0.25·ac(3τ) + 0.125·ac(4τ)`
   Il periodo di battuta vero riceve contributo da tutti i suoi multipli, un sottomultiplo casuale no.
8. **Prior di tempo**: peso log-gaussiano centrato a 120 BPM (σ ≈ 0,45 in ottave), coerente con la
   letteratura sulla risonanza percettiva del tempo. Disambigua i casi 70/140 residui.
9. **Interpolazione parabolica** sul picco → BPM frazionario (es. `140.3`).
10. **Confidenza** = prominenza del picco rispetto alla media della funzione di score, mappata in
    `[0,1]`. Niente più `0.92` fisso (P5).

### 5.4 Algoritmo tonalità

1. Stesso STFT, ma finestra **4096** (serve risoluzione in frequenza, non temporale) e hop 2048.
2. **Chromagram**: ogni bin di frequenza `f` nell'intervallo 65–2100 Hz (C2–C7) contribuisce alla
   classe di altezza `round(12·log2(f/440)) mod 12`, pesato per la magnitudine. Nessun
   sottocampionamento: elimina l'aliasing del §5.1.3.
3. **Compressione logaritmica** `log(1 + γ·|X|)` con γ = 100: attenua il dominio del timbro e delle
   percussioni sul contenuto armonico.
4. Media dei chroma su tutti i frame, poi normalizzazione.
5. **Correlazione di Pearson** contro le 24 rotazioni dei profili (12 maggiori + 12 minori) — la
   correzione del §5.1.4. Profili selezionabili:
   - **Krumhansl-Schmuckler** (originale, da esperimenti su ascoltatori)
   - **Temperley** (rivisto per la musica popolare) ← **default consigliato**
   - **Albrecht-Shanahan** (ricavato da un corpus ampio)
6. Risultato: tonalità migliore, **seconda migliore**, e confidenza = `(r₁ − r₂)` riscalata. Se le due
   candidate sono troppo vicine, la confidenza scende: onestà invece di finta precisione (P5).
7. Mappatura **Camelot** completa, con tutte le enarmonie (Db/C#, Eb/D#, Gb/F#, Ab/G#, Bb/A#).

### 5.5 Contratto

```ts
export interface AudioAnalysis {
  bpm: number;                 // frazionario, es. 140.3
  bpmConfidence: number;       // 0..1, calcolata davvero
  bpmCandidates: number[];     // alternative d'ottava, es. [140.3, 70.2, 280.6]
  key: string;                 // es. 'F# Minor'
  keyConfidence: number;       // 0..1
  keyAlternative: string;      // seconda ipotesi
  camelot: string;             // es. '11A'
  durationMs: number;          // reale — sostituisce Math.random() di App.tsx:106
  analyzedMs: number;          // quanto audio è stato effettivamente analizzato
  profile: KeyProfileName;
}
```

### 5.6 Verifica — questa parte non è opzionale

Un rilevatore di BPM non si valida "a occhio". Test con **Vitest** su segnali sintetici generati in
memoria, dove la verità è nota per costruzione:

| Test | Segnale generato | Atteso |
|---|---|---|
| BPM click track | impulsi a 90 / 128 / 140 / 175 BPM | entro ±1 BPM |
| BPM con swing | click con jitter ±8 ms | entro ±2 BPM |
| Robustezza d'ottava | click a 140 BPM con accenti deboli sugli ottavi | 140, **non** 280 né 70 |
| Tonalità maggiore | triadi C-F-G-C con armoniche | `C Major` |
| Tonalità minore | triadi Am-Dm-E-Am | `A Minor` |
| Camelot | tutte le 24 tonalità | biiezione con la ruota |
| Pearson | chroma piatto | confidenza ≈ 0, non una tonalità a caso |

Servono `vitest` come devDependency e uno script `test`. Senza questi test il modulo si considera
**non consegnato**: è l'unico modo per distinguere un algoritmo che funziona da uno che restituisce
numeri plausibili.

### 5.7 Integrazione e destino dello scraping Tunebat

- `TrackEditor`: il pulsante "Audio" chiama `analyzeAudio` e mostra BPM, tonalità, Camelot **e le
  rispettive confidenze**. Sotto una certa soglia, la UI lo dichiara ("stima incerta") invece di
  presentare il numero come un fatto.
- `WorkingOn`: stessa analisi per la base della bozza, quando è un file locale.
- `App.tsx:106`: eliminare la durata casuale, usare `durationMs` reale.
- **`scrapeTunebatUrl` va mantenuta ma retrocessa**: resta come conferma manuale su richiesta
  esplicita, mai come percorso automatico, e va dichiarato nella UI che passa da un proxy esterno
  (`api.allorigins.win`) e quindi **non funziona offline**. L'analisi locale diventa la sorgente
  primaria. Aggiungere `AbortSignal` con timeout di 10 s.

---

## 6. Riepilogo dei file

| File | Stato | Modulo |
|---|---|---|
| `package.json` | modificato | A |
| `src/settings/types.ts`, `store.ts` | nuovo | B |
| `src/components/Settings.tsx` | nuovo | B |
| `src/components/Sidebar.tsx` | modificato (voce nav) | B |
| `src/audio/decode.ts`, `wav.ts` | nuovo | C + D |
| `src/services/gemini.ts` | nuovo | C |
| `src/audio/dsp/fft.ts`, `stft.ts` | nuovo | D |
| `src/audio/analysis/tempo.ts`, `key.ts`, `camelot.ts`, `worker.ts` | nuovo | D |
| `src/audio/analyze.ts` | nuovo | D |
| `src/components/TrackEditor.tsx` | modificato | C + D |
| `src/components/WorkingOn.tsx` | modificato | D |
| `src/App.tsx` | modificato (durata reale, tab impostazioni) | B + D |
| `src/utils/tunebat.ts` | ridotto a scraping + parsing testo | D |
| `src/audio/**/*.test.ts` | nuovo | D |

---

## 7. Criteri di accettazione complessivi

- [ ] `npm audit` → 0 vulnerabilità
- [ ] `npx tsc --noEmit` → 0 errori
- [ ] `npx vite build` → build riuscita
- [ ] `npx vitest run` → tutti i test passano, inclusi quelli di §5.6
- [ ] Senza chiave Gemini: l'app si apre, naviga e analizza BPM/tonalità senza errori in console
- [ ] In modalità aereo: tutto funziona tranne la trascrizione, che spiega perché
- [ ] Trascrizione annullabile a metà senza lasciare stato incoerente
- [ ] Nessun `alert()` residuo nel codice
- [ ] La chiave API non compare mai in `dist/`

---

## 8. Prompt pronti

Da incollare uno per volta, in ordine. Ogni prompt presuppone il precedente completato.

### Prompt A — Sicurezza

```
Nel repo TrappArchive: npm audit riporta 3 vulnerabilità moderate, tutte provenienti da
express → body-parser → qs. express non è mai importato in src/ e non esiste alcun server.js:
è un residuo del template AI Studio.
Rimuovi da package.json le dipendenze mai importate nel sorgente: express, @types/express,
dotenv, firebase, motion, esbuild, tsx, sharp, autoprefixer, e la voce duplicata di vite in
dependencies (resta solo in devDependencies). Conserva @google/genai, che userò per la
trascrizione. Correggi lo script "clean" che cancella un server.js inesistente.
Verifica poi che npm audit dia 0 vulnerabilità e che tsc --noEmit e vite build restino verdi.
```

### Prompt B — Impostazioni e chiave Gemini

```
Aggiungi a TrappArchive una schermata Impostazioni con la chiave API Gemini dell'utente.
La chiave NON deve mai stare nel bundle: la inserisce l'utente e resta in localStorage sotto
trapparchive_settings, insieme a modello Gemini, lingua di trascrizione e profilo per la
tonalità (krumhansl | temperley | albrecht, default temperley).
Crea src/settings/types.ts, src/settings/store.ts (con hook useSettings) e
src/components/Settings.tsx; aggiungi la voce "Impostazioni" a NAV_ITEMS in Sidebar.tsx e il
ramo corrispondente in App.tsx.
Il campo chiave è di tipo password con toggle mostra/nascondi, link a aistudio.google.com/apikey,
un pulsante "Verifica chiave" che distingue chiave non valida / quota esaurita / rete assente,
e un avviso onesto che la chiave resta sul dispositivo ma è leggibile da chi vi ha accesso fisico.
Modello di default: gemini-2.5-flash, ma il campo deve restare modificabile a mano.
```

### Prompt C — Trascrizione AI

```
Implementa la trascrizione audio reale con Gemini in TrappArchive, sostituendo il placeholder
del bottone "AI Auto-Transcribe" di TrackEditor.tsx:508 (che oggi fa solo un toggle di stato).
Usa @google/genai già installato:
  const ai = new GoogleGenAI({ apiKey });
  await ai.models.generateContent({ model, contents: [{ role:'user', parts:[{text},{inlineData:{mimeType,data}}] }],
                                    config: { systemInstruction, temperature:0.2,
                                              responseMimeType:'application/json', responseSchema, abortSignal } });
  // il testo si legge da res.text
Prima dell'invio converti SEMPRE l'audio in WAV PCM 16 bit mono a 16 kHz: crea
src/audio/decode.ts (decodeAudioData + OfflineAudioContext per ricampionare e sommare in mono)
e src/audio/wav.ts (encoder RIFF). Gemini ricampiona comunque a 16 kHz mono, quindi così si
risolvono insieme compatibilità di formato (.m4a incluso) e dimensione della richiesta.
Crea src/services/gemini.ts con transcribeAudio({audio, apiKey, model, language, signal, onPhase})
che restituisce { lyrics, language, sections[], model, durationMs }.
systemInstruction: trascrittore di rap/trap italiano, una barra per riga, sezioni marcate
[Strofa 1] [Ritornello] [Bridge] [Outro], slang e volgarità conservati senza censura,
[?] per i passaggi incomprensibili, nessun commento aggiunto.
Output vincolato con responseSchema { language, sections[{label,text}] }; lyrics ricomposto
dalle sezioni per evitare i preamboli del modello.
Mappa gli errori in messaggi italiani: chiave mancante, 400 chiave non valida, 429 quota,
403 API non abilitata, offline, AbortError (nessun errore). Mostra le fasi
decoding/encoding/uploading/transcribing con un pulsante Annulla funzionante, e se il testo
esiste già offri Sostituisci / Accoda / Annulla invece di sovrascrivere.
```

### Prompt D — BPM e tonalità

```
Riscrivi il rilevamento di BPM e tonalità di TrappArchive. L'attuale src/utils/tunebat.ts ha
quattro difetti: autocorrelazione senza rimozione della media (la componente continua domina),
nessuna disambiguazione d'ottava (140 e 70 BPM correlano uguale, e le righe 182-184 sono codice
morto), chroma con aliasing (DFT che sottocampiona n+=4 su 30 finestre prese dall'inizio del
brano) e prodotto scalare al posto della correlazione di Pearson contro i profili
Krumhansl-Schmuckler.
Crea: src/audio/dsp/fft.ts (radix-2 iterativa in-place), src/audio/dsp/stft.ts (Hann + magnitudini),
src/audio/analysis/tempo.ts, key.ts, camelot.ts, worker.ts e src/audio/analyze.ts.
BPM: analizza 60 s presi dal CENTRO del brano a 22050 Hz; STFT 1024/hop 512; onset detection
function a flusso spettrale rettificato a mezza onda; sottrai la media mobile; autocorrelazione
su 60-200 BPM; aggregazione armonica score(τ)=ac(τ)+0.5·ac(2τ)+0.25·ac(3τ)+0.125·ac(4τ) per
risolvere l'ottava; prior log-gaussiano centrato a 120 BPM; interpolazione parabolica per il BPM
frazionario; confidenza = prominenza reale del picco.
Tonalità: STFT 4096/hop 2048; chromagram su 65-2100 Hz senza sottocampionamento; compressione
logaritmica log(1+100·|X|); correlazione di PEARSON contro le 24 rotazioni dei profili, con
scelta fra krumhansl/temperley/albrecht; restituisci anche la seconda ipotesi e una confidenza
derivata da (r1-r2); mappatura Camelot completa con le enarmonie.
Tutto il DSP gira in un Web Worker: il thread principale decodifica e trasferisce il Float32Array
mono (zero-copy), il worker calcola. La UI non deve mai bloccarsi.
Aggiungi vitest e test su segnali sintetici: click track a 90/128/140/175 BPM entro ±1 BPM,
click con jitter ±8 ms entro ±2, un caso che deve dare 140 e non 280 né 70, triadi C-F-G-C → C Major,
Am-Dm-E-Am → A Minor, chroma piatto → confidenza ~0.
Infine: usa la durata reale del buffer al posto di Math.random() in App.tsx:106, e retrocedi
scrapeTunebatUrl a conferma manuale, dichiarando nella UI che passa da un proxy esterno e non
funziona offline.
```
