// ============================================================
// QUESTA O QUELL'ALTRA — e quando la differenza non e' una differenza
// ============================================================
// La domanda che precede ogni decisione reale non e' "com'e' andata questa?"
// ma **"meglio questa o quella?"**. Ogni app risponde alla prima e lascia la
// seconda all'occhio: due schede affiancate, due grafici, e la persona
// confronta numeri che non sono confrontabili.
//
// I TRE MODI IN CUI UN CONFRONTO INGANNA, e cosa si fa qui:
//
// 1. PERIODI DIVERSI. Un titolo con dieci anni di storia e uno con due non si
//    confrontano: il primo ha attraversato un crollo, il secondo no. Qui si
//    confronta SOLO sui mesi in comune, e si dichiara quanti sono. Se sono
//    pochi, non si confronta affatto.
//
// 2. CONFRONTARE IL RENDIMENTO INVECE DELLA SCELTA. Se in quel periodo il
//    mercato e' salito del 30%, due titoli che hanno fatto +32% e +35% non
//    sono "uno migliore dell'altro del 3%": sono due modi di aver comprato il
//    mercato. Qui si confronta la parte che NON e' mercato — l'unica su cui
//    la scelta ha inciso — riusando la scomposizione di `titolo-causale.js`.
//
// 3. SCAMBIARE UNA DIFFERENZA PER UN VANTAGGIO. Due serie mensili rumorose
//    differiscono sempre. La domanda giusta e' se la differenza sia
//    distinguibile dal rumore, e la risposta onesta su pochi anni di dati e'
//    quasi sempre no. Qui si misura, con un test di permutazione sulle
//    differenze appaiate mese per mese (appaiate perche' i due titoli hanno
//    vissuto gli STESSI mesi: e' un confronto molto piu' potente che trattarli
//    come due campioni indipendenti, e qui e' anche quello corretto).
//
// La conclusione tipica sara' "su questi dati non si distinguono", e non e' un
// fallimento del metodo: e' l'informazione che impedisce di pagare di piu' per
// una differenza che non c'e'.
//
// Nessuna raccomandazione, mai: si dice cosa distingue i due, non quale
// prendere. Funzioni PURE.
'use strict';

import { scomponi, correlazione } from './titolo-causale.js';

export const MIN_MESI_CONFRONTO = 24;
export const PERMUTAZIONI = 999;

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const componi = (a) => a.reduce((c, v) => c * (1 + v), 1) - 1;

// Intersezione per chiave anno-mese: due serie allineate su mesi diversi
// producono un confronto perfettamente formattato e senza senso.
export function mesiComuni(mensiliA = [], mensiliB = []) {
  const mapB = new Map(mensiliB.map((r) => [r.mese, r.rendimento]));
  const mesi = [], a = [], b = [];
  for (const r of mensiliA) {
    if (!mapB.has(r.mese)) continue;
    const vb = mapB.get(r.mese);
    if (!Number.isFinite(r.rendimento) || !Number.isFinite(vb)) continue;
    mesi.push(r.mese); a.push(r.rendimento); b.push(vb);
  }
  return { mesi, a, b };
}

// ── La differenza e' distinguibile dal rumore? ──
// Test di permutazione APPAIATO: mese per mese si calcola la differenza, poi
// si rimescolano i SEGNI. E' il test giusto quando le due serie hanno vissuto
// gli stessi mesi, e non richiede alcuna ipotesi sulla forma della
// distribuzione — cosa che conta parecchio su rendimenti a code grasse.
export function differenzaDistinguibile(a = [], b = [], { permutazioni = PERMUTAZIONI, rng = Math.random } = {}) {
  const n = Math.min(a.length, b.length);
  if (n < MIN_MESI_CONFRONTO) return null;
  const d = [];
  for (let i = 0; i < n; i++) d.push(a[i] - b[i]);
  const osservata = Math.abs(media(d));

  let estremi = 0;
  for (let p = 0; p < permutazioni; p++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += rng() < 0.5 ? -d[i] : d[i];
    if (Math.abs(s / n) >= osservata) estremi++;
  }
  const pv = (estremi + 1) / (permutazioni + 1);
  return {
    differenzaMediaMensile: +(100 * media(d)).toFixed(3),
    p: +pv.toFixed(3),
    distinguibile: pv < 0.05,
    mesi: n,
  };
}

// ── Il referto ──
// `a` e `b`: { nome, mensili: [{mese, rendimento}] }. `mercato` opzionale:
// gli stessi mensili dell'indice, per separare la scelta dal mercato.
export function confronta(a, b, { mercato = null, rng = Math.random, permutazioni = PERMUTAZIONI } = {}) {
  const nomeA = a?.nome || 'il primo', nomeB = b?.nome || 'il secondo';
  const c = mesiComuni(a?.mensili || [], b?.mensili || []);

  if (c.mesi.length < MIN_MESI_CONFRONTO) {
    return {
      disponibile: false,
      mesiComuni: c.mesi.length,
      motivo: `${nomeA} e ${nomeB} hanno solo ${c.mesi.length} mesi di storia in comune: sotto ${MIN_MESI_CONFRONTO} un confronto direbbe piu' sul periodo scelto che sui due.`,
    };
  }

  const test = differenzaDistinguibile(c.a, c.b, { rng, permutazioni });

  // La parte che NON e' mercato, se l'indice e' disponibile per gli stessi mesi.
  let scelta = null;
  if (mercato) {
    const mapM = new Map(mercato.map((r) => [r.mese, r.rendimento]));
    const m = c.mesi.map((k) => mapM.get(k));
    if (m.every(Number.isFinite)) {
      const sa = scomponi(c.a, m), sb = scomponi(c.b, m);
      if (sa && sb) {
        scelta = {
          rendimentoMercato: +(100 * componi(m)).toFixed(1),
          a: { quotaSua: sa.quotaSua, beta: sa.beta, totale: sa.rendimentoTotale },
          b: { quotaSua: sb.quotaSua, beta: sb.beta, totale: sb.rendimentoTotale },
          // Il test rifatto sulla parte NON spiegata dal mercato: e' li' che
          // vive la differenza fra le due scelte, se esiste.
          sullaParteSua: differenzaDistinguibile(sa.residui, sb.residui, { rng, permutazioni }),
        };
      }
    }
  }

  return {
    disponibile: true,
    nomeA, nomeB,
    mesiComuni: c.mesi.length,
    da: c.mesi[0], a: c.mesi.at(-1),
    totali: { [nomeA]: +(100 * componi(c.a)).toFixed(1), [nomeB]: +(100 * componi(c.b)).toFixed(1) },
    // Quanto si muovono insieme: due titoli molto correlati non sono
    // un'alternativa l'uno all'altro, sono la stessa scommessa scritta due volte.
    insieme: +(correlazione(c.a, c.b) ?? 0).toFixed(3),
    test,
    scelta,
  };
}

export function testoConfronto(r) {
  if (!r?.disponibile) return r?.motivo || null;
  const righe = [];
  const [nA, nB] = [r.nomeA, r.nomeB];

  righe.push(`Confrontabili su ${r.mesiComuni} mesi in comune (${r.da} → ${r.a}): ${nA} ${r.totali[nA]}%, ${nB} ${r.totali[nB]}%.`);

  // Il "p" e' una frazione 0-1 (0.032): scritto cosi' in un testo altrimenti
  // in chiaro e' l'unico punto rimasto a parlare "da statistico" invece che
  // come il resto della risposta — in %, coerente con come l'app esprime
  // ovunque una probabilita' (rischio-rovina.js: "probabilita' misurata...
  // e' 12%", mai "0.12"). Stesso numero, non ricalcolato: solo scritto come
  // lo leggerebbe chi non sa cos'e' un p-value.
  const comeQuota = (p) => `${(p * 100).toFixed(1)}%`;
  if (r.test) {
    righe.push(r.test.distinguibile
      ? `La differenza regge a un controllo sul caso (probabilita' che sia solo fortuna: ${comeQuota(r.test.p)}).`
      : `**La differenza NON e' distinguibile dal rumore** (probabilita' che sia solo fortuna: ${comeQuota(r.test.p)}): su questi mesi non c'e' abbastanza per dire che uno abbia fatto meglio dell'altro.`);
  }

  if (r.scelta) {
    righe.push(`Nel frattempo il mercato ha fatto ${r.scelta.rendimentoMercato}%: di ${nA} solo il ${r.scelta.a.quotaSua}% del movimento e' roba sua, di ${nB} il ${r.scelta.b.quotaSua}%.`);
    if (r.scelta.sullaParteSua) {
      righe.push(r.scelta.sullaParteSua.distinguibile
        ? `Anche togliendo il mercato la differenza resta (probabilita' che sia solo fortuna: ${comeQuota(r.scelta.sullaParteSua.p)}): e' li' che le due scelte si separano davvero.`
        : `Tolto il mercato, quel che resta dei due non si distingue (probabilita' che sia solo fortuna: ${comeQuota(r.scelta.sullaParteSua.p)}): stanno comprando in gran parte la stessa cosa.`);
    }
  }

  if (r.insieme > 0.8) {
    righe.push(`Si muovono quasi insieme (${r.insieme}): tenerli entrambi non e' diversificare, e' fare la stessa scommessa due volte.`);
  }

  righe.push('E\' un confronto fra due storie passate, non un giudizio su quale sia migliore e non un consiglio.');
  return righe.join(' ');
}
