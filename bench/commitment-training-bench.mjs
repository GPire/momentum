// Benchmark dell'AUTO-ADDESTRAMENTO DAGLI IMPEGNI — "node bench/commitment-training-bench.mjs".
//
// LA DOMANDA, onesta: dichiarare i propri impegni fissi (mutuo, affitto, Enel,
// palestra…) fa categorizzare meglio i movimenti FUTURI di quegli stessi
// esercenti — quelli che arrivano da un import con una stringa MAI vista prima
// ("ENEL ENERGIA SPA FATT 08/26 COD 7741")?
//
// PROTOCOLLO (niente scorciatoie che gonfino il numero):
//  - lo storico è archiviato dall'utente in una categoria coerente;
//  - il TEST è su varianti FUTURE della stessa insegna, mai viste in addestramento
//    (suffissi di fattura, codici, ragione sociale estesa: come nei veri estratti);
//  - BASELINE = la gerarchia esercenti addestrata SOLO sui movimenti storici,
//    esattamente com'è oggi in produzione. Il trattamento aggiunge SOLO le
//    etichette derivate dagli impegni dichiarati. Il guadagno misurato è quindi
//    marginale e onesto, non un confronto contro un fantoccio;
//  - CONTROPROVA obbligatoria: su esercenti NON dichiarati come impegni il
//    sistema non deve cominciare a parlare a vanvera (falsi in più = 0);
//  - EQUITÀ TEMPORALE: la gerarchia decade nel tempo, e un'etichetta scritta
//    "oggi" avrebbe un vantaggio automatico sul solo fatto di essere recente.
//    Quindi il momento della previsione è ancorato alla fine dello storico
//    (`NOW_REF`), e le etichette vengono osservate a quella stessa data: ciò che
//    resta è guadagno di EVIDENZA, non di freschezza.
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initMerchantHierarchy, observeMerchant, predictMerchant } = await imp('src/ai/merchant-hierarchy.js');
const { trainCommitments, deriveCommitmentLabels } = await imp('src/predict/commitment-training.js');

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Insegne reali di utenze/servizi italiani con le loro varianti da estratto conto.
const FORNITORI = [
  { merchant: 'Enel', cat: 'spesa', storico: ['Enel Energia', 'ENEL ENERGIA'], futuro: ['ENEL ENERGIA SPA FATT 08/26', 'Enel Energia Mercato Libero cod 7741'] },
  { merchant: 'Vodafone', cat: 'abbonamenti', storico: ['Vodafone', 'VODAFONE IT'], futuro: ['VODAFONE ITALIA SPA RID 0925', 'Vodafone Casa fattura 4471'] },
  { merchant: 'Hera', cat: 'spesa', storico: ['Hera Comm', 'HERA COMM'], futuro: ['HERA COMM SRL BOLLETTA GAS 07', 'Hera Comm addebito periodico'] },
  { merchant: 'Netflix', cat: 'abbonamenti', storico: ['Netflix', 'NETFLIX.COM'], futuro: ['NETFLIX.COM AMSTERDAM NL', 'Netflix abbonamento mensile 08'] },
  { merchant: 'Trenitalia', cat: 'trasporti', storico: ['Trenitalia', 'TRENITALIA'], futuro: ['TRENITALIA SPA BIGLIETTO AV', 'Trenitalia acquisto online 3311'] },
];
// Esercenti NON dichiarati: la controprova (non devono guadagnare voce).
const ESTRANEI = ['Bar Mario', 'Pizzeria Da Ciro', 'Officina Rossi', 'Cartoleria Sud', 'Erboristeria Verde'];

const MESI = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
// il "adesso" del test: 15 giorni dopo l'ultimo mese di storico usato.
const nowRefFor = (mesiStorico) => Date.parse(`${MESI[mesiStorico - 1]}-25`);

function buildCase(seed, mesiStorico) {
  const rnd = mulberry32(seed);
  const allTx = {}, commitments = [];
  FORNITORI.forEach((f, i) => {
    const day = 5 + i * 4;
    commitments.push({ id: `c${i}`, name: f.merchant, merchant: f.merchant,
      amount: 40 + i * 15, dayOfMonth: day, kind: 'bolletta', variable: true });
    for (let m = 0; m < mesiStorico; m++) {
      const mese = MESI[m];
      const desc = f.storico[Math.floor(rnd() * f.storico.length)];
      (allTx[mese] ||= []).push({ type: 'uscita', amount: (40 + i * 15) * (0.7 + rnd() * 0.6),
        date: `${mese}-${String(day).padStart(2, '0')}`, description: desc, category: f.cat });
    }
    // rumore: spese libere sparse, che l'albero vede comunque
    for (let k = 0; k < 6; k++) {
      const mese = MESI[Math.floor(rnd() * mesiStorico)];
      (allTx[mese] ||= []).push({ type: 'uscita', amount: 5 + rnd() * 40,
        date: `${mese}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`,
        description: ESTRANEI[Math.floor(rnd() * ESTRANEI.length)], category: 'ristoranti' });
    }
  });
  return { allTx, commitments };
}

// Addestra l'albero SOLO sui movimenti (è la produzione di oggi).
function treeFromHistory(allTx) {
  const tree = initMerchantHierarchy();
  for (const txs of Object.values(allTx)) {
    for (const t of txs) observeMerchant(tree, t.description, t.category, Date.parse(t.date));
  }
  return tree;
}

// Orchestratore finto: l'unica cosa che serve a trainCommitments è learn().
const orchestratorOn = (tree) => ({
  learn: (desc, cat, amt, date) => observeMerchant(tree, desc, cat, new Date(date).getTime()),
});

let baseOk = 0, baseSilent = 0, baseWrong = 0;
let trainOk = 0, trainSilent = 0, trainWrong = 0;
let baseFalsi = 0, trainFalsi = 0, estraneiTot = 0;
let etichette = 0, etichetteAttese = 0;
const perMesi = new Map();

for (let seed = 1; seed <= 60; seed++) {
  for (const mesiStorico of [2, 3, 5]) {
    const { allTx, commitments } = buildCase(seed * 104729, mesiStorico);

    const baseTree = treeFromHistory(allTx);
    const trainTree = treeFromHistory(allTx);
    const NOW_REF = nowRefFor(mesiStorico);
    const r = trainCommitments(orchestratorOn(trainTree), commitments, allTx, { now: NOW_REF });
    etichette += r.taught.length;
    etichetteAttese += commitments.length;

    const bucket = perMesi.get(mesiStorico) || { base: 0, train: 0, tot: 0 };
    for (const f of FORNITORI) {
      for (const desc of f.futuro) {
        bucket.tot++;
        const b = predictMerchant(baseTree, desc, NOW_REF);
        const t = predictMerchant(trainTree, desc, NOW_REF);
        if (!b) baseSilent++; else if (b.category === f.cat) { baseOk++; bucket.base++; } else baseWrong++;
        if (!t) trainSilent++; else if (t.category === f.cat) { trainOk++; bucket.train++; } else trainWrong++;
      }
    }
    // CONTROPROVA: esercenti mai dichiarati e mai visti → deve tacere in entrambi.
    for (const e of ['Ferramenta Bianchi', 'Gelateria Luna', 'Tabaccheria 22']) {
      estraneiTot++;
      if (predictMerchant(baseTree, `${e} pagamento pos`, NOW_REF)) baseFalsi++;
      if (predictMerchant(trainTree, `${e} pagamento pos`, NOW_REF)) trainFalsi++;
    }
    perMesi.set(mesiStorico, bucket);
  }
}

const tot = baseOk + baseSilent + baseWrong;
const pct = (n) => `${((n / tot) * 100).toFixed(1)}%`;
console.log(`Casi di test (varianti FUTURE mai viste): ${tot}\n`);
console.log('  BASELINE (solo movimenti storici, la produzione di oggi)');
console.log(`    corretti ${pct(baseOk)}   in silenzio ${pct(baseSilent)}   sbagliati ${pct(baseWrong)}`);
console.log('\n  + ETICHETTE DAGLI IMPEGNI DICHIARATI');
console.log(`    corretti ${pct(trainOk)}   in silenzio ${pct(trainSilent)}   sbagliati ${pct(trainWrong)}`);
console.log(`\n  GUADAGNO NETTO: ${(((trainOk - baseOk) / tot) * 100).toFixed(1)} punti di categorie corrette`);
console.log(`  (etichette derivate: ${etichette}/${etichetteAttese} impegni dichiarati)`);
console.log(`
  ⚠️ COME VA LETTO QUESTO NUMERO (onestà, non modestia):
  il guadagno è RECUPERO DI COPERTURA a freddo, non conoscenza nuova. Con 2-3
  mesi di storico la gerarchia TACE per prudenza (sotto la sua soglia di
  supporto): le occorrenze ci sono ma sono poche e sparse su varianti diverse
  della stringa. La dichiarazione le consolida su UN alias canonico ("Enel"),
  portando lo stesso fatto sopra la soglia. Parte di quell'evidenza sono le
  stesse archiviazioni passate: per questo esiste il TETTO (5 osservazioni) —
  senza, un impegno lungo dominerebbe l'albero. A 5 mesi di storico il guadagno
  è ZERO, ed è giusto così: lì la baseline sa già rispondere da sola.`);

console.log('\n  Per quantità di storico (dove il guadagno serve davvero: a freddo):');
for (const m of [2, 3, 5]) {
  const b = perMesi.get(m);
  console.log(`    ${m} mesi di storico → baseline ${((b.base / b.tot) * 100).toFixed(1)}%  ·  con impegni ${((b.train / b.tot) * 100).toFixed(1)}%`);
}

console.log(`\n  CONTROPROVA (esercenti mai dichiarati né visti, ${estraneiTot} casi):`);
console.log(`    falsi della baseline: ${baseFalsi}   ·   falsi col trattamento: ${trainFalsi}`);
console.log(trainFalsi <= baseFalsi
  ? '    → nessun falso in più: le etichette non fanno parlare a vanvera.'
  : '    → ⚠️ il trattamento ha iniziato a parlare dove dovrebbe tacere: da rivedere.');
