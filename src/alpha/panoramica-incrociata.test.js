'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quantoStrano, autovaloriSimmetrica, numeroEfficaceDiFonti, matriceCorrelazione,
  panoramica, testoPanoramica, MIN_STORIA,
} from './panoramica-incrociata.js';
import { LUNGO, NOMI_LUNGO } from './long-asset-panel.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;
const serie = (n, rng, scala = 0.04) => Array.from({ length: n }, () => rumore(rng) * scala);

test('storia troppo corta: nessuna misura inventata', () => {
  assert.equal(quantoStrano(Array.from({ length: MIN_STORIA - 1 }, () => 0.01)), null);
});

test('il p è BILATERALE: un estremo in basso è raro quanto uno in alto', () => {
  const rng = seme(1);
  const base = serie(200, rng);
  const inAlto = [...base, ...Array.from({ length: 12 }, () => 0.30)];
  const inBasso = [...base, ...Array.from({ length: 12 }, () => -0.30)];
  const a = quantoStrano(inAlto), b = quantoStrano(inBasso);
  assert.equal(a.verso, 'alto');
  assert.equal(b.verso, 'basso');
  assert.ok(Math.abs(a.p - b.p) < 1e-9, `alto ${a.p} vs basso ${b.p}`);
});

test('si guarda la MEDIA della finestra: un mese solo pesa MOLTO meno di dodici', () => {
  const rng = seme(2);
  const base = serie(400, rng, 0.02);
  const unMese = quantoStrano([...base, 0.5], { finestra: 12 });
  const dodiciMesi = quantoStrano([...base, ...Array.from({ length: 12 }, () => 0.5)], { finestra: 12 });
  // Un mese estremo resta visibile (e deve: +50% in un mese è un fatto), ma
  // dodici mesi così sono incomparabilmente più rari. Il punto della finestra
  // non è nascondere il mese singolo, è non trattarlo come una tendenza.
  assert.ok(unMese.valoreRecente < dodiciMesi.valoreRecente / 5,
    `un mese ${unMese.valoreRecente} vs dodici ${dodiciMesi.valoreRecente}`);
});

// ── IL NUMERO EFFICACE DI FONTI ──
test('DODICI SERIE IDENTICHE SONO UNA SOLA FONTE, non dodici', () => {
  // Il cuore del modulo: contare come dodici prove indipendenti dodici copie
  // della stessa cosa moltiplica per dodici una prova che è una sola.
  const rng = seme(3);
  const base = serie(120, rng);
  const dodiciCopie = Array.from({ length: 12 }, () => base.slice());
  const eff = numeroEfficaceDiFonti(matriceCorrelazione(dodiciCopie));
  assert.ok(eff <= 1.5, `dodici copie contano come ${eff}`);
});

test('serie indipendenti contano quasi tutte: nessuna compressione inventata', () => {
  const rng = seme(4);
  const otto = Array.from({ length: 8 }, () => serie(400, rng));
  const eff = numeroEfficaceDiFonti(matriceCorrelazione(otto));
  assert.ok(eff > 6, `otto serie indipendenti contate come ${eff}`);
  assert.ok(eff <= 8);
});

test('due blocchi correlati al loro interno danno circa due direzioni', () => {
  const rng = seme(5);
  const a = serie(300, rng), b = serie(300, rng);
  const gruppo = [
    a, a.map((x) => x * 1.01 + rumore(rng) * 0.0005), a.map((x) => x * 0.99 + rumore(rng) * 0.0005),
    b, b.map((x) => x * 1.01 + rumore(rng) * 0.0005), b.map((x) => x * 0.99 + rumore(rng) * 0.0005),
  ];
  const eff = numeroEfficaceDiFonti(matriceCorrelazione(gruppo));
  assert.ok(eff >= 1.5 && eff <= 3.5, `sei serie in due blocchi contate come ${eff}`);
});

test('autovalori di una matrice identità: tutti 1', () => {
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const l = autovaloriSimmetrica(I);
  for (const v of l) assert.ok(Math.abs(v - 1) < 1e-9);
});

test('autovalori: la somma è la traccia (controllo che l\'algoritmo non sballi)', () => {
  const rng = seme(6);
  const M = matriceCorrelazione(Array.from({ length: 5 }, () => serie(200, rng)));
  const somma = autovaloriSimmetrica(M).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(somma - 5) < 1e-6, `somma autovalori ${somma}, attesa 5`);
});

// ── LA PANORAMICA ──
test('SUI DATI VERI: 9 indicatori ma solo ~7 direzioni distinte, e l\'archivio è CIECO', () => {
  // Il risultato più importante del modulo, e non era previsto: sull'archivio
  // vero del progetto (400 mesi, 9 serie) il sistema NON PUÒ segnalare nulla.
  // Il pavimento del valore p imposto da 33 anni di storia sta sopra la soglia
  // che si ottiene correggendo per aver guardato nove serie. Non è "oggi va
  // tutto bene": è "con questa storia non potrei accorgermene".
  const fonti = {};
  for (const [k, v] of Object.entries(LUNGO)) fonti[NOMI_LUNGO[k] || k] = v;
  const r = panoramica(fonti);
  assert.equal(r.disponibile, true);
  assert.ok(r.guardate >= 8);
  // Il numero che nessuno dichiara: le fonti effettive sono MENO di quelle
  // guardate, perché molte si muovono insieme.
  assert.ok(r.fontiEfficaci < r.guardate, `efficaci ${r.fontiEfficaci} vs guardate ${r.guardate}`);
  assert.match(r.messaggio, /direzioni davvero distinte/);
  assert.equal(r.cieco, true);
  assert.match(r.messaggio, /non ho abbastanza storia/);
  // E dichiara quanta storia servirebbe, invece di lasciarlo indovinare.
  assert.match(r.messaggio, /osservazioni per serie/);
});

test('con storia sufficiente, "niente di notevole" è un\'osservazione vera', () => {
  const rng = seme(7);
  const fonti = {};
  // Abbastanza lunga da NON essere cieca: così un "niente" significa davvero
  // niente, e non "non riesco a guardare".
  for (let i = 0; i < 6; i++) fonti[`serie${i}`] = serie(900, rng);
  const r = panoramica(fonti);
  assert.equal(r.cieco, false);
  assert.equal(r.notevoli.length, 0);
  assert.match(testoPanoramica(r), /quasi tutti i giorni/);
});

test('MA se qualcosa è davvero estremo lo trova: il modulo non è un "no" automatico', () => {
  // La verifica che tiene onesto tutto il resto: un filtro che non segnala mai
  // niente è inutile quanto uno che segnala sempre. Serve però abbastanza
  // storia perché il valore p possa scendere sotto la soglia corretta — vedi
  // il test sulla cecità qui sotto.
  const rng = seme(8);
  const fonti = {};
  for (let i = 0; i < 5; i++) fonti[`normale${i}`] = serie(900, rng, 0.03);
  // Una serie che negli ultimi 12 mesi sta a un livello mai visto prima.
  fonti.eccezionale = [...serie(900, rng, 0.03), ...Array.from({ length: 12 }, () => 0.40)];
  const r = panoramica(fonti);
  assert.equal(r.cieco, false, 'con questa storia il sistema deve poter vedere');
  assert.ok(r.notevoli.length >= 1, `nessuna notevole: ${JSON.stringify(r.tutte.map((x) => [x.nome, x.p]))}`);
  assert.equal(r.notevoli[0].nome, 'eccezionale');
  assert.match(testoPanoramica(r), /eccezionale/);
});

test('LA CECITÀ VIENE DICHIARATA: "non ho storia" non è "niente di strano"', () => {
  // Scoperta scrivendo questi test, e vale per l'archivio VERO del progetto:
  // il valore p empirico non può scendere sotto 2/(finestre+1). Con 400 mesi
  // (33 anni) e sei fonti, quel pavimento (0,0051) sta SOPRA la soglia più
  // severa di Benjamini-Yekutieli (0,0034): niente potrebbe essere segnalato
  // nemmeno se fosse a un estremo mai visto. Un sistema che non può trovare
  // nulla deve dirlo, invece di restare in silenzio sembrando prudente.
  const rng = seme(20);
  const fonti = {};
  for (let i = 0; i < 5; i++) fonti[`normale${i}`] = serie(400, rng, 0.03);
  fonti.eccezionale = [...serie(400, rng, 0.03), ...Array.from({ length: 12 }, () => 0.40)];
  const r = panoramica(fonti);
  assert.equal(r.cieco, true);
  assert.ok(r.risoluzionePeggiore > r.sogliaPiuSevera);
  assert.equal(r.notevoli.length, 0);
  assert.match(r.messaggio, /non ho abbastanza storia/);
});

test('meno di due fonti: si rifiuta invece di fare una classifica di uno', () => {
  const rng = seme(9);
  const r = panoramica({ sola: serie(200, rng) });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 2 fonti/);
});

test('il numero atteso PER CASO viene sempre dichiarato', () => {
  const rng = seme(10);
  const fonti = {};
  for (let i = 0; i < 8; i++) fonti[`s${i}`] = serie(300, rng);
  const r = panoramica(fonti);
  assert.ok(Number.isFinite(r.attesePerCaso));
  // Con fonti quasi indipendenti e alpha 5%, ci si aspetta circa 0,4 estremi
  // per puro caso su otto: è il numero che nessun briefing dichiara.
  assert.ok(r.attesePerCaso > 0 && r.attesePerCaso < 1, `attese ${r.attesePerCaso}`);
});

test('il testo non promette eventi né suggerisce mosse', () => {
  const fonti = {};
  for (const [k, v] of Object.entries(LUNGO)) fonti[NOMI_LUNGO[k] || k] = v;
  const t = testoPanoramica(panoramica(fonti));
  assert.ok(!/\b(compra|vendi|conviene|dovresti|salirà|scenderà|preparati)\b/i.test(t), t);
  assert.match(t, /non vuol dire che stia per succedere/);
});
