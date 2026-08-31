import { useEffect, useState } from 'react';
import {
  chiedi, identitaGiocatore, ricorda, ricordato,
  urlMedia, useCollegato, useStato,
} from '../rete.js';

/**
 * Il telefono del giocatore: un pulsante grande e poco altro.
 * Il tabellone resta l'unico posto dove si guarda la domanda.
 *
 * Nei round a turno il buzzer sparisce del tutto: al suo posto c'e' il cartello
 * che dice a chi tocca, cosi' nessuno preme un pulsante che non conta.
 */
export default function Giocatore({ codiceIniziale }) {
  const stato = useStato();
  const collegato = useCollegato();
  const mioId = identitaGiocatore();

  const [nome, setNome] = useState(ricordato('nome'));
  const [entrato, setEntrato] = useState(false);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    if (!collegato || !codiceIniziale || !nome.trim()) return;
    chiedi('giocatore:entra', { codice: codiceIniziale, nome: nome.trim(), id: mioId }).then((r) => {
      if (r.errore) return setErrore(r.errore);
      setErrore(null);
      setEntrato(true);
    });
  }, [collegato, codiceIniziale, mioId, nome]);

  if (!nome.trim()) return <ChiediNome onNome={(n) => { ricorda('nome', n); setNome(n); }} />;
  if (errore) return <Cartello titolo={errore} nota={'Codice: ' + codiceIniziale} />;
  if (!stato || !entrato) return <Cartello titolo="Mi collego…" nota={'Stanza ' + codiceIniziale} />;

  const me = stato.giocatori.find((g) => g.id === mioId);
  const posizione = stato.giocatori.findIndex((g) => g.id === mioId) + 1;
  const bloccato = stato.bloccati.includes(mioId);
  const miaPrenotazione = stato.prenotazioni.findIndex((p) => p.idGiocatore === mioId);
  const primo = stato.prenotazioni[0] ?? null;

  const aGiro = stato.modoRisposte === 'giro';
  const mioTurno = aGiro && stato.turno?.id === mioId;

  // Ci si puo' mettere in coda anche mentre risponde un altro: se sbaglia,
  // il turno passa senza tempi morti.
  const inGioco = stato.fase === 'aperta' || stato.fase === 'prenotato';
  const puoPrenotare = !aGiro && inGioco && !bloccato && miaPrenotazione < 0;

  async function prenota() {
    if (!puoPrenotare) return;
    navigator.vibrate?.(60);
    await chiedi('giocatore:prenota');
  }

  return (
    <div className="giocatore" style={{ '--colore': me?.colore ?? '#5c9dff' }}>
      <header className="giocatore-testata">
        <FotoGiocatore me={me} nome={nome} />
        <div className="giocatore-punti">
          <strong>{me?.punti ?? 0}</strong>
          <span>{posizione > 0 ? posizione + '°' : ''}</span>
        </div>
      </header>

      <main className="giocatore-centro">
        {aGiro ? (
          <CartelloTurno stato={stato} mioTurno={mioTurno} />
        ) : (
          <button
            className={
              'buzzer' +
              (puoPrenotare ? ' attivo' : '') +
              (miaPrenotazione === 0 ? ' primo' : '') +
              (bloccato ? ' bloccato' : '')
            }
            onPointerDown={prenota}
            disabled={!puoPrenotare}
          >
            <span className="buzzer-etichetta">
              {etichettaBuzzer(stato, miaPrenotazione, bloccato)}
            </span>
          </button>
        )}
      </main>

      <footer className="giocatore-piede">
        <p className="giocatore-messaggio">
          {messaggio(stato, miaPrenotazione, bloccato, primo, aGiro, mioTurno)}
        </p>
        {me?.moltiplicatore > 1 && (
          <p className="giocatore-jolly">
            Jolly attivo: la prossima risposta esatta vale x{me.moltiplicatore}
          </p>
        )}
        {!collegato && <p className="avviso-errore">Connessione persa, sto riprovando…</p>}
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------- pezzi

/**
 * Nome e faccia. La foto la decide il conduttore dalla regia: dal telefono si
 * vede e basta, cosi' nessuno se la cambia a meta' partita.
 */
function FotoGiocatore({ me, nome }) {
  return (
    <div className="giocatore-identita">
      <span className="mia-foto">
        {me?.avatar
          ? <img src={urlMedia(me.avatar)} alt="" />
          : <span className="pallino" />}
      </span>
      <strong>{me?.nome ?? nome}</strong>
    </div>
  );
}

function CartelloTurno({ stato, mioTurno }) {
  if (!stato.turno) {
    return (
      <div className="turno-cartello">
        <span className="turno-titolo">Si gioca a turno</span>
        <p>Il presentatore sta per dire a chi tocca.</p>
      </div>
    );
  }

  return (
    <div className={'turno-cartello' + (mioTurno ? ' mio' : '')} style={{ '--colore': stato.turno.colore }}>
      <span className="turno-titolo">{mioTurno ? 'Tocca a te' : 'Tocca a'}</span>
      {!mioTurno && <strong className="turno-nome">{stato.turno.nome}</strong>}
      <p>{mioTurno ? 'Rispondi a voce.' : 'Aspetta il tuo giro.'}</p>
    </div>
  );
}

function etichettaBuzzer(stato, miaPrenotazione, bloccato) {
  if (bloccato) return 'Fuori da questa domanda';
  if (miaPrenotazione === 0) return 'Tocca a te!';
  if (miaPrenotazione > 0) return (miaPrenotazione + 1) + '° in coda';
  if (stato.fase === 'aperta' || stato.fase === 'prenotato') return 'PRENOTA';
  return 'Aspetta…';
}

function messaggio(stato, miaPrenotazione, bloccato, primo, aGiro, mioTurno) {
  if (stato.fase === 'rivelata') {
    return stato.contenuto?.risposta ? 'Risposta: ' + stato.contenuto.risposta : 'Risposta svelata.';
  }
  if (stato.fase === 'classifica') return 'Guarda il tabellone per i punteggi.';
  if (stato.fase === 'attesa') {
    return stato.round ? 'Round: ' + stato.round.nome : 'La partita sta per cominciare.';
  }
  if (stato.fase === 'preparata') return 'Il presentatore sta leggendo. Occhio al tabellone.';

  if (aGiro) {
    if (stato.fase === 'chiusa') return 'Domanda chiusa.';
    if (mioTurno) return 'Vale ' + stato.punti + ' punti.';
    return stato.rimbalzo ? 'Se sbaglia, potrebbe rimbalzare a te.' : 'Non tocca a te, questa.';
  }

  switch (stato.fase) {
    case 'aperta':
      if (bloccato) return "Hai gia' risposto a questa domanda.";
      return 'Domanda aperta: vale ' + stato.punti + ' punti.';
    case 'prenotato':
      if (miaPrenotazione === 0) return 'Rispondi a voce.';
      return (primo?.nome ?? 'Qualcuno') + ' ha prenotato per primo.';
    case 'chiusa':
      return 'Domanda chiusa.';
    default:
      return '';
  }
}

function ChiediNome({ onNome }) {
  const [valore, setValore] = useState('');
  return (
    <div className="cartello">
      <h1>Come ti chiami?</h1>
      <input
        autoFocus
        maxLength={24}
        value={valore}
        placeholder="Il tuo nome"
        onChange={(e) => setValore(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valore.trim() && onNome(valore.trim())}
      />
      <button className="bottone primario" disabled={!valore.trim()} onClick={() => onNome(valore.trim())}>
        Entro in partita
      </button>
    </div>
  );
}

function Cartello({ titolo, nota }) {
  return (
    <div className="cartello">
      <h1>{titolo}</h1>
      {nota && <p>{nota}</p>}
    </div>
  );
}
