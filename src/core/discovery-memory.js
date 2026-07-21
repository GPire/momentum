// ============================================================
// DISCOVERY MEMORY — scoperta aggiornamenti che APPRENDE (predittiva) (v11)
// ============================================================
// Rende la scoperta degli aggiornamenti INTELLIGENTE e PREDITTIVA: l'app impara
// quali fonti/indirizzi hanno funzionato (CT, algoritmo, ancora, singoli host,
// sotto-domini, peer) e li prova PER PRIMI la volta dopo.
//
// v11 — IL SALTO SUI SOTTO-DOMINI. Prima l'apprendimento era PIATTO, per host
// esatto: `cdn.momentum.it` e `eu.momentum.it` non si scambiavano nulla, e un
// sotto-dominio MAI VISTO ripartiva da 0.5 neutro. Ma il caso reale e' proprio
// quello: se cambio server, l'indirizzo nuovo e' quasi sempre un sotto-dominio
// NUOVO di un dominio GIA' NOTO. Ora la memoria e' GERARCHICA sulle etichette
// DNS ('it' → 'momentum.it' → 'cdn.momentum.it' → 'eu.cdn.momentum.it'): la
// reputazione scende lungo l'albero, quindi un sotto-dominio mai visto di un
// dominio affidabile parte GIA' in cima alla lista, e il primo tentativo e'
// quello giusto. Motore condiviso: ../ai/hierarchical-bandit.js — lo stesso
// primitivo che addestra Momentum Core sugli esercenti mai visti.
//
// Secondo asse (fattoriale): il TIPO di fonte (ct/algoritmo/ancora/mesh) viene
// appreso a parte, cosi' l'app impara anche "per questo progetto la
// Certificate Transparency e' la via che funziona" a prescindere dall'host.
//
// Onesta': non indovina indirizzi nuovi dal nulla; ORDINA meglio i candidati che
// l'algoritmo/CT/ancore/mesh gia' producono. Il guadagno e' nei tentativi
// risparmiati, non in una preveggenza che non esiste.
// Funzioni pure, nessun DOM/rete. Serializzabile nel vault (campo additivo).
'use strict';

import {
  initHierarchical, observeHierarchical, predictHierarchical,
  explainHierarchical, mergeHierarchical, pruneHierarchical,
} from '../ai/hierarchical-bandit.js';

const DAY = 86_400_000;
const OK = 'ok';
const KO = 'ko';

// Suffissi pubblici multi-parte piu' comuni: senza questi, 'momentum.co.uk' e
// 'altro.co.uk' sembrerebbero parenti (lo sono solo per il registrar, non per
// affidabilita'). Lista breve e dichiarata: non e' la PSL completa.
const MULTI_SUFFIX = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.br', 'com.au', 'net.au', 'org.au', 'co.jp', 'co.kr', 'co.za',
  'com.mx', 'com.ar', 'com.tr', 'com.cn', 'co.in', 'com.sg', 'co.nz',
]);

export function initDiscoveryMemory() {
  return {
    sources: {},      // compat v10: conteggi piatti per host (introspezione/vecchi vault)
    lastGood: null,
    version: 2,
    hosts: initHierarchical(),  // gerarchia etichette DNS
    types: initHierarchical(),  // fattore: tipo di fonte
  };
}

// Vault salvati con la v10 non hanno i modelli gerarchici: si adottano a caldo,
// senza perdere quello che era gia' stato imparato (campi additivi, regola n.3).
function ensureModels(mem) {
  if (!mem.hosts) {
    mem.hosts = initHierarchical();
    for (const host in mem.sources || {}) {
      const s = mem.sources[host];
      const path = domainPath(host);
      const ok = Math.max(0, (s.a || 1) - 1), ko = Math.max(0, (s.b || 1) - 1);
      if (ok) observeHierarchical(mem.hosts, path, OK, s.last || 0, ok);
      if (ko) observeHierarchical(mem.hosts, path, KO, s.last || 0, ko);
    }
  }
  if (!mem.types) mem.types = initHierarchical();
  return mem;
}

// Chiave di una fonte: normalizza l'URL all'origine (host) così l'apprendimento
// e' per HOST/sotto-dominio, non per path.
export function sourceKey(url) {
  try { const u = new URL(url); return u.host; } catch (_) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
}

// Percorso gerarchico di un host, dalla radice registrabile alla foglia:
// 'eu.cdn.momentum.it' → ['it', 'momentum.it', 'cdn.momentum.it', 'eu.cdn.momentum.it']
export function domainPath(hostOrUrl) {
  const host = sourceKey(hostOrUrl).toLowerCase().replace(/:\d+$/, '');
  if (!host) return [];
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 1) return [host];
  const last2 = parts.slice(-2).join('.');
  const startFrom = MULTI_SUFFIX.has(last2) ? parts.length - 2 : parts.length - 1;
  const path = [];
  for (let i = startFrom; i >= 0; i--) path.push(parts.slice(i).join('.'));
  return path;
}

// Registra l'esito di un tentativo su una fonte (successo = manifest firmato valido).
export function recordDiscovery(mem, url, success, now = Date.now(), type = null) {
  ensureModels(mem);
  const key = sourceKey(url);
  const s = mem.sources[key] || { a: 1, b: 1, last: 0 }; // prior Beta(1,1)
  if (success) { s.a += 1; s.last = now; mem.lastGood = url; }
  else s.b += 1;
  mem.sources[key] = s;

  observeHierarchical(mem.hosts, domainPath(key), success ? OK : KO, now, 1);
  if (type) observeHierarchical(mem.types, [String(type)], success ? OK : KO, now, 1);
  return mem;
}

// Probabilita' APPRESA che una fonte funzioni. Il cuore predittivo: se l'host
// esatto e' ignoto ma il suo dominio e' noto, la stima arriva dal ramo.
export function sourceReliability(mem, url, now = Date.now()) {
  ensureModels(mem);
  const r = predictHierarchical(mem.hosts, domainPath(url), now);
  if (!r.label) return 0.5; // nessuna esperienza: neutro, non ottimista
  return r.label === OK ? r.p : 1 - r.p;
}

function typeReliability(mem, type, now) {
  if (!type) return 0.5;
  const r = predictHierarchical(mem.types, [String(type)], now);
  if (!r.label) return 0.5;
  return r.label === OK ? r.p : 1 - r.p;
}

// Punteggio di una fonte: affidabilita' appresa lungo la gerarchia + recency
// (ha funzionato di recente → probabilmente ancora viva) + il fattore tipo.
export function sourceScore(mem, url, now = Date.now(), type = null) {
  ensureModels(mem);
  const s = mem.sources[sourceKey(url)];
  const hier = sourceReliability(mem, url, now);
  const recency = s && s.last ? Math.exp(-(now - s.last) / (30 * DAY)) : 0;
  const typeP = typeReliability(mem, type, now);
  return +(0.65 * hier + 0.25 * recency + 0.10 * typeP).toFixed(4);
}

// Ordina i candidati per probabilita' appresa di successo; l'ULTIMO indirizzo
// buono va comunque per primo (localita': check rapidissimo del caso comune).
// I candidati possono essere stringhe o {url, type}.
export function rankSources(candidates = [], mem = initDiscoveryMemory(), now = Date.now()) {
  ensureModels(mem);
  const urlOf = (c) => (typeof c === 'string' ? c : c && c.url);
  const typeOf = (c) => (typeof c === 'string' ? null : c && c.type);
  const seen = new Map();
  for (const c of candidates) { const u = urlOf(c); if (u && !seen.has(u)) seen.set(u, typeOf(c)); }
  const uniq = [...seen.keys()];
  const ranked = uniq.sort((x, y) => sourceScore(mem, y, now, seen.get(y)) - sourceScore(mem, x, now, seen.get(x)));
  if (mem.lastGood && seen.has(mem.lastGood)) {
    return [mem.lastGood, ...ranked.filter(u => u !== mem.lastGood)];
  }
  return ranked;
}

// Perche' questa fonte e' in cima: tracciabile (regola: mai un numero senza il perche').
export function explainSource(mem, url, now = Date.now()) {
  ensureModels(mem);
  const e = explainHierarchical(mem.hosts, domainPath(url), now);
  return { url, reliability: sourceReliability(mem, url, now), inherited: e.inherited, reason: e.reason };
}

// Federazione mesh: si scambiano SOLO i metadati di affidabilita' (mai dati
// personali, mai la cronologia), con il tetto anti-poisoning del primitivo.
export function mergeDiscoveryMemory(local, remote, opts = {}) {
  ensureModels(local);
  if (!remote) return local;
  if (remote.hosts) mergeHierarchical(local.hosts, remote.hosts, opts);
  if (remote.types) mergeHierarchical(local.types, remote.types, opts);
  return local;
}

// Igiene del vault: la memoria non cresce senza limite.
export function pruneDiscoveryMemory(mem, opts = {}) {
  ensureModels(mem);
  pruneHierarchical(mem.hosts, opts);
  pruneHierarchical(mem.types, opts);
  return mem;
}
