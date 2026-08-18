// ============================================================
// PREVISIONE CONDIZIONATA — e il controllo che quasi nessuno fa
// ============================================================
// La domanda vera di chi investe non e' "cosa fara' il mercato" (nessuno lo
// sa, e i test walk-forward di questo stesso progetto lo mostrano: l'indice di
// paura prevede la turbolenza ma NON la direzione, e la curva dei rendimenti a
// sei mesi ha un'accuratezza SOTTO il lancio di una moneta). La domanda a cui
// si puo' rispondere con i dati e' un'altra, ed e' quasi altrettanto utile:
//
//   **"Nella situazione in cui siamo oggi, cos'e' successo storicamente nei
//     mesi seguenti — e quanto e' larga quella forbice?"**
//
// Non un numero: una distribuzione, con quanti casi la sostengono. E' l'unica
// forma di previsione che sopravviva a una validazione seria.
//
// ── IL CONTROLLO CHE RENDE QUESTO MODULO DIVERSO ──
// Ogni strumento del settore condiziona e mostra il risultato come se fosse
// informazione. Nessuno verifica il passaggio precedente: **sapere in che
// stato siamo oggi cambia davvero la distribuzione, oppure no?** Se la
// distribuzione condizionata e' indistinguibile da quella di sempre, la
// risposta onesta e' "lo stato di oggi non aggiunge nulla" — ed e' una
// risposta misurabile, non un'opinione. Qui si misura, e quando e' cosi' lo si
// dice invece di vendere il grafico.
//
// ── LA TRAPPOLA STATISTICA CHE QUI VIENE AFFRONTATA ──
// I rendimenti futuri a 12 mesi calcolati ogni mese si SOVRAPPONGONO per 11
// mesi su 12. Trattarli come osservazioni indipendenti — che e' quello che fa
// qualunque test standard — gonfia enormemente la significativita': con 400
// mesi si crede di avere 400 prove e se ne hanno circa 33. E' il motivo per cui
// tanta ricerca finanziaria "significativa" non si replica.
// Due contromisure, entrambe dichiarate nel referto:
//   1) il test di significativita' e' una PERMUTAZIONE A BLOCCHI (si rimescolano
//      blocchi contigui lunghi quanto l'orizzonte, non mesi singoli), cosi' la
//      sovrapposizione e' presente anche sotto l'ipotesi nulla e non la falsa;
//   2) si dichiara la dimensione campionaria EFFICACE (casi / orizzonte), che
//      e' il numero di prove davvero indipendenti.
//
// QUANTO CONTA, MISURATO SUI NOSTRI DATI (402 mesi di SPY, 1993-2026). Stato di
// crisi (calo −28% dal massimo, anno a −22%, alta volatilita'), orizzonte 12
// mesi: la mediana successiva e' −1,3% contro il +12,3% di sempre, cioe' 14
// punti di differenza — un effetto enorme, di quelli che si mettono nel titolo.
//   · test ingenuo, permutazione mese per mese:  p = 0,001  → "significativo"
//   · test a blocchi, come qui:                  p = 0,10   → non distinguibile
// Stessi dati, stesso effetto, cento volte di differenza sul valore p. Il
// motivo e' nel terzo numero: i casi apparenti sono 27, quelli indipendenti
// sono 2. Con due prove non si dimostra niente, per quanto grande sia l'effetto
// — ed e' esattamente la trappola in cui cade chi annuncia che "dopo i crolli
// il mercato fa peggio".
//
// Nessun consiglio, mai. Funzioni PURE: i dati arrivano dal chiamante.
'use strict';

// Sotto questo numero di mesi storici simili non si risponde: una distribuzione
// costruita su pochi casi e' un aneddoto con la faccia di una statistica.
export const MIN_CASI = 24;
// Quante permutazioni per il test. 999 da' una risoluzione di 0,001 sul valore
// p, che e' abbondante per una soglia dichiarata al 5%.
export const PERMUTAZIONI = 999;

const finiti = (a) => a.filter(Number.isFinite);

export function mediana(a) {
  const s = finiti(a).slice().sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(a, q) {
  const s = finiti(a).slice().sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

// ── LO STATO DI UN MESE, misurato dai soli prezzi ──
// Tre assi, scelti perche' sono cio' che una persona guarda davvero e perche'
// si calcolano senza alcun dato esterno:
//   · quanto siamo sotto il massimo mai toccato (il "quanto fa male adesso");
//   · quanto ha reso l'ultimo anno (la tendenza in corso);
//   · quanto e' stato agitato l'ultimo anno (la calma o la tempesta).
// Serve una finestra iniziale: i primi `finestra` mesi non hanno uno stato,
// perche' non hanno un anno di storia alle spalle. Non si inventano.
export function statiMensili(rendimenti = [], { finestra = 12 } = {}) {
  const r = rendimenti;
  const stati = [];
  let prezzo = 100, picco = 100;
  const prezzi = [prezzo];
  for (const x of r) { prezzo *= (1 + (Number.isFinite(x) ? x : 0)); prezzi.push(prezzo); }

  for (let i = 0; i < r.length; i++) {
    picco = Math.max(picco, prezzi[i + 1]);
    if (i < finestra) { stati.push(null); continue; }
    const fin = r.slice(i - finestra + 1, i + 1).filter(Number.isFinite);
    if (fin.length < finestra) { stati.push(null); continue; }
    const rendAnno = prezzi[i + 1] / prezzi[i + 1 - finestra] - 1;
    const media = fin.reduce((a, b) => a + b, 0) / fin.length;
    const varianza = fin.reduce((a, b) => a + (b - media) ** 2, 0) / (fin.length - 1);
    stati.push({
      indice: i,
      calo: prezzi[i + 1] / picco - 1,          // <= 0
      rendimentoAnno: rendAnno,
      volatilita: Math.sqrt(varianza),
    });
  }
  return stati;
}

// Due stati sono "simili" se lo sono su TUTTI E TRE gli assi. La somiglianza si
// misura in unita' di dispersione storica dell'asse stesso, non in percentuali
// assolute: un calo del 5% significa cose diverse su un indice tranquillo e su
// una cripto, e una soglia fissa mentirebbe su una delle due.
export function simili(stati, corrente, { tolleranza = 0.75 } = {}) {
  const validi = stati.filter(Boolean);
  if (!validi.length || !corrente) return [];
  const scala = (chiave) => {
    const v = validi.map((s) => s[chiave]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1));
    return sd || 1e-9;
  };
  const sCalo = scala('calo'), sRend = scala('rendimentoAnno'), sVol = scala('volatilita');
  return validi.filter((s) =>
    Math.abs(s.calo - corrente.calo) <= tolleranza * sCalo
    && Math.abs(s.rendimentoAnno - corrente.rendimentoAnno) <= tolleranza * sRend
    && Math.abs(s.volatilita - corrente.volatilita) <= tolleranza * sVol);
}

// Rendimento composto nei `orizzonte` mesi successivi al mese `i`. Restituisce
// null se la storia finisce prima: un orizzonte troncato darebbe un rendimento
// piu' basso per costruzione, e sarebbe un errore invisibile.
export function rendimentoFuturo(rendimenti, i, orizzonte) {
  if (i + orizzonte >= rendimenti.length) return null;
  let c = 1;
  for (let k = i + 1; k <= i + orizzonte; k++) {
    const v = rendimenti[k];
    if (!Number.isFinite(v)) return null;
    c *= (1 + v);
  }
  return c - 1;
}

// ── IL TEST: lo stato di oggi aggiunge informazione? ──
// Ipotesi nulla: i mesi "simili a oggi" non hanno un futuro diverso dagli
// altri. Si rimescolano BLOCCHI contigui lunghi quanto l'orizzonte — cosi' la
// sovrapposizione fra finestre resta anche sotto l'ipotesi nulla, invece di
// sparire e far sembrare significativo tutto.
export function testBlocchi(futuriTutti, indiciSimili, orizzonte, { permutazioni = PERMUTAZIONI, rng = Math.random } = {}) {
  const validi = futuriTutti.map((v, i) => ({ v, i })).filter((x) => Number.isFinite(x.v));
  const set = new Set(indiciSimili);
  const dentro = validi.filter((x) => set.has(x.i)).map((x) => x.v);
  if (dentro.length < 2 || validi.length - dentro.length < 2) return null;

  const osservato = mediana(dentro) - mediana(validi.filter((x) => !set.has(x.i)).map((x) => x.v));
  const blocco = Math.max(1, orizzonte);
  const serie = validi.map((x) => x.v);
  const nBlocchi = Math.ceil(serie.length / blocco);

  let almenoEstremi = 0;
  for (let p = 0; p < permutazioni; p++) {
    // Rimescolamento a blocchi: si riordinano blocchi interi, mantenendo
    // intatta la struttura di sovrapposizione dentro ciascuno.
    const ordine = Array.from({ length: nBlocchi }, (_, k) => k);
    for (let k = ordine.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [ordine[k], ordine[j]] = [ordine[j], ordine[k]];
    }
    const mescolata = [];
    for (const b of ordine) mescolata.push(...serie.slice(b * blocco, (b + 1) * blocco));

    const a = [], bb = [];
    for (let k = 0; k < mescolata.length; k++) (k < dentro.length ? a : bb).push(mescolata[k]);
    if (a.length < 2 || bb.length < 2) continue;
    if (Math.abs(mediana(a) - mediana(bb)) >= Math.abs(osservato)) almenoEstremi++;
  }

  const p = (almenoEstremi + 1) / (permutazioni + 1);
  return {
    differenzaMediana: +(100 * osservato).toFixed(2),
    p: +p.toFixed(3),
    informativo: p < 0.05,
    // Il numero che ridimensiona tutto: quante prove DAVVERO indipendenti.
    casiEfficaci: Math.floor(dentro.length / blocco),
  };
}

// ── IL REFERTO ──
export function previsioneCondizionata(rendimenti = [], {
  orizzonte = 12, finestra = 12, tolleranza = 0.75, rng = Math.random,
  permutazioni = PERMUTAZIONI, etichetta = 'questo mercato', statoCorrente = null,
} = {}) {
  const stati = statiMensili(rendimenti, { finestra });
  // Di norma lo stato e' quello dell'ultimo mese disponibile. Si puo' pero'
  // interrogare uno stato DIVERSO — "e se fossimo a meta' di un crollo?" — ed
  // e' una domanda legittima e frequente, non un artificio da test.
  const corrente = statoCorrente || [...stati].reverse().find(Boolean);
  if (!corrente) {
    return { disponibile: false, motivo: `Servono almeno ${finestra + 1} mesi di storia per dire in che situazione siamo oggi.` };
  }

  const vicini = simili(stati, corrente, { tolleranza });
  const futuriTutti = rendimenti.map((_, i) => rendimentoFuturo(rendimenti, i, orizzonte));
  const conFuturo = vicini.filter((s) => Number.isFinite(futuriTutti[s.indice]));
  const esiti = conFuturo.map((s) => futuriTutti[s.indice]);

  if (esiti.length < MIN_CASI) {
    return {
      disponibile: false,
      casi: esiti.length,
      motivo: `Una situazione come quella di oggi si e' presentata solo ${esiti.length} volte in tutto l'archivio, e con meno di ${MIN_CASI} casi qualunque percentuale sarebbe un aneddoto travestito da statistica.`,
    };
  }

  const tuttiEsiti = finiti(futuriTutti);
  const test = testBlocchi(futuriTutti, conFuturo.map((s) => s.indice), orizzonte, { permutazioni, rng });
  const pct = (x) => (x === null ? null : +(100 * x).toFixed(1));

  return {
    disponibile: true,
    etichetta,
    orizzonte,
    casi: esiti.length,
    oggi: {
      caloDalMassimo: pct(corrente.calo),
      rendimentoUltimoAnno: pct(corrente.rendimentoAnno),
      volatilita: pct(corrente.volatilita),
    },
    condizionata: {
      mediana: pct(mediana(esiti)),
      primoQuartile: pct(quantile(esiti, 0.25)),
      terzoQuartile: pct(quantile(esiti, 0.75)),
      peggiore: pct(Math.min(...esiti)),
      migliore: pct(Math.max(...esiti)),
      quotaPositivi: +(100 * esiti.filter((x) => x > 0).length / esiti.length).toFixed(0),
    },
    disempre: {
      mediana: pct(mediana(tuttiEsiti)),
      quotaPositivi: +(100 * tuttiEsiti.filter((x) => x > 0).length / tuttiEsiti.length).toFixed(0),
      casi: tuttiEsiti.length,
    },
    test,
    avvisi: [
      `Le finestre a ${orizzonte} mesi si sovrappongono: i casi sembrano ${esiti.length} ma le prove indipendenti sono circa ${test ? test.casiEfficaci : Math.floor(esiti.length / orizzonte)}.`,
      'E\' cio\' che e\' successo in passato in situazioni simili, non cio\' che succedera\': il futuro non e\' obbligato a somigliare all\'archivio.',
      'La forbice fra il caso peggiore e il migliore conta piu\' della mediana: e\' li\' che si vede quanto poco si puo\' dire.',
    ],
  };
}

// Il testo per una persona. La regola: la forbice prima della mediana, e se lo
// stato di oggi non informa, si dice per primo — perche' e' la cosa piu'
// importante e quella che tutti nascondono.
export function testoPrevisione(r) {
  if (!r?.disponibile) return r?.motivo || null;
  const c = r.condizionata, t = r.test;

  const apertura = t && !t.informativo
    ? `Partiamo dalla cosa piu' onesta: la situazione di oggi NON cambia in modo distinguibile cio' che e' successo dopo. Nell'archivio, mesi come questo sono stati seguiti da risultati simili a quelli di un mese qualunque.`
    : `Situazioni come quella di oggi si sono presentate ${r.casi} volte.`;

  const forbice = `Nei ${r.orizzonte} mesi successivi il risultato e' andato da ${c.peggiore}% a ${c.migliore}%: meta' delle volte fra ${c.primoQuartile}% e ${c.terzoQuartile}%, con mediana ${c.mediana}% e ${c.quotaPositivi} volte su cento in positivo.`;

  const confronto = `Senza guardare la situazione, su tutto l'archivio la mediana e' ${r.disempre.mediana}% e i casi positivi sono ${r.disempre.quotaPositivi} su cento.`;

  const cautela = t
    ? ` Le prove davvero indipendenti sono circa ${t.casiEfficaci}, non ${r.casi}: le finestre si sovrappongono.`
    : '';

  return `${apertura} ${forbice} ${confronto}${cautela} Non e' una previsione e non e' un consiglio: e' cosa e' gia' accaduto in situazioni simili.`;
}
