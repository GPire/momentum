import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orizzonteDiCiascunSegnale, statoOggi, statoFuturo, decisioneUnica,
  decisioneText, refertoTecnico, ORIZZONTI_PROVATI,
} from './quadro-unico.js';
import { forcedSaleRisk, makeRng } from './forced-sale-risk.js';
import { bootstrapCondizionato, bootstrapSequence, ampiezzaCondizionamento } from './historical-sequences.js';

// Calcoli costosi: una volta sola.
let _oriz = null, _dec = null;
const oriz = () => (_oriz ??= orizzonteDiCiascunSegnale());

const usciteFiscali = () => {
  const u = {};
  for (let a = 0; a < 5; a++) { u[a * 12 + 5] = 3200; u[a * 12 + 11] = 2100; }
  return u;
};
const PROFILO = {
  liquidita: 14000, sigmaReddito: 0.35, contributoMensile: 2600,
  speseMensili: 2400, portafoglio: 30000, usciteProgrammate: usciteFiscali(), mesi: 60,
};
const decisione = () => (_dec ??= decisioneUnica(PROFILO, { percorsi: 1200 }));

// ── OGNI SEGNALE HA IL SUO ORIZZONTE: è la tesi del modulo ──

test('IL CREDITO SA TUTTO DI ADESSO E NIENTE DEL FUTURO', () => {
  const c = Object.fromEntries(oriz().perSegnale.credito.map((r) => [r.orizzonte, r]));
  assert.ok(c[0].auc > 0.9, `adesso: ${c[0].auc}`);
  assert.equal(c[0].affidabile, true);
  assert.ok(c[3].auc > 0.7, `tre mesi: ${c[3].auc}`);
  assert.equal(c[18].girato, true, `a diciotto mesi è girato: ${c[18].auc}`);
});

test('LA CURVA È IL CONTRARIO: cieca su adesso, buona a diciotto mesi', () => {
  const q = Object.fromEntries(oriz().perSegnale.curva.map((r) => [r.orizzonte, r]));
  assert.equal(q[18].affidabile, true, `diciotto mesi: ${q[18].auc}`);
  assert.equal(q[3].girato, true, `tre mesi: ${q[3].auc} — usarla lì è peggio che non usarla`);
  assert.ok(q[18].auc > q[3].auc + 0.4, 'la differenza fra i due estremi deve essere enorme');
});

test('SONO COMPLEMENTARI: dove uno è affidabile, l\'altro no', () => {
  const c = Object.fromEntries(oriz().perSegnale.credito.map((r) => [r.orizzonte, r.affidabile]));
  const q = Object.fromEntries(oriz().perSegnale.curva.map((r) => [r.orizzonte, r.affidabile]));
  assert.equal(c[3] && q[3], false, 'a tre mesi non possono essere affidabili entrambi');
  assert.equal(c[18], false);
  assert.equal(q[18], true);
});

test('LA FINESTRA CIECA esiste e viene dichiarata invece che riempita', () => {
  const o = oriz();
  assert.ok(o.finestraCieca.length > 0, 'deve esserci almeno un orizzonte senza segnali affidabili');
  assert.ok(o.finestraCieca.includes(6), `attesa cecità a sei mesi: ${JSON.stringify(o.finestraCieca)}`);
  assert.match(refertoTecnico().lezione, /finestra cieca/);
});

// ── Lo stato di adesso: tre voci, e il caso in cui non concordano ──

test('lo stato di oggi combina tre segnali indipendenti e dice se concordano', () => {
  const s = statoOggi();
  assert.ok(['difficile', 'misto', 'sereno'].includes(s.stato));
  assert.equal(s.voti.length, 3);
  assert.ok(s.creditoPercentile >= 0 && s.creditoPercentile <= 1);
  assert.equal(typeof s.concordi, 'boolean');
  assert.equal(s.concordi, Math.abs(s.voti.reduce((a, b) => a + b, 0)) === 3);
});

test('il futuro porta con sé l\'avviso sull\'anticipo: dice SE, non QUANDO', () => {
  const f = statoFuturo();
  assert.ok(f.probabilitaRecessione18Mesi >= 0 && f.probabilitaRecessione18Mesi <= 1);
  assert.match(f.avviso, /dice SE, non QUANDO/);
});

// ── IL CONDIZIONAMENTO: il regime deve ENTRARE nel numero ──

test('IL BOOTSTRAP CONDIZIONATO produce scenari diversi da quello uniforme', () => {
  const r = makeRng(5);
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  let cond = 0, unif = 0;
  for (let k = 0; k < 200; k++) { cond += sd(bootstrapCondizionato(60, r)); unif += sd(bootstrapSequence(60, r)); }
  assert.ok(Math.abs(cond - unif) / unif > 0.02,
    `gli scenari condizionati devono differire da quelli uniformi: ${cond / 200} vs ${unif / 200}`);
});

test('il condizionamento non azzera mai il resto della storia', () => {
  const a = ampiezzaCondizionamento();
  assert.ok(a.mesiEfficaci > 30, `campione efficace troppo stretto: ${a.mesiEfficaci}`);
  assert.ok(a.quota > 0.05 && a.quota < 1, `quota ${a.quota}`);
  assert.equal(typeof a.abbastanza, 'boolean');
});

test('IL REGIME ENTRA NEL NUMERO, e la differenza è dichiarata', () => {
  const d = decisione();
  assert.ok(Number.isFinite(d.differenzaDovutaAlRegime));
  assert.notEqual(d.rischio.probabilita, d.rischioSenzaRegime.probabilita,
    'se i due numeri coincidessero, parlare di regime sarebbe decorazione');
});

// ── LA DECISIONE ──

test('LA DECISIONE È UNA SOLA, e non è mai comprare o vendere', () => {
  const d = decisione();
  assert.ok(['niente', 'tenere liquidi', 'ridurre l\'esposizione'].includes(d.azione.cosa));
  assert.ok(d.azione.perche.length > 20);
  if (d.azione.cosa === 'tenere liquidi') assert.ok(d.azione.quanto > 0);
});

test('chi non ha bisogno di niente non riceve un compito', () => {
  const d = decisioneUnica({ ...PROFILO, liquidita: 90000 }, { percorsi: 600 });
  assert.equal(d.azione.cosa, 'niente');
  assert.match(decisioneText(d), /Non c'è niente da fare/);
});

test('quando il cuscinetto non può bastare lo dice, invece di consigliare l\'impossibile', () => {
  const d = decisioneUnica({ ...PROFILO, liquidita: 0, speseMensili: 6500, contributoMensile: 1200 }, { percorsi: 500 });
  assert.equal(d.azione.cosa, 'ridurre l\'esposizione');
  assert.match(d.azione.perche, /non è la liquidità/);
});

test('un regime difficile stringe la soglia, e la scelta è dichiarata', () => {
  const d = decisione();
  assert.ok(d.obiettivoUsato <= 0.1);
  if (d.oggi.stato === 'difficile') assert.equal(d.obiettivoUsato, 0.05);
  else assert.equal(d.obiettivoUsato, 0.1);
});

test('il testo dice adesso, futuro e cosa fare — senza mai indicare cosa comprare', () => {
  const t = decisioneText(decisione());
  assert.ok(t.length > 120);
  assert.ok(!/compra|vendi il|azioni migliori|conviene investire|opportunità di acquisto/i.test(t), `indicazione operativa: ${t}`);
  assert.ok(!/AUC|bootstrap|percentile|logistica|regime condizionato/i.test(t), `gergo: ${t}`);
  assert.match(t, /su 100/);
});

test('la fonte dei dati viaggia insieme alla decisione', () => {
  const d = decisione();
  assert.equal(d.fonte.simbolo, 'SPY');
  assert.ok(d.fonte.mesi > 380);
  assert.match(d.fonte.fonte, /Yahoo/);
});
