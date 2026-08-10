import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloLungo, rifugiNeiCrolli, statiStorici, matriceTransizione,
  simulaMultiStato, rendimentoScenario, confrontaPortafogli,
  settoriNeiCrolli, rifugiText, settoriText, ATTIVI, N_STATI,
} from './rifugi.js';
import { makeRng } from './forced-sale-risk.js';
import { LUNGO } from './long-asset-panel.js';

let _rif = null, _set = null;
const rif = () => (_rif ??= rifugiNeiCrolli());

// ── Il pannello, e i controlli che dicono se è credibile ──

test('quattrocento mesi, otto classi di investimento, quattro crisi diverse', () => {
  const p = pannelloLungo();
  assert.ok(p.mesi > 380, `mesi: ${p.mesi}`);
  assert.ok(p.da <= '1993-06' && p.a >= '2026-01');
  assert.equal(p.attivi.length, 8);
  assert.match(p.fonti, /FRED/);
});

test('i rendimenti ricostruiti dei titoli di Stato sono plausibili, non inventati', () => {
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = media(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  const b10 = LUNGO.titoliStato10a, b2 = LUNGO.titoliStato2a;
  // Un decennale rende più di un biennale e balla di più: se non fosse così,
  // la ricostruzione sarebbe sbagliata.
  assert.ok(media(b10) > media(b2), 'il decennale deve rendere di più');
  assert.ok(sd(b10) > sd(b2) * 2, 'e ballare molto di più');
  assert.ok(media(b10) * 12 > 0.01 && media(b10) * 12 < 0.09, `rendimento annuo ${media(b10) * 12}`);
  assert.ok(sd(b10) * Math.sqrt(12) < 0.15, 'la volatilità di un decennale non può essere da azionario');
});

test('la correlazione azioni-obbligazioni è vicina a zero: è il fatto che rende utile un portafoglio misto', () => {
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const cor = (a, b) => {
    const ma = media(a), mb = media(b);
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
    return n / Math.sqrt(da * db);
  };
  const c = cor(LUNGO.azioniUsa, LUNGO.titoliStato10a);
  assert.ok(Math.abs(c) < 0.35, `azioni-obbligazioni ${c}: doveva essere vicina a zero`);
});

// ── LA SMENTITA: l'oro non è un rifugio ──

test('L\'ORO NON PROTEGGE: nei mesi peggiori è una monetina', () => {
  const r = rif();
  const oro = r.classifica.find((x) => x.attivo === 'oro');
  assert.ok(oro.giudicabile);
  assert.equal(oro.rifugio, false,
    `oro: rendimento ${oro.rendimentoMedio}, positivo ${oro.quotaPositiva} delle volte`);
  assert.ok(oro.quotaPositiva < 0.6, `positivo solo il ${oro.quotaPositiva} delle volte`);
});

test('LE MATERIE PRIME AFFONDANO INSIEME ALLE AZIONI, non diversificano', () => {
  const r = rif();
  for (const a of ['materiePrime', 'rame']) {
    const x = r.classifica.find((c) => c.attivo === a);
    assert.ok(x.rendimentoMedio < 0, `${x.nome}: ${x.rendimentoMedio}`);
    assert.equal(x.affonda, true, `${x.nome} doveva risultare una zavorra`);
  }
});

test('I VERI RIFUGI sono i titoli di Stato e il dollaro', () => {
  const r = rif();
  assert.ok(r.rifugi.length >= 2, `rifugi trovati: ${JSON.stringify(r.rifugi)}`);
  const primi = r.classifica.slice(0, 2).map((x) => x.attivo);
  assert.ok(primi.includes('dollaro') || primi.includes('titoliStato10a'),
    `in cima alla classifica: ${JSON.stringify(primi)}`);
  assert.ok(r.azioniInQueiMesi < -0.05, 'i mesi considerati devono essere davvero brutti');
});

test('non si chiama rifugio un vantaggio dentro il rumore', () => {
  const r = rif();
  for (const x of r.classifica.filter((c) => c.rifugio)) {
    assert.ok(x.rendimentoMedio > 2 * x.errore,
      `${x.nome}: ${x.rendimentoMedio} contro un errore di ${x.errore}`);
  }
});

// ── Gli stati e le transizioni ──

test('tre stati bilanciati per costruzione, e oggi siamo in uno di essi', () => {
  const s = statiStorici();
  assert.equal(s.conteggio.length, N_STATI);
  const tot = s.conteggio.reduce((a, b) => a + b, 0);
  for (const c of s.conteggio) assert.ok(c > tot / 4, `stato poco popolato: ${JSON.stringify(s.conteggio)}`);
  assert.ok(s.oggi >= 0 && s.oggi < N_STATI);
});

test('I REGIMI NON SALTANO: dagli estremi non si passa direttamente', () => {
  const m = matriceTransizione();
  assert.ok(m.saltiDiretti < 0.02,
    `salti diretti fra estremi: ${m.saltiDiretti} — chi li simula simula un mondo mai esistito`);
  for (const p of m.persistenza) assert.ok(p > 0.7, `persistenza troppo bassa: ${JSON.stringify(m.persistenza)}`);
  // Ogni riga è una distribuzione di probabilità.
  for (const riga of m.probabilita) {
    assert.ok(Math.abs(riga.reduce((a, b) => a + b, 0) - 1) < 0.01);
  }
});

// ── La simulazione multi-stato ──

test('MULTI-STATO: gli scenari attraversano regimi diversi, non ne congelano uno', () => {
  const rng = makeRng(7);
  let cambi = 0, totali = 0;
  for (let k = 0; k < 50; k++) {
    const s = simulaMultiStato(60, rng);
    for (let t = 1; t < s.stati.length; t++) { totali++; if (s.stati[t] !== s.stati[t - 1]) cambi++; }
  }
  assert.ok(cambi > 0, 'gli scenari devono poter cambiare regime');
  assert.ok(cambi / totali < 0.4, 'ma non devono sfarfallare: i regimi sono persistenti');
});

test('MULTI-STATO: le correlazioni fra classi sono conservate per costruzione', () => {
  const rng = makeRng(11);
  const s = simulaMultiStato(400, rng);
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const cor = (a, b) => {
    const A = [], B = [];
    for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { A.push(a[i]); B.push(b[i]); }
    const ma = media(A), mb = media(B);
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < A.length; i++) { const x = A[i] - ma, y = B[i] - mb; n += x * y; da += x * x; db += y * y; }
    return n / Math.sqrt(da * db);
  };
  const simPetrolioMaterie = cor(s.percorso.map((m) => m.petrolio), s.percorso.map((m) => m.materiePrime));
  const veroPetrolioMaterie = cor(LUNGO.petrolio, LUNGO.materiePrime);
  assert.ok(Math.abs(simPetrolioMaterie - veroPetrolioMaterie) < 0.15,
    `simulata ${simPetrolioMaterie} contro reale ${veroPetrolioMaterie}`);
});

test('CONFRONTO FRA PORTAFOGLI sugli STESSI scenari: la fortuna del sorteggio non decide', () => {
  const r = confrontaPortafogli({
    tuttoAzioni: { azioniUsa: 1 },
    misto: { azioniUsa: 0.6, titoliStato10a: 0.4 },
    difensivo: { azioniUsa: 0.3, titoliStato10a: 0.5, dollaro: 0.2 },
  }, { mesi: 60, prove: 300, rngFactory: makeRng });

  assert.ok(r.tuttoAzioni.peggiorCaloGrave > r.misto.peggiorCaloGrave,
    `il portafoglio misto deve subire cali meno profondi: ${r.misto.peggiorCaloGrave} contro ${r.tuttoAzioni.peggiorCaloGrave}`);
  assert.ok(r.difensivo.peggiorCaloGrave < r.tuttoAzioni.peggiorCaloGrave);
  // E il prezzo di quella protezione deve essere visibile, non nascosto.
  assert.ok(r.tuttoAzioni.medianaFinale > r.difensivo.medianaFinale,
    'proteggersi costa rendimento: se non risultasse, il confronto sarebbe truccato');
});

test('un attivo senza dato in quel mese non partecipa invece di valere zero', () => {
  const rng = makeRng(3);
  const s = simulaMultiStato(24, rng);
  const soloOro = rendimentoScenario(s, { oro: 1 });
  assert.equal(soloOro.length, 24);
  for (const x of soloOro) assert.ok(Number.isFinite(x));
});

// ── Dentro le azioni: i settori ──

test('DENTRO LE AZIONI non scende tutto uguale: cinque punti fra il primo e l\'ultimo', async () => {
  const s = (_set ??= await settoriNeiCrolli());
  assert.ok(s.divario > 0.03, `divario fra migliore e peggiore: ${s.divario}`);
  assert.ok(s.mercatoInQueiMesi < -0.05);
  assert.equal(s.classifica.length, 9);
});

test('TENGONO i settori di cui non si può fare a meno, CEDONO quelli rimandabili', async () => {
  const s = (_set ??= await settoriNeiCrolli());
  const primi = s.classifica.slice(0, 3).map((x) => x.simbolo);
  // Beni di prima necessità, utility, salute: la spesa, la bolletta e le
  // medicine non si rimandano.
  assert.ok(primi.includes('XLP'), `in cima: ${JSON.stringify(primi)}`);
  assert.ok(primi.includes('XLU') || primi.includes('XLV'), `in cima: ${JSON.stringify(primi)}`);
  const ultimi = s.classifica.slice(-3).map((x) => x.simbolo);
  assert.ok(ultimi.includes('XLF') || ultimi.includes('XLK') || ultimi.includes('XLI'),
    `in fondo: ${JSON.stringify(ultimi)}`);
});

// ── Come si racconta ──

test('i testi spiegano il perché e non usano gergo', async () => {
  const t1 = rifugiText(rif());
  assert.match(t1, /monetina/);
  const t2 = settoriText(_set ??= await settoriNeiCrolli());
  assert.match(t2, /si vende per primo/);
  for (const t of [t1, t2]) {
    assert.ok(!/correlazione|volatilit|percentile|duration|Markov/i.test(t), `gergo: ${t}`);
    assert.ok(!/compra|vendi ora|conviene comprare/i.test(t), `indicazione operativa: ${t}`);
  }
});
