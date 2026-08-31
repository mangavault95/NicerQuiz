# NicerQuiz

Quiz show da salotto o da videochiamata: si costruisce il quiz nell'app, si
conduce dalla regia, si gioca col telefono in mano.

Quattro schermi sulla stessa serata:

| Schermo | Chi lo usa | Cosa vede |
| --- | --- | --- |
| **Editor** `/editor` | tu, prima | costruisci round e domande, carichi foto e audio, provi gli effetti |
| **Regia** `/regia` | il presentatore | domande in anticipo, risposte, note, chi ha prenotato e con che distacco, tutti i comandi, e una **mini-anteprima dal vivo** di quello che vedono i concorrenti |
| **Tabellone** `/tabellone` | tutti | solo lo spettacolo. Mai la risposta prima del tempo |
| **Telefono** `/gioca` | i giocatori | un pulsante grande per prenotarsi, il proprio punteggio |

Le risposte non escono mai dal server verso il tabellone o i telefoni finche'
il presentatore non le rivela: non basta aprire gli strumenti per sviluppatori
per barare.

## Far partire tutto

```bash
npm run installa
```

Poi, per una serata vera (un solo indirizzo, funziona anche dai telefoni in casa):

```bash
npm start
```

Il server compila il client e si mette in ascolto su `http://localhost:3001`.
Dal telefono, sulla stessa rete Wi-Fi, si entra con l'IP del computer
(`http://192.168.x.x:3001`).

Per sviluppare, due terminali:

```bash
npm run server
```

```bash
npm run client
```

Il client sta su `:5173` e parla col server su `:3001`.

Per controllare che le regole di gara tengano ancora, a server acceso:

```bash
npm run prova
```

Simula presentatore, tabellone e due giocatori e verifica punteggi, coda dei
buzz, malus, jolly, tabellone a caselle e riconnessioni.

## Costruire un quiz

Dalla home, **Crea un quiz**. L'editor ha tre colonne di lavoro: l'elenco dei
tuoi quiz, i round, e il round che stai scrivendo.

- **Round**: nome, descrizione (compare sul tabellone prima che cominci), tipo,
  punti, malus per errore, secondi di tempo, e ogni quanto la domanda si scopre
  da sola.
- **Domande**: si aggiungono, si riordinano, si duplicano. I campi cambiano da
  soli a seconda del tipo di round.
- **Foto e audio**: si caricano dal computer con un pulsante. Finiscono in
  `server/media/` e restano nella libreria, pronti per gli altri quiz.
- **Anteprima dell'effetto**: sotto l'immagine c'e' un cursore. Lo trascini e
  vedi *esattamente* come si scoprira' in partita, perche' e' lo stesso
  componente che gira sul tabellone.

Salva quando vuoi, e **prova a giocarlo** apre subito una stanza con quel quiz.

I quiz restano file JSON in `server/quiz/`, quindi si possono ancora scrivere a
mano, esportare, importare e tenere sotto controllo di versione.

## Come si conduce una serata

1. Scegli un quiz: nasce una stanza con un codice di 4 lettere.
2. Apri il **tabellone** sullo schermo grande (o condividilo in videochiamata).
3. Detta il codice: i giocatori entrano da `/gioca`, o dal link che copi dalla regia.
4. Dalla scaletta scegli il round, poi **Avanti** carica la prima domanda.
   In questa fase la domanda la vedi solo tu: leggila ad alta voce.
5. **Mostra e apri i buzzer**: da qui il tabellone mostra il contenuto e i
   telefoni si accendono.
6. Chi prenota finisce in coda, in ordine di arrivo misurato dal server.
   Tu decidi **Giusto** o **Sbagliato**; se sbaglia, il turno passa da solo al
   secondo in coda e chi ha sbagliato resta fuori da quella domanda.

Il riquadro **Quello che vedono loro**, in cima alla regia, e' il tabellone vero
rimpicciolito: si aggiorna a ogni comando, cosi' non devi girare la testa verso
lo schermo grande per sapere a che punto e' la rivelazione. L'audio pero' li'
non parte: in salotto deve suonare un altoparlante solo.

### Scorciatoie da tastiera (in regia)

| Tasto | Cosa fa |
| --- | --- |
| `Spazio` | apri la domanda / rivela la risposta / vai avanti, a seconda del momento |
| `→` | domanda successiva |
| `↑` `↓` | scopri o ricopri un passo |
| `P` | ferma o riavvia la rivelazione automatica |
| `G` | il primo in coda ha risposto giusto |
| `S` | il primo in coda ha sbagliato |

## I tipi di round

**Domande secche** — domanda e basta, chi prenota per primo risponde.

**Immagini che si scoprono** — una foto che compare o sparisce a poco a poco.
Quattro effetti:

| Effetto | Cosa fa |
| --- | --- |
| Puzzle | tessere che spariscono una alla volta, in ordine casuale ma sempre lo stesso per quella foto |
| Sfocatura | parte impastata e si mette a fuoco |
| Pixel | parte a pixel grossi e si affina |
| Zoom | parte strettissima su un punto e si allarga |

E due versi: **comparsa** (si scopre) o **scomparsa** (parte intera e sparisce,
per le domande di memoria).

**Non devi ritagliare niente a mano.** Carichi la foto intera e basta: il puzzle
e' una griglia di coperchi sopra l'immagine, la sfocatura un filtro, la
pixellatura un canvas. Cambiare griglia o effetto e' un menu a tendina, non un
file nuovo.

**Audio** — una traccia che parte all'apertura e si ferma al primo buzz. In modo
*distorto* parte dietro un filtro che si apre a ogni passo, finche' non si sente
pulita.

**Indovinelli a indizi** — gli indizi escono uno alla volta e ogni indizio in
piu' vale meno punti.

**Scelta multipla** — quattro opzioni sul tabellone, si risponde a voce dopo il
buzz. La risposta giusta si illumina solo alla rivelazione.

**Tabellone a caselle** — una griglia (di solito 5 × 5): ogni colonna e' un
argomento, ogni riga un livello di difficolta'. Piu' si scende, piu' la casella
vale. Il presentatore sceglie la casella dalla griglia in regia, la casella
giocata si spegne, e si va avanti finche' il tabellone non e' vuoto.
**Ogni casella puo' contenere qualunque tipo di domanda**: una casella puo'
essere un'immagine da scoprire, un'altra un audio, un'altra una domanda secca.

## Bonus e malus

- **Punti a mano**: in regia ogni giocatore ha `-5 -1 +1 +5` e un campo per un
  valore qualsiasi. Serve per i casi che il regolamento non prevede.
- **Jolly x2**: si accende su un giocatore e raddoppia la sua prossima risposta
  esatta, poi si consuma da solo.
- **Malus da errore**: automatico, il malus del round.
- **Azzera**: rimette tutti a zero senza chiudere la stanza.

## Se qualcuno cade

L'identita' del giocatore sta nel suo telefono, non nella connessione: se il
telefono si blocca o cade la linea, riaprendo il link ritrova nome, colore e
punteggio. Vale anche per la regia: ricaricare `/regia?c=CODICE` riprende il
comando della stanza.

## Come e' fatto dentro

```
server/
  src/quiz.js       lettura e controllo dei quiz; appiattisce il tabellone
  src/stanza.js     la partita: fasi, buzzer, punteggi. Il server e' l'arbitro
  src/punteggi.js   quanto vale una domanda in questo istante
  src/index.js      API dei quiz e dei media, e tutti i messaggi in tempo reale
client/
  src/viste/        Ingresso, Editor, Regia, Tabellone, Giocatore
  src/componenti/   i pezzi condivisi, editor compreso
```

Il tabellone e' un componente solo (`VistaTabellone`), usato sia dalla pagina
`/tabellone` sia dall'anteprima in regia: e' il motivo per cui il presentatore
puo' fidarsi del riquadro.

## Metterlo online

La partita vive nella memoria del server, quindi **regia, tabellone e giocatori
devono parlare con lo stesso processo**: niente scalabilita' orizzontale senza
prima spostare lo stato altrove.

- **Tutto su un servizio** (piu' semplice): il server serve anche il client
  compilato. Comando di build `npm run build`, comando di avvio
  `npm --prefix server start`.
- **Frontend e backend separati** (Vercel + Render): sul client imposta
  `VITE_SERVER` con l'indirizzo del backend, e sul server `ORIGINI` con
  l'indirizzo del frontend, separati da virgola.

Due avvertenze per l'hosting gratuito: il servizio si spegne dopo un po' di
inattivita' e la prima connessione puo' metterci quasi un minuto (apri la stanza
qualche minuto prima), e il disco non e' permanente, quindi **le foto caricate e
i quiz salvati vanno persi a ogni deploy** se non colleghi un disco vero.
In casa, con `npm start`, questo problema non esiste.

## Cosa non c'e' ancora

- La classifica salvata da una serata all'altra.
- Il riordino delle domande col trascinamento (per ora ci sono le frecce).
- Chi sceglie la casella del tabellone e' sempre il presentatore, non il
  giocatore che ha appena segnato.
