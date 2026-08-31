import { useEffect, useState } from 'react';

/**
 * Se il round ha un limite di tempo mostra il conto alla rovescia,
 * altrimenti il tempo trascorso dall'apertura della domanda.
 */
export default function Cronometro({ apertaDa, scadenza, attivo }) {
  const [ora, setOra] = useState(Date.now());

  useEffect(() => {
    if (!attivo) return;
    const battito = setInterval(() => setOra(Date.now()), 100);
    return () => clearInterval(battito);
  }, [attivo]);

  if (!apertaDa) return null;

  if (scadenza) {
    const restano = Math.max(0, scadenza - (attivo ? ora : apertaDa));
    const secondi = restano / 1000;
    return (
      <div className={'cronometro' + (secondi <= 5 ? ' urgente' : '')}>
        {secondi.toFixed(1)}<span className="unita">s</span>
      </div>
    );
  }

  const trascorsi = Math.max(0, (attivo ? ora : Date.now()) - apertaDa) / 1000;
  return (
    <div className="cronometro tenue">
      {trascorsi.toFixed(1)}<span className="unita">s</span>
    </div>
  );
}
