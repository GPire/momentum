// ============================================================
// MASTER PRINCIPLES — i principi dei grandi investitori come IPOTESI TESTABILI
// ============================================================
// Il settore usa i nomi dei grandi investitori come etichette di marketing:
// "strategia Buffett", "approccio Dalio". È decorazione — nessuno verifica se
// quel principio stia funzionando *per te*, e nessuno dice mai quando smette
// di funzionare.
//
// Qui si fa la cosa opposta, e per farla serviva il lavoro fatto prima. Ogni
// principio dei maestri, letto attentamente, **è un'affermazione causale**:
//
//   Buffett/Graham: "comprare qualità a prezzo ragionevole CAUSA rendimento
//                    superiore nel lungo periodo"
//   Bogle:          "i costi CAUSANO la maggior parte della differenza di
//                    risultato tra investitori"
//   Dalio:          "diversificare tra fonti scorrelate CAUSA meno perdite a
//                    parità di rendimento"
//   Soros:          "riflessività — il prezzo influenza i fondamentali che
//                    influenzano il prezzo": è letteralmente un ANELLO DI
//                    RETROAZIONE, quello che `causal-diagnostics.js` sa
//                    riconoscere
//   Munger:         "inverti sempre": non chiedere cosa causa il successo,
//                    chiedi cosa causa il disastro ed evitalo
//   Simons:         "fidati solo di ciò che è statisticamente distinguibile
//                    dal caso": è esattamente lo Sharpe deflazionato
//   Lynch:          "investi in ciò che capisci" → è una condizione di
//                    validità, non un rendimento atteso: non è testabile sui
//                    prezzi, e va detto invece di fingere che lo sia
//
// Un'affermazione causale si può TESTARE. E ora abbiamo gli strumenti giusti:
// PCMCI per la struttura, lo Sharpe deflazionato per non farsi ingannare dal
// numero di tentativi, l'esperimento valido in ogni istante per misurare nel
// tempo. Questo file collega le due cose.
//
// Onestà, sempre: qui non si dice a nessuno cosa comprare. Si dice **quale
// principio regge sui TUOI dati e quale no**, e soprattutto quando NON
// abbiamo abbastanza per rispondere. Un principio non confermato non è
// "sbagliato": molto spesso è solo non verificabile con i dati di una persona,
// e confondere le due cose sarebbe il solito errore del settore.
'use strict';

import { deflatedSharpe, sharpeRatio } from './strategy-validation.js';

// Ogni principio porta: cosa afferma, cosa lo RENDEREBBE FALSO (senza questo
// non è scienza, è una citazione), quali dati servono, e il limite dichiarato.
export const PRINCIPI = {
  costi: {
    maestro: 'Bogle',
    afferma: 'I costi sono la parte del risultato che puoi controllare con certezza.',
    falsificabile: 'Se il rendimento netto NON peggiora al crescere dei costi sostenuti.',
    richiede: ['costi', 'rendimenti'],
    // È l'unico principio quasi deterministico del gruppo, ed è per questo che
    // va per primo: non dipende da previsioni, dipende dall'aritmetica.
    forza: 'aritmetica',
    perBambini: 'Ogni euro di commissione è un euro che non torna più. Questa non è una previsione: è una sottrazione.',
  },
  diversificazione: {
    maestro: 'Dalio',
    afferma: 'Unire fonti di rendimento scorrelate riduce le perdite senza rinunciare al rendimento.',
    falsificabile: 'Se il portafoglio unito NON ha perdite minori della media dei suoi pezzi.',
    richiede: ['rendimenti-multipli'],
    forza: 'matematica',
    perBambini: 'Se metti le uova in ceste diverse e le ceste cadono in momenti diversi, ne rompi meno.',
  },
  qualitaPrezzo: {
    maestro: 'Buffett / Graham',
    afferma: 'Comprare buone attività a prezzo ragionevole rende di più nel lungo periodo.',
    falsificabile: 'Se il gruppo "qualità a buon prezzo" NON batte il resto su un orizzonte lungo, tenuto conto di quante alternative sono state provate.',
    richiede: ['rendimenti-per-gruppo', 'orizzonte-lungo'],
    forza: 'statistica',
    perBambini: 'Compra cose buone quando costano poco. Serve pazienza: si vede dopo anni, non dopo settimane.',
  },
  riflessivita: {
    maestro: 'Soros',
    afferma: 'A volte il prezzo cambia la realtà che dovrebbe rispecchiare, e la realtà ricambia il prezzo.',
    falsificabile: 'Se non esiste alcun anello di retroazione rilevabile tra prezzo e fondamentali.',
    richiede: ['serie-prezzo', 'serie-fondamentale'],
    forza: 'causale',
    perBambini: 'A volte una cosa sale perché tutti pensano che salirà, e questo la fa salire davvero. Poi si rompe.',
  },
  inversione: {
    maestro: 'Munger',
    afferma: 'Evitare i disastri conta più che scegliere i vincitori.',
    falsificabile: 'Se togliere i periodi peggiori NON cambia il risultato finale più che togliere i migliori.',
    richiede: ['rendimenti'],
    forza: 'aritmetica',
    perBambini: 'Non perdere è più importante che vincere: da una buca profonda si risale molto più lentamente.',
  },
  distinguibilita: {
    maestro: 'Simons',
    afferma: 'Fidati solo di ciò che si distingue dal caso, tenuto conto di quante cose hai provato.',
    falsificabile: 'È il criterio stesso, applicato a ogni altra strategia.',
    richiede: ['rendimenti', 'numero-tentativi'],
    forza: 'statistica',
    perBambini: 'Se provi cento volte, qualcosa funziona per fortuna. Non è bravura.',
  },
  comprensione: {
    maestro: 'Lynch',
    afferma: 'Investi in ciò che capisci.',
    falsificabile: null, // dichiarato: non è testabile sui prezzi
    richiede: [],
    forza: 'non-testabile',
    perBambini: 'Se non sai spiegare a un amico come fa a guadagnare, non è per te.',
    nota: 'Questo principio non si può verificare sui prezzi: la comprensione non è un dato di mercato. Lo diciamo invece di fingere di averlo misurato.',
  },
};

// ── Bogle: i costi ──
// L'unico test quasi deterministico, e il più utile: nessuna previsione, solo
// aritmetica su un orizzonte. Nessun competitor mostra il conto composto dei
// costi accanto al rendimento atteso.
export function testCosti({ rendimentoLordo, costoAnnuo, anni = 20, capitale = 10000 }) {
  if (!Number.isFinite(rendimentoLordo) || !Number.isFinite(costoAnnuo)) return null;
  const senza = capitale * (1 + rendimentoLordo) ** anni;
  const con = capitale * (1 + rendimentoLordo - costoAnnuo) ** anni;
  const perso = senza - con;
  return {
    principio: 'costi',
    anni,
    finaleSenzaCosti: +senza.toFixed(2),
    finaleConCosti: +con.toFixed(2),
    perso: +perso.toFixed(2),
    quotaPersa: +(100 * perso / senza).toFixed(1),
    confermato: perso > 0,
    // La frase che rende il numero indimenticabile.
    messaggio: `Su ${anni} anni, un costo dell'${(costoAnnuo * 100).toFixed(2)}% all'anno si mangia ${(100 * perso / senza).toFixed(1)}% del risultato finale: ${perso.toFixed(0)}€ su ${senza.toFixed(0)}€.`,
  };
}

// ── Dalio: la diversificazione ──
// Si verifica che l'unione abbia una perdita massima MINORE della media delle
// perdite massime dei pezzi. Se non accade, i pezzi non erano scorrelati — ed
// è un'informazione preziosa, perché è l'errore più comune di chi crede di
// essere diversificato.
// Un rendimento può superare il +100% senza limite (Bitcoin ha fatto +300% in
// un anno): verso l'alto non c'è nulla da limitare, ed è giusto così.
// Verso il basso dipende da COSA si possiede, e la distinzione è sostanziale:
//
//   'lunga'  — comprato e basta, senza debito. Il peggio che può succedere è
//              che vada a zero: −100%. Un valore sotto −100% qui NON è un
//              caso estremo, è un dato sbagliato, e va segnalato, non
//              schiacciato in silenzio (schiacciarlo nasconderebbe l'errore).
//   'leva'   — comprato a debito, oppure venduto allo scoperto, o derivati.
//              Qui perdere più del capitale è possibile per davvero, ed è la
//              ragione per cui esistono le chiamate a margine. Un −150% è un
//              dato legittimo e non va toccato.
//
// Errore mio da cui viene questa distinzione: avevo tagliato tutto a −100%
// "per sicurezza", il che avrebbe cancellato in silenzio proprio le perdite
// peggiori di chi usa la leva — l'informazione più importante da mostrare.
export const TIPI_POSIZIONE = {
  lunga: { sottoIlCento: 'errore-nei-dati', descrizione: 'Comprato senza debito: il peggio è perdere tutto.' },
  leva: { sottoIlCento: 'possibile', descrizione: 'A debito, allo scoperto o derivati: si può perdere più del capitale.' },
};

export function testDiversificazione(serieRendimenti = [], { pesi = null, tipoPosizione = 'lunga' } = {}) {
  const serie = serieRendimenti.filter((s) => Array.isArray(s) && s.length > 3);
  if (serie.length < 2) return null;
  const n = Math.min(...serie.map((s) => s.length));
  const w = pesi || serie.map(() => 1 / serie.length);
  const conLeva = tipoPosizione === 'leva';

  let sospetti = 0;   // valori impossibili per una posizione lunga
  let azzerati = 0;   // volte in cui il capitale è stato spazzato via

  const maxDrawdown = (r) => {
    let cum = 1, picco = 1, peggiore = 0;
    for (const v of r) {
      if (!Number.isFinite(v)) continue;
      if (v <= -1 && !conLeva) sospetti++;

      cum *= (1 + v);

      // Capitale a zero o sotto: la posizione è chiusa. Da lì non si compone
      // più nulla — moltiplicare un capitale negativo per un rendimento
      // futuro produrrebbe numeri senza alcun significato (era esattamente
      // l'origine del −74.660% osservato).
      if (cum <= 0) { azzerati++; return -1; }

      if (cum > picco) picco = cum;
      peggiore = Math.min(peggiore, cum / picco - 1);
    }
    return peggiore;
  };

  const unito = Array.from({ length: n }, (_, t) => serie.reduce((s, r, i) => s + w[i] * r[t], 0));
  const ddSingoli = serie.map((s) => maxDrawdown(s.slice(0, n)));
  const ddMedio = ddSingoli.reduce((s, v) => s + v, 0) / ddSingoli.length;
  const ddUnito = maxDrawdown(unito);

  const rendMedio = serie.map((s) => s.slice(0, n).reduce((a, b) => a + b, 0) / n)
    .reduce((s, v, i) => s + w[i] * v, 0);
  const rendUnito = unito.reduce((a, b) => a + b, 0) / n;

  const confermato = ddUnito > ddMedio + 1e-9; // meno negativo = perdita minore
  return {
    principio: 'diversificazione',
    perditaPeggioreUnita: +(100 * ddUnito).toFixed(2),
    perditaPeggioreMedia: +(100 * ddMedio).toFixed(2),
    rendimentoConservato: +(100 * (rendUnito - rendMedio)).toFixed(4),
    confermato,
    tipoPosizione,
    // Un rendimento sotto −100% è un dato sbagliato solo per una posizione
    // senza debito. Con la leva è legittimo, e va mostrato, non nascosto.
    valoriSospetti: sospetti,
    volteAzzerato: azzerati,
    attendibile: sospetti === 0,
    ...(sospetti > 0 ? {
      avviso: `${sospetti} rendimenti sono sotto il −100%. Su un investimento comprato senza debito non è possibile perdere più di tutto: o i dati sono sbagliati, o questa posizione usa la leva — in quel caso indica "leva" e il calcolo li terrà per buoni.`,
    } : {}),
    ...(azzerati > 0 ? {
      avvisoAzzeramento: `In ${azzerati} ${azzerati === 1 ? 'caso' : 'casi'} il capitale è arrivato a zero: da lì non si recupera più, qualunque cosa faccia il mercato dopo.`,
    } : {}),
    messaggio: confermato
      ? `Mettendoli insieme la perdita peggiore scende dal ${(100 * ddMedio).toFixed(1)}% al ${(100 * ddUnito).toFixed(1)}%, senza rinunciare al rendimento.`
      : `Metterli insieme NON ha ridotto la perdita peggiore: questi pezzi si muovono troppo allo stesso modo, quindi non è vera diversificazione.`,
  };
}

// ── Munger: l'inversione ──
// Togliere i periodi peggiori conta più che togliere i migliori? Su serie
// composte quasi sempre sì, ed è un'asimmetria che quasi nessuno mostra: da
// una perdita del 50% serve un +100% per tornare pari.
export function testInversione(rendimenti = [], { quanti = 5 } = {}) {
  const r = rendimenti.filter(Number.isFinite);
  if (r.length < quanti * 3) return null;
  const componi = (arr) => arr.reduce((c, v) => c * (1 + v), 1);

  const ordinati = [...r].sort((a, b) => a - b);
  const peggiori = new Set(ordinati.slice(0, quanti));
  const migliori = new Set(ordinati.slice(-quanti));

  const rimuovi = (insieme) => {
    const usato = new Map();
    return r.filter((v) => {
      if (insieme.has(v) && (usato.get(v) || 0) < quanti) { usato.set(v, (usato.get(v) || 0) + 1); return false; }
      return true;
    });
  };

  const base = componi(r);
  const senzaPeggiori = componi(rimuovi(peggiori));
  const senzaMigliori = componi(rimuovi(migliori));

  const guadagnoEvitando = senzaPeggiori / base - 1;
  const perditaMancando = 1 - senzaMigliori / base;
  const confermato = guadagnoEvitando > perditaMancando;

  return {
    principio: 'inversione',
    quanti,
    evitandoIPeggiori: +(100 * guadagnoEvitando).toFixed(1),
    mancandoIMigliori: +(100 * perditaMancando).toFixed(1),
    confermato,
    messaggio: confermato
      ? `Evitare i ${quanti} periodi peggiori vale più (+${(100 * guadagnoEvitando).toFixed(0)}%) che prendere i ${quanti} migliori (${(100 * perditaMancando).toFixed(0)}%). Difendersi conta più che indovinare.`
      : `Su questi dati prendere i periodi migliori ha contato più che evitare i peggiori: qui l'inversione non si applica.`,
  };
}

// ── Simons: la distinguibilità dal caso ──
// È il criterio già costruito in `strategy-validation.js`, qui esposto come
// principio esplicito perché è quello che governa tutti gli altri.
export function testDistinguibilita(rendimenti, { tentativi = 1 }) {
  const ds = deflatedSharpe(rendimenti, { trials: tentativi });
  return {
    principio: 'distinguibilita',
    sharpe: ds.sharpe,
    sogliaFortuna: ds.soglia,
    verdetto: ds.verdetto,
    confermato: ds.verdetto === 'solido',
    messaggio: ds.spiegazione,
  };
}

// ── Soros: la riflessività come anello di retroazione ──
// Riceve il risultato di `detectFeedbackLoops` (causal-diagnostics.js): se tra
// prezzo e fondamentale esiste un anello, il principio è confermato SU QUESTI
// DATI. Non è una previsione — è una struttura rilevata.
export function testRiflessivita(cicliRilevati, { nodiPrezzo = [], nodiFondamentali = [] } = {}) {
  const anelli = (cicliRilevati?.cicli || []).filter((c) =>
    c.nodi.some((n) => nodiPrezzo.includes(n)) && c.nodi.some((n) => nodiFondamentali.includes(n)));
  return {
    principio: 'riflessivita',
    anelliTrovati: anelli.length,
    confermato: anelli.length > 0,
    anelli,
    messaggio: anelli.length
      ? `Trovato un anello tra prezzo e fondamentali: qui il prezzo non riflette soltanto la realtà, la sta anche cambiando. In questi casi le tendenze durano più del previsto e poi si rompono di colpo.`
      : `Nessun anello rilevato tra prezzo e fondamentali su questi dati: qui il prezzo sembra seguire, non guidare.`,
  };
}

// ── Il referto dei principi ──
// Restituisce, per ogni principio, se regge sui dati forniti, se NON regge, o
// se semplicemente non c'è modo di saperlo. La terza categoria è quella che
// il settore fa sparire, ed è quasi sempre la più numerosa.
export function evaluatePrinciples(dati = {}) {
  const esiti = [];

  if (dati.costi) {
    const t = testCosti(dati.costi);
    if (t) esiti.push({ ...PRINCIPI.costi, ...t });
  }
  if (dati.serieRendimenti?.length >= 2) {
    const t = testDiversificazione(dati.serieRendimenti, { pesi: dati.pesi });
    if (t) esiti.push({ ...PRINCIPI.diversificazione, ...t });
  }
  if (dati.rendimenti?.length) {
    const inv = testInversione(dati.rendimenti);
    if (inv) esiti.push({ ...PRINCIPI.inversione, ...inv });
    const dist = testDistinguibilita(dati.rendimenti, { tentativi: dati.tentativi ?? 1 });
    if (dist) esiti.push({ ...PRINCIPI.distinguibilita, ...dist });
  }
  if (dati.cicli) {
    const t = testRiflessivita(dati.cicli, dati);
    if (t) esiti.push({ ...PRINCIPI.riflessivita, ...t });
  }

  const testati = new Set(esiti.map((e) => e.principio));
  const nonTestabili = Object.entries(PRINCIPI)
    .filter(([k, p]) => !testati.has(k) && (p.forza === 'non-testabile' || !dati.silenzioSuiMancanti))
    .map(([k, p]) => ({
      principio: k, maestro: p.maestro, confermato: null,
      messaggio: p.nota || `Per verificare questo principio servirebbero dati che qui non ci sono: ${p.richiede.join(', ')}.`,
    }));

  const confermati = esiti.filter((e) => e.confermato === true).length;
  const smentiti = esiti.filter((e) => e.confermato === false).length;

  return {
    esiti,
    nonTestabili,
    riassunto: `${confermati} ${confermati === 1 ? 'principio regge' : 'principi reggono'} sui tuoi dati, ${smentiti} non ${smentiti === 1 ? 'regge' : 'reggono'}, ${nonTestabili.length} non ${nonTestabili.length === 1 ? 'è verificabile' : 'sono verificabili'} con quello che abbiamo.`,
    // Il messaggio che protegge dall'errore più grave: un principio non
    // confermato sui propri dati non è un principio sbagliato in generale.
    avvertenza: 'Questi verdetti valgono per i TUOI dati e per questo periodo. Un principio che qui non regge può reggere altrove o più avanti: pochi dati non smentiscono nulla, dicono solo che non si vede.',
  };
}
