import { puntiCorrenti, passiTotali, malusErrore } from './punteggi.js';
import { tipoContenuto } from './quiz.js';

const COLORI = [
  '#ff5c7a', '#4dd4ac', '#ffb340', '#5c9dff', '#c77dff',
  '#ff8f5c', '#3fd0e0', '#f2e05c', '#8affa0', '#ff6fd8',
];

/**
 * Una partita. Vive in memoria per tutta la durata della serata.
 *
 * Regola d'oro: il server e' l'unico arbitro. Il tempo di prenotazione lo
 * misura lui, i punti li calcola lui, e la risposta esatta non esce mai
 * verso il tabellone o i telefoni finche' non e' il momento.
 */
export class Stanza {
  constructor(codice, quiz, notifica) {
    this.codice = codice;
    this.quiz = quiz;
    this.notifica = notifica;          // richiamata a ogni cambio di stato
    this.creata = Date.now();

    this.presentatore = null;          // socket.id di chi fa la regia
    this.giocatori = new Map();        // idGiocatore -> scheda giocatore
    this.tabelloni = new Set();        // socket.id dei tabelloni collegati

    this.indiceRound = -1;
    this.indiceDomanda = -1;
    this.fase = 'attesa';              // attesa|preparata|aperta|prenotato|chiusa|rivelata|classifica
    this.passo = 0;

    this.caselleUsate = new Set();     // caselle del tabellone gia' giocate

    this.ordine = [];                  // idGiocatore nell'ordine di turno
    this.indiceTurno = 0;              // a chi tocca la prossima domanda
    this.turnoDomanda = null;          // chi e' sulla graticola adesso

    this.prenotazioni = [];            // [{ idGiocatore, ms }] in ordine di arrivo
    this.bloccati = new Set();         // chi ha gia' sbagliato su questa domanda
    this.apertaDa = null;
    this.scadenza = null;              // fine del countdown, se il round ne ha uno

    this.autoAttivo = false;           // rivelazione automatica in corso
    this._timerAuto = null;
    this._timerScadenza = null;

    this.registro = [];                // storico leggibile dalla regia
  }

  // ---------------------------------------------------------------- accessori

  get round() {
    return this.quiz.round?.[this.indiceRound] ?? null;
  }

  get domanda() {
    return this.round?.domande?.[this.indiceDomanda] ?? null;
  }

  get impostazioni() {
    return this.quiz.impostazioni ?? {};
  }

  /** Nel tabellone ogni casella ha il suo tipo: il round da solo non basta. */
  get tipoContenuto() {
    return tipoContenuto(this.domanda, this.round);
  }

  get suTabellone() {
    return this.round?.tipo === 'tabellone';
  }

  /**
   * Come si risponde in questo round.
   *   'buzzer' — chi prenota per primo (il valore di sempre)
   *   'giro'   — si risponde a turno, in ordine, e i buzzer restano spenti
   */
  get modoRisposte() {
    return this.round?.risposte === 'giro' ? 'giro' : 'buzzer';
  }

  get aGiro() {
    return this.modoRisposte === 'giro';
  }

  get passiTotali() {
    if (!this.domanda) return 0;
    return passiTotali(this.domanda, this.round);
  }

  get puntiOra() {
    if (!this.domanda) return 0;
    return puntiCorrenti(this.domanda, this.round, this.passo);
  }

  // --------------------------------------------------------------- giocatori

  entraGiocatore(idGiocatore, nome, socketId) {
    const esistente = this.giocatori.get(idGiocatore);
    if (esistente) {
      // Riconnessione: il telefono si e' bloccato, i punti restano suoi.
      esistente.connesso = true;
      esistente.socketId = socketId;
      if (nome) esistente.nome = nome;
      return esistente;
    }

    const scheda = {
      id: idGiocatore,
      nome: nome || `Giocatore ${this.giocatori.size + 1}`,
      punti: 0,
      colore: COLORI[this.giocatori.size % COLORI.length],
      connesso: true,
      socketId,
      moltiplicatore: 1,               // jolly per la prossima risposta esatta
      avatar: null,                    // foto sul tabellone, se ne carica una
    };
    this.giocatori.set(idGiocatore, scheda);
    this.ordine.push(idGiocatore);     // in coda al giro, chi arriva dopo gioca dopo
    this.annota(scheda.nome + " e' entrato");
    return scheda;
  }

  impostaAvatar(idGiocatore, url) {
    const g = this.giocatori.get(idGiocatore);
    if (!g) return;
    g.avatar = url || null;
  }

  /** Sposta un giocatore nel giro. Serve a decidere chi comincia. */
  spostaInOrdine(idGiocatore, delta) {
    const i = this.ordine.indexOf(idGiocatore);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.ordine.length) return;
    [this.ordine[i], this.ordine[j]] = [this.ordine[j], this.ordine[i]];
  }

  disconnetti(socketId) {
    for (const g of this.giocatori.values()) {
      if (g.socketId === socketId) g.connesso = false;
    }
    this.tabelloni.delete(socketId);
    if (this.presentatore === socketId) this.presentatore = null;
  }

  rimuoviGiocatore(idGiocatore) {
    const g = this.giocatori.get(idGiocatore);
    if (!g) return;
    this.giocatori.delete(idGiocatore);
    this.ordine = this.ordine.filter((id) => id !== idGiocatore);
    this.indiceTurno = this.ordine.length ? this.indiceTurno % this.ordine.length : 0;
    if (this.turnoDomanda === idGiocatore) this.turnoDomanda = null;
    this.prenotazioni = this.prenotazioni.filter((p) => p.idGiocatore !== idGiocatore);
    this.bloccati.delete(idGiocatore);
    this.annota(g.nome + ' rimosso dalla partita');
  }

  rinomina(idGiocatore, nome) {
    const g = this.giocatori.get(idGiocatore);
    if (g && nome) g.nome = nome;
  }

  // ------------------------------------------------------- flusso della gara

  vaiARound(indice) {
    if (!this.quiz.round?.[indice]) return;
    this.fermaTimer();
    this.indiceRound = indice;
    this.indiceDomanda = -1;
    this.caselleUsate = new Set();
    this.pulisciDomanda();
    this.turnoDomanda = null;
    this.assegnaTurno();
    this.fase = 'attesa';
    this.annota('Round ' + (indice + 1) + ': ' + (this.round.nome ?? this.round.tipo));
  }

  caricaDomanda(indice) {
    if (!this.round?.domande?.[indice]) return;
    this.fermaTimer();
    this.indiceDomanda = indice;
    this.pulisciDomanda();
    this.assegnaTurno();
    this.fase = 'preparata';
  }

  // ---------------------------------------------------------------- il giro

  /** Chi risponde a questa domanda, quando si gioca a turno. */
  assegnaTurno() {
    if (!this.aGiro || this.ordine.length === 0) {
      this.turnoDomanda = null;
      return;
    }
    this.indiceTurno = this.indiceTurno % this.ordine.length;
    this.turnoDomanda = this.ordine[this.indiceTurno];
  }

  /** Passa la mano al prossimo, saltando chi ha gia' sbagliato qui. */
  prossimoDiTurno() {
    if (this.ordine.length === 0) return null;
    const partenza = this.ordine.indexOf(this.turnoDomanda);
    for (let salto = 1; salto <= this.ordine.length; salto++) {
      const candidato = this.ordine[(partenza + salto) % this.ordine.length];
      if (!this.bloccati.has(candidato)) return candidato;
    }
    return null;
  }

  /** Il presentatore puo' sempre dire a chi tocca davvero. */
  passaTurno(idGiocatore) {
    const i = this.ordine.indexOf(idGiocatore);
    if (i < 0) return;
    this.indiceTurno = i;
    this.turnoDomanda = idGiocatore;
    this.annota('Tocca a ' + (this.giocatori.get(idGiocatore)?.nome ?? '?'));
  }

  avanzaGiro() {
    if (this.ordine.length === 0) return;
    this.indiceTurno = (this.indiceTurno + 1) % this.ordine.length;
  }

  /** Apre la domanda al pubblico: da qui in poi i buzzer sono vivi. */
  apri() {
    if (!this.domanda) return;
    this.fase = 'aperta';
    this.apertaDa = Date.now();

    const secondi = this.domanda.secondi ?? this.round.secondi;
    if (secondi) {
      this.scadenza = Date.now() + secondi * 1000;
      this._timerScadenza = setTimeout(() => {
        if (this.fase === 'aperta') {
          this.fase = 'chiusa';
          this.fermaAuto();
          this.annota('Tempo scaduto');
          this.notifica();
        }
      }, secondi * 1000);
    }

    // La rivelazione progressiva parte da sola se il round la prevede.
    const intervallo = this.domanda.intervalloMs ?? this.round.intervalloMs;
    if (intervallo && this.passiTotali > 0) this.avviaAuto(intervallo);
  }

  chiudi() {
    if (this.fase === 'aperta' || this.fase === 'prenotato') {
      this.fase = 'chiusa';
      this.fermaTimer();
    }
  }

  /** Rimette la domanda in gioco, per esempio dopo un buzz annullato. */
  riapri() {
    if (this.fase !== 'prenotato' && this.fase !== 'chiusa') return;
    this.fase = 'aperta';
    const intervallo = this.domanda?.intervalloMs ?? this.round?.intervalloMs;
    if (intervallo && !this.autoAttivo && this.passo < this.passiTotali) {
      this.avviaAuto(intervallo);
    }
  }

  avanzaPasso(delta = 1) {
    const massimo = this.passiTotali;
    this.passo = Math.min(massimo, Math.max(0, this.passo + delta));
    if (this.passo >= massimo) this.fermaAuto();
  }

  rivela() {
    this.fase = 'rivelata';
    this.passo = this.passiTotali;
    // La domanda e' chiusa: la coda va svuotata, altrimenti sul telefono di
    // chi aveva prenotato resta acceso "tocca a te".
    this.prenotazioni = [];
    if (this.suTabellone && this.indiceDomanda >= 0) {
      this.caselleUsate.add(this.indiceDomanda);
    }
    this.fermaTimer();
  }

  mostraClassifica() {
    this.fase = 'classifica';
    this.fermaTimer();
  }

  /** Torna alla griglia senza consumare la casella: serve se si sbaglia a cliccare. */
  tornaAllaGriglia() {
    if (!this.suTabellone) return;
    this.fermaTimer();
    this.indiceDomanda = -1;
    this.pulisciDomanda();
    this.fase = 'attesa';
  }

  /** Avanti: prossima domanda, oppure classifica di fine round. */
  prossima() {
    const quante = this.round?.domande?.length ?? 0;

    // Nel tabellone non c'e' un ordine: finita una casella si torna alla
    // griglia e la si sceglie di nuovo, finche' non e' vuota.
    if (this.suTabellone) {
      if (this.indiceDomanda >= 0) {
        this.caselleUsate.add(this.indiceDomanda);
        this.avanzaGiro();
      }
      this.fermaTimer();
      this.indiceDomanda = -1;
      this.pulisciDomanda();
      this.assegnaTurno();
      this.fase = this.caselleUsate.size >= quante ? 'classifica' : 'attesa';
      return;
    }

    if (this.indiceDomanda >= 0) this.avanzaGiro();

    if (this.indiceDomanda + 1 < quante) {
      this.caricaDomanda(this.indiceDomanda + 1);
    } else {
      this.fermaTimer();
      this.indiceDomanda = -1;
      this.pulisciDomanda();
      this.fase = 'classifica';
    }
  }

  // ------------------------------------------------------------------ buzzer

  /**
   * Prenotazione di un giocatore.
   * Restituisce la posizione in coda (1 = primo) oppure null se il buzz
   * non e' valido (domanda chiusa, giocatore gia' bloccato, doppio buzz).
   */
  prenota(idGiocatore) {
    // Nei round a turno i buzzer restano spenti: si risponde in ordine.
    if (this.aGiro) return null;
    // La coda resta aperta anche dopo il primo buzz: se chi ha prenotato
    // sbaglia, il presentatore passa subito al successivo senza riaprire.
    if (this.fase !== 'aperta' && this.fase !== 'prenotato') return null;
    if (!this.giocatori.has(idGiocatore)) return null;
    if (this.bloccati.has(idGiocatore)) return null;
    if (this.prenotazioni.some((p) => p.idGiocatore === idGiocatore)) return null;

    const ms = this.apertaDa ? Date.now() - this.apertaDa : 0;
    this.prenotazioni.push({ idGiocatore, ms });

    // Il primo buzz congela tutto: audio in pausa, rivelazione ferma.
    if (this.prenotazioni.length === 1) {
      this.fase = 'prenotato';
      this.fermaAuto();
    }
    return this.prenotazioni.length;
  }

  annullaPrenotazioni() {
    this.prenotazioni = [];
    this.riapri();
  }

  /**
   * Il presentatore giudica chi si e' prenotato.
   * esito: 'giusto' | 'sbagliato'
   */
  giudica(idGiocatore, esito) {
    const g = this.giocatori.get(idGiocatore);
    if (!g) return;

    if (esito === 'giusto') {
      const moltiplicatore = g.moltiplicatore ?? 1;
      const punti = this.puntiOra * moltiplicatore;
      g.punti += punti;
      this.annota(g.nome + ': +' + punti + (moltiplicatore > 1 ? ' (jolly x' + moltiplicatore + ')' : ''));
      g.moltiplicatore = 1;
      this.rivela();
      return;
    }

    const malus = malusErrore(this.round ?? {}, this.impostazioni);
    if (malus) {
      g.punti += malus;
      this.annota(g.nome + ': ' + malus);
    } else {
      this.annota(g.nome + ': sbagliato');
    }

    // Chi sbaglia esce da questa domanda, gli altri possono ancora provarci.
    this.bloccati.add(idGiocatore);
    this.prenotazioni = this.prenotazioni.filter((p) => p.idGiocatore !== idGiocatore);

    // A turno la domanda non si riapre a tutti: o rimbalza al prossimo del
    // giro, o si chiude li'.
    if (this.aGiro) {
      const prossimo = this.round?.rimbalzo ? this.prossimoDiTurno() : null;
      if (prossimo) {
        this.turnoDomanda = prossimo;
        this.annota('Rimbalza a ' + (this.giocatori.get(prossimo)?.nome ?? '?'));
        this.fase = 'aperta';
      } else {
        this.fase = 'chiusa';
        this.fermaTimer();
      }
      return;
    }

    const restaQualcuno = [...this.giocatori.keys()].some((id) => !this.bloccati.has(id));
    if (this.prenotazioni.length > 0) {
      this.fase = 'prenotato';                 // tocca al prossimo in coda
    } else if (restaQualcuno) {
      this.riapri();
    } else {
      this.fase = 'chiusa';
      this.fermaTimer();
    }
  }

  // ------------------------------------------------------------ punti a mano

  /** Bonus, malus, correzioni: il presentatore ha sempre l'ultima parola. */
  assegnaPunti(idGiocatore, delta, motivo = '') {
    const g = this.giocatori.get(idGiocatore);
    const valore = Number(delta);
    if (!g || !Number.isFinite(valore) || valore === 0) return;
    g.punti += valore;
    const segno = valore >= 0 ? '+' + valore : String(valore);
    this.annota(g.nome + ': ' + segno + (motivo ? ' (' + motivo + ')' : ''));
  }

  impostaMoltiplicatore(idGiocatore, valore) {
    const g = this.giocatori.get(idGiocatore);
    if (!g) return;
    g.moltiplicatore = Math.max(1, Number(valore) || 1);
  }

  azzeraPunti() {
    for (const g of this.giocatori.values()) {
      g.punti = 0;
      g.moltiplicatore = 1;
    }
    this.annota('Punteggi azzerati');
  }

  // ------------------------------------------------------------------- timer

  avviaAuto(intervalloMs) {
    this.fermaAuto();
    this.autoAttivo = true;
    this._timerAuto = setInterval(() => {
      if (this.fase !== 'aperta') return this.fermaAuto();
      this.avanzaPasso(1);
      this.notifica();
    }, Math.max(200, intervalloMs));
  }

  fermaAuto() {
    this.autoAttivo = false;
    if (this._timerAuto) clearInterval(this._timerAuto);
    this._timerAuto = null;
  }

  alternaAuto() {
    if (this.autoAttivo) return this.fermaAuto();
    const intervallo = this.domanda?.intervalloMs ?? this.round?.intervalloMs ?? 2000;
    if (this.fase === 'aperta') this.avviaAuto(intervallo);
  }

  fermaTimer() {
    this.fermaAuto();
    if (this._timerScadenza) clearTimeout(this._timerScadenza);
    this._timerScadenza = null;
    this.scadenza = null;
  }

  pulisciDomanda() {
    this.passo = 0;
    this.prenotazioni = [];
    this.bloccati = new Set();
    this.apertaDa = null;
  }

  annota(testo) {
    this.registro.unshift({ testo, quando: Date.now() });
    if (this.registro.length > 60) this.registro.pop();
  }

  distruggi() {
    this.fermaTimer();
  }

  // ------------------------------------------------------- viste dello stato

  scheda(g) {
    return {
      id: g.id,
      nome: g.nome,
      punti: g.punti,
      colore: g.colore,
      connesso: g.connesso,
      moltiplicatore: g.moltiplicatore,
      avatar: g.avatar ?? null,
    };
  }

  classifica() {
    return [...this.giocatori.values()].map((g) => this.scheda(g)).sort((a, b) => b.punti - a.punti);
  }

  /**
   * Gli stessi giocatori, ma nell'ordine del giro.
   * Le icone sul tabellone usano questo: se si riordinassero per punteggio
   * salterebbero da una parte all'altra a ogni risposta.
   */
  inOrdine() {
    return this.ordine
      .map((id) => this.giocatori.get(id))
      .filter(Boolean)
      .map((g) => this.scheda(g));
  }

  /** Cosa possono vedere tabellone e telefoni: mai la risposta, mai le note. */
  contenutoPubblico() {
    const d = this.domanda;
    const r = this.round;
    if (!d || !r) return null;

    // In fase 'preparata' il presentatore sta leggendo: il pubblico non vede
    // ancora nulla del contenuto.
    const visibile = this.fase !== 'preparata';

    const tipo = this.tipoContenuto;
    const base = {
      tipo,
      modo: d.modo ?? r.modo ?? null,
      verso: d.verso ?? r.verso ?? 'comparsa',
      griglia: d.griglia ?? r.griglia ?? [4, 3],
      passo: this.passo,
      passiTotali: this.passiTotali,
      visibile,
      // Nel tabellone la casella scelta si annuncia gia' prima di leggere.
      casella: this.suTabellone
        ? {
            argomento: r.colonne?.[d._colonna]?.titolo ?? null,
            valore: d.valore ?? null,
          }
        : null,
      risposta: this.fase === 'rivelata' ? (d.risposta ?? null) : null,
    };

    if (!visibile) return base;

    if (tipo === 'indovinello') {
      return { ...base, testo: d.testo ?? null, indizi: (d.indizi ?? []).slice(0, this.passo + 1) };
    }
    if (tipo === 'multipla') {
      return {
        ...base,
        testo: d.testo ?? null,
        opzioni: d.opzioni ?? [],
        corretta: this.fase === 'rivelata' ? (d.corretta ?? null) : null,
      };
    }
    if (tipo === 'immagine' || tipo === 'audio') {
      return { ...base, media: d.media ?? null, testo: d.testo ?? null };
    }
    return { ...base, testo: d.testo ?? null };
  }

  /**
   * La griglia del tabellone come la vede il pubblico: argomenti, valori e
   * caselle gia' giocate. Le domande dentro le caselle restano nascoste.
   */
  grigliaPubblica() {
    if (!this.suTabellone) return null;
    const round = this.round;

    return {
      righe: round.righe ?? 0,
      colonne: (round.colonne ?? []).map((colonna, iColonna) => ({
        titolo: colonna.titolo ?? '',
        caselle: (round.domande ?? [])
          .map((d, indice) => ({ d, indice }))
          .filter(({ d }) => d._colonna === iColonna)
          .sort((a, b) => a.d._riga - b.d._riga)
          .map(({ d, indice }) => ({
            indice,
            valore: d.valore,
            usata: this.caselleUsate.has(indice),
            scelta: indice === this.indiceDomanda,
          })),
      })),
      restanti: (round.domande?.length ?? 0) - this.caselleUsate.size,
    };
  }

  statoPubblico() {
    return {
      codice: this.codice,
      titolo: this.quiz.titolo ?? 'Quiz Show',
      fase: this.fase,
      indiceRound: this.indiceRound,
      indiceDomanda: this.indiceDomanda,
      round: this.round
        ? {
            nome: this.round.nome ?? null,
            tipo: this.round.tipo,
            descrizione: this.round.descrizione ?? null,
            totaleDomande: this.round.domande?.length ?? 0,
          }
        : null,
      contenuto: this.contenutoPubblico(),
      griglia: this.grigliaPubblica(),
      punti: this.puntiOra,
      giocatori: this.classifica(),
      giocatoriInOrdine: this.inOrdine(),
      modoRisposte: this.modoRisposte,
      rimbalzo: Boolean(this.round?.rimbalzo),
      turno: this.turnoDomanda
        ? {
            id: this.turnoDomanda,
            nome: this.giocatori.get(this.turnoDomanda)?.nome ?? '?',
            colore: this.giocatori.get(this.turnoDomanda)?.colore ?? '#888888',
          }
        : null,
      prenotazioni: this.prenotazioni.map((p) => ({
        idGiocatore: p.idGiocatore,
        ms: p.ms,
        nome: this.giocatori.get(p.idGiocatore)?.nome ?? '?',
        colore: this.giocatori.get(p.idGiocatore)?.colore ?? '#888888',
      })),
      bloccati: [...this.bloccati],
      apertaDa: this.apertaDa,
      scadenza: this.scadenza,
      autoAttivo: this.autoAttivo,
      presentatoreCollegato: Boolean(this.presentatore),
    };
  }

  /** Lo stato della regia: tutto il pubblico, piu' risposte, note e scaletta. */
  statoRegia() {
    return {
      ...this.statoPubblico(),
      regia: true,
      scaletta: (this.quiz.round ?? []).map((r, i) => ({
        indice: i,
        nome: r.nome ?? 'Round ' + (i + 1),
        tipo: r.tipo,
        domande: r.domande?.length ?? 0,
      })),
      domande: (this.round?.domande ?? []).map((d, i) => ({
        indice: i,
        etichetta: this.suTabellone
          ? (this.round.colonne?.[d._colonna]?.titolo ?? '?') + ' · ' + d.valore
          : (d.testo ?? d.risposta ?? 'Domanda ' + (i + 1)),
        usata: this.caselleUsate.has(i),
      })),
      soluzione: this.domanda
        ? {
            risposta: this.domanda.risposta ?? null,
            accettate: this.domanda.accettate ?? [],
            note: this.domanda.note ?? null,
            corretta: this.domanda.corretta ?? null,
            indiziTutti: this.domanda.indizi ?? null,
            media: this.domanda.media ?? null,
          }
        : null,
      registro: this.registro,
    };
  }
}
