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

function yearOfDate(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.getUTCFullYear() : null;
}

// Un riferimento strutturato è una prova molto più forte del solo importo.
// Non leggiamo numeri dalla descrizione libera: "12" può essere qualunque
// cosa. Accettiamo solo campi che un importatore o il comando vocale ha
// marcato esplicitamente come riferimento alla fattura.
function riferimentoFattura(fattura, movimento) {
  const numero = fattura?.number ?? fattura?.numero;
  const id = fattura?.id ?? fattura?.invoiceId;
  const riferimenti = [
    movimento?.invoiceNumber, movimento?.fatturaNumero, movimento?.numeroFattura,
    movimento?.invoiceNo, movimento?.riferimentoFattura,
  ].filter((value) => value != null).map(norm);
  if (numero != null && riferimenti.includes(norm(numero))) {
    const annoFattura = fattura?.year ?? yearOfDate(fattura?.date);
    const annoMovimento = movimento?.invoiceYear ?? movimento?.annoFattura;
    return annoMovimento == null || annoFattura == null || Number(annoMovimento) === Number(annoFattura);
  }
  const idRiferimenti = [movimento?.invoiceId, movimento?.fatturaId].filter((value) => value != null).map(norm);
  return id != null && idRiferimenti.includes(norm(id));
}

function chiaveMovimento(movimento, indice) {
  return movimento?.id != null
    ? `id:${String(movimento.id)}:${indice}`
    : `data:${movimento.ms}:${indice}`;
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
  tolleranza = 0.05, finestraGiorni = 400, allowPartialPayments = false,
} = {}) {
  const entrate = [];
  const liste = Array.isArray(allTx) ? [allTx] : Object.values(allTx || {});
  let indiceMovimento = 0;
  for (const lista of liste) {
    for (const t of Array.isArray(lista) ? lista : []) {
      if (t?.type !== 'entrata') continue;
      const ms = Date.parse(t.date);
      if (!Number.isFinite(ms) || !(+t.amount > 0)) continue;
      entrate.push({
        ms, amount: +t.amount, description: t.description || '', id: t.id,
        tx: t, key: chiaveMovimento({ ...t, ms }, indiceMovimento++),
      });
    }
  }
  entrate.sort((a, b) => a.ms - b.ms);
  const usati = new Set();

  const incassate = [];
  const parziali = [];
  const nonIncassate = [];

  // Le fatture si processano dalla più VECCHIA: se due fatture hanno lo
  // stesso importo, la più vecchia si prende l'incasso più vecchio — è
  // l'ordine naturale con cui i clienti pagano.
  const fatture = [...(invoices || [])]
    .filter((f) => +f.imponibile > 0 && Number.isFinite(Date.parse(f.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const clienti = new Map();
  for (const f of fatture) {
    const cliente = norm(f.client);
    if (cliente) clienti.set(cliente, (clienti.get(cliente) || 0) + 1);
  }

  for (const f of fatture) {
    const emessaMs = Date.parse(f.date);
    const atteso = +f.imponibile;
    let migliore = null;
    for (const e of entrate) {
      if (usati.has(e.key)) continue;
      if (e.ms < emessaMs) continue;
      if (e.ms > emessaMs + finestraGiorni * DAY_MS) break; // ordinate: oltre non serve cercare
      const scarto = Math.abs(e.amount - atteso) / atteso;
      if (scarto > tolleranza) continue;
      const nomeCombacia = clienteNellaDescrizione(f.client, e.description);
      const riferimento = riferimentoFattura(f, e.tx);
      // Punteggio: il nome del cliente è il segnale forte (un bonifico può
      // avere per caso lo stesso importo, ma non anche lo stesso nome).
      const punteggio = (riferimento ? 220 : 0) + (nomeCombacia ? 100 : 0)
        - scarto * 10 - (e.ms - emessaMs) / DAY_MS / 1000;
      if (!migliore || punteggio > migliore.punteggio) migliore = { e, punteggio, nomeCombacia, riferimento, scarto };
    }
    if (migliore) {
      usati.add(migliore.e.key);
      incassate.push({
        fattura: f,
        incassoMs: migliore.e.ms,
        incassoData: new Date(migliore.e.ms).toISOString().slice(0, 10),
        importoIncassato: migliore.e.amount,
        annoIncasso: new Date(migliore.e.ms).getUTCFullYear(),
        giorniPerIncassare: Math.round((migliore.e.ms - emessaMs) / DAY_MS),
        // Un abbinamento senza il nome del cliente resta plausibile ma non
        // certo: va detto, non nascosto.
        confidenza: migliore.riferimento || migliore.nomeCombacia ? 'alta' : 'media',
        segnali: [
          'importo',
          ...(migliore.riferimento ? ['riferimento-fattura'] : []),
          ...(migliore.nomeCombacia ? ['cliente'] : []),
        ],
      });
    } else {
      // Le rate vengono considerate solo quando il collegamento è verificabile:
      // riferimento esplicito, oppure nome del cliente e una sola fattura
      // aperta per quel cliente. In tutti gli altri casi resta "da verificare".
      const clienteUnico = clienti.get(norm(f.client)) === 1;
      const candidati = allowPartialPayments ? entrate.filter((e) => {
        if (usati.has(e.key) || e.ms < emessaMs || e.ms > emessaMs + finestraGiorni * DAY_MS) return false;
        if (!(e.amount < atteso * (1 - tolleranza))) return false;
        const riferimento = riferimentoFattura(f, e.tx);
        const nomeCombacia = clienteNellaDescrizione(f.client, e.description);
        return riferimento || (clienteUnico && nomeCombacia);
      }).sort((a, b) => a.ms - b.ms) : [];
      let totaleParziale = 0;
      const scelti = [];
      for (const e of candidati) {
        if (totaleParziale + e.amount > atteso * (1 + tolleranza)) continue;
        scelti.push(e);
        totaleParziale += e.amount;
        if (totaleParziale >= atteso * (1 - tolleranza)) break;
      }
      const sogliaParziale = Math.max(0.01, atteso * 0.2);
      if (scelti.length && totaleParziale >= sogliaParziale) {
        for (const e of scelti) usati.add(e.key);
        const pagamenti = scelti.map((e) => ({
          id: e.id, amount: e.amount, date: new Date(e.ms).toISOString().slice(0, 10),
          description: e.description,
        }));
        const residuo = Math.max(0, +(atteso - totaleParziale).toFixed(2));
        const completa = residuo <= atteso * tolleranza;
        const tuttiConRiferimento = scelti.every((e) => riferimentoFattura(f, e.tx));
        parziali.push({
          fattura: f,
          parziale: true,
          pagamenti,
          importoIncassato: +totaleParziale.toFixed(2),
          residuo,
          completa,
          incassoMs: scelti[scelti.length - 1].ms,
          incassoData: new Date(scelti[scelti.length - 1].ms).toISOString().slice(0, 10),
          anniIncasso: [...new Set(pagamenti.map((p) => yearOfDate(p.date)).filter(Boolean))],
          confidenza: tuttiConRiferimento ? 'alta' : 'media',
          segnali: [
            'rate',
            ...(tuttiConRiferimento ? ['riferimento-fattura'] : ['cliente']),
          ],
        });
      } else {
        nonIncassate.push({ fattura: f, emessaMs, giorniDaEmissione: null });
      }
    }
  }
  return { incassate, parziali, nonIncassate, tolleranza, finestraGiorni };
}

// Ricavi PER CASSA di un anno: la somma di ciò che è stato davvero
// incassato in quell'anno, a prescindere da quando è stata emessa la
// fattura. È il numero su cui il forfettario paga le tasse — e su cui si
// misura il tetto.
export function cashBasisRevenue(matched, anno) {
  const intere = (matched?.incassate || [])
    .filter((m) => m.annoIncasso === anno)
    .reduce((s, m) => s + (+m.importoIncassato || 0), 0);
  const rate = (matched?.parziali || []).reduce((s, m) => s + (m.pagamenti || [])
    .filter((p) => yearOfDate(p.date) === anno)
    .reduce((tot, p) => tot + (+p.amount || 0), 0), 0);
  return +(intere + rate).toFixed(2);
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
  const intere = (matched?.nonIncassate || []).map((n) => ({
    ...n,
    giorniDaEmissione: Math.round((now - n.emessaMs) / DAY_MS),
  }));
  const tolleranza = Number.isFinite(Number(matched?.tolleranza)) ? Number(matched.tolleranza) : 0.05;
  const rateAperte = (matched?.parziali || []).flatMap((p) => {
    const atteso = Number(p.fattura?.imponibile);
    const residuo = Number.isFinite(Number(p.residuo))
      ? Math.max(0, Number(p.residuo))
      : Math.max(0, atteso - Number(p.importoIncassato || 0));
    if (!Number.isFinite(atteso) || residuo <= Math.max(0.01, atteso * tolleranza)) return [];
    const emessaMs = Date.parse(p.fattura?.date);
    if (!Number.isFinite(emessaMs)) return [];
    return [{
      ...p,
      parziale: true,
      emessaMs,
      fattura: { ...p.fattura, imponibile: +residuo.toFixed(2) },
      importoOriginale: +atteso.toFixed(2),
      giorniDaEmissione: Math.round((now - emessaMs) / DAY_MS),
    }];
  });
  const aperte = [...intere, ...rateAperte];
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
