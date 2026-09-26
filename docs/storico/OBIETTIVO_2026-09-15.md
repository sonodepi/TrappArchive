# TrappArchive : l'app per i cantautori

## In una riga
Un posto solo, sul telefono, per scrivere i tuoi testi ovunque, tenere insieme
bozze, canzoni e album, e sentire subito la base mentre scrivi. I tuoi dati
restano tuoi: vivono nel dispositivo, senza un server nostro in mezzo.

Questo file racconta **cosa fa l'app oggi**, per davvero. In fondo c'è la lista
delle idee non ancora realizzate, tenute separate apposta: qui dentro non si
promette niente che l'app non faccia già.

---

## Il ciclo: Bozze → Libreria → Album

È il cuore dell'app, ed è già in piedi.

**Bozze.** Apri una bozza e scrivi. Puoi incollare un link YouTube che parte in
loop in un lettore integrato mentre scrivi, così hai la base sotto le dita senza
uscire dall'app. Quando la bozza è pronta la mandi in Libreria come traccia:
titolo, artista, feat., producer e il testo passano già compilati.

**Libreria.** L'elenco delle tue canzoni. Per ogni traccia: titolo, artista
principale, feat., producer, testo, un file audio (o un link), BPM e tonalità.
Puoi ordinare per titolo, data, durata o BPM, e riprodurre, modificare o
eliminare.

**Album.** Crei un album e ci assegni le tracce. L'app tiene distinte le tracce
già in un album da quelle ancora libere, così vedi a colpo d'occhio "cosa c'è in
libreria" da ancora sistemare.

---

## I dati: locale prima di tutto

Non c'è nessun server nostro. È una scelta, non un limite: niente account
obbligatori, niente costi, niente tuoi testi su una macchina che non è tua.

- L'**audio** dei file che carichi sta nel dispositivo (IndexedDB): resta anche
  dopo aver chiuso e riaperto l'app.
- Il **catalogo** (tracce, album, bozze) sta nella memoria locale del browser.
- Puoi **esportare e importare** tutto in un file, per farti un backup o
  spostarti su un altro dispositivo.

**Il cloud c'è, ma è facoltativo e spento di default.** Se vuoi, puoi collegare
un tuo progetto Firebase (Firestore) dalle Impostazioni per sincronizzare il
catalogo fra i tuoi dispositivi. Non è Google Drive e non è acceso di serie: il
dispositivo resta la fonte di verità, e l'audio non si sincronizza (un file
audio è troppo grande per il cloud gratuito).

---

## Analisi audio: BPM e tonalità

Carichi un file audio e l'app stima **BPM e tonalità** da sola, in locale,
anche offline: nessuna pagina esterna, nessun invio dei tuoi file a terzi.
Il risultato ti dice anche quanto è affidabile la stima. Così producer e chi
scrive hanno subito i numeri sotto mano.

Per un secondo parere resta un link a Tunebat, dove i valori si leggono a mano
sul sito. (Lo "scraping automatico" da Tunebat è stato tolto perché non poteva
funzionare davvero: il sito costruisce quei numeri dopo il caricamento e da
fuori si otteneva una pagina vuota.)

---

## Scrittura di gruppo (a turni)

Si scrive insieme, fino a **quattro persone**, ma **a turni, non in diretta**:
scrivere in diretta richiederebbe un server sempre acceso, e qui non c'è.

La bozza si divide in **blocchi** (strofa, ritornello, quartina). Ognuno lavora
sui propri blocchi e legge quelli di tutti; la bozza passa di mano come un file.
**Solo chi ha creato la bozza fa l'unione finale.** Se due hanno toccato lo
stesso blocco vince la versione più recente, ma **l'app lo dichiara**: non si
perde mai testo in silenzio.

Chi sei lo decide un identificativo del dispositivo, non un account: serve solo
a sapere di chi è un blocco.

---

## AI, facoltativa

C'è una funzione di **trascrizione del testo dall'audio** basata su Gemini.
Funziona con una **chiave tua**, che inserisci nelle Impostazioni e resta nel
tuo dispositivo: coerente con l'idea "locale e libera". Senza chiave, l'app fa
tutto il resto lo stesso.

---

## Sicurezza, detta onesta

L'app è pensata locale-prima: i tuoi testi e i tuoi file stanno nel dispositivo,
non c'è login, e nel codice non ci sono password o chiavi in chiaro. La
configurazione del cloud e la chiave AI le metti tu e restano da te.

Non esiste software "incraccabile al cento per cento" e non lo promettiamo: la
sicurezza qui è la conseguenza diretta di non avere un server e di non
raccogliere account. Se un domani si aggiunge qualcosa che esce dal dispositivo,
va detto in chiaro all'utente, sempre.

---

## Idee non ancora realizzate

Cose che vogliamo, ma che **oggi l'app non fa ancora**. Sono qui, separate,
proprio per non spacciarle come già fatte.

- **Campo "sporche" (ad-lib).** Un campo a parte accanto al testo, con le
  sporche tra parentesi in automatico, il testo vero in grigio e le sporche in
  chiaro (e viceversa nel campo del testo). Da progettare.
- **Righe numerate.** Un contatore fisso a sinistra del testo (1., 2., 3. …),
  non modificabile, offerto dall'app.
- **Scarico da URL → file audio.** Incolli un link e l'app te lo scarica in mp3
  (o altro formato) da usare offline, senza passare da YouTube. Lasciato in
  sospeso apposta.
- **Copertina dell'album.** Il campo c'è nel modello ma manca l'interfaccia per
  caricarla.
- **Stato "da registrare".** Marcare una canzone finita come "da registrare"
  nella fase di libreria.
- **App installabile da store (iOS/Android).** Oggi è una PWA che si aggiunge
  alla schermata Home; il pacchetto nativo vero e proprio è un passo successivo.
