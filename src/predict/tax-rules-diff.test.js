'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffTaxRules, describeRulesChange } from './tax-rules-diff.js';

const BASE = {
  forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05,
  startupAnni: 5, inpsGestioneSeparata: 0.2607,
  irpefScaglioni: [{ fino: 28000, aliquota: 0.23 }, { fino: 50000, aliquota: 0.33 }, { fino: null, aliquota: 0.43 }],
  scadenze: [
    { id: 'saldo', label: 'Saldo e primo acconto', mese: 6, giorno: 30, quota: 0.5 },
    { id: 'acconto2', label: 'Secondo acconto', mese: 11, giorno: 30, quota: 0.5 },
  ],
};

test('nessun cambiamento -> nessun avviso (non si disturba per dire "e\' tutto uguale")', () => {
  assert.deepEqual(diffTaxRules(BASE, { ...BASE }), []);
  assert.equal(describeRulesChange(BASE, { ...BASE }), null);
});

test('il tetto forfettario che sale e\' detto come FAVOREVOLE', () => {
  const d = diffTaxRules(BASE, { ...BASE, forfettarioCeiling: 100000 });
  assert.equal(d.length, 1);
  assert.equal(d[0].favorevole, true);
  assert.match(d[0].testo, /tetto del regime forfettario sale da 85\.000 € a 100\.000 €/);
});

test('un\'imposta che sale e\' SFAVOREVOLE, e si dice comunque', () => {
  const d = diffTaxRules(BASE, { ...BASE, impostaStd: 0.20 });
  assert.equal(d[0].favorevole, false);
  assert.match(d[0].testo, /sale da 15% a 20%/);
});

test('un\'imposta che SCENDE e\' favorevole', () => {
  const d = diffTaxRules(BASE, { ...BASE, impostaStd: 0.12 });
  assert.equal(d[0].favorevole, true);
  assert.match(d[0].testo, /scende da 15% a 12%/);
});

test('IRPEF: un\'aliquota di scaglione cambiata viene detta con l\'ordinale giusto', () => {
  const nuovi = BASE.irpefScaglioni.map((s, i) => (i === 1 ? { ...s, aliquota: 0.35 } : s));
  const d = diffTaxRules(BASE, { ...BASE, irpefScaglioni: nuovi });
  assert.equal(d.length, 1);
  assert.match(d[0].testo, /secondo scaglione sale da 33% a 35%/);
});

test('IRPEF: un limite di scaglione spostato viene detto', () => {
  const nuovi = BASE.irpefScaglioni.map((s, i) => (i === 0 ? { ...s, fino: 30000 } : s));
  const d = diffTaxRules(BASE, { ...BASE, irpefScaglioni: nuovi });
  assert.match(d[0].testo, /limite del primo scaglione passa da 28\.000 € a 30\.000 €/);
});

test('IRPEF: cambiare il NUMERO di scaglioni e\' una notizia diversa (struttura, non aliquota)', () => {
  const d = diffTaxRules(BASE, { ...BASE, irpefScaglioni: [{ fino: null, aliquota: 0.25 }] });
  assert.match(d[0].testo, /da 3 a 1/);
  assert.match(d[0].testo, /struttura dell'imposta è cambiata/);
});

test('lo scaglione APERTO ("e oltre") non viene mai stampato come un numero', () => {
  const nuovi = BASE.irpefScaglioni.map((s, i) => (i === 2 ? { ...s, fino: 90000 } : s));
  const d = diffTaxRules(BASE, { ...BASE, irpefScaglioni: nuovi });
  assert.match(d[0].testo, /da in su a 90\.000 €/);
  assert.ok(!/null/.test(d[0].testo), 'mai un "null" a schermo');
});

test('SCADENZE: una data spostata viene detta', () => {
  const nuove = BASE.scadenze.map((s) => (s.id === 'acconto2' ? { ...s, mese: 12, giorno: 16 } : s));
  const d = diffTaxRules(BASE, { ...BASE, scadenze: nuove });
  assert.match(d[0].testo, /Secondo acconto si sposta dal 30\/11 al 16\/12/);
});

test('SCADENZE: una quota cambiata, una nuova e una sparita', () => {
  const nuove = [
    { ...BASE.scadenze[0], quota: 0.4 },
    { id: 'acconto3', label: 'Terzo acconto', mese: 3, giorno: 16, quota: 0.6 },
  ];
  const d = diffTaxRules(BASE, { ...BASE, scadenze: nuove });
  assert.match(d[0].testo, /passa dal 50% al 40%/);
  assert.match(d[0].testo, /una scadenza nuova: Terzo acconto/);
  assert.match(d[0].testo, /Secondo acconto non c'è più/);
});

test('piu\' cambiamenti insieme: il tono resta onesto quando ci sono entrambi i segni', () => {
  const r = describeRulesChange(BASE, { ...BASE, forfettarioCeiling: 100000, impostaStd: 0.20 });
  assert.equal(r.quanti, 2);
  assert.equal(r.tono, 'neutro', 'un cambiamento buono e uno cattivo insieme non vanno venduti come buoni');
  assert.match(r.titolo, /2 regole fiscali sono cambiate/);
});

test('la SINTESI dice la cosa concreta, non "una regola e\' cambiata"', () => {
  const r = describeRulesChange(BASE, { ...BASE, impostaStd: 0.12 });
  assert.match(r.sintesi, /scende da 15% a 12%/,
    'una notifica generica non fa aprire l\'app e non aiuta nessuno');
});

test('si avverte SEMPRE che i numeri gia\' visti non valgono piu\'', () => {
  const r = describeRulesChange(BASE, { ...BASE, impostaStd: 0.12 });
  assert.match(r.nota, /già ricalcolati/);
  assert.match(r.nota, /quello vecchio non vale più/);
});

test('input mancanti o malformati non esplodono', () => {
  for (const [a, b] of [[null, BASE], [BASE, null], [null, null], [undefined, undefined], [{}, {}]]) {
    assert.deepEqual(diffTaxRules(a, b), []);
    assert.equal(describeRulesChange(a, b), null);
  }
});

test('un campo assente da un lato non viene scambiato per un cambiamento', () => {
  const senzaStartup = { ...BASE };
  delete senzaStartup.impostaStartup;
  assert.deepEqual(diffTaxRules(senzaStartup, BASE), [],
    'un campo che compare per la prima volta non e\' "cambiato": non c\'e\' un prima con cui confrontarlo');
});

test('nessun testo verso l\'utente contiene gergo da programmatore', () => {
  const r = describeRulesChange(BASE, { ...BASE, impostaStd: 0.12, forfettarioCeiling: 90000 });
  const tutto = [r.titolo, r.sintesi, r.nota, ...r.cambi.map((c) => c.testo)].join(' ');
  assert.ok(!/override|payload|null|undefined|JSON|rules|NaN/i.test(tutto), tutto);
});

// ── IL CASO NORMALE, non quello raro: la legge che entra in vigore l'anno dopo ──
// Bug trovato dal vivo: l'aggiornamento veniva scaricato e adottato, e NESSUN
// avviso compariva, perche' il confronto guardava solo l'anno corrente mentre
// il payload cambiava l'anno successivo. La legge di bilancio si pubblica a
// dicembre per gennaio: guardare solo l'anno in corso rende invisibile
// esattamente il caso piu' frequente e piu' utile.
import { describeRulesChangeMultiAnno } from './tax-rules-diff.js';

test('IL BUG DAL VIVO: una regola che cambia l\'ANNO PROSSIMO viene detta ORA', () => {
  const snapPrima = { 2026: BASE, 2027: BASE };
  const snapDopo = { 2026: BASE, 2027: { ...BASE, impostaStd: 0.12 } };
  const r = describeRulesChangeMultiAnno(snapPrima, snapDopo, { annoCorrente: 2026 });
  assert.ok(r, 'senza questo, l\'utente lo scopre a gennaio quando non puo\' piu\' farci niente');
  assert.equal(r.soloFuturo, true);
  assert.match(r.titolo, /Dal 2027 cambiano le regole/);
  assert.match(r.cambi[0].testo, /^Dal 2027: l'imposta sostitutiva del forfettario scende/);
});

test('quando cambia solo il futuro, si dice che i numeri di ADESSO non cambiano', () => {
  const r = describeRulesChangeMultiAnno({ 2026: BASE, 2027: BASE }, { 2026: BASE, 2027: { ...BASE, impostaStd: 0.12 } }, { annoCorrente: 2026 });
  assert.match(r.nota, /non cambiano/);
  assert.match(r.nota, /ancora in tempo/);
});

test('un cambiamento GIA\' in vigore viene prima di uno futuro', () => {
  const snapPrima = { 2026: BASE, 2027: BASE };
  const snapDopo = { 2026: { ...BASE, forfettarioCeiling: 90000 }, 2027: { ...BASE, impostaStd: 0.12 } };
  const r = describeRulesChangeMultiAnno(snapPrima, snapDopo, { annoCorrente: 2026 });
  assert.equal(r.soloFuturo, false);
  assert.ok(!r.cambi[0].testo.startsWith('Dal '), 'cio\' che tocca i numeri di adesso viene per primo');
  assert.ok(r.cambi.some((c) => c.testo.startsWith('Dal 2027')), 'e il futuro si aggiunge, non sparisce');
  assert.match(r.nota, /già ricalcolati/);
});

test('il tempo verbale distingue "adesso" da "puoi ancora agire"', () => {
  const soloOra = describeRulesChangeMultiAnno({ 2026: BASE }, { 2026: { ...BASE, impostaStd: 0.12 } }, { annoCorrente: 2026 });
  assert.ok(!soloOra.cambi[0].testo.includes('Dal '));
  const soloPoi = describeRulesChangeMultiAnno({ 2027: BASE }, { 2027: { ...BASE, impostaStd: 0.12 } }, { annoCorrente: 2026 });
  assert.match(soloPoi.cambi[0].testo, /^Dal 2027:/);
});

test('nessun cambiamento su nessun anno -> nessun avviso', () => {
  assert.equal(describeRulesChangeMultiAnno({ 2026: BASE, 2027: BASE }, { 2026: BASE, 2027: BASE }, { annoCorrente: 2026 }), null);
  assert.equal(describeRulesChangeMultiAnno(null, null, { annoCorrente: 2026 }), null);
  assert.equal(describeRulesChangeMultiAnno({}, {}, { annoCorrente: 2026 }), null);
});

test('piu\' anni che cambiano insieme: si dicono tutti, in ordine di tempo', () => {
  const snapPrima = { 2026: BASE, 2027: BASE, 2028: BASE };
  const snapDopo = { 2026: BASE, 2027: { ...BASE, impostaStd: 0.12 }, 2028: { ...BASE, impostaStd: 0.10 } };
  const r = describeRulesChangeMultiAnno(snapPrima, snapDopo, { annoCorrente: 2026 });
  assert.deepEqual(r.anni, [2027, 2028]);
  assert.match(r.cambi[0].testo, /Dal 2027/);
  assert.match(r.cambi[1].testo, /Dal 2028/);
});
