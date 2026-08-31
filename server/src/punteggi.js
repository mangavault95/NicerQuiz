import { tipoContenuto } from './quiz.js';

// Calcolo dei punti. Tenuto separato dalla macchina a stati della stanza
// perche' le regole di gara sono la cosa che cambiera' piu' spesso.

/**
 * Punti che vale la domanda *in questo istante*.
 *
 * Nel tabellone il valore lo decide la casella (piu' in basso, piu' difficile,
 * piu' punti). Altrove, se la domanda si rivela a passi (tessere del puzzle,
 * indizi, sfocatura che scende) il valore scala da `puntiIniziali` a
 * `puntiMinimi`: chi indovina con mezza immagine prende piu' di chi aspetta.
 */
export function puntiCorrenti(domanda, round, passo) {
  const iniziali =
    domanda.valore ?? domanda.puntiIniziali ?? round.puntiIniziali ?? round.punti ?? 10;
  const minimi = domanda.puntiMinimi ?? round.puntiMinimi ?? iniziali;
  const passi = passiTotali(domanda, round);

  if (passi <= 0 || iniziali === minimi) return iniziali;

  const avanzamento = Math.min(1, Math.max(0, passo / passi));
  return Math.round(iniziali - (iniziali - minimi) * avanzamento);
}

/** Quanti passi di rivelazione ha questa domanda (0 = tutto visibile subito). */
export function passiTotali(domanda, round) {
  if (domanda.indizi?.length) return domanda.indizi.length;

  const esplicito = domanda.passi ?? round.passi;
  if (esplicito) return esplicito;

  const modo = domanda.modo ?? round.modo;
  if (modo === 'puzzle') {
    const [colonne, righe] = domanda.griglia ?? round.griglia ?? [4, 3];
    return colonne * righe;
  }

  const tipo = tipoContenuto(domanda, round);
  if (tipo === 'immagine' || tipo === 'audio') return 10;
  return 0;
}

/** Malus per una risposta sbagliata (sempre negativo o zero). */
export function malusErrore(round, impostazioni = {}) {
  const v = round.puntiErrore ?? impostazioni.puntiErrore ?? 0;
  return v > 0 ? -v : v;
}
