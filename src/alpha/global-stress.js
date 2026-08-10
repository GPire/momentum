// ============================================================
// DIVERSIFICARE NEL MONDO NON È DIVERSIFICARE — e il segnale che mancava
// ============================================================
// Due cose in questo modulo, entrambe nate da un limite dichiarato prima:
//
// 1. IL SEGNALE CHE MANCAVA. Avevo scritto che le serie ICE BofA (high yield
//    OAS) non erano ottenibili e che restava un buco. Verificato poi su TRE
//    canali diversi che FRED ne serve solo 796 osservazioni dal 2023 — è una
//    restrizione di licenza di ICE, non un limite di tecnica. Ma il buco si
//    chiude meglio con altro: il **NFCI della Federal Reserve di Chicago**,
//    composito di 105 misure di credito, leva e rischio, settimanale dal 1971,
//    senza vincoli. È più ricco di un singolo spread, e soprattutto:
//
//    misurato walk-forward, AUC per orizzonte contro le recessioni NBER:
//                    adesso   3 mesi   6 mesi   12 mesi   18 mesi
//      NFCI           0,998    0,900    0,881     0,337     0,112
//      spread BAA-AAA 0,970    0,808    0,619     0,136     0,303
//      curva          0,727    0,293    0,365     0,600     0,822
//
//    **Il NFCI chiude la finestra cieca a sei mesi** (0,881 dove credito e
//    curva erano a 0,62 e 0,37). La cecità residua resta solo a dodici mesi.
//    Non era un dettaglio: sei mesi è l'orizzonte su cui si decide di più.
//
// 2. DIVERSIFICARE NEL MONDO. La risposta standard a "come mi proteggo" è
//    "diversifica geograficamente". Misurato su 278 mesi (2003-2026, dentro il
//    2008, il COVID e il 2022), con USA, sviluppato non-USA ed emergenti:
//
//      · le correlazioni sono GIÀ alte in tempi normali: 0,84 fra USA e non-USA,
//        0,73 con gli emergenti. Non c'è molta diversificazione da perdere,
//        perché non c'era all'inizio;
//      · un portafoglio globale equipesato ha una coda **PEGGIORE** di uno solo
//        americano: perdita attesa nel 2,5% dei mesi peggiori −13,3% contro
//        −11,5%, e volatilità 4,7% contro 4,2%. Si aggiunge volatilità (gli
//        emergenti ballano molto di più) senza aggiungere protezione.
//
//    Non significa "non diversificare": significa che diversificare fra AZIONI
//    non è diversificare. Le azioni del mondo sono una cosa sola con etichette
//    diverse, e la vera diversificazione sta fra classi di attivo — o, come
//    questo progetto sostiene da tre moduli, nel poter aspettare senza vendere.
//
// E ANCORA FORBES-RIGOBON, su dati completamente diversi dai settori: la
// correlazione sale nei periodi tesi (0,843 → 0,868) e **la salita sparisce
// dopo la correzione per l'eteroschedasticità** (0,815, sotto il livello
// calmo). Due campioni indipendenti, stessa conclusione: il luogo comune non
// regge, ma il rischio sale lo stesso perché sale la volatilità.
//
// Funzioni PURE.
'use strict';

import { GLOBALE, GLOBALE_MESI, GLOBALE_DA, GLOBALE_A, GLOBALE_FONTI } from './global-panel.js';

export const MERCATI = ['spy', 'efa', 'eem'];
export const NOMI = { spy: 'Stati Uniti', efa: 'Sviluppati non USA', eem: 'Emergenti' };

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const devst = (a) => {
  if (a.length < 2) return 0;
  const m = media(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const correlazione = (a, b) => {
  const ma = media(a), mb = media(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? n / Math.sqrt(da * db) : null;
};

export function pannelloGlobale() {
  return { mesi: GLOBALE_MESI, da: GLOBALE_DA, a: GLOBALE_A, fonti: GLOBALE_FONTI, mercati: MERCATI };
}

// ── CONTROLLI DI SANITÀ, esportati apposta ──
// Un pannello costruito unendo fonti diverse può essere sfasato di un mese
// senza che nulla protesti, e uno sfasamento di un mese distrugge le
// correlazioni fra rendimenti mensili (che sono quasi incorrelati nel tempo).
// È successo davvero durante la costruzione: SPY-EFA usciva 0,009 invece di
// 0,85 mentre EFA-EEM restava corretto, perché le due serie di Yahoo
// condividevano la convenzione e SPY no. Questi controlli restano nel codice
// perché quel tipo di errore non fa rumore.
export function controlliDiSanita() {
  const c = (a, b) => +correlazione(GLOBALE[a], GLOBALE[b]).toFixed(3);
  const spyEfa = c('spy', 'efa'), spyEem = c('spy', 'eem'), efaEem = c('efa', 'eem');
  const spyNfci = +correlazione(GLOBALE.spy, GLOBALE.nfci).toFixed(3);
  return {
    spyEfa, spyEem, efaEem, spyNfci,
    // Gli azionari mondiali DEVONO essere molto correlati fra loro: se non lo
    // sono, il pannello e' sfasato, non il mondo e' cambiato.
    allineato: spyEfa > 0.6 && spyEem > 0.5 && efaEem > 0.6,
    // Condizioni finanziarie strette e mercato che sale non vanno insieme.
    coerenteNfci: spyNfci < 0,
    motivo: spyEfa > 0.6 ? null : 'le correlazioni fra azionari mondiali sono troppo basse: quasi certamente le serie sono sfasate di un mese',
  };
}

// ── Diversificare nel mondo: quanto serve davvero ──
export function diversificazioneGeografica({ finestra = 12, decileVol = 0.8 } = {}) {
  const spy = GLOBALE.spy, T = spy.length;
  const regimi = [];
  for (let t = finestra; t < T; t++) regimi.push({ t, vol: devst(spy.slice(t - finestra, t)) });
  const soglia = [...regimi].map((x) => x.vol).sort((a, b) => a - b)[Math.floor(decileVol * regimi.length)];
  const tesi = regimi.filter((x) => x.vol >= soglia).map((x) => x.t);
  const calmi = regimi.filter((x) => x.vol < soglia).map((x) => x.t);

  const coppie = [];
  for (let i = 0; i < MERCATI.length; i++) {
    for (let j = i + 1; j < MERCATI.length; j++) {
      const a = MERCATI[i], b = MERCATI[j];
      const rc = correlazione(calmi.map((t) => GLOBALE[a][t]), calmi.map((t) => GLOBALE[b][t]));
      const rs = correlazione(tesi.map((t) => GLOBALE[a][t]), tesi.map((t) => GLOBALE[b][t]));
      const vc = devst(calmi.map((t) => GLOBALE[a][t])), vs = devst(tesi.map((t) => GLOBALE[a][t]));
      const delta = (vs * vs) / Math.max(1e-12, vc * vc) - 1;
      const corretta = rs / Math.sqrt(1 + delta * (1 - rs * rs));
      coppie.push({
        coppia: `${NOMI[a]} / ${NOMI[b]}`,
        calma: +rc.toFixed(4), stress: +rs.toFixed(4),
        corretta: +corretta.toFixed(4),
        contagioResiste: corretta > rc,
      });
    }
  }
  return {
    mesiCalmi: calmi.length, mesiTesi: tesi.length,
    coppie,
    // Il numero che conta prima di ogni discorso sul contagio: se le
    // correlazioni sono gia' alte in tempi normali, non c'e' molta protezione
    // da perdere.
    correlazioneMediaNormale: +media(coppie.map((c) => c.calma)).toFixed(4),
    contagioDiffuso: coppie.filter((c) => c.contagioResiste).length,
    conclusione: media(coppie.map((c) => c.calma)) > 0.7
      ? 'gli azionari del mondo si muovono gia\' quasi insieme in tempi normali: diversificare fra paesi non aggiunge la protezione che promette'
      : 'in tempi normali i mercati si muovono in modo abbastanza indipendente',
  };
}

// ── La prova pratica: un portafoglio globale è più sicuro? ──
export function portafoglioGlobaleVsUsa({ livello = 0.975 } = {}) {
  const usa = GLOBALE.spy;
  const globale = usa.map((v, i) => (v + GLOBALE.efa[i] + GLOBALE.eem[i]) / 3);
  const es = (r) => {
    const s = [...r].sort((a, b) => a - b);
    const k = Math.max(1, Math.floor((1 - livello) * s.length));
    return media(s.slice(0, k));
  };
  const peggiorCalo = (r) => {
    let v = 1, picco = 1, peggio = 0;
    for (const x of r) { v *= (1 + x); picco = Math.max(picco, v); peggio = Math.max(peggio, 1 - v / picco); }
    return peggio;
  };
  const esUsa = es(usa), esGlob = es(globale);
  return {
    soloUsa: { es: +esUsa.toFixed(4), volatilita: +devst(usa).toFixed(4), peggiorCalo: +peggiorCalo(usa).toFixed(4), rendimentoMedio: +(media(usa) * 12).toFixed(4) },
    globale: { es: +esGlob.toFixed(4), volatilita: +devst(globale).toFixed(4), peggiorCalo: +peggiorCalo(globale).toFixed(4), rendimentoMedio: +(media(globale) * 12).toFixed(4) },
    // Il verdetto, che va contro il consiglio standard.
    globaleProtegge: esGlob > esUsa,
    conclusione: esGlob > esUsa
      ? 'in questo campione il portafoglio globale ha una coda meno cattiva'
      : 'in questo campione il portafoglio globale ha una coda PEGGIORE: si aggiunge volatilita\' (gli emergenti ballano molto di piu\') senza aggiungere protezione, perche\' la protezione richiederebbe mercati poco correlati e questi non lo sono',
  };
}

// ── Come si racconta, senza suggerire cosa comprare ──
export function globaleText(d, p) {
  if (!d || !p) return null;
  const pct = (x) => Math.round(Math.abs(x) * 100);
  const primo = `Gli azionari del mondo si muovono gia' insieme al ${pct(d.correlazioneMediaNormale)}% nei mesi normali.`;
  const secondo = p.globaleProtegge
    ? ' Distribuirli fra paesi diversi ha comunque ridotto un po\' i mesi peggiori.'
    : ` Distribuirli fra paesi diversi non ha ridotto i mesi peggiori: nel 2,5% dei mesi piu' brutti si perdeva il ${pct(p.globale.es)}% con il portafoglio mondiale contro il ${pct(p.soloUsa.es)}% con quello americano.`;
  const terzo = ' Diversificare fra azioni non e\' diversificare: le azioni del mondo sono una cosa sola con etichette diverse.';
  return primo + secondo + terzo;
}
