// ============================================================
// CON-TIMEOUT — perché esiste, e cosa ha rivelato
// ============================================================
// Trovato dal vivo (2026-08-24, non ipotizzato): la CDN "Xet" di Hugging
// Face (us.aws.cdn.hf.co, il backend di storage più recente dietro
// resolve/main/*.onnx) può restare "pending" INDEFINITAMENTE su alcune reti
// — non un errore che un try/catch intercetta, una promise che
// semplicemente non si risolve né si rifiuta mai. Misurato su QUESTA rete:
// oltre 3 minuti senza completarsi, sia per src/ai/local-sentiment.js sia
// per src/ai/semantic-embed.js (già esistente, quindi non un bug nuovo che
// ho introdotto — un rischio latente su ENTRAMBI da quando Hugging Face ha
// spostato i pesi grossi su Xet). Senza un limite esplicito, l'utente che
// attiva un modello opt-in resta bloccato su "scaricamento in corso" per
// sempre, senza sapere se aspettare ancora o se qualcosa è rotto — proprio
// l'opposto del principio del progetto "mai un rifiuto muto".
// 60 secondi non è una misura, è una scelta dichiarata: abbastanza lungo da
// non troncare un download lento ma REALE (82-197MB anche a 1-2MB/s), corto
// abbastanza da non lasciare l'utente ad aspettare un minuto intero prima
// di sapere che qualcosa non va. Una connessione lenta ma viva verrebbe
// comunque interrotta oltre quella soglia — limite onesto, non nascosto.
'use strict';

export function conTimeout(promise, ms, motivo = 'il caricamento ha impiegato troppo tempo') {
  let timer;
  const scaduto = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(motivo)), ms);
  });
  return Promise.race([promise, scaduto]).finally(() => clearTimeout(timer));
}
