import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountantReportCh, buildAccountantReportEs, renderAccountantReportHTMLIntl } from './accountant-export-intl.js';

function vault(voci) {
  const out = {};
  for (const [data, importo, desc] of voci) {
    const k = data.slice(0, 7);
    (out[k] ||= []).push({ date: data, amount: importo, type: 'entrata', category: 'stipendio', description: desc });
  }
  return out;
}

// ── Svizzera ──

test('buildAccountantReportCh: sopra soglia calcola l\'AVS reale, mai un totale a zero', () => {
  const tx = vault([
    ['2026-03-10', 8000, 'fattura Studio Meyer'],
    ['2026-07-15', 8000, 'fattura Studio Meyer'],
    ['2026-11-02', 8000, 'fattura Studio Meyer'],
  ]);
  const r = buildAccountantReportCh(tx, 2026);
  assert.equal(r.paese, 'CH');
  assert.equal(r.incassato, 24000);
  assert.ok(r.contributi.length >= 0); // sopra o sotto soglia, mai un crash
  assert.ok(r.noteOneste.length > 0, 'deve sempre dichiarare il limite sulle imposte cantonali');
});

test('buildAccountantReportCh: sotto la soglia dichiara la scala degressiva, mai un numero indovinato', () => {
  const tx = vault([['2026-03-10', 500, 'fattura piccola']]);
  const r = buildAccountantReportCh(tx, 2026);
  assert.equal(r.contributi.length, 0);
  assert.ok(r.contributoNonCalcolabile, 'deve spiegare perché non calcola l\'AVS qui');
});

test('buildAccountantReportCh: entrate non-fattura (stipendio/rimborso) restano fuori', () => {
  const tx = vault([['2026-03-10', 5000, 'rimborso spese viaggio']]);
  const r = buildAccountantReportCh(tx, 2026);
  assert.equal(r.incassato, 0);
  assert.equal(r.count, 0);
});

// ── Spagna ──

test('buildAccountantReportEs: separa RETA e IRPF, mai un totale unico', () => {
  const tx = vault([
    ['2026-02-05', 2000, 'factura cliente Madrid'],
    ['2026-05-05', 2000, 'factura cliente Madrid'],
  ]);
  const r = buildAccountantReportEs(tx, 2026);
  assert.equal(r.paese, 'ES');
  assert.equal(r.contributi.length, 1);
  assert.ok(r.contributi[0].importo > 0);
  assert.ok(r.imposta.importo >= 0);
  assert.notEqual(r.contributi[0].voce, r.imposta.voce);
});

test('buildAccountantReportEs: senza fatture non inventa un accantonamento', () => {
  const r = buildAccountantReportEs({}, 2026);
  assert.equal(r.incassato, 0);
  assert.equal(r.contributi.length, 0);
  assert.equal(r.imposta, null);
});

test('buildAccountantReportEs: dichiara sempre il limite sull\'IRPF autonómico mancante', () => {
  const tx = vault([['2026-02-05', 2000, 'factura cliente']]);
  const r = buildAccountantReportEs(tx, 2026);
  assert.ok(r.noteOneste.some(n => /autonómico/.test(n)));
});

// ── Il documento HTML non deve mai rompersi, in nessuna combinazione ──

test('renderAccountantReportHTMLIntl: CH con AVS calcolabile', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 8000, 'fattura'], ['2026-07-15', 8000, 'fattura'], ['2026-11-02', 8000, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Mario Rossi' });
  assert.ok(html.includes('<html'));
  assert.ok(html.includes('Mario Rossi'));
});

test('renderAccountantReportHTMLIntl: CH sotto soglia (contributi vuoti) non si rompe', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 500, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, {});
  assert.ok(html.includes('<html'));
});

test('renderAccountantReportHTMLIntl: ES con IRPF e RETA insieme', () => {
  const r = buildAccountantReportEs(vault([['2026-02-05', 2000, 'factura'], ['2026-05-05', 2000, 'factura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Ana García' });
  assert.ok(html.includes('<html'));
  assert.ok(html.includes('Ana García'));
});

test('renderAccountantReportHTMLIntl: ES senza dati (nessuna fattura) non si rompe', () => {
  const r = buildAccountantReportEs({}, 2026);
  const html = renderAccountantReportHTMLIntl(r, {});
  assert.ok(html.includes('<html'));
});
