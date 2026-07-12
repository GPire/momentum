// Grafo di influenza tra categorie di spesa — il "ragionamento causale"
// della richiesta: se si muove A, quali categorie vicine si muovono con lei
// (stessa settimana) o subito dopo (settimana successiva)?
//
// ONESTÀ DICHIARATA: quello che si può misurare dai dati di UN utente è la
// CO-VARIAZIONE ritardata (correlazione sulle differenze settimanali), non
// la causalità in senso stretto. Il grafo dice "nei tuoi dati, quando sale
// X di solito sale anche Y" — un fatto misurato con soglie dichiarate — e
// ogni output porta con sé r e il numero di settimane osservate. Le
// correlazioni si calcolano sulle DIFFERENZE (Δ settimana su settimana),
// non sui livelli: due categorie che crescono entrambe col tempo non
// diventano "collegate" solo per il trend comune.
// Funzioni pure (pattern engines.js), nessun DOM.

const DAY_MS = 86_400_000;

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1) - day);
  return d;
}

// Serie settimanali per categoria: ultime `weeks` settimane COMPLETE
// (lun-dom), dalla più vecchia alla più recente.
export function buildCategorySeries(allTx, referenceDate = new Date(), weeks = 26) {
  const thisMonday = mondayOf(referenceDate);
  const start = new Date(thisMonday.getTime() - weeks * 7 * DAY_MS);
  const series = {};

  for (const tx of Object.values(allTx || {}).flat()) {
    if (tx.type !== 'uscita') continue;
    const d = new Date(tx.date);
    if (d < start || d >= thisMonday) continue;
    const idx = Math.floor((d - start) / (7 * DAY_MS));
    if (idx < 0 || idx >= weeks) continue;
    if (!series[tx.category]) series[tx.category] = new Array(weeks).fill(0);
    series[tx.category][idx] += tx.amount;
  }
  return series;
}

function diff(arr) {
  const out = [];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return null; // serie piatta: nessuna informazione
  return cov / Math.sqrt(va * vb);
}

// Costruisce il grafo: archi tra categorie con co-variazione forte.
// lag 0 = si muovono la stessa settimana; lag 1 = B si muove la settimana
// dopo A (l'ordine temporale è l'unico indizio di direzione che i dati di
// un singolo utente possono dare).
export function buildCausalGraph(allTx, referenceDate = new Date(), opts = {}) {
  const minR = opts.minR ?? 0.5;
  const minWeeks = opts.minWeeks ?? 8;
  const weeks = opts.weeks ?? 26;
  // Lag VARIABILE (W4): scansiona i ritardi 1..maxLag e tiene il più forte per
  // coppia direzionale — cattura effetti differiti ("una spesa oggi si riflette
  // sul risparmio fra N settimane"). Default 1 = comportamento storico invariato.
  const maxLag = Math.max(1, opts.maxLag ?? 1);

  const series = buildCategorySeries(allTx, referenceDate, weeks);
  const cats = Object.keys(series).filter(c => series[c].filter(v => v > 0).length >= Math.min(4, minWeeks / 2));
  const links = [];

  const lagLabel = (n) => n === 0 ? 'insieme' : n === 1 ? 'settimana dopo' : `dopo ${n} settimane`;

  for (const a of cats) {
    for (const b of cats) {
      if (a === b) continue;
      const da = diff(series[a]);
      const db = diff(series[b]);
      if (da.length < minWeeks) continue;

      // lag 0 (stessa settimana): calcolato solo con a<b per non duplicare l'arco
      if (a < b) {
        const r0 = pearson(da, db);
        if (r0 !== null && Math.abs(r0) >= minR) {
          links.push({ from: a, to: b, lagWeeks: 0, r: +r0.toFixed(3), samples: da.length, direction: 'insieme' });
        }
      }
      // lag 1..maxLag direzionale: Δa ↔ Δb spostata di L settimane. Tiene solo
      // il ritardo con |r| massimo per la coppia (a→b), non tutti.
      let bestLag = null;
      for (let L = 1; L <= maxLag; L++) {
        if (da.length - L < 3) break;
        const rL = pearson(da.slice(0, -L), db.slice(L));
        if (rL !== null && Math.abs(rL) >= minR && (!bestLag || Math.abs(rL) > Math.abs(bestLag.r))) {
          bestLag = { r: rL, lagWeeks: L, samples: da.length - L };
        }
      }
      if (bestLag) {
        links.push({ from: a, to: b, lagWeeks: bestLag.lagWeeks, r: +bestLag.r.toFixed(3), samples: bestLag.samples, direction: lagLabel(bestLag.lagWeeks) });
      }
    }
  }
  return links.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

// Propagazione a catena ("tocco A → si muovono anche i vicini di A"):
// attivazione che si diffonde nel grafo con smorzamento moltiplicativo
// (effetto del secondo ordine = r1 × r2 × delta), profondità massima 2,
// effetti sotto soglia scartati. Ogni effetto porta il percorso completo,
// così la UI può SPIEGARE perché ("X → Y → Z"), mai un numero orfano.
export function propagateImpact(links, catId, deltaPct, opts = {}) {
  const minEffect = opts.minEffectPct ?? 5;
  const maxDepth = opts.maxDepth ?? 2;
  const effects = new Map(); // cat -> { expectedPct, path, lagWeeks }

  const walk = (from, incomingPct, path, depth, lagSoFar) => {
    if (depth > maxDepth) return;
    for (const link of links) {
      if (link.from !== from) continue;
      if (path.includes(link.to)) continue; // niente cicli
      const effectPct = incomingPct * link.r;
      if (Math.abs(effectPct) < minEffect) continue;
      const lag = lagSoFar + link.lagWeeks;
      const existing = effects.get(link.to);
      if (!existing || Math.abs(effectPct) > Math.abs(existing.expectedPct)) {
        effects.set(link.to, { category: link.to, expectedPct: +effectPct.toFixed(1), path: [...path, link.to], lagWeeks: lag });
      }
      walk(link.to, effectPct, [...path, link.to], depth + 1, lag);
    }
  };

  walk(catId, deltaPct, [catId], 1, 0);
  return Array.from(effects.values()).sort((a, b) => Math.abs(b.expectedPct) - Math.abs(a.expectedPct));
}

// Narrazione a catena spiegabile (W4): "se A allora B, e forse C/D" con
// confidenza ONESTA per ciascun effetto e il caveat correlazione≠causalità.
// È il ragionamento causale richiesto ("se succede A potrebbe muoversi B e C,
// e forse anche D"), ma etichettato per forza reale del legame — mai una
// certezza spacciata. Ritorna { text, steps } dove steps ha category, path,
// lagWeeks, strength ('forte'|'probabile'|'possibile'), expectedPct.
export function explainChain(links, catId, deltaPct, opts = {}) {
  const effects = propagateImpact(links, catId, deltaPct, opts);
  const bucket = (s) => s >= 0.75 ? 'forte' : s >= 0.6 ? 'probabile' : 'possibile';
  const lagPhrase = (n) => n === 0 ? 'nella stessa settimana' : n === 1 ? 'la settimana dopo' : `dopo circa ${n} settimane`;

  const steps = effects.map(e => {
    const strength = deltaPct !== 0 ? Math.abs(e.expectedPct / deltaPct) : 0; // prodotto degli r lungo il percorso
    return {
      category: e.category,
      path: e.path,
      lagWeeks: e.lagWeeks,
      expectedPct: e.expectedPct,
      strength: bucket(Math.min(1, strength)),
      strengthValue: +Math.min(1, strength).toFixed(2),
    };
  });

  if (!steps.length) {
    return { text: `Nei tuoi dati non emergono effetti a catena affidabili muovendo ${catId}.`, steps: [] };
  }

  const dir = deltaPct >= 0 ? 'sale' : 'scende';
  const forti = steps.filter(s => s.strength !== 'possibile');
  const forse = steps.filter(s => s.strength === 'possibile');
  const say = (s) => `${s.category} (${s.strength}, ${lagPhrase(s.lagWeeks)}, ~${s.expectedPct > 0 ? '+' : ''}${s.expectedPct}%)`;

  let text = `Se ${catId} ${dir} del ${Math.abs(deltaPct)}%: probabilmente si muove anche ${forti.map(say).join('; ')}`;
  if (forse.length) text += `; e forse ${forse.map(say).join('; ')}`;
  text += '. Nota: è co-variazione osservata nei tuoi dati (correlazione), non una causalità certa.';
  return { text, steps };
}
