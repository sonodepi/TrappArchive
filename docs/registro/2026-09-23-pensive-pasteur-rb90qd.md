# 23-25 settembre 2026 · `claude/pensive-pasteur-rb90qd` · sessione cloud

Coda della sessione del 22: il passaggio di consegne verso il PC, e le verifiche
prima di decidere se pubblicare.

## Fatto

### Il passaggio di consegne non vive più in una chat (`f502527`)

Il prompt per l'agente locale esisteva solo in una finestra di conversazione —
lo stesso difetto per cui questo progetto ha già perso del lavoro. È diventato
la **sezione 0 di `docs/PROMPT_AGENTE_LOCALE.md`**, la prima del file perché è
la prima cosa da fare.

Scritto da una sessione cloud, che il PC non lo vede: per questo fa **trovare**
il clone e le copie sciolte invece di dare per scontato dove stanno.

Entrambi i `find` sono stati estratti dal file ed eseguiti così com'erano, non
riscritti a mano. È così che è saltato fuori un falso allarme che valeva la pena
togliere: le cartelle interne di Claude Code
(`~/.cache/claude-cli-nodejs/-home-depi-TrappArchive`, `~/.claude/projects/…`)
portano il nome del progetto senza esserne una copia, e finivano nell'elenco
davanti all'unica riga che conta.

### Il controllo da trenta secondi (`1c837dc`)

La sezione 0 è scritta per un agente: apri Claude, incolli un muro di testo. Chi
ha dieci minuti e vuole solo sapere se la cartella con la **Feature 3** esiste
ancora ha bisogno di altro. Adesso in cima c'è un comando di sola lettura che
distingue la copia che contiene davvero la funzione (cerca `da-registrare` in
`src/types.ts`) da una copia vecchia qualsiasi.

Provato contro una finta home con tutti e quattro i casi: clone git vero
(saltato), copia sciolta **con** la Feature 3 (segnalata come quella giusta),
copia sciolta senza (segnalata come tale), cartella interna di Claude Code
(ignorata, come ogni cartella nascosta).

## Verificato, e come

| Cosa | Come | Esito |
|---|---|---|
| Tipi | `npm run lint` | pulito |
| Test | `npm test` | 146/146 |
| Build | `npm run build` | completa |
| **Nove larghezze × otto viste** | `controlla-schermate.mjs` sulla build, 25 set | **nessun problema, console pulita** |
| CI | tre push sul branch | verde |

Lo sweep contava: l'ultima passata pulita era di tre commit prima, e nel mezzo
`migrate.ts` aveva cambiato comportamento — un audio con indirizzo rifiutato
adesso diventa `unavailable` e **disegna un messaggio** che prima non c'era. Era
poco probabile che spostasse qualcosa, ma «poco probabile» non è un risultato.

## Stato al momento della chiusura

- **9 commit avanti a `main`**, che è fermo al 17 settembre.
- Quello che è **online non contiene niente di tutto questo**: né il tetto ai
  blocchi, né il controllo sui codici enormi, né gli schemi degli indirizzi, né
  l'audio che dice «non disponibile» invece di sparire, né l'hook, né il CI.
- `main` **non è stato toccato**: pubblicare è l'ultimo gesto e va fatto mentre
  qualcuno lo guarda.

## Resta aperto

- **La Feature 3 non è ancora stata controllata.** È la sola cosa che può
  sparire davvero. Il comando da trenta secondi è in cima a
  `docs/PROMPT_AGENTE_LOCALE.md`.
- L'agente locale non ha ancora pushato niente: sul remoto non esiste nessun
  commit da una sessione sul PC.
- Restano i due punti di sicurezza in `docs/AUDIT.md` §5, l'aggiornamento di
  `vitest` a 4.1.11+, e la sincronizzazione Firestore mai provata sul serio.

## Fuori progetto, per memoria

La serata si è fermata su un problema di macchina, non di codice: su quel PC
Debian 13 non vedeva la scheda di rete integrata. Ponte con il tethering USB dal
telefono — che non richiede nessun firmware, i driver sono nel kernel — e
diagnosi affidata a un agente da terminale. Non c'entra con questo repository,
ma è il motivo per cui la lista di quella sera non è stata finita.
