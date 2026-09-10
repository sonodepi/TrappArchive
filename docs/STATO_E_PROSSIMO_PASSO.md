# TrappArchive — stato del progetto e prossimo passo

Documento di passaggio di consegne. Serve a ripartire in una chat nuova senza
riraccontare tutto. In fondo c'è un prompt pronto da incollare.

Aggiornato al 10 settembre 2026.

---

## 1. Cos'è

App per scrivere pezzi rap: archivio di tracce e album, editor di testi, analisi
audio (BPM e tonalità) e scrittura di gruppo fino a quattro persone.

È una **PWA**: gira nel browser, si installa sul telefono, e i dati restano nel
dispositivo. Non c'è nessun server nostro. Questa non è una limitazione tecnica,
è la scelta di fondo: niente account obbligatori, niente costi di gestione,
niente testi altrui su una macchina che non è tua.

## 2. Dov'è, e cosa è vivo adesso

| | |
|---|---|
| Repository | `sonodepi/TrappArchive` — **pubblico** |
| Ramo di lavoro | `claude/trapparchive-app-review-x38gkz` |
| Ramo pubblicato | `main` (il PR #2 è stato fuso il 9 settembre) |
| **App online** | **https://sonodepi.github.io/TrappArchive/** |
| Pubblicazione | GitHub Actions, `.github/workflows/deploy.yml` |
| Test | 79, tutti verdi, in 5 file |

Lo stato del deploy: il run #7 su `main` è **riuscito**. Prima ne erano falliti
sei di fila, sempre sullo stesso punto — il job `build` passava e il job `deploy`
moriva in un secondo con *«Failed to create deployment (status: 404). Ensure
GitHub Pages has been enabled»*.

La causa era una sola, e non era nel codice: **GitHub Pages non pubblica da un
repository privato** su piano gratuito. Il repository è stato reso pubblico, il
ramo è stato fuso in `main`, e il deploy è passato al primo tentativo. Il file
del workflow non è mai stato il problema: aveva già i permessi giusti
(`pages: write`, `id-token: write`) fin dall'inizio.

## 3. Come è fatto dentro

Stack: **Vite 6 + React 19 + TypeScript** (strict) + **Tailwind 4**, gestore
pacchetti **bun**.

```
src/
  audio/       analisi BPM e tonalità — FFT, STFT, ruota di Camelot
               gira in un Web Worker, tutto in locale, nessuna rete
  cloud/       sincronizzazione Firestore, FACOLTATIVA e spenta di default
               sync.ts è puro e testato: è dove si perderebbero le strofe
  components/  interfaccia — WorkingOn.tsx è la scrittura di gruppo
  drafts/      collab.ts: blocchi, permessi, fusione, conflitti
  settings/    impostazioni + identità locale dell'autore (UUID per device)
  storage/     IndexedDB per l'audio, localStorage per il catalogo
               migrate.ts porta avanti i dati vecchi senza perderli
```

Comandi: `bun run dev` (porta 3000), `bun run test`, `bun run lint`,
`bun run build`.

## 4. Le decisioni già prese, e perché

Servono per non rifare discussioni chiuse.

**La scrittura di gruppo è a turni, non in diretta.** In diretta servirebbe un
server sempre acceso. A turni no: la bozza diventa un file JSON che gira fra le
persone. Massimo quattro autori, ognuno possiede i propri blocchi di testo,
tutti leggono tutto, e **solo chi ha creato la bozza decide la fusione finale**.
Quando due hanno toccato lo stesso blocco vince il più recente, ma l'app lo
**dichiara**: «Ritornello è stato modificato da entrambi, ha vinto la versione
più recente». Nessuna perdita silenziosa.

**L'identità è per dispositivo, non per account.** Un UUID generato al primo
avvio e salvato nel browser. Basta per sapere chi ha scritto cosa, senza login.

**Lo scraping di Tunebat è stato rimosso.** Non è stato tolto per pigrizia: non
poteva funzionare. Tunebat costruisce BPM e tonalità con JavaScript *dopo* che
la pagina è arrivata, quindi scaricandone l'HTML si ottiene un guscio vuoto. Il
bottone prometteva una cosa che non era mai avvenuta. Ora resta il link al sito
vero, dove i valori si leggono e si copiano a mano — e accanto c'è scritto
perché.

**Il cloud è facoltativo e non è acceso.** Il dispositivo resta la fonte di
verità. La configurazione Firebase la mette l'utente nelle Impostazioni, così
ognuno punta al proprio progetto. Quei valori non sono segreti (sono
identificatori pubblici che finiscono in qualsiasi client browser): a proteggere
i dati sono le regole in `firestore.rules`, da incollare nella console Firebase.
L'audio non si sincronizza — un documento Firestore si ferma a 1 MiB e un MP3 è
molto oltre.

**La regola che governa tutto il resto:** l'app deve fare quello che la sua
interfaccia promette. Un bottone che non funziona va riparato o tolto, non
lasciato lì. È il criterio con cui è stato fatto il lavoro finora ed è quello
con cui va fatto il prossimo.

## 5. Controllo di sicurezza (10 settembre 2026)

Fatto su tutto il codice **e su tutta la storia dei commit**, perché il
repository è pubblico e un file cancellato oggi resta leggibile nei commit di
ieri.

### Cosa è risultato pulito

- **Nessuna chiave nel codice attuale.** La configurazione Firebase la inserisce
  l'utente nelle Impostazioni e resta nel suo browser; la chiave Gemini idem.
  Niente credenziali nel bundle.
- **`.gitignore` corretto:** copre `.env*` (con eccezione per `.env.example`) e
  `*.key`. Nessun file di segreti è mai entrato nel repository.
- **Nessun dato personale:** nessuna email, nessun nome, nessun dato di
  contatto in nessun file, in nessun commit.
- **`.env.example` non contiene segreti** — solo `BASE_PATH` e `DISABLE_HMR`,
  due variabili di compilazione, e la nota che lì dentro non vanno credenziali.
- **`firestore.rules` è corretto:** ogni documento è vincolato all'`uid` del suo
  proprietario, e c'è una regola finale che nega tutto il resto per evitare che
  una raccolta aggiunta domani resti aperta per dimenticanza.

### L'unico problema trovato — DA CHIUDERE

Nella storia dei commit c'è un file `firebase-applet-config.json`, entrato il
7 settembre (commit `734711d`) e tolto l'8 settembre (commit `e61093c`).
Conteneva la configurazione di un progetto Google:

```
projectId:     gen-lang-client-0184037090
apiKey:        AIzaSy… (chiave completa leggibile nella storia)
oAuthClientId: 699491368839-…apps.googleusercontent.com
```

**Toglierlo dal repository non è bastato:** il file resta leggibile da chiunque
con `git show 734711d:firebase-applet-config.json`, e il repository è pubblico.

Una `apiKey` Firebase, di per sé, **non è un segreto**: Google la documenta come
identificatore pubblico e finisce nel bundle di qualunque app web Firebase. Da
sola non apre i dati — a proteggerli sono le regole di Firestore.

Il rischio qui è un altro, ed è concreto. Il prefisso `gen-lang-client-` è
quello dei progetti creati da **Google AI Studio**, e `metadata.json` dichiara
`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`: quella chiave ha con ogni probabilità
accesso all'**API Gemini, che si paga a consumo**. I bot che scandagliano i
repository pubblici in cerca di chiavi Google le trovano in ore, non in giorni.

**Azione necessaria, in questo ordine:**

1. **Revocare o rigenerare quella chiave** su
   `console.cloud.google.com` → *API e servizi* → *Credenziali*, progetto
   `gen-lang-client-0184037090`. In alternativa, limitarla per referrer HTTP e
   per singola API. Questo chiude il problema davvero.
2. **Controllare la fatturazione** dello stesso progetto, per escludere consumi
   non riconosciuti negli ultimi giorni.
3. *(facoltativo)* Riscrivere la storia git per cancellare il file. **È
   secondario:** la chiave è stata pubblica per giorni e va considerata
   compromessa comunque, GitHub conserva i commit orfani raggiungibili per SHA,
   e la riscrittura è un'operazione distruttiva che cambia tutti gli
   identificativi dei commit. Revocare la chiave rende questo passaggio inutile.

Finché la chiave non è revocata, il punto 1 resta il lavoro più urgente del
progetto — prima di qualsiasi funzionalità.

---

## 6. Il nodo ancora aperto: vedere le modifiche mentre si fanno

È la richiesta esplicita ed è l'unica cosa che manca. Tre strade, con i costi
veri.

### A. Ciclo via GitHub Pages — funziona già, zero installazioni

Io modifico e faccio push su `main`, GitHub compila e pubblica in circa
quarantacinque secondi, tu ricarichi la pagina sul telefono.

*Latenza: circa un minuto. Da installare: niente.* Non è simultaneo, ma è già in
piedi e si usa da qualsiasi dispositivo, telefono compreso. **Oggi è questo il
modo di lavorare.**

### B. Claude Code sul tuo computer — questo sì è simultaneo

Sul tuo PC: installi Claude Code, cloni il repository, avvii `bun run dev` e
apri `localhost:3000`. Da lì mi parli in quella sessione: io tocco un file e
Vite aggiorna il browser **in meno di un secondo, senza nemmeno ricaricare la
pagina**. Vedi la modifica comparire mentre la scrivo.

*Latenza: istantanea. Da installare: bun (o Node) e Claude Code sul computer,
una volta sola.* È l'unica strada che dà davvero quello che hai chiesto. Se
l'obiettivo è lavorare seriamente sull'app, vale la mezz'ora di setup iniziale.

### C. Tunnel dalla sessione remota — non praticabile

Aprire al pubblico il server di sviluppo che gira in questa sessione cloud.
**Verificato che non funziona:** il proxy dell'ambiente blocca le connessioni in
uscita (`403 connect_rejected` anche solo verso github.io). Strada chiusa, non
vale la pena tentarla.

---

## 7. Prompt da incollare in una chat nuova

Da qui in giù, copia tutto.

```
Lavoriamo su TrappArchive, la mia app per scrivere pezzi rap.
Repository: github.com/sonodepi/TrappArchive (pubblico).
App online: https://sonodepi.github.io/TrappArchive/

COME LAVORO
Scrivo in italiano, spesso dal telefono, e non sono uno sviluppatore: non
darmi per scontati passaggi tecnici e non chiedermi di leggere codice per
capire cosa hai fatto. Dimmi cosa cambia nell'app, non come l'hai scritto.
Se una cosa non si può fare, dimmelo subito e spiegami perché, invece di
provarci e lasciarla a metà.

COS'È L'APP
PWA locale: React 19 + Vite 6 + TypeScript strict + Tailwind 4, gestore
pacchetti bun. Nessun server nostro. I dati stanno nel browser — IndexedDB
per l'audio, localStorage per il catalogo. Fa: archivio tracce e album,
editor di testi, analisi audio locale di BPM e tonalità (Web Worker, FFT),
e scrittura di gruppo fino a quattro persone.

REGOLE DEL PROGETTO — non discuterle, rispettale
1. L'app deve fare quello che la sua interfaccia promette. Un bottone che
   non funziona si ripara o si toglie. Mai lasciare una promessa vuota.
2. Locale prima di tutto. Niente server obbligatori, niente account
   obbligatori. Il cloud (Firestore) esiste ma è facoltativo e spento.
3. Mai perdere testo scritto da qualcuno. Se una fusione sovrascrive
   qualcosa, l'app lo deve dire in chiaro all'utente.
4. Interfaccia in italiano. Commenti nel codice in italiano.
5. Prima di dire che una cosa funziona, provala davvero. I test verdi non
   bastano: 79 test passavano anche quando il deploy era rotto.

COM'È DIVISO IL CODICE
src/audio/      analisi BPM e tonalità, in Web Worker, tutto offline
src/cloud/      sync Firestore facoltativa (sync.ts è puro e testato)
src/components/ interfaccia; WorkingOn.tsx = scrittura di gruppo
src/drafts/     collab.ts: blocchi, permessi, fusione, conflitti
src/settings/   impostazioni + identità autore (UUID per dispositivo)
src/storage/    IndexedDB, localStorage, migrazioni dati vecchi
Comandi: bun run dev (porta 3000) | bun run test | bun run lint

DECISIONI GIÀ PRESE — non rimetterle in discussione
- Scrittura di gruppo A TURNI, non in diretta: la bozza è un file JSON che
  passa di mano. Max 4 autori, ognuno possiede i suoi blocchi, tutti leggono
  tutto, solo il creatore della bozza fonde. Sui conflitti vince il più
  recente MA l'app lo dichiara.
- Identità per dispositivo (UUID nel browser), non account.
- Lo scraping di Tunebat è stato RIMOSSO: il sito costruisce i dati con
  JavaScript dopo il caricamento, quindi scaricare l'HTML dà una pagina
  vuota. Resta solo il link, con scritto accanto il perché.
- L'audio non si sincronizza sul cloud: un documento Firestore si ferma a
  1 MiB, un MP3 è molto oltre.

STATO ATTUALE
Tutto pushato. 79 test verdi. Il deploy su GitHub Pages funziona (ha
cominciato a funzionare quando il repository è diventato pubblico e il
ramo è stato fuso in main — Pages non pubblica da repo privati gratuiti).

SICUREZZA — verifica se è ancora aperto
Il repository è pubblico ed è stato controllato: codice e storia sono
puliti, nessun dato personale, nessuna credenziale nel codice attuale.
Resta però una cosa da chiudere fuori da GitHub: nella storia dei commit
(file firebase-applet-config.json, commit 734711d) c'è la chiave di un
progetto Google AI Studio, gen-lang-client-0184037090, che ha probabile
accesso all'API Gemini a pagamento. Va REVOCATA o RISTRETTA dalla Google
Cloud Console. Chiedimi se l'ho già fatto: se non l'ho fatto, ricordamelo
prima di iniziare qualsiasi altra cosa.

COSA VOGLIO ADESSO
Voglio vedere le modifiche mentre le fai, non minuti dopo.
Oggi il ciclo è: tu fai push su main, GitHub compila in ~45 secondi, io
ricarico la pagina sul telefono. Funziona ma non è simultaneo.
Il modo davvero simultaneo è far girare Claude Code sul mio computer con
`bun run dev` aperto su localhost:3000: lì Vite aggiorna il browser in
meno di un secondo mentre tu scrivi.

Comincia da qui: chiedimi se sto scrivendo dal telefono o dal computer.
- Se sono al computer: guidami nel setup locale un passo alla volta,
  aspettando che ti confermi ogni passo prima di darmi il successivo.
- Se sono al telefono: lavoriamo con il ciclo push-e-ricarica, e mi dici
  ogni volta cosa devo guardare nell'app per verificare la modifica.
```
