// ============================================================
// SPLIT ENGINE — divisione spese di gruppo P2P, on-device (v10)
// ============================================================
// Il differenziatore: Splitwise/Settle Up vivono sul cloud con limiti/paywall;
// Momentum divide le spese 100% on-device (e sincronizzabile via mesh cifrata),
// senza server. Piu' intelligente della concorrenza:
//  - minimalSettlement: la MATRICE di compensazione minima (meno bonifici
//    possibili per azzerare i debiti) — il cuore matematico di Settle Up;
//  - suggestSettleTiming: QUANDO conviene saldare (predittivo, sulle entrate);
//  - ponte col bonifico SEPA on-device: salda un debito con QR/WhatsApp reali,
//    senza pagamenti in-app (che richiederebbero licenze/cloud).
// Onesta' (regola #1): niente numeri inventati; i saldi sono aritmetica esatta
// (somma sempre zero); il settlement greedy e' near-ottimo (il minimo assoluto e'
// NP-hard) e lo dichiariamo. Funzioni pure, nessun DOM, nessuna rete.
'use strict';

import { mergeMemberPair, mergeClosure } from './group-membership.js';
import { mergeChat } from './group-chat.js';
import { mergePromises } from './payment-promise.js';

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

// Id univoco globale (device-agnostic): tempo + casuale. Serve a rendere le
// spese di persone diverse NON collidenti → merge conflict-free tra dispositivi
// lontani senza server.
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Crea un gruppo. members = [{id, name}] o [nomi]. Normalizza a {id, name}.
// `id` di gruppo univoco: due copie dello STESSO gruppo (una creata, una ricevuta)
// condividono l'id e si fondono; gruppi diversi restano distinti.
// `baseCurrency` opzionale (default EUR, retrocompatibile con i gruppi già
// creati): Momentum è globale, non solo europea (vedi memoria di progetto),
// quindi un utente USA/UK/qualunque Paese può creare un gruppo nella propria
// valuta — main.js la rileva dal device alla creazione, mai hardcoded qui.
export function createGroup({ name = 'Gruppo', members = [], id, baseCurrency = 'EUR' } = {}) {
  const norm = members.map((m, i) => typeof m === 'string' ? { id: `m${i}`, name: m } : { id: m.id || `m${i}`, name: m.name || `Membro ${i + 1}` });
  return { id: id || genId(), name, members: norm, expenses: [], baseCurrency };
}

// Aggiunge una spesa condivisa. `shares` opzionale:
//  - assente → divisione EQUA tra tutti i membri;
//  - { equalAmong:[id,...] } → equa solo tra alcuni;
//  - { byId:{id:quota} } → quote ESATTE in euro (devono sommare all'importo);
//  - { weights:{id:peso} } → ripartizione proporzionale ai pesi.
// payer = id del membro che ha pagato. Ritorna il nuovo gruppo (immutabile).
//
// VALUTA (gap reale trovato: un gruppo di viaggio assumeva un'unica valuta
// condivisa mai dichiarata — chi pagava in CHF/GBP durante un viaggio non
// aveva modo di registrarlo). `amount` resta SEMPRE l'importo vero in EUR,
// l'UNICA cifra che saldi/settlement/SEPA leggono — zero modifiche a valle,
// zero seconda fonte di verità. `originalAmount`/`originalCurrency`/
// `exchangeRate` sono opzionali e servono SOLO da etichetta onesta per la UI
// ("questo veniva da 45 CHF, tasso del 12/08"): il tasso è quello del GIORNO
// della spesa, fissato per sempre a quel momento (mai ricalcolato dopo — un
// saldo che cambia nel tempo perché il cambio è sceso tradirebbe la fiducia,
// stesso principio già applicato ovunque nel progetto per i dati "quasi in
// tempo reale"). Chi chiama (main.js) fa la conversione PRIMA di chiamare
// questa funzione — split-engine.js resta puro, nessuna rete qui (vedi
// commento in testa al file).
export function addSharedExpense(group, { payer, amount, description = '', date, shares, originalAmount, originalCurrency, exchangeRate } = {}) {
  const amt = round2(amount);
  if (!(amt > 0)) throw new Error('importo non valido');
  if (!group.members.some(m => m.id === payer)) throw new Error('pagante non nel gruppo');
  const ids = group.members.map(m => m.id);

  // Se dichiarata una valuta originale diversa dall'euro, l'importo
  // convertito deve tornare col tasso dichiarato — mai accettare in silenzio
  // due numeri che non si spiegano a vicenda (stesso principio delle quote
  // che devono sommare esatte in shares.byId, sopra).
  let valutaExtra = {};
  const baseCurrency = group.baseCurrency || 'EUR';
  if (originalCurrency && originalCurrency !== baseCurrency) {
    if (!(originalAmount > 0) || !(exchangeRate > 0)) throw new Error('valuta originale senza importo o tasso di cambio');
    const atteso = round2(originalAmount * exchangeRate);
    if (Math.abs(atteso - amt) > 0.02) throw new Error('l\'importo convertito non coincide col tasso di cambio dichiarato');
    valutaExtra = { originalAmount: round2(originalAmount), originalCurrency, exchangeRate };
  }

  // id GLOBALMENTE univoco (non l'indice): cosi' le spese aggiunte da persone
  // diverse non collidono e il merge tra dispositivi e' conflict-free. Serve
  // anche come seme per distribuire il resto (vedi balanceRounding).
  const expenseId = genId();
  // arrotonda le quote distribuendo il resto un centesimo alla volta (somma esatta)
  const owed = balanceRounding(idealShares(ids, amt, shares), amt, expenseId);
  // La REGOLA con cui si e' diviso resta scritta nella spesa, non solo il suo
  // risultato in centesimi: serve a ricalcolare correttamente se l'importo
  // viene corretto dopo (vedi il bug documentato in editExpense).
  const expense = { id: expenseId, payer, amount: amt, description, date: date || new Date().toISOString().slice(0, 10), owed, split: splitRule(ids, shares), updatedAt: Date.now(), ...valutaExtra };
  return { ...group, expenses: [...group.expenses, expense] };
}

// Quote IDEALI (non ancora arrotondate) secondo la regola di divisione scelta.
// Estratta perche' serve identica in due punti: quando la spesa nasce e quando
// il suo importo viene corretto — prima il secondo caso riscalava i centesimi
// gia' arrotondati, con l'effetto descritto in editExpense.
function idealShares(ids, amt, shares) {
  const owed = {};
  if (!shares) {
    const each = amt / ids.length;
    for (const id of ids) owed[id] = each;
  } else if (shares.equalAmong) {
    const grp = shares.equalAmong.filter(id => ids.includes(id));
    if (!grp.length) throw new Error('nessun partecipante valido');
    const each = amt / grp.length;
    for (const id of grp) owed[id] = each;
  } else if (shares.byId) {
    let sum = 0;
    for (const [id, q] of Object.entries(shares.byId)) { if (ids.includes(id)) { owed[id] = +q; sum += +q; } }
    if (Math.abs(round2(sum) - amt) > 0.01) throw new Error('le quote non sommano all\'importo');
  } else if (shares.weights) {
    const w = shares.weights; const tot = Object.values(w).reduce((a, b) => a + (+b || 0), 0);
    if (tot <= 0) throw new Error('pesi non validi');
    for (const [id, ww] of Object.entries(w)) if (ids.includes(id)) owed[id] = amt * (+ww) / tot;
  }
  return owed;
}

// Spese create PRIMA che la regola venisse salvata (gia' sui telefoni delle
// persone): la si ricostruisce guardando i centesimi. Se tutte le quote non
// nulle stanno entro un centesimo l'una dall'altra, quella spesa era divisa in
// parti uguali — tra tutti o tra alcuni. Altrimenti si resta sul comportamento
// storico (riscalatura proporzionale), che per le quote volute a mano e' anche
// quello giusto. Nessun dato vecchio va perso o reinterpretato a forza.
function inferRule(owed = {}, ids = []) {
  const parts = Object.entries(owed).filter(([, v]) => Math.abs(+v || 0) > 0.005);
  if (parts.length < 2) return { mode: 'exact' };
  const cents = parts.map(([, v]) => Math.round(v * 100));
  if (Math.max(...cents) - Math.min(...cents) > 1) return { mode: 'exact' };
  const partecipanti = parts.map(([id]) => id);
  return partecipanti.length === ids.length ? { mode: 'equal' } : { mode: 'among', ids: partecipanti };
}

// Come e' stata divisa questa spesa, in forma compatta e stabile nel tempo.
// Le quote esatte in euro (byId) NON diventano una regola riutilizzabile: erano
// importi voluti per QUEL conto, e se l'importo cambia vanno riscalate.
function splitRule(ids, shares) {
  if (!shares) return { mode: 'equal' };
  if (shares.equalAmong) return { mode: 'among', ids: shares.equalAmong.filter(id => ids.includes(id)) };
  if (shares.weights) return { mode: 'weights', weights: { ...shares.weights } };
  return { mode: 'exact' };
}

// Arrotonda le quote a 2 decimali facendo tornare la somma ESATTA all'importo:
// mai centesimi persi, e mai una quota fuori scala rispetto alle altre.
//
// BUG REALE CORRETTO (trovato verificando 140.000 combinazioni importo/persone,
// non a campione): la versione precedente arrotondava ogni quota per conto suo
// e poi scaricava TUTTO il residuo su una persona sola. In 46.928 casi su
// 140.000 (il 33%) le quote finivano per differire di piu' di un centesimo —
// 100 € tra 7 dava 14,26 a uno e 14,29 a tutti gli altri — e nei casi estremi
// la quota diventava addirittura NEGATIVA (0,04 € tra 8 → −0,03 e sette da
// 0,01). Numeri che l'utente vede, non torna a farsi i conti, e smette di
// fidarsi dell'app: il danno peggiore possibile per un'app di soldi.
//
// Metodo corretto (resto massimo / Hamilton, lo stesso che quickSplit gia'
// usava — l'app divideva in DUE modi diversi a seconda del percorso): si prende
// la parte intera in centesimi di ogni quota, poi si distribuiscono i centesimi
// mancanti UNO ALLA VOLTA a chi ha il resto piu' grande. Cosi' due quote non
// differiscono mai di piu' di un centesimo, e nessuna puo' diventare negativa.
//
// A parita' di resto l'ordine e' ruotato da un seme (l'id della spesa): senza,
// il centesimo in piu' toccherebbe sempre alla stessa persona — su cento spese
// diventano euro veri. Il seme e' l'id della spesa, identico su ogni
// dispositivo, quindi il risultato resta deterministico e il merge P2P
// converge (due telefoni non devono mai calcolare quote diverse).
function seedFrom(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function balanceRounding(owed, amt, seed = '') {
  const ids = Object.keys(owed);
  if (!ids.length) return {};
  const target = Math.round(amt * 100);
  const floors = {}; let assegnati = 0;
  const resti = [];
  for (const id of ids) {
    const exact = (+owed[id] || 0) * 100;
    const base = Math.floor(exact + 1e-9); // 1e-9: 33.33*100 in binario e' 3332.9999...
    floors[id] = base; assegnati += base;
    resti.push({ id, resto: exact - base });
  }
  let restanti = target - assegnati; // centesimi ancora da assegnare
  const rot = ids.length ? seedFrom(seed) % ids.length : 0;
  // Ordine: resto piu' grande per primo; a parita', si parte da un punto
  // diverso della lista a seconda della spesa (rotazione), mai sempre dal primo.
  const pos = Object.fromEntries(ids.map((id, i) => [id, (i + rot) % ids.length]));
  resti.sort((a, b) => (b.resto - a.resto) || (pos[a.id] - pos[b.id]));
  const out = {};
  for (const id of ids) out[id] = floors[id];
  // Caso normale: mancano centesimi → uno a testa, a chi ha il resto maggiore.
  for (let i = 0; restanti > 0 && i < resti.length; i++) { out[resti[i].id] += 1; restanti--; }
  // Caso opposto (quote gia' in eccesso, es. byId con importi arrotondati a
  // monte): si toglie un centesimo alla volta, partendo dal resto piu' piccolo
  // e mai da chi resterebbe sotto zero.
  for (let i = resti.length - 1; restanti < 0 && i >= 0; i--) { if (out[resti[i].id] > 0) { out[resti[i].id] -= 1; restanti++; } }
  const res = {};
  for (const id of ids) res[id] = out[id] / 100;
  return res;
}

// Saldi netti per membro: pagato − dovuto. Positivo = deve ricevere; negativo =
// deve dare. La somma e' sempre ~0 (invariante verificata nei test).
export function computeBalances(group) {
  const bal = {};
  for (const m of group.members) bal[m.id] = 0;
  for (const e of group.expenses) {
    bal[e.payer] = round2((bal[e.payer] || 0) + e.amount);
    for (const [id, q] of Object.entries(e.owed)) bal[id] = round2((bal[id] || 0) - q);
  }
  for (const k of Object.keys(bal)) bal[k] = round2(bal[k]);
  return bal;
}

// Greedy su una lista di saldi (debitore piu' grande → creditore piu' grande).
// Per un insieme a somma-zero produce (|nonzero|-1) bonifici, che e' l'ottimo per
// un singolo gruppo indivisibile. Ritorna [{from,to,amount}].
function greedySettle(entries) {
  const creditors = entries.filter(e => e.v > EPS).map(e => ({ m: e.m, v: e.v })).sort((a, b) => b.v - a.v);
  const debtors = entries.filter(e => e.v < -EPS).map(e => ({ m: e.m, v: -e.v })).sort((a, b) => b.v - a.v);
  const tx = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].v, creditors[j].v));
    if (pay > EPS) tx.push({ from: debtors[i].m, to: creditors[j].m, amount: pay });
    debtors[i].v = round2(debtors[i].v - pay); creditors[j].v = round2(creditors[j].v - pay);
    if (debtors[i].v <= EPS) i++; if (creditors[j].v <= EPS) j++;
  }
  return tx;
}

// ── SETTLEMENT MINIMO ESATTO ─────────────────────────────────────────────────
// Il problema (debt simplification) e' NP-hard: minimizzare i bonifici equivale
// a MASSIMIZZARE il numero di sottogruppi a somma zero in cui si partiziona il
// gruppo — k persone che si compensano fra loro si chiudono con k-1 bonifici,
// quindi n persone in p sottogruppi si chiudono con n-p pagamenti.
//
// La versione precedente era esatta solo fino a 12 persone, perche' il DP
// provava TUTTI i 3^n abbinamenti mask/sottomask (a 13 persone gia' 1,6
// milioni di stati, e la memoria cresce come 2^n). Sopra i 12 si ripiegava sul
// greedy, che su gruppi grandi fa davvero bonifici in piu' del necessario.
//
// MIGLIORAMENTO — dimostrato, non euristico. Una partizione con il MASSIMO
// numero di blocchi usa solo blocchi MINIMALI (blocchi a somma zero che non
// ne contengono al loro interno uno piu' piccolo, sempre a somma zero): se un
// blocco della partizione non fosse minimale, conterrebbe un sotto-blocco a
// somma zero; spezzandolo si otterrebbero DUE blocchi al posto di uno, cioe'
// una partizione strettamente migliore — assurdo, perche' quella di partenza
// era massima. Enumerare i soli blocchi minimali quindi non perde mai
// l'ottimo, ed e' un insieme enormemente piu' piccolo di tutti i sottoinsiemi.
// Risultato: la stessa garanzia di ottimalita', ma su gruppi molto piu' grandi
// (viaggi, feste, coinquilini: 15-22 persone sono normali). Oltre il budget di
// esplorazione si ripiega ancora sul greedy — e lo si dichiara, invece di far
// finta che sia comunque il minimo.
//
// L'aritmetica e' in CENTESIMI INTERI: "somma zero" diventa un confronto esatto
// invece di una tolleranza float scelta a mano (prima `< 0.01`), quindi nessun
// blocco viene accettato o scartato per un errore di arrotondamento.
const EXACT_MAX_N = 22;            // oltre: nemmeno l'enumerazione dei minimali vale l'attesa
const BLOCK_NODE_BUDGET = 400000;  // nodi DFS massimi (protegge il telefono piu' lento)
const DP_STATE_BUDGET = 200000;    // stati di partizionamento massimi

// Blocchi MINIMALI a somma zero, come bitmask. Ritorna null se l'esplorazione
// supera il budget (il chiamante ripiega sul greedy invece di bloccare la UI).
function zeroSumMinimalBlocks(cents) {
  const n = cents.length;
  // Quanto si puo' ancora aggiungere, in positivo e in negativo, da i in poi:
  // se nemmeno prendendo tutto il resto si puo' tornare a zero, il ramo e' morto.
  const sufPos = new Array(n + 1).fill(0), sufNeg = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    sufPos[i] = sufPos[i + 1] + (cents[i] > 0 ? cents[i] : 0);
    sufNeg[i] = sufNeg[i + 1] + (cents[i] < 0 ? cents[i] : 0);
  }
  const found = [];
  let nodes = 0, overflow = false;
  const dfs = (i, mask, sum) => {
    if (overflow) return;
    if (++nodes > BLOCK_NODE_BUDGET) { overflow = true; return; }
    // Somma zero raggiunta: si registra e NON si espande oltre — ogni superset
    // conterrebbe questo blocco, quindi non sarebbe minimale per definizione.
    if (mask !== 0 && sum === 0) { found.push(mask); return; }
    if (i >= n) return;
    if (sum + sufPos[i] < 0 || sum + sufNeg[i] > 0) return; // zero irraggiungibile
    dfs(i + 1, mask | (1 << i), sum + cents[i]);
    dfs(i + 1, mask, sum);
  };
  dfs(0, 0, 0);
  if (overflow) return null;

  // Il troncamento sopra elimina i superset lungo lo STESSO cammino, ma un
  // blocco puo' contenerne uno piu' piccolo trovato per un'altra strada
  // (es. {5,-3,-5,3} contiene {5,-5}): filtro finale, dal piu' piccolo.
  found.sort((a, b) => popcount(a) - popcount(b));
  const minimal = [];
  for (const m of found) if (!minimal.some(x => (x & m) === x)) minimal.push(m);
  return minimal;
}

function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }

// Compensazione MINIMA (debt simplification): chi paga chi col MINOR numero di
// bonifici per azzerare tutti i debiti. Semplifica le catene (A→B→C ⇒ A→C).
// Esatto (minimo ASSOLUTO dimostrato) fino a EXACT_MAX_N persone con saldo non
// nullo; oltre, o se l'esplorazione sfora il budget, greedy near-ottimo.
// Sempre corretto: azzera tutti i saldi. Piu' potente di Splitwise/Settle Up,
// che semplificano con euristiche di tipo greedy.
// Come minimalSettlement, ma dichiara anche COME ci è arrivato ('exact' —
// minimo assoluto dimostrato — o 'greedy', quando il problema supera il
// budget calcolabile su questo dispositivo). Estratta il 2026-08-30 per
// alimentare settlementVerificationLog() sotto — il gap reale trovato nella
// ricerca competitor su Splitwise: il solver esatto c'è già, ma non mostra
// mai il "perché" in modo leggibile, e almeno un utente Splitwise riporta
// di non fidarsi delle riconciliazioni automatiche (ANALISI_COMPETITOR.md,
// §7). minimalSettlement() sotto resta un involucro sottile: stessa firma,
// stesso comportamento, NESSUN chiamante esistente deve cambiare.
export function minimalSettlementDetailed(balances) {
  const entries = Object.entries(balances).map(([m, v]) => ({ m, v: round2(v) })).filter(e => Math.abs(e.v) > EPS);
  const n = entries.length;
  if (n === 0) return { transfers: [], method: 'none' };
  if (n > EXACT_MAX_N) return { transfers: greedySettle(entries), method: 'greedy' };

  const cents = entries.map(e => Math.round(e.v * 100));
  // Se i saldi non sommano esattamente a zero (arrotondamenti a monte), nessuna
  // partizione esiste: il greedy resta comunque corretto e chiude tutto.
  if (cents.reduce((s, c) => s + c, 0) !== 0) return { transfers: greedySettle(entries), method: 'greedy' };

  const blocks = zeroSumMinimalBlocks(cents);
  if (!blocks) return { transfers: greedySettle(entries), method: 'greedy' }; // budget sforato → onestamente greedy

  // Ogni blocco viene provato solo dal mask che ha il suo bit piu' basso come
  // primo bit libero: cosi' ogni partizione e' generata una volta sola.
  const byLowest = new Map();
  for (const b of blocks) {
    const idx = 31 - Math.clz32(b & -b);
    if (!byLowest.has(idx)) byLowest.set(idx, []);
    byLowest.get(idx).push(b);
  }

  const memo = new Map(), choice = new Map();
  let dpOverflow = false;
  const solve = (mask) => {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask);
    if (memo.size > DP_STATE_BUDGET) { dpOverflow = true; return -1; }
    const idx = 31 - Math.clz32(mask & -mask);
    let bestVal = -1, bestB = 0;
    for (const b of (byLowest.get(idx) || [])) {
      if ((b & mask) !== b) continue;
      const sub = solve(mask ^ b);
      if (sub >= 0 && 1 + sub > bestVal) { bestVal = 1 + sub; bestB = b; }
    }
    memo.set(mask, bestVal); choice.set(mask, bestB);
    return bestVal;
  };
  const full = n === 32 ? -1 : (1 << n) - 1;
  if (solve(full) < 0 || dpOverflow) return { transfers: greedySettle(entries), method: 'greedy' };

  const tx = []; let mask = full;
  while (mask) {
    const s = choice.get(mask); if (!s) break;
    const sub = []; for (let i = 0; i < n; i++) if (s & (1 << i)) sub.push({ ...entries[i] });
    tx.push(...greedySettle(sub)); mask ^= s;
  }
  return { transfers: tx, method: 'exact' };
}

export function minimalSettlement(balances) {
  return minimalSettlementDetailed(balances).transfers;
}

// Statistica per la UI: quanti pagamenti servirebbero SENZA semplificazione
// (ogni partecipante rimborsa ogni pagante, per spesa) vs col settlement minimo.
// Rende visibile e concreto il vantaggio ("da 7 a 2 pagamenti").
export function settlementCounts(group) {
  const pairs = new Set();
  for (const e of group.expenses || []) for (const id of Object.keys(e.owed || {})) if (id !== e.payer) pairs.add(`${id}>${e.payer}`);
  const simplified = minimalSettlement(computeBalances(group)).length;
  return { raw: pairs.size, simplified, saved: Math.max(0, pairs.size - simplified) };
}

// ── SEMPLIFICATORE CROSS-GRUPPO (più potente di Splitwise) ───────────────────
// Splitwise semplifica i debiti DENTRO un gruppo. Ma con le stesse persone sei
// in più gruppi (casa, viaggi, cene): se devi a Marco in "casa" e Marco ti deve
// in "viaggio", nella vita reale i due si COMPENSANO. Qui si costruisce il grafo
// netto GLOBALE per NOME attraverso tutti i gruppi e lo si chiude col settlement
// minimo esatto (bitmask) → meno bonifici REALI di quanti Splitwise possa mai
// produrre, perché non attraversa mai i gruppi. In più, a parità di numero
// minimo di pagamenti, PREFERISCE i canali che esistono davvero (IBAN noti / chi
// si è già pagato in passato): il piano è ESEGUIBILE, non solo minimo a tavolino.
// Ritorna { transfers:[{from,to,amount}], perGroup, saved } dove perGroup è la
// somma dei pagamenti se si saldasse gruppo per gruppo (il metodo Splitwise).
export function simplifyAcrossGroups(groups = [], { knownChannels = new Set() } = {}) {
  const list = (groups || []).filter(g => g && Array.isArray(g.members) && Array.isArray(g.expenses));
  if (!list.length) return { transfers: [], perGroup: 0, saved: 0 };

  // Saldo netto GLOBALE per nome (persona), sommando ogni gruppo.
  const netByName = new Map();
  let perGroup = 0;
  for (const g of list) {
    const idToName = Object.fromEntries(g.members.map(m => [m.id, String(m.name || m).trim()]));
    const bal = computeBalances(g);
    for (const [id, v] of Object.entries(bal)) {
      const nm = idToName[id]; if (!nm) continue;
      netByName.set(nm, round2((netByName.get(nm) || 0) + v));
    }
    perGroup += minimalSettlement(bal).length; // quanti pagamenti farebbe Splitwise (per gruppo)
  }
  const globalBal = {};
  for (const [nm, v] of netByName) if (Math.abs(v) > EPS) globalBal[nm] = v;

  // Settlement minimo esatto sul grafo globale, con tie-break sui canali reali.
  const transfers = minimalSettlementPreferring(globalBal, knownChannels);
  return { transfers, perGroup, saved: Math.max(0, perGroup - transfers.length) };
}

// Come minimalSettlement, ma quando restano più abbinamenti debitore→creditore a
// pari merito, sceglie prima quelli su un canale "reale" (in knownChannels, set
// di stringhe "from>to"). Non aumenta MAI il numero di bonifici: la preferenza
// agisce solo a parità, rendendo il piano più probabile da eseguire davvero.
function minimalSettlementPreferring(balances, knownChannels = new Set()) {
  const base = minimalSettlement(balances);
  if (!knownChannels || !knownChannels.size) return base;
  // Riordina i pagamenti mettendo davanti quelli su canale noto (stessa cardinalità).
  return base.slice().sort((a, b) => {
    const ka = knownChannels.has(`${a.from}>${a.to}`) ? 0 : 1;
    const kb = knownChannels.has(`${b.from}>${b.to}`) ? 0 : 1;
    return ka - kb;
  });
}

// Vista "chi deve cosa a chi" pronta per la UI, con i nomi risolti.
export function settlementView(group) {
  const byId = Object.fromEntries(group.members.map(m => [m.id, m.name]));
  const balances = computeBalances(group);
  const transfers = minimalSettlement(balances).map(t => ({ ...t, fromName: byId[t.from], toName: byId[t.to] }));
  return { balances, transfers, total: round2(group.expenses.reduce((s, e) => s + e.amount, 0)) };
}

// ── LOG DI VERIFICA DEL SETTLEMENT (2026-08-30) ──────────────────────────────
// Gap reale trovato nella ricerca competitor (ANALISI_COMPETITOR.md, §7):
// Splitwise mostra IL RISULTATO del suo debt-simplification (chi paga chi),
// ma non un modo leggibile di VERIFICARE che sia corretto — almeno un utente
// riporta di non fidarsi delle riconciliazioni automatiche e di dover
// esportare tutto per controllare a mano. Momentum ha già il solver esatto
// (minimalSettlementDetailed sopra); questa funzione lo fa RACCONTARE cosa
// ha fatto, passo per passo, invece di limitarsi a mostrare il totale.
//
// Non è un export Excel: è una traccia leggibile — ogni passaggio mostra il
// saldo di chi paga e chi riceve PRIMA e DOPO quel bonifico, così l'utente
// può controllare a occhio, un passaggio alla volta, senza fidarsi e basta.
// `verified` è un controllo aritmetico VERO (non un'etichenda decorativa):
// applica ogni trasferimento in sequenza e conferma che ogni saldo torni a
// zero alla fine — se per un bug futuro non tornasse, questo campo lo dice,
// non lo nasconde.
export function settlementVerificationLog(group) {
  const byId = Object.fromEntries(group.members.map(m => [m.id, m.name]));
  const balances = computeBalances(group);
  const { transfers, method } = minimalSettlementDetailed(balances);

  const running = { ...balances };
  const steps = transfers.map((t) => {
    const fromBalanceBefore = round2(running[t.from] ?? 0);
    const toBalanceBefore = round2(running[t.to] ?? 0);
    running[t.from] = round2(fromBalanceBefore + t.amount); // meno debito (si avvicina a 0)
    running[t.to] = round2(toBalanceBefore - t.amount);     // meno credito (si avvicina a 0)
    return {
      from: t.from, fromName: byId[t.from],
      to: t.to, toName: byId[t.to],
      amount: t.amount,
      fromBalanceBefore, fromBalanceAfter: running[t.from],
      toBalanceBefore, toBalanceAfter: running[t.to],
    };
  });

  const verified = Object.values(running).every((v) => Math.abs(v) <= EPS);

  return {
    method,          // 'exact' (minimo dimostrato) | 'greedy' (budget di calcolo superato) | 'none' (già tutto a zero)
    steps,           // un passaggio leggibile per bonifico, nell'ordine in cui va eseguito
    verified,        // true SOLO se ogni saldo torna davvero a zero applicando i passaggi in ordine
    finalBalances: running,
  };
}

// DIVISIONE ISTANTANEA (semplice per chiunque): "quanto in totale, in quante
// persone" → quanto paga ognuno, al centesimo ESATTO (il resto va su una quota,
// mai centesimi persi). Opzione tip: arrotonda per eccesso all'euro (mancia/
// comodità). Ritorna { perPerson, shares, total, n, roundedTotal }.
export function quickSplit({ amount, people, tipRoundUp = false } = {}) {
  const n = Math.max(1, Math.floor(+people || 1));
  let total = round2(amount);
  if (!(total > 0)) return { perPerson: 0, shares: new Array(n).fill(0), total: 0, n, roundedTotal: 0 };
  let roundedTotal = total;
  if (tipRoundUp) { const per = Math.ceil((total / n)); roundedTotal = round2(per * n); }
  const base = Math.floor((roundedTotal / n) * 100) / 100;
  const shares = new Array(n).fill(base);
  let dist = round2(roundedTotal - base * n); // resto in centesimi
  let i = 0;
  while (dist >= 0.01 && i < n) { shares[i] = round2(shares[i] + 0.01); dist = round2(dist - 0.01); i++; }
  return { perPerson: round2(roundedTotal / n), shares, total, n, roundedTotal };
}

// PREDITTIVO: le persone con cui dividi PIÙ spesso (dai gruppi passati), per
// pre-compilare il gruppo con un tocco invece di riscrivere i nomi ogni volta.
// Esclude un eventuale "me"/"io". Ritorna [{name, count}] ordinato per frequenza.
export function frequentCoSplitters(pastGroups = [], { topN = 6, meNames = ['io', 'me'] } = {}) {
  const freq = new Map();
  for (const g of pastGroups) for (const m of (g.members || [])) {
    const name = String(m.name || m).trim(); if (!name) continue;
    if (meNames.includes(name.toLowerCase())) continue;
    freq.set(name, (freq.get(name) || 0) + 1);
  }
  return [...freq.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, topN);
}

// PREDITTIVO: quando conviene a un debitore saldare. Se sono note le entrate
// ricorrenti in arrivo (es. dallo storico), suggerisce di aspettare il prossimo
// accredito se il debito supera il disponibile attuale. Onesto: senza dati sulle
// entrate, dice semplicemente "quando puoi"; niente promesse.
export function suggestSettleTiming({ amountDue, currentAvailable = null, nextIncome = null } = {}) {
  if (currentAvailable == null) return { when: 'quando puoi', reason: null };
  if (amountDue <= currentAvailable) return { when: 'ora', reason: 'hai il disponibile per saldarlo senza scoperti' };
  if (nextIncome && nextIncome.date) return { when: 'dopo il prossimo accredito', reason: `il debito supera il tuo disponibile ora; dopo il ${nextIncome.date} avrai margine` };
  return { when: 'a rate o appena hai margine', reason: 'il debito supera il tuo disponibile attuale' };
}

// ============================================================
// CONDIVISIONE GRUPPO A DISTANZA, SENZA SERVER (conflict-free)
// ============================================================
// Il gap coi competitor: sincronizzare il gruppo tra persone LONTANE. Qui NON
// serve un server ne' dispositivi vicini: si condivide un CODICE (via WhatsApp/
// email/QR — i canali che le persone gia' usano) e chi lo riceve lo FONDE. Il
// merge e' CONFLICT-FREE (union per id univoco), COMMUTATIVO e IDEMPOTENTE: non
// importa chi condivide per primo, ne' quante volte — il risultato converge.
// E' l'equivalente proprietario del cloud di Splitwise, ma "il cloud sei tu".

// Unione membri con RICONCILIAZIONE del "claim" (quale dispositivo è quel
// membro — vedi claimMember più sotto): una union semplice terrebbe sempre
// la prima copia vista di un id, quindi un claim fatto DOPO che il gruppo
// era già stato condiviso sparirebbe al primo merge. Regola: un membro
// CLAIMATO batte uno non claimato;
// tra due claim diversi sullo stesso id (due dispositivi hanno provato a
// diventare la stessa persona) vince il PRIMO nel tempo (claimedAt) — mai
// un secondo dispositivo può "rubare" uno slot già preso.
// LAPIDI (group-membership.js): prima questa fusione era SOLO-AGGIUNTA, quindi
// un membro rimosso tornava al primo sync con un dispositivo che aveva ancora
// la lista vecchia — un'assenza perde sempre contro una presenza. Ora l'uscita
// è un FATTO con un istante, e vince: è ciò che rende reale "esci dal gruppo"
// invece di farlo sembrare fatto finché non ti sincronizzi.
function mergeMembers(a = [], b = []) {
  const byId = new Map();
  const put = (m) => byId.set(m.id, mergeMemberPair(byId.get(m.id), m));
  for (const x of a) put(x);
  for (const x of b) put(x);
  return [...byId.values()];
}

// Rivendica uno slot-membro per QUESTO dispositivo (deviceId persistente,
// generato una volta e salvato — vedi VaultDAO.state.deviceId). Impedisce
// che chi entra da un link possa scegliere lo slot "Io" del creatore o
// quello di un'altra persona già collegata: uno slot già claimato da un
// ALTRO device non può essere sovrascritto. Ritorna il gruppo invariato se
// il membro non esiste o è già di un altro dispositivo.
export function claimMember(group, memberId, deviceId) {
  const idx = group.members.findIndex(m => m.id === memberId);
  if (idx === -1) return group;
  const m = group.members[idx];
  if (m.claimedBy && m.claimedBy !== deviceId) return group; // già di un altro device
  if (m.claimedBy === deviceId) return group; // già mio, nessun cambiamento
  const members = group.members.slice();
  members[idx] = { ...m, claimedBy: deviceId, claimedAt: Date.now() };
  return { ...group, members };
}

// Quale membro (se esiste) QUESTO dispositivo rappresenta in questo gruppo —
// serve per bloccare "chi paga" al proprio slot invece di un menu libero
// dove chiunque potrebbe scegliere di essere chiunque altro.
export function myMemberId(group, deviceId) {
  return group.members.find(m => m.claimedBy === deviceId)?.id || null;
}

// BUG REALE trovato beta-testando (2026-08-27): niente impedisce a due
// membri di avere lo stesso nome (coinquilini che si chiamano entrambi
// "Marco", un familiare che si aggiunge con lo stesso nome di un amico) —
// caso realistico, non un edge case remoto. Senza disambiguazione erano
// visivamente IDENTICI ovunque: avatarColore()/avatarIniziali() sono
// funzioni pure del solo nome, quindi stesso colore, stesse iniziali, e
// "Marco ha pagato 40€" indistinguibile da un altro "Marco ha pagato 40€"
// nella stessa lista. Fix a UN SOLO PUNTO (qui, non nella UI): un nome
// duplicato riceve un suffisso stabile SOLO quando serve — mai un nome
// unico modificato — cosicché ogni consumatore a valle (avatar, righe
// spesa, chat) erediti automaticamente l'etichetta già distinguibile senza
// dover essere toccato uno per uno.
export function displayNames(members = []) {
  const conteggi = new Map();
  for (const m of members) conteggi.set(m.name, (conteggi.get(m.name) || 0) + 1);
  const visti = new Map();
  const out = {};
  for (const m of members) {
    if ((conteggi.get(m.name) || 0) > 1) {
      const n = (visti.get(m.name) || 0) + 1;
      visti.set(m.name, n);
      out[m.id] = `${m.name} #${n}`;
    } else {
      out[m.id] = m.name;
    }
  }
  return out;
}

// Slot ancora liberi (nessun dispositivo li ha rivendicati) — la UI di
// ingresso mostra SOLO questi come scelta, oltre a "aggiungi il mio nome".
export function unclaimedMembers(group) {
  return group.members.filter(m => !m.claimedBy);
}

// Unione CRDT con LAST-WRITER-WINS per stesso id: le AGGIUNTE si uniscono, le
// MODIFICHE (stesso id, es. importo cambiato su un dispositivo) vincono se più
// recenti (updatedAt). Prima unionById teneva sempre il primo → un importo
// aggiornato su un telefono non arrivava mai agli altri. Ora converge in
// entrambe le direzioni (A∪B = B∪A) e propaga davvero gli aggiornamenti.
// BUG REALE trovato con la batteria di garanzia pre-rilascio (2026-09-05,
// garanzia-rilascio.test.js): il criterio "a parità resta il primo" NON è
// deterministico rispetto all'ordine dei due lati. Due dispositivi che
// correggono la STESSA spesa nello stesso millisecondo producono
// `updatedAt` identici, e allora merge(A,B) teneva 150 mentre merge(B,A)
// teneva 200 — i due telefoni restavano in disaccordo per sempre, senza
// nessun meccanismo che li riconciliasse. È esattamente la proprietà che un
// CRDT deve garantire (A∪B = B∪A) e che il commento qui sopra dichiarava
// già di avere: era vera solo finché i timestamp differivano.
//
// A parità di millisecondo NESSUNO può dire quale correzione sia arrivata
// dopo — quindi non si finge di saperlo: si sceglie un vincitore ARBITRARIO
// ma STABILE (confronto lessicografico della serializzazione), uguale su
// ogni dispositivo a prescindere da chi sincronizza per primo. Meglio un
// vincitore arbitrario su cui tutti concordano che uno "giusto" su cui i
// dispositivi non si mettono mai d'accordo.
function vinceATie(prev, x) {
  try { return JSON.stringify(x) > JSON.stringify(prev); } catch (_) { return false; }
}
function unionByIdLWW(a = [], b = []) {
  const seen = new Map();
  const put = (x) => {
    const prev = seen.get(x.id);
    if (!prev) { seen.set(x.id, x); return; }
    const pAt = +prev.updatedAt || 0, xAt = +x.updatedAt || 0;
    if (xAt > pAt) { seen.set(x.id, x); return; }   // il più recente vince
    if (xAt === pAt && vinceATie(prev, x)) seen.set(x.id, x); // pari merito: scelta stabile
  };
  for (const x of a) put(x);
  for (const x of b) put(x);
  return [...seen.values()];
}

// Fonde due copie di gruppo. Stesso id → union di membri e spese (conflict-free).
// Id diversi → sono gruppi distinti: ritorna `a` invariato (nessuna fusione).
// Rinomina un gruppo marcando QUANDO (last-writer-wins): senza timestamp il
// merge non sapeva quale nome è più recente e teneva sempre il primo → rinominare
// non aveva effetto (bug reale) e i nomi non si propagavano tra dispositivi.
export function renameGroup(group, name) {
  return { ...group, name: String(name ?? '').trim() || group.name, nameAt: Date.now() };
}

export function mergeGroups(a, b) {
  if (!a) return b; if (!b) return a;
  if (a.id !== b.id) return a;
  // Nome: vince chi l'ha aggiornato più di recente (nameAt). Senza timestamp su
  // nessuno dei due si ripiega sul primo non vuoto (comportamento storico).
  const aAt = +a.nameAt || 0, bAt = +b.nameAt || 0;
  let name, nameAt;
  if (aAt || bAt) { const bWins = bAt > aAt; name = (bWins ? b.name : a.name) || a.name || b.name; nameAt = Math.max(aAt, bAt); }
  else { name = a.name || b.name; }
  return {
    id: a.id,
    name,
    ...(nameAt ? { nameAt } : {}),
    // Il creatore non cambia mai: e' chi ha fatto nascere il gruppo, e chi
    // arriva dopo non puo' rivendicarlo sovrascrivendolo nel merge.
    ...(a.createdBy || b.createdBy ? { createdBy: a.createdBy || b.createdBy } : {}),
    // BUG REALE trovato verificando il merge CRDT fra due copie (non a
    // tavolino): baseCurrency non era riportata nell'oggetto finale — un
    // gruppo in USD, dopo il PRIMO merge (che avviene già al secondo
    // salvataggio locale, vedi persist()/mergeIntoGroups), perdeva
    // silenziosamente la propria valuta e ricadeva sul default EUR. Stessa
    // regola del creatore: la valuta base si decide alla creazione e non
    // cambia mai nel merge, mai un lato che la "vince" sull'altro.
    ...(a.baseCurrency || b.baseCurrency ? { baseCurrency: a.baseCurrency || b.baseCurrency } : {}),
    // La chiusura e' una lapide come l'uscita: vince sulla presenza.
    ...mergeClosure(a, b),
    members: mergeMembers(a.members, b.members),
    expenses: unionByIdLWW(a.expenses, b.expenses),
    // La conversazione viaggia nello STESSO merge delle spese: e' cio' che la
    // fa arrivare ovunque arrivi la spesa di cui parla, offline e senza server.
    ...((a.chat?.length || b.chat?.length) ? { chat: mergeChat(a.chat, b.chat) } : {}),
    // Le promesse di pagamento (payment-promise.js) viaggiano come tutto il
    // resto. Cio' che si sincronizza e' UNA DATA per persona, mai un saldo.
    ...((a.promises?.length || b.promises?.length) ? { promises: mergePromises(a.promises, b.promises) } : {}),
  };
}

// Modifica l'importo/descrizione di una spesa esistente marcando updatedAt: così
// la modifica VINCE nel merge e si propaga agli altri dispositivi. Ritorna il
// nuovo gruppo (immutabile). Ricalcola le quote eque se l'importo cambia e le
// quote erano eque; se erano custom (byId) le mantiene proporzionate.
export function editExpense(group, expenseId, { amount, description } = {}) {
  const idx = (group.expenses || []).findIndex(e => e.id === expenseId);
  if (idx === -1) return group;
  const old = group.expenses[idx];
  const amt = amount != null ? round2(amount) : old.amount;
  if (!(amt > 0)) throw new Error('importo non valido');
  let owed = old.owed;
  if (amount != null && amt !== old.amount) {
    // BUG REALE CORRETTO: prima le quote venivano riscalate in proporzione a
    // quelle GIA' ARROTONDATE. Il centesimo di differenza inevitabile tra due
    // quote eque veniva cosi' moltiplicato per il rapporto tra i due importi:
    // 1,33 € diviso in due (0,67 e 0,66) corretto poi in 183,87 € produceva
    // 92,63 e 91,24 — un euro e mezzo di differenza tra due persone che
    // dovevano pagare uguale. Succedeva in circa un terzo delle correzioni.
    // Ora si riparte dalla REGOLA con cui la spesa era stata divisa (equa, tra
    // alcuni, a pesi), non dal suo risultato in centesimi.
    const ids = group.members.map(m => m.id);
    const rule = old.split || inferRule(old.owed, ids);
    let shares;
    if (rule.mode === 'among') shares = { equalAmong: rule.ids };
    else if (rule.mode === 'weights') shares = { weights: rule.weights };
    else if (rule.mode === 'equal') shares = undefined;
    else {
      // Quote esatte volute a mano: qui la proporzione E' l'intenzione, quindi
      // si riscala davvero (e' l'unico caso in cui era giusto farlo).
      const oldTot = Object.values(old.owed).reduce((s, v) => s + (+v || 0), 0) || 1;
      const scaled = {};
      for (const [id, v] of Object.entries(old.owed)) scaled[id] = (+v || 0) * amt / oldTot;
      shares = null;
      owed = balanceRounding(scaled, amt, expenseId);
    }
    if (shares !== null) owed = balanceRounding(idealShares(ids, amt, shares), amt, expenseId);
  }
  const updated = { ...old, amount: amt, description: description != null ? description : old.description, owed, updatedAt: Date.now() };
  // Se l'importo cambia, il vecchio tasso di cambio non spiega più il nuovo
  // amount — meglio dimenticare onestamente "veniva da 45 CHF" che tenerlo
  // e farlo sembrare ancora valido (stesso principio della validazione in
  // addSharedExpense: mai due numeri che non tornano l'uno con l'altro).
  if (amount != null && amt !== old.amount && old.originalCurrency) {
    delete updated.originalAmount; delete updated.originalCurrency; delete updated.exchangeRate;
  }
  const expenses = group.expenses.slice(); expenses[idx] = updated;
  return { ...group, expenses };
}

// Fonde un gruppo in arrivo dentro l'elenco locale: se esiste gia' (stesso id) lo
// aggiorna col merge, altrimenti lo aggiunge. Ritorna il nuovo elenco.
export function mergeIntoGroups(groups = [], incoming) {
  if (!incoming || !incoming.id) return groups;
  const i = groups.findIndex(g => g.id === incoming.id);
  if (i === -1) return [...groups, incoming];
  const out = groups.slice(); out[i] = mergeGroups(groups[i], incoming);
  return out;
}

// base64 UTF-8 sicuro sia su Node sia su browser.
function b64encode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
function b64decode(b64) {
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export const SPLIT_SHARE_PREFIX = 'MSPLIT1:';

// Codice condivisione del gruppo (compatto): lo mandi via WhatsApp/email o lo
// mostri come QR. Contiene solo il gruppo (nomi/spese), niente dati personali.
// Usato per "chiedi un pagamento" (un link self-contained, spesso senza
// rapporto continuativo col destinatario — vuole funzionare da solo anche
// senza sync P2P successivo).
export function encodeGroupShare(group) {
  // BUG REALE trovato verificando il round-trip di condivisione (non a
  // tavolino): baseCurrency non era nella whitelist qui sotto — un gruppo
  // creato in USD, condiviso con un amico, sarebbe arrivato dall'altra
  // parte silenziosamente in EUR (il fallback di default), nessun errore
  // visibile, saldi "giusti in apparenza" ma nella valuta sbagliata.
  const slim = { id: group.id, name: group.name, members: group.members, expenses: group.expenses, ...(group.baseCurrency ? { baseCurrency: group.baseCurrency } : {}) };
  return SPLIT_SHARE_PREFIX + b64encode(JSON.stringify(slim));
}

// BUG REALE (segnalato dall'utente): invitare qualcuno in un gruppo VISSUTO
// (decine di spese) generava un link/QR enorme — encodeGroupShare porta
// l'INTERA cronologia. Un link d'invito serve solo a far entrare la persona
// nel gruppo (id/nome/membri): le spese arrivano DOPO, via sync P2P live
// (mesh già esistente, shareSplitGroups/onSplitGroupsReceived), non devono
// stare nel link. Link sempre corto, sempre un vero link cliccabile e un
// QR leggibile qualunque sia la storia del gruppo.
// `p2pOffer` (opzionale): un'offerta WebRTC già pronta (vedi mesh-signaling.js),
// per aprire un canale diretto tra i due telefoni FIN DALL'ingresso nel gruppo,
// invece che tramite la schermata separata "Sincronizza dispositivi". Onestà:
// se chi entra non apre l'app entro la finestra dell'handshake, l'offerta
// scade — non è un problema, il gruppo entra comunque (il link/QR da solo
// basta) e la sincronizzazione resta quella già funzionante via merge.
export function encodeGroupInvite(group, p2pOffer) {
  const slim = { id: group.id, name: group.name, members: group.members, ...(group.baseCurrency ? { baseCurrency: group.baseCurrency } : {}), ...(p2pOffer ? { p2p: p2pOffer } : {}) };
  return SPLIT_SHARE_PREFIX + b64encode(JSON.stringify(slim));
}

// Estrae il payload condiviso da QUALSIASI stringa: il codice nudo, un link
// completo incollato (con o senza percent-encoding), da qualunque dominio. Il
// riconoscimento è per CONTENUTO (il marcatore firmato MSPLIT1:), non per
// indirizzo → se domani l'app vive su un altro dominio/server, i link e gli
// incolla continuano a funzionare uguale (il gruppo è tutto dentro il payload,
// nessuna dipendenza dal server che ha generato il link).
export function extractSharePayload(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (s.startsWith(SPLIT_SHARE_PREFIX)) return s; // già il codice nudo
  // Prova a decodificare eventuale percent-encoding (link ?join=MSPLIT1%3A...).
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch (_) { /* input non URL-encoded */ }
  const m = decoded.match(/MSPLIT1:[A-Za-z0-9+/=_-]+/) || s.match(/MSPLIT1:[A-Za-z0-9+/=_%-]+/);
  if (m) { try { return decodeURIComponent(m[0]); } catch (_) { return m[0]; } }
  return null;
}

// Decodifica un codice/link ricevuto → gruppo, o null se non valido (mai crash).
// Tollera il codice nudo, un link Momentum completo, o testo che lo contiene.
export function decodeGroupShare(code) {
  try {
    const payload = extractSharePayload(code);
    const s = String(payload ?? code ?? '').trim();
    const body = s.startsWith(SPLIT_SHARE_PREFIX) ? s.slice(SPLIT_SHARE_PREFIX.length) : s;
    const g = JSON.parse(b64decode(body));
    if (!g || !g.id || !Array.isArray(g.members)) return null;
    // Tollera anche un invito LEGGERO (encodeGroupInvite, senza expenses):
    // le spese arriveranno via sync P2P dopo l'ingresso, non nel link stesso.
    if (!Array.isArray(g.expenses)) g.expenses = [];
    return g;
  } catch (_) { return null; }
}

// PONTE COL BONIFICO SEPA on-device: da una riga di settlement + gli IBAN noti dei
// membri, produce i dati pronti per openSepaTransfer (QR/WhatsApp/copia). Cosi'
// saldi un amico DAVVERO, on-device, senza pagamenti in-app. Ritorna null se non
// si conosce l'IBAN del destinatario (allora resta la richiesta a voce).
export function settlementToSepa(transfer, group, ibansById = {}) {
  const byId = displayNames(group.members);
  const iban = ibansById[transfer.to];
  if (!iban) return null;
  return {
    mode: 'pay',
    name: byId[transfer.to] || 'Amico',
    iban,
    amount: transfer.amount,
    remittance: `Rimborso ${group.name}`.slice(0, 140),
    title: `Rimborsa ${byId[transfer.to] || ''}`.trim(),
  };
}

// ── DESCRIVE COSA È ARRIVATO da un merge (sync live / mesh) ─────────────────
// Confronta un gruppo PRIMA e DOPO il merge e produce frasi umane precise
// ("Marco è entrato nel gruppo", "Anna ha aggiunto 40€ di cena"), non un
// generico "aggiornato". Principio anti-attrito: specifico > vago, riduce
// l'ansia "cosa è successo mentre ero via" e rende visibile il valore reale
// del P2P (un concorrente cloud non te lo dice mai così). Pura, nessun DOM.
export function describeGroupChanges(before, after) {
  if (!before) return { changes: [`Nuovo gruppo "${after.name}" ricevuto`], groupName: after.name };
  const changes = [];
  if (before.name !== after.name) changes.push(`Il gruppo è stato rinominato in "${after.name}"`);

  const nameById = displayNames(after.members);
  const beforeMemberIds = new Set(before.members.map(m => m.id));
  for (const m of after.members) {
    if (!beforeMemberIds.has(m.id)) changes.push(`${nameById[m.id] || m.name} è entrato/a nel gruppo`);
  }

  const beforeExpenseIds = new Set(before.expenses.map(e => e.id));
  for (const e of after.expenses) {
    if (!beforeExpenseIds.has(e.id)) {
      const who = nameById[e.payer] || 'qualcuno';
      const desc = e.description ? ` (${e.description})` : '';
      changes.push(`${who} ha aggiunto una spesa di ${e.amount.toFixed(2)}€${desc}`);
    } else {
      // stessa spesa, importo cambiato (LWW ha aggiornato updatedAt)
      const old = before.expenses.find(x => x.id === e.id);
      if (old && old.amount !== e.amount) {
        changes.push(`L'importo${e.description ? ` di "${e.description}"` : ''} è cambiato da ${old.amount.toFixed(2)}€ a ${e.amount.toFixed(2)}€`);
      }
    }
  }
  return { changes, groupName: after.name };
}

// EXPORT DI GRUPPO — portare le spese di UN gruppo fuori da Momentum, non
// solo dentro. Gap reale (Momentum aveva un export CSV solo per i movimenti
// PERSONALI, mai per un gruppo di spese condivise). Questo NON ha niente a
// che fare col motore fiscale (tax.js/f24.js/ravvedimento.js, partita IVA):
// uno split è una cena o un viaggio fra amici, non materiale da
// commercialista. Il caso d'uso reale è più semplice: un archivio personale
// del viaggio/evento, o un riepilogo leggibile da mandare a chi è nel
// gruppo ma non ha mai installato l'app — un membro non richiede mai un
// account per esistere (vedi claimMember/unclaimedMembers sopra), questa è
// la "vista guest-friendly" che gli serve, non un secondo sistema di
// permessi da costruire.
// Ritorna DATI strutturati, non una stringa CSV già pronta: la formattazione
// (celle, virgole, BOM) resta a chi chiama (main.js), stessa separazione
// già in uso per l'export dei movimenti personali — split-engine.js non sa
// nulla di Blob/download, resta puro.
export function exportGroupData(group) {
  const nameById = displayNames(group.members);
  const nome = (id) => nameById[id] || id;
  const righeSpese = [...group.expenses]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(e => ({
      data: e.date,
      pagante: nome(e.payer),
      importo: e.amount,
      descrizione: e.description || '',
      // Dual: mai nascondere che una cifra viene da una conversione, stessa
      // regola già in uso nel dettaglio-giorno del calendario.
      valutaOriginale: e.originalCurrency ? `${e.originalAmount} ${e.originalCurrency}` : '',
    }));
  const bal = computeBalances(group);
  const saldi = group.members.map(m => ({ persona: nome(m.id), saldo: bal[m.id] || 0 }));
  const bonifici = minimalSettlement(bal).map(t => ({ da: nome(t.from), a: nome(t.to), importo: t.amount }));
  return { groupName: group.name, righeSpese, saldi, bonifici };
}
