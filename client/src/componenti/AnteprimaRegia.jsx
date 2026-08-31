import { useEffect, useRef, useState } from 'react';
import VistaTabellone from './VistaTabellone.jsx';

// Il palco dell'anteprima ha una misura fissa e poi viene rimpicciolito tutto
// insieme: cosi' il riquadro e' una fotografia fedele del tabellone vero, non
// una sua versione "responsive" che si comporta in un altro modo.
const LARGHEZZA = 1280;
const ALTEZZA = 720;

/** La mini-anteprima dal vivo di quello che vedono i concorrenti. */
export default function AnteprimaRegia({ stato }) {
  const cornice = useRef(null);
  const [fattore, setFattore] = useState(0.3);

  useEffect(() => {
    const elemento = cornice.current;
    if (!elemento) return;
    const osservatore = new ResizeObserver(([voce]) => {
      const larghezza = voce.contentRect.width;
      if (larghezza > 0) setFattore(larghezza / LARGHEZZA);
    });
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  return (
    <div className="anteprima" ref={cornice}>
      <div
        className="anteprima-palco"
        style={{
          width: LARGHEZZA,
          height: ALTEZZA,
          transform: `scale(${fattore})`,
        }}
      >
        <VistaTabellone stato={stato} anteprima />
      </div>
    </div>
  );
}
