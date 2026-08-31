import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * In sviluppo il client gira su :5173 e il server su :3001.
 * In produzione, se il server serve anche il client, basta l'origine corrente.
 * VITE_SERVER ha comunque la precedenza (frontend su Vercel, backend su Render).
 */
export const URL_SERVER =
  import.meta.env.VITE_SERVER ||
  (import.meta.env.DEV ? `http://${location.hostname}:3001` : location.origin);

// Trasporti lasciati ai valori di serie (polling e poi salto a websocket):
// forzando websocket per primo, dietro un proxy che lo blocca la connessione
// non ripiega su nulla e la partita non parte.
export const presa = io(URL_SERVER);

/** Trasforma un percorso media del quiz in URL assoluto verso il server. */
export function urlMedia(percorso) {
  if (!percorso) return null;
  if (/^(https?:|data:|blob:)/.test(percorso)) return percorso;
  return URL_SERVER + (percorso.startsWith('/') ? percorso : '/' + percorso);
}

/** emit con conferma, in versione promessa. */
export function chiedi(evento, dati) {
  return new Promise((risolvi) => {
    presa.timeout(8000).emit(evento, dati, (erroreRete, risposta) => {
      risolvi(erroreRete ? { errore: 'Il server non risponde' } : (risposta ?? {}));
    });
  });
}

/** Lo stato della partita cosi' come arriva dal server. */
export function useStato() {
  const [stato, setStato] = useState(null);
  useEffect(() => {
    const alCambio = (nuovo) => setStato(nuovo);
    presa.on('stato', alCambio);
    return () => presa.off('stato', alCambio);
  }, []);
  return stato;
}

/** True finche' la presa e' collegata: serve per avvisare in caso di caduta. */
export function useCollegato() {
  const [collegato, setCollegato] = useState(presa.connected);
  useEffect(() => {
    const su = () => setCollegato(true);
    const giu = () => setCollegato(false);
    presa.on('connect', su);
    presa.on('disconnect', giu);
    return () => { presa.off('connect', su); presa.off('disconnect', giu); };
  }, []);
  return collegato;
}

/**
 * Carica una foto o una traccia sul server e restituisce { url } oppure
 * { errore }. Il file viaggia come data URL: nessuna dipendenza in piu' per il
 * multipart, e chi carica puo' gia' vedere l'anteprima prima di inviare.
 */
export async function caricaMedia(file) {
  try {
    const dati = await new Promise((risolvi, rifiuta) => {
      const lettore = new FileReader();
      lettore.onload = () => risolvi(lettore.result);
      lettore.onerror = () => rifiuta(new Error('lettura fallita'));
      lettore.readAsDataURL(file);
    });

    return await fetch(URL_SERVER + '/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: file.name, dati }),
    }).then((r) => r.json());
  } catch {
    return { errore: 'Non sono riuscito a caricare il file' };
  }
}

/** Identita' del giocatore: resta nel telefono, cosi' la riconnessione tiene i punti. */
export function identitaGiocatore() {
  let id = localStorage.getItem('nicerquiz:id');
  if (!id) {
    id = 'g_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('nicerquiz:id', id);
  }
  return id;
}

export const ricorda = (chiave, valore) => localStorage.setItem('nicerquiz:' + chiave, valore);
export const ricordato = (chiave) => localStorage.getItem('nicerquiz:' + chiave) ?? '';
