# Far lavorare più agenti su questo progetto senza che si pestino i piedi

> **Quello che non ho provato.** Munder Difflin non l'ho mai fatto girare: sta
> su un portatile che io non vedo. Quello che segue è **come è stato preparato
> il repository** perché un ufficio di agenti ci possa lavorare, più quello che
> risulta dalla sua documentazione. Dove non ho verificato, lo scrivo.

[Munder Difflin](https://github.com/chaitanyagiri/munder-difflin) (MIT) fa
lavorare insieme più CLI di agenti — `claude`, `codex`, e altri — dando a
ognuno memoria in markdown, una casella di posta, **un worktree git suo**, e
una scrivania su cui si clicca per leggere il suo terminale. Dentro ha un
catalogo di skill con installazione in un clic.

Serve Node 18+, un compilatore C/C++ e almeno una CLI di agente già
configurata. Non chiede abbonamenti in più: usa quelli che hai.

## Perché c'entra con il disordine di questo progetto

Il difetto che è costato di più qui non è mai stato il codice. È stato che una
sessione partisse da `main` e riscrivesse una cosa già fatta su un altro
branch, perché **chi le ha dato l'hand-off sapeva e non gliel'ha detto**.
Mailbox, blackboard e worktree per agente esistono per quello.

## Cosa è già pronto nel repository

Queste tre cose funzionano anche senza Munder Difflin, e sono provate qui:

1. **`.claude/hooks/session-start.sh`** — a ogni apertura fa il `fetch` e
   stampa i branch, chi sta lavorando su cosa, e un avviso se il branch è
   indietro rispetto a `origin/main`. **Provato dentro un worktree**, che è
   come lavora una scrivania: la prima versione usava `[ -d .git ]`, e in un
   worktree `.git` è un file, quindi l'hook usciva in silenzio proprio lì.
2. **`docs/registro/`** — un file per sessione. Un registro unico si scontra al
   merge ogni volta che due scrivanie lavorano insieme.
3. **`.github/workflows/ci.yml`** — controlla ogni branch `claude/**` e ogni
   pull request. Prima il lavoro di una sessione non lo controllava nessuno
   finché non era già su `main`, cioè già pubblicato.

## Le scrivanie, per questo progetto

Non servono otto agenti. Ne servono quattro, e ognuno con le sue skill.

| Scrivania | Di cosa si occupa | Skill |
|---|---|---|
| **Interfaccia** | Schermate, responsive, testi dei pulsanti | `verifica-dal-vivo` (del progetto), poi `frontend-ui-engineering` e `browser-testing-with-devtools` dal catalogo |
| **Sicurezza** | Ciò che entra da fuori: codici di condivisione, backup importati, `firestore.rules` | `security-audit` + il suo `PROFILO-TRAPPARCHIVE.md` |
| **Verifica** | Non scrive codice: prova. Il giro a due dispositivi, la build, le nove larghezze | `condivisione-bozze`, `verifica-dal-vivo` |
| **Documenti** | Registro, audit, hand-off. La memoria del progetto | `scrittura` |

**Dove una skill del catalogo e una del progetto si sovrappongono, vince
quella del progetto** (regola in `CLAUDE.md` §6). Le nostre hanno dentro i
selettori veri, lo script vero e i difetti già presi; le altre parlano di un
progetto qualunque. Si usano **in più**, mai **al posto**.

## Le tre regole che non si negoziano

1. **Una sola scrivania alla volta tocca `main`.** Le altre stanno sul loro
   branch `claude/*` e passano dal CI.
2. **Chi apre scrive la sua riga in `docs/registro/IN_CORSO.md`, chi chiude la
   toglie.** Una riga vecchia lì dentro blocca un'altra sessione per niente.
3. **Chi tocca un file che un'altra scrivania ha dichiarato in `IN_CORSO.md` si
   ferma e lo dice.** Due agenti sullo stesso file sono il modo più veloce di
   perdere il lavoro di uno dei due.

## Il rischio da tenere d'occhio

Più scrivanie vuol dire più commit che nessuno rilegge. Il CI controlla tipi,
test e build; **non** controlla se una schermata è diventata brutta o se un
pulsante mente. Per quello resta lo script delle nove larghezze e, alla fine,
il fatto che l'app la usi una persona per scrivere un pezzo vero.
