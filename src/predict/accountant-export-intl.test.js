import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountantReportCh, buildAccountantReportEs, renderAccountantReportHTMLIntl } from './accountant-export-intl.js';
import { irpfEstatal, cuotaReta } from './tax-es.js';

test('export ES: 24000 annui non diventano 24000 mensili', () => {
  const tx = vault(Array.from({length:12},(_,i) => [`2026-${String(i+1).padStart(2,'0')}-10`,2000,'factura cliente']));
  const report = buildAccountantReportEs(tx,2026);
  assert.equal(report.incassato,24000);
  assert.equal(report.count,12);
  assert.equal(report.imposta.importo,irpfEstatal(24000));
  assert.equal(report.contributi[0].importo,+(cuotaReta(2000).cuotaMensual * 12).toFixed(2));
  assert.ok(report.noteOneste.some(n => /12 meses/.test(n)));
});

test('export ES: importi serializzati e centesimi mantengono il totale annuo', () => {
  const report = buildAccountantReportEs(vault([['2026-02-02','1000.01','factura'],['2026-03-03','2000.02','factura']]),2026);
  assert.equal(report.incassato,3000.03);
  assert.equal(report.imposta.importo,irpfEstatal(3000.03));
});

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

// Territorio foral (2026-09-06): País Vasco/Navarra hanno un sistema IRPF
// separato — l'export per il commercialista deve dirlo chiaro, mai
// includere un IRPF calcolato con scaglioni che non si applicano.
test('buildAccountantReportEs: territorio foral → nessuna voce imposta, RETA presente, nota esplicita', () => {
  const tx = vault([
    ['2026-02-05', 2000, 'factura cliente Bilbao'],
  ]);
  const r = buildAccountantReportEs(tx, 2026, { territorio: 'pais_vasco' });
  assert.equal(r.imposta, null, 'mai un IRPF calcolato con scaglioni statali per un territorio forale');
  assert.ok(r.contributi[0].importo > 0, 'la RETA resta corretta ovunque');
  assert.ok(r.noteOneste.some(n => /foral/i.test(n)));
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

// ── LINGUA (2026-09-14): un utente ticinese/romando ha la app in it/fr, non
// deve ricevere un documento forzato in tedesco — solo perché il Paese è CH
// non significa che la lingua dell'utente lo sia. Le ETICHETTE del documento
// seguono meta.lang; le note sostanziali (noteOneste, generate in tax-ch.js
// con importi/URL interpolati) restano in italiano — limite dichiarato, non
// tradotto di corsa (stesso principio già applicato a tax.js nel progetto). ──

test('renderAccountantReportHTMLIntl: CH con lang "it" → etichette in italiano, non tedesco forzato', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 8000, 'fattura'], ['2026-07-15', 8000, 'fattura'], ['2026-11-02', 8000, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Mario Rossi', lang: 'it' });
  assert.ok(html.includes('Riepilogo fiscale Mario Rossi'));
  assert.ok(!/Steuerübersicht/.test(html));
});

test('renderAccountantReportHTMLIntl: CH con lang "fr" → etichette in francese', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 8000, 'fattura'], ['2026-07-15', 8000, 'fattura'], ['2026-11-02', 8000, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Mario Rossi', lang: 'fr' });
  assert.ok(/Aperçu fiscal|Résumé fiscal/.test(html));
  assert.ok(!/Steuerübersicht/.test(html));
});

test('renderAccountantReportHTMLIntl: CH senza lang → resta tedesco (comportamento invariato, nessuna rottura per chi già chiama senza il parametro)', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 8000, 'fattura'], ['2026-07-15', 8000, 'fattura'], ['2026-11-02', 8000, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Mario Rossi' });
  assert.ok(/Steuerübersicht/.test(html));
});

test('renderAccountantReportHTMLIntl: lang non supportata → non si rompe, ricade sul default esistente', () => {
  const r = buildAccountantReportCh(vault([['2026-03-10', 8000, 'fattura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { lang: 'xx' });
  assert.ok(html.includes('<html'));
});

test('renderAccountantReportHTMLIntl: ES con lang "it" → etichette in italiano (non solo lo spagnolo hardcoded)', () => {
  const r = buildAccountantReportEs(vault([['2026-02-05', 2000, 'factura'], ['2026-05-05', 2000, 'factura']]), 2026);
  const html = renderAccountantReportHTMLIntl(r, { emitter: 'Ana García', lang: 'it' });
  assert.ok(html.includes('Riepilogo fiscale Ana García'));
});
