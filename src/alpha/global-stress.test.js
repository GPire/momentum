import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloGlobale, controlliDiSanita, diversificazioneGeografica,
  portafoglioGlobaleVsUsa, globaleText, MERCATI,
} from './global-stress.js';
import { orizzonteDiCiascunSegnale } from './quadro-unico.js';

let _div = null, _port = null, _oriz = null;
const div = () => (_div ??= diversificazioneGeografica());
const port = () => (_port ??= portafoglioGlobaleVsUsa());
const oriz = () => (_oriz ??= orizzonteDiCiascunSegnale({ segnali: ['credito', 'curva', 'nfci'] }));

// ── I dati, e i controlli che impediscono di fidarsene alla cieca ──

test('il pannello globale copre le tre crisi con tre mercati allineati', () => {
  const p = pannelloGlobale();
  assert.equal(p.mercati.length, 3);
  assert.ok(p.mesi > 250, `mesi: ${p.mesi}`);
  assert.ok(p.da <= '2003-12' && p.a >= '2026-01');
  assert.match(p.fonti, /Chicago/);
});

test('CONTROLLO DI SANITÀ: gli azionari mondiali devono essere molto correlati', () => {
  const c = controlliDiSanita();
  assert.equal(c.allineato, true,
    `correlazioni troppo basse (${c.spyEfa}, ${c.spyEem}, ${c.efaEem}): il pannello è sfasato, non il mondo è cambiato`);
  assert.ok(c.spyEfa > 0.8, `USA-sviluppati: ${c.spyEfa}`);
  assert.equal(c.motivo, null);
});

test('CONTROLLO DI SANITÀ: condizioni finanziarie strette e mercato in salita non vanno insieme', () => {
  const c = controlliDiSanita();
  assert.equal(c.coerenteNfci, true, `correlazione SPY-NFCI ${c.spyNfci}: doveva essere negativa`);
});

// ── Il segnale che mancava: il NFCI chiude la finestra cieca ──

test('IL NFCI CHIUDE LA FINESTRA CIECA A SEI MESI', () => {
  const o = oriz();
  const a = (seg, h) => o.perSegnale[seg].find((r) => r.orizzonte === h);
  assert.equal(a('credito', 6).affidabile, false, `credito a 6 mesi: ${a('credito', 6).auc}`);
  assert.equal(a('curva', 6).affidabile, false, `curva a 6 mesi: ${a('curva', 6).auc}`);
  assert.equal(a('nfci', 6).affidabile, true, `NFCI a 6 mesi: ${a('nfci', 6).auc} — è il buco che chiude`);
  assert.ok(!o.finestraCieca.includes(6), `sei mesi non deve essere più cieco: ${JSON.stringify(o.finestraCieca)}`);
});

test('il NFCI è quasi perfetto sull\'adesso e girato sul futuro: è un termometro, non un oracolo', () => {
  const n = Object.fromEntries(oriz().perSegnale.nfci.map((r) => [r.orizzonte, r]));
  assert.ok(n[0].auc > 0.95, `adesso: ${n[0].auc}`);
  assert.equal(n[18].girato, true, `a diciotto mesi è girato: ${n[18].auc}`);
});

test('resta una cecità a dodici mesi, e viene dichiarata invece che nascosta', () => {
  assert.ok(oriz().finestraCieca.includes(12),
    'a dodici mesi nessun segnale è affidabile: va detto');
});

// ── Diversificare nel mondo ──

test('LE CORRELAZIONI SONO GIÀ ALTE IN TEMPI NORMALI: non c\'è molto da perdere', () => {
  const d = div();
  assert.ok(d.correlazioneMediaNormale > 0.7,
    `correlazione media nei mesi calmi: ${d.correlazioneMediaNormale}`);
  assert.match(d.conclusione, /non aggiunge la protezione che promette/);
  assert.ok(d.mesiCalmi > 150 && d.mesiTesi > 30);
});

test('FORBES-RIGOBON di nuovo, su dati completamente diversi dai settori', () => {
  const d = div();
  const usaNonUsa = d.coppie.find((c) => /Stati Uniti \/ Sviluppati/.test(c.coppia));
  assert.ok(usaNonUsa, 'la coppia USA / non-USA deve esserci');
  assert.ok(usaNonUsa.stress > usaNonUsa.calma, 'grezza: la correlazione sale nei periodi tesi');
  assert.ok(usaNonUsa.corretta < usaNonUsa.stress, 'la correzione deve ridurla');
  assert.equal(usaNonUsa.contagioResiste, false,
    `corretta ${usaNonUsa.corretta} contro calma ${usaNonUsa.calma}: anche qui il contagio non sopravvive alla correzione`);
});

test('IL RISULTATO SCOMODO: il portafoglio globale ha una coda PEGGIORE', () => {
  const p = port();
  assert.equal(p.globaleProtegge, false,
    `ES globale ${p.globale.es} contro solo USA ${p.soloUsa.es}`);
  assert.ok(p.globale.volatilita > p.soloUsa.volatilita,
    'la volatilità del globale deve essere maggiore: gli emergenti ballano di più');
  assert.match(p.conclusione, /senza aggiungere protezione/);
});

test('e non è un artefatto della coda: anche il peggior calo è più profondo', () => {
  const p = port();
  assert.ok(p.globale.peggiorCalo >= p.soloUsa.peggiorCalo - 0.02,
    `peggior calo globale ${p.globale.peggiorCalo} contro USA ${p.soloUsa.peggiorCalo}`);
});

// ── Come si racconta ──

test('il testo spiega perché senza mai dire cosa comprare', () => {
  const t = globaleText(div(), port());
  assert.match(t, /si muovono gia' insieme/);
  assert.match(t, /non e' diversificare/);
  assert.ok(!/compra|vendi|conviene|meglio investire/i.test(t), `indicazione operativa: ${t}`);
  assert.ok(!/correlazione|eteroschedast|Forbes|expected shortfall/i.test(t), `gergo: ${t}`);
});

test('i tre mercati hanno nomi leggibili, non sigle', () => {
  const d = div();
  for (const c of d.coppie) {
    assert.ok(!/spy|efa|eem/i.test(c.coppia), `sigla nella coppia: ${c.coppia}`);
  }
  assert.equal(MERCATI.length, 3);
});
