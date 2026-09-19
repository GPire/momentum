import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTripAmountAnomalies } from './trip-anomaly.js';

function exp(id, tripCategory, amount, currency = 'EUR', businessTripId = 't1') {
  return { id, businessTripId, tripCategory, amount, currency, type: 'uscita' };
}

test('spesa molto sopra la propria media storica nella stessa categoria+valuta viene segnalata', () => {
  // Nota statistica (stesso limite del motore personale, non un bug qui):
  // con lo z-score "auto-inclusivo" (il punto anomalo entra anche nel
  // calcolo di media/deviazione standard), il valore massimo raggiungibile
  // da un solo outlier su n punti è sqrt(n-1) — con n=4 (il minimo
  // richiesto) non si può MAI superare la soglia 2.0, qualunque sia
  // l'importo. Servono almeno 6 spese storiche perché un vero outlier
  // possa emergere con questa soglia — coerente con l'onestà del segnale:
  // con troppo pochi dati, "anomalo" non è un giudizio difendibile.
  const storico = [
    exp(1, 'vitto', 30), exp(2, 'vitto', 32), exp(3, 'vitto', 28), exp(4, 'vitto', 31), exp(5, 'vitto', 29),
    exp(6, 'vitto', 900), // molto fuori norma
  ];
  const anomalie = detectTripAmountAnomalies(storico);
  assert.equal(anomalie.length, 1);
  assert.equal(anomalie[0].tx.id, 6);
  assert.ok(anomalie[0].zScore > 2);
});

test('meno di 4 spese nella stessa categoria+valuta: nessuna deviazione standard significativa, mai un falso segnale', () => {
  const storico = [exp(1, 'alloggio', 100), exp(2, 'alloggio', 500)];
  assert.equal(detectTripAmountAnomalies(storico).length, 0);
});

test('spese TUTTE uguali: deviazione standard zero, nessun crash né falso positivo', () => {
  const storico = [exp(1, 'trasporto', 20), exp(2, 'trasporto', 20), exp(3, 'trasporto', 20), exp(4, 'trasporto', 20)];
  assert.equal(detectTripAmountAnomalies(storico).length, 0);
});

test('stessa categoria ma valuta DIVERSA: confronto separato, mai mischiare scale diverse', () => {
  const storico = [
    exp(1, 'vitto', 30, 'EUR'), exp(2, 'vitto', 32, 'EUR'), exp(3, 'vitto', 28, 'EUR'), exp(4, 'vitto', 31, 'EUR'),
    exp(5, 'vitto', 40, 'USD'), exp(6, 'vitto', 42, 'USD'), exp(7, 'vitto', 38, 'USD'), exp(8, 'vitto', 41, 'USD'),
  ];
  // nessuna delle due valute ha un vero outlier al proprio interno
  assert.equal(detectTripAmountAnomalies(storico).length, 0);
});

test('categorie diverse hanno medie diverse: un importo normale per "alloggio" non diventa anomalo se confrontato con "vitto"', () => {
  const storico = [
    exp(1, 'vitto', 30), exp(2, 'vitto', 32), exp(3, 'vitto', 28), exp(4, 'vitto', 31),
    exp(5, 'alloggio', 120), exp(6, 'alloggio', 130), exp(7, 'alloggio', 125), exp(8, 'alloggio', 128),
  ];
  assert.equal(detectTripAmountAnomalies(storico).length, 0);
});

test('spese senza businessTripId (personali) o importo non positivo vengono ignorate, mai un crash', () => {
  const storico = [
    { id: 1, tripCategory: 'vitto', amount: 30, currency: 'EUR' }, // senza businessTripId
    exp(2, 'vitto', 0), exp(3, 'vitto', -10),
    exp(4, 'vitto', 30), exp(5, 'vitto', 32), exp(6, 'vitto', 28), exp(7, 'vitto', 31),
  ];
  assert.equal(detectTripAmountAnomalies(storico).length, 0);
});

test('soglia zThreshold personalizzabile, stessa disciplina del motore personale (mai un default diverso senza motivo)', () => {
  const storico = [exp(1, 'vitto', 30), exp(2, 'vitto', 32), exp(3, 'vitto', 28), exp(4, 'vitto', 60)];
  assert.equal(detectTripAmountAnomalies(storico, { zThreshold: 5 }).length, 0);
  assert.equal(detectTripAmountAnomalies(storico, { zThreshold: 0.5 }).length > 0, true);
});
