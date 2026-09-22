# Prompt pronti per lavorare da un terminale locale

Questo file serve a far girare audit e lavori **sul PC**, dentro la cartella del
progetto, invece che da una sessione cloud che il PC non lo vede.

## 0. Prima di tutto: sei nel posto giusto?

Non dare per scontato dove sta il clone. Questo comando elenca ogni repository
sotto la tua cartella utente con il suo remoto, e non tocca niente:

```bash
find ~ -maxdepth 4 -name .git -type d 2>/dev/null | while read g; do
  d=$(dirname "$g"); printf '%s → ' "$d"
  git -C "$d" remote get-url origin 2>/dev/null || echo "(nessun remoto)"
done
```

- **Stampa una riga con `sonodepi/TrappArchive`** → quella è la cartella buona.
- **Non la stampa** → il clone non c'è: prendine uno nuovo, in una cartella
  nuova, senza sovrascrivere niente di quello che hai già:

  ```bash
  mkdir -p ~/Scrivania/code/progetti/TrappArchive
  cd ~/Scrivania/code/progetti/TrappArchive
  git clone https://github.com/sonodepi/TrappArchive.git app
  cd app
  ```

- **`git status` risponde "non ci sono ancora commit" in una cartella che non
  c'entra** → c'è un `git init` accidentale in una cartella superiore. Prima
  guarda, poi decidi:

  ```bash
  git rev-parse --show-toplevel   # dov'è davvero quel repository
  git log --oneline 2>&1 | head   # se non stampa nessun commit, è vuoto
  ```

  Cancellare un `.git` è irreversibile: fallo solo dopo aver visto con i tuoi
  occhi che è vuoto e che non è quello del progetto.

## Come si apre una sessione locale

```bash
npm install -g @anthropic-ai/claude-code   # una volta sola; con sudo se dà errore di permessi
cd <la cartella trovata al punto 0>
claude
```

In VS Code c'è anche l'estensione "Claude Code": stessa cosa, dentro l'editor.

Prima di lanciare qualunque prompt:

```bash
git status                # se non è pulito: git stash push -u -m "roba mia"
git fetch origin
git checkout main
git pull --ff-only origin main
npm install               # oppure bun install, se hai bun
```

## Le skill: cosa c'è già e cosa vale la pena aggiungere

**Nel repository** ci sono già tre skill, in `.claude/skills/`: arrivano con il
`git pull`, non si installa niente, e Claude Code le vede da solo —
`verifica-dal-vivo`, `condivisione-bozze`, `scrittura`. Sono scritte su questo
progetto: dentro ci sono i comandi veri e i difetti già presi.

**Dal catalogo**, due che c'entrano davvero:

```
/plugin marketplace add anthropics/knowledge-work-plugins
/plugin          # poi scegli dall'elenco: gli identificativi esatti li mostra questa schermata
```

- **`modern-web-guidance`** (Google Chrome) — pratiche web aggiornate: CSS,
  layout, prestazioni, PWA. Non porta server remoti né hook: è il più innocuo.
- **`design`** (Anthropic) — critica di design, audit di accessibilità WCAG,
  testi dell'interfaccia. Si porta dietro dei server MCP (Figma, Slack, Notion,
  Gmail…) che puoi lasciare scollegati.

Più **tre** di [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(MIT), che ne contiene venticinque:

```
/plugin marketplace add addyosmani/agent-skills
/plugin          # poi abilita SOLO queste tre
```

- **`frontend-ui-engineering`** — architettura dei componenti, responsive,
  accessibilità WCAG 2.1 AA;
- **`browser-testing-with-devtools`** — ispezione e profilazione nel browser;
- **`performance-optimization`** — si misura prima di ottimizzare.

**Le altre ventidue lasciale spente, e il motivo conta.** Venticinque skill
generiche accanto alle quattro del progetto vuol dire che un agente può aprire
`frontend-ui-engineering` al posto di `verifica-dal-vivo` e saltare lo script
che misura: è esattamente così che sono passati i tre difetti che hai trovato
tu. La regola sta in `CLAUDE.md` §6 — dove si sovrappongono, vince quella del
progetto — ma meno rumore c'è, meno serve fidarsi di una regola.

**`security-guidance` — resta fuori, e adesso c'è di meglio.** Installa hook
che girano a ogni modifica e a ogni commit. Al suo posto, in
`.claude/skills/security-audit/`, c'è la skill di Cloudflare: fa le stesse
categorie di controlli ma **parte solo quando la chiami**, e arriva già col
`git pull`.

Quello che cercavi come "humanize" o "impeccable" nel catalogo **non esiste**:
la regola contro il testo gonfio è la skill `scrittura` del progetto.

## I sette repository che mi hai passato: verdetto e motivo

Controllati il 22 settembre 2026, numeri e licenze presi dalle API di GitHub.
I «no» sono scritti col motivo, perché fra sei mesi serve più il motivo del
nome.

| Repository | Cos'è | Verdetto |
|---|---|---|
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) · MIT · 15,2k★ | Skill per audit di sicurezza in sei fasi | **Preso.** È in `.claude/skills/security-audit/`, col profilo di questo progetto |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) · MIT · 96,7k★ | 25 skill generiche | **Prese tre**, le altre spente (sopra) |
| [chaitanyagiri/munder-difflin](https://github.com/chaitanyagiri/munder-difflin) · MIT · 7,8k★ | Ufficio di agenti: memoria, mailbox, worktree per agente | **Sì**, e il repository è stato preparato: vedi `docs/UFFICIO_AGENTI.md` |
| [alibaba/open-code-review](https://github.com/alibaba/open-code-review) · Apache-2.0 · 37,2k★ | Review dei diff con un LLM, commenti riga per riga | **Dopo.** Vive nelle pull request, e qui si spinge dritto su `main`. Adesso che c'è `ci.yml` ha un posto dove stare: un secondo job. Richiede una chiave LLM nei secrets, quindi è una scelta tua |
| [jamiepine/voicebox](https://github.com/jamiepine/voicebox) · MIT · 55,2k★ | Studio vocale locale: clonazione, Whisper, dettatura | **Non come dipendenza** — è un'app desktop con backend Python, questa è una PWA senza server. Due usi veri in `STATO_E_PROSSIMO_PASSO.md` |
| [Tencent/WeKnora](https://github.com/Tencent/WeKnora) · 27,3k★ · licenza «Other» | RAG aziendale: Go + PostgreSQL + Redis + database vettoriale + Docker | **No.** La sua idea buona — memoria fra sessioni, wiki automatica — qui è `docs/` più l'hook di avvio, a costo zero di infrastruttura. E la licenza non è una delle standard |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) · MIT · 262k★ | 68 agent, 292 skill, 94 shim, hook, 52 MB | **No, non qui.** Contraddice la ragione per cui `security-guidance` è rimasto fuori: hook a ogni modifica. Se ti incuriosisce, provalo su `sonodepi/Prova`, non su questo |
| [NSA/ghidra](https://github.com/NationalSecurityAgency/ghidra) · Apache-2.0 · 79k★ | Reverse engineering di binari | **Zero.** Qui non c'è nessun binario: è TypeScript che gira nel browser |

---

## 1. Audit completo del progetto

Da incollare in una sessione aperta nella cartella del repo.

> Fai un audit completo di questo progetto e scrivi l'esito in `docs/AUDIT.md`,
> sostituendo quello che c'è con la data di oggi.
>
> Prima di tutto leggi `CLAUDE.md`, `docs/REGISTRO_SESSIONI.md` e
> `docs/STATO_E_PROSSIMO_PASSO.md`: sono le regole e lo stato del progetto, e
> l'audit deve partire da lì invece che da zero.
>
> Controlla, in quest'ordine, e riporta solo quello che verifichi davvero:
> 1. `npm run lint`, `npm test`, `npm run build` — devono essere tutti puliti;
>    se non lo sono, quello è il primo punto dell'audit. (Su questa macchina
>    **bun non c'è**: usa gli script npm, non `bunx`.)
> 2. L'interfaccia mantiene quello che promette? Ogni pulsante fa davvero quello
>    che dice, ogni messaggio di successo segue un successo verificato.
> 3. Si perde roba dell'utente da qualche parte? Cerca in particolare stato
>    catturato prima di un `await` e riscritto dopo, e cancellazioni che non si
>    propagano.
> 4. Sicurezza: segreti nel codice o nella storia, dati che escono dal
>    dispositivo senza che l'utente lo sappia, validazione di tutto ciò che
>    entra da fuori (file importati, codici di condivisione, archivio locale).
> 5. Responsive: avvia `npm run dev` e guarda ogni schermata a 390, 768, 1024 e
>    1280 px. Cerca sovrapposizioni vere e scorrimento orizzontale misurando le
>    posizioni degli elementi, non a occhio.
> 6. Codice morto, documenti che descrivono cose non più vere, dipendenze
>    installate e mai importate.
>
> Per ogni difetto scrivi: dov'è (file e riga), cosa succede all'utente, e se
> l'hai riparato o no. Non riparare niente che non sai verificare.
>
> Alla fine aggiungi la tua riga in `docs/REGISTRO_SESSIONI.md` e fai un commit.

---

## 2. Passata sull'interfaccia, con le skill

Questo è il prompt da incollare quando vuoi che qualcuno «sistemi un po' tutto»
senza rompere niente. Non è generico: dice da dove partire e come si verifica.

> Leggi `CLAUDE.md` e le quattro skill in `.claude/skills/`: sono di questo
> progetto e vanno usate, non ignorate — e dove una skill del catalogo dice
> un'altra cosa, vince quella del progetto. Poi leggi `docs/AUDIT.md` e
> `docs/STATO_E_PROSSIMO_PASSO.md` per sapere cosa è già stato guardato.
>
> All'apertura l'hook ti ha già stampato i branch e chi sta lavorando su cosa.
> Se quello stato non è comparso, l'hook non è partito: fallo girare a mano
> (`./.claude/hooks/session-start.sh`) e guarda perché, invece di lavorare
> alla cieca.
>
> **Si parte misurando.** Fai girare
> `node .claude/skills/verifica-dal-vivo/controlla-schermate.mjs` (se manca
> Playwright: `npm i -D playwright && npx playwright install chromium`) e dimmi
> cosa trova prima di toccare qualunque cosa. Su questa macchina **bun non c'è**:
> usa `npm install`, `npm run lint`, `npm test`, `npm run build`, `npm run dev`.
>
> Poi lavora, dal più grave al meno grave:
> 1. quello che lo script ha trovato;
> 2. i punti ancora aperti in `docs/AUDIT.md`;
> 3. l'interfaccia guardata con occhi tuoi a **1050 px** — è la larghezza a cui
>    lavoro io, mezzo schermo, ed è lì che sono usciti tutti i difetti finora.
>    Se hai installato il plugin `design`, usa `/design:critique` sulle schermate
>    e `/design:accessibility` per il contrasto e i bersagli troppo piccoli.
>
> Regole: un commit per problema, ognuno revertibile da solo; prima un test che
> riproduce il difetto dove è possibile, poi la correzione; niente riscritture di
> cose che funzionano; interfaccia e commenti in italiano, e i commenti spiegano
> il perché (vedi la skill `scrittura`).
>
> Prima di ogni commit: `npm run lint`, `npm test`, `npm run build` puliti, e la
> cosa che hai toccato **riprovata dal vivo** — qui i test verdi sono già passati
> mentre qualcosa era rotto. Alla fine rifai girare lo script: deve dire
> «nessun problema».
>
> Se trovi qualcosa di grosso che non rientra in questa passata, scrivilo in
> `docs/AUDIT.md` invece di improvvisare una mezza correzione. Alla fine: riga
> nel registro delle sessioni, e dimmi cosa hai cambiato, cosa hai verificato e
> cosa hai lasciato lì.

---

## 3. Salvare la Feature 3 non committata

Da fare **prima** di qualunque pulizia della cartella. Vedi
`docs/STATO_E_PROSSIMO_PASSO.md`.

> Nella cartella sopra questo repo c'è
> `TrappArchive-claude-trapparchive-app-review-x38gkz`: non è un repository git,
> ma contiene del lavoro mai committato (lo stato "da registrare" delle tracce:
> `status?: 'da-registrare' | 'registrata'` in `types.ts`, più modifiche a
> `TrackEditor.tsx` e `Library.tsx`).
>
> Confronta quei tre file con quelli di questo repo, portami solo le differenze
> che riguardano quella funzione — non quello che nel frattempo è cambiato qui —
> e proponimi un commit. Se qualcosa non combacia più con il codice di adesso,
> fermati e dimmelo invece di forzare.

---

## 4. Provare la sincronizzazione cloud sul serio

> La sincronizzazione Firestore non è mai stata provata con un progetto vero.
> Guidami: cosa creo nella console Firebase, dove incollo `firestore.rules`,
> cosa metto nelle Impostazioni dell'app.
>
> Poi facciamo il giro completo con due browser diversi: creo una traccia sul
> primo, sincronizzo, la vedo comparire sul secondo, la **cancello** dal
> secondo, sincronizzo tutti e due e verifico che **non torni indietro**.
> Se torna indietro è un bug bloccante: fermati e dimmelo.

---

## 5. Scrivere una riga nel registro (se hai fatto qualcosa a mano)

> Aggiungi in cima a `docs/REGISTRO_SESSIONI.md` una riga per oggi con: branch
> su cui ho lavorato, cosa ho fatto, cosa resta aperto. Poi committa solo quel
> file.
