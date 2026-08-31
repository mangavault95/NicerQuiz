import { useEffect, useRef, useState } from 'react';
import { URL_SERVER, urlMedia } from '../../rete.js';

/**
 * Scelta di una foto o di una traccia: si carica dal computer oppure si
 * ripesca fra quelle gia' caricate. Il file viaggia come data URL, cosi'
 * l'anteprima e' immediata e il server non ha bisogno di gestire il multipart.
 */
export default function SceltaMedia({ valore, onCambia, tipo = 'immagine' }) {
  const [libreria, setLibreria] = useState([]);
  const [apertaLibreria, setApertaLibreria] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!apertaLibreria) return;
    fetch(URL_SERVER + '/api/media')
      .then((r) => r.json())
      .then((elenco) => setLibreria(elenco.filter((m) => m.tipo === tipo)))
      .catch(() => setLibreria([]));
  }, [apertaLibreria, tipo]);

  async function carica(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = '';
    if (!file) return;

    setInCorso(true);
    setErrore(null);
    try {
      const dati = await new Promise((risolvi, rifiuta) => {
        const lettore = new FileReader();
        lettore.onload = () => risolvi(lettore.result);
        lettore.onerror = () => rifiuta(new Error('lettura fallita'));
        lettore.readAsDataURL(file);
      });

      const risposta = await fetch(URL_SERVER + '/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: file.name, dati }),
      }).then((r) => r.json());

      if (risposta.errore) setErrore(risposta.errore);
      else onCambia(risposta.url);
    } catch {
      setErrore('Non sono riuscito a caricare il file');
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="scelta-media">
      <span className="campo-etichetta">{tipo === 'audio' ? 'Traccia audio' : 'Immagine'}</span>

      {valore && (
        <div className="media-scelto">
          {tipo === 'audio' ? (
            <audio src={urlMedia(valore)} controls preload="none" />
          ) : (
            <img src={urlMedia(valore)} alt="" />
          )}
          <code>{valore}</code>
        </div>
      )}

      <div className="comandi-media">
        <button type="button" className="bottone minuscolo" onClick={() => fileRef.current?.click()} disabled={inCorso}>
          {inCorso ? 'carico…' : valore ? 'sostituisci' : 'carica dal computer'}
        </button>
        <button type="button" className="bottone minuscolo fantasma" onClick={() => setApertaLibreria((v) => !v)}>
          {apertaLibreria ? 'chiudi la libreria' : 'scegli fra i caricati'}
        </button>
        {valore && (
          <button type="button" className="bottone minuscolo fantasma" onClick={() => onCambia(undefined)}>
            togli
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept={tipo === 'audio' ? 'audio/*' : 'image/*'}
        onChange={carica}
      />

      {errore && <p className="avviso-errore">{errore}</p>}

      {apertaLibreria && (
        <div className="libreria-media">
          {libreria.length === 0 && <p className="vuoto">Ancora niente di caricato.</p>}
          {libreria.map((m) => (
            <button
              key={m.file}
              type="button"
              className={'voce-libreria' + (m.url === valore ? ' scelta' : '')}
              onClick={() => { onCambia(m.url); setApertaLibreria(false); }}
              title={m.file}
            >
              {m.tipo === 'audio'
                ? <span className="icona-audio">♪</span>
                : <img src={urlMedia(m.url)} alt="" />}
              <span className="nome-media">{m.file}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
