import { createServer } from 'node:http';
import { readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { Stanza } from './stanza.js';
import { normalizzaQuiz, validaQuiz, contaDomande } from './quiz.js';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..');
const CARTELLA_QUIZ = path.join(RADICE, 'quiz');
const CARTELLA_MEDIA = path.join(RADICE, 'media');
const CLIENT_COSTRUITO = path.join(RADICE, '..', 'client', 'dist');

const PORTA = process.env.PORT || 3001;
const ORIGINI = process.env.ORIGINI ? process.env.ORIGINI.split(',') : true;

const app = express();
app.use(cors({ origin: ORIGINI }));
// Le foto arrivano dall'editor in base64: serve spazio.
app.use(express.json({ limit: '32mb' }));

app.use('/media', express.static(CARTELLA_MEDIA, { maxAge: '1h' }));

const server = createServer(app);
const io = new Server(server, { cors: { origin: ORIGINI }, maxHttpBufferSize: 4e6 });

// ---------------------------------------------------------------- le stanze

/** codice -> Stanza. Tutto in memoria: una serata, una partita. */
const stanze = new Map();

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente I/O/0/1: si dettano male

function nuovoCodice() {
  let codice;
  do {
    codice = Array.from({ length: 4 }, () =>
      ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  } while (stanze.has(codice));
  return codice;
}

/** Manda lo stato aggiornato: la regia vede tutto, il resto la versione pubblica. */
function trasmetti(stanza) {
  if (!stanza) return;
  if (stanza.presentatore) {
    io.to(stanza.presentatore).emit('stato', stanza.statoRegia());
  }
  io.to(stanza.codice + ':pubblico').emit('stato', stanza.statoPubblico());
}

function creaStanza(quiz) {
  const codice = nuovoCodice();
  const stanza = new Stanza(codice, normalizzaQuiz(quiz), () => trasmetti(stanza));
  stanze.set(codice, stanza);
  return stanza;
}

// Pulizia: le stanze morte non devono restare a occupare memoria.
setInterval(() => {
  const ora = Date.now();
  for (const [codice, stanza] of stanze) {
    const viva = stanza.presentatore || stanza.tabelloni.size ||
      [...stanza.giocatori.values()].some((g) => g.connesso);
    const vecchia = ora - stanza.creata > 12 * 60 * 60 * 1000;
    if (vecchia || (!viva && ora - (stanza.ultimoContatto ?? stanza.creata) > 60 * 60 * 1000)) {
      stanza.distruggi();
      stanze.delete(codice);
    }
  }
}, 10 * 60 * 1000);

// ------------------------------------------------------------- quiz salvati

/** Percorso sicuro dentro una cartella: niente `../` che scappa altrove. */
function percorsoSicuro(cartella, nomeGrezzo) {
  const nome = path.basename(String(nomeGrezzo ?? ''));
  const percorso = path.join(cartella, nome);
  return percorso.startsWith(cartella) && nome ? percorso : null;
}

const nomeFile = (titolo) =>
  (String(titolo ?? 'quiz').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'quiz') + '.json';

app.get('/api/salute', (_req, res) => {
  res.json({ ok: true, stanze: stanze.size });
});

app.get('/api/quiz', async (_req, res) => {
  try {
    const file = (await readdir(CARTELLA_QUIZ)).filter((f) => f.endsWith('.json'));
    const elenco = [];
    for (const f of file) {
      try {
        const dati = JSON.parse(await readFile(path.join(CARTELLA_QUIZ, f), 'utf8'));
        elenco.push({
          file: f,
          titolo: dati.titolo ?? f.replace(/\.json$/, ''),
          round: dati.round?.length ?? 0,
          domande: contaDomande(dati),
        });
      } catch {
        elenco.push({ file: f, titolo: f, errore: 'JSON non valido' });
      }
    }
    elenco.sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
    res.json(elenco);
  } catch {
    res.json([]);
  }
});

app.get('/api/quiz/:file', async (req, res) => {
  const percorso = percorsoSicuro(CARTELLA_QUIZ, req.params.file);
  if (!percorso || !existsSync(percorso)) return res.status(404).json({ errore: 'Quiz non trovato' });
  res.type('application/json').send(await readFile(percorso, 'utf8'));
});

/** Salvataggio dall'editor. Il nome del file lo decide il titolo. */
app.put('/api/quiz/:file', async (req, res) => {
  const richiesto = req.params.file === 'nuovo' ? nomeFile(req.body?.titolo) : req.params.file;
  const percorso = percorsoSicuro(CARTELLA_QUIZ, richiesto);
  if (!percorso || !percorso.endsWith('.json')) return res.status(400).json({ errore: 'Nome non valido' });

  const errore = validaQuiz(req.body);
  if (errore) return res.status(400).json({ errore });

  await writeFile(percorso, JSON.stringify(req.body, null, 2), 'utf8');
  res.json({ ok: true, file: path.basename(percorso) });
});

app.delete('/api/quiz/:file', async (req, res) => {
  const percorso = percorsoSicuro(CARTELLA_QUIZ, req.params.file);
  if (!percorso || !existsSync(percorso)) return res.status(404).json({ errore: 'Quiz non trovato' });
  await unlink(percorso);
  res.json({ ok: true });
});

// -------------------------------------------------------------------- media

const ESTENSIONI = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/svg+xml': '.svg',
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav',
  'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/aac': '.aac',
};

app.get('/api/media', async (_req, res) => {
  try {
    const file = (await readdir(CARTELLA_MEDIA)).filter((f) => !f.endsWith('.mjs'));
    const elenco = await Promise.all(file.map(async (f) => ({
      file: f,
      url: '/media/' + f,
      byte: (await stat(path.join(CARTELLA_MEDIA, f))).size,
      tipo: /\.(mp3|wav|ogg|m4a|aac)$/i.test(f) ? 'audio' : 'immagine',
    })));
    res.json(elenco.sort((a, b) => a.file.localeCompare(b.file)));
  } catch {
    res.json([]);
  }
});

/**
 * Caricamento di una foto o di una traccia dall'editor.
 * Arriva come data URL: nessuna dipendenza in piu' per il multipart, e il
 * client puo' gia' mostrare l'anteprima prima di inviare.
 */
app.post('/api/media', async (req, res) => {
  const { nome, dati } = req.body ?? {};
  const pezzi = /^data:([^;]+);base64,(.+)$/s.exec(String(dati ?? ''));
  if (!pezzi) return res.status(400).json({ errore: 'File non leggibile' });

  const estensione = ESTENSIONI[pezzi[1].toLowerCase()];
  if (!estensione) return res.status(400).json({ errore: 'Formato non ammesso: ' + pezzi[1] });

  const contenuto = Buffer.from(pezzi[2], 'base64');
  if (contenuto.length > 25 * 1024 * 1024) {
    return res.status(413).json({ errore: 'File troppo grande (massimo 25 MB)' });
  }

  const base = (String(nome ?? 'file').replace(/\.[^.]+$/, '')
    .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)) || 'file';
  const finale = base + '-' + Date.now().toString(36) + estensione;

  await writeFile(path.join(CARTELLA_MEDIA, finale), contenuto);
  res.json({ ok: true, url: '/media/' + finale, file: finale });
});

app.delete('/api/media/:file', async (req, res) => {
  const percorso = percorsoSicuro(CARTELLA_MEDIA, req.params.file);
  if (!percorso || !existsSync(percorso)) return res.status(404).json({ errore: 'File non trovato' });
  await unlink(percorso);
  res.json({ ok: true });
});

// Se il client e' stato compilato, il server lo serve da solo.
if (existsSync(CLIENT_COSTRUITO)) {
  app.use(express.static(CLIENT_COSTRUITO));
  app.get(/^\/(?!api|media|socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_COSTRUITO, 'index.html'));
  });
}

// -------------------------------------------------------------- websocket

io.on('connection', (socket) => {
  let stanzaCorrente = null;
  let idGiocatore = null;
  let ruolo = null;

  const tocca = () => { if (stanzaCorrente) stanzaCorrente.ultimoContatto = Date.now(); };

  /** Il presentatore apre una nuova partita col quiz che ha scelto. */
  socket.on('regia:crea', ({ quiz }, rispondi) => {
    const errore = validaQuiz(quiz);
    if (errore) return rispondi?.({ errore });

    const stanza = creaStanza(quiz);
    stanza.presentatore = socket.id;
    stanzaCorrente = stanza;
    ruolo = 'regia';
    socket.join(stanza.codice);
    tocca();

    rispondi?.({ codice: stanza.codice });
    trasmetti(stanza);
  });

  /** Rientro in regia (ricarica di pagina, cambio dispositivo). */
  socket.on('regia:entra', ({ codice }, rispondi) => {
    const stanza = stanze.get(String(codice ?? '').toUpperCase());
    if (!stanza) return rispondi?.({ errore: 'Stanza inesistente' });

    stanza.presentatore = socket.id;
    stanzaCorrente = stanza;
    ruolo = 'regia';
    socket.join(stanza.codice);
    tocca();

    rispondi?.({ codice: stanza.codice });
    trasmetti(stanza);
  });

  /** Il tabellone: sola lettura, e' lo schermo che vedono tutti. */
  socket.on('tabellone:entra', ({ codice }, rispondi) => {
    const stanza = stanze.get(String(codice ?? '').toUpperCase());
    if (!stanza) return rispondi?.({ errore: 'Stanza inesistente' });

    stanzaCorrente = stanza;
    ruolo = 'tabellone';
    stanza.tabelloni.add(socket.id);
    socket.join(stanza.codice + ':pubblico');
    tocca();

    rispondi?.({ codice: stanza.codice });
    socket.emit('stato', stanza.statoPubblico());
  });

  /** Un giocatore col telefono. L'id lo porta lui, cosi' la riconnessione tiene i punti. */
  socket.on('giocatore:entra', ({ codice, nome, id }, rispondi) => {
    const stanza = stanze.get(String(codice ?? '').toUpperCase());
    if (!stanza) return rispondi?.({ errore: 'Stanza inesistente' });

    idGiocatore = String(id ?? '').slice(0, 64) || socket.id;
    const scheda = stanza.entraGiocatore(idGiocatore, String(nome ?? '').slice(0, 24), socket.id);

    stanzaCorrente = stanza;
    ruolo = 'giocatore';
    socket.join(stanza.codice + ':pubblico');
    tocca();

    rispondi?.({ codice: stanza.codice, id: scheda.id, colore: scheda.colore, nome: scheda.nome });
    trasmetti(stanza);
  });

  /** Il buzz. Unico momento in cui il tempo conta davvero. */
  socket.on('giocatore:prenota', (_dati, rispondi) => {
    if (ruolo !== 'giocatore' || !stanzaCorrente) return rispondi?.({ posizione: null });
    const posizione = stanzaCorrente.prenota(idGiocatore);
    tocca();
    rispondi?.({ posizione });
    if (posizione) trasmetti(stanzaCorrente);
  });

  /** Tutti i comandi della regia passano da qui. */
  socket.on('regia:azione', (azione = {}, rispondi) => {
    const s = stanzaCorrente;
    if (ruolo !== 'regia' || !s) return rispondi?.({ errore: 'Non sei in regia' });
    tocca();

    switch (azione.tipo) {
      case 'round':            s.vaiARound(Number(azione.indice)); break;
      case 'domanda':          s.caricaDomanda(Number(azione.indice)); break;
      case 'apri':             s.apri(); break;
      case 'chiudi':           s.chiudi(); break;
      case 'riapri':           s.riapri(); break;
      case 'passo':            s.avanzaPasso(Number(azione.delta ?? 1)); break;
      case 'auto':             s.alternaAuto(); break;
      case 'rivela':           s.rivela(); break;
      case 'classifica':       s.mostraClassifica(); break;
      case 'griglia':          s.tornaAllaGriglia(); break;
      case 'prossima':         s.prossima(); break;
      case 'annullaBuzz':      s.annullaPrenotazioni(); break;
      case 'giudica':          s.giudica(azione.idGiocatore, azione.esito); break;
      case 'punti':            s.assegnaPunti(azione.idGiocatore, Number(azione.delta), azione.motivo); break;
      case 'moltiplicatore':   s.impostaMoltiplicatore(azione.idGiocatore, azione.valore); break;
      case 'rinomina':         s.rinomina(azione.idGiocatore, azione.nome); break;
      case 'rimuovi':          s.rimuoviGiocatore(azione.idGiocatore); break;
      case 'azzera':           s.azzeraPunti(); break;
      default: return rispondi?.({ errore: 'Azione sconosciuta: ' + azione.tipo });
    }

    rispondi?.({ ok: true });
    trasmetti(s);
  });

  socket.on('disconnect', () => {
    if (!stanzaCorrente) return;
    stanzaCorrente.ultimoContatto = Date.now();
    stanzaCorrente.disconnetti(socket.id);
    trasmetti(stanzaCorrente);
  });
});

server.listen(PORTA, () => {
  console.log('NicerQuiz in ascolto su http://localhost:' + PORTA);
});
