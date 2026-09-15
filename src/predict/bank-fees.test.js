'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classificaCommissione, detectBankFees, bankFeesSummary, BANK_FEE_PATTERNS } from './bank-fees.js';

function uscita(desc, amount = 3, date = '2026-03-10') {
  return { type: 'uscita', description: desc, amount, date };
}
function entrata(desc, amount = 3, date = '2026-03-10') {
  return { type: 'entrata', description: desc, amount, date };
}

test('classificaCommissione: riconosce il canone conto', () => {
  const r = classificaCommissione('CANONE MENSILE CONTO CORRENTE');
  assert.equal(r.id, 'canone_conto');
});

test('classificaCommissione: imposta di bollo è marcata come tassa di stato, non commissione bancaria', () => {
  const r = classificaCommissione('IMPOSTA DI BOLLO SU ESTRATTO CONTO');
  assert.equal(r.id, 'bollo');
  assert.equal(r.tassaStatale, true);
});

test('classificaCommissione: descrizione normale (spesa reale) non è mai una commissione', () => {
  assert.equal(classificaCommissione('Esselunga spesa settimanale'), null);
  assert.equal(classificaCommissione('Stipendio mensile'), null);
});

test('classificaCommissione: nessun match su descrizione vuota, mai un\'eccezione', () => {
  assert.equal(classificaCommissione(''), null);
  assert.equal(classificaCommissione(null), null);
  assert.equal(classificaCommissione(undefined), null);
});

test('classificaCommissione: copre inglese e spagnolo, stesso principio già in uso nel lexicon', () => {
  assert.equal(classificaCommissione('Monthly account maintenance fee').id, 'canone_conto');
  assert.equal(classificaCommissione('Comisión de mantenimiento mensual').id, 'canone_conto');
});

test('detectBankFees: ignora le entrate, mai un\'entrata classificata come commissione', () => {
  const r = detectBankFees([entrata('commissione bonifico ricevuto', 5), uscita('commissione bonifico', 5)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].patternId, 'commissione_bonifico');
});

test('detectBankFees: ogni transazione matcha UNA sola regola (la più specifica), mai un doppio conteggio', () => {
  // "canone carta" contiene "carta" ma NON deve mai matchare "commissione_generica"
  // per una sola descrizione: classificaCommissione ritorna una sola regola.
  const r = classificaCommissione('Canone carta di debito');
  assert.equal(r.id, 'canone_carta');
});

test('bankFeesSummary: somma le commissioni vere, separate dalla tassa di stato (bollo)', () => {
  const txs = [
    uscita('Canone mensile conto corrente', 5),
    uscita('Imposta di bollo su estratto conto', 34.20, '2026-01-15'),
    uscita('Commissione prelievo ATM fuori rete', 2),
    entrata('Stipendio', 2000),
  ];
  const s = bankFeesSummary(txs);
  assert.equal(s.totaleCommissioni, 7);
  assert.equal(s.totaleTasseStato, 34.20);
  assert.equal(s.conteggioCommissioni, 2);
});

test('bankFeesSummary: perTipo raggruppa e ordina per totale decrescente', () => {
  const txs = [
    uscita('Commissione bonifico', 5),
    uscita('Commissione bonifico', 5),
    uscita('Canone mensile conto corrente', 8),
  ];
  const s = bankFeesSummary(txs);
  assert.equal(s.perTipo[0].id, 'commissione_bonifico');
  assert.equal(s.perTipo[0].totale, 10);
  assert.equal(s.perTipo[0].conteggio, 2);
  assert.equal(s.perTipo[1].id, 'canone_conto');
});

test('bankFeesSummary: filtro per anno, mai una commissione di un altro anno mescolata', () => {
  const txs = [
    uscita('Canone mensile conto corrente', 5, '2025-06-01'),
    uscita('Canone mensile conto corrente', 6, '2026-06-01'),
  ];
  const s2026 = bankFeesSummary(txs, { year: 2026 });
  assert.equal(s2026.totaleCommissioni, 6);
  const s2025 = bankFeesSummary(txs, { year: 2025 });
  assert.equal(s2025.totaleCommissioni, 5);
});

test('bankFeesSummary: nessuna transazione, mai un\'eccezione, tutto a zero onestamente', () => {
  const s = bankFeesSummary([]);
  assert.equal(s.totaleCommissioni, 0);
  assert.equal(s.totaleTasseStato, 0);
  assert.deepEqual(s.perTipo, []);
});

test('BANK_FEE_PATTERNS: ogni regola dichiara se è una tassa di stato, mai un valore implicito', () => {
  for (const r of BANK_FEE_PATTERNS) {
    assert.equal(typeof r.tassaStatale, 'boolean', `${r.id} deve dichiarare tassaStatale esplicitamente`);
  }
});
