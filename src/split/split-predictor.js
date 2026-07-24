// ============================================================
// SPLIT PREDICTOR — l'intelligenza predittiva proprietaria della divisione
// ============================================================
// Splitwise/Settle Up NON predicono nulla: ogni volta riscrivi chi, quanto,
// come. Qui invece la divisione IMPARA dalle divisioni passate (i tuoi
// `splitGroups`, che crescono a ogni salvataggio → auto-apprendimento
// on-device, nessun retraining) e ANTICIPA:
//   1. predictCoSplitters  — con CHI dividi di solito QUESTO tipo di spesa,
//      in QUESTO giorno (non "i più frequenti" e basta, ma contestuale);
//   2. predictShares       — COME si divide con quelle persone (equa? 60/40?);
//   3. netAcrossGroups     — la posizione netta con ciascuno sommando TUTTI i
//      gruppi (il vero limite di Splitwise, che netta solo dentro un gruppo);
//   4. parseSplitLine      — una riga sola: "60 cena io marco luca" → diviso
//      (semplice anche per un bambino, comprensibile a chi non l'ha mai usato).
//
// ONESTÀ (regola #1): tutto è statistica trasparente (conteggi + affinità di
// Laplace, lo STESSO primitivo di context-predictor.js applicato al dominio
// split — un motore, più domini). Senza dati TACE: mai un nome o una quota
// inventati. Funzioni pure, nessun DOM, nessuna rete.
//
// INTEGRAZIONE COL CORE (richiesta esplicita): queste funzioni sono lette dalla
// UI per pre-compilare, e ogni divisione confermata alimenta l'orchestratore
// (categoria della spesa + co-divisori) → il Core migliora anche dalle spese
// condivise, non solo da quelle personali. Vedi `learnFromSplit`.
'use strict';

import { slotOf } from '../predict/context-predictor.js';

const norm = (s) => String(s ?? '').trim();
const lower = (s) => norm(s).toLowerCase();
const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

// Parole troppo generiche per essere un "tipo di spesa" discriminante.
const STOP = new Set(['spesa', 'la', 'il', 'lo', 'di', 'da', 'per', 'con', 'e', 'del', 'della', 'un', 'una', 'al', 'ai', 'the', 'a']);

// Token significativi di una descrizione (per capire il "tipo": cena, casa,
// viaggio, benzina...). Minuscolo, senza punteggiatura, senza stop-word corte.
export function keyTokens(desc) {
  return lower(desc).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w));
}

// Somiglianza "tipo di spesa" tra due descrizioni: condividono almeno un token
// chiave? (Jaccard soft — basta un'intersezione per essere "lo stesso tipo".)
function sameKind(aTokens, bDesc) {
  if (!aTokens.length) return false;
  const b = new Set(keyTokens(bDesc));
  return aTokens.some(t => b.has(t));
}

// ── 1. CON CHI DIVIDI, dato il contesto (tipo di spesa + giorno) ─────────────
// Non la classifica globale di frequenza (già in frequentCoSplitters), ma:
// "per una spesa di QUESTO tipo, in QUESTO giorno, con chi sei di solito?".
// Punteggio = frequenza × affinità-giorno (Laplace). Chi non appare mai in
// questo contesto non viene suggerito. Ritorna [{name, score, count, reason}].
export function predictCoSplitters(pastGroups = [], { description = '', date = new Date(), meNames = ['io', 'me'], topN = 5 } = {}) {
  const groups = (pastGroups || []).filter(g => g && Array.isArray(g.members));
  if (!groups.length) return [];
  const refDay = (date instanceof Date ? date : new Date(date)).getDay();
  const kind = keyTokens(description);
  const me = new Set(meNames.map(lower));

  // Per ogni persona: quante volte è comparsa, e con che affinità al contesto.
  const stat = new Map(); // name -> { total, ctxCount, dayCount }
  for (const g of groups) {
    const gDesc = g.name || (g.expenses && g.expenses[0] && g.expenses[0].description) || '';
    const gDates = (g.expenses || []).map(e => e.date).filter(Boolean);
    const gDay = gDates.length ? new Date(gDates[0]).getDay() : null;
    const kindMatch = kind.length ? sameKind(kind, gDesc) : false;
    for (const m of g.members) {
      const name = norm(m.name || m);
      if (!name || me.has(lower(name))) continue;
      const s = stat.get(name) || { total: 0, ctxCount: 0, dayCount: 0 };
      s.total += 1;
      if (kindMatch) s.ctxCount += 1;
      if (gDay === refDay) s.dayCount += 1;
      stat.set(name, s);
    }
  }
  if (!stat.size) return [];

  const nGroups = groups.length;
  const out = [];
  for (const [name, s] of stat) {
    // Affinità di Laplace: quanto la presenza di questa persona è LEGATA al
    // contesto rispetto alla sua frequenza base. Prior neutro → senza segnale
    // il lift ~1 e conta solo la frequenza (non inventa un contesto).
    const kindLift = kind.length ? ((s.ctxCount + 1) / (s.total + 2)) / ((countKindGroups(groups, kind) + 1) / (nGroups + 2)) : 1;
    const dayLift = ((s.dayCount + 1) / (s.total + 2)) / ((countDayGroups(groups, refDay) + 1) / (nGroups + 2));
    const score = s.total * Math.max(0.5, kindLift) * Math.max(0.5, dayLift);
    let reason = null;
    // Segnale contestuale netto: lift alto OPPURE la persona compare SOLO per
    // questo tipo di spesa (ctxCount == total, ≥2 volte) — un segnale forte che
    // il Laplace su campioni piccoli smorza troppo, ma è onesto (esclusività).
    if (kind.length && s.ctxCount >= 2 && (kindLift >= 1.5 || s.ctxCount === s.total)) reason = `di solito per ${kind[0]}`;
    else if (dayLift >= 1.5 && s.dayCount >= 2) reason = 'di solito in questo giorno';
    out.push({ name, score: round2(score), count: s.total, ctxCount: s.ctxCount, reason });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, topN);
}

function countKindGroups(groups, kind) {
  let n = 0;
  for (const g of groups) { const d = g.name || (g.expenses && g.expenses[0] && g.expenses[0].description) || ''; if (sameKind(kind, d)) n++; }
  return n;
}
function countDayGroups(groups, refDay) {
  let n = 0;
  for (const g of groups) { const dt = g.expenses && g.expenses[0] && g.expenses[0].date; if (dt && new Date(dt).getDay() === refDay) n++; }
  return n;
}

// ── 2. COME SI DIVIDE con queste persone (equa o quote ricorrenti) ───────────
// Guarda le divisioni passate con ESATTAMENTE questo insieme di persone (per
// nome). Se la quota di ciascuno è stabile e NON equa (es. affitto 60/40),
// la predice; se è sempre equa, tace (l'equa è già il default). Ritorna
// { shares: {name: fraction}, confident } oppure null. Onesto: serve una
// ricorrenza reale (≥2 divisioni coerenti), altrimenti niente.
export function predictShares(pastGroups = [], people = [], { minGroups = 2, tol = 0.06 } = {}) {
  const want = new Set(people.map(lower));
  if (want.size < 2) return null;
  const matches = [];
  for (const g of (pastGroups || [])) {
    const names = (g.members || []).map(m => lower(m.name || m));
    if (names.length !== want.size || !names.every(n => want.has(n))) continue;
    // Frazione dovuta da ciascun membro sul totale del gruppo.
    const total = (g.expenses || []).reduce((s, e) => s + (+e.amount || 0), 0);
    if (!(total > 0)) continue;
    const owedByName = {};
    for (const e of (g.expenses || [])) {
      const idToName = Object.fromEntries((g.members || []).map(m => [m.id, lower(m.name || m)]));
      for (const [id, q] of Object.entries(e.owed || {})) { const nm = idToName[id]; if (nm) owedByName[nm] = (owedByName[nm] || 0) + (+q || 0); }
    }
    const frac = {};
    for (const nm of want) frac[nm] = (owedByName[nm] || 0) / total;
    matches.push(frac);
  }
  if (matches.length < minGroups) return null;

  // Media delle frazioni + verifica di coerenza (bassa varianza) e di NON-equità.
  const avg = {};
  for (const nm of want) avg[nm] = matches.reduce((s, f) => s + (f[nm] || 0), 0) / matches.length;
  const equal = 1 / want.size;
  let maxDev = 0, stable = true;
  for (const nm of want) {
    if (Math.abs(avg[nm] - equal) > maxDev) maxDev = Math.abs(avg[nm] - equal);
    const variance = matches.reduce((s, f) => s + Math.pow((f[nm] || 0) - avg[nm], 2), 0) / matches.length;
    if (Math.sqrt(variance) > tol) stable = false;
  }
  if (!stable || maxDev < tol) return null; // instabile, o di fatto equa → tace
  // Normalizza (somma 1) e mappa ai nomi originali (case preservato).
  const sum = Object.values(avg).reduce((a, b) => a + b, 0) || 1;
  const byOriginal = {};
  for (const p of people) byOriginal[p] = round2((avg[lower(p)] || 0) / sum);
  return { shares: byOriginal, confident: matches.length >= minGroups, samples: matches.length };
}

// ── 3. POSIZIONE NETTA CROSS-GRUPPO (il gap di Splitwise) ────────────────────
// Splitwise netta i debiti DENTRO un gruppo. Ma con la stessa persona sei in
// più gruppi (casa, viaggi, cene) → quello che conta è la posizione TOTALE.
// Somma, per ogni persona, quanto ti deve/le devi in TUTTI i gruppi, e dà il
// netto reale ("con Marco, in tutto, sei in pari / ti deve 12€"). Ordina per
// importo assoluto (chi saldare prima). Ritorna [{name, net, groups}] con
// net>0 = ti deve, net<0 = gli devi. meNames = come compari tu nei gruppi.
export function netAcrossGroups(pastGroups = [], { meNames = ['io', 'me'] } = {}) {
  const me = new Set(meNames.map(lower));
  const byPerson = new Map(); // name -> { net, groups:Set }
  for (const g of (pastGroups || [])) {
    const idToName = Object.fromEntries((g.members || []).map(m => [m.id, norm(m.name || m)]));
    const myIds = (g.members || []).filter(m => me.has(lower(m.name || m))).map(m => m.id);
    if (!myIds.length) continue;
    // Saldo di ciascun membro nel gruppo: pagato − dovuto.
    const bal = {};
    for (const m of g.members) bal[m.id] = 0;
    for (const e of (g.expenses || [])) {
      bal[e.payer] = (bal[e.payer] || 0) + (+e.amount || 0);
      for (const [id, q] of Object.entries(e.owed || {})) bal[id] = (bal[id] || 0) - (+q || 0);
    }
    const myBal = myIds.reduce((s, id) => s + (bal[id] || 0), 0);
    if (Math.abs(myBal) < 0.005) continue;
    // Attribuisci il mio saldo alle controparti in proporzione al loro saldo
    // opposto (chi mi deve / a chi devo dentro questo gruppo).
    const others = g.members.filter(m => !me.has(lower(m.name || m)));
    const opp = others.filter(m => Math.sign(bal[m.id] || 0) === -Math.sign(myBal));
    const totalOpp = opp.reduce((s, m) => s + Math.abs(bal[m.id] || 0), 0) || 1;
    for (const m of opp) {
      const share = myBal * (Math.abs(bal[m.id] || 0) / totalOpp);
      const nm = idToName[m.id];
      const rec = byPerson.get(nm) || { net: 0, groups: new Set() };
      rec.net += share; rec.groups.add(g.name || g.id);
      byPerson.set(nm, rec);
    }
  }
  const out = [];
  for (const [name, rec] of byPerson) {
    const net = round2(rec.net);
    if (Math.abs(net) < 0.01) continue;
    out.push({ name, net, groups: rec.groups.size });
  }
  return out.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

// ── 4. UNA RIGA SOLA (NL): "60 cena io marco luca" → diviso ──────────────────
// La semplicità estrema richiesta: chi non ha mai usato un'app di divisione
// scrive una frase e basta. Estrae importo, descrizione e persone da testo
// libero italiano. Robusto ma ONESTO: se non trova un importo, ritorna null
// (non indovina). Non serve ordine fisso: "cena 60 con marco e luca" va uguale.
const NUM_WORDS = { zero: 0, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
export function parseSplitLine(text, { meLabel = 'Io' } = {}) {
  const raw = norm(text);
  if (!raw) return null;
  // Importo: primo numero con eventuali decimali (virgola o punto), anche con €.
  const amtMatch = raw.replace(/€/g, ' ').match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!amtMatch) return null;
  const amount = round2(parseFloat(amtMatch[1].replace(',', '.')));
  if (!(amount > 0)) return null;

  // Rimuovi l'importo e le parole-connettivo; ciò che resta è desc + persone.
  let rest = raw.replace(amtMatch[0], ' ');
  // Persone: sequenze dopo "con", oppure nomi capitalizzati / "io".
  const tokens = rest.split(/\s+/).map(t => t.replace(/[.,;]+$/, '')).filter(Boolean);
  const people = [];
  const descParts = [];
  const conn = new Set(['con', 'e', 'per', 'di', 'da', 'a', 'il', 'la', 'lo', '€', 'euro', 'eur']);
  // Formato atteso (documentato per l'utente): "importo tipo-spesa persone",
  // es. "60 cena io marco luca" o "cena con Marco e Anna 45". I nomi si
  // riconoscono da un pivot: dopo "con" o dopo "io"/"me" i token sono persone.
  let afterCon = false;
  for (const t of tokens) {
    const tl = lower(t);
    if (tl === 'con') { afterCon = true; continue; }
    if (conn.has(tl)) continue;
    if (tl === 'io' || tl === 'me') { if (!people.includes(meLabel)) people.push(meLabel); afterCon = true; continue; }
    // Un token è "persona" se: viene dopo "con"/"io", oppure è capitalizzato
    // (nome proprio) dopo che la descrizione è già iniziata. Altrimenti è
    // descrizione (la parte prima dei nomi).
    const isName = afterCon || (/^[A-ZÀ-Ú]/.test(t) && descParts.length > 0);
    if (isName && !NUM_WORDS.hasOwnProperty(tl)) {
      const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      if (!people.includes(cap)) people.push(cap);
    } else {
      descParts.push(t);
    }
  }
  if (!people.includes(meLabel)) people.unshift(meLabel); // ci sei sempre tu
  return {
    amount,
    description: descParts.join(' ').trim(),
    people,
  };
}

// ── INTEGRAZIONE COL CORE: ogni divisione confermata addestra Momentum ───────
// La tua QUOTA di una spesa condivisa è una spesa reale: va categorizzata e
// deve ALLENARE il categorizzatore (come ogni transazione). In più registra i
// co-divisori nel modello di divisione (che è `splitGroups` stesso — cresce e
// il predittore sopra lo rilegge: auto-addestramento senza retraining).
// `orchestrator` = window.momentumOrchestrator (opzionale: se assente, no-op
// onesto). Ritorna { category, mine } per la UI. NON tocca il DOM.
export function learnFromSplit(orchestrator, { description = '', myShare = 0, date = new Date() } = {}) {
  let category = 'altro';
  const desc = norm(description);
  try {
    if (orchestrator && typeof orchestrator.classify === 'function') {
      const p = orchestrator.classify(desc, myShare, date instanceof Date ? date : new Date(date));
      if (p && p.category) category = p.category;
    }
  } catch (_) { /* predizione assente → categoria neutra, il flusso continua */ }
  return { category, mine: round2(myShare) };
}
