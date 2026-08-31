// Tiene collegati alcuni giocatori finti a una stanza, cosi' si puo' guardare
// il tabellone con qualcuno dentro senza aprire quattro finestre.
// Le facce non le mette questo script: le assegna il conduttore dalla regia.
//   node finti-giocatori.mjs CODICE
import { io } from 'socket.io-client';

const INDIRIZZO = process.env.URL || 'http://localhost:3001';
const codice = process.argv[2];

if (!codice) {
  console.error('Serve il codice della stanza: node finti-giocatori.mjs ABCD');
  process.exit(1);
}

const gente = ['Carmine', 'Giulia', 'Marco', 'Sara'];
const chiedi = (presa, evento, dati) => new Promise((r) => presa.emit(evento, dati, r));

for (const [i, nome] of gente.entries()) {
  const presa = io(INDIRIZZO, { transports: ['websocket'] });
  await new Promise((r) => presa.on('connect', r));
  const risposta = await chiedi(presa, 'giocatore:entra', { codice, nome, id: 'finto-' + (i + 1) });
  console.log(risposta.errore ? nome + ': ' + risposta.errore : nome + ' dentro');
}

console.log('Restano collegati. Ctrl+C per chiudere.');
setInterval(() => {}, 1 << 30);
