// ============================================================
// DISCOVERY MEMORY — scoperta aggiornamenti che APPRENDE (predittiva) (v10)
// ============================================================
// Rende la scoperta degli aggiornamenti INTELLIGENTE e PREDITTIVA: l'app impara
// quali fonti/indirizzi hanno funzionato (CT, algoritmo, ancora, singoli host,
// sotto-domini, peer) e li prova PER PRIMI la volta dopo. Stessa architettura
// dei bandit di Momentum Core: reputazione Beta-Bernoulli per fonte + recency,
// piu' memoria dell'ultimo indirizzo buono (localita': quasi sempre non e'
// cambiato → un colpo solo). Cosi' ogni ricerca "allena" il sistema e le
// successive sono piu' rapide. Persistibile nel vault (campo additivo).
// Onesta': non indovina nulla di nuovo; ordina meglio cio' che gia' conosce/scopre.
// Funzioni pure, nessun DOM/rete.
'use strict';

const DAY = 86_400_000;

export function initDiscoveryMemory() {
  return { sources: {}, lastGood: null, version: 1 };
}

// Chiave di una fonte: normalizza l'URL all'origine (host) così l'apprendimento
// e' per HOST/sotto-dominio, non per path.
export function sourceKey(url) {
  try { const u = new URL(url); return u.host; } catch (_) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; }
}

// Registra l'esito di un tentativo su una fonte (successo = manifest firmato valido).
export function recordDiscovery(mem, url, success, now = Date.now()) {
  const key = sourceKey(url);
  const s = mem.sources[key] || { a: 1, b: 1, last: 0 }; // prior Beta(1,1)
  if (success) { s.a += 1; s.last = now; mem.lastGood = url; }
  else s.b += 1;
  mem.sources[key] = s;
  return mem;
}

// Punteggio di una fonte: media a posteriori (affidabilita' storica) + bonus di
// recency (ha funzionato di recente → probabilmente ancora viva). In [0,1].
export function sourceScore(mem, url, now = Date.now()) {
  const s = mem.sources[sourceKey(url)];
  if (!s) return 0.5; // sconosciuta → neutra
  const mean = s.a / (s.a + s.b);
  const recency = s.last ? Math.exp(-(now - s.last) / (30 * DAY)) : 0;
  return +(0.7 * mean + 0.3 * recency).toFixed(4);
}

// Ordina i candidati per probabilita' appresa di successo; l'ULTIMO indirizzo
// buono va comunque per primo (localita': check rapidissimo del caso comune).
export function rankSources(candidates = [], mem = initDiscoveryMemory(), now = Date.now()) {
  const uniq = [...new Set(candidates)];
  const ranked = uniq.sort((x, y) => sourceScore(mem, y, now) - sourceScore(mem, x, now));
  if (mem.lastGood && uniq.includes(mem.lastGood)) {
    return [mem.lastGood, ...ranked.filter(u => u !== mem.lastGood)];
  }
  return ranked;
}
