import { useEffect, useState } from 'react';
import Ingresso from './viste/Ingresso.jsx';
import Regia from './viste/Regia.jsx';
import Tabellone from './viste/Tabellone.jsx';
import Giocatore from './viste/Giocatore.jsx';
import Editor from './viste/Editor.jsx';

/** Navigazione minima: cinque pagine, non serve una libreria. */
export function vaiA(percorso) {
  history.pushState({}, '', percorso);
  dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
  const [percorso, setPercorso] = useState(location.pathname);
  const [ricerca, setRicerca] = useState(location.search);

  useEffect(() => {
    const aggiorna = () => { setPercorso(location.pathname); setRicerca(location.search); };
    addEventListener('popstate', aggiorna);
    return () => removeEventListener('popstate', aggiorna);
  }, []);

  const parametri = new URLSearchParams(ricerca);
  const codice = (parametri.get('c') ?? '').toUpperCase();

  if (percorso.startsWith('/regia')) return <Regia codiceIniziale={codice} />;
  if (percorso.startsWith('/tabellone')) return <Tabellone codiceIniziale={codice} />;
  if (percorso.startsWith('/gioca')) return <Giocatore codiceIniziale={codice} />;
  if (percorso.startsWith('/editor')) return <Editor fileIniziale={parametri.get('f') ?? ''} />;
  return <Ingresso />;
}
