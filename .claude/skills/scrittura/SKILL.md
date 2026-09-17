---
name: scrittura
description: Come si scrive in questo progetto — messaggi di commit, documenti, commenti nel codice, testi dell'interfaccia e risposte all'utente. Da usare prima di scrivere un commit, un documento in docs/, un commento o una scritta che finisce sotto gli occhi di chi usa l'app.
---

# Come si scrive qui

Il metro è uno solo: **chi legge deve poter controllare quello che hai scritto.**
Se una frase non si può verificare, o non aggiunge niente, va tolta.

## Le regole

**Dire cosa è stato verificato e cosa no.** «124 test passano, il giro della
condivisione l'ho fatto con due browser» è una cosa. «Funziona tutto» è un'altra,
e in questo progetto è già stata falsa più volte. Se una cosa non l'hai provata,
scrivilo: *non provato*.

**Numeri al posto degli aggettivi.** Non «il player era messo male», ma «a 1180
px la colonna dei comandi finiva a 848 e il visualizzatore partiva da 740».

**Niente superlativi e niente entusiasmo.** Via «completamente», «perfettamente»,
«robusto», «elegante», «notevolmente migliorato». Una cosa fatta bene si vede da
sola. Se serve un avverbio per farla sembrare buona, non lo è.

**Niente riassunti che ripetono il titolo.** Se il commit si chiama «il player
non stampa più sopra i comandi», la prima riga del corpo non è «questo commit
sistema il player»: è *perché* succedeva.

**Dire anche quello che non torna.** Un difetto trovato e non risolto va scritto
dov'è, non nascosto. Un dubbio va lasciato come dubbio.

**Italiano**, nell'interfaccia e nei commenti del codice. I messaggi di commit
sono in inglese, come tutta la storia del repository.

## I commenti nel codice

Spiegano **perché**, non cosa. Il cosa si legge dal codice sotto.

```ts
// ❌ Filtra le bozze cancellate
// ✅ Le lapidi non vanno nelle schermate: una traccia cancellata che riappare
//    in Libreria e' peggio del difetto che stiamo chiudendo.
```

Un commento buono racconta il difetto che quella riga impedisce, o la scelta che
è stata scartata e perché. Se una riga è ovvia, non commentarla.

## I messaggi di commit

Titolo: cosa cambia per chi usa l'app, in minuscolo, sotto i 72 caratteri.

Corpo: il difetto com'era, **con i numeri**; la causa vera; cosa è stato
cambiato; cosa è stato verificato e come. Se una scelta ha un costo, si scrive
il costo.

Guarda `git log` prima di scriverne uno: il tono è quello.

## I testi dell'interfaccia

- Un pulsante disabilitato **dice perché** è disabilitato.
- Un'azione che non può riuscire **lo dice**, invece di non fare niente: un
  pulsante muto è indistinguibile da un pulsante rotto, e l'utente ce l'ha
  segnalato due volte.
- Un messaggio di successo arriva **dopo** un successo verificato, mai prima.
- Niente inglese di comodo dove c'è la parola italiana. «Sblocca», non «Unlock».

## Quando si risponde all'utente

Prima il fatto, poi il contorno. Se ti ha segnalato un difetto, la prima riga
dice se c'è o non c'è, non «grazie per la segnalazione».

Se ti sei sbagliato, lo dici in una riga e vai avanti: senza scuse lunghe, senza
rifare la cronistoria dell'errore.

Se una cosa che hai scritto era giusta e te la contestano, la difendi con i
numeri. Se era sbagliata, la correggi e basta.
