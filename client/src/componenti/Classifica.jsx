/** La classifica, in versione grande (schermata dei punteggi) o a striscia. */
export default function Classifica({ giocatori = [], striscia = false, evidenzia = null }) {
  if (giocatori.length === 0) {
    return <p className="vuoto">Nessuno si e&apos; ancora collegato.</p>;
  }

  const massimo = Math.max(1, ...giocatori.map((g) => Math.abs(g.punti)));

  if (striscia) {
    return (
      <div className="striscia-punti">
        {giocatori.map((g) => (
          <div
            key={g.id}
            className={
              'pedina' +
              (g.connesso ? '' : ' assente') +
              (evidenzia === g.id ? ' evidenziata' : '')
            }
            style={{ '--colore': g.colore }}
          >
            <span className="pedina-nome">{g.nome}</span>
            <span className="pedina-punti">{g.punti}</span>
            {g.moltiplicatore > 1 && <span className="pedina-jolly">x{g.moltiplicatore}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol className="classifica">
      {giocatori.map((g, i) => (
        <li key={g.id} className={evidenzia === g.id ? 'evidenziata' : ''} style={{ '--colore': g.colore }}>
          <span className="posizione">{i + 1}</span>
          <span className="nome">
            {g.nome}
            {!g.connesso && <em className="assente-nota"> offline</em>}
          </span>
          <span className="barra">
            <span style={{ width: (Math.max(0, g.punti) / massimo) * 100 + '%' }} />
          </span>
          <span className="punti">{g.punti}</span>
        </li>
      ))}
    </ol>
  );
}
