/**
 * La griglia a caselle: una colonna per argomento, una riga per difficolta'.
 * Piu' si scende, piu' la casella vale.
 *
 * Sul tabellone e' solo da guardare; in regia `onScegli` la rende cliccabile,
 * ed e' cosi' che il presentatore apre una domanda.
 */
export default function GrigliaTabellone({ griglia, onScegli = null, compatta = false }) {
  if (!griglia) return null;
  const cliccabile = typeof onScegli === 'function';

  return (
    <div className={'griglia-tabellone' + (compatta ? ' compatta' : '')}>
      <div
        className="griglia-colonne"
        style={{ gridTemplateColumns: `repeat(${griglia.colonne.length}, minmax(0, 1fr))` }}
      >
        {griglia.colonne.map((colonna, i) => (
          <div key={i} className="colonna-tabellone">
            <div className="argomento">{colonna.titolo}</div>
            {colonna.caselle.map((casella) => {
              const stato =
                (casella.usata ? ' usata' : '') + (casella.scelta ? ' scelta' : '');
              const Elemento = cliccabile && !casella.usata ? 'button' : 'div';
              return (
                <Elemento
                  key={casella.indice}
                  className={'casella' + stato}
                  onClick={cliccabile && !casella.usata ? () => onScegli(casella.indice) : undefined}
                >
                  {casella.usata ? '' : casella.valore}
                </Elemento>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
