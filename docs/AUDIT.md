# Audit di sicurezza — 22 settembre 2026

Passata mirata sul codice di `claude/pensive-pasteur-rb90qd`, con la skill
`security-audit` di Cloudflare in **guidance mode**: solo le parti che servono,
niente sei fasi, niente sub-agenti, nessuna sandbox — qui non si esegue codice
di nessun altro.

L'audit generale del 17 settembre è in
[`docs/storico/AUDIT-2026-09-17.md`](storico/AUDIT-2026-09-17.md). Questo
riguarda la sicurezza, che era il pezzo rimandato di proposito: prima l'app
doveva funzionare.

**Verdetto: tre difetti veri, riparati. Due punti aperti, scritti sotto.**

---

## 1. Dove si è guardato, e dove no

Questa è una PWA che gira nel browser, senza server: 10.405 righe di
TypeScript in 51 file. Le superfici che esistono davvero sono cinque, ed è
quello che dice `.claude/skills/security-audit/PROFILO-TRAPPARCHIVE.md`.

| Superficie | Esito |
|---|---|
| `src/drafts/share.ts` — l'unico punto in cui entra roba scritta da un'altra persona | §2.2 e §2.3 |
| `src/storage/migrate.ts` — valida backup importati e archivio locale | §2.1, §2.3, §3 |
| `firestore.rules` | pulito (§3) |
| `localStorage` / IndexedDB | pulito in questa passata |
| Dipendenze | §4 |

**Non** si è guardato, perché non esiste in un'app così: memoria e binari, IPC
locale, RPC, autenticazione e autorizzazione lato server, modelli di
linguaggio (Gemini è stato rimosso).

## 2. Difetti trovati e riparati

Ognuno ha un test che **diventa rosso se si toglie la correzione**, e l'ho
verificato togliendola davvero, non immaginandolo.

### 2.1 Una bozza ricevuta poteva avere un numero qualsiasi di blocchi

`src/storage/migrate.ts`, `parseDraft`. Gli autori avevano già un tetto
(`MAX_AUTHORS = 4`), i blocchi no: `raw.blocks.map(parseBlock)` accettava
quanti ne arrivavano.

**Cosa succedeva a chi usa l'app.** Un codice di condivisione con mezzo
milione di blocchi non rompe l'app una volta sola: la bozza finisce in
`localStorage` e viene ridisegnata **a ogni avvio**, quindi l'app resta
inutilizzabile finché non si svuota l'archivio a mano.

**Chi poteva farlo.** Chi scrive con te: serve che tu incolli il suo codice e
la sua password. Non un estraneo.

**Riparato**: `MAX_BLOCKS = 1000`, largo di proposito — un pezzo lungo ha venti
blocchi, non mille. È un paraurti contro l'assurdo, non un limite alla
scrittura.

### 2.2 Un codice enorme incollato inchiodava la scheda del browser

`src/drafts/share.ts`, `decryptDraft`. Prima di qualunque controllo di
lunghezza si facevano `atob`, un ciclo byte per byte su tutto il contenuto e
210.000 giri di PBKDF2, **sul thread che disegna l'interfaccia**.

**Riparato**: il controllo di lunghezza viene per primo, prima che la chiave
venga derivata — è l'unico controllo che costa zero. `MAX_CODE_LENGTH` = 4 MB,
molto sopra qualunque bozza vera e molto sotto la soglia in cui il browser si
pianta.

### 2.3 Indirizzi da fuori senza controllo dello schema

`src/storage/migrate.ts`. Una URL che arriva da un backup importato o da un
codice di condivisione (`audio.url`, `audioFilePath`, `beatUrl`) finiva senza
filtri in `<audio src>` (`src/components/Player.tsx:103`) e in `fetch`
(`src/storage/audioAccess.ts:29`).

**Onestà su quanto è grave: oggi non è sfruttabile.**
`audio.src = 'javascript:...'` non esegue niente, e `fetch('file:///...')`
fallisce nel browser. Ma quella URL è già a un passo da un `<a href>`, e il
giorno che qualcuno la renda un link, `javascript:` diventa esecuzione di
codice. Si chiude adesso che costa una riga.

**Riparato**: solo `http:` e `https:`, nell'unico imbuto da cui passa ogni
oggetto che arriva da fuori.

### 2.4 Non di sicurezza, trovato per strada

`extractYoutubeId` in `src/utils.ts` non era ancorato all'inizio
dell'indirizzo: `https://altrosito.it/youtu.be/ID` veniva scambiato per un
video di YouTube, e l'app mostrava un player sbagliato invece di dire che quel
link non si può riprodurre. L'origine dell'iframe è fissa
(`https://www.youtube.com/embed/`), quindi non c'era modo di uscirne: era un
difetto di correttezza, non un buco.

## 3. Cose controllate e risultate a posto

Scritte qui perché nessuno ci rispenda un'ora.

- **Niente XSS.** In tutto `src/` non c'è **un solo** `dangerouslySetInnerHTML`,
  `innerHTML`, `eval` o `new Function`. Il testo delle canzoni, ad libs
  comprese, passa per elementi React, che fanno l'escape da soli.
- **Niente inquinamento del prototipo.** `migrate.ts` costruisce oggetti nuovi
  campo per campo: nessun merge ricorsivo, nessuna scrittura con chiave presa
  dall'esterno. Una chiave `__proto__` in un JSON importato non ha dove
  attaccarsi, e non c'è nessun punto che la rilegga.
- **`firestore.rules`**: ogni utente vede e scrive solo sotto il proprio `uid`,
  con un `allow ... if false` esplicito su tutto il resto, così una raccolta
  aggiunta domani non resta aperta per dimenticanza.
- **La password monouso non ha bias.** L'alfabeto di `generatePassphrase` ha
  esattamente 32 caratteri e 256 è divisibile per 32, quindi il `% 32` non
  sbilancia niente. Tre gruppi da quattro fanno 60 bit di entropia.
- **AES-GCM con IV e sale nuovi a ogni cifratura**, chiave non estraibile,
  autenticazione che distingue davvero una password sbagliata da un codice
  malformato.
- **`getTunebatSearchUrl`** passa per `encodeURIComponent` su un'origine fissa.

## 4. Dipendenze

`npm audit` **non gira su questo progetto**: non c'è nessun `package-lock.json`,
solo `bun.lock`, e risponde `ENOLOCK`. L'ho eseguito fuori dal repository,
generando un lockfile da `package.json` in una cartella di lavoro.

| Cosa | Esito |
|---|---|
| Dipendenze di **produzione** (quello che finisce nel browser di chi usa l'app) | **0 vulnerabilità** |
| Dipendenze di **sviluppo** | 2 moderate, entrambe la stessa: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), path traversal / lettura di file arbitrari in `@vitest/mocker`, intervallo `>=2.1.0 <4.1.11`. Qui c'è `vitest ^3.2.4` |

**Non l'ho aggiornato**, e non per pigrizia: sistemarlo vuol dire portare
`vitest` a 4.1.11 o oltre, cioè un cambio di versione maggiore sotto 146 test,
in mezzo a una passata di sicurezza. Allargare così una correzione è il modo
migliore per romperne un'altra. Va fatto, da solo, con il suo commit.

Quella vulnerabilità **non arriva a chi usa l'app**: `vitest` non finisce nel
pacchetto pubblicato. Morde solo chi esegue i test su codice di cui non si
fida, e qui i test sono i nostri.

## 5. Cosa resta aperto

1. **Un indirizzo che arriva da fuori viene contattato da solo.** Anche con lo
   schema ristretto a http/https, aprire una traccia ricevuta da qualcun altro
   fa partire una richiesta al server scritto in quel file — e quel server
   impara il tuo indirizzo IP e l'ora in cui hai aperto quella traccia. Sono
   dati tuoi che escono dal dispositivo, e la regola numero uno di questo
   progetto dice il contrario.
   **La correzione giusta non è tecnica, è di interfaccia**: distinguere una
   URL che hai scritto tu da una arrivata in un file di un altro, e per la
   seconda chiedere prima di scaricare. Serve un campo in più su `AudioSource`,
   cioè un cambio di forma dei dati: non è roba da infilare in coda a una
   passata di sicurezza. **Scritta qui invece di improvvisare una mezza
   correzione.**
2. **Il formato del codice non porta con sé i parametri della cifratura.**
   `TAv1.` contiene sale, IV e testo cifrato, ma non il numero di giri di
   PBKDF2, che è cablato a 210.000. Le linee guida OWASP oggi dicono 600.000
   per PBKDF2-HMAC-SHA256. Alzare quel numero **invaliderebbe in silenzio ogni
   codice già in giro**, perché chi decifra userebbe un conteggio diverso da
   chi ha cifrato. Per cambiarlo serve un prefisso `TAv2.` che dichiari i
   parametri. Non è urgente — sono password monouso da 60 bit, generate
   dall'app e non scelte da una persona — ma è il tipo di cosa che si scopre
   tardi e male.
3. **La Feature 3 "da registrare" non è committata da nessuna parte.** Vive
   solo in una copia sciolta non-git sul PC. Se quella cartella viene
   cancellata, quel lavoro sparisce. **Da salvare prima di qualunque pulizia.**
4. **La sincronizzazione Firestore non è mai stata provata con un progetto
   vero.** La logica è pura e testata (16 + 13 test), ma il giro completo con
   due dispositivi e un progetto Firebase reale non l'ha mai fatto nessuno.
5. **Nessuno ha ancora guardato questo lavoro con occhi umani.** Condivisione
   cifrata e sincronizzazione sono state scritte e verificate da sessioni
   automatiche. Una rilettura umana di `src/drafts/share.ts` e `src/cloud/` è
   la cosa più utile che possa fare una persona su questo progetto.
6. **`npm` contro `bun`.** Il CI costruisce con `bun` e `bun.lock`; sul PC si
   usa `npm`, che risolve da capo e può prendere versioni diverse. È anche il
   motivo per cui `npm audit` non gira. Due strade: installare `bun` sul PC,
   oppure committare anche un `package-lock.json` — e allora vanno tenuti
   allineati tutti e due, che è un costo suo.

## 6. Come è stato verificato

| Controllo | Comando | Esito |
|---|---|---|
| Tipi | `npm run lint` | pulito |
| Test | `npm test` | 146/146 (erano 140: +6 nuovi) |
| Build | `npm run build` | completa, 19 file in precache |
| I test riproducono i difetti | correzioni tolte a mano, test rieseguiti | 3 rossi, poi 3 verdi |
| Dipendenze | `npm audit` su un lockfile generato fuori dal repo | §4 |

**Una passata sola, nessuna seconda revisione indipendente.** Ogni rilievo è
stato riletto contro il codice, ma nessuno è stato confermato da un secondo
revisore. Le sei fasi complete della skill di Cloudflare servono proprio a
quello, e costano 4-20 invocazioni: se questo codice diventa qualcosa che usa
gente che non conosci, è il momento di spenderle.
