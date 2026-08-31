import { useEffect, useRef, useState } from 'react';
import { vaiA } from '../App.jsx';
import { URL_SERVER, chiedi, ricorda, ricordato } from '../rete.js';

export default function Ingresso() {
  const [quiz, setQuiz] = useState([]);
  const [errore, setErrore] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const [codice, setCodice] = useState('');
  const [nome, setNome] = useState(ricordato('nome'));
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(URL_SERVER + '/api/quiz')
      .then((r) => r.json())
      .then(setQuiz)
      .catch(() => setErrore('Server non raggiungibile su ' + URL_SERVER));
  }, []);

  async function apriPartita(datiQuiz) {
    setOccupato(true);
    setErrore(null);
    const risposta = await chiedi('regia:crea', { quiz: datiQuiz });
    setOccupato(false);
    if (risposta.errore) return setErrore(risposta.errore);
    vaiA('/regia?c=' + risposta.codice);
  }

  async function apriDaServer(file) {
    try {
      const dati = await fetch(URL_SERVER + '/api/quiz/' + file).then((r) => r.json());
      await apriPartita(dati);
    } catch {
      setErrore('Non riesco a leggere ' + file);
    }
  }

  async function apriDaFile(evento) {
    const file = evento.target.files?.[0];
    if (!file) return;
    try {
      await apriPartita(JSON.parse(await file.text()));
    } catch {
      setErrore('Il file non contiene un JSON valido');
    }
  }

  const codicePulito = codice.trim().toUpperCase();

  return (
    <div className="ingresso">
      <header className="ingresso-testata">
        <h1>NicerQuiz</h1>
        <p>Il tuo quiz show, in salotto o in videochiamata.</p>
      </header>

      {errore && <p className="avviso-errore">{errore}</p>}

      <div className="ingresso-griglia">
        <section className="scheda">
          <h2>Faccio il presentatore</h2>
          <p className="sottotesto">
            Scegli un quiz: si apre una stanza con un codice da dettare agli altri.
          </p>

          <ul className="elenco-quiz">
            {quiz.map((q) => (
              <li key={q.file}>
                <button
                  className="riga-quiz"
                  disabled={occupato || Boolean(q.errore)}
                  onClick={() => apriDaServer(q.file)}
                >
                  <span className="riga-quiz-titolo">{q.titolo}</span>
                  <span className="riga-quiz-dati">
                    {q.errore ? q.errore : `${q.round} round · ${q.domande} domande`}
                  </span>
                </button>
              </li>
            ))}
            {quiz.length === 0 && !errore && <li className="vuoto">Nessun quiz sul server.</li>}
          </ul>

          <button className="bottone primario" onClick={() => vaiA('/editor?f=nuovo')}>
            Crea un quiz
          </button>
          <button className="bottone fantasma" onClick={() => vaiA('/editor')}>
            Modifica i quiz che hai gia&apos;
          </button>
          <button className="bottone fantasma" onClick={() => fileRef.current?.click()}>
            Carica un quiz dal computer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={apriDaFile}
          />
        </section>

        <section className="scheda">
          <h2>Mi collego a una stanza</h2>
          <p className="sottotesto">
            Il codice te lo detta il presentatore.
          </p>

          <label className="campo">
            <span>Codice stanza</span>
            <input
              className="ingresso-codice"
              value={codice}
              maxLength={4}
              placeholder="ABCD"
              onChange={(e) => setCodice(e.target.value.toUpperCase())}
            />
          </label>

          <label className="campo">
            <span>Il tuo nome</span>
            <input
              value={nome}
              maxLength={24}
              placeholder="Come ti chiami"
              onChange={(e) => setNome(e.target.value)}
            />
          </label>

          <button
            className="bottone primario"
            disabled={codicePulito.length !== 4 || !nome.trim()}
            onClick={() => {
              ricorda('nome', nome.trim());
              vaiA('/gioca?c=' + codicePulito);
            }}
          >
            Gioco dal telefono
          </button>

          <button
            className="bottone fantasma"
            disabled={codicePulito.length !== 4}
            onClick={() => vaiA('/tabellone?c=' + codicePulito)}
          >
            Apro il tabellone su questo schermo
          </button>
        </section>
      </div>

      <footer className="ingresso-piede">
        <p>
          <strong>Tabellone</strong> = lo schermo che vedono tutti (condividilo in videochiamata).{' '}
          <strong>Telefono</strong> = solo il pulsante per prenotarsi.
        </p>
      </footer>
    </div>
  );
}
