import test from 'node:test';
import assert from 'node:assert/strict';
import { featureVisibili, analisiTensorVisibile, livelloConoscenza, automazioni } from './profilo-feature.js';

// ── Il principio numero uno: si nasconde solo con un segnale esplicito ──
test('chi non si è ancora espresso vede tutto: nessuna sezione decisa al posto suo', () => {
  const f = featureVisibili({});
  assert.equal(f.analisiTensor, true);
  assert.equal(f.criptovalute, true);
  assert.equal(f.editorStipendio, true);
  assert.equal(f.divisioneSpese, true);
});

test('"non investo" è una risposta vera e si rispetta ovunque, non solo sul tab', () => {
  const f = featureVisibili({ investmentPrefs: { invests: false } });
  assert.equal(f.analisiTensor, false);
  assert.equal(f.tesseraInvestito, false);
  assert.equal(f.criptovalute, false);
  // Ma resta tutto il resto: chi non investe ha comunque spese, gruppi, obiettivi.
  assert.equal(f.divisioneSpese, true);
  assert.equal(f.editorStipendio, true);
});

test('un minorenne non vede investimenti, cripto, stipendio né la proposta di partita IVA', () => {
  const f = featureVisibili({ onboardingProfile: { isMinor: true, ageBracket: 'under18' } });
  assert.equal(f.analisiTensor, false);
  assert.equal(f.criptovalute, false);
  assert.equal(f.editorStipendio, false);
  assert.equal(f.scopertaPartitaIva, false);
  // La divisione spese resta: è la cosa che un ragazzo usa davvero.
  assert.equal(f.divisioneSpese, true);
});

test('minorenne: le sezioni restano spente anche se `invests` non fosse impostato', () => {
  // Difesa in profondità: il gate età non deve dipendere da un secondo campo.
  const f = featureVisibili({ onboardingProfile: { ageBracket: 'under18' }, investmentPrefs: {} });
  assert.equal(f.analisiTensor, false);
});

test('chi ha già la partita IVA non vede più la card che gliela propone, ma vede quelle vere', () => {
  const senza = featureVisibili({});
  assert.equal(senza.scopertaPartitaIva, true);
  assert.equal(senza.cardFiscali, false);
  const con = featureVisibili({ taxRegime: 'forfettario' });
  assert.equal(con.scopertaPartitaIva, false);
  assert.equal(con.cardFiscali, true);
});

test('liquidità corta e entrate irregolari cambiano cosa va in primo piano', () => {
  const corto = featureVisibili({ investmentPrefs: { cashflowStress: 'corto' } });
  assert.equal(corto.cuscinettoInPrimoPiano, true);
  const irregolare = featureVisibili({ investmentPrefs: { incomeRegularity: 'irregolare' } });
  assert.equal(irregolare.previsioneCassaInPrimoPiano, true);
  const normale = featureVisibili({ investmentPrefs: { cashflowStress: 'ampio', incomeRegularity: 'regolare' } });
  assert.equal(normale.cuscinettoInPrimoPiano, false);
  assert.equal(normale.previsioneCassaInPrimoPiano, false);
});

test('le sezioni che seguono l\'uso compaiono quando la cosa esiste davvero', () => {
  assert.equal(featureVisibili({}).obiettivi, false);
  assert.equal(featureVisibili({ savingsGoals: [{ id: 1, name: 'Casa' }] }).obiettivi, true);
  assert.equal(featureVisibili({}).riepilogoGruppi, false);
  assert.equal(featureVisibili({ splitGroups: [{ id: 'g' }] }).riepilogoGruppi, true);
});

test('analisiTensorVisibile resta coerente con la mappa: una sola fonte, mai due', () => {
  const stati = [
    {},
    { investmentPrefs: { invests: false } },
    { onboardingProfile: { isMinor: true } },
    { investmentPrefs: { invests: true } },
  ];
  for (const s of stati) assert.equal(analisiTensorVisibile(s), featureVisibili(s).analisiTensor);
});

// ── Livello di conoscenza: stimato dai fatti, mai da una domanda in più ──
test('livello: si parte da principiante, e i FATTI fanno salire', () => {
  assert.equal(livelloConoscenza({}), 'principiante');
  assert.equal(livelloConoscenza({ positions: [{ ticker: 'AAPL' }] }), 'medio');
  assert.equal(livelloConoscenza({ positions: [{ ticker: 'AAPL' }], taxRegime: 'forfettario' }), 'esperto');
});

test('livello: minorenne e "non investo" restano principiante a prescindere dai segnali', () => {
  const ricco = { positions: [{ ticker: 'AAPL' }], taxRegime: 'forfettario' };
  assert.equal(livelloConoscenza({ ...ricco, onboardingProfile: { isMinor: true } }), 'principiante');
  assert.equal(livelloConoscenza({ ...ricco, investmentPrefs: { invests: false } }), 'principiante');
});

// ── Automazioni: meno attrito per chi inizia, più controllo per chi sa ──
test('automazioni: chi inizia riceve spiegazioni estese e vista essenziale', () => {
  const a = automazioni({});
  assert.equal(a.livello, 'principiante');
  assert.equal(a.spiegazioni, 'estese');
  assert.equal(a.vistaConsigliata, 'essenziale');
  assert.equal(a.autoRegistraRicorrenti, false); // niente automatismi prima della fiducia
});

test('automazioni: chi è esperto vede meno spiegazioni, vista completa e più controllo', () => {
  const a = automazioni({ positions: [{ ticker: 'AAPL' }], taxRegime: 'forfettario' });
  assert.equal(a.livello, 'esperto');
  assert.equal(a.spiegazioni, 'minime');
  assert.equal(a.vistaConsigliata, 'completo');
  assert.ok(a.sogliaAutoCategoria > automazioni({}).sogliaAutoCategoria,
    'chi sa correggere deve avere una soglia più alta, cioè meno automatismi silenziosi');
});

test('automazioni: con liquidità corta il promemoria cambia tema, non tono', () => {
  const a = automazioni({ investmentPrefs: { cashflowStress: 'corto' } });
  assert.equal(a.focusPromemoria, 'cuscinetto');
});

test('automazioni: nessuna conferma per ogni singola spesa, in nessun profilo', () => {
  // È l'attrito più citato nelle recensioni delle app di spese: non si
  // reintroduce per nessun tipo di utente.
  for (const s of [{}, { positions: [{ t: 1 }] }, { onboardingProfile: { isMinor: true } }]) {
    assert.equal(automazioni(s).confermaPerOgniSpesa, false);
  }
});
