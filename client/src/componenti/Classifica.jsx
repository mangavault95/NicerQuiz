/**
 * La classifica in colonna, ordinata per punteggio.
 * La usano la schermata dei punteggi sul tabellone e il pannello di regia.
 * Le icone in fondo al tabellone sono invece PedineGiocatori, che tiene
 * l'ordine del giro proprio per non far saltare i partecipanti da una parte
 * all'altra a ogni risposta.
 */
export default function Classifica({ giocatori = [], evidenzia = null }) {
  if (giocatori.length === 0) {
    return <p className="vuoto">Nessuno si e&apos; ancora collegato.</p>;
  }

  const massimo = Math.max(1, ...giocatori.map((g) => Math.abs(g.punti)));

  return (
    <ol className="classifica">
      {giocatori.map((g, i) => (
        <li
          key={g.id}
          className={evidenzia === g.id ? 'evidenziata' : ''}
          style={{ '--colore': g.colore }}
        >
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
