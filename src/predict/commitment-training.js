// ============================================================
// GLI IMPEGNI ADDESTRANO IL CORE — etichette ad alta confidenza (v1)
// ============================================================
// Quando dichiari "questo è il mio mutuo / la mia bolletta Enel", stai dando al
// sistema qualcosa che nessun estratto conto contiene: la CERTEZZA che quella
// riga si ripeterà, con quel nome, ogni mese. È il segnale più pulito che
// l'utente possa dare — e finora restava chiuso dentro il forecast.
//
// Qui quel segnale esce e alimenta il resto del sistema, in due modi:
//
//  1. ETICHETTE: se i pagamenti reali di un impegno sono già stati archiviati
//     dall'utente in UNA categoria coerente, quella coppia (esercente → categoria)
//     diventa un'etichetta ad alta confidenza per il Core (gerarchia + morfologia
//     esercenti). Risultato concreto: il prossimo import che porta "ENEL ENERGIA
//     SPA 08/26" si categorizza da solo, anche se la stringa non è mai stata vista.
//     GUARDRAIL (lo stesso dell'accordo-tra-insegne della morfologia): si insegna
//     SOLO se le occorrenze passate concordano. Se l'utente le ha archiviate in
//     categorie diverse, il sistema TACE — un'etichetta sbagliata ad alta
//     confidenza è peggio di nessuna etichetta.
//
//  2. NORMALITÀ PER IMPEGNO: una bolletta che varia da 60 a 150 € non è
//     un'anomalia; una da 400 € sì. Il rilevatore di anomalie generico non lo sa,
//     perché ragiona sulla categoria. Qui ogni impegno porta la propria banda di
//     normalità MISURATA (mediana + MAD robusta) e dice quanto uno scostamento è
//     davvero fuori scala — con la cifra in mano, mai un giudizio.
//
// Funzioni pure, nessun DOM. L'unico effetto collaterale è in `trainCommitments`,
// che chiama l'orchestratore esistente (nessuna logica di apprendimento nuova:
// si riusa quella già misurata dai bench).
'use strict';

import { matchCommitmentInMonth, enrichCommitmentsWithLearning } from './fixed-commitments.js';

const r2 = (n) => Math.round(n * 100) / 100;

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Tutte le occorrenze reali di un impegno nello storico (una al massimo per mese).
export function commitmentOccurrences(c, allTx = {}, opts = {}) {
  const out = [];
  for (const txs of Object.values(allTx || {})) {
    const m = matchCommitmentInMonth(c, txs || [], opts);
    if (m) out.push(m);
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// ── 1. ETICHETTE AD ALTA CONFIDENZA ─────────────────────────────────────────
// Per ogni impegno: la categoria in cui l'utente archivia DAVVERO quei pagamenti,
// se c'è accordo. `minAgreement` = frazione minima di occorrenze concordi.
export function deriveCommitmentLabels(commitments = [], allTx = {}, {
  minSamples = 2, minAgreement = 0.67,
} = {}) {
  const labels = [];
  for (const c of commitments) {
    if (!(+c.amount > 0) || !(c.dayOfMonth >= 1)) continue;
    const occ = commitmentOccurrences(c, allTx);
    // La categoria dichiarata sull'impegno vale come etichetta anche senza
    // storico: l'utente l'ha scritta, è la verità più forte che abbiamo.
    if (c.category) {
      labels.push({ id: c.id, description: c.merchant || c.name, category: c.category,
        samples: occ.length, agreement: 1, source: 'dichiarata', confidence: 0.95 });
      continue;
    }
    const withCat = occ.filter(t => t.category);
    if (withCat.length < minSamples) continue;
    const counts = new Map();
    for (const t of withCat) counts.set(t.category, (counts.get(t.category) || 0) + 1);
    let top = null, topN = 0;
    for (const [cat, n] of counts) if (n > topN) { top = cat; topN = n; }
    const agreement = topN / withCat.length;
    if (agreement < minAgreement) continue;   // archiviazioni discordi → si tace
    labels.push({
      id: c.id,
      // si insegna sul NOME dell'esercente quando c'è (è la stringa che
      // ricomparirà negli import), altrimenti sul nome dell'impegno.
      description: c.merchant || c.name,
      category: top,
      samples: withCat.length,
      agreement: Math.round(agreement * 100) / 100,
      source: 'osservata',
      // la confidenza cresce con le occorrenze concordi, ma non arriva mai a 1:
      // resta una misura, non un dogma.
      confidence: Math.min(0.9, 0.5 + 0.1 * topN) * agreement,
    });
  }
  return labels;
}

// Impronta di un'etichetta: serve a NON riaddestrare mille volte la stessa cosa
// (ogni render della dashboard chiamerebbe altrimenti learn() da capo, gonfiando
// i contatori dell'esperto e falsando i pesi misurati).
export const labelFingerprint = (l) => `${l.id}|${l.description}|${l.category}|${l.samples}`;

// Applica le etichette all'orchestratore. Ritorna cosa ha insegnato davvero.
// `seen` = insieme delle impronte già insegnate (dal vault, campo additivo).
// QUANTA EVIDENZA PORTA UN'ETICHETTA. Un'osservazione sola non basta e non deve
// bastare: la gerarchia esercenti si astiene sotto 2 osservazioni (guardrail
// misurato dai suoi bench — parlare con un solo dato è "sbagliare con
// sicurezza"). Ma un impegno con 5 pagamenti archiviati sempre nella stessa
// categoria HA quell'evidenza: sono 5 fatti reali, non una ripetizione
// artificiale. Quindi l'alias viene osservato una volta per occorrenza
// concorde — CON UN TETTO, perché un mutuo di 20 anni non deve schiacciare
// tutto il resto dell'albero (stessa filosofia del cap anti-avvelenamento
// usato nella federazione mesh).
// Nota di onestà: si insegna sul NOME CANONICO dell'impegno ("Enel"), che è un
// alias dichiarato dall'utente e non la stringa grezza del movimento — quindi
// non si ri-conta un'osservazione che l'import aveva già fatto.
export const EVIDENCE_CAP = 5;

export function trainCommitments(orchestrator, commitments = [], allTx = {}, {
  seen = [], minConfidence = 0.6, now = Date.now(), evidenceCap = EVIDENCE_CAP,
} = {}) {
  const labels = deriveCommitmentLabels(commitments, allTx);
  const known = new Set(seen);
  const taught = [];
  for (const l of labels) {
    if (l.confidence < minConfidence) continue;
    const fp = labelFingerprint(l);
    if (known.has(fp)) continue;
    const c = commitments.find(x => x.id === l.id);
    // una categoria DICHIARATA a mano vale come due osservazioni: è esplicita,
    // ma non ha ancora prove sui movimenti.
    const reps = Math.max(2, Math.min(evidenceCap, l.source === 'dichiarata' ? 2 : l.samples));
    try {
      for (let i = 0; i < reps; i++) {
        orchestrator.learn(l.description, l.category, +c?.amount || 0, new Date(now));
      }
    } catch (_) { continue; }   // l'apprendimento non deve mai rompere la UI
    known.add(fp);
    taught.push({ ...l, fingerprint: fp, evidence: reps });
  }
  return { taught, seen: [...known] };
}

// ── 2. NORMALITÀ PER IMPEGNO ────────────────────────────────────────────────
// La banda di normalità di QUESTO impegno, misurata sui suoi pagamenti reali.
// Tace sotto minSamples: con due bollette non si sa cosa sia "normale".
export function commitmentNormality(c, allTx = {}, { minSamples = 3, k = 3 } = {}) {
  const amounts = commitmentOccurrences(c, allTx).map(t => Math.abs(+t.amount || 0)).filter(v => v > 0);
  if (amounts.length < minSamples) return null;
  const med = median(amounts);
  const mad = median(amounts.map(v => Math.abs(v - med))) || 0;
  // MAD nulla (importo identico ogni mese) → banda minima dell'1%: una rata fissa
  // che cambia di 2 centesimi non è un'anomalia.
  const spread = mad > 0 ? mad * 1.4826 : Math.max(med * 0.01, 0.5);
  return {
    typical: r2(med),
    low: r2(Math.max(0, med - k * spread)),
    high: r2(med + k * spread),
    samples: amounts.length,
    min: r2(Math.min(...amounts)),
    max: r2(Math.max(...amounts)),
    method: `mediana ± ${k}·MAD robusta su ${amounts.length} pagamenti reali`,
  };
}

// Questo pagamento è fuori scala per QUESTO impegno? Frase pronta e onesta:
// solo il fatto misurato, mai un giudizio.
export function judgeCommitmentPayment(c, amount, allTx = {}, opts = {}) {
  const n = commitmentNormality(c, allTx, opts);
  if (!n) return null;
  const amt = Math.abs(+amount || 0);
  if (amt >= n.low && amt <= n.high) {
    return { level: 'normale', typical: n.typical, samples: n.samples,
      message: `Nella norma per ${c.name}: di solito ${r2(n.typical)} €.` };
  }
  const pct = n.typical > 0 ? Math.round(((amt - n.typical) / n.typical) * 100) : 0;
  return {
    level: amt > n.high ? 'sopra' : 'sotto',
    typical: n.typical, samples: n.samples, deltaPct: pct,
    message: amt > n.high
      ? `${c.name} è ${pct}% sopra il tuo solito (${r2(n.typical)} €, misurato su ${n.samples} pagamenti).`
      : `${c.name} è ${Math.abs(pct)}% sotto il tuo solito (${r2(n.typical)} €): controlla che sia arrivata tutta.`,
  };
}

// ── 3. IL PONTE VERSO IL FORECAST ───────────────────────────────────────────
// Gli impegni arricchiti con la loro banda di normalità: il forecast di cassa
// usa min/max per allargare la banda dove l'importo è davvero incerto, invece
// di trattare una bolletta come una rata fissa.
export function enrichWithNormality(commitments = [], allTx = {}, opts = {}) {
  const enriched = enrichCommitmentsWithLearning(commitments, allTx);
  return enriched.map(c => {
    const n = commitmentNormality(c, allTx, opts);
    if (!n) return c;
    return { ...c, learned: true, learnedMin: n.low, learnedMax: n.high, typical: n.typical, normalitySamples: n.samples };
  });
}
