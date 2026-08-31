import { useEffect, useState } from 'react';
import { chiedi, useCollegato, useStato } from '../rete.js';
import VistaTabellone from '../componenti/VistaTabellone.jsx';

/** Lo schermo che vedono tutti: nessun comando, solo spettacolo. */
export default function Tabellone({ codiceIniziale }) {
  const stato = useStato();
  const collegato = useCollegato();
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    if (!collegato || !codiceIniziale) return;
    chiedi('tabellone:entra', { codice: codiceIniziale }).then((r) => setErrore(r.errore ?? null));
  }, [collegato, codiceIniziale]);

  if (errore) {
    return (
      <div className="schermo-vuoto">
        <h1>{errore}</h1>
        <p>Controlla il codice della stanza.</p>
      </div>
    );
  }

  if (!stato) {
    return (
      <div className="schermo-vuoto">
        <h1>Collegamento al tabellone…</h1>
      </div>
    );
  }

  return <VistaTabellone stato={stato} />;
}
