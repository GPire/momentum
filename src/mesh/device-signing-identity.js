// ============================================================
// IDENTITÀ DI FIRMA PERSISTENTE — la chiave che dimostra "sono lo stesso
// dispositivo di prima", non solo "conosco il segreto di scambio"
// ============================================================
// device-trust.js genera una coppia ECDSA per dimostrare il possesso di una
// chiave (le tre parole, la sfida firmata). Ma se quella chiave si
// rigenerasse ad ogni avvio — lo stesso difetto già trovato e corretto per
// l'identità di SCAMBIO in exchange-identity.js — ogni riavvio renderebbe
// "nuovo" un dispositivo già fidato: le tre parole andrebbero riconfermate
// ogni volta, e la lista dei dispositivi fidati non riconoscerebbe più
// nessuno. Stesso difetto, stesso rimedio: un CryptoKey ECDSA generato NON
// esportabile si conserva in IndexedDB — sopravvive al riavvio, i byte
// restano comunque irraggiungibili da qualunque codice, incluso il nostro.
//
// Deliberatamente un modulo A PARTE da exchange-identity.js: sono due chiavi
// con scopi diversi (firma contro accordo di un segreto), tenerle distinte
// è prassi crittografica — mescolarle userebbe la stessa chiave per compiti
// diversi, la cosa che gli standard raccomandano di evitare.
'use strict';

import { generateIdentity } from './device-trust.js';
import { idbKeyStore, memoryKeyStore } from './exchange-identity.js';

export const RECORD_ID = 'signing';

export { idbKeyStore, memoryKeyStore };

// Prova del nove: firma qualcosa e riverifica. Se non torna indietro, la
// chiave recuperata non vale niente — va sostituita, non usata a metà.
async function identitaUsabile(identita) {
  const s = (globalThis.crypto && globalThis.crypto.subtle) || null;
  if (!s || !identita?._pub) return false;
  try {
    const sig = await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, identita.privateKey, new TextEncoder().encode('prova'));
    return await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, identita._pub, sig, new TextEncoder().encode('prova'));
  } catch { return false; }
}

// Ritorna sempre un'identità funzionante. `persistente:false` quando il
// deposito rifiuta la scrittura (modalità privata, browser con difetti):
// l'app continua a funzionare, ma i dispositivi fidati non sopravvivranno
// a un riavvio — va dichiarato, non nascosto.
export async function loadOrCreateDeviceIdentity(store) {
  const dep = store || idbKeyStore();
  let salvato = null;
  try { salvato = dep.disponibile ? await dep.get(RECORD_ID) : null; } catch { salvato = null; }

  if (salvato?.v === 1 && salvato.privateKey && salvato.publicKey) {
    const s = (globalThis.crypto && globalThis.crypto.subtle) || null;
    let pub = null;
    try { pub = s && await s.importKey('raw', Uint8Array.from(atob(salvato.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']); } catch { pub = null; }
    const identita = { publicKey: salvato.publicKey, privateKey: salvato.privateKey, _pub: pub };
    if (pub && await identitaUsabile(identita)) {
      return { ...identita, persistente: true, nuova: false };
    }
  }

  const identita = await generateIdentity();
  let persistente = false;
  try {
    if (dep.disponibile) { await dep.put(RECORD_ID, { v: 1, publicKey: identita.publicKey, privateKey: identita.privateKey }); persistente = true; }
  } catch { persistente = false; }
  return { ...identita, persistente, nuova: true };
}
