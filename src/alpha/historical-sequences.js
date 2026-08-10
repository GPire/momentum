// ============================================================
// I CROLLI VERI, NON QUELLI CHE UN MODELLO SA IMMAGINARE
// ============================================================
// `forced-sale-risk.js` misura la probabilità di essere costretti a vendere
// durante un calo. Ma genera i rendimenti da una log-normale, e su quel punto
// va detta una cosa scomoda: **una log-normale non sa produrre un crollo.**
// Non per un difetto di implementazione — per costruzione:
//
//  · le CODE sono troppo sottili. Nel 2008 lo S&P ha fatto −16,5% in un mese.
//    Con una volatilità del 15% annuo quel mese è a più di tre deviazioni:
//    una log-normale lo genera all'incirca una volta ogni 700 anni. È successo
//    tre volte in trent'anni.
//  · i mesi brutti arrivano IN FILA. La volatilità è raggruppata (Mandelbrot
//    1963, poi tutta la letteratura ARCH/GARCH): dopo un mese pessimo la
//    probabilità di un altro mese pessimo sale. Una log-normale estrae ogni
//    mese in modo indipendente, quindi i mesi brutti li sparpaglia.
//
// E il secondo punto è esattamente quello che conta qui. Il rischio di
// sequenza non nasce da un mese brutto: nasce da SEI MESI BRUTTI DI FILA
// mentre devi pagare l'IVA. Un modello che sparpaglia i cali sottostima
// proprio lo scenario per cui il modulo esiste.
//
// LA SOLUZIONE STANDARD, e non è nostra: il **bootstrap stazionario a
// blocchi** (Politis & Romano, 1994). Invece di estrarre singoli mesi a caso
// si estraggono SPEZZONI CONTIGUI di storia vera, di lunghezza casuale, e li
// si incolla. Così i crolli restano crolli — con dentro la loro sequenza di
// mesi consecutivi — ma non si ripete sempre la stessa storia. La lunghezza
// dei blocchi è geometrica (media 1/p) invece che fissa: la serie risultante
// resta stazionaria, che con blocchi di lunghezza fissa non sarebbe vera.
//
// PERCHÉ NON USARE SEMPLICEMENTE LA STORIA COSÌ COM'È: perché è UNA sola
// storia. Chiedersi "come sarebbe andata dal 2000 al 2010" dà una risposta,
// non una distribuzione — e su una risposta sola non si può dire niente su
// quanto si è esposti. Il bootstrap dà migliaia di storie ugualmente
// plausibili fatte tutte di pezzi realmente accaduti.
//
// COSA RESTA FUORI, dichiarato: il futuro non è un ricampionamento del
// passato. Trent'anni di SPY contengono due crolli grandi; se il prossimo
// decennio ne porta uno peggiore di qualunque cosa in archivio, questo metodo
// non lo vedrà — nessun metodo lo vedrebbe. Il bootstrap non predice: dice
// quanto saresti stato esposto a ciò che è realmente successo, il che è molto
// più di quanto dica una log-normale, e molto meno di una previsione.
//
// Funzioni PURE.
'use strict';

import { SERIE_STORICHE, SERIE_PREDEFINITA } from './historical-returns.js';

// Lunghezza media dei blocchi, in mesi. 12 non è un numero tondo scelto a
// caso: un crollo e il suo strascico durano tipicamente fra i sei mesi e i due
// anni, e blocchi troppo corti li spezzerebbero — perdendo esattamente ciò che
// si vuole conservare. Blocchi troppo lunghi darebbero poche storie diverse.
export const BLOCCO_MEDIO_MESI = 12;

export function serieDisponibili() {
  return Object.entries(SERIE_STORICHE).map(([id, s]) => ({
    id, simbolo: s.simbolo, mesi: s.mesi, da: s.da, a: s.a, fonte: s.fonte,
  }));
}

// Statistiche vere della serie: servono a dichiarare su cosa si sta lavorando
// e a confrontarle con quelle di un modello.
export function statisticheSerie(id = SERIE_PREDEFINITA) {
  const s = SERIE_STORICHE[id];
  if (!s) return null;
  const r = s.rendimenti;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1);
  const sd = Math.sqrt(v);
  // Curtosi: quanto le code sono più grasse di una normale (per cui vale 3).
  // È il numero che dice, con una cifra sola, quanto un modello gaussiano
  // sottostima gli estremi.
  const k = r.reduce((a, b) => a + ((b - m) / sd) ** 4, 0) / r.length;
  const asim = r.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / r.length;
  return {
    id, simbolo: s.simbolo, mesi: r.length, da: s.da, a: s.a, fonte: s.fonte,
    muAnnuo: +(m * 12).toFixed(4),
    sigmaAnnua: +(sd * Math.sqrt(12)).toFixed(4),
    peggiorMese: +Math.min(...r).toFixed(4),
    miglioreMese: +Math.max(...r).toFixed(4),
    curtosi: +k.toFixed(2),
    asimmetria: +asim.toFixed(3),
    codeGrasse: k > 3.5,
  };
}

// ── Il bootstrap stazionario a blocchi ──
// Si parte da un punto a caso della storia, si va avanti mese per mese, e a
// ogni passo con probabilità p si salta in un altro punto a caso. La
// lunghezza dei tratti contigui risulta geometrica di media 1/p.
export function bootstrapSequence(mesi, rng, { serie = SERIE_PREDEFINITA, bloccoMedio = BLOCCO_MEDIO_MESI } = {}) {
  const s = SERIE_STORICHE[serie];
  if (!s) throw new Error(`serie storica sconosciuta: "${serie}" (disponibili: ${Object.keys(SERIE_STORICHE).join(', ')})`);
  const r = s.rendimenti, n = r.length;
  const p = 1 / Math.max(1, bloccoMedio);
  const out = new Array(mesi);
  let i = Math.floor(rng() * n);
  for (let t = 0; t < mesi; t++) {
    out[t] = r[i];
    // Avvolgimento circolare: senza, i mesi vicini alla fine dell'archivio
    // verrebbero pescati meno degli altri, e la serie non sarebbe stazionaria.
    i = rng() < p ? Math.floor(rng() * n) : (i + 1) % n;
  }
  return out;
}

// ── La prova che serviva davvero: quanto un modello sottostima i crolli ──
// Confronta il peggior calo consecutivo prodotto dal bootstrap storico con
// quello prodotto da una log-normale con la STESSA media e la STESSA
// volatilità. Se i due numeri coincidessero, tutto questo sarebbe inutile.
export function crolliConfronto({ mesi = 120, prove = 1000, serie = SERIE_PREDEFINITA, rng }) {
  const st = statisticheSerie(serie);
  const r = rng;
  const muM = st.muAnnuo / 12, sdM = st.sigmaAnnua / Math.sqrt(12);
  const gauss = () => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // Il calo massimo da un massimo precedente: la misura che conta per chi
  // potrebbe dover vendere, molto più della volatilità.
  const peggiorCalo = (rend) => {
    let v = 1, picco = 1, peggio = 0;
    for (const x of rend) { v *= (1 + x); picco = Math.max(picco, v); peggio = Math.max(peggio, 1 - v / picco); }
    return peggio;
  };

  const storici = [], modello = [];
  for (let k = 0; k < prove; k++) {
    storici.push(peggiorCalo(bootstrapSequence(mesi, r, { serie })));
    modello.push(peggiorCalo(Array.from({ length: mesi }, () => Math.exp((muM - (sdM * sdM) / 2) + sdM * gauss()) - 1)));
  }
  const q = (a, p) => { const s2 = [...a].sort((x, y) => x - y); return s2[Math.min(s2.length - 1, Math.floor(p * s2.length))]; };
  return {
    serie: st.simbolo, mesi, prove,
    storico: { tipico: +q(storici, 0.5).toFixed(4), gravi: +q(storici, 0.95).toFixed(4) },
    logNormale: { tipico: +q(modello, 0.5).toFixed(4), gravi: +q(modello, 0.95).toFixed(4) },
    sottostimaGravi: +(q(storici, 0.95) - q(modello, 0.95)).toFixed(4),
    curtosiReale: st.curtosi,
  };
}

// Quanto sono lunghi i tratti negativi. ATTENZIONE a cosa misura: NON il
// raggruppamento della volatilità.
// IPOTESI MIA SMENTITA DAL TEST, e vale la pena tenerne traccia: davo per
// scontato che il bootstrap producesse sequenze negative più lunghe della
// log-normale. Misurato, è il contrario (4,44 mesi contro 5,21) — e la ragione
// è ovvia a posteriori: nell'archivio SPY solo il 37,5% dei mesi è negativo,
// mentre una log-normale con quella media e quella volatilità ne produce il
// 43%. La differenza nel tasso di base sommerge del tutto l'effetto del
// raggruppamento. Il segno non è la grandezza giusta da guardare.
export function mesiNegativiConsecutivi(rend = []) {
  let max = 0, cur = 0;
  for (const x of rend) { if (x < 0) { cur++; max = Math.max(max, cur); } else cur = 0; }
  return max;
}

// LA MISURA GIUSTA del raggruppamento della volatilità: l'autocorrelazione dei
// rendimenti ASSOLUTI. È la firma canonica del fenomeno (i rendimenti quasi
// non sono correlati fra loro, ma le loro grandezze sì: dopo un mese violento
// è più probabile un altro mese violento, in qualunque direzione).
// Misurato su SPY: archivio reale 0,195 · bootstrap a blocchi 0,143 ·
// log-normale −0,014, cioè zero per costruzione. Il bootstrap ne conserva circa
// tre quarti — non tutto, perché ogni salto fra blocchi rompe una sequenza, ed
// è il prezzo onesto di avere migliaia di storie diverse invece di una sola.
export function autocorrelazioneAssoluti(rend = [], lag = 1) {
  const x = rend.map(Math.abs);
  if (x.length <= lag + 1) return null;
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  let num = 0, den = 0;
  for (let i = 0; i < x.length; i++) {
    den += (x[i] - m) ** 2;
    if (i >= lag) num += (x[i] - m) * (x[i - lag] - m);
  }
  return den > 0 ? num / den : null;
}

// Cosa dire, e qui va detto: usare la storia vera invece di un modello è una
// scelta metodologica che l'utente ha diritto di sapere.
export function fonteText(id = SERIE_PREDEFINITA) {
  const st = statisticheSerie(id);
  if (!st) return null;
  return `Basato su ${st.mesi} mesi realmente accaduti (${st.simbolo}, da ${st.da} a ${st.a}), non su un modello: il mese peggiore dell'archivio è ${Math.round(st.peggiorMese * 100)}%.`;
}

// ── IL CONTESTO: perché i cali e i picchi, e quanto durano ──
// `market-cycles.js` sa già leggere gli episodi di calo, i tempi di recupero e
// la stagionalità. Era scritto, testato e non collegato a niente: non aveva
// mai visto un dato vero. Qui gli si dà la storia reale da leggere.
//
// La differenza fra un numero e una risposta: "sei a −22% dal massimo" è un
// numero. "Cali di questa profondità, nei trent'anni di archivio, si sono
// recuperati in mediana in N mesi, e il peggiore ne ha richiesti M" è ciò che
// permette a una persona di decidere se può aspettare — che è l'unica cosa
// che conta quando si parla di essere costretti a vendere.
export function ricostruisciPrezzi(id = SERIE_PREDEFINITA) {
  const s = SERIE_STORICHE[id];
  if (!s) return null;
  // Un indice base 100: per cali e stagionalità conta il rapporto fra prezzi,
  // non il livello, quindi ricostruirlo dai rendimenti è esatto e non
  // approssimato.
  const closes = [100];
  for (const r of s.rendimenti) closes.push(closes[closes.length - 1] * (1 + r));
  const [annoA, meseA] = s.da.split('-').map(Number);
  const dates = closes.map((_, i) => {
    const m0 = (meseA - 1) + i;
    const anno = annoA + Math.floor(m0 / 12);
    const mese = (m0 % 12) + 1;
    return `${anno}-${String(mese).padStart(2, '0')}`;
  });
  return { closes, dates };
}

export async function contestoStorico(id = SERIE_PREDEFINITA, { minDepthPct = 10 } = {}) {
  const p = ricostruisciPrezzi(id);
  if (!p) return null;
  const { drawdownEpisodes, recoveryBaseRates, monthlySeasonality } = await import('./market-cycles.js');
  const episodi = drawdownEpisodes(p.closes, { minDepthPct });
  const recuperi = recoveryBaseRates(p.closes, { minDepthPct });
  const stagioni = monthlySeasonality(p.dates, p.closes);

  const recuperati = episodi.filter((e) => e.recovered);
  const mesiRecupero = recuperati.map((e) => e.recoveryMonths).sort((a, b) => a - b);
  const peggiore = episodi.reduce((a, b) => (!a || b.depthPct > a.depthPct ? b : a), null);

  // La stagionalità va guardata con sospetto: con trent'anni ci sono ~33
  // osservazioni per mese, e su così poche una differenza di qualche decimo di
  // punto è rumore. Si dichiara quali mesi reggono un controllo minimo e quali
  // no, invece di pubblicare dodici numeri tutti uguali per dignità.
  const conTest = stagioni.map((m) => {
    const n = m.count || 0;
    // Errore standard della quota di mesi positivi sotto "moneta equa".
    const se = n ? Math.sqrt(0.25 / n) * 100 : null;
    const scostamento = m.positiveRatePct === null ? null : Math.abs(m.positiveRatePct - 50);
    return { ...m, distinguibile: se !== null && scostamento > 2 * se };
  });

  return {
    serie: SERIE_STORICHE[id].simbolo,
    episodi: episodi.length,
    recuperati: recuperati.length,
    inCorso: recuperi.ongoing || 0,
    recuperoMediano: mesiRecupero.length ? mesiRecupero[Math.floor(mesiRecupero.length / 2)] : null,
    recuperoPeggiore: mesiRecupero.length ? mesiRecupero[mesiRecupero.length - 1] : null,
    caloPeggiore: peggiore ? peggiore.depthPct : null,
    perFascia: recuperi.rows,
    stagionalita: conTest,
    stagionalitaCredibile: conTest.filter((m) => m.distinguibile).map((m) => m.month),
  };
}

// Cosa si può dire a una persona che sta guardando un calo, senza mai
// promettere che risalirà.
export function contestoText(c) {
  if (!c || !c.episodi) return null;
  const rec = c.recuperoMediano !== null
    ? ` Nei ${c.episodi} cali importanti dell'archivio, il recupero è arrivato in mediana dopo ${c.recuperoMediano} mesi; il più lungo ne ha richiesti ${c.recuperoPeggiore}.`
    : '';
  return `Il calo più profondo mai registrato su ${c.serie} è stato del ${Math.round(c.caloPeggiore)}%.${rec} È quello che è successo, non quello che succederà.`;
}

// ── IL PERCHÉ DEI CALI: contesto, non causa ──
// Le sei date dei cali di SPY escono DAL DATO (market-cycles le trova da solo).
// Coincidono con eventi pubblici che chiunque può verificare. L'etichetta
// serve a una cosa sola: far capire a chi guarda che quei numeri non sono
// astratti, sono successi, e ne conosciamo il nome.
//
// LA REGOLA CHE MI SONO DATO, ed è il motivo per cui questo elenco è corto:
// si etichetta SOLO un episodio già individuato dai prezzi, e solo se le sue
// date coincidono. Non si spiega mese per mese perché il mercato ha fatto
// +1,2% a maggio: quella sarebbe una storia inventata a posteriori, la cosa
// più facile e più dannosa che si possa fare in finanza. Un'etichetta è
// CONTESTO, mai una causa dimostrata dai dati: nessuna serie di prezzi può
// dimostrare perché è scesa.
export const EPISODI_NOTI = [
  { fondo: '1998-08', nome: 'Crisi del rublo e collasso di LTCM', tipo: 'finanziario' },
  { fondo: '2002-09', nome: 'Scoppio della bolla dot-com', tipo: 'bolla' },
  { fondo: '2009-02', nome: 'Crisi finanziaria globale (mutui subprime)', tipo: 'sistemico' },
  { fondo: '2018-12', nome: 'Stretta monetaria della Fed e tensioni commerciali', tipo: 'politica monetaria' },
  { fondo: '2020-03', nome: 'Pandemia di COVID-19', tipo: 'esogeno' },
  { fondo: '2022-09', nome: 'Inflazione e rialzo rapido dei tassi', tipo: 'politica monetaria' },
];

// Attacca il nome all'episodio SOLO se la data del fondo coincide con quella
// trovata nei prezzi. Se un domani i dati cambiassero, le etichette che non
// corrispondono più sparirebbero da sole invece di restare a mentire.
export async function episodiConNome(id = SERIE_PREDEFINITA, { minDepthPct = 10 } = {}) {
  const p = ricostruisciPrezzi(id);
  if (!p) return [];
  const { drawdownEpisodes } = await import('./market-cycles.js');
  return drawdownEpisodes(p.closes, { minDepthPct }).map((e) => {
    const fondo = p.dates[e.troughIdx];
    const noto = EPISODI_NOTI.find((x) => x.fondo === fondo);
    return {
      picco: p.dates[e.peakIdx], fondo,
      caloPct: e.depthPct,
      mesiDiDiscesa: e.declineMonths,
      mesiPerRecuperare: e.recovered ? e.recoveryMonths : null,
      recuperato: !!e.recovered,
      nome: noto?.nome || null,
      tipo: noto?.tipo || null,
      // Dichiarato in ogni riga, perché non si perda per strada.
      nota: noto ? 'nome dell\'evento coincidente per data: contesto, non una causa dimostrata dai prezzi' : null,
    };
  });
}

// Il racconto di un singolo episodio, per chi sta guardando un calo oggi.
export function episodioText(e) {
  if (!e) return null;
  const chi = e.nome ? `${e.nome}: ` : '';
  const rec = e.recuperato
    ? `ci sono voluti ${e.mesiPerRecuperare} mesi per tornare al punto di partenza`
    : 'non è ancora tornato al punto di partenza';
  return `${chi}da ${e.picco} a ${e.fondo} il mercato ha perso il ${Math.round(e.caloPct)}% in ${e.mesiDiDiscesa} mesi, poi ${rec}.`;
}

// ── BOOTSTRAP CONDIZIONATO AL REGIME DI OGGI ──
// Il bootstrap normale pesca spezzoni da tutta la storia con uguale
// probabilità. È corretto per la domanda "quanto sono esposto in generale", ed
// è SBAGLIATO per la domanda "quanto sono esposto adesso": se oggi il mercato è
// già agitato, pescare anche dai lunghi tratti di calma degli anni Novanta
// diluisce il rischio dei prossimi mesi.
//
// Qui i blocchi partono preferibilmente da mesi che ASSOMIGLIAVANO A OGGI —
// misurati sulla volatilità dei dodici mesi precedenti, cioè la stessa cosa che
// si può osservare oggi senza sapere il futuro. È una previsione condizionata,
// non una previsione: non dice cosa succederà, dice cosa è successo le altre
// volte che siamo partiti da qui.
//
// LA CAUTELA CHE SERVE: condizionare restringe il campione, e un campione
// stretto è un campione fragile. Il peso non azzera mai i mesi diversi — li
// rende solo meno probabili — così anche un regime raro conserva abbastanza
// storia da cui pescare. `concentrazione` regola quanto si stringe.
export function bootstrapCondizionato(mesi, rng, {
  serie = SERIE_PREDEFINITA, bloccoMedio = BLOCCO_MEDIO_MESI,
  finestra = 12, concentrazione = 3,
} = {}) {
  const s = SERIE_STORICHE[serie];
  if (!s) throw new Error(`serie storica sconosciuta: "${serie}"`);
  const r = s.rendimenti, n = r.length;

  // Volatilità dei 12 mesi precedenti, per ogni possibile punto di partenza.
  const sd = (a) => {
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((acc, x) => acc + (x - m) ** 2, 0) / Math.max(1, a.length - 1));
  };
  const vol = new Array(n).fill(null);
  for (let i = finestra; i < n; i++) vol[i] = sd(r.slice(i - finestra, i));
  const volOggi = vol[n - 1];

  // Peso: massimo per i mesi con volatilità simile a oggi, decrescente con la
  // distanza. Mai zero.
  const scala = sd(vol.filter((x) => x !== null)) || 1e-6;
  const pesi = vol.map((v) => (v === null ? 0.05 : 0.05 + Math.exp(-concentrazione * Math.abs(v - volOggi) / scala)));
  const cum = [];
  let tot = 0;
  for (const p of pesi) { tot += p; cum.push(tot); }
  const pesca = () => {
    const x = rng() * tot;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
    return lo;
  };

  const p = 1 / Math.max(1, bloccoMedio);
  const out = new Array(mesi);
  let i = pesca();
  for (let t = 0; t < mesi; t++) {
    out[t] = r[i];
    i = rng() < p ? pesca() : (i + 1) % n;
  }
  return out;
}

// Quanto il condizionamento sta effettivamente stringendo il campione: se
// diventa troppo stretto, la stima poggia su pochi episodi e va detto.
export function ampiezzaCondizionamento({ serie = SERIE_PREDEFINITA, finestra = 12, concentrazione = 3 } = {}) {
  const r = SERIE_STORICHE[serie].rendimenti, n = r.length;
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((acc, x) => acc + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  const vol = new Array(n).fill(null);
  for (let i = finestra; i < n; i++) vol[i] = sd(r.slice(i - finestra, i));
  const volOggi = vol[n - 1];
  const scala = sd(vol.filter((x) => x !== null)) || 1e-6;
  const pesi = vol.map((v) => (v === null ? 0.05 : 0.05 + Math.exp(-concentrazione * Math.abs(v - volOggi) / scala)));
  const tot = pesi.reduce((a, b) => a + b, 0);
  // Numero efficace di punti di partenza (Kish): dice quanti mesi stanno
  // davvero contribuendo, invece di quanti ce ne sono.
  const efficaci = (tot * tot) / pesi.reduce((a, b) => a + b * b, 0);
  return {
    mesiTotali: n,
    mesiEfficaci: Math.round(efficaci),
    quota: +(efficaci / n).toFixed(3),
    volatilitaOggi: +volOggi.toFixed(4),
    abbastanza: efficaci >= 60,
    motivo: efficaci >= 60 ? null : 'il regime di oggi somiglia a pochi mesi della storia: la stima condizionata poggia su poche esperienze e va letta come indicativa',
  };
}
