'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quantoStrano, autovaloriSimmetrica, numeroEfficaceDiFonti, matriceCorrelazione,
  panoramica, testoPanoramica, MIN_STORIA, correzioneEfficace, panoramicaDoppia,
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

// ── LA CORREZIONE SUL NUMERO GIUSTO, e i dati giornalieri ──
test('correggere per le direzioni EFFICACI è meno severo che per tutte le serie', () => {
  // Non è generosità: undici serie che contengono nove direzioni distinte
  // sono nove test, non undici. Correggere per undici è più severo del
  // necessario, e la severità di troppo non è prudenza — è cecità.
  const pv = [0.0018, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95];
  const tutte = correzioneEfficace(pv, { alpha: 0.05, mEfficace: 11 });
  const efficaci = correzioneEfficace(pv, { alpha: 0.05, mEfficace: 9 });
  assert.ok(efficaci.sogliaPiuSevera > tutte.sogliaPiuSevera);
  assert.equal(tutte.rifiutati.has(0), false);
  assert.equal(efficaci.rifiutati.has(0), true);
});

test('correzioneEfficace non può mai essere più permissiva del numero di test reali', () => {
  const pv = [0.01, 0.02, 0.03];
  // Un mEfficace assurdo non deve poter scendere sotto 1 né salire sopra m.
  assert.equal(correzioneEfficace(pv, { mEfficace: 0 }).mUsato, 1);
  assert.equal(correzioneEfficace(pv, { mEfficace: 99 }).mUsato, 3);
  assert.equal(correzioneEfficace([], {}).mUsato, 0);
});

test('I DATI GIORNALIERI ALZANO LA RISOLUZIONE: da cieco a vedente', async () => {
  // Il motivo per cui il pannello giornaliero serve. 1253 osservazioni contro
  // 400 portano il pavimento del valore p da 0,0051 a 0,0016, e con la
  // correzione sulle direzioni efficaci (0,00196) il sistema smette di essere
  // cieco. Con la sola correzione prudente (0,00151) resterebbe cieco: il
  // verdetto dipende dal metodo, e il referto lo dichiara.
  const { GIORNALIERO, NOMI_GIORNALIERI } = await import('./daily-panel.js');
  const fonti = {};
  for (const [k, v] of Object.entries(GIORNALIERO)) fonti[NOMI_GIORNALIERI[k] || k] = v;
  const r = panoramica(fonti, { finestra: 21 });
  assert.equal(r.cieco, false, 'col giornaliero il sistema deve poter vedere');
  assert.ok(r.risoluzionePeggiore < r.sogliaPiuSevera);
  assert.equal(r.dipendeDalMetodo, true, 'e deve dichiarare che dipende dal metodo');
  assert.ok(r.avvisi.some((a) => /dipende da come si contano/.test(a)));
});

test('I DUE ORIZZONTI hanno forze opposte, e si dicono entrambe', async () => {
  const { GIORNALIERO, NOMI_GIORNALIERI } = await import('./daily-panel.js');
  const giornaliere = {}, mensili = {};
  for (const [k, v] of Object.entries(GIORNALIERO)) giornaliere[NOMI_GIORNALIERI[k] || k] = v;
  for (const [k, v] of Object.entries(LUNGO)) mensili[NOMI_LUNGO[k] || k] = v;
  const r = panoramicaDoppia({
    giornaliere, mensili,
    etichettaBreve: 'gli ultimi cinque anni', etichettaLungo: 'i quarant\'anni',
    crisiNelBreve: false,
  });
  assert.equal(r.disponibile, true);
  // Il breve vede ma conosce poco; il lungo conosce molto ma non vede.
  assert.equal(r.breve.cieco, false);
  assert.equal(r.lungo.cieco, true);
  assert.match(r.messaggio, /gli ultimi cinque anni/);
  assert.match(r.messaggio, /ne' un si' ne' un no/);
  // Il limite va detto quando è vero.
  assert.match(r.avviso, /non contiene una crisi profonda/);
});

test('LE ETICHETTE NON SI SCRIVONO A MANO: invecchiano insieme ai dati', () => {
  // Il testo diceva "cinque anni recenti" e "non contengono una crisi
  // profonda" scritti dentro il modulo. Quando l'archivio giornaliero è
  // passato da 5 a 26 anni quelle due frasi sono diventate FALSE senza che
  // nulla si rompesse — nessun errore, solo una descrizione sbagliata dei
  // propri stessi dati.
  const rng = seme(31);
  const g = {}; const m = {};
  for (let i = 0; i < 4; i++) { g[`g${i}`] = serie(900, rng); m[`m${i}`] = serie(900, rng); }
  const conCrisi = panoramicaDoppia({ giornaliere: g, mensili: m, etichettaBreve: 'i ventisei anni', crisiNelBreve: true });
  assert.match(conCrisi.messaggio, /i ventisei anni/);
  assert.match(conCrisi.avviso, /contiene almeno una crisi profonda/);
  assert.equal(conCrisi.crisiNelBreve, true);
  // E l'avviso opposto non deve comparire quando la crisi c'è: un avviso che
  // si ripete senza motivo smette di essere letto.
  assert.ok(!/non contiene una crisi/.test(conCrisi.avviso));
});

test('nessuna preposizione articolata costruita concatenando ("su gli", "su i")', () => {
  // Stesso errore già corretto in titolo-causale.js: "da le azioni americane".
  const rng = seme(32);
  const g = {}; const m = {};
  for (let i = 0; i < 4; i++) { g[`g${i}`] = serie(900, rng); m[`m${i}`] = serie(900, rng); }
  const r = panoramicaDoppia({
    giornaliere: g, mensili: m,
    etichettaBreve: 'gli ultimi 26 anni', etichettaLungo: 'i quarant\'anni',
  });
  assert.ok(!/\b(su gli|su i|su le|su il|di il|da le)\b/i.test(r.messaggio), r.messaggio);
});

test('panoramicaDoppia con un solo archivio funziona comunque', async () => {
  const rng = seme(30);
  const solo = {};
  for (let i = 0; i < 4; i++) solo[`s${i}`] = serie(900, rng);
  const r = panoramicaDoppia({ mensili: solo });
  assert.equal(r.disponibile, true);
  assert.equal(r.breve, null);
  assert.ok(r.lungo.disponibile);
});

test('panoramicaDoppia senza dati: si dichiara invece di inventare', () => {
  const r = panoramicaDoppia({});
  assert.equal(r.disponibile, false);
});

test('il testo non promette eventi né suggerisce mosse', () => {
  const fonti = {};
  for (const [k, v] of Object.entries(LUNGO)) fonti[NOMI_LUNGO[k] || k] = v;
  const t = testoPanoramica(panoramica(fonti));
  assert.ok(!/\b(compra|vendi|conviene|dovresti|salirà|scenderà|preparati)\b/i.test(t), t);
  assert.match(t, /non vuol dire che stia per succedere/);
});
