// Prova end-to-end: simula presentatore, tabellone e due giocatori contro un
// server gia' avviato, e controlla che punteggi e regole tornino.
//   node src/index.js        (in un altro terminale)
//   node prova-partita.mjs
import { io } from 'socket.io-client';
import { readFile } from 'node:fs/promises';

const INDIRIZZO = process.env.URL || 'http://localhost:3001';
let falliti = 0;

function verifica(descrizione, condizione, extra = '') {
  console.log((condizione ? '  ok  ' : ' FAIL ') + descrizione + (condizione ? '' : '  <- ' + extra));
  if (!condizione) falliti++;
}

const collega = () => io(INDIRIZZO, { transports: ['websocket'] });
const chiedi = (presa, evento, dati) =>
  new Promise((r) => presa.emit(evento, dati, r));
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Aspetta uno stato che soddisfi la condizione, con scadenza. */
function attendiStato(presa, condizione, etichetta, scadenza = 3000) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => {
      presa.off('stato', ascolta);
      rifiuta(new Error('scaduto in attesa di: ' + etichetta));
    }, scadenza);
    function ascolta(stato) {
      if (!condizione(stato)) return;
      clearTimeout(timer);
      presa.off('stato', ascolta);
      risolvi(stato);
    }
    presa.on('stato', ascolta);
  });
}

const quiz = JSON.parse(await readFile(new URL('./quiz/demo.json', import.meta.url), 'utf8'));

const regia = collega();
const tabellone = collega();
const anna = collega();
const bruno = collega();

await new Promise((r) => regia.on('connect', r));

// ------------------------------------------------------------------ partita

const creata = await chiedi(regia, 'regia:crea', { quiz });
verifica('la stanza si crea con un codice a 4 lettere', /^[A-Z0-9]{4}$/.test(creata.codice ?? ''), JSON.stringify(creata));
const codice = creata.codice;

await chiedi(tabellone, 'tabellone:entra', { codice });
const entrataAnna = await chiedi(anna, 'giocatore:entra', { codice, nome: 'Anna', id: 'anna-1' });
await chiedi(bruno, 'giocatore:entra', { codice, nome: 'Bruno', id: 'bruno-1' });
verifica('il giocatore riceve un colore', Boolean(entrataAnna.colore), JSON.stringify(entrataAnna));

const statoTabellone = await attendiStato(tabellone, (s) => s.giocatori.length === 2, 'due giocatori');
verifica('il tabellone vede due giocatori', statoTabellone.giocatori.length === 2);

const azione = (dati) => chiedi(regia, 'regia:azione', dati);

// --- Round 1: domanda secca da 10 punti -------------------------------------
await azione({ tipo: 'round', indice: 0 });

// Le due attese vanno registrate *prima* dell'azione: regia e tabellone sono
// due connessioni diverse e l'ordine di arrivo non e' garantito.
const attesaTabellone = attendiStato(tabellone, (s) => s.fase === 'preparata', 'fase preparata');
const attesaRegia = attendiStato(regia, (s) => s.fase === 'preparata', 'regia preparata');
await azione({ tipo: 'domanda', indice: 0 });

const preparata = await attesaTabellone;
verifica('in fase preparata il tabellone non vede il testo', !preparata.contenuto.testo, JSON.stringify(preparata.contenuto));
verifica('la risposta non esce mai verso il tabellone', preparata.contenuto.risposta === null);

const soluzioneRegia = await attesaRegia;
verifica('la regia invece vede la risposta', soluzioneRegia.soluzione?.risposta === 'Il Po', JSON.stringify(soluzioneRegia.soluzione));

await azione({ tipo: 'apri' });
const aperta = await attendiStato(tabellone, (s) => s.fase === 'aperta', 'fase aperta');
verifica('aperta la domanda, il testo compare', aperta.contenuto.testo?.includes('fiume'));
verifica('la domanda secca vale 10 punti', aperta.punti === 10, String(aperta.punti));

// Bruno prenota per primo, Anna subito dopo.
await attendi(120);
const buzzBruno = await chiedi(bruno, 'giocatore:prenota');
const buzzAnna = await chiedi(anna, 'giocatore:prenota');
verifica('il primo buzz prende la posizione 1', buzzBruno.posizione === 1, JSON.stringify(buzzBruno));
verifica('il secondo buzz si mette in coda', buzzAnna.posizione === 2, JSON.stringify(buzzAnna));

const prenotato = await attendiStato(tabellone, (s) => s.fase === 'prenotato', 'fase prenotato');
verifica('il tempo di prenotazione e\' misurato dal server', prenotato.prenotazioni[0].ms >= 100, String(prenotato.prenotazioni[0].ms));
verifica('la coda e\' in ordine di arrivo', prenotato.prenotazioni.map((p) => p.nome).join(',') === 'Bruno,Anna');

// Bruno sbaglia: -5 (puntiErrore del round) e resta fuori dalla domanda.
await azione({ tipo: 'giudica', idGiocatore: 'bruno-1', esito: 'sbagliato' });
const dopoErrore = await attendiStato(tabellone, (s) => s.bloccati.includes('bruno-1'), 'Bruno bloccato');
verifica('chi sbaglia prende il malus del round', trova(dopoErrore, 'Bruno').punti === -5, String(trova(dopoErrore, 'Bruno').punti));
verifica('chi sbaglia esce dalla domanda', dopoErrore.bloccati.includes('bruno-1'));
verifica('tocca a chi era secondo', dopoErrore.prenotazioni[0]?.nome === 'Anna', JSON.stringify(dopoErrore.prenotazioni));

const rifiutato = await chiedi(bruno, 'giocatore:prenota');
verifica('chi e\' bloccato non puo\' riprenotarsi', rifiutato.posizione === null, JSON.stringify(rifiutato));

// Anna indovina: +10.
await azione({ tipo: 'giudica', idGiocatore: 'anna-1', esito: 'giusto' });
const rivelata = await attendiStato(tabellone, (s) => s.fase === 'rivelata', 'fase rivelata');
verifica('chi indovina prende i punti pieni', trova(rivelata, 'Anna').punti === 10, String(trova(rivelata, 'Anna').punti));
verifica('a risposta svelata il tabellone vede la soluzione', rivelata.contenuto.risposta === 'Il Po');

// --- Jolly x2 ---------------------------------------------------------------
await azione({ tipo: 'moltiplicatore', idGiocatore: 'bruno-1', valore: 2 });
await azione({ tipo: 'prossima' });
await azione({ tipo: 'apri' });
await attendiStato(tabellone, (s) => s.fase === 'aperta' && s.indiceDomanda === 1, 'seconda domanda aperta');
await chiedi(bruno, 'giocatore:prenota');
await azione({ tipo: 'giudica', idGiocatore: 'bruno-1', esito: 'giusto' });
const dopoJolly = await attendiStato(tabellone, (s) => s.fase === 'rivelata' && s.indiceDomanda === 1, 'seconda rivelata');
verifica('il jolly raddoppia i punti (-5 + 20)', trova(dopoJolly, 'Bruno').punti === 15, String(trova(dopoJolly, 'Bruno').punti));
verifica('il jolly si consuma dopo l\'uso', trova(dopoJolly, 'Bruno').moltiplicatore === 1);

// --- Round 2: immagine a tessere, punti che scalano -------------------------
await azione({ tipo: 'round', indice: 1 });
await azione({ tipo: 'domanda', indice: 0 });

// Prima di aprire l'automatico e' fermo: qui i passi si contano a mano.
const immaginePronta = await attendiStato(
  tabellone, (s) => s.fase === 'preparata' && s.round.tipo === 'immagine', 'immagine pronta');
verifica('la griglia 4x3 fa 12 passi', immaginePronta.contenuto.passiTotali === 12, String(immaginePronta.contenuto.passiTotali));
verifica('al passo 0 vale il massimo', immaginePronta.punti === 30, String(immaginePronta.punti));

await azione({ tipo: 'passo', delta: 6 });
const meta = await attendiStato(tabellone, (s) => s.contenuto?.passo === 6, 'passo 6');
verifica('a meta\' rivelazione i punti scendono a 18', meta.punti === 18, String(meta.punti));
await azione({ tipo: 'passo', delta: -6 });

// Aprendo, la rivelazione automatica parte da sola (intervalloMs del round).
await azione({ tipo: 'apri' });
const immagineAperta = await attendiStato(tabellone, (s) => s.fase === 'aperta', 'immagine aperta');
verifica('il tabellone riceve il file dell\'immagine', immagineAperta.contenuto.media?.endsWith('.svg'));

const avanzata = await attendiStato(tabellone, (s) => s.contenuto?.passo >= 1 && s.autoAttivo, 'automatico partito', 5000);
verifica('la rivelazione automatica avanza da sola', avanzata.contenuto.passo >= 1);
await chiedi(anna, 'giocatore:prenota');
const congelata = await attendiStato(tabellone, (s) => s.fase === 'prenotato', 'congelata dal buzz');
verifica('il buzz ferma la rivelazione automatica', congelata.autoAttivo === false);

await azione({ tipo: 'annullaBuzz' });
const riaperta = await attendiStato(tabellone, (s) => s.fase === 'aperta', 'riaperta');
verifica('annullando il buzz la domanda torna aperta', riaperta.prenotazioni.length === 0);

// --- Round indovinelli: gli indizi escono uno alla volta ---------------------
await azione({ tipo: 'round', indice: 5 });
await azione({ tipo: 'domanda', indice: 0 });
await azione({ tipo: 'apri' });
const indovinello = await attendiStato(tabellone, (s) => s.round?.tipo === 'indovinello' && s.fase === 'aperta', 'indovinello aperto');
verifica('al primo passo esce un solo indizio', indovinello.contenuto.indizi.length === 1, JSON.stringify(indovinello.contenuto.indizi));
verifica('gli indizi non svelano la risposta', !JSON.stringify(indovinello.contenuto).includes('pomodoro'));

await azione({ tipo: 'passo', delta: 2 });
const treIndizi = await attendiStato(tabellone, (s) => s.contenuto?.indizi?.length === 3, 'tre indizi');
verifica('a tre indizi i punti scendono', treIndizi.punti < 40 && treIndizi.punti >= 10, String(treIndizi.punti));

// --- Punti a mano e riconnessione ------------------------------------------
await azione({ tipo: 'punti', idGiocatore: 'anna-1', delta: -3, motivo: 'penalita' });
const conMalus = await attendiStato(tabellone, (s) => trova(s, 'Anna').punti === 7, 'malus a mano');
verifica('il presentatore puo\' togliere punti a mano', trova(conMalus, 'Anna').punti === 7);

anna.disconnect();
await attendi(250);
const annaRitorna = collega();
await new Promise((r) => annaRitorna.on('connect', r));
await chiedi(annaRitorna, 'giocatore:entra', { codice, nome: 'Anna', id: 'anna-1' });
const dopoRientro = await attendiStato(tabellone, (s) => trova(s, 'Anna').connesso, 'Anna rientrata');
verifica('riconnettendosi il giocatore ritrova i suoi punti', trova(dopoRientro, 'Anna').punti === 7, String(trova(dopoRientro, 'Anna').punti));
verifica('non si duplica il giocatore che rientra', dopoRientro.giocatori.length === 2, String(dopoRientro.giocatori.length));

// --- Il tabellone a caselle -------------------------------------------------
const indiceTabellone = quiz.round.findIndex((r) => r.tipo === 'tabellone');
await azione({ tipo: 'round', indice: indiceTabellone });

const grigliaPronta = await attendiStato(tabellone, (s) => s.griglia !== null, 'griglia mostrata');
verifica('la griglia arriva al tabellone', grigliaPronta.griglia.colonne.length === 5, String(grigliaPronta.griglia.colonne.length));
verifica('ogni colonna ha il suo argomento', grigliaPronta.griglia.colonne[0].titolo === 'Storia', grigliaPronta.griglia.colonne[0].titolo);
verifica('le caselle valgono di piu\' scendendo',
  grigliaPronta.griglia.colonne[0].caselle.map((c) => c.valore).join(',') === '100,200,300,400,500',
  grigliaPronta.griglia.colonne[0].caselle.map((c) => c.valore).join(','));
verifica('le domande della griglia restano nascoste', !JSON.stringify(grigliaPronta.griglia).includes('1945'));

// Casella da 300 della prima colonna.
const casella300 = grigliaPronta.griglia.colonne[0].caselle.find((c) => c.valore === 300);
await azione({ tipo: 'domanda', indice: casella300.indice });
const casellaPronta = await attendiStato(tabellone, (s) => s.fase === 'preparata' && s.contenuto?.casella, 'casella scelta');
verifica('la casella scelta annuncia argomento e valore',
  casellaPronta.contenuto.casella.argomento === 'Storia' && casellaPronta.contenuto.casella.valore === 300,
  JSON.stringify(casellaPronta.contenuto.casella));
verifica('la casella vale i suoi punti', casellaPronta.punti === 300, String(casellaPronta.punti));

await azione({ tipo: 'apri' });
await attendiStato(tabellone, (s) => s.fase === 'aperta', 'casella aperta');
await chiedi(bruno, 'giocatore:prenota');
await azione({ tipo: 'giudica', idGiocatore: 'bruno-1', esito: 'giusto' });
const casellaChiusa = await attendiStato(tabellone, (s) => s.fase === 'rivelata' && s.griglia, 'casella giudicata');
verifica('la casella giocata risulta usata',
  casellaChiusa.griglia.colonne[0].caselle.find((c) => c.indice === casella300.indice).usata === true);
verifica('vincendo si prendono i punti della casella (15 + 300)',
  trova(casellaChiusa, 'Bruno').punti === 315, String(trova(casellaChiusa, 'Bruno').punti));

await azione({ tipo: 'prossima' });
const tornatoAllaGriglia = await attendiStato(tabellone, (s) => s.fase === 'attesa' && s.griglia, 'ritorno alla griglia');
verifica('finita la casella si torna alla griglia', tornatoAllaGriglia.indiceDomanda === -1);
verifica('la griglia conta le caselle rimaste', tornatoAllaGriglia.griglia.restanti === 24, String(tornatoAllaGriglia.griglia.restanti));

// Una casella con dentro un'immagine: il tipo lo decide la casella, non il round.
const casellaImmagine = tornatoAllaGriglia.griglia.colonne[2].caselle[0];
await azione({ tipo: 'domanda', indice: casellaImmagine.indice });
await azione({ tipo: 'apri' });
const dentroImmagine = await attendiStato(tabellone, (s) => s.fase === 'aperta' && s.contenuto?.tipo === 'immagine', 'casella con immagine');
verifica('una casella puo\' contenere un\'immagine', dentroImmagine.contenuto.media?.endsWith('.svg'), String(dentroImmagine.contenuto.media));
verifica('la casella con immagine tiene il suo valore', dentroImmagine.punti === 100, String(dentroImmagine.punti));

await azione({ tipo: 'griglia' });
const annullata = await attendiStato(tabellone, (s) => s.fase === 'attesa', 'casella annullata');
verifica('tornando indietro la casella non si consuma', annullata.griglia.restanti === 24, String(annullata.griglia.restanti));

// --- Round a turno: i buzzer restano spenti ---------------------------------
// Il quiz di prova non ne ha uno, quindi ne apriamo una stanza apposta.
const regiaGiro = collega();
await new Promise((r) => regiaGiro.on('connect', r));

const quizGiro = {
  titolo: 'Prova a turno',
  round: [{
    nome: 'A turno con rimbalzo',
    tipo: 'secca',
    risposte: 'giro',
    rimbalzo: true,
    puntiIniziali: 10,
    puntiErrore: 4,
    domande: [
      { testo: 'Prima', risposta: 'uno' },
      { testo: 'Seconda', risposta: 'due' },
      { testo: 'Terza', risposta: 'tre' },
    ],
  }],
};

const stanzaGiro = await chiedi(regiaGiro, 'regia:crea', { quiz: quizGiro });
verifica('si puo\' creare un round a turno', Boolean(stanzaGiro.codice), JSON.stringify(stanzaGiro));

const schermoGiro = collega();
const carla = collega();
const dario = collega();
const elena = collega();
await chiedi(schermoGiro, 'tabellone:entra', { codice: stanzaGiro.codice });
await chiedi(carla, 'giocatore:entra', { codice: stanzaGiro.codice, nome: 'Carla', id: 'carla' });
await chiedi(dario, 'giocatore:entra', { codice: stanzaGiro.codice, nome: 'Dario', id: 'dario' });
await chiedi(elena, 'giocatore:entra', { codice: stanzaGiro.codice, nome: 'Elena', id: 'elena' });

const azioneGiro = (dati) => chiedi(regiaGiro, 'regia:azione', dati);
await azioneGiro({ tipo: 'round', indice: 0 });
await azioneGiro({ tipo: 'domanda', indice: 0 });
await azioneGiro({ tipo: 'apri' });

const giroAperto = await attendiStato(schermoGiro, (s) => s.fase === 'aperta', 'round a turno aperto');
verifica('il round dichiara che si gioca a turno', giroAperto.modoRisposte === 'giro', giroAperto.modoRisposte);
verifica('tocca al primo del giro', giroAperto.turno?.nome === 'Carla', JSON.stringify(giroAperto.turno));
verifica('l\'ordine del giro e\' quello di arrivo',
  giroAperto.giocatoriInOrdine.map((g) => g.nome).join(',') === 'Carla,Dario,Elena',
  giroAperto.giocatoriInOrdine.map((g) => g.nome).join(','));

const buzzInutile = await chiedi(elena, 'giocatore:prenota');
verifica('a turno il buzzer non fa niente', buzzInutile.posizione === null, JSON.stringify(buzzInutile));

// Carla sbaglia: -4 e la domanda rimbalza a Dario, che indovina.
await azioneGiro({ tipo: 'giudica', idGiocatore: 'carla', esito: 'sbagliato' });
const rimbalzata = await attendiStato(schermoGiro, (s) => s.turno?.nome === 'Dario', 'rimbalzo a Dario');
verifica('chi sbaglia prende il malus anche a turno', trovaIn(rimbalzata, 'Carla').punti === -4, String(trovaIn(rimbalzata, 'Carla').punti));
verifica('con il rimbalzo la domanda resta aperta', rimbalzata.fase === 'aperta', rimbalzata.fase);

await azioneGiro({ tipo: 'giudica', idGiocatore: 'dario', esito: 'giusto' });
const giroVinto = await attendiStato(schermoGiro, (s) => s.fase === 'rivelata', 'prima domanda a turno chiusa');
verifica('chi risponde nel rimbalzo prende i punti', trovaIn(giroVinto, 'Dario').punti === 10, String(trovaIn(giroVinto, 'Dario').punti));

// Domanda successiva: la mano passa avanti di uno rispetto a chi aveva iniziato.
await azioneGiro({ tipo: 'prossima' });
const secondoGiro = await attendiStato(schermoGiro, (s) => s.indiceDomanda === 1, 'seconda domanda a turno');
verifica('alla domanda dopo la mano passa al prossimo', secondoGiro.turno?.nome === 'Dario', JSON.stringify(secondoGiro.turno));

// Il presentatore puo' sempre correggere a chi tocca.
await azioneGiro({ tipo: 'turno', idGiocatore: 'elena' });
const turnoForzato = await attendiStato(schermoGiro, (s) => s.turno?.nome === 'Elena', 'turno forzato');
verifica('il presentatore puo\' passare la mano a chi vuole', turnoForzato.turno.id === 'elena');

// E puo' riordinare il giro.
await azioneGiro({ tipo: 'ordine', idGiocatore: 'elena', delta: -1 });
const riordinato = await attendiStato(schermoGiro,
  (s) => s.giocatoriInOrdine.map((g) => g.nome).join(',') === 'Carla,Elena,Dario', 'giro riordinato');
verifica('il giro si puo\' riordinare',
  riordinato.giocatoriInOrdine.map((g) => g.nome).join(',') === 'Carla,Elena,Dario');

// --- Le foto dei partecipanti, che decide il conduttore ---------------------
const puntino = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAF0lEQVQIW2P8z8Dwn4EIwDiqkL4hBQCxlwX9K5mCzwAAAABJRU5ErkJggg==';
const caricata = await fetch(INDIRIZZO + '/api/media', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome: 'faccia.png', dati: puntino }),
}).then((r) => r.json());
verifica('la foto del partecipante si carica', Boolean(caricata.url), JSON.stringify(caricata));

await azioneGiro({ tipo: 'avatar', idGiocatore: 'carla', url: caricata.url });
const conFoto = await attendiStato(schermoGiro, (s) => trovaIn(s, 'Carla').avatar, 'foto di Carla');
verifica('la foto messa dal conduttore arriva sul tabellone',
  trovaIn(conFoto, 'Carla').avatar === caricata.url, String(trovaIn(conFoto, 'Carla').avatar));

// Il telefono non ha piu' voce in capitolo sulla propria faccia: l'evento non
// esiste piu' lato server, quindi si spara e si controlla che non sia successo
// niente (usiamo un'azione di regia per farci mandare uno stato fresco).
carla.emit('giocatore:avatar', { url: '/media/demo-banana.svg' });
await attendi(300);
await azioneGiro({ tipo: 'turno', idGiocatore: 'carla' });
const dopoTentativo = await attendiStato(schermoGiro, (s) => s.turno?.id === 'carla', 'stato dopo il tentativo');
verifica('dal telefono non si puo\' cambiare la propria foto',
  trovaIn(dopoTentativo, 'Carla').avatar === caricata.url,
  String(trovaIn(dopoTentativo, 'Carla').avatar));

// Nemmeno la regia puo' appendere un'immagine presa da fuori.
await azioneGiro({ tipo: 'avatar', idGiocatore: 'dario', url: 'https://sito-esterno.example/foto.png' });
await azioneGiro({ tipo: 'avatar', idGiocatore: 'elena', url: caricata.url });
const dopoEsterna = await attendiStato(schermoGiro, (s) => trovaIn(s, 'Elena').avatar, 'foto di Elena');
verifica('un indirizzo esterno non attacca', trovaIn(dopoEsterna, 'Dario').avatar === null,
  String(trovaIn(dopoEsterna, 'Dario').avatar));

await azioneGiro({ tipo: 'avatar', idGiocatore: 'carla', url: '' });
const senzaFoto = await attendiStato(schermoGiro, (s) => trovaIn(s, 'Carla').avatar === null, 'foto tolta');
verifica('il conduttore puo\' togliere la foto', senzaFoto !== null);

await fetch(INDIRIZZO + '/api/media/' + caricata.file, { method: 'DELETE' });

// --- Il buzzer resta acceso dove non si e' chiesto altro --------------------
verifica('il quiz normale resta al buzzer', annullata.modoRisposte === 'buzzer', annullata.modoRisposte);
verifica('senza round a turno non c\'e\' nessuna mano assegnata', annullata.turno === null, JSON.stringify(annullata.turno));

function trovaIn(stato, nome) {
  return stato.giocatori.find((g) => g.nome === nome) ?? {};
}

// --- Stanza inesistente -----------------------------------------------------
const intruso = collega();
const rifiuto = await chiedi(intruso, 'giocatore:entra', { codice: 'ZZZZ', nome: 'Nessuno', id: 'x' });
verifica('un codice sbagliato viene rifiutato', rifiuto.errore === 'Stanza inesistente', JSON.stringify(rifiuto));

// ----------------------------------------------------------------------------

function trova(stato, nome) {
  return stato.giocatori.find((g) => g.nome === nome) ?? { punti: NaN };
}

console.log(falliti === 0 ? '\nTutto a posto.' : `\n${falliti} controlli falliti.`);
[regia, tabellone, anna, bruno, annaRitorna, intruso,
 regiaGiro, schermoGiro, carla, dario, elena].forEach((p) => p.disconnect());
process.exit(falliti === 0 ? 0 : 1);
