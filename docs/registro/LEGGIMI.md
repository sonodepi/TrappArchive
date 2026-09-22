# Come si scrive qui dentro

Un file per sessione, mai un file condiviso. Nome:
`AAAA-MM-GG-<ultimo pezzo del branch>.md`, per esempio
`2026-09-22-pensive-pasteur-rb90qd.md`.

**Perche' non un file solo.** Con piu' sessioni che lavorano insieme — in
worktree paralleli, o su macchine diverse — un registro unico si scontra al
merge ogni volta, e chi perde il conflitto perde anche la riga dell'altro. Un
file a testa non si scontra mai.

Dentro: cosa hai fatto, cosa hai verificato **e come**, cosa resta aperto.
Anche se non hai committato niente: serve a chi apre dopo di te.

`IN_CORSO.md` e' l'unica eccezione, ed e' corta di proposito: dice chi sta
lavorando **adesso**, si aggiorna aprendo e chiudendo, e la riga si cancella
quando hai finito. L'hook di avvio la stampa a ogni sessione.
