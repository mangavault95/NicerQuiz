import { useState } from 'react';
import ModificaDomanda from './ModificaDomanda.jsx';
import { Area, ComandiElemento, Numero, Scelta, Testo } from './campi.jsx';

const TIPI = [
  { valore: 'secca', nome: 'Domande secche' },
  { valore: 'immagine', nome: 'Immagini che si scoprono' },
  { valore: 'audio', nome: 'Audio' },
  { valore: 'indovinello', nome: 'Indovinelli a indizi' },
  { valore: 'multipla', nome: 'Scelta multipla' },
  { valore: 'tabellone', nome: 'Tabellone a caselle' },
];

const TIPI_CASELLA = TIPI.filter((t) => t.valore !== 'tabellone');

const domandaVuota = (tipo) => {
  if (tipo === 'indovinello') return { indizi: [''], risposta: '' };
  if (tipo === 'multipla') return { testo: '', opzioni: ['', '', '', ''], corretta: 0, risposta: '' };
  return { testo: '', risposta: '' };
};

export default function ModificaRound({ round, onCambia }) {
  const cambia = (patch) => onCambia({ ...round, ...patch });

  function cambiaTipo(tipo) {
    if (tipo === round.tipo) return;
    if (tipo === 'tabellone') {
      cambia({ tipo, colonne: colonneVuote(5, 5), domande: undefined });
    } else {
      cambia({ tipo, colonne: undefined, domande: round.domande?.length ? round.domande : [domandaVuota(tipo)] });
    }
  }

  return (
    <div className="modifica-round">
      <div className="griglia-campi">
        <Testo etichetta="Nome del round" valore={round.nome} onCambia={(v) => cambia({ nome: v })} larghezza={2} />
        <Scelta etichetta="Tipo" valore={round.tipo} onCambia={cambiaTipo} opzioni={TIPI} larghezza={2} />
        <Area
          etichetta="Descrizione"
          righe={2}
          valore={round.descrizione}
          onCambia={(v) => cambia({ descrizione: v })}
          larghezza={4}
          placeholder="Compare sul tabellone prima che il round cominci"
        />

        {round.tipo !== 'tabellone' && (
          <>
            <Numero
              etichetta="Punti"
              min={0}
              valore={round.puntiIniziali ?? round.punti}
              onCambia={(v) => cambia({ puntiIniziali: v, punti: undefined })}
            />
            <Numero
              etichetta="Punti minimi"
              min={0}
              valore={round.puntiMinimi}
              onCambia={(v) => cambia({ puntiMinimi: v })}
              aiuto="Vuoto: i punti non calano"
            />
          </>
        )}

        <Numero
          etichetta="Malus per errore"
          min={0}
          valore={round.puntiErrore}
          onCambia={(v) => cambia({ puntiErrore: v })}
          aiuto="Quanti punti perde chi sbaglia"
        />
        <Numero
          etichetta="Secondi"
          min={0}
          valore={round.secondi}
          onCambia={(v) => cambia({ secondi: v })}
          aiuto="Vuoto: nessun conto alla rovescia"
        />
        <Numero
          etichetta="Scopri ogni (ms)"
          min={0}
          step={100}
          valore={round.intervalloMs}
          onCambia={(v) => cambia({ intervalloMs: v })}
          aiuto="Vuoto: si avanza a mano"
        />
      </div>

      {round.tipo === 'tabellone'
        ? <ModificaTabellone round={round} cambia={cambia} />
        : <ElencoDomande round={round} cambia={cambia} />}
    </div>
  );
}

// ------------------------------------------------------- domande in fila

function ElencoDomande({ round, cambia }) {
  const domande = round.domande ?? [];
  const [scelta, setScelta] = useState(0);

  const scriviDomande = (nuove) => cambia({ domande: nuove });
  const cambiaDomanda = (i, nuova) => scriviDomande(domande.map((d, j) => (j === i ? nuova : d)));

  const sposta = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= domande.length) return;
    const nuove = [...domande];
    [nuove[i], nuove[j]] = [nuove[j], nuove[i]];
    scriviDomande(nuove);
    setScelta(j);
  };

  return (
    <div className="blocco-domande">
      <div className="titolo-con-azione">
        <h3>Domande ({domande.length})</h3>
        <button
          type="button"
          className="bottone minuscolo"
          onClick={() => { scriviDomande([...domande, domandaVuota(round.tipo)]); setScelta(domande.length); }}
        >
          aggiungi domanda
        </button>
      </div>

      <ol className="elenco-modifica">
        {domande.map((d, i) => (
          <li key={i} className={i === scelta ? 'corrente' : ''}>
            <button type="button" className="voce-modifica" onClick={() => setScelta(i)}>
              <span className="numero">{i + 1}</span>
              <span className="etichetta">{etichettaDomanda(d, round.tipo)}</span>
            </button>
            <ComandiElemento
              indice={i}
              totale={domande.length}
              onSposta={(delta) => sposta(i, delta)}
              onDuplica={() => scriviDomande([...domande.slice(0, i + 1), structuredClone(d), ...domande.slice(i + 1)])}
              onTogli={() => {
                scriviDomande(domande.filter((_, j) => j !== i));
                setScelta((s) => Math.max(0, s > i ? s - 1 : s));
              }}
            />
          </li>
        ))}
      </ol>

      {domande[scelta] && (
        <div className="riquadro-domanda">
          <ModificaDomanda
            domanda={domande[scelta]}
            round={round}
            tipo={round.tipo}
            onCambia={(nuova) => cambiaDomanda(scelta, nuova)}
          />
        </div>
      )}
    </div>
  );
}

function etichettaDomanda(d, tipo) {
  if (tipo === 'indovinello') return d.indizi?.[0] || d.risposta || 'senza indizi';
  return d.testo || d.risposta || (d.media ? d.media.split('/').pop() : 'da riempire');
}

// ------------------------------------------------------------ tabellone

const colonneVuote = (quante, righe) =>
  Array.from({ length: quante }, (_, i) => ({
    titolo: 'Argomento ' + (i + 1),
    caselle: Array.from({ length: righe }, (_, r) => ({ ...domandaVuota('secca'), valore: (r + 1) * 100 })),
  }));

function ModificaTabellone({ round, cambia }) {
  const colonne = round.colonne ?? [];
  const righe = Math.max(0, ...colonne.map((c) => c.caselle?.length ?? 0));
  const [scelta, setScelta] = useState({ colonna: 0, riga: 0 });

  const scriviColonne = (nuove) => cambia({ colonne: nuove });

  const cambiaCasella = (iColonna, iRiga, nuova) =>
    scriviColonne(colonne.map((c, j) =>
      j !== iColonna ? c : { ...c, caselle: c.caselle.map((k, r) => (r === iRiga ? nuova : k)) }));

  const aggiungiColonna = () =>
    scriviColonne([...colonne, {
      titolo: 'Argomento ' + (colonne.length + 1),
      caselle: Array.from({ length: righe || 5 }, (_, r) => ({ ...domandaVuota('secca'), valore: (r + 1) * 100 })),
    }]);

  const togliColonna = (i) => {
    scriviColonne(colonne.filter((_, j) => j !== i));
    setScelta({ colonna: 0, riga: 0 });
  };

  // Le righe si aggiungono e si tolgono su tutte le colonne insieme: una
  // griglia storta e' solo un modo per sbagliare i punteggi.
  const aggiungiRiga = () =>
    scriviColonne(colonne.map((c) => ({
      ...c,
      caselle: [...c.caselle, { ...domandaVuota('secca'), valore: (c.caselle.length + 1) * 100 }],
    })));

  const togliRiga = () =>
    scriviColonne(colonne.map((c) => ({ ...c, caselle: c.caselle.slice(0, -1) })));

  const cambiaValoreRiga = (iRiga, valore) =>
    scriviColonne(colonne.map((c) => ({
      ...c,
      caselle: c.caselle.map((k, r) => (r === iRiga ? { ...k, valore } : k)),
    })));

  const casella = colonne[scelta.colonna]?.caselle?.[scelta.riga];

  return (
    <div className="blocco-domande">
      <div className="titolo-con-azione">
        <h3>Il tabellone ({colonne.length} × {righe})</h3>
        <div className="comandi-elemento">
          <button type="button" className="bottone minuscolo" onClick={aggiungiColonna}>+ colonna</button>
          <button type="button" className="bottone minuscolo" onClick={aggiungiRiga}>+ riga</button>
          <button type="button" className="bottone minuscolo fantasma" onClick={togliRiga} disabled={righe <= 1}>− riga</button>
        </div>
      </div>

      <div className="editor-tabellone" style={{ gridTemplateColumns: `70px repeat(${colonne.length}, minmax(0, 1fr))` }}>
        <span />
        {colonne.map((colonna, i) => (
          <div key={i} className="testa-colonna">
            <input
              value={colonna.titolo ?? ''}
              placeholder="Argomento"
              onChange={(e) => scriviColonne(colonne.map((c, j) => (j === i ? { ...c, titolo: e.target.value } : c)))}
            />
            <button
              type="button"
              className="bottone minuscolo fantasma"
              onClick={() => togliColonna(i)}
              disabled={colonne.length <= 1}
            >
              togli
            </button>
          </div>
        ))}

        {Array.from({ length: righe }, (_, r) => (
          <Riga
            key={r}
            riga={r}
            colonne={colonne}
            scelta={scelta}
            onScegli={setScelta}
            onValore={(v) => cambiaValoreRiga(r, v)}
          />
        ))}
      </div>

      {casella && (
        <div className="riquadro-domanda">
          <div className="titolo-con-azione">
            <h3>
              {colonne[scelta.colonna].titolo || 'Argomento'} · {casella.valore} punti
            </h3>
            <Scelta
              etichetta="Tipo di casella"
              valore={casella.tipo ?? 'secca'}
              onCambia={(v) => cambiaCasella(scelta.colonna, scelta.riga, { ...domandaVuota(v), valore: casella.valore, tipo: v })}
              opzioni={TIPI_CASELLA}
            />
          </div>
          <ModificaDomanda
            domanda={casella}
            round={round}
            tipo={casella.tipo ?? 'secca'}
            onCambia={(nuova) => cambiaCasella(scelta.colonna, scelta.riga, nuova)}
          />
        </div>
      )}
    </div>
  );
}

function Riga({ riga, colonne, scelta, onScegli, onValore }) {
  const valore = colonne[0]?.caselle?.[riga]?.valore ?? 0;
  return (
    <>
      <input
        className="valore-riga"
        type="number"
        min={0}
        step={50}
        value={valore}
        onChange={(e) => onValore(Number(e.target.value) || 0)}
      />
      {colonne.map((colonna, c) => {
        const casella = colonna.caselle?.[riga];
        const piena = Boolean(casella?.risposta || casella?.testo || casella?.media);
        const attiva = scelta.colonna === c && scelta.riga === riga;
        return (
          <button
            key={c}
            type="button"
            className={'casella-editor' + (attiva ? ' scelta' : '') + (piena ? ' piena' : '')}
            onClick={() => onScegli({ colonna: c, riga })}
          >
            <span className="valore">{casella?.valore ?? ''}</span>
            <span className="anteprima-testo">
              {casella?.risposta || casella?.testo || 'vuota'}
            </span>
          </button>
        );
      })}
    </>
  );
}
