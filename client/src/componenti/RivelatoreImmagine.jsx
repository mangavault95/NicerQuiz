import { useEffect, useMemo, useRef } from 'react';

/**
 * Mostra un'immagine rivelandola a poco a poco.
 *
 * Nessuna immagine viene ritagliata o preparata prima: il puzzle e' una griglia
 * di coperchi sopra la foto, la sfocatura e' un filtro CSS, la pixellatura un
 * canvas. Quindi basta caricare la foto originale e cambiare i parametri.
 *
 * verso 'comparsa'  -> si parte da niente e si scopre
 * verso 'scomparsa' -> si parte dalla foto intera e si copre
 */
export default function RivelatoreImmagine({
  src,
  modo = 'puzzle',
  verso = 'comparsa',
  griglia = [4, 3],
  passo = 0,
  passiTotali = 12,
  tutto = false,          // la regia vuole sempre vedere l'immagine intera
}) {
  if (!src) return null;
  if (tutto) {
    return (
      <div className="rivelatore">
        <img className="rivelatore-foto" src={src} alt="" />
      </div>
    );
  }

  if (modo === 'sfocatura') return <Sfocata {...{ src, passo, passiTotali, verso }} />;
  if (modo === 'pixel') return <Pixellata {...{ src, passo, passiTotali, verso }} />;
  if (modo === 'zoom') return <Zoomata {...{ src, passo, passiTotali, verso }} />;
  return <Tessere {...{ src, griglia, passo, verso }} />;
}

// --------------------------------------------------------------- ingranaggi

function semeDa(testo) {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generatore(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordine di scoprimento, sempre lo stesso per la stessa immagine. */
function ordineMescolato(quante, seme) {
  const casuale = generatore(seme);
  const ordine = [...Array(quante).keys()];
  for (let i = ordine.length - 1; i > 0; i--) {
    const j = Math.floor(casuale() * (i + 1));
    [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
  }
  return ordine;
}

const avanzamento = (passo, totali) =>
  totali <= 0 ? 1 : Math.min(1, Math.max(0, passo / totali));

// ------------------------------------------------------------------ tessere

function Tessere({ src, griglia, passo, verso }) {
  const [colonne, righe] = griglia;
  const quante = colonne * righe;

  // rango[i] = quando la tessera i entra in gioco (0 = per prima)
  const rango = useMemo(() => {
    const ordine = ordineMescolato(quante, semeDa(src + ':' + colonne + 'x' + righe));
    const r = new Array(quante);
    ordine.forEach((tessera, posizione) => { r[tessera] = posizione; });
    return r;
  }, [src, colonne, righe, quante]);

  return (
    <div className="rivelatore">
      <img className="rivelatore-foto" src={src} alt="" />
      <div
        className="rivelatore-griglia"
        style={{ gridTemplateColumns: `repeat(${colonne}, 1fr)`, gridTemplateRows: `repeat(${righe}, 1fr)` }}
      >
        {Array.from({ length: quante }, (_, i) => {
          const coperta = verso === 'scomparsa' ? rango[i] < passo : rango[i] >= passo;
          return <span key={i} className={'tessera' + (coperta ? ' coperta' : '')} />;
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- sfocatura

function Sfocata({ src, passo, passiTotali, verso }) {
  const q = avanzamento(passo, passiTotali);
  const quantita = verso === 'scomparsa' ? q : 1 - q;
  const sfocatura = (2 + quantita * 46).toFixed(1);

  return (
    <div className="rivelatore">
      {/* Il bordo sfocato lascerebbe vedere lo sfondo: si allarga e si ritaglia. */}
      <img
        className="rivelatore-foto sfocata"
        src={src}
        alt=""
        style={{ filter: `blur(${sfocatura}px)`, transform: `scale(${1 + quantita * 0.14})` }}
      />
    </div>
  );
}

// ------------------------------------------------------------------- pixel

function Pixellata({ src, passo, passiTotali, verso }) {
  const tela = useRef(null);
  const q = avanzamento(passo, passiTotali);
  const quantita = verso === 'scomparsa' ? q : 1 - q;

  useEffect(() => {
    const canvas = tela.current;
    if (!canvas) return;
    const foto = new Image();
    foto.crossOrigin = 'anonymous';
    let annullato = false;

    foto.onload = () => {
      if (annullato) return;
      const larghezza = 960;
      const altezza = Math.round((foto.naturalHeight / foto.naturalWidth) * larghezza);
      canvas.width = larghezza;
      canvas.height = altezza;

      // Da 6 pixel di larghezza (illeggibile) alla risoluzione piena.
      const passi = Math.max(6, Math.round(6 + (1 - quantita) ** 2 * (larghezza - 6)));
      const ridotta = document.createElement('canvas');
      ridotta.width = passi;
      ridotta.height = Math.max(4, Math.round((altezza / larghezza) * passi));
      ridotta.getContext('2d').drawImage(foto, 0, 0, ridotta.width, ridotta.height);

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, larghezza, altezza);
      ctx.drawImage(ridotta, 0, 0, ridotta.width, ridotta.height, 0, 0, larghezza, altezza);
    };
    foto.src = src;
    return () => { annullato = true; };
  }, [src, quantita]);

  return (
    <div className="rivelatore">
      <canvas className="rivelatore-foto" ref={tela} />
    </div>
  );
}

// -------------------------------------------------------------------- zoom

function Zoomata({ src, passo, passiTotali, verso }) {
  const q = avanzamento(passo, passiTotali);
  const quantita = verso === 'scomparsa' ? q : 1 - q;

  // Il punto su cui si stringe resta lo stesso per tutta la domanda.
  const centro = useMemo(() => {
    const casuale = generatore(semeDa(src + ':zoom'));
    return [25 + casuale() * 50, 25 + casuale() * 50];
  }, [src]);

  const ingrandimento = 1 + quantita * 7;

  return (
    <div className="rivelatore">
      <img
        className="rivelatore-foto"
        src={src}
        alt=""
        style={{
          transform: `scale(${ingrandimento.toFixed(3)})`,
          transformOrigin: `${centro[0].toFixed(1)}% ${centro[1].toFixed(1)}%`,
        }}
      />
    </div>
  );
}
