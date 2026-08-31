import { useEffect, useRef, useState } from 'react';
import { urlMedia } from '../rete.js';

/**
 * Le icone dei partecipanti in fondo al tabellone: foto, nome, punteggio.
 *
 * Restano sempre nello stesso ordine (quello del giro): se si riordinassero
 * per punteggio salterebbero da una parte all'altra a ogni risposta e non si
 * capirebbe piu' chi e' chi. Quando i punti cambiano lampeggia lo scarto,
 * cosi' si vede *quanto* ha preso senza dover leggere il totale.
 */
export default function PedineGiocatori({ giocatori = [], evidenzia = null, turno = null }) {
  const precedenti = useRef(new Map());
  const [scarti, setScarti] = useState({});

  useEffect(() => {
    const nuovi = {};
    for (const g of giocatori) {
      const prima = precedenti.current.get(g.id);
      if (prima !== undefined && prima !== g.punti) nuovi[g.id] = g.punti - prima;
      precedenti.current.set(g.id, g.punti);
    }
    if (Object.keys(nuovi).length === 0) return;

    setScarti(nuovi);
    const spegni = setTimeout(() => setScarti({}), 1800);
    return () => clearTimeout(spegni);
  }, [giocatori]);

  if (giocatori.length === 0) {
    return <p className="vuoto nessun-giocatore">Nessuno si e&apos; ancora collegato.</p>;
  }

  return (
    <div className="pedine">
      {giocatori.map((g) => {
        const scarto = scarti[g.id];
        return (
          <div
            key={g.id}
            className={
              'pedina-giocatore' +
              (g.connesso ? '' : ' assente') +
              (evidenzia === g.id ? ' evidenziata' : '') +
              (turno === g.id ? ' di-turno' : '')
            }
            style={{ '--colore': g.colore }}
          >
            <div className="pedina-icona">
              {g.avatar
                ? <img src={urlMedia(g.avatar)} alt="" />
                : <span className="iniziali">{iniziali(g.nome)}</span>}
              {g.moltiplicatore > 1 && <span className="segno-jolly">x{g.moltiplicatore}</span>}
            </div>

            <span className="pedina-nome">{g.nome}</span>

            <span className="pedina-punti">
              {g.punti}
              {scarto !== undefined && (
                <em className={'scarto' + (scarto > 0 ? ' su' : ' giu')}>
                  {scarto > 0 ? '+' + scarto : scarto}
                </em>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function iniziali(nome = '') {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return '?';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}
