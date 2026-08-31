import { useEffect, useRef, useState } from 'react';
import { caricaMedia, chiedi, urlMedia, useCollegato, useStato } from '../rete.js';
import RivelatoreImmagine from '../componenti/RivelatoreImmagine.jsx';
import Classifica from '../componenti/Classifica.jsx';
import Cronometro from '../componenti/Cronometro.jsx';
import AnteprimaRegia from '../componenti/AnteprimaRegia.jsx';
import GrigliaTabellone from '../componenti/GrigliaTabellone.jsx';

/**
 * La console del presentatore. Qui si vede tutto: risposte, note, scaletta,
 * chi ha prenotato e con che distacco. Quello che succede sul tabellone lo
 * decide questa pagina, mai il tabellone da solo.
 */
export default function Regia({ codiceIniziale }) {
  const stato = useStato();
  const collegato = useCollegato();
  const [errore, setErrore] = useState(null);
  const [copiato, setCopiato] = useState(false);

  useEffect(() => {
    if (!collegato || !codiceIniziale) return;
    chiedi('regia:entra', { codice: codiceIniziale }).then((r) => setErrore(r.errore ?? null));
  }, [collegato, codiceIniziale]);

  const azione = (tipo, extra = {}) => chiedi('regia:azione', { tipo, ...extra });

  // Scorciatoie da tastiera: con una mano sola si conduce tutta la serata.
  useEffect(() => {
    function alTasto(e) {
      const dentroCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (dentroCampo || !stato) return;

      // A turno si giudica chi ha la mano, al buzzer chi ha prenotato per primo.
      const bersaglio = stato.modoRisposte === 'giro'
        ? (stato.turno ? { idGiocatore: stato.turno.id } : null)
        : stato.prenotazioni[0];
      const primo = bersaglio;

      const scorciatoie = {
        ' ': () => {
          if (stato.fase === 'preparata') return azione('apri');
          if (stato.fase === 'attesa') return azione('domanda', { indice: 0 });
          if (stato.fase === 'rivelata' || stato.fase === 'classifica') return azione('prossima');
          return azione('rivela');
        },
        ArrowRight: () => azione('prossima'),
        ArrowUp: () => azione('passo', { delta: 1 }),
        ArrowDown: () => azione('passo', { delta: -1 }),
        g: () => primo && azione('giudica', { idGiocatore: primo.idGiocatore, esito: 'giusto' }),
        s: () => primo && azione('giudica', { idGiocatore: primo.idGiocatore, esito: 'sbagliato' }),
        p: () => azione('auto'),
      };

      const fai = scorciatoie[e.key];
      if (fai) { e.preventDefault(); fai(); }
    }
    addEventListener('keydown', alTasto);
    return () => removeEventListener('keydown', alTasto);
  }, [stato]);

  if (errore) return <div className="cartello"><h1>{errore}</h1></div>;
  if (!stato) return <div className="cartello"><h1>Apro la regia…</h1></div>;

  const linkGiocatore = `${location.origin}/gioca?c=${stato.codice}`;
  const linkTabellone = `${location.origin}/tabellone?c=${stato.codice}`;

  return (
    <div className="regia">
      <header className="regia-testata">
        <div>
          <h1>{stato.titolo}</h1>
          <span className={'stato-fase fase-' + stato.fase}>{nomeFase(stato.fase)}</span>
        </div>

        <div className="regia-collegamenti">
          <div className="codice-grande">
            <span>codice</span>
            <strong>{stato.codice}</strong>
          </div>
          <button
            className="bottone fantasma"
            onClick={() => {
              navigator.clipboard?.writeText(linkGiocatore);
              setCopiato(true);
              setTimeout(() => setCopiato(false), 1800);
            }}
          >
            {copiato ? 'Link copiato' : 'Copia il link per i giocatori'}
          </button>
          <a className="bottone fantasma" href={linkTabellone} target="_blank" rel="noreferrer">
            Apri il tabellone
          </a>
          {!collegato && <span className="avviso-errore">Connessione persa…</span>}
        </div>
      </header>

      <div className="regia-corpo">
        <aside className="colonna scaletta">
          <h2>Scaletta</h2>
          <ol className="elenco-round">
            {stato.scaletta.map((r) => (
              <li key={r.indice}>
                <button
                  className={'riga-round' + (r.indice === stato.indiceRound ? ' corrente' : '')}
                  onClick={() => azione('round', { indice: r.indice })}
                >
                  <span className="riga-round-nome">{r.nome}</span>
                  <span className="riga-round-dati">{r.tipo} · {r.domande}</span>
                </button>
              </li>
            ))}
          </ol>

          {stato.domande.length > 0 && (
            <>
              <h2>Domande del round</h2>
              <ol className="elenco-domande">
                {stato.domande.map((d) => (
                  <li key={d.indice}>
                    <button
                      className={
                        'riga-domanda' +
                        (d.indice === stato.indiceDomanda ? ' corrente' : '') +
                        (d.usata ? ' usata' : '')
                      }
                      onClick={() => azione('domanda', { indice: d.indice })}
                    >
                      <span className="numero">{d.indice + 1}</span>
                      <span className="etichetta">{d.etichetta}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>

        <main className="colonna palco">
          <section className="pannello pannello-anteprima">
            <div className="titolo-con-azione">
              <h2>Quello che vedono loro</h2>
              <span className="nota-anteprima">dal vivo, audio escluso</span>
            </div>
            <AnteprimaRegia stato={stato} />
          </section>

          {stato.griglia && stato.indiceDomanda < 0 && (
            <PannelloGriglia stato={stato} azione={azione} />
          )}
          <PannelloDomanda stato={stato} azione={azione} />
          <PannelloComandi stato={stato} azione={azione} />
          <PannelloBuzz stato={stato} azione={azione} />
        </main>

        <aside className="colonna gestione">
          <PannelloGiocatori stato={stato} azione={azione} />
          <h2>Registro</h2>
          <ul className="registro">
            {stato.registro.map((r, i) => (
              <li key={i}>
                <time>{new Date(r.quando).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                <span>{r.testo}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- pannelli

function PannelloGriglia({ stato, azione }) {
  return (
    <section className="pannello">
      <div className="titolo-con-azione">
        <h2>Scegli la casella</h2>
        <span className="nota-anteprima">{stato.griglia.restanti} da giocare</span>
      </div>
      <GrigliaTabellone
        griglia={stato.griglia}
        compatta
        onScegli={(indice) => azione('domanda', { indice })}
      />
    </section>
  );
}

function PannelloDomanda({ stato }) {
  const { contenuto, soluzione, round } = stato;

  if (!contenuto || !soluzione) {
    if (stato.griglia) return null;   // la griglia dice gia' cosa fare
    return (
      <section className="pannello">
        <p className="vuoto">
          {round
            ? 'Round selezionato. Scegli una domanda dalla scaletta, oppure premi Spazio.'
            : 'Scegli un round dalla scaletta per cominciare.'}
        </p>
      </section>
    );
  }

  return (
    <section className="pannello pannello-domanda">
      <div className="domanda-intestazione">
        {contenuto.casella && (
          <span className="badge argomento">{contenuto.casella.argomento}</span>
        )}
        <span className="badge">{contenuto.tipo}</span>
        {contenuto.modo && <span className="badge tenue">{contenuto.modo} · {contenuto.verso}</span>}
        <span className="badge valore">{stato.punti} punti ora</span>
        {stato.fase === 'aperta' && (
          <Cronometro apertaDa={stato.apertaDa} scadenza={stato.scadenza} attivo />
        )}
      </div>

      {contenuto.testo && <p className="domanda-testo-regia">{contenuto.testo}</p>}

      {soluzione.indiziTutti && (
        <ol className="indizi-regia">
          {soluzione.indiziTutti.map((indizio, i) => (
            <li key={i} className={i <= contenuto.passo ? 'mostrato' : ''}>{indizio}</li>
          ))}
        </ol>
      )}

      {contenuto.opzioni && (
        <ul className="opzioni-regia">
          {contenuto.opzioni.map((o, i) => (
            <li key={i} className={soluzione.corretta === i ? 'giusta' : ''}>
              {'ABCD'[i] ?? i + 1}. {o}
            </li>
          ))}
        </ul>
      )}

      {contenuto.tipo === 'immagine' && soluzione.media && (
        <div className="anteprima-media">
          <RivelatoreImmagine src={urlMedia(soluzione.media)} tutto />
        </div>
      )}

      {contenuto.tipo === 'audio' && soluzione.media && (
        <div className="anteprima-media">
          <p className="nota-cuffie">Ascolto di controllo: usa le cuffie, il tabellone suona per conto suo.</p>
          <audio src={urlMedia(soluzione.media)} controls preload="none" />
        </div>
      )}

      <div className="soluzione">
        <span className="etichetta">Risposta</span>
        <strong>{soluzione.risposta ?? '—'}</strong>
        {soluzione.accettate?.length > 0 && (
          <p className="accettate">Accetta anche: {soluzione.accettate.join(', ')}</p>
        )}
        {soluzione.note && <p className="note">{soluzione.note}</p>}
      </div>
    </section>
  );
}

function PannelloComandi({ stato, azione }) {
  const haPassi = (stato.contenuto?.passiTotali ?? 0) > 0;

  return (
    <section className="pannello comandi">
      <div className="fila-comandi">
        {stato.fase === 'preparata' && (
          <button className="bottone primario grande" onClick={() => azione('apri')}>
            Mostra e apri i buzzer
          </button>
        )}
        {stato.fase === 'aperta' && (
          <button className="bottone grande" onClick={() => azione('chiudi')}>Chiudi i buzzer</button>
        )}
        {stato.fase === 'chiusa' && (
          <button className="bottone grande" onClick={() => azione('riapri')}>Riapri i buzzer</button>
        )}
        <button className="bottone grande" onClick={() => azione('rivela')}>Rivela la risposta</button>
        <button className="bottone primario grande" onClick={() => azione('prossima')}>
          {stato.griglia ? 'Chiudi la casella' : 'Avanti'}
        </button>
        {stato.griglia && stato.indiceDomanda >= 0 && (
          <button className="bottone fantasma" onClick={() => azione('griglia')}>
            Torna alla griglia
          </button>
        )}
        <button className="bottone fantasma" onClick={() => azione('classifica')}>Mostra i punteggi</button>
      </div>

      {haPassi && (
        <div className="fila-comandi passi">
          <button className="bottone" onClick={() => azione('passo', { delta: -1 })}>◀ indietro</button>
          <span className="indicatore-passo">
            passo <strong>{stato.contenuto.passo}</strong> / {stato.contenuto.passiTotali}
          </span>
          <button className="bottone" onClick={() => azione('passo', { delta: 1 })}>avanti ▶</button>
          <button
            className={'bottone' + (stato.autoAttivo ? ' acceso' : '')}
            onClick={() => azione('auto')}
          >
            {stato.autoAttivo ? 'Ferma automatico' : 'Avvia automatico'}
          </button>
        </div>
      )}

      <p className="scorciatoie">
        Spazio: apri / rivela / avanti · ↑↓ passo · P pausa automatico ·
        G giusto · S sbagliato · → domanda successiva
      </p>
    </section>
  );
}

function PannelloBuzz({ stato, azione }) {
  // Round a turno: non c'e' una coda da gestire, c'e' una persona sola.
  if (stato.modoRisposte === 'giro') {
    if (!stato.turno) {
      return (
        <section className="pannello">
          <p className="vuoto">Round a turno, ma non e&apos; ancora entrato nessuno.</p>
        </section>
      );
    }

    return (
      <section className="pannello coda-buzz">
        <div className="titolo-con-azione">
          <h2>A turno</h2>
          <span className="nota-anteprima">
            {stato.rimbalzo ? 'chi sbaglia passa al prossimo' : 'chi sbaglia chiude la domanda'}
          </span>
        </div>

        <ol>
          <li style={{ '--colore': stato.turno.colore }}>
            <span className="ordine">▶</span>
            <span className="nome">{stato.turno.nome}</span>
            <span className="tempo">{stato.punti} pt</span>
            <button
              className="bottone giusto"
              onClick={() => azione('giudica', { idGiocatore: stato.turno.id, esito: 'giusto' })}
            >
              Giusto
            </button>
            <button
              className="bottone sbagliato"
              onClick={() => azione('giudica', { idGiocatore: stato.turno.id, esito: 'sbagliato' })}
            >
              Sbagliato
            </button>
          </li>
        </ol>

        <div className="passa-turno">
          <span className="campo-etichetta">Passa la mano a</span>
          <div className="fila-comandi">
            {stato.giocatoriInOrdine.map((g) => (
              <button
                key={g.id}
                className={'bottone minuscolo' + (g.id === stato.turno.id ? ' acceso' : ' fantasma')}
                onClick={() => azione('turno', { idGiocatore: g.id })}
              >
                {g.nome}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (stato.prenotazioni.length === 0) {
    return (
      <section className="pannello">
        <p className="vuoto">
          {stato.fase === 'aperta' ? "Buzzer aperti, nessuno si e' ancora prenotato." : 'Nessuna prenotazione.'}
        </p>
      </section>
    );
  }

  return (
    <section className="pannello coda-buzz">
      <h2>In coda</h2>
      <ol>
        {stato.prenotazioni.map((p, i) => (
          <li key={p.idGiocatore} style={{ '--colore': p.colore }}>
            <span className="ordine">{i + 1}</span>
            <span className="nome">{p.nome}</span>
            <span className="tempo">{(p.ms / 1000).toFixed(2)}s</span>
            <button
              className="bottone giusto"
              onClick={() => azione('giudica', { idGiocatore: p.idGiocatore, esito: 'giusto' })}
            >
              Giusto
            </button>
            <button
              className="bottone sbagliato"
              onClick={() => azione('giudica', { idGiocatore: p.idGiocatore, esito: 'sbagliato' })}
            >
              Sbagliato
            </button>
          </li>
        ))}
      </ol>
      <button className="bottone fantasma" onClick={() => azione('annullaBuzz')}>
        Annulla le prenotazioni
      </button>
    </section>
  );
}

function PannelloGiocatori({ stato, azione }) {
  const [personalizzato, setPersonalizzato] = useState('');

  return (
    <section className="pannello giocatori-regia">
      <div className="titolo-con-azione">
        <h2>Giocatori ({stato.giocatori.length})</h2>
        <button className="bottone minuscolo fantasma" onClick={() => azione('azzera')}>azzera</button>
      </div>

      <Classifica giocatori={stato.giocatori} />

      <div className="controlli-punti">
        {stato.giocatoriInOrdine.map((g, i) => (
          <div
            key={g.id}
            className={'controllo-giocatore' + (stato.turno?.id === g.id ? ' di-turno' : '')}
            style={{ '--colore': g.colore }}
          >
            <div className="controllo-nome">
              <FotoDiGioco giocatore={g} azione={azione} />
              <strong>{g.nome}</strong>
              {!g.connesso && <em>offline</em>}
              <span className="ordine-giro">
                <button
                  className="bottone minuscolo fantasma"
                  title="prima nel giro"
                  disabled={i === 0}
                  onClick={() => azione('ordine', { idGiocatore: g.id, delta: -1 })}
                >
                  ↑
                </button>
                <button
                  className="bottone minuscolo fantasma"
                  title="dopo nel giro"
                  disabled={i === stato.giocatoriInOrdine.length - 1}
                  onClick={() => azione('ordine', { idGiocatore: g.id, delta: 1 })}
                >
                  ↓
                </button>
              </span>
            </div>
            <div className="controllo-bottoni">
              {[-5, -1, 1, 5].map((d) => (
                <button
                  key={d}
                  className={'bottone minuscolo' + (d < 0 ? ' sbagliato' : ' giusto')}
                  onClick={() => azione('punti', { idGiocatore: g.id, delta: d, motivo: d < 0 ? 'malus' : 'bonus' })}
                >
                  {d > 0 ? '+' + d : d}
                </button>
              ))}
              <button
                className={'bottone minuscolo' + (g.moltiplicatore > 1 ? ' acceso' : ' fantasma')}
                title="La prossima risposta esatta vale il doppio"
                onClick={() => azione('moltiplicatore', { idGiocatore: g.id, valore: g.moltiplicatore > 1 ? 1 : 2 })}
              >
                jolly x2
              </button>
              <button
                className="bottone minuscolo fantasma"
                onClick={() => azione('rimuovi', { idGiocatore: g.id })}
              >
                togli
              </button>
            </div>
          </div>
        ))}
      </div>

      {stato.giocatori.length > 0 && (
        <div className="punti-personalizzati">
          <input
            type="number"
            placeholder="punti"
            value={personalizzato}
            onChange={(e) => setPersonalizzato(e.target.value)}
          />
          <select
            defaultValue=""
            onChange={(e) => {
              const delta = Number(personalizzato);
              if (e.target.value && Number.isFinite(delta) && delta !== 0) {
                azione('punti', { idGiocatore: e.target.value, delta, motivo: 'a mano' });
              }
              e.target.value = '';
              setPersonalizzato('');
            }}
          >
            <option value="">assegna a…</option>
            {stato.giocatori.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}

/**
 * La foto del giocatore, caricabile anche dalla regia: non tutti si mettono
 * a cercarsi una foto dal telefono a serata iniziata.
 */
function FotoDiGioco({ giocatore, azione }) {
  const fileRef = useRef(null);
  const [inCorso, setInCorso] = useState(false);

  async function scegli(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = '';
    if (!file) return;
    setInCorso(true);
    const risposta = await caricaMedia(file);
    setInCorso(false);
    if (risposta.url) azione('avatar', { idGiocatore: giocatore.id, url: risposta.url });
  }

  return (
    <button
      className="foto-di-gioco"
      title={giocatore.avatar ? 'cambia la foto' : 'metti una foto'}
      onClick={() => fileRef.current?.click()}
    >
      {giocatore.avatar
        ? <img src={urlMedia(giocatore.avatar)} alt="" />
        : <span className="pallino" />}
      {inCorso && <span className="caricamento">…</span>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={scegli} />
    </button>
  );
}

function nomeFase(fase) {
  return {
    attesa: 'in attesa',
    preparata: 'domanda pronta, non ancora mostrata',
    aperta: 'buzzer aperti',
    prenotato: 'qualcuno ha prenotato',
    chiusa: 'buzzer chiusi',
    rivelata: 'risposta svelata',
    classifica: 'punteggi a schermo',
  }[fase] ?? fase;
}
