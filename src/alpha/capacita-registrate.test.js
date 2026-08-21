'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registraCapacitaCausali } from './capacita-registrate.js';
import { pianifica, azzeraRegistro, elencoCapacita } from '../ai/pianificatore.js';
import { creaInterrogazione } from '../ai/interrogazione.js';

test.beforeEach(() => { azzeraRegistro(); registraCapacitaCausali(); });

test('registra le 4 capacità attese', () => {
  const nomi = elencoCapacita().map((c) => c.nome).sort();
  assert.deepEqual(nomi, ['causale-settore-mercato', 'confronto-settori', 'deterioramento-contabile', 'validita-causale-serie']);
});

test('registraCapacitaCausali è idempotente: richiamarla non lancia e non duplica', () => {
  assert.doesNotThrow(() => registraCapacitaCausali());
  assert.equal(elencoCapacita().length, 4);
});

// ── confronto-settori: DATI VERI dei nove settori, non finti ──
test('confronto-settori: Tecnologia vs Energia, settori noti → risolto, con i 330 mesi VERI in comune (non 0)', () => {
  const q = creaInterrogazione({
    operazione: 'confronta', misura: 'rendimento',
    soggetti: [{ tipo: 'settore', id: 'XLK' }, { tipo: 'settore', id: 'Energia' }], // simbolo e nome, entrambi validi
  });
  const r = pianifica(q, {});
  assert.equal(r.risolto, true);
  assert.equal(r.capacita, 'confronto-settori');
  assert.deepEqual(r.risultato.soggetti, ['Tecnologia', 'Energia']);
  // La prova che le etichette mensili sono costruite correttamente dalla data
  // di inizio del pannello (DATE_PANNELLO): senza, mesiComuni() trova 0 mesi
  // in comune (bug reale trovato eseguendo questo collegamento dal vivo, non
  // dai test — confronta() vuole {mese,rendimento}, non un array grezzo).
  assert.equal(r.risultato.risultato.disponibile, true);
  assert.equal(r.risultato.risultato.mesiComuni, 330);
  assert.equal(r.risultato.risultato.da, '1999-02');
  assert.equal(typeof r.risultato.testo, 'string');
  assert.ok(r.risultato.testo.length > 20);
  assert.ok(!/0 mesi di storia in comune/.test(r.risultato.testo));
});

test('confronto-settori: un ticker sconosciuto (non è uno dei nove settori) → dati-insufficienti, non un crash', () => {
  const q = creaInterrogazione({
    operazione: 'confronta', misura: 'rendimento',
    soggetti: [{ tipo: 'settore', id: 'AAPL' }, { tipo: 'settore', id: 'XLK' }],
  });
  const r = pianifica(q, {});
  assert.equal(r.risolto, false);
  assert.equal(r.motivo, 'dati-insufficienti');
});

test('confronto-settori: un solo soggetto invece di due → dati-insufficienti (il confronto vuole una coppia)', () => {
  const q = creaInterrogazione({ operazione: 'confronta', misura: 'rendimento', soggetti: [{ tipo: 'settore', id: 'XLK' }] });
  assert.equal(pianifica(q, {}).risolto, false);
});

// ── causale-settore-mercato ──
test('causale-settore-mercato: un settore noto → risolto, con beta/alfa nel risultato', () => {
  const q = creaInterrogazione({ operazione: 'attribuisci', misura: 'causale', soggetti: [{ tipo: 'settore', id: 'XLF' }] });
  const r = pianifica(q, {});
  assert.equal(r.risolto, true);
  assert.ok(r.risultato.risultato); // l'oggetto di analizzaTitolo()
  assert.equal(typeof r.risultato.testo, 'string');
});

test('causale-settore-mercato: tipo "titolo" invece di "settore" → dati-insufficienti (il tipo conta)', () => {
  const q = creaInterrogazione({ operazione: 'attribuisci', misura: 'causale', soggetti: [{ tipo: 'titolo', id: 'XLF' }] });
  assert.equal(pianifica(q, {}).risolto, false);
});

// ── validita-causale-serie: sul mercato E su un settore ──
test('validita-causale-serie: "mercato" come soggetto speciale → risolto', () => {
  const q = creaInterrogazione({ operazione: 'spiega', misura: 'validita-causale', soggetti: [{ tipo: 'mercato', id: 'mercato' }] });
  const r = pianifica(q, {});
  assert.equal(r.risolto, true);
  assert.equal(typeof r.risultato.testo, 'string');
  assert.ok('problemi' in r.risultato.risultato);
});

test('validita-causale-serie: un settore reale → risolto', () => {
  const q = creaInterrogazione({ operazione: 'spiega', misura: 'validita-causale', soggetti: [{ tipo: 'settore', id: 'XLV' }] });
  assert.equal(pianifica(q, {}).risolto, true);
});

// ── deterioramento-contabile: nessun soggetto, sempre coperto ──
test('deterioramento-contabile: nessun soggetto richiesto → sempre risolto', () => {
  const q = creaInterrogazione({ operazione: 'spiega', misura: 'deterioramento' });
  const r = pianifica(q, {});
  assert.equal(r.risolto, true);
  assert.equal(typeof r.risultato.testo, 'string');
  // Il verdetto è già noto (negativo, documentato nel modulo): la capacità
  // deve restituirlo COSÌ com'è, non nasconderlo.
  assert.equal(typeof r.risultato.risultato.funziona, 'boolean');
});

test('deterioramento-contabile: vincoli.misuraBilancio seleziona la misura (roe vs margine)', () => {
  const qRoe = creaInterrogazione({ operazione: 'spiega', misura: 'deterioramento', vincoli: { misuraBilancio: 'roe' } });
  const qMargine = creaInterrogazione({ operazione: 'spiega', misura: 'deterioramento', vincoli: { misuraBilancio: 'margine' } });
  const rRoe = pianifica(qRoe, {});
  const rMargine = pianifica(qMargine, {});
  assert.equal(rRoe.risultato.risultato.misura, 'roe');
  assert.equal(rMargine.risultato.risultato.misura, 'margine');
});
