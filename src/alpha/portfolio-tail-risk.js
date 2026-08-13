// ============================================================
// IL RISCHIO DI CODA DEL **TUO** PORTAFOGLIO, non del mercato in generale
// ============================================================
// Tutti i pannelli di mercato costruiti finora (stress, posizionamento, tassi,
// causale) hanno un limite che li rende inutili a chi investe davvero:
// mostrano lo STESSO identico numero a chiunque apra l'app. "Il mercato e'
// nervoso" e' un'informazione che un investitore ha gia', gratis, ovunque.
//
// La domanda che nessuna app di finanza personale risponde e' l'altra:
// **quanto perde il MIO portafoglio, con i MIEI pesi, quando le cose vanno
// male davvero** — e quanto di quella perdita e' colpa di come e' fatto
// invece che del mercato.
//
// COSA SI USA, e perche' proprio questo:
//
//  · EXPECTED SHORTFALL al 97,5% (market-stress.js), non il VaR. Il VaR dice
//    "quanto perdo nel 2,5% peggiore" e tace su quanto si perde OLTRE quella
//    soglia, che in un crollo e' l'unica cosa che conta. Basilea III (FRTB)
//    ha sostituito il VaR con l'ES per le banche proprio per questo: qui si
//    usa lo stesso standard, sullo stesso livello, per una persona.
//
//  · BOOTSTRAP A BLOCCHI MULTIVARIATO su 331 mesi reali di nove settori
//    (1999-2026: dot-com, 2008, COVID, 2022 tutti dentro). Si ricampionano
//    gli STESSI istanti per tutti i settori insieme — se si ricampionasse
//    ogni settore per conto suo si distruggerebbe la correlazione e usciebbero
//    scenari in cui i settori crollano a turno invece che insieme, cioe' il
//    contrario di quello che succede nei crolli veri.
//
//  · IL CONFRONTO CON UN PORTAFOGLIO DIVERSIFICATO, sugli STESSI scenari.
//    E' la parte che rende il numero azionabile invece che spaventoso: da
//    solo, "il tuo ES e' -14%" non dice niente a nessuno. Confrontato con il
//    -9% di un equipesato sugli stessi identici mesi simulati, diventa **il
//    prezzo misurato della concentrazione** — un numero che si puo' decidere
//    se pagare o no.
//
//  · IL CONTRIBUTO ALLA CODA per settore: nei mesi peggiori, quale parte del
//    portafoglio ha prodotto la perdita. Risponde a "DOVE sono esposto" con
//    una misura invece che con una torta di percentuali, che mostra dove sono
//    i SOLDI e non dove e' il RISCHIO — e sono due cose diverse.
//
// ONESTA' SULLA COPERTURA (la parte che rende il resto credibile). Il pannello
// storico contiene nove settori azionari USA e NIENT'ALTRO. Cripto,
// obbligazioni, immobili e azioni di cui non si conosce il settore NON sono
// rappresentabili qui. Mostrare l'ES della sola parte azionaria lasciando
// credere che sia quello dell'intero patrimonio sarebbe la bugia piu' comoda
// e piu' grave di tutto questo file: ogni risultato dichiara quanta parte del
// portafoglio ha davvero misurato, e sotto una soglia minima si rifiuta di
// rispondere invece di rispondere male.
//
// NON E' UN CONSIGLIO. Qui non si dice mai cosa comprare o vendere: si misura
// cosa c'e' e quanto costa in coda. La differenza non e' formale — un consiglio
// personalizzato di investimento e' un'attivita' regolamentata, e un'app che lo
// da' senza esserlo mette nei guai chi la usa prima di chi la scrive.
//
// Funzioni PURE (nessun DOM, nessuna rete, casualita' iniettabile via seme).
'use strict';

import { bootstrapPanel, rendimentoPortafoglio, expectedShortfall, LIVELLO_ES } from './market-stress.js';
import { PANNELLO_SETTORI } from './historical-panel.js';
import { makeRng } from './forced-sale-risk.js';

export const SETTORI = PANNELLO_SETTORI.map((s) => s.simbolo);
export const NOMI_SETTORI = Object.fromEntries(PANNELLO_SETTORI.map((s) => [s.simbolo, s.nome]));

// Sotto questa quota di portafoglio misurata, il risultato non si mostra: un
// ES calcolato su un terzo del patrimonio, presentato come "il tuo rischio",
// sarebbe piu' fuorviante del silenzio.
export const COPERTURA_MINIMA = 0.5;

// Gli ETF settoriali SPDR sono ESATTAMENTE le serie del pannello: mappatura
// certa, nessuna approssimazione.
const ETF_SETTORIALI = new Set(SETTORI);

// Indici ampi -> ripartiti sui nove settori in parti uguali. L'approssimazione
// e' dichiarata e non e' arbitraria: il "mercato" nel pannello storico E'
// definito come la media equipesata dei nove settori (market-stress.js,
// rendimentoMercato), quindi un indice ampio mappato cosi' e' coerente con la
// definizione che il motore usa gia' per tutto il resto.
// QQQ NON e' in questo elenco di proposito: e' fortemente sbilanciato sulla
// tecnologia, e spalmarlo in parti uguali ne travisierebbe il rischio proprio
// nella direzione che questo modulo dovrebbe misurare.
const INDICI_AMPI = new Set(['SPY', 'VOO', 'IVV', 'VTI', 'SPLG', 'ITOT', 'SPTM']);

// I nomi di settore che Alpha Vantage restituisce (asset-overview.js, campo
// Sector) verso i simboli del pannello. Solo le corrispondenze NON ambigue:
// una mappatura forzata dove i due schemi non si sovrappongono produrrebbe un
// peso sbagliato con l'aria di essere preciso.
const SETTORE_DA_NOME = {
  TECHNOLOGY: 'XLK',
  'INFORMATION TECHNOLOGY': 'XLK',
  ENERGY: 'XLE',
  FINANCE: 'XLF',
  FINANCIALS: 'XLF',
  'FINANCIAL SERVICES': 'XLF',
  UTILITIES: 'XLU',
  HEALTHCARE: 'XLV',
  'HEALTH CARE': 'XLV',
  'LIFE SCIENCES': 'XLV',
  'BASIC MATERIALS': 'XLB',
  MATERIALS: 'XLB',
  INDUSTRIALS: 'XLI',
  'CONSUMER STAPLES': 'XLP',
  'CONSUMER DEFENSIVE': 'XLP',
  'CONSUMER DISCRETIONARY': 'XLY',
  'CONSUMER CYCLICAL': 'XLY',
};

export function settoreDaNome(nome) {
  if (!nome || typeof nome !== 'string') return null;
  return SETTORE_DA_NOME[nome.trim().toUpperCase()] || null;
}

// ── Dal portafoglio reale ai pesi per settore ──
// `positions` = [{ ticker, assetClass, quantity, avgPrice }] (portfolio-import).
// `priceByTicker` opzionale: senza prezzo si usa il costo medio, che per i PESI
// e' un'approssimazione accettabile (sposta le quote, non le stravolge) e va
// comunque dichiarata.
// `sectorByTicker` = { AAPL: 'TECHNOLOGY' } da asset-overview.js, quando c'e'.
export function mappaPortafoglio(positions = [], { priceByTicker = {}, sectorByTicker = {} } = {}) {
  const pesi = Object.fromEntries(SETTORI.map((s) => [s, 0]));
  const nonCoperti = [];
  let valoreTotale = 0, valoreCoperto = 0;
  let usatoCosto = false;

  for (const p of positions) {
    const ticker = String(p?.ticker || '').toUpperCase();
    if (!ticker) continue;
    const prezzo = Number.isFinite(priceByTicker[ticker]) ? priceByTicker[ticker] : (Number(p.avgPrice) || 0);
    if (!Number.isFinite(priceByTicker[ticker]) && Number(p.avgPrice) > 0) usatoCosto = true;
    const valore = (Number(p.quantity) || 0) * prezzo;
    if (!(valore > 0)) continue;
    valoreTotale += valore;

    if (ETF_SETTORIALI.has(ticker)) {
      pesi[ticker] += valore;
      valoreCoperto += valore;
      continue;
    }
    if (INDICI_AMPI.has(ticker)) {
      const quota = valore / SETTORI.length;
      for (const s of SETTORI) pesi[s] += quota;
      valoreCoperto += valore;
      continue;
    }
    const settore = settoreDaNome(sectorByTicker[ticker]);
    if (settore) {
      pesi[settore] += valore;
      valoreCoperto += valore;
      continue;
    }
    // Tutto il resto resta FUORI e viene dichiarato: cripto, obbligazioni,
    // azioni di cui non conosciamo il settore, ETF non riconosciuti.
    nonCoperti.push({
      ticker, valore: +valore.toFixed(2),
      motivo: p.assetClass === 'crypto' ? 'le cripto non sono nel pannello storico dei settori azionari'
        : p.assetClass === 'bond' ? 'le obbligazioni non sono nel pannello storico dei settori azionari'
        : 'settore sconosciuto: serve la scheda dell\'azienda per collocarla',
    });
  }

  const copertura = valoreTotale > 0 ? valoreCoperto / valoreTotale : 0;
  // Normalizzati sulla sola parte coperta: i pesi devono sommare a 1 su cio'
  // che si sta effettivamente misurando.
  const pesiNorm = {};
  for (const s of SETTORI) pesiNorm[s] = valoreCoperto > 0 ? +(pesi[s] / valoreCoperto).toFixed(6) : 0;

  return {
    pesi: pesiNorm,
    valoreTotale: +valoreTotale.toFixed(2),
    valoreCoperto: +valoreCoperto.toFixed(2),
    copertura: +copertura.toFixed(4),
    nonCoperti,
    prezziACosto: usatoCosto,
    sufficiente: copertura >= COPERTURA_MINIMA && valoreCoperto > 0,
  };
}

// Quanto e' concentrato: indice di Herfindahl sui pesi, riportato come
// "numero di settori equivalenti". Un portafoglio tutto su un settore vale 1,
// uno perfettamente spalmato sui nove vale 9. E' piu' leggibile della somma
// dei quadrati, che non significa niente per chi la legge.
export function settoriEquivalenti(pesi) {
  const h = SETTORI.reduce((s, k) => s + (pesi[k] || 0) ** 2, 0);
  return h > 0 ? +(1 / h).toFixed(2) : 0;
}

// ── IL CALCOLO: ES del portafoglio vero contro ES di un equipesato ──
// Gli scenari sono gli STESSI per entrambi (stesso seme, stesso ricampionamento):
// e' l'unico modo perche' la differenza fra i due numeri sia attribuibile alla
// composizione e non al caso della simulazione.
export function tailRiskPortafoglio(positions = [], {
  priceByTicker = {}, sectorByTicker = {},
  orizzonteMesi = 12, percorsi = 2000, seed = 4242, livello = LIVELLO_ES,
} = {}) {
  const mappa = mappaPortafoglio(positions, { priceByTicker, sectorByTicker });
  if (!mappa.sufficiente) {
    return {
      valutabile: false, mappa,
      motivo: mappa.valoreCoperto <= 0
        ? 'nessuna posizione collocabile nei settori azionari del pannello storico'
        : `misurabile solo il ${Math.round(mappa.copertura * 100)}% del portafoglio: troppo poco per chiamarlo il tuo rischio`,
    };
  }

  const rng = makeRng(seed);
  const pesiEqui = Object.fromEntries(SETTORI.map((s) => [s, 1 / SETTORI.length]));
  const mioCumulati = [], equiCumulati = [];
  // Perdita per settore nei percorsi finiti in coda: e' il "dove" della
  // domanda "dove sono esposto".
  const perditaPerSettore = Object.fromEntries(SETTORI.map((s) => [s, []]));

  for (let i = 0; i < percorsi; i++) {
    const scenario = bootstrapPanel(orizzonteMesi, rng);
    const mio = rendimentoPortafoglio(scenario, mappa.pesi);
    const equi = rendimentoPortafoglio(scenario, pesiEqui);
    // Composto, non sommato: dodici mesi di rendimenti si compongono, e su
    // code profonde la differenza fra le due cose non e' trascurabile.
    const cum = (a) => a.reduce((v, r) => v * (1 + r), 1) - 1;
    const cumMio = cum(mio);
    mioCumulati.push(cumMio);
    equiCumulati.push(cum(equi));
    for (const s of scenario.perSettore) {
      perditaPerSettore[s.simbolo].push({ cum: cumMio, contributo: (mappa.pesi[s.simbolo] || 0) * (cum(s.r)) });
    }
  }

  const mioES = expectedShortfall(mioCumulati, { livello });
  const equiES = expectedShortfall(equiCumulati, { livello });

  // Contributo alla coda: si guarda SOLO nei percorsi che sono finiti nella
  // coda del portafoglio dell'utente, e li' si somma quanto ha perso ciascun
  // settore. E' la scomposizione di quella perdita, non una media generale.
  const sogliaCoda = mioES.var;
  const contributi = SETTORI.map((s) => {
    const inCoda = perditaPerSettore[s].filter((x) => x.cum <= sogliaCoda);
    const somma = inCoda.reduce((a, x) => a + x.contributo, 0);
    return { settore: s, nome: NOMI_SETTORI[s], peso: mappa.pesi[s] || 0, perditaMedia: inCoda.length ? +(somma / inCoda.length).toFixed(5) : 0 };
  }).filter((c) => c.peso > 0);
  const perditaTotaleCoda = contributi.reduce((a, c) => a + Math.abs(c.perditaMedia), 0) || 1;
  for (const c of contributi) c.quotaDellaPerdita = +(Math.abs(c.perditaMedia) / perditaTotaleCoda).toFixed(4);
  contributi.sort((a, b) => b.quotaDellaPerdita - a.quotaDellaPerdita);

  const costoConcentrazione = +(mioES.es - equiES.es).toFixed(5);

  return {
    valutabile: true, mappa,
    orizzonteMesi, percorsi, livello,
    es: mioES.es, var: mioES.var, peggiore: mioES.peggiore,
    quantoIlVarNonVede: mioES.quantoIlVarNonVede,
    esDiversificato: equiES.es,
    // Negativo = il portafoglio perde PIU' di un equipesato negli stessi mesi.
    costoConcentrazione,
    piuFragileDelMercato: costoConcentrazione < 0,
    settoriEquivalenti: settoriEquivalenti(mappa.pesi),
    contributi,
    dominante: contributi[0] || null,
  };
}

// ── Come si racconta, senza gergo e senza mai suggerire una mossa ──
export function tailRiskText(r) {
  if (!r?.valutabile) return null;
  const pct = (x) => `${(Math.abs(x) * 100).toFixed(1).replace('.', ',')}%`;
  const parti = [];
  parti.push(`Nei dodici mesi peggiori su cento, il tuo portafoglio perde in media il ${pct(r.es)}.`);
  if (r.piuFragileDelMercato) {
    parti.push(`Un portafoglio spalmato su tutti i settori, negli stessi identici mesi simulati, ne perderebbe il ${pct(r.esDiversificato)}: la differenza di ${pct(r.costoConcentrazione)} e' il prezzo di come e' composto il tuo.`);
  } else {
    parti.push(`E' meno di quanto perderebbe un portafoglio spalmato su tutti i settori negli stessi mesi (${pct(r.esDiversificato)}).`);
  }
  if (r.dominante && r.dominante.quotaDellaPerdita > 0.3) {
    parti.push(`Nei mesi brutti, il ${Math.round(r.dominante.quotaDellaPerdita * 100)}% della perdita arriva da ${r.dominante.nome.toLowerCase()}.`);
  }
  parti.push(`Sono ${r.settoriEquivalenti} settori equivalenti su nove: piu' il numero e' basso, piu' il risultato dipende da poche cose.`);
  if (r.mappa.copertura < 0.99) {
    parti.push(`Misurato sul ${Math.round(r.mappa.copertura * 100)}% del portafoglio: il resto (${r.mappa.nonCoperti.map((n) => n.ticker).join(', ')}) non e' in questo pannello storico.`);
  }
  return parti.join(' ');
}
