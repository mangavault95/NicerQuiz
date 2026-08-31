import { useEffect, useRef, useState } from 'react';

/**
 * Il lettore del round audio. Lo monta solo il tabellone: la musica esce da un
 * solo altoparlante, altrimenti in salotto si sente l'eco di tutti i telefoni.
 *
 * modo 'distorto': la traccia parte impastata dietro un filtro passa-basso che
 * si apre a ogni passo, finche' non e' pulita.
 */
export default function LettoreAudio({
  src,
  inRiproduzione = false,
  passo = 0,
  passiTotali = 10,
  modo = 'normale',
}) {
  const audioRef = useRef(null);
  const contestoRef = useRef(null);
  const filtroRef = useRef(null);
  const [bloccato, setBloccato] = useState(false);

  // Il browser non fa partire l'audio da solo: serve un tocco dell'utente.
  function preparaCatena() {
    if (modo !== 'distorto' || contestoRef.current || !audioRef.current) return;
    const Costruttore = window.AudioContext || window.webkitAudioContext;
    if (!Costruttore) return;
    const contesto = new Costruttore();
    const sorgente = contesto.createMediaElementSource(audioRef.current);
    const filtro = contesto.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 260;
    filtro.Q.value = 0.9;
    sorgente.connect(filtro);
    filtro.connect(contesto.destination);
    contestoRef.current = contesto;
    filtroRef.current = filtro;
  }

  async function avvia() {
    const audio = audioRef.current;
    if (!audio) return;
    preparaCatena();
    try {
      await contestoRef.current?.resume?.();
      await audio.play();
      setBloccato(false);
    } catch {
      setBloccato(true);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (inRiproduzione) avvia();
    else audio.pause();
  }, [inRiproduzione]);

  // Nuova domanda: si riparte dall'inizio.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
  }, [src]);

  // Il filtro si apre in scala logaritmica: cosi' il cambio si sente davvero.
  useEffect(() => {
    const filtro = filtroRef.current;
    if (!filtro) return;
    const q = passiTotali > 0 ? Math.min(1, passo / passiTotali) : 1;
    const frequenza = 260 * Math.pow(20000 / 260, q);
    filtro.frequency.setTargetAtTime(frequenza, contestoRef.current.currentTime, 0.25);
  }, [passo, passiTotali]);

  return (
    <div className={'lettore-audio' + (inRiproduzione ? ' suona' : '')}>
      <audio ref={audioRef} src={src} preload="auto" />

      <div className="onde" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{ animationDelay: (i * 0.07).toFixed(2) + 's' }} />
        ))}
      </div>

      {bloccato && (
        <button className="bottone primario sblocca-audio" onClick={avvia}>
          Tocca per attivare l&apos;audio
        </button>
      )}
    </div>
  );
}
