// ============================================================
// "LA CRIPTO MI DIVERSIFICA" — QUANTO E' VERO, MISURATO
// ============================================================
// cripto-diversificazione.js risponde a "cinque cripto sono cinque
// scommesse?" — dentro il paniere cripto. Questo modulo risponde alla
// domanda che viene prima e che quasi nessuno si fa: la cripto diversifica
// il resto del portafoglio, o e' la stessa scommessa con un altro nome?
//
// PERCHE' ADESSO. La risposta e' cambiata, e questo e' il punto. Nel 2017
// bitcoin si muoveva per conto suo e "oro digitale" era una descrizione
// difendibile. Oggi la correlazione con l'azionario e' intorno a 0,55 —
// abbastanza da far crollare l'argomento, e comunque troppo poco perche'
// qualcuno se ne accorga guardando il grafico. La riga in portafoglio dice
// "cripto", la testa dice "e' un'altra cosa", i numeri dicono di no.
//
// ── LA MISURA GIUSTA NON E' IL PESO ──
// Chi ha il 10% in cripto crede di rischiare il 10% li' dentro. Sbagliato,
// in entrambe le direzioni: conta quanta parte del rischio TOTALE viene da
// quella riga, e dipende da tre cose insieme — quanto pesa, quanto e'
// volatile, e quanto si muove insieme al resto. Con una volatilita' tripla
// e una correlazione a 0,55, un 10% di peso puo' valere un terzo del
// rischio del portafoglio. E' la scomposizione di Euler del rischio
// (RC_i = w_i · (Σw)_i / σ_p), la stessa che usano i risk desk: qui e'
// scritta in cinque righe perche' la matematica e' semplice — quello che
// manca alle app e' dirla.
//
// ── E LA CORRELAZIONE MEDIA MENTE, sempre nello stesso verso ──
// La diversificazione serve nei giorni brutti, non in media. E proprio nei
// giorni brutti le correlazioni salgono: e' il fenomeno piu' documentato e
// piu' ignorato della gestione del rischio. Un asset con correlazione media
// 0,3 che nei dieci giorni peggiori va a 0,8 non ti ha diversificato niente
// nel momento in cui serviva. Qui si misurano entrambe, e si dichiara la
// differenza — perche' quella differenza E' il rischio.
//
// Tutto puro: nessuna rete, nessuna data letta da dentro. I prezzi li
// portano cripto-diversificazione.js (CoinGecko, live) e stock-history.js.
'use strict';

// Minimo di giorni sotto cui non ci si pronuncia. Con meno storia il numero
// esce lo stesso ma non significa niente, ed e' peggio del silenzio.
export const MIN_GIORNI = 120;
// Quanti giorni peggiori guardare per la correlazione "quando conta". Il 10%
// della storia: con un anno di dati sono ~25 sedute, abbastanza da misurare
// e poche abbastanza da essere davvero la coda.
export const QUOTA_CODA = 0.1;
export const MIN_GIORNI_CODA = 12;

const finito = (x) => Number.isFinite(x);

function media(v) { return v.reduce((s, x) => s + x, 0) / v.length; }

export function deviazione(v = []) {
  if (v.length < 2) return 0;
  const m = media(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

// Pearson. Restituisce `null`, non 0, quando non e' calcolabile: zero
// significa "indipendenti", ed e' una risposta molto diversa da "non lo so".
export function correlazione(a = [], b = []) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const sx = deviazione(x), sy = deviazione(y);
  if (!(sx > 0) || !(sy > 0)) return null;
  const mx = media(x), my = media(y);
  let c = 0;
  for (let i = 0; i < n; i++) c += (x[i] - mx) * (y[i] - my);
  const r = c / ((n - 1) * sx * sy);
  return finito(r) ? Math.max(-1, Math.min(1, r)) : null;
}

// ── LA CORRELAZIONE CHE CONTA DAVVERO ────────────────────────────────────
// Non "in media", ma nei giorni in cui l'azionario e' andato peggio: quelli
// sono i giorni per cui uno diversifica. La coda si sceglie sulle AZIONI e
// si guarda cosa faceva la cripto quel giorno — mai sui giorni peggiori di
// entrambi, che e' l'errore che fa uscire correlazioni finte-alte.
export function correlazioneQuandoConta(rendCripto = [], rendAzioni = [], { quota = QUOTA_CODA } = {}) {
  const n = Math.min(rendCripto.length, rendAzioni.length);
  if (n < MIN_GIORNI) return null;
  const c = rendCripto.slice(-n), a = rendAzioni.slice(-n);
  const quanti = Math.max(MIN_GIORNI_CODA, Math.round(n * quota));
  if (quanti >= n) return null;
  const indici = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]).slice(0, quanti).map(([, i]) => i);
  return correlazione(indici.map(i => c[i]), indici.map(i => a[i]));
}

// ── QUANTO DEL RISCHIO VIENE DA OGNI RIGA ────────────────────────────────
// Scomposizione di Euler. `voci` = [{ nome, peso, volatilita }], `corr` =
// matrice simmetrica delle correlazioni fra le voci, nello stesso ordine.
// I contributi sommano a 1 per costruzione: e' la proprieta' che rende
// questa la scomposizione giusta e non una delle tante ripartizioni
// arbitrarie che si vedono in giro (ed e' verificata dai test).
export function contributoAlRischio(voci = [], corr = []) {
  const n = voci.length;
  if (!n) return null;
  const pesi = voci.map(v => Math.max(0, +v.peso || 0));
  const vol = voci.map(v => Math.max(0, +v.volatilita || 0));
  const somma = pesi.reduce((s, x) => s + x, 0);
  if (!(somma > 0)) return null;
  const w = pesi.map(p => p / somma); // normalizzati: il conto e' sulle quote
  // Σw, dove Σ_ij = corr_ij · vol_i · vol_j
  const sw = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = i === j ? 1 : (finito(corr?.[i]?.[j]) ? corr[i][j] : 0);
      sw[i] += c * vol[i] * vol[j] * w[j];
    }
  }
  const varianza = w.reduce((s, wi, i) => s + wi * sw[i], 0);
  if (!(varianza > 0)) return null;
  const sigma = Math.sqrt(varianza);
  return {
    volatilitaPortafoglio: sigma,
    voci: voci.map((v, i) => ({
      nome: v.nome,
      peso: w[i],
      volatilita: vol[i],
      // Quota del rischio totale attribuibile a questa riga.
      contributo: (w[i] * sw[i]) / varianza,
      // Quanto il rischio scenderebbe togliendola: NON e' il contributo, ed
      // e' la domanda che la gente si fa davvero ("se la vendo, cosa cambia?").
      contributoAssoluto: (w[i] * sw[i]) / sigma,
    })),
  };
}

// ── IL REFERTO ───────────────────────────────────────────────────────────
// `serie` = { cripto: [rendimenti], azioni: [rendimenti] } giornalieri e
// allineati per data (chi li fornisce garantisce l'allineamento: mescolare
// giorni diversi qui produrrebbe una correlazione inventata).
// `pesi` = { cripto, azioni } in valore, non in percentuale.
export function esposizioneCripto({ serie = {}, pesi = {} } = {}) {
  const rc = Array.isArray(serie.cripto) ? serie.cripto.filter(finito) : [];
  const ra = Array.isArray(serie.azioni) ? serie.azioni.filter(finito) : [];
  const n = Math.min(rc.length, ra.length);
  const pCripto = Math.max(0, +pesi.cripto || 0);
  const pAzioni = Math.max(0, +pesi.azioni || 0);

  if (pCripto <= 0 || pAzioni <= 0) {
    return { misurabile: false, motivo: 'servono sia cripto sia azioni in portafoglio' };
  }
  if (n < MIN_GIORNI) {
    return { misurabile: false, motivo: `servono almeno ${MIN_GIORNI} giorni di storia per entrambi (ce ne sono ${n})` };
  }

  const c = rc.slice(-n), a = ra.slice(-n);
  const corrMedia = correlazione(c, a);
  const corrCoda = correlazioneQuandoConta(c, a);
  if (corrMedia === null) {
    return { misurabile: false, motivo: 'una delle due serie non si muove: correlazione non definita' };
  }

  // Annualizzate: e' l'unita' in cui la gente ha un'idea di cosa sia una
  // volatilita' del 20% o dell'80%. 252 sedute.
  const volCripto = deviazione(c) * Math.sqrt(252);
  const volAzioni = deviazione(a) * Math.sqrt(252);

  const scomposizione = contributoAlRischio(
    [{ nome: 'cripto', peso: pCripto, volatilita: volCripto },
     { nome: 'azioni', peso: pAzioni, volatilita: volAzioni }],
    [[1, corrMedia], [corrMedia, 1]],
  );
  if (!scomposizione) return { misurabile: false, motivo: 'volatilità nulla: niente da scomporre' };

  const vCripto = scomposizione.voci[0];
  // Lo STESSO conto rifatto con la correlazione della coda: e' lo scenario
  // che conta, e la differenza fra i due numeri e' l'informazione vera.
  const scompCoda = corrCoda === null ? null : contributoAlRischio(
    [{ nome: 'cripto', peso: pCripto, volatilita: volCripto },
     { nome: 'azioni', peso: pAzioni, volatilita: volAzioni }],
    [[1, corrCoda], [corrCoda, 1]],
  );

  const peso = vCripto.peso;
  const contributo = vCripto.contributo;
  return {
    misurabile: true,
    giorni: n,
    correlazioneMedia: +corrMedia.toFixed(3),
    correlazioneQuandoConta: corrCoda === null ? null : +corrCoda.toFixed(3),
    // Positivo = nei giorni brutti si muovono INSIEME più che in media, cioè
    // la diversificazione sparisce proprio quando servirebbe.
    peggioramentoNeiCrolli: corrCoda === null ? null : +(corrCoda - corrMedia).toFixed(3),
    volatilitaCripto: +volCripto.toFixed(4),
    volatilitaAzioni: +volAzioni.toFixed(4),
    volatilitaPortafoglio: +scomposizione.volatilitaPortafoglio.toFixed(4),
    pesoCripto: +peso.toFixed(4),
    contributoRischioCripto: +contributo.toFixed(4),
    contributoRischioCriptoNeiCrolli: scompCoda ? +scompCoda.voci[0].contributo.toFixed(4) : null,
    // Quante volte il rischio supera il peso: il numero da dire ad alta voce.
    // 1 = pesa quanto rischia. 3 = ne rischi il triplo di quanto credi.
    moltiplicatore: peso > 0 ? +(contributo / peso).toFixed(2) : null,
    // Diversifica DAVVERO solo se contribuisce meno di quanto pesa.
    diversificaDavvero: contributo < peso,
  };
}

// Il referto in parole. Niente gergo, niente percentili: la frase deve
// funzionare per chi ha comprato bitcoin perche' gliene ha parlato un amico.
export function testoEsposizioneCripto(r) {
  if (!r || !r.misurabile) return r?.motivo ? `Non misurabile: ${r.motivo}.` : 'Non misurabile.';
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const righe = [];
  righe.push(`La cripto è il ${pct(r.pesoCripto)} di quello che hai, ma vale il ${pct(r.contributoRischioCripto)} del rischio.`);
  if (r.moltiplicatore !== null && r.moltiplicatore >= 1.5) {
    righe.push(`Cioè ne rischi ${r.moltiplicatore} volte più di quanto pesa.`);
  }
  if (r.diversificaDavvero) {
    righe.push('Su questi dati sta ancora facendo il suo mestiere: abbassa il rischio invece di alzarlo.');
  } else {
    righe.push('Su questi dati non ti sta diversificando: si muove abbastanza insieme alle azioni da aggiungere rischio, non toglierlo.');
  }
  if (r.correlazioneQuandoConta !== null) {
    if (r.peggioramentoNeiCrolli > 0.1) {
      righe.push(`E nei giorni peggiori per le azioni si muovono ancora più insieme (${r.correlazioneQuandoConta} contro ${r.correlazioneMedia} in media): proprio quando servirebbe che andasse per conto suo, non lo fa.`);
    } else if (r.peggioramentoNeiCrolli < -0.1) {
      righe.push(`Nei giorni peggiori per le azioni si stacca (${r.correlazioneQuandoConta} contro ${r.correlazioneMedia} in media): è lì che ti sta aiutando.`);
    }
  }
  righe.push(`Misurato su ${r.giorni} giorni: è quello che è successo, non una previsione.`);
  return righe.join(' ');
}
