# Registro delle sessioni — indice

**Questo file è solo l'indice.** Il racconto di ogni sessione sta in un file
suo, dentro `docs/registro/`.

**Prima di chiudere la sessione**, crea il tuo file
`docs/registro/AAAA-MM-GG-<ultimo pezzo del branch>.md` e aggiungi una riga qui
sotto. Vale anche se non hai committato niente: serve a chi apre dopo di te per
non rifare o disfare il tuo lavoro.

**Perché un file per sessione e non uno solo.** Perché quando lavorano in due —
in worktree paralleli, o su due macchine — un registro unico si scontra al merge
ogni volta, e chi perde il conflitto perde anche la riga dell'altro.

Chi sta lavorando **adesso** sta in `docs/registro/IN_CORSO.md`, che l'hook di
avvio stampa da solo a ogni sessione.

---

| Data | Branch | In due righe |
|---|---|---|
| [24 set 2026](registro/2026-09-24-pensive-pasteur-rb90qd.md) | `claude/pensive-pasteur-rb90qd` | Recuperata dalla cartella non versionata la funzione «da registrare» e portata sul branch; il badge sulla copertina si sovrapponeva ai comandi di 13 px a 1050 px, corretto; la passata automatica non poteva vederlo perché gira su libreria vuota |
| [22 set 2026](registro/2026-09-22-pensive-pasteur-rb90qd.md) | `claude/pensive-pasteur-rb90qd` | Sette repository controllati; hook di avvio che stampa lo stato dei branch a ogni sessione; skill di sicurezza di Cloudflare e passata mirata (3 difetti riparati, 2 aperti); CI su branch e pull request |
| [16-17 set 2026](registro/2026-09-16-pensive-pasteur-rb90qd.md) | `claude/pensive-pasteur-rb90qd` → `main` | Editor del testo riscritto, Gemini rimosso, condivisione cifrata, cancellazioni che non risorgono, i documenti del progetto e le prime tre skill |
| [16 set 2026](registro/2026-09-16-pensive-einstein-e78xle.md) | `claude/pensive-einstein-e78xle` | Condivisione cifrata e rimozione di Gemini (poi portate su `main`); il suo editor "sporche" è stato scartato. Branch superato |
| [10 set 2026](registro/2026-09-10-trapparchive-app-review-x38gkz.md) | `claude/trapparchive-app-review-x38gkz` | Rapporto di sicurezza sul repository pubblico: chiave Google trovata nella storia e revocata |
| [8-9 set 2026](registro/2026-09-08-trapparchive-app-review-x38gkz.md) | `claude/trapparchive-app-review-x38gkz` → `main` | Le promesse dell'interfaccia rese vere, scrittura in gruppo, GitHub Pages, sincronizzazione Firestore |
