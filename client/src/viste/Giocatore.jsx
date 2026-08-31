import { useEffect, useState } from 'react';
import { chiedi, identitaGiocatore, ricorda, ricordato, useCollegato, useStato } from '../rete.js';

/**
 * Il telefono del giocatore: un pulsante grande e poco altro.
 * Il tabellone resta l'unico posto dove si guarda la domanda.
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

  // Ci si puo' mettere in coda anche mentre risponde un altro: se sbaglia,
  // il turno passa senza tempi morti.
  const inGioco = stato.fase === 'aperta' || stato.fase === 'prenotato';
  const puoPrenotare = inGioco && !bloccato && miaPrenotazione < 0;

  async function prenota() {
    if (!puoPrenotare) return;
    navigator.vibrate?.(60);
    await chiedi('giocatore:prenota');
  }

  return (
    <div className="giocatore" style={{ '--colore': me?.colore ?? '#5c9dff' }}>
      <header className="giocatore-testata">
        <div className="giocatore-identita">
          <span className="pallino" />
          <strong>{me?.nome ?? nome}</strong>
        </div>
        <div className="giocatore-punti">
          <strong>{me?.punti ?? 0}</strong>
          <span>{posizione > 0 ? posizione + '°' : ''}</span>
        </div>
      </header>

      <main className="giocatore-centro">
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
          <span className="buzzer-etichetta">{etichettaBuzzer(stato, mioId, miaPrenotazione, bloccato)}</span>
        </button>
      </main>

      <footer className="giocatore-piede">
        <p className="giocatore-messaggio">{messaggio(stato, mioId, miaPrenotazione, bloccato, primo)}</p>
        {me?.moltiplicatore > 1 && (
          <p className="giocatore-jolly">Jolly attivo: la prossima risposta esatta vale x{me.moltiplicatore}</p>
        )}
        {!collegato && <p className="avviso-errore">Connessione persa, sto riprovando…</p>}
      </footer>
    </div>
  );
}

function etichettaBuzzer(stato, mioId, miaPrenotazione, bloccato) {
  if (bloccato) return 'Fuori da questa domanda';
  if (miaPrenotazione === 0) return 'Tocca a te!';
  if (miaPrenotazione > 0) return (miaPrenotazione + 1) + '° in coda';
  if (stato.fase === 'aperta' || stato.fase === 'prenotato') return 'PRENOTA';
  return 'Aspetta…';
}

function messaggio(stato, mioId, miaPrenotazione, bloccato, primo) {
  switch (stato.fase) {
    case 'attesa':
      return stato.round ? 'Round: ' + stato.round.nome : 'La partita sta per cominciare.';
    case 'preparata':
      return 'Il presentatore sta leggendo. Occhio al tabellone.';
    case 'aperta':
      if (bloccato) return "Hai gia' risposto a questa domanda.";
      return 'Domanda aperta: vale ' + stato.punti + ' punti.';
    case 'prenotato':
      if (miaPrenotazione === 0) return 'Rispondi a voce.';
      return (primo?.nome ?? 'Qualcuno') + ' ha prenotato per primo.';
    case 'chiusa':
      return 'Domanda chiusa.';
    case 'rivelata':
      return stato.contenuto?.risposta ? 'Risposta: ' + stato.contenuto.risposta : 'Risposta svelata.';
    case 'classifica':
      return 'Guarda il tabellone per i punteggi.';
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
