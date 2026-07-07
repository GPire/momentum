// Fusione multi-segnale: la categorizzazione non guarda solo il TESTO, ma
// anche l'IMPORTO e l'ORARIO/GIORNO, combinandoli con la predizione del
// modello testuale. Un pagamento di 4,90€ la domenica sera "sa" di
// ristorante anche se la descrizione è illeggibile.
//
// Scelta architetturale onesta: NON si tocca il modello sklearn verificato
// (romperebbe il cross-check Python↔JS esatto). Si costruiscono invece dei
// PROFILI per categoria dai dati REALI dell'utente (quanto è tipico questo
// importo / questa fascia oraria per ogni categoria) e si usano come prior
// bayesiano per aggiustare le probabilità del modello. Con pochi dati il
// prior è debole (non stravolge il testo); con tanti dati diventa un vero
// secondo segnale. Funzioni pure, nessun DOM.

const SLOTS = 4; // mattina/pranzo/pomeriggio/sera (come context-predictor.js)
function slotOf(date) {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 0;
  if (h >= 11 && h < 15) return 1;
  if (h >= 15 && h < 19) return 2;
  return 3;
}
// bucket importo in scala log: 0:<10, 1:10-30, 2:30-80, 3:80-200, 4:>200
function amountBucket(amount) {
  const a = Math.abs(amount || 0);
  if (a < 10) return 0;
  if (a < 30) return 1;
  if (a < 80) return 2;
  if (a < 200) return 3;
  return 4;
}

// Costruisce i profili per categoria dallo storico: distribuzione degli
// importi (5 bucket) e delle fasce orarie (4 slot), con lisciatura di
// Laplace così una categoria senza dati resta neutra (uniforme).
export function buildProfiles(allTx) {
  const txs = Object.values(allTx || {}).flat().filter(t => t.type === 'uscita' && t.category);
  const cats = {};
  for (const t of txs) {
    const c = cats[t.category] = cats[t.category] || { amount: new Array(5).fill(0), slot: new Array(SLOTS).fill(0), n: 0 };
    c.amount[amountBucket(t.amount)]++;
    c.slot[slotOf(new Date(t.date))]++;
    c.n++;
  }
  return cats;
}

// P(bucket | categoria) con Laplace. Se la categoria non ha storico o ne ha
// pochissimo, restituisce ~uniforme (nessuna spinta).
function condProb(counts, idx, total, k) {
  return (counts[idx] + 1) / (total + k);
}

// Fonde le probabilità del modello testuale con i prior di importo/orario.
// `mlProbs`: { categoria: prob } dal modello. `strength` (0..1) limita
// quanto il contesto può spostare il testo — parte basso e cresce solo con
// abbastanza dati (min 20 tx totali per contare davvero).
// Ritorna { category, confidence, allProbs, contextUsed }.
export function fuseSignals(mlProbs, { amount, date, allTx, profiles = null }) {
  const prof = profiles || buildProfiles(allTx);
  const totalTx = Object.values(prof).reduce((s, c) => s + c.n, 0);
  const cats = Object.keys(mlProbs);
  if (totalTx < 20 || !date) {
    // dati insufficienti: nessuna fusione, si resta sul modello testuale
    const best = cats.reduce((a, b) => mlProbs[a] >= mlProbs[b] ? a : b);
    return { category: best, confidence: mlProbs[best], allProbs: mlProbs, contextUsed: false };
  }

  const bkt = amountBucket(amount);
  const slt = slotOf(date);
  // forza del contesto: cresce con i dati, cap a 0.5 (il testo resta dominante)
  const strength = Math.min(0.5, totalTx / 400);

  const fused = {};
  let sum = 0;
  for (const c of cats) {
    const p = prof[c];
    let prior = 1;
    if (p && p.n >= 5) {
      const pa = condProb(p.amount, bkt, p.n, 5);
      const ps = condProb(p.slot, slt, p.n, SLOTS);
      prior = pa * ps;
    }
    // interpolazione: prob_finale = testo^(1-s) * (testo*prior)^s, normalizzata
    fused[c] = mlProbs[c] * Math.pow(prior, strength);
    sum += fused[c];
  }
  if (sum > 0) for (const c of cats) fused[c] /= sum;

  const best = cats.reduce((a, b) => fused[a] >= fused[b] ? a : b);
  return { category: best, confidence: fused[best], allProbs: fused, contextUsed: true };
}
