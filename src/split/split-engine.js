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

const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

// Id univoco globale (device-agnostic): tempo + casuale. Serve a rendere le
// spese di persone diverse NON collidenti → merge conflict-free tra dispositivi
// lontani senza server.
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Crea un gruppo. members = [{id, name}] o [nomi]. Normalizza a {id, name}.
// `id` di gruppo univoco: due copie dello STESSO gruppo (una creata, una ricevuta)
// condividono l'id e si fondono; gruppi diversi restano distinti.
export function createGroup({ name = 'Gruppo', members = [], id } = {}) {
  const norm = members.map((m, i) => typeof m === 'string' ? { id: `m${i}`, name: m } : { id: m.id || `m${i}`, name: m.name || `Membro ${i + 1}` });
  return { id: id || genId(), name, members: norm, expenses: [] };
}

// Aggiunge una spesa condivisa. `shares` opzionale:
//  - assente → divisione EQUA tra tutti i membri;
//  - { equalAmong:[id,...] } → equa solo tra alcuni;
//  - { byId:{id:quota} } → quote ESATTE in euro (devono sommare all'importo);
//  - { weights:{id:peso} } → ripartizione proporzionale ai pesi.
// payer = id del membro che ha pagato. Ritorna il nuovo gruppo (immutabile).
export function addSharedExpense(group, { payer, amount, description = '', date, shares } = {}) {
  const amt = round2(amount);
  if (!(amt > 0)) throw new Error('importo non valido');
  if (!group.members.some(m => m.id === payer)) throw new Error('pagante non nel gruppo');
  const ids = group.members.map(m => m.id);

  let owed = {};
  if (!shares) {
    const each = amt / ids.length;
    for (const id of ids) owed[id] = each;
  } else if (shares.equalAmong) {
    const grp = shares.equalAmong.filter(id => ids.includes(id));
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
  // arrotonda le quote e aggiusta l'ultimo centesimo sul pagante (somma esatta)
  owed = balanceRounding(owed, amt);
  // id GLOBALMENTE univoco (non l'indice): cosi' le spese aggiunte da persone
  // diverse non collidono e il merge tra dispositivi e' conflict-free.
  const expense = { id: genId(), payer, amount: amt, description, date: date || new Date().toISOString().slice(0, 10), owed, updatedAt: Date.now() };
  return { ...group, expenses: [...group.expenses, expense] };
}

// Arrotonda le quote a 2 decimali facendo tornare la somma ESATTA all'importo
// (il residuo di arrotondamento va sulla quota maggiore): mai centesimi persi.
function balanceRounding(owed, amt) {
  const out = {}; let sum = 0; let maxId = null, maxV = -Infinity;
  for (const [id, v] of Object.entries(owed)) { out[id] = round2(v); sum += out[id]; if (v > maxV) { maxV = v; maxId = id; } }
  const diff = round2(amt - sum);
  if (maxId && Math.abs(diff) >= 0.01) out[maxId] = round2(out[maxId] + diff);
  return out;
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

// Compensazione MINIMA (debt simplification): chi paga chi col MINOR numero di
// bonifici per azzerare tutti i debiti. Semplifica le catene (A→B→C ⇒ A→C) e,
// per gruppi realistici (≤12 con saldo non nullo), trova il minimo ASSOLUTO
// partizionando i saldi nel MAX numero di sottogruppi a somma-zero (ogni
// sottogruppo di k persone si chiude con k-1 bonifici → totale = n - #sottogruppi,
// minimizzato). Oltre 12, fallback greedy (near-ottimo). Sempre corretto: azzera
// tutti i saldi. Piu' potente del greedy di Splitwise/Settle Up.
export function minimalSettlement(balances) {
  const entries = Object.entries(balances).map(([m, v]) => ({ m, v: round2(v) })).filter(e => Math.abs(e.v) > EPS);
  const n = entries.length;
  if (n === 0) return [];
  if (n > 12) return greedySettle(entries); // esatto troppo costoso → greedy

  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  for (let mask = 1; mask <= full; mask++) { const low = mask & -mask; const idx = 31 - Math.clz32(low); sum[mask] = round2(sum[mask ^ low] + entries[idx].v); }
  const isZero = (mask) => Math.abs(sum[mask]) < 0.01;
  const best = new Int32Array(1 << n).fill(-2); const choice = new Int32Array(1 << n);
  const solve = (mask) => {
    if (mask === 0) return 0;
    if (best[mask] !== -2) return best[mask];
    const low = mask & -mask; let bestVal = -1, bestS = 0;
    for (let s = mask; s > 0; s = (s - 1) & mask) {
      if (!(s & low) || !isZero(s)) continue;
      const sub = solve(mask ^ s);
      if (sub >= 0 && 1 + sub > bestVal) { bestVal = 1 + sub; bestS = s; }
    }
    best[mask] = bestVal; choice[mask] = bestS; return bestVal;
  };
  solve(full);
  const tx = []; let mask = full;
  while (mask) { const s = choice[mask]; const sub = []; for (let i = 0; i < n; i++) if (s & (1 << i)) sub.push({ ...entries[i] }); tx.push(...greedySettle(sub)); mask ^= s; }
  return tx;
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
function mergeMembers(a = [], b = []) {
  const byId = new Map();
  const put = (m) => {
    const prev = byId.get(m.id);
    if (!prev) { byId.set(m.id, m); return; }
    if (prev.claimedBy && m.claimedBy) {
      // entrambi claimati: vince chi ha claimato per primo
      byId.set(m.id, (+m.claimedAt || 0) < (+prev.claimedAt || 0) ? m : prev);
    } else if (m.claimedBy && !prev.claimedBy) {
      byId.set(m.id, m);
    } // altrimenti prev resta (già claimato, o nessuno dei due lo è)
  };
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
function unionByIdLWW(a = [], b = []) {
  const seen = new Map();
  const put = (x) => {
    const prev = seen.get(x.id);
    if (!prev) { seen.set(x.id, x); return; }
    const pAt = +prev.updatedAt || 0, xAt = +x.updatedAt || 0;
    if (xAt > pAt) seen.set(x.id, x); // il più recente vince; a parità resta il primo
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
    members: mergeMembers(a.members, b.members),
    expenses: unionByIdLWW(a.expenses, b.expenses),
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
    // riscala le quote in proporzione (mantiene la ripartizione, aggiorna i totali)
    const oldTot = Object.values(old.owed).reduce((s, v) => s + (+v || 0), 0) || 1;
    const scaled = {};
    for (const [id, v] of Object.entries(old.owed)) scaled[id] = (+v || 0) * amt / oldTot;
    owed = balanceRounding(scaled, amt);
  }
  const updated = { ...old, amount: amt, description: description != null ? description : old.description, owed, updatedAt: Date.now() };
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
  const slim = { id: group.id, name: group.name, members: group.members, expenses: group.expenses };
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
  const slim = { id: group.id, name: group.name, members: group.members, ...(p2pOffer ? { p2p: p2pOffer } : {}) };
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
  const byId = Object.fromEntries(group.members.map(m => [m.id, m.name]));
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

  const beforeMemberIds = new Set(before.members.map(m => m.id));
  for (const m of after.members) {
    if (!beforeMemberIds.has(m.id)) changes.push(`${m.name} è entrato/a nel gruppo`);
  }

  const beforeExpenseIds = new Set(before.expenses.map(e => e.id));
  const nameById = Object.fromEntries(after.members.map(m => [m.id, m.name]));
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
