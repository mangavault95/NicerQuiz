import { urlMedia } from '../rete.js';
import RivelatoreImmagine from './RivelatoreImmagine.jsx';
import LettoreAudio from './LettoreAudio.jsx';
import Classifica from './Classifica.jsx';
import Cronometro from './Cronometro.jsx';
import GrigliaTabellone from './GrigliaTabellone.jsx';

/**
 * Lo schermo che vedono tutti, disegnato a partire dal solo stato pubblico.
 *
 * Lo usano in due: la pagina `/tabellone` e la mini-anteprima dentro la regia.
 * Sono la stessa identica cosa proprio perche' il presentatore deve poter
 * fidarsi di quello che vede nel riquadro.
 *
 * In anteprima l'audio non parte: in salotto deve suonare un altoparlante solo.
 */
export default function VistaTabellone({ stato, anteprima = false }) {
  const { fase, round, contenuto, prenotazioni, giocatori, griglia } = stato;
  const primo = prenotazioni[0] ?? null;
  const mostraGriglia = griglia && (fase === 'attesa' || fase === 'classifica');

  return (
    <div className={'tabellone fase-' + fase + (anteprima ? ' in-anteprima' : '')}>
      <header className="tabellone-testata">
        <div className="tabellone-round">
          <span className="etichetta-round">{round?.nome ?? stato.titolo}</span>
          {contenuto?.casella ? (
            <span className="conteggio-domande">
              {contenuto.casella.argomento} · {contenuto.casella.valore} punti
            </span>
          ) : stato.indiceDomanda >= 0 ? (
            <span className="conteggio-domande">
              Domanda {stato.indiceDomanda + 1} di {round?.totaleDomande}
            </span>
          ) : griglia ? (
            <span className="conteggio-domande">{griglia.restanti} caselle da giocare</span>
          ) : null}
        </div>

        <div className="tabellone-strumenti">
          {fase === 'aperta' && (
            <Cronometro apertaDa={stato.apertaDa} scadenza={stato.scadenza} attivo={!anteprima} />
          )}
          {contenuto && fase !== 'attesa' && fase !== 'classifica' && (
            <div className="valore-domanda">
              <strong>{stato.punti}</strong> punti
            </div>
          )}
          <div className="codice-stanza">
            <span>stanza</span>
            <strong>{stato.codice}</strong>
          </div>
        </div>
      </header>

      <main className="tabellone-scena">
        {mostraGriglia && fase === 'attesa' && <GrigliaTabellone griglia={griglia} />}
        {!mostraGriglia && fase === 'attesa' && <IntroRound stato={stato} />}
        {fase === 'classifica' && (
          <div className="scena-classifica">
            <h2>Punteggi</h2>
            <Classifica giocatori={giocatori} />
          </div>
        )}
        {fase !== 'attesa' && fase !== 'classifica' && (
          <Contenuto contenuto={contenuto} fase={fase} anteprima={anteprima} />
        )}
      </main>

      {fase === 'prenotato' && primo && (
        <div className="fascia-prenotazione" style={{ '--colore': primo.colore }}>
          <span className="prenotato-nome">{primo.nome}</span>
          <span className="prenotato-tempo">{(primo.ms / 1000).toFixed(2)}s</span>
          {prenotazioni.length > 1 && (
            <span className="prenotato-coda">
              poi {prenotazioni.slice(1).map((p) => p.nome).join(', ')}
            </span>
          )}
        </div>
      )}

      {fase === 'rivelata' && contenuto?.risposta && (
        <div className="fascia-risposta">
          <span className="etichetta">Risposta</span>
          <strong>{contenuto.risposta}</strong>
        </div>
      )}

      <footer className="tabellone-piede">
        <Classifica giocatori={giocatori} striscia evidenzia={primo?.idGiocatore} />
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------- pezzi

function IntroRound({ stato }) {
  if (!stato.round) {
    return (
      <div className="intro-round">
        <h1>{stato.titolo}</h1>
        <p>
          Il presentatore sta per cominciare. Collegatevi con il codice{' '}
          <strong>{stato.codice}</strong>.
        </p>
      </div>
    );
  }
  return (
    <div className="intro-round">
      <span className="occhiello">Round {stato.indiceRound + 1}</span>
      <h1>{stato.round.nome}</h1>
      {stato.round.descrizione && <p>{stato.round.descrizione}</p>}
    </div>
  );
}

function Contenuto({ contenuto, fase, anteprima }) {
  if (!contenuto) return <div className="intro-round"><h1>…</h1></div>;

  if (!contenuto.visibile) {
    return (
      <div className="intro-round">
        {contenuto.casella ? (
          <>
            <span className="occhiello">{contenuto.casella.argomento}</span>
            <h1>{contenuto.casella.valore} punti</h1>
            <p>Il presentatore sta leggendo la domanda.</p>
          </>
        ) : (
          <>
            <h1>Attenzione…</h1>
            <p>Il presentatore sta leggendo la domanda.</p>
          </>
        )}
      </div>
    );
  }

  const { tipo } = contenuto;

  if (tipo === 'immagine') {
    return (
      <div className="scena-media">
        {contenuto.testo && <p className="didascalia">{contenuto.testo}</p>}
        <RivelatoreImmagine
          src={urlMedia(contenuto.media)}
          modo={contenuto.modo ?? 'puzzle'}
          verso={contenuto.verso}
          griglia={contenuto.griglia}
          passo={contenuto.passo}
          passiTotali={contenuto.passiTotali}
        />
      </div>
    );
  }

  if (tipo === 'audio') {
    return (
      <div className="scena-media">
        {contenuto.testo && <p className="didascalia">{contenuto.testo}</p>}
        <LettoreAudio
          src={urlMedia(contenuto.media)}
          inRiproduzione={fase === 'aperta' && !anteprima}
          modo={contenuto.modo ?? 'normale'}
          passo={contenuto.passo}
          passiTotali={contenuto.passiTotali}
        />
      </div>
    );
  }

  if (tipo === 'indovinello') {
    return (
      <div className="scena-indovinello">
        {contenuto.testo && <p className="didascalia">{contenuto.testo}</p>}
        <ol className="indizi">
          {(contenuto.indizi ?? []).map((indizio, i, tutti) => (
            <li key={i} className={i === tutti.length - 1 ? 'ultimo' : ''}>
              <span className="numero-indizio">{i + 1}</span>
              <span>{indizio}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (tipo === 'multipla') {
    return (
      <div className="scena-multipla">
        <h1 className="domanda-testo">{contenuto.testo}</h1>
        <ul className="opzioni">
          {(contenuto.opzioni ?? []).map((opzione, i) => (
            <li key={i} className={contenuto.corretta === i ? 'giusta' : ''}>
              <span className="lettera">{'ABCD'[i] ?? i + 1}</span>
              <span>{opzione}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="scena-secca">
      <h1 className="domanda-testo">{contenuto.testo}</h1>
    </div>
  );
}
