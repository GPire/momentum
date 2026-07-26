// Benchmark del TRANSFER MORFOLOGICO — "node bench/morphology-bench.mjs".
//
// LA DOMANDA, onesta: sui piccoli esercenti LOCALI mai visti — dove la
// gerarchia posizionale (ancorata al primo token) tace — un secondo strato che
// riconosce il TIPO di esercente (pizzeria, farmacia, officina...) ovunque nella
// stringa recupera categorie corrette SENZA cominciare a sbagliare sui veri
// sconosciuti?
//
// È il cold-start sui negozi di quartiere: il caso in cui Revolut & le banche
// lasciano "non categorizzato" o sbagliano.
//
// PROTOCOLLO (nessuna scorciatoia che gonfi il numero):
//  - tipi reali (pizzeria, farmacia, ...) montati su insegne CASUALI diverse;
//  - si addestrano gerarchia E morfologia sulle STESSE transazioni;
//  - TEST-A (locali mai visti): stesso TIPO, insegna e contorno MAI visti →
//    misura quanto la morfologia recupera dove la gerarchia si astiene;
//  - TEST-B (veri sconosciuti): esercenti con tipi MAI visti → BADANTE:
//    la morfologia deve TACERE quanto la gerarchia (0 falsi in più).
globalThis.window = {};
globalThis.navigator = { maxTouchPoints: 0 };

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const { initMerchantHierarchy, observeMerchant, predictMerchant } = await imp('src/ai/merchant-hierarchy.js');
const { initMorphology, observeMorphology, predictMorphology } = await imp('src/ai/merchant-morphology.js');
const { lookupMerchant } = await imp('src/ai/merchant-dictionary.js');
// Baseline REALE di produzione: prima il dizionario statico globale, poi la
// gerarchia personale. La morfologia si misura come guadagno MARGINALE sopra
// QUESTA catena — non contro la sola gerarchia (sarebbe gonfiare il numero).
const dictCat = (d) => { const r = lookupMerchant(d); return r ? r.category : null; };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260726);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// TIPI di esercente → categoria attesa (verità = ciò che l'utente conferma).
// SEPARATI in due gruppi ONESTI:
//  KNOWN = tipi che il DIZIONARIO statico già copre (verità allineata al suo
//          default, così il dizionario NON è penalizzato ingiustamente);
//  GAP   = tipi che il dizionario NON conosce (farmacia, officina, ...): è qui
//          che la morfologia crea valore reale in produzione.
const TYPES_KNOWN = [
  ['pizzeria', 'ristoranti'], ['trattoria', 'ristoranti'],
  ['panetteria', 'spesa'], ['macelleria', 'spesa'], ['alimentari', 'spesa'],
  ['ferramenta', 'shopping'], ['cartoleria', 'shopping'],
];
const TYPES_GAP = [
  ['farmacia', 'salute'], ['officina', 'trasporti'], ['carrozzeria', 'trasporti'],
  ['parrucchiere', 'cura'], ['gioielleria', 'shopping'], ['ottica', 'salute'],
  ['lavanderia', 'casa'],
];
const TYPES = [...TYPES_KNOWN, ...TYPES_GAP];
const GAP_SET = new Set(TYPES_GAP.map(t => t[0]));
// "insegne" casuali (nomi propri) montate attorno al tipo: cambiano ogni volta.
const NAMES = ['da mario', 'rossi', 'bianchi', 'del corso', 'san marco', 'napoli',
  'centrale', 'moderna', 'sud', 'nuova', 'aurora', 'porta romana', 'due ponti',
  'fratelli verdi', 'santa lucia', 'del popolo', 'garibaldi', 'europa'];

// Compone una descrizione mettendo il TIPO in posizione VARIABILE (inizio, mezzo,
// fine): è proprio la varianza di posizione che manda in crisi la gerarchia.
function merchantOf(type) {
  const a = pick(NAMES), b = pick(NAMES);
  const layout = Math.floor(rnd() * 3);
  if (layout === 0) return `${type} ${a}`;
  if (layout === 1) return `${a} ${type} ${b}`;
  return `${a} ${type}`;
}

// ── Addestramento: 4 esercenti distinti per tipo (insegne diverse) ──────────
const hier = initMerchantHierarchy();
let morph = initMorphology();
const seen = new Set();
for (const [type, cat] of TYPES) {
  let made = 0;
  while (made < 4) {
    const d = merchantOf(type);
    if (seen.has(d)) continue;
    seen.add(d);
    observeMerchant(hier, d, cat, Date.now());
    morph = observeMorphology(morph, d, cat, Date.now());
    made++;
  }
}

// ── TEST-A: esercenti LOCALI mai visti (stesso tipo, insegna/contorno nuovi) ─
// Baseline REALE = dizionario → gerarchia (la catena di produzione oggi).
// Treatment = dizionario → gerarchia → MORFOLOGIA (fallback per tipo).
const acc = { known: { base: 0, treat: 0, baseSilent: 0, n: 0 }, gap: { base: 0, treat: 0, baseSilent: 0, n: 0 } };
let nA = 0;
for (const [type, cat] of TYPES) {
  const bucket = GAP_SET.has(type) ? acc.gap : acc.known;
  for (let i = 0; i < 20; i++) {
    let d; do { d = merchantOf(type); } while (seen.has(d));
    seen.add(d); nA++; bucket.n++;
    const dict = dictCat(d);
    const h = predictMerchant(hier, d, Date.now());
    const m = predictMorphology(morph, d, Date.now());
    // Baseline di produzione: dizionario se parla, altrimenti gerarchia.
    const base = dict ?? (h ? h.category : null);
    if (base === null) bucket.baseSilent++;
    if (base === cat) bucket.base++;
    // Treatment: aggiunge la morfologia come ULTIMO fallback (solo se i primi due tacciono).
    const treat = base ?? (m ? m.category : null);
    if (treat === cat) bucket.treat++;
  }
}

// ── TEST-B: VERI sconosciuti (tipi MAI visti) → tutti devono TACERE ─────────
// Tipi MAI addestrati (nessuna sovrapposizione con TYPES) e ignoti al dizionario:
// isola il falso-parlato PURO della morfologia.
const UNSEEN = ['tabaccheria', 'fioraio', 'edicola', 'profumeria', 'pescheria', 'erboristeria'];
let hierSpokeB = 0, morphSpokeB = 0, nB = 0;
for (const type of UNSEEN) {
  for (let i = 0; i < 12; i++) {
    const d = merchantOf(type); nB++;
    if (predictMerchant(hier, d, Date.now())) hierSpokeB++;
    if (predictMorphology(morph, d, Date.now())) morphSpokeB++;
  }
}

const pct = (x, tot) => ((100 * x) / tot).toFixed(1);
const line = (label, b) => {
  console.log(`  ${label} (${b.n} casi):`);
  console.log(`     baseline dizionario→gerarchia : ${pct(b.base, b.n)}% giuste  ·  muta (nessuno sa) ${pct(b.baseSilent, b.n)}%`);
  console.log(`     + MORFOLOGIA (fallback)       : ${pct(b.treat, b.n)}% giuste`);
  console.log(`     ► guadagno marginale          : +${(100 * (b.treat - b.base) / b.n).toFixed(1)} punti`);
};
console.log('\n=== BENCH TRANSFER MORFOLOGICO (seed 20260726) ===');
console.log('Misura ONESTA: guadagno MARGINALE sopra la catena di produzione reale');
console.log('(dizionario statico → gerarchia personale), non contro la sola gerarchia.');
console.log(`\nTEST-A — esercenti LOCALI mai visti (${nA} casi totali):`);
line('TIPI che il DIZIONARIO già copre', acc.known);
line('TIPI-LACUNA che il dizionario NON conosce', acc.gap);
console.log('\n  Lettura: sui tipi noti il dizionario basta già (guadagno ~0, giusto così);');
console.log('  il valore reale è sui tipi-lacuna, dove oggi l\'app resta senza categoria.');
console.log(`\nTEST-B — VERI sconosciuti (${nB} casi, tipi mai visti): entrambi devono TACERE`);
console.log(`  Gerarchia ha parlato : ${pct(hierSpokeB, nB)}%   (0% = corretto)`);
console.log(`  Morfologia ha parlato: ${pct(morphSpokeB, nB)}%   (0% = corretto: nessun falso in più)`);
console.log('\nOnestà: il guadagno vale sui LOCALI il cui TIPO l\'utente ha già incontrato');
console.log('altrove. Su un tipo mai visto lo strato tace — come deve.\n');
