/** Campi di modulo dell'editor. Tutti controllati, tutti con la stessa forma. */

export function Campo({ etichetta, aiuto, larghezza, children }) {
  // Su schermi stretti la griglia scende a due colonne: "span 4" creerebbe
  // colonne fantasma, quindi la larghezza piena si chiede con 1 / -1.
  const stile = larghezza
    ? { gridColumn: larghezza >= 4 ? '1 / -1' : `span ${larghezza}` }
    : undefined;

  return (
    <label className="campo-editor" style={stile}>
      <span className="campo-etichetta">{etichetta}</span>
      {children}
      {aiuto && <span className="campo-aiuto">{aiuto}</span>}
    </label>
  );
}

export function Testo({ etichetta, aiuto, valore, onCambia, larghezza, ...resto }) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} larghezza={larghezza}>
      <input value={valore ?? ''} onChange={(e) => onCambia(e.target.value)} {...resto} />
    </Campo>
  );
}

export function Area({ etichetta, aiuto, valore, onCambia, righe = 3, larghezza, ...resto }) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} larghezza={larghezza}>
      <textarea rows={righe} value={valore ?? ''} onChange={(e) => onCambia(e.target.value)} {...resto} />
    </Campo>
  );
}

/** Numero che puo' restare vuoto: vuoto significa "usa il valore del round". */
export function Numero({ etichetta, aiuto, valore, onCambia, larghezza, ...resto }) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} larghezza={larghezza}>
      <input
        type="number"
        value={valore ?? ''}
        onChange={(e) => onCambia(e.target.value === '' ? undefined : Number(e.target.value))}
        {...resto}
      />
    </Campo>
  );
}

export function Interruttore({ etichetta, aiuto, valore, onCambia, larghezza }) {
  const stile = larghezza
    ? { gridColumn: larghezza >= 4 ? '1 / -1' : `span ${larghezza}` }
    : undefined;

  return (
    <label className="campo-editor interruttore" style={stile}>
      <span className="riga-interruttore">
        <input type="checkbox" checked={Boolean(valore)} onChange={(e) => onCambia(e.target.checked)} />
        <span className="campo-etichetta">{etichetta}</span>
      </span>
      {aiuto && <span className="campo-aiuto">{aiuto}</span>}
    </label>
  );
}

export function Scelta({ etichetta, aiuto, valore, onCambia, opzioni, larghezza }) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} larghezza={larghezza}>
      <select value={valore ?? ''} onChange={(e) => onCambia(e.target.value)}>
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>{o.nome}</option>
        ))}
      </select>
    </Campo>
  );
}

/** Elenco di righe di testo: indizi, risposte accettate, opzioni. */
export function ListaTesti({ etichetta, aiuto, valori = [], onCambia, etichettaAggiungi = 'Aggiungi', minimo = 0, numerata = false }) {
  const cambia = (i, v) => onCambia(valori.map((x, j) => (j === i ? v : x)));
  const togli = (i) => onCambia(valori.filter((_, j) => j !== i));
  const sposta = (i, delta) => {
    const nuovo = [...valori];
    const j = i + delta;
    if (j < 0 || j >= nuovo.length) return;
    [nuovo[i], nuovo[j]] = [nuovo[j], nuovo[i]];
    onCambia(nuovo);
  };

  return (
    <div className="lista-testi">
      <span className="campo-etichetta">{etichetta}</span>
      {valori.map((valore, i) => (
        <div key={i} className="riga-testo">
          {numerata && <span className="indice-riga">{i + 1}</span>}
          <input value={valore} onChange={(e) => cambia(i, e.target.value)} />
          <button type="button" className="bottone minuscolo fantasma" onClick={() => sposta(i, -1)} disabled={i === 0}>↑</button>
          <button type="button" className="bottone minuscolo fantasma" onClick={() => sposta(i, 1)} disabled={i === valori.length - 1}>↓</button>
          <button
            type="button"
            className="bottone minuscolo fantasma"
            onClick={() => togli(i)}
            disabled={valori.length <= minimo}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="bottone minuscolo" onClick={() => onCambia([...valori, ''])}>
        {etichettaAggiungi}
      </button>
      {aiuto && <span className="campo-aiuto">{aiuto}</span>}
    </div>
  );
}

/** Barra di bottoni per riordinare o togliere un elemento di una lista. */
export function ComandiElemento({ indice, totale, onSposta, onDuplica, onTogli }) {
  return (
    <div className="comandi-elemento">
      <button type="button" className="bottone minuscolo fantasma" onClick={() => onSposta(-1)} disabled={indice === 0}>↑</button>
      <button type="button" className="bottone minuscolo fantasma" onClick={() => onSposta(1)} disabled={indice === totale - 1}>↓</button>
      {onDuplica && (
        <button type="button" className="bottone minuscolo fantasma" onClick={onDuplica}>duplica</button>
      )}
      <button type="button" className="bottone minuscolo fantasma" onClick={onTogli}>togli</button>
    </div>
  );
}
