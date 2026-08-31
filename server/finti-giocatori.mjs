// Tiene collegati alcuni giocatori finti a una stanza, cosi' si puo'
// guardare il tabellone con le icone al loro posto.
//   node finti-giocatori.mjs CODICE
import { io } from 'socket.io-client';

const INDIRIZZO = 'http://localhost:3001';
const codice = process.argv[2];

const gente = [
  { nome: 'Carmine', id: 'finto-1', avatar: '/media/demo-torre.svg' },
  { nome: 'Giulia', id: 'finto-2', avatar: '/media/demo-banana.svg' },
  { nome: 'Marco', id: 'finto-3', avatar: '/media/demo-pacman.svg' },
  { nome: 'Sara', id: 'finto-4', avatar: null },
];

const chiedi = (presa, evento, dati) => new Promise((r) => presa.emit(evento, dati, r));

for (const persona of gente) {
  const presa = io(INDIRIZZO, { transports: ['websocket'] });
  await new Promise((r) => presa.on('connect', r));
  await chiedi(presa, 'giocatore:entra', { codice, nome: persona.nome, id: persona.id });
  if (persona.avatar) await chiedi(presa, 'giocatore:avatar', { url: persona.avatar });
  console.log(persona.nome, 'dentro');
}

console.log('Restano collegati. Ctrl+C per chiudere.');
setInterval(() => {}, 1 << 30);
