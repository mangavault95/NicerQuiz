import { useEffect, useRef, useState } from 'react';
import { vaiA } from '../App.jsx';
import { URL_SERVER, chiedi } from '../rete.js';
import ModificaRound from '../componenti/editor/ModificaRound.jsx';
import { ComandiElemento, Numero } from '../componenti/editor/campi.jsx';

const quizVuoto = () => ({
  titolo: 'Nuovo quiz',
  impostazioni: { puntiErrore: 3 },
  round: [
    {
      nome: 'Round 1',
      tipo: 'secca',
      puntiIniziali: 10,
      domande: [{ testo: '', risposta: '' }],
    },
  ],
});

/** L'editor: si scrive il quiz qui dentro, non piu' a mano nel JSON. */
export default function Editor({ fileIniziale }) {
  const [elenco, setElenco] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [file, setFile] = useState(null);
  const [modificato, setModificato] = useState(false);
  const [roundScelto, setRoundScelto] = useState(0);
  const [errore, setErrore] = useState(null);
  const [messaggio, setMessaggio] = useState(null);
  const importaRef = useRef(null);

  const aggiornaElenco = () =>
    fetch(URL_SERVER + '/api/quiz').then((r) => r.json()).then(setElenco).catch(() => setElenco([]));

  useEffect(() => { aggiornaElenco(); }, []);

  useEffect(() => {
    if (!fileIniziale) return;
    if (fileIniziale === 'nuovo') return apriNuovo();
    apri(fileIniziale);
  }, [fileIniziale]);

  function apriNuovo() {
    setQuiz(quizVuoto());
    setFile(null);
    setRoundScelto(0);
    setModificato(true);
    setErrore(null);
  }

  async function apri(nome) {
    try {
      const dati = await fetch(URL_SERVER + '/api/quiz/' + nome).then((r) => r.json());
      setQuiz(dati);
      setFile(nome);
      setRoundScelto(0);
      setModificato(false);
      setErrore(null);
    } catch {
      setErrore('Non riesco a leggere ' + nome);
    }
  }

  const cambia = (patch) => { setQuiz((q) => ({ ...q, ...patch })); setModificato(true); };

  const cambiaRound = (i, nuovo) =>
    cambia({ round: quiz.round.map((r, j) => (j === i ? nuovo : r)) });

  function spostaRound(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= quiz.round.length) return;
    const nuovi = [...quiz.round];
    [nuovi[i], nuovi[j]] = [nuovi[j], nuovi[i]];
    cambia({ round: nuovi });
    setRoundScelto(j);
  }

  async function salva() {
    setErrore(null);
    const risposta = await fetch(URL_SERVER + '/api/quiz/' + (file ?? 'nuovo'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quiz),
    }).then((r) => r.json());

    if (risposta.errore) return setErrore(risposta.errore);
    setFile(risposta.file);
    setModificato(false);
    setMessaggio('Salvato in ' + risposta.file);
    setTimeout(() => setMessaggio(null), 2500);
    aggiornaElenco();
    history.replaceState({}, '', '/editor?f=' + risposta.file);
  }

  async function gioca() {
    const risposta = await chiedi('regia:crea', { quiz });
    if (risposta.errore) return setErrore(risposta.errore);
    vaiA('/regia?c=' + risposta.codice);
  }

  async function elimina() {
    if (!file) return;
    await fetch(URL_SERVER + '/api/quiz/' + file, { method: 'DELETE' });
    setQuiz(null);
    setFile(null);
    aggiornaElenco();
  }

  function esporta() {
    const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
    const collegamento = document.createElement('a');
    collegamento.href = URL.createObjectURL(blob);
    collegamento.download = (file ?? 'quiz') + (file ? '' : '.json');
    collegamento.click();
    URL.revokeObjectURL(collegamento.href);
  }

  async function importa(evento) {
    const scelto = evento.target.files?.[0];
    evento.target.value = '';
    if (!scelto) return;
    try {
      setQuiz(JSON.parse(await scelto.text()));
      setFile(null);
      setRoundScelto(0);
      setModificato(true);
      setErrore(null);
    } catch {
      setErrore('Il file non contiene un JSON valido');
    }
  }

  return (
    <div className="editor">
      <header className="editor-testata">
        <div className="editor-identita">
          <button className="bottone fantasma" onClick={() => vaiA('/')}>← NicerQuiz</button>
          {quiz && (
            <>
              <input
                className="titolo-quiz"
                value={quiz.titolo ?? ''}
                onChange={(e) => cambia({ titolo: e.target.value })}
                placeholder="Titolo del quiz"
              />
              {modificato && <span className="pallino-modifica" title="modifiche non salvate" />}
            </>
          )}
        </div>

        {quiz && (
          <div className="editor-comandi">
            {messaggio && <span className="messaggio-ok">{messaggio}</span>}
            <button className="bottone" onClick={esporta}>esporta</button>
            {file && <button className="bottone fantasma" onClick={elimina}>elimina</button>}
            <button className="bottone" onClick={gioca}>prova a giocarlo</button>
            <button className="bottone primario" onClick={salva} disabled={!modificato}>
              {modificato ? 'Salva' : 'Salvato'}
            </button>
          </div>
        )}
      </header>

      {errore && <p className="avviso-errore errore-editor">{errore}</p>}

      <div className="editor-corpo">
        <aside className="colonna editor-elenco">
          <div className="titolo-con-azione">
            <h2>I tuoi quiz</h2>
            <button className="bottone minuscolo" onClick={apriNuovo}>nuovo</button>
          </div>

          <ul className="elenco-quiz">
            {elenco.map((q) => (
              <li key={q.file}>
                <button
                  className={'riga-quiz' + (q.file === file ? ' corrente' : '')}
                  onClick={() => apri(q.file)}
                >
                  <span className="riga-quiz-titolo">{q.titolo}</span>
                  <span className="riga-quiz-dati">
                    {q.errore ?? `${q.round} round · ${q.domande} domande`}
                  </span>
                </button>
              </li>
            ))}
            {elenco.length === 0 && <li className="vuoto">Ancora nessun quiz.</li>}
          </ul>

          <button className="bottone fantasma" onClick={() => importaRef.current?.click()}>
            importa un JSON
          </button>
          <input ref={importaRef} type="file" accept="application/json,.json" hidden onChange={importa} />

          {quiz && (
            <>
              <h2>Round</h2>
              <ol className="elenco-modifica">
                {quiz.round.map((r, i) => (
                  <li key={i} className={i === roundScelto ? 'corrente' : ''}>
                    <button type="button" className="voce-modifica" onClick={() => setRoundScelto(i)}>
                      <span className="numero">{i + 1}</span>
                      <span className="etichetta">{r.nome || 'senza nome'}</span>
                    </button>
                    <ComandiElemento
                      indice={i}
                      totale={quiz.round.length}
                      onSposta={(delta) => spostaRound(i, delta)}
                      onDuplica={() => cambia({
                        round: [...quiz.round.slice(0, i + 1), structuredClone(r), ...quiz.round.slice(i + 1)],
                      })}
                      onTogli={() => {
                        if (quiz.round.length <= 1) return;
                        cambia({ round: quiz.round.filter((_, j) => j !== i) });
                        setRoundScelto((s) => Math.max(0, s > i ? s - 1 : s));
                      }}
                    />
                  </li>
                ))}
              </ol>
              <button
                className="bottone minuscolo"
                onClick={() => {
                  cambia({ round: [...quiz.round, { nome: 'Round ' + (quiz.round.length + 1), tipo: 'secca', puntiIniziali: 10, domande: [{ testo: '', risposta: '' }] }] });
                  setRoundScelto(quiz.round.length);
                }}
              >
                aggiungi round
              </button>

              <h2>Regole generali</h2>
              <div className="griglia-campi">
                <Numero
                  etichetta="Malus per errore"
                  min={0}
                  valore={quiz.impostazioni?.puntiErrore}
                  onCambia={(v) => cambia({ impostazioni: { ...quiz.impostazioni, puntiErrore: v } })}
                  aiuto="Vale dove il round non dice altro"
                  larghezza={4}
                />
              </div>
            </>
          )}
        </aside>

        <main className="colonna editor-lavoro">
          {!quiz && (
            <div className="cartello">
              <h1>Scegli un quiz, o creane uno nuovo</h1>
              <p>Da qui costruisci i round, carichi foto e audio e provi gli effetti.</p>
              <button className="bottone primario" onClick={apriNuovo}>Nuovo quiz</button>
            </div>
          )}
          {quiz?.round?.[roundScelto] && (
            <ModificaRound
              round={quiz.round[roundScelto]}
              onCambia={(nuovo) => cambiaRound(roundScelto, nuovo)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
