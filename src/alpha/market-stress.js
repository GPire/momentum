// ============================================================
// LA DIVERSIFICAZIONE SMETTE DI FUNZIONARE ESATTAMENTE QUANDO SERVE
// ============================================================
// Tutto quello costruito finora sugli investimenti guarda UN asset alla volta.
// È il limite che rende un lavoro credibile per un risparmiatore e non
// credibile per chi fa questo di mestiere: nessun desk ragiona su un titolo
// solo, e il rischio vero di un portafoglio non è la somma dei rischi dei suoi
// pezzi — è **quanto quei pezzi si muovono insieme quando le cose vanno male**.
//
// IL LUOGO COMUNE, e cosa dicono davvero i dati. Si ripete ovunque che "nei
// crolli le correlazioni vanno a 1" e che quindi la diversificazione svanisce.
// Qui la cosa non si cita: si MISURA, su nove settori dello S&P 500 e 331 mesi
// che contengono dot-com, 2008, COVID e il 2022. E il risultato è più
// interessante della frase fatta:
//   · misurata male (condizionando sul rendimento del mese) la correlazione
//     SCENDE nei crolli — è un bias di selezione noto, non una scoperta;
//   · misurata bene (condizionando sul regime di volatilità) sale: 0,55 → 0,61;
//   · corretta per l'eteroschedasticità (Forbes & Rigobon 2002) torna a 0,51,
//     cioè SOTTO il livello dei periodi calmi.
// Su questo campione il luogo comune non sopravvive. Ma la diversificazione
// protegge comunque meno, e per un motivo diverso: **la covarianza raddoppia
// (×1,88) perché tutto diventa più volatile, non perché diventi più legato**.
// La distinzione non è accademica — cambia cosa si può fare per difendersi.
//
// COSA CAMBIA A LIVELLO DI ALGORITMO. Il bootstrap a blocchi diventa
// MULTIVARIATO: si ricampionano gli stessi ISTANTI per tutti i settori
// insieme, non ogni serie per conto suo. È una riga di differenza e cambia
// tutto — ricampionare indipendentemente distruggerebbe la correlazione e
// produrrebbe scenari in cui i settori crollano a turno invece che insieme,
// cioè il contrario di quello che succede.
//
// LE MISURE, quelle che si usano davvero e non quelle comode:
//  · EXPECTED SHORTFALL (perdita attesa oltre la soglia) e non il VaR. Il VaR
//    dice "quanto perdo nel 2,5% peggiore dei casi" e tace su quanto si perde
//    OLTRE quella soglia — che è l'unica cosa che conta in un crollo. Inoltre
//    non è subadditivo: può dire che due portafogli uniti sono più rischiosi
//    della somma delle parti, il che è matematicamente assurdo per una misura
//    di rischio. Per queste ragioni Basilea III (FRTB) l'ha sostituito con
//    l'ES al 97,5%, ed è il livello usato qui.
//  · CORRELAZIONE CONDIZIONATA al REGIME, con la correzione di Forbes-Rigobon
//    per l'eteroschedasticità, più la covarianza — che è la grandezza che
//    decide davvero il rischio di un portafoglio.
//  · DISPERSIONE FRA SETTORI: quando i settori smettono di comportarsi in modo
//    diverso e si muovono come un blocco unico, il mercato ha smesso di
//    valutare le aziende e sta solo scappando. È un indicatore di paura che si
//    ricava dai soli prezzi, senza notizie e senza sondaggi.
//
// Funzioni PURE.
'use strict';

import { PANNELLO_SETTORI, MESI_PANNELLO, DATE_PANNELLO } from './historical-panel.js';

export const LIVELLO_ES = 0.975;   // Basilea III / FRTB
export const DECILE_STRESS = 0.1;  // "mesi brutti" = decile peggiore del mercato

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const devst = (a) => {
  if (a.length < 2) return 0;
  const m = media(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const correlazione = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = media(a.slice(0, n)), mb = media(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
};

export function pannello() {
  return { settori: PANNELLO_SETTORI.map((s) => s.simbolo), mesi: MESI_PANNELLO, da: DATE_PANNELLO[0], a: DATE_PANNELLO[1] };
}

// Il rendimento del "mercato" come media equipesata dei settori: serve a
// definire quali mesi sono brutti senza usare una serie esterna.
export function rendimentoMercato() {
  const n = PANNELLO_SETTORI[0].r.length;
  const out = new Array(n);
  for (let t = 0; t < n; t++) out[t] = media(PANNELLO_SETTORI.map((s) => s.r[t]));
  return out;
}

// ── QUANTA DIVERSIFICAZIONE EVAPORA NEI CROLLI — fatto come si deve ──
//
// PRIMA VERSIONE SBAGLIATA, e la tengo qui perche' l'errore e' istruttivo e
// perche' e' quello che fa quasi tutta la divulgazione finanziaria. Avevo
// selezionato i "mesi brutti" in base al RENDIMENTO DI QUEL MESE e misurato la
// correlazione fra settori dentro quel sottoinsieme. Risultato: correlazione
// 0,26 nei crolli contro 0,42 nella calma — cioe' l'opposto del fatto noto.
// Non e' una scoperta: e' un BIAS DI SELEZIONE documentato (Boyer, Gibson &
// Loretan 1999). Condizionare su valori estremi dell'aggregato tronca la
// distribuzione congiunta e schiaccia la correlazione misurata verso il basso.
// Chi trova un numero che contraddice un fatto stilizzato solido deve prima
// sospettare del proprio metodo, non annunciare una scoperta.
//
// MODO CORRETTO: si condiziona sul REGIME DI VOLATILITA' precedente (i 12 mesi
// prima), non sul rendimento del mese stesso. Cosi' la selezione non tocca la
// variabile che si sta misurando. Risultato: calma 0,549 - stress 0,611. La
// correlazione sale davvero.
//
// E POI LA CORREZIONE CHE QUASI NESSUNO APPLICA (Forbes & Rigobon 2002, "No
// contagion, only interdependence"): anche condizionando bene, una
// correlazione misurata in un periodo piu' volatile risulta gonfiata per pura
// eteroschedasticita'. Corretta per quella, la correlazione in stress scende a
// 0,510 — SOTTO quella dei periodi calmi. Su questo campione il famoso
// "le correlazioni vanno a 1 nei crolli" NON sopravvive alla correzione.
//
// LA CONCLUSIONE VERA, piu' utile del luogo comune: nei crolli la
// diversificazione protegge meno, ma non perche' le cose diventino piu'
// correlate — perche' diventano tutte molto piu' VOLATILI. E' la COVARIANZA a
// esplodere, ed e' la covarianza a decidere il rischio di un portafoglio. La
// distinzione non e' accademica: chi crede al problema della correlazione
// cerca di risolverlo cambiando i pesi, e non funziona; chi capisce che il
// problema e' la volatilita' sa che l'unica difesa e' ridurre l'esposizione o
// avere di che non vendere.
export function correlazioneCondizionata({ finestra = 12, decileVol = 0.8 } = {}) {
  const mercato = rendimentoMercato();
  const T = mercato.length;

  // Regime definito dalla volatilita' dei mesi PRECEDENTI: la selezione non
  // guarda il mese che si sta misurando.
  const regimi = [];
  for (let t = finestra; t < T; t++) regimi.push({ t, vol: devst(mercato.slice(t - finestra, t)) });
  const soglia = [...regimi].map((x) => x.vol).sort((a, b) => a - b)[Math.floor(decileVol * regimi.length)];
  const indiciStress = regimi.filter((x) => x.vol >= soglia).map((x) => x.t);
  const indiciCalma = regimi.filter((x) => x.vol < soglia).map((x) => x.t);

  const medioSu = (indici) => {
    const coppie = [];
    for (let i = 0; i < PANNELLO_SETTORI.length; i++) {
      for (let j = i + 1; j < PANNELLO_SETTORI.length; j++) {
        const c = correlazione(indici.map((t) => PANNELLO_SETTORI[i].r[t]), indici.map((t) => PANNELLO_SETTORI[j].r[t]));
        if (c !== null) coppie.push(c);
      }
    }
    return { media: +media(coppie).toFixed(4), coppie: coppie.length };
  };
  const volSu = (indici) => devst(indici.map((t) => mercato[t]));

  const calma = medioSu(indiciCalma), stress = medioSu(indiciStress);
  const volCalma = volSu(indiciCalma), volStress = volSu(indiciStress);

  // Forbes-Rigobon: delta = rapporto fra le varianze meno uno.
  const delta = (volStress ** 2) / Math.max(1e-12, volCalma ** 2) - 1;
  const rho = stress.media;
  const corretta = rho / Math.sqrt(1 + delta * (1 - rho * rho));

  // La covarianza e' cio' che decide davvero il rischio di portafoglio.
  const covCalma = calma.media * volCalma * volCalma;
  const covStress = stress.media * volStress * volStress;

  return {
    metodo: 'regime di volatilita\' precedente (non il rendimento del mese: eviterebbe il bias di selezione)',
    calma: { correlazione: calma.media, volatilita: +volCalma.toFixed(4), mesi: indiciCalma.length },
    stress: { correlazione: stress.media, volatilita: +volStress.toFixed(4), mesi: indiciStress.length },
    correlazioneSaleGrezza: +(stress.media - calma.media).toFixed(4),
    forbesRigobon: {
      delta: +delta.toFixed(3),
      correlazioneCorretta: +corretta.toFixed(4),
      // Se dopo la correzione la correlazione non e' piu' alta, l'aumento
      // apparente era solo volatilita' travestita da contagio.
      contagioResiste: corretta > calma.media,
    },
    covarianza: {
      calma: +covCalma.toFixed(6), stress: +covStress.toFixed(6),
      rapporto: +(covStress / Math.max(1e-12, covCalma)).toFixed(2),
    },
    volatilitaRapporto: +(volStress / Math.max(1e-12, volCalma)).toFixed(2),
    conclusione: corretta > calma.media
      ? 'anche corretta per la volatilita\' la correlazione resta piu\' alta nei periodi di stress: qui il contagio c\'e\' davvero'
      : 'l\'aumento di correlazione sparisce una volta corretto per la volatilita\': a esplodere non e\' il muoversi insieme, e\' quanto ogni cosa si muove. E\' la covarianza a decidere il rischio, e quella sale comunque.',
  };
}

// La versione INGENUA, esposta apposta per poterla confrontare. Serve a due
// cose: mostrare quanto il bias sia grande, e impedire che qualcuno la
// reintroduca credendo di aver trovato qualcosa.
export function correlazioneCondizionataIngenua({ decile = DECILE_STRESS } = {}) {
  const mercato = rendimentoMercato();
  const soglia = [...mercato].sort((a, b) => a - b)[Math.floor(decile * mercato.length)];
  const s = [], c = [];
  mercato.forEach((x, t) => (x <= soglia ? s : c).push(t));
  const medioSu = (indici) => {
    const coppie = [];
    for (let i = 0; i < PANNELLO_SETTORI.length; i++) {
      for (let j = i + 1; j < PANNELLO_SETTORI.length; j++) {
        const k = correlazione(indici.map((t) => PANNELLO_SETTORI[i].r[t]), indici.map((t) => PANNELLO_SETTORI[j].r[t]));
        if (k !== null) coppie.push(k);
      }
    }
    return +media(coppie).toFixed(4);
  };
  return {
    calma: medioSu(c), stress: medioSu(s),
    avviso: 'MISURA DISTORTA: condiziona sul rendimento dello stesso mese, quindi tronca la distribuzione congiunta e schiaccia la correlazione (Boyer-Gibson-Loretan 1999). Esposta solo per confronto.',
  };
}

// ── Bootstrap MULTIVARIATO a blocchi ──
// Si ricampionano gli stessi ISTANTI per tutti i settori: è ciò che conserva
// la struttura di correlazione e la sua dipendenza dal regime.
export function bootstrapPanel(mesi, rng, { bloccoMedio = 12 } = {}) {
  const n = PANNELLO_SETTORI[0].r.length;
  const p = 1 / Math.max(1, bloccoMedio);
  const indici = new Array(mesi);
  let i = Math.floor(rng() * n);
  for (let t = 0; t < mesi; t++) {
    indici[t] = i;
    i = rng() < p ? Math.floor(rng() * n) : (i + 1) % n;
  }
  return {
    indici,
    perSettore: PANNELLO_SETTORI.map((s) => ({ simbolo: s.simbolo, r: indici.map((t) => s.r[t]) })),
  };
}

// Il rendimento di un portafoglio con pesi dati, su uno scenario ricampionato.
export function rendimentoPortafoglio(scenario, pesi = null) {
  const w = pesi || Object.fromEntries(PANNELLO_SETTORI.map((s) => [s.simbolo, 1 / PANNELLO_SETTORI.length]));
  const somma = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const mesi = scenario.perSettore[0].r.length;
  const out = new Array(mesi).fill(0);
  for (const s of scenario.perSettore) {
    const peso = (w[s.simbolo] || 0) / somma;
    for (let t = 0; t < mesi; t++) out[t] += peso * s.r[t];
  }
  return out;
}

// ── EXPECTED SHORTFALL: quanto si perde QUANDO va male, non solo quanto spesso ──
export function expectedShortfall(rendimenti = [], { livello = LIVELLO_ES } = {}) {
  const r = rendimenti.filter(Number.isFinite).sort((a, b) => a - b);
  if (r.length < 20) return { es: null, var: null, n: r.length, motivo: 'servono almeno venti osservazioni per una coda' };
  const k = Math.max(1, Math.floor((1 - livello) * r.length));
  const coda = r.slice(0, k);
  return {
    livello,
    // Il VaR si riporta solo per mostrare la differenza, non perché serva.
    var: +r[k - 1].toFixed(5),
    es: +media(coda).toFixed(5),
    peggiore: +r[0].toFixed(5),
    n: r.length, osservazioniInCoda: k,
    // Quanto il VaR sottostima: è la parte che non guarda.
    quantoIlVarNonVede: +(r[k - 1] - media(coda)).toFixed(5),
  };
}

// ── L'INDICE DI STRESS, ricavato dai soli prezzi ──
// Niente notizie, niente sondaggi, niente sentiment comprato: quattro segnali
// che si calcolano dalla sola storia dei prezzi e che un desk macro guarda
// davvero. Il valore è fra 0 e 1.
export function stressIndex({ finestra = 12, fino = null } = {}) {
  const mercato = rendimentoMercato();
  const t = fino === null ? mercato.length : Math.min(fino, mercato.length);
  if (t < finestra + 2) return { indice: null, motivo: 'storia insufficiente' };
  const rec = mercato.slice(t - finestra, t);

  // 1. Volatilità realizzata, in percentile rispetto a tutta la storia.
  const volAttuale = devst(rec);
  const volStoriche = [];
  for (let i = finestra; i <= mercato.length; i++) volStoriche.push(devst(mercato.slice(i - finestra, i)));
  const pctVol = volStoriche.filter((v) => v <= volAttuale).length / volStoriche.length;

  // 2. Distanza dal massimo: dove siamo rispetto al picco.
  let v = 1, picco = 1;
  for (let i = 0; i < t; i++) { v *= (1 + mercato[i]); picco = Math.max(picco, v); }
  const calo = Math.max(0, 1 - v / picco);

  // 3. Dispersione fra settori nell'ultimo mese: quando collassa, il mercato
  //    ha smesso di distinguere le aziende e sta solo scappando.
  const ultimo = PANNELLO_SETTORI.map((s) => s.r[t - 1]);
  const dispAttuale = devst(ultimo);
  const dispStoriche = [];
  for (let i = 0; i < mercato.length; i++) dispStoriche.push(devst(PANNELLO_SETTORI.map((s) => s.r[i])));
  const pctDisp = dispStoriche.filter((d) => d <= dispAttuale).length / dispStoriche.length;

  // 4. Correlazione media recente fra settori: alta = tutto si muove insieme.
  const coppie = [];
  for (let i = 0; i < PANNELLO_SETTORI.length; i++) {
    for (let j = i + 1; j < PANNELLO_SETTORI.length; j++) {
      const c = correlazione(PANNELLO_SETTORI[i].r.slice(t - finestra, t), PANNELLO_SETTORI[j].r.slice(t - finestra, t));
      if (c !== null) coppie.push(c);
    }
  }
  const corr = media(coppie);

  const indice = 0.35 * pctVol + 0.25 * Math.min(1, calo / 0.3) + 0.15 * (1 - pctDisp) + 0.25 * Math.max(0, Math.min(1, (corr - 0.3) / 0.6));
  return {
    indice: +Math.max(0, Math.min(1, indice)).toFixed(4),
    volatilitaPercentile: +pctVol.toFixed(3),
    caloDalMassimo: +calo.toFixed(4),
    dispersionePercentile: +pctDisp.toFixed(3),
    correlazioneMedia: +corr.toFixed(4),
    stato: indice > 0.66 ? 'paura' : indice > 0.33 ? 'incerto' : 'calmo',
  };
}

// ── COSA PREVEDE DAVVERO, misurato e non promesso ──
// È la parte che il settore non pubblica mai. Si prende l'indice di stress mese
// per mese e si guarda cosa succede DOPO: la volatilità del mese successivo e
// il rendimento del mese successivo. Il risultato onesto, in finanza, è quasi
// sempre lo stesso — e va detto invece che nascosto dietro un grafico.
export function cosaPrevede({ finestra = 12, orizzonte = 1 } = {}) {
  const mercato = rendimentoMercato();
  const punti = [];
  for (let t = finestra + 1; t + orizzonte <= mercato.length; t++) {
    const s = stressIndex({ finestra, fino: t });
    if (s.indice === null) continue;
    const dopo = mercato.slice(t, t + orizzonte);
    punti.push({ stress: s.indice, rendDopo: dopo.reduce((a, b) => a + b, 0), volDopo: Math.abs(dopo.reduce((a, b) => a + b, 0)) });
  }
  if (punti.length < 50) return { valutabile: false, motivo: 'campione troppo piccolo' };

  const corrVol = correlazione(punti.map((p) => p.stress), punti.map((p) => p.volDopo));
  const corrRend = correlazione(punti.map((p) => p.stress), punti.map((p) => p.rendDopo));
  // Errore standard di una correlazione: serve a non chiamare "segnale" un
  // valore che sta dentro il rumore.
  const se = 1 / Math.sqrt(punti.length - 3);
  const significativa = (c) => Math.abs(0.5 * Math.log((1 + c) / (1 - c))) > 2 * se;

  return {
    valutabile: true, osservazioni: punti.length,
    prevedeVolatilita: { correlazione: +corrVol.toFixed(4), significativa: significativa(corrVol) },
    prevedeRendimento: { correlazione: +corrRend.toFixed(4), significativa: significativa(corrRend) },
    // La conclusione, scritta invece che lasciata dedurre.
    conclusione: significativa(corrVol) && !significativa(corrRend)
      ? 'la paura del mercato annuncia altra turbolenza, NON un calo dei prezzi: dice quanto ballerà, non da che parte andrà'
      : significativa(corrRend)
        ? 'in questo campione l\'indice mostra un legame anche con la direzione: da trattare con sospetto, è il tipo di risultato che di solito non regge fuori campione'
        : 'nessun legame distinguibile dal rumore',
  };
}

// Cosa si dice a chi guarda, senza gergo e senza promettere direzioni.
export function stressText(s) {
  if (!s || s.indice === null) return null;
  if (s.stato === 'calmo') return 'Il mercato è in una fase tranquilla: i settori si muovono in modo indipendente, come dovrebbero.';
  if (s.stato === 'incerto') return 'Il mercato è nervoso: la volatilità è sopra la norma e i settori iniziano a muoversi insieme.';
  return 'Il mercato è in una fase di paura: i settori si muovono quasi tutti insieme, e quando succede la diversificazione protegge molto meno del solito.';
}

export function diversificazioneText(c) {
  if (!c) return null;
  const volte = c.covarianza.rapporto;
  return `Nei periodi difficili tutto diventa circa ${c.volatilitaRapporto} volte piu' mosso, e il rischio combinato del tuo portafoglio sale di circa ${volte} volte. Non perche' le cose diventino piu' legate fra loro — quello e' un luogo comune che i numeri non confermano — ma perche' ognuna si muove molto di piu'. Cambiare i pesi non lo risolve: serve poter aspettare senza vendere.`;
}
