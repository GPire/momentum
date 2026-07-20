// ============================================================
// LIFESTYLE INFERENCE — Wave v10: leggere la VITA dietro le spese
// ============================================================
// Nessuna app di budgeting INTERPRETA il comportamento: mostrano categorie,
// non la vita che c'è dietro. Questo modulo lo fa in modo ONESTO e
// predittivo-nel-senso-giusto: confronta il mese corrente col BASELINE
// PERSONALE dell'utente (la sua stessa storia, non soglie assolute) e rileva
// un CAMBIAMENTO dalla propria norma — "questo mese sei uscito a cena 14
// volte, di solito ~6: vita sociale intensa". Sempre con l'evidenza numerica,
// MAI un giudizio ("stai sprecando"): riflette un pattern misurato, non
// moralizza. Funzioni pure, nessun DOM. È il pattern-detection comportamentale
// che rende Momentum "intelligente sulla persona", non solo sui numeri.
'use strict';

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function statsForMonth(allTx, mk) {
  const byCat = {};
  for (const t of allTx[mk] || []) {
    if (t.type !== 'uscita' && t.type !== 'invest') continue;
    const c = byCat[t.category] = byCat[t.category] || { count: 0, sum: 0 };
    c.count++; c.sum += Math.abs(t.amount);
  }
  return byCat;
}

// Baseline personale: media mensile di count e sum per categoria sugli ultimi
// `months` mesi COMPLETI precedenti a quello di riferimento. Ritorna anche il
// numero di mesi realmente disponibili (per calibrare la confidenza).
function personalBaseline(allTx, referenceDate, months) {
  const acc = {};
  let available = 0;
  for (let i = 1; i <= months; i++) {
    const mk = monthKeyOf(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1));
    if (!allTx[mk] || !allTx[mk].length) continue;
    available++;
    const s = statsForMonth(allTx, mk);
    for (const [cat, v] of Object.entries(s)) {
      const a = acc[cat] = acc[cat] || { count: 0, sum: 0 };
      a.count += v.count; a.sum += v.sum;
    }
  }
  const avg = {};
  const denom = available || 1;
  for (const [cat, v] of Object.entries(acc)) avg[cat] = { count: v.count / denom, sum: v.sum / denom };
  return { avg, monthsAvailable: available };
}

// confidenza onesta: cresce col numero di mesi di baseline (più storia = più
// fiducia nel "di solito") e con la forza della deviazione, mai oltre 0.9
// (è un'inferenza comportamentale, non un fatto certo).
function confidence(monthsAvailable, ratio) {
  if (monthsAvailable < 1) return 0;
  const dataConf = Math.min(1, monthsAvailable / 3);          // 3+ mesi = piena
  const devConf = Math.min(1, Math.abs(Math.log(ratio || 1))); // deviazione log-simmetrica
  return +Math.min(0.9, 0.4 * dataConf + 0.6 * devConf * dataConf).toFixed(2);
}

// Ritorna i pattern comportamentali rilevati questo mese vs la norma personale.
// Ogni pattern: { id, label, evidence, direction:'up'|'down', confidence }.
// Soglie DICHIARATE. Con baseline insufficiente → nessun pattern inventato.
export function inferLifestyle({ allTx = {}, referenceDate = new Date(), baselineMonths = 3, minEvents = 4 } = {}) {
  const mk = monthKeyOf(referenceDate);
  const now = statsForMonth(allTx, mk);
  const { avg, monthsAvailable } = personalBaseline(allTx, referenceDate, baselineMonths);
  const patterns = [];
  if (monthsAvailable < 1) return { month: mk, monthsAvailable, patterns };

  const get = (src, cat) => src[cat] || { count: 0, sum: 0 };
  const ratioCount = (cat) => { const b = get(avg, cat).count; return b > 0.5 ? get(now, cat).count / b : (get(now, cat).count >= minEvents ? 3 : 1); };
  const ratioSum = (cat) => { const b = get(avg, cat).sum; return b > 1 ? get(now, cat).sum / b : 1; };

  // 1. Vita sociale (uscite): ristoranti/bar per FREQUENZA (è il "molte cene").
  const rc = ratioCount('ristoranti'); const ristCount = get(now, 'ristoranti').count;
  if (ristCount >= minEvents && rc >= 1.4) {
    patterns.push({ id: 'social-active', direction: 'up', confidence: confidence(monthsAvailable, rc),
      label: 'Vita sociale intensa', evidence: `Sei uscito a cena/bar ${ristCount} volte questo mese (di solito ~${Math.round(get(avg, 'ristoranti').count)}).` });
  } else if (get(avg, 'ristoranti').count >= minEvents && rc <= 0.6) {
    patterns.push({ id: 'social-quiet', direction: 'down', confidence: confidence(monthsAvailable, 1 / (rc || 0.1)),
      label: 'Più serate a casa', evidence: `Solo ${ristCount} uscite a cena/bar (di solito ~${Math.round(get(avg, 'ristoranti').count)}): mese più casalingo.` });
  }

  // 2. Cucini di più: spesa (alimentari) su, ristoranti giù → risparmio implicito.
  if (ratioCount('spesa') >= 1.3 && rc <= 0.8 && get(now, 'spesa').count >= minEvents) {
    patterns.push({ id: 'home-cooking', direction: 'up', confidence: confidence(monthsAvailable, ratioCount('spesa')),
      label: 'Stai cucinando di più', evidence: `Più spesa alimentare (${get(now, 'spesa').count} volte) e meno ristoranti: stai mangiando a casa.` });
  }

  // 3. Shopping intenso: per IMPORTO (lo shopping è saltuario ma pesante).
  const shopR = ratioSum('shopping'); const shopSum = get(now, 'shopping').sum;
  if (shopSum > 0 && shopR >= 1.6 && get(avg, 'shopping').sum > 1) {
    patterns.push({ id: 'shopping-surge', direction: 'up', confidence: confidence(monthsAvailable, shopR),
      label: 'Mese di shopping', evidence: `Hai speso in shopping ${Math.round(shopSum)}€ (di solito ~${Math.round(get(avg, 'shopping').sum)}€).` });
  }

  // 4. In movimento / viaggio: trasporti sopra la norma (per importo).
  const moveR = ratioSum('trasporti');
  if (get(now, 'trasporti').sum > 0 && moveR >= 1.6 && get(avg, 'trasporti').sum > 1) {
    patterns.push({ id: 'on-the-move', direction: 'up', confidence: confidence(monthsAvailable, moveR),
      label: 'Molto in movimento', evidence: `Spese di mobilità ${Math.round(get(now, 'trasporti').sum)}€ questo mese (di solito ~${Math.round(get(avg, 'trasporti').sum)}€): forse viaggi o spostamenti.` });
  }

  // 5. Abitudine d'investimento che si consolida: invest presente sia ora sia
  //    nel baseline (regolarità, il segnale positivo che vale la pena rispecchiare).
  const investNow = get(now, 'etf').count + get(now, 'crypto').count + get(now, 'risparmio').count;
  const investBase = get(avg, 'etf').count + get(avg, 'crypto').count + get(avg, 'risparmio').count;
  if (investNow >= 1 && investBase >= 0.8 && monthsAvailable >= 2) {
    patterns.push({ id: 'investor-habit', direction: 'up', confidence: confidence(monthsAvailable, 1.5),
      label: 'Abitudine d\'investimento costante', evidence: `Investi/risparmi con regolarità (${investNow} operazioni questo mese, in linea con i mesi scorsi): ottimo per l\'interesse composto.` });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);
  return { month: mk, monthsAvailable, patterns };
}
