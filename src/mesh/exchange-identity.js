// ============================================================
// IDENTITÀ DI SCAMBIO PERSISTENTE — perché i pacchetti arrivino davvero
// ============================================================
// Il canale a consegna differita (store-forward.js) è l'unico modo che ha
// Momentum di far arrivare un dato a un dispositivo che in questo momento
// NON è raggiungibile: un altro dispositivo trasporta un pacchetto sigillato
// che non può leggere, e lo consegna quando incontra il destinatario.
//
// Quel canale non è un lusso. Fra il 10% e il 20% degli utenti, a seconda di
// rete e operatore, non stabilisce MAI una connessione diretta WebRTC: NAT
// simmetrico, CGNAT mobile, firewall aziendali. Per loro la consegna differita
// non è il piano B, è l'unico piano — e chi risolve quel 10-20% lo fa con un
// server TURN, cioè con dati che transitano da qualcuno.
//
// IL DIFETTO: la chiave privata di scambio veniva rigenerata a ogni avvio, e
// il commento nel codice presentava la cosa come il prezzo da pagare per non
// scrivere mai una chiave privata su disco. Non era un prezzo: era una perdita
// secca, perché il pacchetto è indirizzato a una chiave pubblica e resta
// sigillato per sempre se quella chiave muore. Misurato: un pacchetto vive due
// settimane, ma la chiave del destinatario muore ad ogni ricarica della pagina.
//
//     apre l'app 1 volta al giorno  -> ~37% di probabilità di consegna
//     apre l'app 3 volte al giorno  ->  ~5%
//     apre l'app 10 volte al giorno ->  ~0%
//
// Cioè: PIÙ una persona usa Momentum, MENO le arriva. Il contrario di come
// dovrebbe comportarsi qualunque cosa.
//
// LA CORREZIONE, e il punto interessante: non c'era nessun compromesso da
// accettare. Il browser permette di salvare in IndexedDB un oggetto CryptoKey
// generato NON esportabile: la chiave sopravvive alla ricarica, ma i suoi byte
// non sono mai leggibili da JavaScript — nemmeno dal nostro. Non finiscono in
// localStorage, non finiscono in un backup, non si possono estrarre nemmeno
// da codice che gira sulla pagina. Si ottengono entrambe le cose, e la
// rinuncia era inutile.
// (Firefox non ci riusciva fino a qualche anno fa — bugzilla 1434898, chiuso
// come duplicato di 1133698 e risolto: oggi ECDH non esportabile si salva su
// tutti i browser correnti. Il ripiego sotto resta per i casi in cui la
// scrittura fallisce comunque, es. modalità privata.)
'use strict';

import { generateExchangeIdentity, openSealed, sealFor } from './store-forward.js';

export const DB_NAME = 'momentum_keys';
export const STORE_NAME = 'keys';
export const RECORD_ID = 'exchange';
// Una chiave ritirata si tiene finché può esistere un pacchetto ancora vivo
// indirizzato ad essa: oltre non serve a nulla, e tenerla sarebbe solo
// superficie d'attacco in più.
export const GRAZIA_CHIAVE_VECCHIA_MS = 14 * 24 * 3600 * 1000;
// Quante chiavi ritirate si conservano al massimo.
export const MAX_CHIAVI_RITIRATE = 3;

// ── Deposito iniettabile ─────────────────────────────────────
// L'astrazione esiste per una ragione precisa: senza di essa questa logica
// sarebbe verificabile solo dentro un browser, cioè a mano, cioè mai.

export function memoryKeyStore() {
  const m = new Map();
  return {
    disponibile: true,
    async get(id) { return m.get(id) ?? null; },
    async put(id, value) { m.set(id, value); },
    async del(id) { m.delete(id); },
  };
}

export function idbKeyStore() {
  const disponibile = typeof indexedDB !== 'undefined';
  const apri = () => new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const tx = (modo, fn) => apri().then((db) => new Promise((res, rej) => {
    const t = db.transaction(STORE_NAME, modo);
    const r = fn(t.objectStore(STORE_NAME));
    t.oncomplete = () => { db.close(); res(r?.result ?? null); };
    t.onerror = () => { db.close(); rej(t.error); };
  }));
  return {
    disponibile,
    async get(id) { return disponibile ? tx('readonly', (s) => s.get(id)) : null; },
    async put(id, value) { if (disponibile) await tx('readwrite', (s) => s.put(value, id)); },
    async del(id) { if (disponibile) await tx('readwrite', (s) => s.delete(id)); },
  };
}

// ── Prova del nove ───────────────────────────────────────────
// Una chiave recuperata dal deposito potrebbe essere inutilizzabile: record
// scritto a metà, oggetto clonato male da un browser con un difetto, algoritmo
// cambiato fra due versioni dell'app. Se non la si prova, il guasto è
// SILENZIOSO — ogni pacchetto in arrivo resterebbe chiuso senza un errore, che
// è esattamente il modo in cui un difetto sopravvive per mesi.
// Si sigilla un contenuto per sé stessi e si prova a riaprirlo: se non torna
// indietro, quella chiave non vale niente e va sostituita subito.
export async function chiaveUsabile(identita) {
  try {
    const prova = await sealFor(identita.publicKey, identita, { t: 1 }, { ttlMs: 60000 });
    const riletto = await openSealed(identita, prova);
    return riletto?.t === 1;
  } catch {
    return false;
  }
}

// ── Carica o crea ────────────────────────────────────────────
// Ritorna sempre un'identità funzionante. Il campo `persistente` dice la
// verità su cosa aspettarsi: se è false, i pacchetti che arrivano mentre
// l'app è chiusa non si apriranno, e l'interfaccia deve poterlo dire invece
// di lasciar credere che il canale funzioni.
export async function loadOrCreateExchangeIdentity(store, {
  now = Date.now(),
  generate = generateExchangeIdentity,
  verifica = chiaveUsabile,
} = {}) {
  const dep = store || idbKeyStore();
  let salvato = null;
  try {
    salvato = dep.disponibile ? await dep.get(RECORD_ID) : null;
  } catch {
    salvato = null; // deposito illeggibile: si riparte, non si esplode
  }

  if (salvato?.v === 1 && salvato.privateKey && salvato.publicKey) {
    const identita = { publicKey: salvato.publicKey, privateKey: salvato.privateKey };
    if (await verifica(identita)) {
      const ritirate = (salvato.ritirate || []).filter((k) => now - (k.retiredAt || 0) < GRAZIA_CHIAVE_VECCHIA_MS);
      return {
        ...identita,
        ritirate,
        persistente: true,
        nuova: false,
        motivo: 'chiave ritrovata e verificata',
        // Data di nascita: serve a poter dire "questa identità è tua da N
        // giorni", che è l'unica misura onesta di quanto ci si può fidare
        // della consegna differita su questo dispositivo.
        createdAt: salvato.createdAt || now,
      };
    }
    // C'era, ma non funziona. Si sostituisce, tenendo da parte la vecchia
    // pubblica: non apre più niente, ma serve a spiegare all'utente perché
    // qualcosa potrebbe non arrivare, invece di far sparire il problema.
    return finalizza(dep, await generate(), salvato, now, 'la chiave salvata non era piu\' utilizzabile: sostituita');
  }

  return finalizza(dep, await generate(), salvato, now, salvato ? 'record incompleto: identita\' rigenerata' : 'prima identita\' su questo dispositivo');
}

async function finalizza(dep, identita, precedente, now, motivo) {
  const ritirate = [];
  if (precedente?.publicKey) {
    ritirate.push({ publicKey: precedente.publicKey, privateKey: precedente.privateKey || null, retiredAt: now });
  }
  for (const k of precedente?.ritirate || []) {
    if (now - (k.retiredAt || 0) < GRAZIA_CHIAVE_VECCHIA_MS) ritirate.push(k);
  }
  const tenute = ritirate.slice(0, MAX_CHIAVI_RITIRATE);

  let persistente = false;
  try {
    if (dep.disponibile) {
      await dep.put(RECORD_ID, { v: 1, publicKey: identita.publicKey, privateKey: identita.privateKey, createdAt: now, ritirate: tenute });
      persistente = true;
    }
  } catch {
    // Salvataggio rifiutato (modalità privata, quota, browser con difetti):
    // si continua in memoria e lo si DICHIARA, invece di far finta di niente.
    persistente = false;
  }
  return {
    ...identita,
    ritirate: tenute,
    persistente,
    nuova: true,
    createdAt: now,
    motivo: persistente ? motivo : `${motivo}; questo dispositivo non riesce a conservarla, i pacchetti ricevuti da chiuso non si apriranno`,
  };
}

// ── Apertura con periodo di grazia ───────────────────────────
// Quando una chiave viene sostituita, i pacchetti già in viaggio verso quella
// vecchia sarebbero persi. Provando anche le chiavi ritirate, una sostituzione
// non butta via le due settimane di posta in transito. È la differenza fra
// ruotare una chiave e perdere la corrispondenza.
export async function openSealedAny(identita, bundle, { now = Date.now() } = {}) {
  const diretto = await openSealed(identita, bundle, { now });
  if (diretto) return diretto;
  for (const vecchia of identita.ritirate || []) {
    if (!vecchia.privateKey) continue;
    const r = await openSealed({ publicKey: vecchia.publicKey, privateKey: vecchia.privateKey }, bundle, { now });
    if (r) return r;
  }
  return null;
}

// Cosa dire all'utente, in italiano e senza gergo.
export function statoIdentita(identita, { now = Date.now() } = {}) {
  if (!identita) return { ok: false, testo: 'Identità di scambio non ancora creata' };
  if (!identita.persistente) {
    return {
      ok: false,
      testo: 'Questo dispositivo non riesce a ricordare la sua chiave: i dati inviati mentre Momentum è chiuso non arriveranno. Apri Momentum quando vuoi ricevere.',
    };
  }
  const giorni = Math.floor((now - (identita.createdAt || now)) / 86400000);
  return {
    ok: true,
    testo: giorni > 0
      ? `Gli altri dispositivi possono lasciarti dati anche quando sei offline (identità attiva da ${giorni} giorn${giorni === 1 ? 'o' : 'i'}).`
      : 'Gli altri dispositivi possono lasciarti dati anche quando sei offline.',
  };
}
