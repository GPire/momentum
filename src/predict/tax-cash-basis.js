// ============================================================
// TAX-CASH-BASIS — quello che hai FATTURATO non è quello su cui paghi
// ============================================================
// Il regime forfettario tassa per CASSA: contano solo i soldi davvero
// INCASSATI nell'anno, non le fatture emesse (verificato su fonti fiscali
// correnti, 2026-08-05). Conseguenza che quasi nessuno conosce e che manda
// nel panico ogni anno: **il tetto degli 85.000 € si misura sugli incassi**.
// Chi ha fatturato 90.000 € ma incassato 78.000 € NON ha superato il tetto.
//
// Perché questo modulo può esistere solo dentro Momentum: un portale di
// fatturazione vede le fatture ma non il conto; la banca vede il conto ma
// non sa quale fattura ha pagato quel bonifico. Momentum ha entrambi i lati,
// quindi può incrociarli — ed è l'unico posto dove la domanda "quanto ho
// incassato DAVVERO?" ha una risposta.
//
// Onestà (regola #1): l'abbinamento fattura↔incasso è un'INFERENZA, non un
// dato certo (nessun bonifico dice "sono la fattura n. 12"). Ogni
// abbinamento porta la sua confidenza, e quelli deboli sono dichiarati tali
// invece di essere spacciati per certi. Funzioni pure, testabili.
'use strict';

const DAY_MS = 86_400_000;

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Il cliente compare nella descrizione dell'incasso? Basta una parola
// significativa (≥4 lettere) del nome: "Studio Rossi Srl" riconosce
// "bonifico studio rossi", senza pretendere la stringa esatta.
function clienteNellaDescrizione(cliente, descrizione) {
  const paroleCliente = norm(cliente).split(' ').filter((w) => w.length >= 4 && !['srl', 'spa', 'snc', 'sas'].includes(w));
  if (!paroleCliente.length) return false;
  const d = norm(descrizione);
  return paroleCliente.some((w) => d.includes(w));
}

// Abbina ogni fattura emessa a un incasso reale.
// Regole (dichiarate, non nascoste):
//  - l'incasso deve arrivare DOPO l'emissione (mai prima: sarebbe un altro
//    movimento) e entro `finestraGiorni`;
//  - l'importo deve stare entro `tolleranza` dell'imponibile — la forbice
//    assorbe bollo, arrotondamenti e piccole differenze;
//  - un incasso può pagare UNA sola fattura (nessun doppio conteggio);
//  - a parità, vince l'incasso più vicino nel tempo all'emissione.
export function matchInvoicePayments(invoices, allTx, {
  tolleranza = 0.05, finestraGiorni = 400,
} = {}) {
  const entrate = [];
  for (const lista of Object.values(allTx || {})) {
    for (const t of lista || []) {
      if (t?.type !== 'entrata') continue;
      const ms = Date.parse(t.date);
      if (!Number.isFinite(ms) || !(+t.amount > 0)) continue;
      entrate.push({ ms, amount: +t.amount, description: t.description || '', id: t.id });
    }
  }
  entrate.sort((a, b) => a.ms - b.ms);
  const usati = new Set();

  const incassate = [];
  const nonIncassate = [];

  // Le fatture si processano dalla più VECCHIA: se due fatture hanno lo
  // stesso importo, la più vecchia si prende l'incasso più vecchio — è
  // l'ordine naturale con cui i clienti pagano.
  const fatture = [...(invoices || [])]
    .filter((f) => +f.imponibile > 0 && Number.isFinite(Date.parse(f.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  for (const f of fatture) {
    const emessaMs = Date.parse(f.date);
    const atteso = +f.imponibile;
    let migliore = null;
    for (const e of entrate) {
      if (usati.has(e.id ?? e.ms)) continue;
      if (e.ms < emessaMs) continue;
      if (e.ms > emessaMs + finestraGiorni * DAY_MS) break; // ordinate: oltre non serve cercare
      const scarto = Math.abs(e.amount - atteso) / atteso;
      if (scarto > tolleranza) continue;
      const nomeCombacia = clienteNellaDescrizione(f.client, e.description);
      // Punteggio: il nome del cliente è il segnale forte (un bonifico può
      // avere per caso lo stesso importo, ma non anche lo stesso nome).
      const punteggio = (nomeCombacia ? 100 : 0) - scarto * 10 - (e.ms - emessaMs) / DAY_MS / 1000;
      if (!migliore || punteggio > migliore.punteggio) migliore = { e, punteggio, nomeCombacia, scarto };
    }
    if (migliore) {
      usati.add(migliore.e.id ?? migliore.e.ms);
      incassate.push({
        fattura: f,
        incassoMs: migliore.e.ms,
        incassoData: new Date(migliore.e.ms).toISOString().slice(0, 10),
        importoIncassato: migliore.e.amount,
        annoIncasso: new Date(migliore.e.ms).getUTCFullYear(),
        giorniPerIncassare: Math.round((migliore.e.ms - emessaMs) / DAY_MS),
        // Un abbinamento senza il nome del cliente resta plausibile ma non
        // certo: va detto, non nascosto.
        confidenza: migliore.nomeCombacia ? 'alta' : 'media',
      });
    } else {
      nonIncassate.push({ fattura: f, emessaMs, giorniDaEmissione: null });
    }
  }
  return { incassate, nonIncassate };
}

// Ricavi PER CASSA di un anno: la somma di ciò che è stato davvero
// incassato in quell'anno, a prescindere da quando è stata emessa la
// fattura. È il numero su cui il forfettario paga le tasse — e su cui si
// misura il tetto.
export function cashBasisRevenue(matched, anno) {
  return +(matched?.incassate || [])
    .filter((m) => m.annoIncasso === anno)
    .reduce((s, m) => s + m.importoIncassato, 0)
    .toFixed(2);
}

// Fatturato "per competenza" dello stesso anno (le fatture EMESSE), solo
// per mostrare la differenza — non è il numero su cui si pagano le tasse
// nel forfettario, e dirlo è metà del valore di questa funzione.
export function accrualRevenue(invoices, anno) {
  return +(invoices || [])
    .filter((f) => Number.isFinite(Date.parse(f.date)) && new Date(f.date).getUTCFullYear() === anno && +f.imponibile > 0)
    .reduce((s, f) => s + +f.imponibile, 0)
    .toFixed(2);
}

// Lo stato rispetto al tetto forfettario, misurato COME SI DEVE (incassi).
// `ceiling` arriva da tax-rules.js (versionato e aggiornabile), mai scritto
// qui dentro.
export function ceilingStatusByCash(incassato, fatturato, ceiling) {
  const inc = Math.max(0, +incassato || 0);
  const fat = Math.max(0, +fatturato || 0);
  const tetto = +ceiling || 0;
  if (tetto <= 0) return null;
  const pct = Math.round((inc / tetto) * 100);
  const differenza = +(fat - inc).toFixed(2);

  // Il caso che vale l'intero modulo: fatturato oltre il tetto, incassi
  // sotto. Senza questa distinzione la persona crede di essere fuori dal
  // forfettario quando non lo è (o si comporta di conseguenza, che è peggio).
  if (fat > tetto && inc <= tetto) {
    return {
      superato: false, pct, incassato: inc, fatturato: fat, differenza, tetto,
      livello: 'attenzione',
      messaggio: `Hai fatturato ${euro(fat)}, sopra il tetto di ${euro(tetto)} — ma nel forfettario conta quello che INCASSI, e finora hai incassato ${euro(inc)} (${pct}% del tetto). Non l'hai superato. Occhio però: se i ${euro(differenza)} che ti devono arrivano entro dicembre, lo superi.`,
    };
  }
  if (inc > tetto) {
    return {
      superato: true, pct, incassato: inc, fatturato: fat, differenza, tetto,
      livello: 'superato',
      messaggio: `Hai incassato ${euro(inc)}, oltre il tetto di ${euro(tetto)}: dall'anno prossimo passi al regime ordinario. Cambia tutto (IVA, aliquote, adempimenti): parlane col commercialista adesso, non a dicembre.`,
    };
  }
  if (pct >= 80) {
    return {
      superato: false, pct, incassato: inc, fatturato: fat, differenza, tetto,
      livello: 'vicino',
      messaggio: `Sei al ${pct}% del tetto forfettario sugli incassi (${euro(inc)} di ${euro(tetto)})${differenza > 0 ? `, e ti devono ancora ${euro(differenza)}` : ''}. Se ti avvicini troppo, valuta col commercialista se conviene farti pagare a gennaio.`,
    };
  }
  return {
    superato: false, pct, incassato: inc, fatturato: fat, differenza, tetto,
    livello: 'ok',
    messaggio: `Incassato ${euro(inc)}: sei al ${pct}% del tetto forfettario. Nessun problema.`,
  };
}

// Chi non ti paga, e da quanto. Il problema numero uno di chi lavora in
// proprio, e Momentum lo vede senza che nessuno debba segnare niente.
export function unpaidExposure(matched, { now = Date.now(), sogliaRitardoGiorni = 30 } = {}) {
  const aperte = (matched?.nonIncassate || []).map((n) => ({
    ...n,
    giorniDaEmissione: Math.round((now - n.emessaMs) / DAY_MS),
  }));
  const totale = +aperte.reduce((s, a) => s + +a.fattura.imponibile, 0).toFixed(2);
  const inRitardo = aperte.filter((a) => a.giorniDaEmissione > sogliaRitardoGiorni)
    .sort((a, b) => b.giorniDaEmissione - a.giorniDaEmissione);
  const piuVecchia = inRitardo[0] || null;

  return {
    totale,
    numero: aperte.length,
    inRitardo: inRitardo.length,
    piuVecchia,
    aperte,
    messaggio: !aperte.length
      ? 'Nessuna fattura in attesa di pagamento: tutti in pari.'
      : inRitardo.length
        ? `Ti devono ${euro(totale)} da ${aperte.length} fattur${aperte.length === 1 ? 'a' : 'e'}. ${inRitardo.length === 1 ? 'Una è' : `${inRitardo.length} sono`} in ritardo — la più vecchia è ${piuVecchia.fattura.client} da ${piuVecchia.giorniDaEmissione} giorni.`
        : `Ti devono ${euro(totale)} da ${aperte.length} fattur${aperte.length === 1 ? 'a' : 'e'}, tutte ancora nei tempi.`,
  };
}

function euro(n) { return `${Math.round(+n || 0).toLocaleString('it-IT')} €`; }
