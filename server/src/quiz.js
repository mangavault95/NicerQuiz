/**
 * Lettura e controllo dei quiz.
 *
 * Il round "tabellone" si scrive per colonne (una colonna = un argomento), ma
 * il motore di gioco ragiona su una lista piatta di domande: qui le colonne
 * vengono appiattite una volta sola, tenendo da parte riga e colonna di ogni
 * casella per poter ridisegnare la griglia.
 */

export const TIPI_ROUND = ['secca', 'immagine', 'audio', 'indovinello', 'multipla', 'tabellone'];

/** Dentro un tabellone ogni casella puo' essere di un tipo diverso. */
export const TIPI_CONTENUTO = ['secca', 'immagine', 'audio', 'indovinello', 'multipla'];

/**
 * Come si risponde in un round: al buzzer, oppure a turno seguendo l'ordine
 * dei partecipanti. Si sceglie round per round, non una volta per tutte.
 */
export const MODI_RISPOSTA = ['buzzer', 'giro'];

/** Che cosa va mostrato per questa domanda: il tipo della casella, se c'e'. */
export function tipoContenuto(domanda, round) {
  if (!round) return null;
  if (round.tipo !== 'tabellone') return round.tipo;
  return domanda?.tipo && TIPI_CONTENUTO.includes(domanda.tipo) ? domanda.tipo : 'secca';
}

/** Copia del quiz pronta per essere giocata. Non tocca l'originale. */
export function normalizzaQuiz(quiz) {
  const copia = structuredClone(quiz);
  for (const round of copia.round ?? []) {
    if (round.tipo === 'tabellone') appiattisciTabellone(round);
  }
  return copia;
}

function appiattisciTabellone(round) {
  const colonne = round.colonne ?? [];
  const righe = Math.max(0, ...colonne.map((c) => c.caselle?.length ?? 0));
  const domande = [];

  colonne.forEach((colonna, iColonna) => {
    (colonna.caselle ?? []).forEach((casella, iRiga) => {
      domande.push({
        ...casella,
        _colonna: iColonna,
        _riga: iRiga,
        valore: casella.valore ?? valorePredefinito(iRiga),
      });
    });
  });

  round.righe = righe;
  round.domande = domande;
}

const valorePredefinito = (riga) => (riga + 1) * 100;

/** Controlli minimi: meglio scoprire un quiz rotto adesso che a meta' serata. */
export function validaQuiz(quiz) {
  if (!quiz || typeof quiz !== 'object') return 'Quiz mancante';
  if (!quiz.titolo) return 'Manca il titolo del quiz';
  if (!Array.isArray(quiz.round) || quiz.round.length === 0) return 'Nessun round';

  for (const [i, round] of quiz.round.entries()) {
    const dove = `Round ${i + 1}`;
    if (!TIPI_ROUND.includes(round.tipo)) return `${dove}: tipo "${round.tipo}" sconosciuto`;
    if (round.risposte && !MODI_RISPOSTA.includes(round.risposte)) {
      return `${dove}: non so cosa voglia dire rispondere "${round.risposte}"`;
    }

    if (round.tipo === 'tabellone') {
      if (!Array.isArray(round.colonne) || round.colonne.length === 0) {
        return `${dove}: il tabellone non ha colonne`;
      }
      const piene = round.colonne.filter((c) => (c.caselle?.length ?? 0) > 0);
      if (piene.length === 0) return `${dove}: il tabellone non ha nessuna casella`;
      continue;
    }

    if (!Array.isArray(round.domande) || round.domande.length === 0) {
      return `${dove}: nessuna domanda`;
    }
  }
  return null;
}

/** Conto rapido delle domande, tabellone compreso, per l'elenco dei quiz. */
export function contaDomande(quiz) {
  return (quiz.round ?? []).reduce((totale, round) => {
    if (round.tipo === 'tabellone') {
      return totale + (round.colonne ?? []).reduce((n, c) => n + (c.caselle?.length ?? 0), 0);
    }
    return totale + (round.domande?.length ?? 0);
  }, 0);
}
