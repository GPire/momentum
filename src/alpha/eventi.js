// ============================================================
// COSA È SUCCESSO DAVVERO, GIORNO PER GIORNO
// ============================================================
// Tutto quello costruito finora lavora su dati mensili. Aprile 2025 dimostra
// perché non basta, e lo dimostra in modo che non lascia margini:
//
//   · rendimento delle azioni USA nel mese:            −0,9%
//   · calo massimo DENTRO il mese:                    −12,1%
//   · giorno peggiore (4 aprile):                      −5,9%, con il VIX a 45
//   · giorno migliore (9 aprile):                     +10,5%
//
// Un dato mensile dice "mese tranquillo". Dentro c'è stato un crollo da doppia
// cifra e uno dei rialzi giornalieri più grandi della storia. Chi ha venduto
// nel mezzo ha realizzato una perdita che il grafico mensile non mostra
// nemmeno, e questo modulo esiste perché quella perdita è reale mentre il
// grafico mensile è una comodità.
//
// COSA PERMETTE DI FARE, e nessuna app di consumo lo fa:
//  · prendere QUALUNQUE periodo passato e vedere la sezione completa — ogni
//    classe di attivo, ogni settore, le cripto, la paura implicita — nello
//    stesso giorno;
//  · trovare i giorni peggiori e leggere cosa ha protetto QUEL giorno, che è
//    diverso da cosa protegge in media;
//  · misurare quanto il dato mensile nasconde, mese per mese, invece di
//    fidarsi.
//
// LA REGOLA SUI NOMI DEGLI EVENTI, la stessa di sempre: si etichetta solo un
// episodio che i PREZZI individuano da soli, e solo se le date coincidono.
// L'etichetta è contesto verificabile, mai una causa dimostrata dai dati.
// Nessuna serie di prezzi può dimostrare perché è scesa, e ricostruire a
// posteriori il motivo di ogni movimento è la cosa più facile e più dannosa
// che si possa fare in finanza.
//
// Funzioni PURE.
'use strict';

import { GIORNALIERO, DATE_GIORNI, N_GIORNI, NOMI_GIORNALIERI, GIORNI_DA, GIORNI_A, GIORNI_FONTE } from './daily-panel.js';

export const CLASSI = ['azioniUsa', 'tecnologia', 'energia', 'beniPrimari', 'finanza', 'oro', 'titoliStato', 'dollaro', 'bitcoin', 'ethereum'];

const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function pannelloGiornaliero() {
  return { giorni: N_GIORNI, da: GIORNI_DA, a: GIORNI_A, fonte: GIORNI_FONTE, classi: CLASSI };
}

const indiciFra = (da, a) => {
  const out = [];
  for (let i = 0; i < DATE_GIORNI.length; i++) if (DATE_GIORNI[i] >= da && DATE_GIORNI[i] <= a) out.push(i);
  return out;
};

const caloMassimo = (rendimenti) => {
  let v = 1, picco = 1, peggio = 0;
  for (const x of rendimenti) { v *= (1 + x); picco = Math.max(picco, v); peggio = Math.max(peggio, 1 - v / picco); }
  return peggio;
};
const cumulato = (rendimenti) => rendimenti.reduce((v, x) => v * (1 + x), 1) - 1;

// ── La sezione completa di un periodo qualunque ──
export function finestra(da, a) {
  const idx = indiciFra(da, a);
  if (!idx.length) return { trovato: false, motivo: `nessun giorno di borsa fra ${da} e ${a} nel pannello (${GIORNI_DA} - ${GIORNI_A})` };

  const perClasse = CLASSI.map((c) => {
    const r = idx.map((i) => GIORNALIERO[c][i]);
    return {
      classe: c, nome: NOMI_GIORNALIERI[c],
      totale: +cumulato(r).toFixed(4),
      caloMassimo: +caloMassimo(r).toFixed(4),
      giornoPeggiore: +Math.min(...r).toFixed(4),
      giornoMigliore: +Math.max(...r).toFixed(4),
    };
  }).sort((x, y) => y.totale - x.totale);

  const eq = idx.map((i) => GIORNALIERO.azioniUsa[i]);
  const vix = idx.map((i) => GIORNALIERO.vix[i]);
  return {
    trovato: true, da: DATE_GIORNI[idx[0]], a: DATE_GIORNI[idx.at(-1)], giorni: idx.length,
    perClasse,
    azioni: { totale: +cumulato(eq).toFixed(4), caloMassimo: +caloMassimo(eq).toFixed(4) },
    paura: { minima: Math.min(...vix), massima: Math.max(...vix), media: +media(vix).toFixed(2) },
    // Il numero che giustifica l'intero modulo: quanto il dato di periodo
    // nasconde rispetto a quello che si e' davvero attraversato.
    quantoNascondeIlDatoDiPeriodo: +(caloMassimo(eq) - Math.max(0, -cumulato(eq))).toFixed(4),
  };
}

// ── I giorni peggiori, e cosa ha protetto QUEL giorno ──
// "Cosa protegge in media" e "cosa ha protetto il 4 aprile" sono due domande
// diverse, e la seconda e' quella che si vive.
export function giorniPeggiori({ quanti = 10 } = {}) {
  const ordine = GIORNALIERO.azioniUsa.map((v, i) => i).sort((a, b) => GIORNALIERO.azioniUsa[a] - GIORNALIERO.azioniUsa[b]);
  return ordine.slice(0, quanti).map((i) => {
    const riga = { data: DATE_GIORNI[i], azioni: +GIORNALIERO.azioniUsa[i].toFixed(4), paura: GIORNALIERO.vix[i], protetti: [], affondati: [] };
    for (const c of CLASSI) {
      if (c === 'azioniUsa') continue;
      const v = GIORNALIERO[c][i];
      riga[c] = +v.toFixed(4);
      (v > 0 ? riga.protetti : riga.affondati).push(NOMI_GIORNALIERI[c]);
    }
    return riga;
  });
}

// ── LE CRIPTO SONO UN RIFUGIO? ──
// Domanda posta spesso e quasi mai misurata sui giorni che contano.
export function criptoNeiCrolli({ quota = 0.05 } = {}) {
  const eq = GIORNALIERO.azioniUsa;
  const ordine = eq.map((v, i) => i).sort((a, b) => eq[a] - eq[b]);
  const k = Math.max(10, Math.floor(quota * eq.length));
  const peggiori = ordine.slice(0, k);
  const riga = (c) => {
    const v = peggiori.map((i) => GIORNALIERO[c][i]);
    return {
      classe: c, nome: NOMI_GIORNALIERI[c],
      medio: +media(v).toFixed(4),
      quotaPositiva: +(v.filter((x) => x > 0).length / v.length).toFixed(3),
      // Amplifica = ha perso PIU' delle azioni: il contrario di un rifugio.
      amplifica: media(v) < media(peggiori.map((i) => eq[i])),
    };
  };
  const btc = riga('bitcoin'), eth = riga('ethereum');
  const oro = riga('oro'), bond = riga('titoliStato'), usd = riga('dollaro');
  return {
    giorniConsiderati: k,
    azioniInQueiGiorni: +media(peggiori.map((i) => eq[i])).toFixed(4),
    cripto: [btc, eth], tradizionali: [oro, bond, usd],
    criptoRifugio: btc.medio > 0 && btc.quotaPositiva > 0.6,
    conclusione: btc.medio > 0 && btc.quotaPositiva > 0.6
      ? 'nei giorni peggiori per le azioni le cripto hanno tenuto'
      : btc.amplifica || eth.amplifica
        ? 'nei giorni peggiori per le azioni le cripto scendono anche di piu\': non sono un rifugio, sono azionario con piu\' leva'
        : 'nei giorni peggiori le cripto scendono insieme alle azioni: non proteggono',
  };
}

// ── Quanto il dato mensile nasconde, mese per mese ──
export function mensileNascondeIlCrollo({ minimo = 0.03 } = {}) {
  const perMese = new Map();
  DATE_GIORNI.forEach((d, i) => {
    const m = d.slice(0, 7);
    if (!perMese.has(m)) perMese.set(m, []);
    perMese.get(m).push(i);
  });
  const righe = [];
  for (const [mese, idx] of perMese) {
    if (idx.length < 15) continue; // mesi parziali agli estremi del pannello
    const r = idx.map((i) => GIORNALIERO.azioniUsa[i]);
    const chiusura = cumulato(r), calo = caloMassimo(r);
    const nascosto = calo - Math.max(0, -chiusura);
    righe.push({
      mese, chiusuraMensile: +chiusura.toFixed(4), caloDentroIlMese: +calo.toFixed(4),
      nascosto: +nascosto.toFixed(4),
      pauraMassima: Math.max(...idx.map((i) => GIORNALIERO.vix[i])),
    });
  }
  righe.sort((a, b) => b.nascosto - a.nascosto);
  return {
    mesiEsaminati: righe.length,
    peggioriInganni: righe.filter((r) => r.nascosto >= minimo).slice(0, 10),
    // Quanti mesi hanno nascosto un calo di almeno tre punti: dice se il
    // problema e' un caso isolato o la norma.
    quantiIngannano: righe.filter((r) => r.nascosto >= minimo).length,
  };
}

// ── Gli episodi che i prezzi trovano da soli, con il nome dove coincide ──
export const EPISODI_NOTI = [
  { intorno: '2022-06', nome: 'Inflazione e rialzo rapido dei tassi', tipo: 'politica monetaria' },
  { intorno: '2022-09', nome: 'Secondo minimo del mercato orso 2022', tipo: 'politica monetaria' },
  { intorno: '2023-03', nome: 'Fallimenti bancari (Silicon Valley Bank e altri)', tipo: 'sistemico' },
  { intorno: '2024-08', nome: 'Smontaggio delle posizioni finanziate in yen', tipo: 'tecnico' },
  { intorno: '2025-04', nome: 'Annuncio di dazi generalizzati e successiva sospensione', tipo: 'politica commerciale' },
];

// `sogliaCalo` si applica all'indice OPPURE a una singola classe. La ragione e'
// concreta: nel marzo 2023 lo S&P e' sceso solo del 4,7% e a soglia d'indice
// l'episodio non sarebbe esistito — ma la FINANZA in quel mese e' crollata
// molto di piu'. Era una crisi bancaria, non una crisi di mercato. Guardare
// solo l'indice significa non vedere gli episodi settoriali, che sono la
// maggioranza e spesso quelli che cambiano una vita professionale.
export function episodiGiornalieri({ sogliaCalo = 0.05 } = {}) {
  const m = mensileNascondeIlCrollo({ minimo: 0 });
  const tutti = [...m.peggioriInganni];
  // Si ricostruisce l'elenco completo, non solo i primi dieci.
  const perMese = new Map();
  DATE_GIORNI.forEach((d, i) => {
    const k = d.slice(0, 7);
    if (!perMese.has(k)) perMese.set(k, []);
    perMese.get(k).push(i);
  });
  const out = [];
  for (const [mese, idx] of perMese) {
    if (idx.length < 15) continue;
    const r = idx.map((i) => GIORNALIERO.azioniUsa[i]);
    const calo = caloMassimo(r);
    // Il calo peggiore fra le singole classi: e' cio' che fa emergere gli
    // episodi settoriali invisibili all'indice.
    let peggiorClasse = null, caloClasse = 0;
    for (const c of CLASSI) {
      if (c === 'azioniUsa') continue;
      const cc = caloMassimo(idx.map((i) => GIORNALIERO[c][i]));
      if (cc > caloClasse) { caloClasse = cc; peggiorClasse = c; }
    }
    if (calo < sogliaCalo && caloClasse < sogliaCalo * 2) continue;
    const noto = EPISODI_NOTI.find((e) => e.intorno === mese);
    const peggiore = idx.reduce((a, b) => (GIORNALIERO.azioniUsa[a] < GIORNALIERO.azioniUsa[b] ? a : b));
    out.push({
      mese, caloDentroIlMese: +calo.toFixed(4),
      soloSettoriale: calo < sogliaCalo,
      classePiuColpita: peggiorClasse ? NOMI_GIORNALIERI[peggiorClasse] : null,
      caloClassePiuColpita: +caloClasse.toFixed(4),
      chiusuraMensile: +cumulato(r).toFixed(4),
      giornoPeggiore: DATE_GIORNI[peggiore],
      caloDelGiornoPeggiore: +GIORNALIERO.azioniUsa[peggiore].toFixed(4),
      pauraMassima: Math.max(...idx.map((i) => GIORNALIERO.vix[i])),
      nome: noto?.nome || null,
      tipo: noto?.tipo || null,
      nota: noto ? 'nome dell\'evento coincidente per data: contesto verificabile, non una causa dimostrata dai prezzi' : null,
    });
  }
  return out.sort((a, b) => b.caloDentroIlMese - a.caloDentroIlMese);
}

// ── Come si racconta ──
export function finestraText(f) {
  if (!f?.trovato) return f?.motivo || null;
  const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
  const segno = (x) => (x >= 0 ? 'guadagnato' : 'perso');
  const parti = [
    `Fra il ${f.da} e il ${f.a} le azioni hanno ${segno(f.azioni.totale)} il ${pct(f.azioni.totale)}%.`,
  ];
  if (f.quantoNascondeIlDatoDiPeriodo > 0.02) {
    parti.push(`Ma nel mezzo sono arrivate a perdere il ${pct(f.azioni.caloMassimo)}%: guardando solo il risultato finale non si vedrebbe.`);
  }
  const meglio = f.perClasse[0], peggio = f.perClasse.at(-1);
  parti.push(`In quel periodo la cosa che ha tenuto meglio è stata ${meglio.nome.toLowerCase()} (${meglio.totale >= 0 ? '+' : '−'}${pct(meglio.totale)}%), la peggiore ${peggio.nome.toLowerCase()} (−${pct(peggio.totale)}%).`);
  parti.push(`La paura misurata dalle opzioni è arrivata a ${Math.round(f.paura.massima)}.`);
  return parti.join(' ');
}
