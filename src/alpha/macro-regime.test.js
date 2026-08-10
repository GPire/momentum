import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloMacro, indiceMese, stimaLogistica, probabilitaRecessione,
  validazioneWalkForward, aucPerOrizzonte, storicoInversioni,
  regolaSahm, validazioneSahm, quadroMacro, quadroText,
  ORIZZONTE_MESI, MIN_STORIA, SOGLIA_SAHM,
} from './macro-regime.js';
import { MACRO } from './macro-panel.js';

// ── I dati, e da dove vengono ──

test('il pannello macro copre quarant\'anni e cinque recessioni datate dal NBER', () => {
  const p = pannelloMacro();
  assert.ok(p.mesi > 500, `attesi oltre 500 mesi, trovati ${p.mesi}`);
  assert.equal(p.recessioni, 5, 'servono abbastanza recessioni per poter validare qualcosa');
  assert.match(p.fonte, /Federal Reserve/);
  assert.equal(indiceMese(p.da), 0);
  assert.equal(indiceMese('1900-01'), -1, 'una data fuori campione non deve restituire un indice valido');
});

// ── La logistica, prima di fidarsene ──

test('la regressione logistica ritrova un legame che c\'è per costruzione', () => {
  // Dati finti dove la relazione è nota: al crescere di x, y diventa raro.
  const x = [], y = [];
  for (let i = 0; i < 400; i++) {
    const xi = -3 + (6 * i) / 400;
    x.push(xi);
    y.push(1 / (1 + Math.exp(-(1 - 2 * xi))) > 0.5 ? 1 : 0);
  }
  const m = stimaLogistica(x, y);
  assert.ok(m.b1 < 0, `il coefficiente doveva essere negativo: ${m.b1}`);
});

test('con pochi dati non si stima niente', () => {
  assert.equal(stimaLogistica([1, 2, 3], [0, 1, 0]), null);
});

test('il modello punta nella direzione giusta: curva più piatta, rischio più alto', () => {
  const p = probabilitaRecessione();
  assert.equal(p.coerente, true, `coefficiente ${p.coefficiente}: doveva essere negativo`);
  assert.ok(p.probabilita >= 0 && p.probabilita <= 1);
  assert.ok(p.esempi > 200);
});

test('senza abbastanza storia non si dà una probabilità', () => {
  const p = probabilitaRecessione(100);
  assert.equal(p.probabilita, null);
  assert.match(p.motivo, /almeno 240 mesi/);
});

// ── LA VALIDAZIONE: è qui che il segnale viene giudicato ──

test('WALK-FORWARD: ogni previsione usa solo i dati che c\'erano allora', () => {
  const v = validazioneWalkForward();
  assert.equal(v.valutabile, true);
  assert.ok(v.previsioni > 200, `previsioni fuori campione: ${v.previsioni}`);
  assert.ok(v.mesiPreRecessione >= 15, 'servono abbastanza casi positivi');
  assert.match(v.nota, /nessuno sguardo al futuro/);
  // Prima di una recessione la probabilità stimata deve essere più alta.
  assert.ok(v.probabilitaMediaPrimaDiUnaRecessione > v.probabilitaMediaAltrimenti);
});

test('L\'ORIZZONTE CANONICO DI 12 MESI È FRA I PEGGIORI — misurato, non opinato', () => {
  const curva = aucPerOrizzonte([6, 12, 18, 24]);
  const a = Object.fromEntries(curva.map((r) => [r.orizzonte, r.auc]));
  assert.ok(a[12] < 0.7, `a 12 mesi l'AUC è ${a[12]}: appena sopra il caso, non un segnale`);
  assert.ok(a[18] > 0.75, `a 18 mesi l'AUC è ${a[18]}: qui il segnale c'è`);
  assert.ok(a[18] > a[12] + 0.15, 'la differenza fra i due orizzonti deve essere netta');
});

test('A SEI MESI IL SEGNALE È GIRATO: sotto 0,5 non è rumore, è al contrario', () => {
  const sei = aucPerOrizzonte([6])[0];
  assert.equal(sei.antiPredittivo, true, `AUC a 6 mesi: ${sei.auc}`);
  assert.ok(sei.auc < 0.45,
    `${sei.auc}: nei mesi appena prima di una recessione la banca centrale ha già tagliato e la curva è tornata normale`);
});

test('il default del modulo è l\'orizzonte che funziona, non quello che si copia', () => {
  assert.equal(ORIZZONTE_MESI, 18);
  assert.equal(validazioneWalkForward().utile, true);
  assert.equal(validazioneWalkForward({ orizzonte: 12 }).utile, false,
    'e l\'orizzonte canonico deve risultare NON utile, altrimenti la scelta sopra non avrebbe senso');
});

// ── Le inversioni, contate invece che ricordate ──

test('LE INVERSIONI: quante volte hanno avuto ragione e con quanto anticipo', () => {
  const inv = storicoInversioni();
  assert.ok(inv.length >= 8, `attese molte inversioni dal 1982, trovate ${inv.length}`);
  const seguite = inv.filter((e) => e.recessioneArrivata);
  assert.ok(seguite.length >= 7, `${seguite.length} inversioni seguite da recessione su ${inv.length}`);
  // Le crisi note devono esserci, con le loro date.
  assert.ok(inv.some((e) => e.inizio.startsWith('2000')), 'l\'inversione del 2000 deve esserci');
  assert.ok(inv.some((e) => e.inizio.startsWith('2006') || e.inizio.startsWith('2007')), 'quella pre-2008 anche');
  assert.ok(inv.some((e) => e.inizio.startsWith('2019')), 'e quella del 2019');
});

test('L\'ANTICIPO È IL VERO PROBLEMA: va da pochi mesi a due anni', () => {
  const anticipi = storicoInversioni().filter((e) => e.anticipoMesi !== null).map((e) => e.anticipoMesi);
  assert.ok(anticipi.length >= 6);
  const min = Math.min(...anticipi), max = Math.max(...anticipi);
  assert.ok(max - min > 12,
    `l'anticipo varia da ${min} a ${max} mesi: un segnale che non dice MAI quando vale molto meno della sua fama`);
});

test('il falso allarme del 2022 c\'è, e non viene nascosto', () => {
  const inv = storicoInversioni();
  const lunga = inv.find((e) => e.inizio.startsWith('2022'));
  assert.ok(lunga, 'l\'inversione iniziata nel 2022 deve essere nell\'elenco');
  assert.equal(lunga.recessioneArrivata, false,
    'la più lunga della serie storica non è stata seguita da una recessione: va detto');
  assert.ok(lunga.durataMesi > 20);
});

// ── La regola di Sahm: non anticipa, ma riconosce ──

test('SAHM: riconosce tutte le recessioni del campione', () => {
  const v = validazioneSahm();
  assert.equal(v.recessioniColte, v.recessioniTotali,
    `colte ${v.recessioniColte} su ${v.recessioniTotali}`);
  assert.ok(v.recessioniTotali >= 4);
});

test('SAHM: gli allarmi "fuori recessione" sono quasi tutti l\'eco della ripresa, non errori', () => {
  const v = validazioneSahm();
  assert.ok(v.mesiEcoPostRecessione > v.mesiFalsiVeri * 4,
    `eco post-recessione ${v.mesiEcoPostRecessione} contro falsi veri ${v.mesiFalsiVeri}`);
  assert.ok(v.mesiFalsiVeri < 15,
    `in quarant'anni i falsi allarmi veri devono essere pochi: ${v.mesiFalsiVeri}`);
  assert.match(v.nota, /CONFERMA, non anticipa/);
});

test('SAHM oggi: calcolata, con le sue componenti a vista', () => {
  const s = regolaSahm();
  assert.equal(s.soglia, SOGLIA_SAHM);
  assert.ok(Number.isFinite(s.valore));
  assert.ok(s.disoccupazioneMedia3Mesi >= s.minimoUltimoAnno - 1e-9);
  assert.equal(s.scattata, s.valore >= SOGLIA_SAHM);
});

// ── Il quadro e come si racconta ──

test('il quadro mette insieme i due segnali e dice se concordano', () => {
  const q = quadroMacro();
  assert.ok(Number.isFinite(q.curva) && Number.isFinite(q.tassoDecennale));
  assert.ok(q.probabilitaRecessione12Mesi >= 0 && q.probabilitaRecessione12Mesi <= 1);
  assert.equal(typeof q.concordano, 'boolean');
});

test('nei mesi che precedettero il 2008 il modello segnava più rischio di oggi', () => {
  const i = indiceMese('2007-01');
  assert.ok(i > MIN_STORIA, 'il 2007 deve cadere oltre il minimo di storia');
  const allora = probabilitaRecessione(i + 1);
  const oggi = probabilitaRecessione();
  assert.ok(allora.probabilita > oggi.probabilita,
    `gennaio 2007: ${allora.probabilita} contro oggi ${oggi.probabilita}`);
  assert.equal(allora.invertita, true, 'a inizio 2007 la curva era invertita');
});

test('IL FENOMENO CHE ROVINA IL SEGNALE A BREVE, visto sul 2007-2008', () => {
  // Questo test nasce da una MIA assunzione sbagliata: davo per scontato che a
  // meta' 2007 la curva fosse ancora invertita, e non lo era. E' esattamente
  // il fenomeno che rende l'AUC a sei mesi inferiore al caso.
  const gen07 = probabilitaRecessione(indiceMese('2007-01') + 1);   // 12 mesi prima
  const giu07 = probabilitaRecessione(indiceMese('2007-06') + 1);   // 7 mesi prima
  const nov07 = probabilitaRecessione(indiceMese('2007-11') + 1);   // 2 mesi prima

  assert.equal(gen07.invertita, true, 'un anno prima: curva invertita, allarme acceso');
  assert.equal(giu07.invertita, false, 'sette mesi prima: gia\' tornata normale');
  assert.equal(nov07.invertita, false, 'due mesi prima della recessione: normale, e per giunta ripida');
  assert.ok(nov07.probabilita < gen07.probabilita / 3,
    `alla vigilia della crisi il modello segnava MENO rischio di un anno prima: ${nov07.probabilita} contro ${gen07.probabilita}`);
});

test('il testo non promette niente e non dice mai cosa comprare', () => {
  const t = quadroText(quadroMacro());
  assert.ok(t.length > 40);
  assert.ok(!/comprar|vender|conviene|opportunit|consigli/i.test(t), `il testo dà indicazioni operative: ${t}`);
  assert.ok(!/AUC|logistica|coefficiente|probit/i.test(t), `gergo: ${t}`);
});

test('la verità NBER non entra mai come input di una previsione', async () => {
  // Controllo strutturale: `rec` compare solo come esito, mai come covariata.
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./macro-regime.js', import.meta.url), 'utf8');
  // La curva è l'unica covariata passata alla stima.
  assert.match(src, /x\.push\(MACRO\.curva\[i\]\); y\.push\(MACRO\.rec\[i \+ orizzonte\]\)/);
  assert.equal(MACRO.rec.every((v) => v === 0 || v === 1 || v === null), true);
});
