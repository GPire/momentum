// ============================================================
// IL PIANIFICATORE — un registro di capacità che compone
// ============================================================
// La risposta diretta a "sembra if/else". Ogni modulo che sa rispondere a
// QUALCOSA si registra dichiarando: quali operazioni copre (interrogazione.js),
// quale misura produce, e due funzioni pure — `copertura(interrogazione, ctx)`
// che dice SE sa rispondere a QUESTA interrogazione con I DATI disponibili in
// ctx, e `calcola(interrogazione, ctx)` che produce il risultato quando
// copertura ha detto sì.
//
// Il guadagno non è sintattico: oggi collegare un modulo nuovo significa
// aggiungere un altro ramo a una cascata che qa-engine.js/mercato-qa.js già
// fanno crescere una domanda alla volta. Qui un modulo si registra UNA volta
// e risponde a tutte le combinazioni operazione×misura×soggetto per cui
// dichiara copertura — 4 moduli orfani (confronto-titoli.js, titolo-
// causale.js, causale-validita.js, deterioramento.js: 777 righe già scritte
// e già testate, mai raggiungibili prima d'ora) diventano dati raggiungibili
// registrandosi qui, senza toccare una riga della loro logica.
//
// ── L'ONESTÀ CENTRALE: due modi diversi di "non lo so" ──
// Se nessuna capacità copre l'OPERAZIONE/MISURA richiesta, non esiste nessuno
// che sappia rispondere a quel TIPO di domanda: si dice così.
// Se esiste chi sa rispondere a quel tipo ma `copertura` rifiuta questi
// soggetti/dati, è un problema diverso — mancano i dati per QUESTA domanda
// specifica, non manca la capacità in generale — e il messaggio lo distingue.
// Questa distinzione è quello che il piano chiama "dice quale pezzo manca
// invece di 'non ho capito'": un dettaglio che sembra cosmetico e non lo è,
// perché guida cosa fare dopo (aggiungere dati, non aggiungere codice).
'use strict';

import { richiedeConsiglio, MESSAGGIO_RIFIUTO } from './rifiuto-strutturale.js';

let REGISTRO = [];

// Registra una capacità. Convalida la FORMA (non i dati — quello lo decide
// `copertura` a runtime, perché dipende da cosa c'è in ctx in quel momento).
export function registra(capacita) {
  const { nome, operazioni, misura, copertura, calcola } = capacita || {};
  if (typeof nome !== 'string' || !nome.trim()) throw new Error('una capacità richiede un "nome" (stringa non vuota).');
  if (!Array.isArray(operazioni) || !operazioni.length) throw new Error(`"${nome}": serve un array non vuoto di operazioni coperte.`);
  if (typeof misura !== 'string' || !misura.trim()) throw new Error(`"${nome}": serve una "misura" (stringa non vuota).`);
  if (typeof copertura !== 'function') throw new Error(`"${nome}": serve una funzione "copertura(interrogazione, ctx)".`);
  if (typeof calcola !== 'function') throw new Error(`"${nome}": serve una funzione "calcola(interrogazione, ctx)".`);
  if (REGISTRO.some((c) => c.nome === nome)) throw new Error(`una capacità chiamata "${nome}" è già registrata.`);
  REGISTRO.push({ nome, operazioni: operazioni.slice(), misura, copertura, calcola });
  return capacita;
}

export function elencoCapacita() { return REGISTRO.map((c) => ({ nome: c.nome, operazioni: c.operazioni.slice(), misura: c.misura })); }

// Per i test: azzera il registro fra un banco e l'altro, così le capacità
// finte di un test non restano visibili al test successivo.
export function azzeraRegistro() { REGISTRO = []; }

// Il cuore: trova una capacità che copre l'interrogazione con i dati di ctx,
// la esegue. Non lancia mai per "non trovato" — un rifiuto onesto è un
// risultato valido, non un errore del chiamante.
export function pianifica(interrogazione, ctx = {}) {
  // IL PRIMO CONTROLLO ASSOLUTO — stesso principio di qa-engine.js:400.
  // Prima ancora di cercare chi sa rispondere: se l'interrogazione chiede un
  // consiglio o una previsione (rifiuto-strutturale.js), nessuna capacità la
  // riceve mai, per costruzione — non dipende da cosa è registrato oggi né
  // da cosa si registrerà domani.
  if (richiedeConsiglio(interrogazione)) {
    return { risolto: false, motivo: 'rifiuto-strutturale', mancante: MESSAGGIO_RIFIUTO };
  }

  const candidate = REGISTRO.filter((c) => c.operazioni.includes(interrogazione.operazione) && c.misura === interrogazione.misura);

  if (!candidate.length) {
    return {
      risolto: false,
      motivo: 'operazione-sconosciuta',
      mancante: `Nessuna capacità registrata sa fare "${interrogazione.operazione}" su "${interrogazione.misura}".`,
    };
  }

  for (const c of candidate) {
    if (c.copertura(interrogazione, ctx)) {
      return { risolto: true, capacita: c.nome, risultato: c.calcola(interrogazione, ctx) };
    }
  }

  const soggetti = interrogazione.soggetti.length
    ? interrogazione.soggetti.map((s) => `${s.tipo}:${s.id}`).join(', ')
    : 'nessun soggetto specifico';
  return {
    risolto: false,
    motivo: 'dati-insufficienti',
    mancante: `${candidate.map((c) => `"${c.nome}"`).join(' o ')} gestirebbe "${interrogazione.operazione}"/"${interrogazione.misura}", ma non con questi soggetti o questi dati (${soggetti}).`,
  };
}
