// ============================================================
// MATERIE PRIME E IMMOBILIARE — sessantasei e settantotto anni
// ============================================================
// Questo modulo esiste per rispondere alle domande che la gente fa davvero
// sull'oro, sui metalli, sul petrolio e sulla casa. Sono domande in cui il
// senso comune è quasi sempre sbagliato, e lo è per un motivo preciso e
// meccanico: **su orizzonti lunghi i prezzi nominali mentono**.
//
// L'oro nel 1970 costava 35 dollari e oggi ne costa duemila. Sembra il miglior
// investimento della storia. Ma nel 1970 con un dollaro si comprava otto volte
// quello che ci si compra adesso, e quasi tutta quella salita è inflazione
// travestita da guadagno. È lo stesso errore già visto nel modulo causale con
// i livelli contro le variazioni: due serie che salgono insieme perché tutto
// sale, e uno ci legge una relazione.
//
// Quindi qui si deflaziona SEMPRE. Non come raffinatezza da statistici: senza,
// ogni singola risposta di questo modulo sarebbe falsa.
//
// Funzioni PURE.
'use strict';

import { PREZZI_MP, CPI_USA, MP_MESE, NOMI_MP, FAMIGLIE, MP_DA, MP_A, MP_MESI, MP_FONTE } from './materie-prime-panel.js';
import { IMM_REALE, IMM_DATE, NOMI_IMM, CONTINENTI, IMM_DA, IMM_A, IMM_TRIMESTRI, IMM_FONTE } from './immobiliare-panel.js';

export const MATERIE = Object.keys(PREZZI_MP);
// Rieportati per chi consuma questo modulo (il QA) senza importare i pannelli.
export const NOMI_IMMOBILIARE = NOMI_IMM;
export const NOMI_MATERIE = NOMI_MP;

export function pannelloMaterie() {
  return {
    mesi: MP_MESI, da: MP_DA, a: MP_A, fonte: MP_FONTE,
    serie: MATERIE.map((k) => {
      const v = PREZZI_MP[k];
      const primo = v.findIndex((x) => x !== null);
      return { chiave: k, nome: NOMI_MP[k], mesi: v.filter((x) => x !== null).length, da: primo >= 0 ? MP_MESE[primo] : null };
    }),
    famiglie: FAMIGLIE,
  };
}

export function pannelloImmobiliare() {
  return {
    trimestri: IMM_TRIMESTRI, da: IMM_DA, a: IMM_A, fonte: IMM_FONTE, continenti: CONTINENTI,
    aree: Object.keys(IMM_REALE).map((k) => {
      const v = IMM_REALE[k];
      const primo = v.findIndex((x) => x !== null);
      return { chiave: k, nome: NOMI_IMM[k], trimestri: v.filter((x) => x !== null).length, da: primo >= 0 ? IMM_DATE[primo] : null };
    }),
  };
}

// ── Il deflatore, che è il cuore di tutto il modulo ──
// Prezzo reale = prezzo nominale diviso il livello dei prezzi, riportato al
// potere d'acquisto dell'ultimo mese disponibile. Così "l'oro valeva X" si
// legge come "l'oro valeva X dollari di oggi", che è l'unica forma in cui un
// numero del 1970 significa qualcosa.
export function serieReale(chiave) {
  const nom = PREZZI_MP[chiave];
  if (!nom) return null;
  const base = [...CPI_USA].reverse().find((x) => x !== null);
  return nom.map((p, i) => (p === null || CPI_USA[i] === null ? null : (p * base) / CPI_USA[i]));
}

// ── L'INGANNO NOMINALE, misurato ──
// Non "attenzione all'inflazione" come avvertenza generica: quanto grande è
// l'inganno, materia per materia, in numeri.
export function ingannoNominale(chiave) {
  const nom = PREZZI_MP[chiave]; const re = serieReale(chiave);
  if (!nom || !re) return { valido: false, motivo: `serie sconosciuta: ${chiave}` };
  const i0 = nom.findIndex((x) => x !== null);
  const i1 = nom.length - 1 - [...nom].reverse().findIndex((x) => x !== null);
  if (i0 < 0 || i1 <= i0) return { valido: false, motivo: 'serie troppo corta' };
  const anni = (i1 - i0) / 12;
  const crescitaNom = nom[i1] / nom[i0];
  const crescitaReale = re[i1] / re[i0];
  const annuoNom = crescitaNom ** (1 / anni) - 1;
  const annuoReale = crescitaReale ** (1 / anni) - 1;
  return {
    valido: true, chiave, nome: NOMI_MP[chiave], anni: +anni.toFixed(1),
    da: MP_MESE[i0], a: MP_MESE[i1],
    prezzoIniziale: +nom[i0].toFixed(2), prezzoFinale: +nom[i1].toFixed(2),
    voltePiuCaroNominale: +crescitaNom.toFixed(2),
    voltePiuCaroReale: +crescitaReale.toFixed(2),
    annuoNominale: +(annuoNom * 100).toFixed(2),
    annuoReale: +(annuoReale * 100).toFixed(2),
    // Quanta parte della salita apparente era solo inflazione.
    quotaInflazione: crescitaNom > 1 ? +(1 - Math.log(Math.max(crescitaReale, 1e-9)) / Math.log(crescitaNom)).toFixed(3) : null,
    haPersoPotereDacquisto: crescitaReale < 1,
  };
}

// ── QUANTO CI HAI MESSO A TORNARE IN PARI, in potere d'acquisto ──
// La domanda che nessuno fa e che conta più di tutte: se avessi comprato al
// massimo, quanti anni sarebbero passati prima di rivedere i miei soldi?
// In termini REALI, perché tornare al prezzo nominale di partenza dopo
// vent'anni di inflazione non è tornare in pari: è aver perso.
export function tempoPerTornareInPari(chiave) {
  const re = serieReale(chiave);
  if (!re) return { valido: false, motivo: `serie sconosciuta: ${chiave}` };
  let picco = -Infinity, iPicco = -1;
  let peggiore = null;
  for (let i = 0; i < re.length; i++) {
    if (re[i] === null) continue;
    if (re[i] >= picco) {
      // Un picco si "chiude" quando viene superato: qui si è appena chiuso.
      if (iPicco >= 0 && (peggiore === null || i - iPicco > peggiore.mesi)) {
        let fondo = Infinity, iFondo = iPicco;
        for (let j = iPicco; j <= i; j++) if (re[j] !== null && re[j] < fondo) { fondo = re[j]; iFondo = j; }
        peggiore = { mesi: i - iPicco, dalPicco: MP_MESE[iPicco], alRecupero: MP_MESE[i], fondo: MP_MESE[iFondo], calo: fondo / picco - 1 };
      }
      picco = re[i]; iPicco = i;
    }
  }
  // Se oggi siamo ancora sotto un vecchio massimo, quella è l'attesa in corso.
  const ultimo = re.length - 1 - [...re].reverse().findIndex((x) => x !== null);
  const inCorso = iPicco >= 0 && ultimo > iPicco
    ? { mesi: ultimo - iPicco, dalPicco: MP_MESE[iPicco], sottoDi: +(re[ultimo] / picco - 1).toFixed(4) }
    : null;
  if (!peggiore && !inCorso) return { valido: false, motivo: 'nessun periodo sotto il massimo' };
  return {
    valido: true, chiave, nome: NOMI_MP[chiave],
    attesaPiuLunga: peggiore ? { ...peggiore, anni: +(peggiore.mesi / 12).toFixed(1), calo: +peggiore.calo.toFixed(4) } : null,
    attesaInCorso: inCorso ? { ...inCorso, anni: +(inCorso.mesi / 12).toFixed(1) } : null,
  };
}

// ── L'ORO PROTEGGE DALL'INFLAZIONE? Misurato, non ripetuto ──
// È la frase più ripetuta sull'oro. Se fosse vera, nei periodi di inflazione
// alta l'oro reale dovrebbe salire, e in modo affidabile. Si guarda su
// finestre mobili di dieci anni: l'orizzonte in cui uno ci crede davvero.
export function protezioneDallInflazione(chiave = 'oro', { anniFinestra = 10 } = {}) {
  const re = serieReale(chiave);
  if (!re) return { valido: false, motivo: `serie sconosciuta: ${chiave}` };
  const w = anniFinestra * 12;
  const casi = [];
  for (let i = 0; i + w < re.length; i++) {
    if (re[i] === null || re[i + w] === null || CPI_USA[i] === null || CPI_USA[i + w] === null) continue;
    const inflAnnua = (CPI_USA[i + w] / CPI_USA[i]) ** (12 / w) - 1;
    const realeAnnuo = (re[i + w] / re[i]) ** (12 / w) - 1;
    casi.push({ da: MP_MESE[i], inflAnnua, realeAnnuo });
  }
  if (casi.length < 60) return { valido: false, motivo: 'finestre insufficienti' };
  const soglia = casi.map((c) => c.inflAnnua).sort((a, b) => a - b)[Math.floor(casi.length * 0.75)];
  const alta = casi.filter((c) => c.inflAnnua >= soglia);
  const bassa = casi.filter((c) => c.inflAnnua < soglia);
  const med = (a) => a.reduce((s, c) => s + c.realeAnnuo, 0) / a.length;
  const quota = (a) => a.filter((c) => c.realeAnnuo > 0).length / a.length;
  return {
    valido: true, chiave, nome: NOMI_MP[chiave], anniFinestra, finestre: casi.length,
    sogliaInflazioneAlta: +(soglia * 100).toFixed(2),
    conInflazioneAlta: { finestre: alta.length, rendimentoRealeAnnuo: +(med(alta) * 100).toFixed(2), quotaPositive: +quota(alta).toFixed(3) },
    conInflazioneBassa: { finestre: bassa.length, rendimentoRealeAnnuo: +(med(bassa) * 100).toFixed(2), quotaPositive: +quota(bassa).toFixed(3) },
    // "Protegge" vuol dire due cose insieme: rende di più quando l'inflazione
    // morde, E lo fa abbastanza spesso da poterci contare. Una sola delle due
    // non basta: una media alta trascinata da un caso su dieci non è una
    // protezione, è una lotteria che è andata bene.
    proteggeDavvero: med(alta) > med(bassa) && quota(alta) >= 0.7,
    perche: med(alta) > med(bassa)
      ? (quota(alta) >= 0.7 ? 'rende di piu\' quando l\'inflazione e\' alta, e lo fa quasi sempre' : 'in media rende di piu\' quando l\'inflazione e\' alta, ma NON abbastanza spesso da poterci contare')
      : 'non rende di piu\' quando l\'inflazione e\' alta',
  };
}

// ── LE TERRE RARE NON SONO UN METALLO, SONO AZIONI ──
// Non esiste un prezzo pubblico delle terre rare. L'unico dato libero è un ETF
// di società minerarie, e chiamarlo "terre rare" è comodo e sbagliato. Qui si
// misura di cosa è fatto davvero: se si muove con i metalli o con la borsa.
export function terreRareSonoAzioni(mercatoAzionario) {
  const re = serieReale('terreRare');
  const rame = serieReale('rame');
  if (!re) return { valido: false, motivo: 'serie terre rare assente' };
  const var_ = (s) => s.map((x, i) => (i === 0 || x === null || s[i - 1] === null ? null : x / s[i - 1] - 1));
  const vRe = var_(re), vRame = var_(rame);
  const corr = (a, b) => {
    const p = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== null && b[i] !== null && Number.isFinite(a[i]) && Number.isFinite(b[i])) p.push([a[i], b[i]]);
    if (p.length < 24) return null;
    const mx = p.reduce((s, x) => s + x[0], 0) / p.length, my = p.reduce((s, x) => s + x[1], 0) / p.length;
    let n = 0, dx = 0, dy = 0;
    for (const [x, y] of p) { n += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
    return dx > 0 && dy > 0 ? { r: n / Math.sqrt(dx * dy), n: p.length } : null;
  };
  const conRame = corr(vRe, vRame);
  // Il mercato azionario arriva da fuori (l'allineamento dei mesi è del
  // chiamante): se non c'è, si risponde con quello che si ha e lo si dice.
  const conBorsa = mercatoAzionario ? corr(vRe, var_(mercatoAzionario)) : null;
  return {
    valido: true,
    mesiDisponibili: re.filter((x) => x !== null).length,
    da: MP_MESE[re.findIndex((x) => x !== null)],
    correlazioneConIlRame: conRame ? +conRame.r.toFixed(3) : null,
    correlazioneConLaBorsa: conBorsa ? +conBorsa.r.toFixed(3) : null,
    // Se somiglia più alla borsa che al metallo, chi lo compra "per esporsi
    // alle terre rare" si sta comprando azioni con un'etichetta esotica.
    eAzionario: conBorsa && conRame ? Math.abs(conBorsa.r) > Math.abs(conRame.r) : null,
    avvertenza: 'non e\' il prezzo delle terre rare: e\' un fondo di societa\' minerarie, quindi ha dentro il rischio d\'impresa e il beta di mercato. Un prezzo pubblico e continuo delle terre rare non esiste: si scambiano per contratti bilaterali e i listini seri sono a pagamento.',
  };
}

// ── QUANTE COSE DIVERSE SONO DAVVERO? ──
// Tredici materie prime sembrano tredici scelte. Se si muovono insieme, sono
// una sola scommessa scritta tredici volte — ed è la differenza fra un
// portafoglio diversificato e uno che sembra diversificato.
export function quanteScommesseDavvero({ daMese = '1990-01' } = {}) {
  const i0 = Math.max(0, MP_MESE.indexOf(daMese));
  const serie = MATERIE.map((k) => ({ k, v: serieReale(k)?.slice(i0) })).filter((s) => s.v);
  const var_ = (s) => s.map((x, i) => (i === 0 || x === null || s[i - 1] === null ? null : Math.log(x / s[i - 1])));
  const V = serie.map((s) => ({ k: s.k, v: var_(s.v) }));
  const coppie = [];
  for (let a = 0; a < V.length; a++) {
    for (let b = a + 1; b < V.length; b++) {
      const p = [];
      for (let i = 0; i < V[a].v.length; i++) if (Number.isFinite(V[a].v[i]) && Number.isFinite(V[b].v[i])) p.push([V[a].v[i], V[b].v[i]]);
      if (p.length < 60) continue;
      const mx = p.reduce((s, x) => s + x[0], 0) / p.length, my = p.reduce((s, x) => s + x[1], 0) / p.length;
      let n = 0, dx = 0, dy = 0;
      for (const [x, y] of p) { n += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
      if (dx <= 0 || dy <= 0) continue;
      coppie.push({ a: V[a].k, b: V[b].k, r: n / Math.sqrt(dx * dy), n: p.length });
    }
  }
  if (!coppie.length) return { valido: false, motivo: 'dati insufficienti' };
  const famiglia = (k) => Object.entries(FAMIGLIE).find(([, v]) => v.includes(k))?.[0] ?? 'altro';
  const dentro = coppie.filter((c) => famiglia(c.a) === famiglia(c.b));
  const fuori = coppie.filter((c) => famiglia(c.a) !== famiglia(c.b));
  const med = (a) => (a.length ? a.reduce((s, c) => s + c.r, 0) / a.length : null);
  return {
    valido: true, daMese, coppie: coppie.length,
    mediaDentroLaStessaFamiglia: dentro.length ? +med(dentro).toFixed(3) : null,
    mediaFraFamiglieDiverse: fuori.length ? +med(fuori).toFixed(3) : null,
    piuLegate: [...coppie].sort((a, b) => b.r - a.r).slice(0, 3).map((c) => ({ coppia: `${NOMI_MP[c.a]} e ${NOMI_MP[c.b]}`, r: +c.r.toFixed(3) })),
    piuIndipendenti: [...coppie].sort((a, b) => Math.abs(a.r) - Math.abs(b.r)).slice(0, 3).map((c) => ({ coppia: `${NOMI_MP[c.a]} e ${NOMI_MP[c.b]}`, r: +c.r.toFixed(3) })),
  };
}

// ── LA CASA: cicli lunghissimi, e il caso giapponese ──
// L'immobiliare ha una fama: "il mattone non scende mai". È falsa, e il modo
// più rapido di mostrarlo non è un'opinione ma il Giappone.
export function ciclioImmobiliari(area) {
  const v = IMM_REALE[area];
  if (!v) return { valido: false, motivo: `area sconosciuta: ${area}` };
  let picco = -Infinity, iPicco = -1, peggiore = null, iUlt = -1;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === null) continue;
    iUlt = i;
    if (v[i] >= picco) { picco = v[i]; iPicco = i; continue; }
    const calo = v[i] / picco - 1;
    if (peggiore === null || calo < peggiore.calo) peggiore = { calo, dalPicco: IMM_DATE[iPicco], fondo: IMM_DATE[i], trimestri: i - iPicco };
  }
  const oggi = iUlt >= 0 ? v[iUlt] : null;
  // Il massimo storico, e se è stato recuperato.
  let max = -Infinity, iMax = -1;
  for (let i = 0; i < v.length; i++) if (v[i] !== null && v[i] > max) { max = v[i]; iMax = i; }
  return {
    valido: true, area, nome: NOMI_IMM[area],
    trimestri: v.filter((x) => x !== null).length, da: IMM_DATE[v.findIndex((x) => x !== null)],
    caloPeggiore: peggiore ? { ...peggiore, calo: +peggiore.calo.toFixed(4), anni: +(peggiore.trimestri / 4).toFixed(1) } : null,
    massimoStorico: IMM_DATE[iMax],
    oggiRispettoAlMassimo: oggi !== null && max > 0 ? +(oggi / max - 1).toFixed(4) : null,
    anniDalMassimo: iMax >= 0 && iUlt >= 0 ? +((iUlt - iMax) / 4).toFixed(1) : null,
    // Il fatto che smonta il luogo comune.
    ancoraSottoIlMassimo: oggi !== null && oggi < max * 0.99,
  };
}

// "E nel resto del mondo?" — ventotto Paesi, cinque continenti. La domanda
// non e' retorica: se un mercato immobiliare scende e gli altri no, e' una
// storia locale; se scendono tutti insieme, e' il costo del denaro, ed e' una
// storia che riguarda anche chi non ha una casa.
export function confrontoImmobiliareMondo({ continente = null } = {}) {
  const chiavi = continente ? (CONTINENTI[continente] ?? []) : Object.keys(IMM_REALE);
  const righe = chiavi.map((k) => ciclioImmobiliari(k)).filter((r) => r.valido);
  if (!righe.length) return { aree: [], quanteAncoraSottoIlMassimo: 0, suQuante: 0, peggiore: null, attesaPiuLunga: null, continente };
  const sotto = righe.filter((r) => r.ancoraSottoIlMassimo);
  return {
    continente, aree: righe,
    quanteAncoraSottoIlMassimo: sotto.length, suQuante: righe.length,
    peggiore: righe.reduce((a, b) => ((a?.caloPeggiore?.calo ?? 0) < (b?.caloPeggiore?.calo ?? 0) ? a : b), null),
    attesaPiuLunga: righe.filter((r) => r.ancoraSottoIlMassimo).sort((a, b) => b.anniDalMassimo - a.anniDalMassimo)[0] ?? null,
  };
}

// ── I testi ──
export function ingannoText(g) {
  if (!g?.valido) return null;
  const nom = `${g.voltePiuCaroNominale} volte`;
  if (g.haPersoPotereDacquisto) {
    return `${g.nome}: dal ${g.da} il prezzo e' salito ${nom}, e sembra tantissimo. Ma in quegli stessi ${g.anni} anni sono saliti tutti i prezzi, e togliendo l'inflazione ${g.nome.toLowerCase()} vale OGGI MENO di allora (${g.annuoReale}% l'anno). Chi guarda il prezzo in dollari vede un guadagno che non c'e' mai stato.`;
  }
  return `${g.nome}: dal ${g.da} il prezzo e' salito ${nom} in dollari, ma quasi tutta quella salita e' inflazione. Tolta quella restano ${g.annuoReale}% l'anno di guadagno vero, contro il ${g.annuoNominale}% che si legge sul grafico. Su ${g.anni} anni la differenza fra i due numeri e' quasi tutto quello che conta.`;
}

export function attesaText(t) {
  if (!t?.valido) return null;
  const p = [];
  if (t.attesaPiuLunga) {
    p.push(`Chi ha comprato ${t.nome.toLowerCase()} al massimo del ${t.attesaPiuLunga.dalPicco} ha aspettato ${t.attesaPiuLunga.anni} anni prima di rivedere i propri soldi in potere d'acquisto, passando per un calo del ${Math.abs(Math.round(t.attesaPiuLunga.calo * 100))}%.`);
  }
  if (t.attesaInCorso && t.attesaInCorso.anni >= 1) {
    p.push(`E in questo momento siamo ancora ${Math.abs(Math.round(t.attesaInCorso.sottoDi * 100))}% sotto il massimo del ${t.attesaInCorso.dalPicco}: sono ${t.attesaInCorso.anni} anni che dura.`);
  }
  p.push('Non e\' un argomento contro: e\' la durata che bisogna essere disposti a sopportare, e quasi nessuno la conosce prima di comprare.');
  return p.join(' ');
}

// Il testo sul mondo intero, che e' la risposta a "e altrove?".
export function mondoImmobiliareText(c) {
  if (!c?.suQuante) return null;
  const dove = c.continente ? `in ${c.continente}` : 'nel mondo';
  const q = c.quanteAncoraSottoIlMassimo === c.suQuante
    ? `tutti e ${c.suQuante}`
    : `${c.quanteAncoraSottoIlMassimo} su ${c.suQuante}`;
  // Niente articoli davanti ai nomi di Paese: "quello della Irlanda" e "quello
  // del Paesi Bassi" sono il genere di dettaglio che fa sembrare tutto il resto
  // approssimativo. La preposizione "in" funziona con tutti.
  const p = c.peggiore?.caloPeggiore
    ? ` Il crollo peggiore mai visto e' in ${c.peggiore.nome}: ${Math.abs(Math.round(c.peggiore.caloPeggiore.calo * 100))}% in ${c.peggiore.caloPeggiore.anni} anni.`
    : '';
  const a = c.attesaPiuLunga
    ? ` E chi ha comprato casa in ${c.attesaPiuLunga.nome} al massimo del ${c.attesaPiuLunga.massimoStorico} aspetta da ${c.attesaPiuLunga.anniDalMassimo} anni di rivedere quel prezzo.`
    : '';
  return `Ho i prezzi delle case ${dove} per ${c.suQuante} Paesi, gia' al netto dell'inflazione, e in ${q} i prezzi sono ancora sotto il loro massimo storico.${p}${a} "Il mattone non scende mai" e' una frase che non regge in nessuno dei Paesi che guardo.`;
}

export function immobiliareText(c) {
  if (!c?.valido) return null;
  const base = `${c.nome}: ho ${c.trimestri} trimestri di prezzi delle case dal ${String(c.da).slice(0, 4)}, gia' al netto dell'inflazione.`;
  const calo = c.caloPeggiore
    ? ` Il calo peggiore e' stato del ${Math.abs(Math.round(c.caloPeggiore.calo * 100))}%, dal ${c.caloPeggiore.dalPicco} al ${c.caloPeggiore.fondo}: ${c.caloPeggiore.anni} anni di discesa.`
    : '';
  const oggi = c.ancoraSottoIlMassimo
    ? ` E oggi i prezzi sono ancora ${Math.abs(Math.round(c.oggiRispettoAlMassimo * 100))}% sotto il massimo del ${c.massimoStorico}, raggiunto ${c.anniDalMassimo} anni fa. "Il mattone non scende mai" e' una frase, non un dato.`
    : ` Oggi i prezzi sono sui massimi o vicini.`;
  return base + calo + oggi;
}
