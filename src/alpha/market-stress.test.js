import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannello, rendimentoMercato, correlazioneCondizionata, correlazioneCondizionataIngenua,
  bootstrapPanel, rendimentoPortafoglio, expectedShortfall, stressIndex, cosaPrevede,
  stressText, diversificazioneText, LIVELLO_ES,
} from './market-stress.js';
import { makeRng } from './forced-sale-risk.js';

// ── Il pannello è vero e copre i regimi che servono ──

test('nove settori, stessi mesi, e dentro ci sono le quattro crisi che contano', () => {
  const p = pannello();
  assert.equal(p.settori.length, 9);
  assert.ok(p.mesi > 320, `attesi oltre 320 mesi, trovati ${p.mesi}`);
  assert.ok(p.da <= '1999-03' && p.a >= '2026-01');
  // dot-com, 2008, COVID, 2022 devono essere tutti dentro la finestra.
  const mercato = rendimentoMercato();
  assert.equal(mercato.length, p.mesi);
  assert.ok(Math.min(...mercato) < -0.12, 'la storia deve contenere almeno un mese davvero brutto');
});

// ── IL BIAS, e la sua correzione ──

test('LA MISURA INGENUA DÀ IL RISULTATO OPPOSTO — ed è un bias noto, non una scoperta', () => {
  const i = correlazioneCondizionataIngenua();
  assert.ok(i.stress < i.calma,
    `condizionando sul rendimento del mese la correlazione risulta PIÙ BASSA nei crolli: ${i.stress} vs ${i.calma}`);
  assert.match(i.avviso, /MISURA DISTORTA/);
  assert.match(i.avviso, /Boyer-Gibson-Loretan/);
});

test('condizionando sul REGIME invece che sul mese, la correlazione sale davvero', () => {
  const c = correlazioneCondizionata();
  assert.ok(c.stress.correlazione > c.calma.correlazione,
    `stress ${c.stress.correlazione} deve superare calma ${c.calma.correlazione}`);
  assert.ok(c.correlazioneSaleGrezza > 0);
  assert.match(c.metodo, /regime di volatilit/);
});

test('FORBES-RIGOBON: l\'aumento apparente è volatilità travestita da contagio', () => {
  const c = correlazioneCondizionata();
  assert.ok(c.forbesRigobon.delta > 0, 'nei periodi di stress la varianza deve essere maggiore');
  assert.ok(c.forbesRigobon.correlazioneCorretta < c.stress.correlazione,
    'la correzione deve ridurre la correlazione misurata');
  // Su questo campione il luogo comune non sopravvive: va registrato, perché
  // se un domani i dati cambiassero questo test lo direbbe.
  assert.equal(c.forbesRigobon.contagioResiste, false,
    `in questo campione la correlazione corretta (${c.forbesRigobon.correlazioneCorretta}) non supera quella calma (${c.calma.correlazione})`);
});

test('MA LA COVARIANZA RADDOPPIA: è quella a decidere il rischio, e sale comunque', () => {
  const c = correlazioneCondizionata();
  assert.ok(c.covarianza.rapporto > 1.5,
    `il rischio combinato deve crescere molto: ${c.covarianza.rapporto}x`);
  assert.ok(c.volatilitaRapporto > 1.1);
  const t = diversificazioneText(c);
  assert.match(t, /piu' mosso/);
  assert.ok(!/correlazione|covarianza|eteroschedasticit/i.test(t), `gergo nel testo: ${t}`);
});

// ── Il bootstrap multivariato conserva la struttura fra settori ──

test('MULTIVARIATO: ricampionare gli stessi istanti conserva il legame fra settori', () => {
  const r = makeRng(11);
  const scen = bootstrapPanel(240, r);
  assert.equal(scen.perSettore.length, 9);
  assert.equal(scen.perSettore[0].r.length, 240);
  // Tutti i settori devono condividere gli stessi indici temporali: è
  // esattamente ciò che distingue un bootstrap multivariato da nove bootstrap
  // separati.
  assert.equal(scen.indici.length, 240);

  const corr = (a, b) => {
    const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
    return n / Math.sqrt(da * db);
  };
  // La correlazione fra due settori nello scenario ricampionato deve somigliare
  // a quella storica. Se ricampionassimo ogni settore per conto suo sarebbe ~0.
  const xlk = scen.perSettore.find((s) => s.simbolo === 'XLK').r;
  const xly = scen.perSettore.find((s) => s.simbolo === 'XLY').r;
  assert.ok(corr(xlk, xly) > 0.4, `correlazione conservata: ${corr(xlk, xly)}`);
});

test('nove bootstrap SEPARATI distruggerebbero la correlazione — la prova del contrario', () => {
  const r = makeRng(13);
  const a = bootstrapPanel(240, r).perSettore.find((s) => s.simbolo === 'XLK').r;
  const b = bootstrapPanel(240, r).perSettore.find((s) => s.simbolo === 'XLY').r;
  const corr = (x, y) => {
    const mx = x.reduce((p, q) => p + q, 0) / x.length, my = y.reduce((p, q) => p + q, 0) / y.length;
    let n = 0, dx = 0, dy = 0;
    for (let i = 0; i < x.length; i++) { const u = x[i] - mx, v = y[i] - my; n += u * v; dx += u * u; dy += v * v; }
    return n / Math.sqrt(dx * dy);
  };
  assert.ok(Math.abs(corr(a, b)) < 0.3, `estrazioni indipendenti perdono il legame: ${corr(a, b)}`);
});

test('il portafoglio equipesato è la media dei settori, e pesi diversi cambiano il risultato', () => {
  const scen = bootstrapPanel(60, makeRng(17));
  const eq = rendimentoPortafoglio(scen);
  const soloTech = rendimentoPortafoglio(scen, { XLK: 1 });
  assert.equal(eq.length, 60);
  const xlk = scen.perSettore.find((s) => s.simbolo === 'XLK').r;
  for (let i = 0; i < 60; i++) assert.ok(Math.abs(soloTech[i] - xlk[i]) < 1e-9);
  assert.ok(Math.abs(eq[0] - soloTech[0]) > 1e-9, 'un portafoglio diversificato non è il solo tech');
});

// ── Expected Shortfall, la misura che Basilea usa al posto del VaR ──

test('ES: guarda OLTRE la soglia, dove il VaR non guarda', () => {
  const es = expectedShortfall(rendimentoMercato());
  assert.equal(es.livello, LIVELLO_ES);
  assert.ok(es.es < es.var, 'la perdita media nella coda deve essere peggiore della soglia');
  assert.ok(es.quantoIlVarNonVede > 0, 'la differenza è esattamente ciò che il VaR ignora');
  assert.ok(es.peggiore <= es.es);
});

test('ES: con pochi dati non si finge una coda', () => {
  const r = expectedShortfall([0.01, -0.02, 0.03]);
  assert.equal(r.es, null);
  assert.match(r.motivo, /venti osservazioni/);
});

test('un portafoglio concentrato ha una coda peggiore di uno diversificato', () => {
  const scen = bootstrapPanel(3000, makeRng(19));
  const eq = expectedShortfall(rendimentoPortafoglio(scen));
  const tech = expectedShortfall(rendimentoPortafoglio(scen, { XLK: 1 }));
  assert.ok(tech.es < eq.es, `solo tech ${tech.es} deve avere una coda peggiore dell'equipesato ${eq.es}`);
});

// ── L'indice di stress, dai soli prezzi ──

test('l\'indice di stress sta fra 0 e 1 e dichiara le sue componenti', () => {
  const s = stressIndex();
  assert.ok(s.indice >= 0 && s.indice <= 1);
  assert.ok(['calmo', 'incerto', 'paura'].includes(s.stato));
  assert.ok(Number.isFinite(s.volatilitaPercentile) && Number.isFinite(s.correlazioneMedia));
  assert.ok(stressText(s).length > 20);
});

test('nei mesi delle crisi vere l\'indice DEVE essere alto — altrimenti non misura niente', () => {
  // Marzo 2009 (fondo della crisi) e marzo 2020 (COVID): l'indice calcolato
  // "fino a" quei mesi deve segnare paura. È il controllo di realtà.
  const p = pannello();
  const [annoA, meseA] = p.da.split('-').map(Number);
  const indiceDi = (aaaaMM) => {
    const [a, m] = aaaaMM.split('-').map(Number);
    return (a - annoA) * 12 + (m - meseA) + 1;
  };
  const crisi = stressIndex({ fino: indiceDi('2009-03') });
  const covid = stressIndex({ fino: indiceDi('2020-04') });
  const calmo = stressIndex({ fino: indiceDi('2017-06') });
  assert.ok(crisi.indice > 0.6, `marzo 2009 doveva segnare paura: ${crisi.indice}`);
  assert.ok(covid.indice > 0.6, `aprile 2020 doveva segnare paura: ${covid.indice}`);
  assert.ok(calmo.indice < crisi.indice && calmo.indice < covid.indice,
    `il 2017 doveva essere più calmo: ${calmo.indice}`);
});

// ── LA PARTE ONESTA: cosa prevede davvero ──

test('COSA PREVEDE DAVVERO: la turbolenza sì, la direzione no', () => {
  const c = cosaPrevede();
  assert.equal(c.valutabile, true);
  assert.ok(c.osservazioni > 250);
  assert.equal(c.prevedeVolatilita.significativa, true,
    `la paura deve annunciare altra turbolenza: correlazione ${c.prevedeVolatilita.correlazione}`);
  assert.equal(c.prevedeRendimento.significativa, false,
    `NON deve prevedere la direzione: correlazione ${c.prevedeRendimento.correlazione}. Se un giorno risultasse significativa, sospettare del metodo prima di crederci.`);
  assert.match(c.conclusione, /quanto ballerà, non da che parte andrà/);
});

test('il testo per la persona non promette mai una direzione', () => {
  for (const fino of [50, 130, 250, null]) {
    const t = stressText(stressIndex({ fino }));
    if (!t) continue;
    assert.ok(!/salir|scender|comprar|vender|opportunit/i.test(t), `il testo suggerisce una direzione: ${t}`);
  }
});
