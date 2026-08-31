// Genera una traccia audio di prova (una scala di Do che sale e scende),
// cosi' il round audio funziona senza dover procurarsi un file.
//   node media/crea-audio-demo.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const FREQUENZA = 44100;
const NOTE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const SEQUENZA = [...NOTE, ...NOTE.slice(0, -1).reverse()];
const DURATA_NOTA = 0.42;

const campioni = [];
for (const [i, nota] of SEQUENZA.entries()) {
  const totale = Math.floor(FREQUENZA * DURATA_NOTA);
  for (let n = 0; n < totale; n++) {
    const t = n / FREQUENZA;
    // Inviluppo morbido: niente click all'attacco e alla fine di ogni nota.
    const inviluppo = Math.min(1, n / 900) * Math.min(1, (totale - n) / 2200);
    const onda =
      Math.sin(2 * Math.PI * nota * t) * 0.6 +
      Math.sin(2 * Math.PI * nota * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * nota * 3 * t) * 0.1;
    campioni.push(onda * inviluppo * 0.5 * (i % 2 ? 0.9 : 1));
  }
}

const dati = Buffer.alloc(campioni.length * 2);
campioni.forEach((v, i) => {
  dati.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
});

const intestazione = Buffer.alloc(44);
intestazione.write('RIFF', 0);
intestazione.writeUInt32LE(36 + dati.length, 4);
intestazione.write('WAVE', 8);
intestazione.write('fmt ', 12);
intestazione.writeUInt32LE(16, 16);
intestazione.writeUInt16LE(1, 20);           // PCM
intestazione.writeUInt16LE(1, 22);           // mono
intestazione.writeUInt32LE(FREQUENZA, 24);
intestazione.writeUInt32LE(FREQUENZA * 2, 28);
intestazione.writeUInt16LE(2, 32);
intestazione.writeUInt16LE(16, 34);
intestazione.write('data', 36);
intestazione.writeUInt32LE(dati.length, 40);

const destinazione = path.join(QUI, 'demo-melodia.wav');
writeFileSync(destinazione, Buffer.concat([intestazione, dati]));
console.log('Scritto', destinazione, (dati.length / 1024).toFixed(0) + ' KB');
