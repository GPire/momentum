// ============================================================
// IL RISCHIO CHE LA TUA VITA TI COSTRINGA A VENDERE NEL MOMENTO PEGGIORE
// ============================================================
// Tutta la finanza personale di consumo misura il rischio nello stesso modo:
// quanto oscilla il mercato. È la domanda sbagliata, e produce una risposta
// che non serve a nessuno — perché **le oscillazioni fanno male solo a chi è
// costretto a vendere durante una di esse**. Chi può aspettare non perde
// niente: il calo passa. Chi a marzo deve pagare l'IVA, o si trova con il
// conto a secco, vende. E vende esattamente quando i prezzi sono bassi,
// perché è quello il momento in cui anche il resto va male.
//
// Questo rischio ha un nome tecnico (rischio di sequenza dei rendimenti) ed è
// tra i più studiati nella letteratura sulle pensioni, dove è noto da decenni
// che **con dei prelievi in mezzo, l'ORDINE dei rendimenti conta quanto la
// loro media**. Due persone con lo stesso rendimento medio su dieci anni
// finiscono con cifre molto diverse se una ha preso i cali all'inizio. Nessuna
// app di consumo lo calcola, e il motivo è strutturale, non di pigrizia:
//
//   · un broker (Robinhood, Trade Republic, Revolut) vede il tuo PORTAFOGLIO
//     ma non sa niente del tuo conto corrente né delle tue scadenze;
//   · un'app di budget vede la CASSA ma non sa cosa hai investito;
//   · un gestionale fiscale vede le SCADENZE ma non vede né l'una né l'altro.
//
// Momentum vede tutti e tre — la previsione di cassa, il portafoglio e lo
// scadenzario fiscale sono già nello stesso dispositivo. Questa non è una
// funzione in più: è l'unica domanda che si può fare solo qui.
//
// LA DOMANDA CHE SI PUÒ FINALMENTE FARE: non "quanto rende" e nemmeno "quanto
// oscilla", ma **"qual è la probabilità che io debba vendere in perdita, e
// quanto mi costa"**. E subito dopo quella utile: "quanto devo tenere da parte
// perché quella probabilità scenda sotto il 5%?".
//
// PERCHÉ IL CALO E IL BISOGNO DI SOLDI ARRIVANO INSIEME, ed è la parte che i
// modelli ingenui sbagliano: le due cose non sono indipendenti. Una recessione
// è contemporaneamente il momento in cui i mercati scendono e quello in cui il
// lavoro rende meno — per un libero professionista in modo molto diretto. Qui
// si può dichiarare una correlazione fra rendimenti e ammanchi di cassa
// (`correlazioneRedditoMercato`), e ignorarla — cioè metterla a zero, come fa
// implicitamente chiunque non la modelli — sottostima sistematicamente il
// rischio. C'è un test che lo misura.
//
// ONESTÀ SU COSA QUESTO NON È: non è una previsione dei mercati. I rendimenti
// sono generati da un modello log-normale con media e volatilità DICHIARATE
// (le stesse misurate in measured-assumptions.js). Il valore non sta nel
// prevedere il mercato — impossibile — ma nel misurare quanto sei esposto a
// una sequenza sfortunata QUALUNQUE essa sia. Le tasse sulle plusvalenze non
// sono modellate: la stima del costo è quindi prudente per difetto.
//
// Funzioni PURE, casualità iniettabile.
'use strict';

import { initEstimate, addUnit, estimate } from '../mesh/progressive-estimate.js';

// Generatore deterministico (mulberry32): i risultati devono essere
// riproducibili, altrimenti due schermate della stessa cosa danno due numeri.
export function makeRng(seed = 12345) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ── UNA sola vita simulata ──
// Mese per mese: entra il contributo, escono le spese previste e le scadenze
// fiscali, il portafoglio si muove. Se la cassa va sotto zero si vende — al
// prezzo di QUEL mese, che è il punto di tutto.
export function simulateOnePath({
  liquidita = 0, contributoMensile = 0, portafoglio = 0,
  usciteProgrammate = {},      // { indiceMese: importo } es. scadenze fiscali
  speseMensili = 0,
  mu = 0.06, sigma = 0.15, mesi = 36,
  correlazioneRedditoMercato = 0.35,
  // Un reddito da P.IVA NON e' uno stipendio: varia di mese in mese, e questa
  // e' la fonte di incertezza principale per chi lavora in proprio — piu' del
  // mercato. Trattarlo come fisso rende la simulazione quasi deterministica e
  // il risultato inutile (o zero rischio o rischio certo, mai una probabilita'
  // su cui decidere). Misurato: con reddito fisso la probabilita' usciva 1 o 0
  // a seconda di poche centinaia di euro di cassa iniziale.
  sigmaReddito = 0,
  shockRedditoProb = 0.04, shockRedditoImporto = 0,
  rng,
}) {
  const r = rng || makeRng();
  const muM = mu / 12, sigmaM = sigma / Math.sqrt(12);
  let cassa = liquidita, valore = portafoglio, picco = portafoglio;
  let vendite = 0, venditaTotale = 0, perditaRealizzata = 0, primoMese = null;

  for (let m = 0; m < mesi; m++) {
    const zMercato = gauss(r);
    // Rendimento log-normale: un rendimento non può portare il valore sotto
    // zero, e la forma normale semplice invece lo permette.
    const rend = Math.exp((muM - (sigmaM * sigmaM) / 2) + sigmaM * zMercato) - 1;
    valore *= (1 + rend);
    picco = Math.max(picco, valore);

    // L'incasso del mese, variabile e CORRELATO al mercato: la recessione che
    // fa scendere i mercati e' la stessa in cui i clienti pagano tardi. Sono
    // due facce dello stesso mese, non due eventi indipendenti.
    let incasso = contributoMensile;
    if (sigmaReddito > 0) {
      const zIndip = gauss(r);
      const rho = Math.max(-1, Math.min(1, correlazioneRedditoMercato));
      const zReddito = rho * zMercato + Math.sqrt(1 - rho * rho) * zIndip;
      incasso = contributoMensile * (1 + sigmaReddito * zReddito);
    }
    cassa += incasso - speseMensili - (usciteProgrammate[m] || 0);

    // Lo shock di reddito è CORRELATO al mercato: quando i mercati scendono,
    // la probabilità di un ammanco sale. Metterla a zero (come fa chi non la
    // modella) sottostima il rischio proprio nei casi che contano.
    if (shockRedditoImporto > 0) {
      const spinta = -zMercato * correlazioneRedditoMercato;
      const prob = Math.max(0, Math.min(1, shockRedditoProb * (1 + spinta * 2)));
      if (r() < prob) cassa -= shockRedditoImporto;
    }

    if (cassa < 0 && valore > 0) {
      const daVendere = Math.min(valore, -cassa);
      // Il costo vero della vendita forzata non è vendere: è vendere ADESSO.
      // Si misura quanto si sta realizzando sotto il massimo toccato — il
      // "quanto ci ho rimesso ad avere fretta".
      const scontoSulPicco = picco > 0 ? Math.max(0, 1 - valore / picco) : 0;
      perditaRealizzata += daVendere * scontoSulPicco;
      valore -= daVendere;
      cassa += daVendere;
      venditaTotale += daVendere;
      vendite++;
      if (primoMese === null) primoMese = m;
    }
  }

  return {
    costretto: vendite > 0,
    vendite, venditaTotale, perditaRealizzata,
    primoMese,
    cassaFinale: cassa,
    valoreFinale: valore,
    scoperto: cassa < 0,   // ha finito i soldi ANCHE dopo aver venduto tutto
  };
}

// ── La misura, con l'incertezza dichiarata ──
// La probabilità viene da una simulazione, quindi ha essa stessa un margine
// d'errore. Si riusa la stima progressiva della mesh: la stessa disciplina
// applicata ovunque, e nessun numero mostrato senza il suo intervallo.
export function forcedSaleRisk(scenario, { percorsi = 4000, seed = 12345 } = {}) {
  const r = makeRng(seed);
  let stimaProb = initEstimate();
  let stimaCosto = initEstimate();
  const primiMesi = [];
  let scoperti = 0;

  for (let i = 0; i < percorsi; i++) {
    const p = simulateOnePath({ ...scenario, rng: r });
    stimaProb = addUnit(stimaProb, { valore: p.costretto ? 1 : 0 });
    stimaCosto = addUnit(stimaCosto, { valore: p.perditaRealizzata });
    if (p.costretto) primiMesi.push(p.primoMese);
    if (p.scoperto) scoperti++;
  }

  const ep = estimate(stimaProb);
  const ec = estimate(stimaCosto);
  primiMesi.sort((a, b) => a - b);
  return {
    probabilita: +ep.media.toFixed(4),
    // ±: la simulazione non è la verità, è un campione. Mostrare 38% senza il
    // margine sarebbe la stessa falsa precisione che questo modulo combatte.
    margine: +(ep.semiAmpiezza || 0).toFixed(4),
    costoMedio: +ec.media.toFixed(2),
    costoMargine: +(ec.semiAmpiezza || 0).toFixed(2),
    meseTipico: primiMesi.length ? primiMesi[Math.floor(primiMesi.length / 2)] : null,
    probabilitaRestareASecco: +(scoperti / percorsi).toFixed(4),
    percorsi,
  };
}

// ── IL RISCHIO DI SEQUENZA, isolato e misurato ──
// Si tengono gli STESSI rendimenti e si cambia solo il loro ORDINE. Tutto il
// resto è identico: stessa media, stessa volatilità, stessi identici numeri.
// Quello che resta di differenza è, per definizione, il rischio di sequenza —
// ed è la parte che il "rendimento medio annuo" nasconde per costruzione.
export function sequenceRisk(scenario, { rendimenti = null, mescolate = 500, seed = 777 } = {}) {
  const r = makeRng(seed);
  const mesi = scenario.mesi || 36;
  const serie = rendimenti || Array.from({ length: mesi }, () => {
    const muM = (scenario.mu ?? 0.06) / 12, sM = (scenario.sigma ?? 0.15) / Math.sqrt(12);
    return Math.exp((muM - (sM * sM) / 2) + sM * gauss(r)) - 1;
  });

  const esiti = [];
  for (let k = 0; k < mescolate; k++) {
    // Fisher-Yates su una copia: il multiinsieme dei rendimenti non cambia mai.
    const s = [...serie];
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    const fisso = { ...scenario, rng: null, mesi: s.length };
    esiti.push(simulaConSerie(fisso, k === 0 ? serie : s));
  }
  const finali = esiti.map((e) => e.valoreFinale).sort((a, b) => a - b);
  const costretti = esiti.filter((e) => e.costretto).length;
  const q = (p) => finali[Math.min(finali.length - 1, Math.floor(p * finali.length))];
  return {
    // Stesso rendimento totale in ogni mescolata: se questi due numeri sono
    // diversi, la differenza NON viene dal mercato — viene dall'ordine.
    peggiore: +q(0.05).toFixed(2),
    tipico: +q(0.5).toFixed(2),
    migliore: +q(0.95).toFixed(2),
    divarioDaOrdine: +(q(0.95) - q(0.05)).toFixed(2),
    probabilitaCostretto: +(costretti / esiti.length).toFixed(4),
    mescolate: esiti.length,
  };
}

// Esegue una vita con una serie di rendimenti GIÀ decisa (nessuna casualità):
// è ciò che permette di isolare l'effetto del solo ordine.
export function simulaConSerie({
  liquidita = 0, contributoMensile = 0, portafoglio = 0,
  usciteProgrammate = {}, speseMensili = 0,
}, serie = []) {
  let cassa = liquidita, valore = portafoglio, picco = portafoglio;
  let vendite = 0, perditaRealizzata = 0;
  for (let m = 0; m < serie.length; m++) {
    valore *= (1 + serie[m]);
    picco = Math.max(picco, valore);
    cassa += contributoMensile - speseMensili - (usciteProgrammate[m] || 0);
    if (cassa < 0 && valore > 0) {
      const daVendere = Math.min(valore, -cassa);
      perditaRealizzata += daVendere * (picco > 0 ? Math.max(0, 1 - valore / picco) : 0);
      valore -= daVendere; cassa += daVendere; vendite++;
    }
  }
  return { costretto: vendite > 0, vendite, perditaRealizzata, valoreFinale: valore, cassaFinale: cassa };
}

// ── LA RISPOSTA UTILE: quanto tenere da parte ──
// Sapere di avere il 38% di probabilità di vendere in perdita non serve a
// niente da solo. Serve sapere quanto basta mettere da parte perché scenda
// dove si vuole. Ricerca binaria sul cuscinetto: poche decine di simulazioni,
// e restituisce un numero su cui si può agire lunedì mattina.
export function bufferNeeded(scenario, { obiettivo = 0.05, massimo = null, percorsi = 1500, seed = 999, passi = 12 } = {}) {
  const tetto = massimo ?? Math.max(1000, (scenario.speseMensili || 0) * 12 + Object.values(scenario.usciteProgrammate || {}).reduce((a, b) => a + b, 0));
  const rischioCon = (extra) => forcedSaleRisk({ ...scenario, liquidita: (scenario.liquidita || 0) + extra }, { percorsi, seed }).probabilita;

  const senza = rischioCon(0);
  if (senza <= obiettivo) {
    return { serve: 0, rischioAttuale: senza, raggiungibile: true, motivo: 'sei già sotto la soglia che ti sei dato: non serve mettere via altro per questo' };
  }
  if (rischioCon(tetto) > obiettivo) {
    return {
      serve: null, rischioAttuale: senza, raggiungibile: false, provato: tetto,
      motivo: 'nemmeno un anno intero di spese da parte porterebbe il rischio dove vuoi: qui il problema non è il cuscinetto, è quanto è investito rispetto a quanto ti serve',
    };
  }
  let lo = 0, hi = tetto;
  for (let i = 0; i < passi; i++) {
    const mid = (lo + hi) / 2;
    if (rischioCon(mid) > obiettivo) lo = mid; else hi = mid;
  }
  return {
    serve: Math.ceil(hi / 50) * 50,   // arrotondato: una cifra da ricordare, non da contabile
    rischioAttuale: senza,
    rischioDopo: rischioCon(hi),
    raggiungibile: true,
    motivo: null,
  };
}

// ── Come si dice, a una persona e non a un analista ──
export function riskText(r, { unita = '€' } = {}) {
  if (!r || !Number.isFinite(r.probabilita)) return null;
  const pct = Math.round(r.probabilita * 100);
  const eur = (x) => Math.round(x).toLocaleString('it-IT');
  if (pct < 3) return 'Anche se i mercati scendessero, non saresti costretto a vendere: la cassa regge da sola.';
  const quando = r.meseTipico !== null ? ` Di solito succede intorno al ${r.meseTipico + 1}º mese.` : '';
  return `${pct} volte su 100 saresti costretto a vendere mentre i prezzi sono bassi, rimettendoci in media ${eur(r.costoMedio)} ${unita}.${quando}`;
}

export function bufferText(b, { unita = '€' } = {}) {
  if (!b) return null;
  if (b.serve === 0) return b.motivo;
  if (!b.raggiungibile) return b.motivo;
  return `Con ${Math.round(b.serve).toLocaleString('it-IT')} ${unita} tenuti liquidi, il rischio di dover vendere in perdita scende dal ${Math.round(b.rischioAttuale * 100)}% al ${Math.round(b.rischioDopo * 100)}%.`;
}
