# Profilo TrappArchive

Questa skill arriva da Cloudflare e vale per qualunque codice: servizi, CLI,
demoni, binari. Qui c'è **una PWA che gira nel browser, senza server**, 10.405
righe di TypeScript in 51 file. Senza questo foglio si finisce a cercare
overflow di memoria in React, e si perde il tempo che serviva alle cose vere.

## Le uniche cinque superfici che esistono qui

| Dove | Cosa può andare storto | Documento della skill |
|---|---|---|
| `src/drafts/share.ts` | **L'unico punto in cui entra roba scritta da un'altra persona.** AES-GCM + PBKDF2: IV riusati, sale prevedibile, parametri di derivazione, cosa perde un messaggio d'errore | `CLIENT-SIDE.md` |
| `src/storage/migrate.ts` | Valida i backup importati e tutto ciò che arriva dall'archivio locale: inquinamento del prototipo (`__proto__`), confusione di tipo, input senza limite | `CLIENT-SIDE.md`, `DATA-ISOLATION-AND-LIFECYCLE.md` |
| `firestore.rules` | È l'unica cosa che protegge i dati nel cloud: la chiave Firebase **non è un segreto** (vedi il commento in `src/cloud/firebase.ts`) | `CLOUD-AND-DEPLOYMENT.md` |
| `localStorage` / IndexedDB | Cosa resta scritto sul dispositivo e non se ne va più. È già successo: la chiave Gemini ritirata restava nel browser senza modo di cancellarla | `DATA-ISOLATION-AND-LIFECYCLE.md` |
| `package.json` + `bun.lock` | Dipendenze: è codice di altri che finisce nel browser di chi usa l'app | `SUPPLY-CHAIN-AND-RELEASE.md` |

## Cosa **non** si applica, e perché

Non sono da controllare «per scrupolo»: non esistono proprio.

- `MEMORY-SAFETY-AND-BINARY.md` — non c'è nessun binario. È TypeScript
  compilato in JavaScript che gira nel browser.
- `DESKTOP-MOBILE-AND-LOCAL-IPC.md` — niente app desktop, niente IPC locale.
  L'app si installa dal browser, non è un eseguibile.
- `PROTOCOLS-RPC-AND-MESSAGING.md` — niente RPC. L'unica cosa che somiglia a un
  canale è il service worker della PWA.
- `AI-AND-LLM.md` — la trascrizione Gemini è stata **rimossa del tutto** dopo
  che la chiave era finita nella storia pubblica del repository. Non c'è più
  nessun modello nel codice, e non va reintrodotto senza parlarne con l'utente.
- `WEB-PROTOCOL-AND-AUTH.md` — vale solo in parte: **non c'è autenticazione**
  e non c'è un backend da aggirare. Niente bypass di autorizzazione, niente
  injection lato server, niente sessioni da rubare.
- `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` — un'app locale che si esaurisce da
  sola fa danno solo a chi la sta usando. Conta se un codice di condivisione
  malevolo può bloccare il browser di chi lo incolla: quello sì.

## Una cosa già verificata, per non rifarla

In tutto `src/` non c'è **un solo** `dangerouslySetInnerHTML`, `innerHTML`,
`eval` o `new Function` (`grep`, 22 settembre 2026). Il testo delle canzoni,
comprese le ad libs colorate, passa per elementi React, che fanno l'escape da
soli. La classe di difetti più ovvia per un'app così è chiusa — ma **si
ricontrolla** se qualcuno tocca lo specchio colorato di `LyricsEditor.tsx`.

## Modalità

Per una passata mirata si usa la **guidance mode** della skill: solo le parti
che servono, niente sei fasi, niente cartella di output, niente sub-agenti. Le
sei fasi complete hanno senso su un obiettivo grosso, non su 10.000 righe, e
richiedono una sandbox che qui non serve perché non si esegue codice di
nessun altro.

---

La skill è di Cloudflare, licenza MIT (`LICENSE-cloudflare`), presa alla
revisione in `.upstream-commit`. I suoi file **non sono stati modificati**, a
parte il rimando a questo foglio in testa a `SKILL.md`: per aggiornarla basta
ricopiarla sopra e rimettere quelle righe.
