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
//   3. netAcrossGroups     — posizione netta dei soli gruppi a due con identità
//      collegate, valuta coerente e registro verificato;
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
import { computeBalances, myMemberId } from './split-engine.js';
import { confirmedSplitLiability } from './split-liability.js';

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

// Read-only netting of two-person groups with the same claimed device identities.
// A name, an unclaimed slot or an incomplete ledger is never proof that two
// debts belong to the same people. No repayment is recorded by this model.
function verifiedPairBalances(pastGroups = [], { deviceId, currency = 'EUR' } = {}) {
  if (!deviceId) return new Map();
  const byPerson = new Map();
  for (const group of pastGroups || []) {
    if (group?.members?.length !== 2 || group.hiddenLocal || (+group.closed > 0 && +group.closed >= (+group.reopened || 0))) continue;
    const claims = group.members.filter(member => member.claimedBy === deviceId);
    if (claims.length !== 1) continue;
    const selfId = myMemberId(group, deviceId);
    const other = group.members.find(member => member.id !== selfId);
    if (!other?.claimedBy || other.claimedBy === deviceId) continue;
    const record = byPerson.get(other.claimedBy) || { name: norm(other.name), cents: 0, payments: 0, positive: false, negative: false, groups: new Set(), invalid: false };
    if (!group.id || record.groups.has(group.id)) {
      record.invalid = true;
      byPerson.set(other.claimedBy, record);
      continue;
    }
    if (!confirmedSplitLiability([group], { deviceId, currency }).complete) {
      record.invalid = true;
      byPerson.set(other.claimedBy, record);
      continue;
    }
    const cents = Math.round((computeBalances(group)[selfId] || 0) * 100);
    if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(record.cents + cents)) {
      record.invalid = true;
      byPerson.set(other.claimedBy, record);
      continue;
    }
    record.cents += cents;
    if (cents !== 0) record.payments++;
    if (cents > 0) record.positive = true;
    if (cents < 0) record.negative = true;
    record.groups.add(group.id);
    byPerson.set(other.claimedBy, record);
  }
  return byPerson;
}

export function netAcrossGroups(pastGroups = [], options = {}) {
  return [...verifiedPairBalances(pastGroups, options)].flatMap(([identity, record]) => !record.invalid && record.cents ? [{
    identity, name: record.name, net: record.cents / 100, groups: record.groups.size,
  }] : []).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

// Only a demonstrable reduction appears in the UI. A zero net means that the
// two recorded positions cancel; the UI still asks users to check repayments
// already made elsewhere before acting on the suggestion.
export function verifiedPairNetting(pastGroups = [], options = {}) {
  return [...verifiedPairBalances(pastGroups, options)].flatMap(([identity, record]) => {
    const after = record.cents === 0 ? 0 : 1;
    if (record.invalid || record.groups.size < 2 || !record.positive || !record.negative || record.payments <= after) return [];
    return [{ identity, name: record.name, net: record.cents / 100,
      groups: record.groups.size, before: record.payments, after, saved: record.payments - after }];
  }).sort((a, b) => b.saved - a.saved || Math.abs(b.net) - Math.abs(a.net));
}

// Historical frequency is descriptive only. It is not evidence that an actual
// debt will disappear in a future split, nor proof of a person's identity.
// Ritorna una mappa nome→{cadence(giorni), recencyDays, count}.
export function settlementIntelligence(pastGroups = [], { meNames = ['io', 'me'], date = new Date() } = {}) {
  const me = new Set(meNames.map(lower));
  const ref = date instanceof Date ? date : new Date(date);
  const byPerson = new Map();
  for (const g of (pastGroups || [])) {
    const names = (g.members || []).map(m => norm(m.name || m));
    if (!names.some(n => me.has(lower(n)))) continue;
    const gdate = g.expenses && g.expenses[0] && g.expenses[0].date;
    for (const nm of names) {
      if (me.has(lower(nm))) continue;
      const rec = byPerson.get(nm) || { dates: [] };
      if (gdate) rec.dates.push(new Date(gdate));
      byPerson.set(nm, rec);
    }
  }
  const out = new Map();
  for (const [name, rec] of byPerson) {
    const ds = rec.dates.filter(d => d && !isNaN(+d)).sort((a, b) => a - b);
    let cadence = null, recencyDays = null;
    if (ds.length >= 2) {
      const gaps = [];
      for (let i = 1; i < ds.length; i++) gaps.push((ds[i] - ds[i - 1]) / 86400000);
      gaps.sort((a, b) => a - b);
      cadence = Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)]));
      recencyDays = Math.round((ref - ds[ds.length - 1]) / 86400000);
    }
    out.set(name, { cadence, recencyDays, count: ds.length });
  }
  return out;
}

// Cadence cannot prove that a future expense will compensate an actual debt.
// Keep the historical signal descriptive; never advise delaying repayment on
// its own or turn a forecast into a balance.
export function settleAdvice(intel, counterparty, amount, { smallAbs = 10 } = {}) {
  const info = intel && intel.get ? intel.get(counterparty) : null;
  return { tone: 'now', cadence: info ? info.cadence : null, label: null };
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
  // Parole di SERVIZIO da non scambiare per nomi: connettivi, articoli,
  // preposizioni e possessivi ("mia sorella" → Sorella; "i ragazzi" → Ragazzi).
  const conn = new Set([
    'con', 'e', 'ed', 'per', 'di', 'da', 'a', 'ad', 'in', 'su', 'tra', 'fra',
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "l'", 'del', 'dei',
    'mia', 'mio', 'miei', 'mie', 'tua', 'tuo', 'tuoi', 'tue', 'sua', 'suo', 'suoi', 'sue',
    'nostra', 'nostro', 'nostri', 'nostre', '€', 'euro', 'eur',
  ]);
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
