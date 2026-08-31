import { useState } from 'react';
import { urlMedia } from '../../rete.js';
import RivelatoreImmagine from '../RivelatoreImmagine.jsx';
import SceltaMedia from './SceltaMedia.jsx';
import { Area, ListaTesti, Numero, Scelta, Testo } from './campi.jsx';

const MODI_IMMAGINE = [
  { valore: 'puzzle', nome: 'Puzzle a tessere' },
  { valore: 'sfocatura', nome: 'Sfocatura che si schiarisce' },
  { valore: 'pixel', nome: 'Pixel che si affinano' },
  { valore: 'zoom', nome: 'Zoom che si allarga' },
];

const VERSI = [
  { valore: 'comparsa', nome: 'Comparsa: si scopre' },
  { valore: 'scomparsa', nome: 'Scomparsa: parte intera e sparisce' },
];

/**
 * Quanti passi ha la rivelazione. Serve solo a dare al cursore dell'anteprima
 * la corsa giusta: la regola che conta e' quella del server (punteggi.js).
 */
function passiDomanda(domanda, round) {
  if (domanda.indizi?.length) return domanda.indizi.length;
  const esplicito = domanda.passi ?? round.passi;
  if (esplicito) return esplicito;
  const modo = domanda.modo ?? round.modo;
  if (modo === 'puzzle') {
    const [c, r] = domanda.griglia ?? round.griglia ?? [4, 3];
    return c * r;
  }
  return 10;
}

export default function ModificaDomanda({ domanda, round, tipo, onCambia }) {
  const cambia = (patch) => onCambia({ ...domanda, ...patch });

  return (
    <div className="modifica-domanda">
      {tipo === 'secca' && (
        <Area etichetta="Domanda" righe={2} valore={domanda.testo} onCambia={(v) => cambia({ testo: v })} larghezza={2} />
      )}

      {tipo === 'multipla' && (
        <>
          <Area etichetta="Domanda" righe={2} valore={domanda.testo} onCambia={(v) => cambia({ testo: v })} larghezza={2} />
          <div className="blocco-largo">
            <ListaTesti
              etichetta="Opzioni"
              valori={domanda.opzioni ?? ['', '', '', '']}
              onCambia={(v) => cambia({ opzioni: v })}
              etichettaAggiungi="Aggiungi un'opzione"
              minimo={2}
            />
            <Scelta
              etichetta="Qual e' quella giusta"
              valore={String(domanda.corretta ?? 0)}
              onCambia={(v) => cambia({ corretta: Number(v) })}
              opzioni={(domanda.opzioni ?? ['', '', '', '']).map((o, i) => ({
                valore: String(i),
                nome: `${'ABCD'[i] ?? i + 1}. ${o || '(vuota)'}`,
              }))}
            />
          </div>
        </>
      )}

      {tipo === 'indovinello' && (
        <div className="blocco-largo">
          <ListaTesti
            etichetta="Indizi, dal piu' vago al piu' facile"
            valori={domanda.indizi ?? ['']}
            onCambia={(v) => cambia({ indizi: v })}
            etichettaAggiungi="Aggiungi un indizio"
            minimo={1}
            numerata
            aiuto="Ogni indizio in piu' fa scendere i punti."
          />
        </div>
      )}

      {(tipo === 'immagine' || tipo === 'audio') && (
        <div className="blocco-largo">
          <SceltaMedia
            tipo={tipo === 'audio' ? 'audio' : 'immagine'}
            valore={domanda.media}
            onCambia={(v) => cambia({ media: v })}
          />
        </div>
      )}

      {tipo === 'immagine' && (
        <>
          <Scelta
            etichetta="Effetto"
            valore={domanda.modo ?? round.modo ?? 'puzzle'}
            onCambia={(v) => cambia({ modo: v })}
            opzioni={MODI_IMMAGINE}
          />
          <Scelta
            etichetta="Verso"
            valore={domanda.verso ?? round.verso ?? 'comparsa'}
            onCambia={(v) => cambia({ verso: v })}
            opzioni={VERSI}
          />
          {(domanda.modo ?? round.modo) === 'puzzle' ? (
            <GrigliaTessere
              valore={domanda.griglia ?? round.griglia ?? [4, 3]}
              onCambia={(v) => cambia({ griglia: v })}
            />
          ) : (
            <Numero
              etichetta="Passi"
              min={2}
              max={40}
              valore={domanda.passi ?? round.passi}
              onCambia={(v) => cambia({ passi: v })}
              aiuto="In quanti scatti si arriva all'immagine pulita."
            />
          )}
          <div className="blocco-largo">
            <AnteprimaRivelazione domanda={domanda} round={round} passi={passiDomanda(domanda, round)} />
          </div>
        </>
      )}

      {tipo === 'audio' && (
        <>
          <Scelta
            etichetta="Effetto"
            valore={domanda.modo ?? round.modo ?? 'normale'}
            onCambia={(v) => cambia({ modo: v })}
            opzioni={[
              { valore: 'normale', nome: 'Normale' },
              { valore: 'distorto', nome: 'Distorto, si schiarisce piano' },
            ]}
          />
          <Numero
            etichetta="Passi"
            min={2}
            max={40}
            valore={domanda.passi ?? round.passi}
            onCambia={(v) => cambia({ passi: v })}
          />
          <Testo
            etichetta="Didascalia sul tabellone"
            valore={domanda.testo}
            onCambia={(v) => cambia({ testo: v })}
            larghezza={2}
            placeholder="facoltativa"
          />
        </>
      )}

      {tipo === 'immagine' && (
        <Testo
          etichetta="Didascalia sul tabellone"
          valore={domanda.testo}
          onCambia={(v) => cambia({ testo: v })}
          larghezza={2}
          placeholder="facoltativa, tipo: di che colore era il cielo?"
        />
      )}

      <Testo
        etichetta="Risposta esatta"
        valore={domanda.risposta}
        onCambia={(v) => cambia({ risposta: v })}
        larghezza={2}
      />

      <div className="blocco-largo">
        <ListaTesti
          etichetta="Accetta anche"
          valori={domanda.accettate ?? []}
          onCambia={(v) => cambia({ accettate: v })}
          etichettaAggiungi="Aggiungi una variante"
          aiuto="Varianti che vuoi ricordarti di accettare. Le vedi solo tu, in regia."
        />
      </div>

      <Area
        etichetta="Note per il presentatore"
        righe={2}
        valore={domanda.note}
        onCambia={(v) => cambia({ note: v })}
        larghezza={2}
        placeholder="il promemoria da leggere se serve"
      />
    </div>
  );
}

function GrigliaTessere({ valore, onCambia }) {
  const [colonne, righe] = valore;
  return (
    <div className="campo-editor">
      <span className="campo-etichetta">Tessere</span>
      <div className="due-numeri">
        <input type="number" min={2} max={10} value={colonne}
          onChange={(e) => onCambia([Number(e.target.value) || 2, righe])} />
        <span>×</span>
        <input type="number" min={2} max={10} value={righe}
          onChange={(e) => onCambia([colonne, Number(e.target.value) || 2])} />
      </div>
      <span className="campo-aiuto">{colonne * righe} tessere in tutto</span>
    </div>
  );
}

/**
 * L'anteprima con il cursore: si trascina e si vede esattamente come si
 * scoprira' in partita. E' lo stesso componente che gira sul tabellone, quindi
 * quello che vedi qui e' quello che vedranno loro.
 */
function AnteprimaRivelazione({ domanda, round, passi }) {
  const [passo, setPasso] = useState(Math.round(passi / 3));

  if (!domanda.media) {
    return <p className="vuoto">Carica un'immagine per vedere l'anteprima dell'effetto.</p>;
  }

  return (
    <div className="anteprima-rivelazione">
      <div className="titolo-con-azione">
        <span className="campo-etichetta">Come si scopre</span>
        <span className="campo-aiuto">passo {Math.min(passo, passi)} di {passi}</span>
      </div>

      <RivelatoreImmagine
        src={urlMedia(domanda.media)}
        modo={domanda.modo ?? round.modo ?? 'puzzle'}
        verso={domanda.verso ?? round.verso ?? 'comparsa'}
        griglia={domanda.griglia ?? round.griglia ?? [4, 3]}
        passo={Math.min(passo, passi)}
        passiTotali={passi}
      />

      <input
        type="range"
        min={0}
        max={passi}
        value={Math.min(passo, passi)}
        onChange={(e) => setPasso(Number(e.target.value))}
      />
    </div>
  );
}
