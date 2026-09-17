# Prompt pronti per lavorare da un terminale locale

Questo file serve a far girare audit e lavori **sul PC**, dentro la cartella del
progetto, invece che da una sessione cloud che il PC non lo vede.

## Come si apre una sessione locale

```bash
npm i -g @anthropic-ai/claude-code        # una volta sola
cd ~/Scrivania/code/progetti/TrappArchive # la cartella che contiene il repo
cd TrappArchive                           # il clone vero: `git remote -v` deve rispondere
claude
```

In VS Code c'è anche l'estensione "Claude Code": stessa cosa, dentro l'editor.

Prima di lanciare qualunque prompt:

```bash
git status                # se non è pulito: git stash push -u -m "roba mia"
git fetch origin
git checkout main
git pull --ff-only origin main
bun install || npm install
```

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
> 1. `bunx tsc --noEmit`, `bunx vitest run`, `bunx vite build` — devono essere
>    tutti puliti; se non lo sono, quello è il primo punto dell'audit.
> 2. L'interfaccia mantiene quello che promette? Ogni pulsante fa davvero quello
>    che dice, ogni messaggio di successo segue un successo verificato.
> 3. Si perde roba dell'utente da qualche parte? Cerca in particolare stato
>    catturato prima di un `await` e riscritto dopo, e cancellazioni che non si
>    propagano.
> 4. Sicurezza: segreti nel codice o nella storia, dati che escono dal
>    dispositivo senza che l'utente lo sappia, validazione di tutto ciò che
>    entra da fuori (file importati, codici di condivisione, archivio locale).
> 5. Responsive: avvia `bun run dev` e guarda ogni schermata a 390, 768, 1024 e
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

## 2. Passata di miglioramento generale

Quando vuoi che qualcuno "sistemi un po' tutto" senza rompere niente.

> Leggi `CLAUDE.md`, `docs/AUDIT.md` e `docs/STATO_E_PROSSIMO_PASSO.md`, poi
> lavora sui punti ancora aperti dell'audit, dal più grave al meno grave.
>
> Regole: un commit per problema, ognuno revertibile da solo; prima un test che
> riproduce il difetto dove è possibile, poi la correzione; niente riscritture
> di cose che funzionano; l'interfaccia resta in italiano e i commenti spiegano
> il perché.
>
> Prima di ogni commit: `bunx tsc --noEmit`, `bunx vitest run`, `bunx vite build`
> devono essere puliti, e la cosa che hai toccato la provi dal vivo con
> `bun run dev` — i test verdi qui sono già passati mentre qualcosa era rotto.
>
> Se trovi qualcosa di grosso che non rientra in questa passata, scrivilo in
> `docs/AUDIT.md` invece di improvvisare una mezza correzione.
>
> Alla fine: riga nel registro delle sessioni, e dimmi cosa hai cambiato e cosa
> hai lasciato lì.

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
