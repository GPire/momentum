// ============================================================
// LIQUIDAZIONE IVA PERIODICA — la lacuna del regime ordinario
// ============================================================
// Il forfettario (T11 Livello 0/1) è già coperto in profondità (principio di
// cassa, salvadanaio, tetto). Il regime ORDINARIO — chi fattura grandi
// numeri, esplicitamente richiesto fin dall'inizio del piano — restava più
// superficiale: aveva l'aliquota IVA nel calcolo della singola fattura, ma
// non la liquidazione periodica che un titolare IVA in ordinario deve
// davvero versare. Regole verificate dal vivo su fonte ufficiale Agenzia
// delle Entrate (agosto 2026):
//  - Mensile (default): entro il 16 del mese successivo.
//  - Trimestrale: entro il 16 del secondo mese dopo ciascuno dei primi 3
//    trimestri (16 maggio, 20 agosto, 16 novembre) + conguaglio finale entro
//    il 16 marzo dell'anno dopo; il debito trimestrale è maggiorato dell'1%.
//    Ammesso solo sotto 500.000€ di volume d'affari annuo (soglia verificata
//    per servizi/lavoratori autonomi — per chi vende beni la soglia ufficiale
//    è diversa: qui NON la assumiamo, resta un dettaglio da confermare col
//    commercialista, dichiarato esplicitamente).
// LIMITE ONESTO E DICHIARATO (regola #1 del progetto): Momentum oggi non
// registra l'IVA sugli ACQUISTI (nessun campo per l'IVA detraibile sui
// costi) — quindi calcola solo l'IVA A DEBITO (sulle fatture emesse), mai
// finge di conoscere il credito. Il dovuto reale sarà più basso se ci sono
// costi con IVA detraibile: lo si dice sempre, non lo si nasconde.
'use strict';

const IVA_ORDINARIO = 0.22; // stessa aliquota già verificata e usata in tax.js (REGIMI.ordinario.iva)
const SOGLIA_TRIMESTRALE_SERVIZI = 500000;

// Sceglie la periodicità in base al volume d'affari dell'anno PRECEDENTE
// (regola reale: la scelta si fa guardando l'anno prima, non quello in
// corso). Dichiara esplicitamente che vale per servizi/lavoratori autonomi.
export function determinaPeriodicitaIva(volumeAffariAnnoPrecedente = 0) {
  const v = Math.max(0, +volumeAffariAnnoPrecedente || 0);
  if (v <= SOGLIA_TRIMESTRALE_SERVIZI) {
    return { periodicita: 'trimestrale', soglia: SOGLIA_TRIMESTRALE_SERVIZI, nota: 'Sotto la soglia (servizi/lavoratori autonomi): puoi scegliere il trimestrale. Per chi vende beni la soglia ufficiale è diversa — verificalo col commercialista.' };
  }
  return { periodicita: 'mensile', soglia: SOGLIA_TRIMESTRALE_SERVIZI, nota: `Sopra i ${SOGLIA_TRIMESTRALE_SERVIZI.toLocaleString('it-IT')}€ di volume d'affari dell'anno precedente: la liquidazione è mensile.` };
}

function ivaDiFattura(imponibile) {
  return +(Math.max(0, +imponibile || 0) * IVA_ORDINARIO).toFixed(2);
}

// Calcola l'IVA a debito per ogni periodo (mese o trimestre) dell'anno dalle
// fatture EMESSE (competenza — l'IVA è esigibile all'emissione, non
// all'incasso: diverso dal principio di cassa del forfettario, e va detto).
// Ritorna un periodo per volta, con la scadenza vera e la maggiorazione 1%
// se trimestrale (verificata su fonte ufficiale).
export function computeIvaLiquidazione(invoices = [], anno, periodicita = 'mensile') {
  const fattureAnno = (invoices || []).filter(f => f.year === anno && +f.imponibile > 0);
  if (periodicita === 'trimestrale') {
    const trimestri = [
      { n: 1, mesi: [1, 2, 3], scadenza: `${anno}-05-16` },
      { n: 2, mesi: [4, 5, 6], scadenza: `${anno}-08-20` },
      { n: 3, mesi: [7, 8, 9], scadenza: `${anno}-11-16` },
      { n: 4, mesi: [10, 11, 12], scadenza: `${anno + 1}-03-16`, conguaglio: true },
    ];
    return trimestri.map(t => {
      const fatture = fattureAnno.filter(f => t.mesi.includes(new Date(f.date).getMonth() + 1));
      const ivaDebito = +fatture.reduce((s, f) => s + ivaDiFattura(f.imponibile), 0).toFixed(2);
      // Maggiorazione 1% sul debito trimestrale (non sul conguaglio finale,
      // che è già annuale) — regola verificata, non un arrotondamento a caso.
      const maggiorazione = t.conguaglio ? 0 : +(ivaDebito * 0.01).toFixed(2);
      return {
        periodo: `T${t.n} ${anno}`, trimestre: t.n, scadenza: t.scadenza,
        ivaDebito, ivaCreditoNota: 'IVA su acquisti non tracciata: il dovuto reale potrebbe essere più basso.',
        maggiorazione, totaleDaVersare: +(ivaDebito + maggiorazione).toFixed(2),
        numeroFatture: fatture.length,
      };
    });
  }
  // Mensile: 12 periodi, scadenza il 16 del mese successivo.
  return Array.from({ length: 12 }, (_, i) => i + 1).map(mese => {
    const fatture = fattureAnno.filter(f => new Date(f.date).getMonth() + 1 === mese);
    const ivaDebito = +fatture.reduce((s, f) => s + ivaDiFattura(f.imponibile), 0).toFixed(2);
    const meseScadenza = mese === 12 ? 1 : mese + 1;
    const annoScadenza = mese === 12 ? anno + 1 : anno;
    return {
      periodo: `${String(mese).padStart(2, '0')}/${anno}`, mese, scadenza: `${annoScadenza}-${String(meseScadenza).padStart(2, '0')}-16`,
      ivaDebito, ivaCreditoNota: 'IVA su acquisti non tracciata: il dovuto reale potrebbe essere più basso.',
      maggiorazione: 0, totaleDaVersare: ivaDebito,
      numeroFatture: fatture.length,
    };
  });
}

// Solo i periodi con qualcosa da versare e non ancora scaduti da troppo —
// evita di mostrare 12 righe a zero quando l'utente ha fatturato 2 volte.
// `settimaneAllaScadenza`/`daMettereViaASettimana`: PREDITTIVO, non solo
// descrittivo — stesso principio già usato per le scadenze fiscali generali
// (tax-deadlines.js): non solo "quanto devi", ma "quanto metterne via ogni
// settimana per arrivarci senza sorprese".
export function upcomingIvaLiquidazioni(invoices = [], anno, periodicita, { now = new Date() } = {}) {
  const oggi = new Date(now);
  return computeIvaLiquidazione(invoices, anno, periodicita)
    .filter(p => p.totaleDaVersare > 0 && new Date(p.scadenza) >= oggi)
    .sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza))
    .map(p => {
      const giorni = Math.max(1, Math.round((new Date(p.scadenza) - oggi) / 86400000));
      const settimane = Math.max(1, Math.round(giorni / 7));
      return { ...p, giorniAllaScadenza: giorni, daMettereViaASettimana: +(p.totaleDaVersare / settimane).toFixed(2) };
    });
}

// PREDITTIVO: se sei in trimestrale ma stai fatturando a un ritmo che
// supererebbe la soglia entro fine anno, l'anno prossimo passi a mensile
// senza accorgertene — lo stesso principio già usato per il tetto
// forfettario (tax-cash-basis.js), applicato qui alla soglia IVA. Onesto:
// proiezione lineare dichiarata tale, mai una certezza.
export function previsioneSuperamentoSogliaTrimestrale(invoices = [], anno, { now = new Date() } = {}) {
  const oggi = new Date(now);
  const fatturatoYTD = (invoices || [])
    .filter(f => f.year === anno && new Date(f.date) <= oggi)
    .reduce((s, f) => s + (+f.imponibile || 0), 0);
  const inizioAnno = new Date(Date.UTC(anno, 0, 1));
  const giorniTrascorsi = Math.max(1, Math.round((oggi - inizioAnno) / 86400000));
  const proiezione = +(fatturatoYTD * (365 / giorniTrascorsi)).toFixed(2);
  const supera = proiezione > SOGLIA_TRIMESTRALE_SERVIZI;
  return {
    fatturatoYTD: +fatturatoYTD.toFixed(2), proiezioneAnnua: proiezione, supera,
    messaggio: supera
      ? `A questo ritmo fatturerai ~${Math.round(proiezione).toLocaleString('it-IT')}€ quest'anno, sopra i ${SOGLIA_TRIMESTRALE_SERVIZI.toLocaleString('it-IT')}€: dall'anno prossimo la liquidazione IVA diventerebbe mensile invece che trimestrale. Parlane col commercialista prima che ti arrivi a sorpresa.`
      : null,
  };
}
