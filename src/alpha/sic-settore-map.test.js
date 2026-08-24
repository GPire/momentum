import test from 'node:test';
import assert from 'node:assert/strict';
import { sicASettoreETF, NOMI_SETTORE_SPDR } from './sic-settore-map.js';
import { AZIENDE_PANEL } from './panel-settoriale.js';

test('aziende REALI del pannello, verificate a mano una per una', () => {
  const attese = {
    AAPL: 'XLK', // Electronic Computers
    JPM: 'XLF', // National Commercial Banks
    CAT: 'XLI', // Construction Machinery
    TSLA: 'XLY', // Motor Vehicles
    MSFT: 'XLK', // Prepackaged Software
    PFE: 'XLV', // Pharmaceutical Preparations
  };
  for (const [ticker, atteso] of Object.entries(attese)) {
    const a = AZIENDE_PANEL.find((x) => x.ticker === ticker);
    assert.ok(a, `${ticker} deve essere nel pannello per questo test`);
    assert.equal(sicASettoreETF(a.sic), atteso, `${ticker} (SIC ${a.sic}, ${a.sicDescription})`);
  }
});

test('ECCEZIONE dichiarata: le assicurazioni sanitarie (SIC 6321-6324) vanno a Salute, non a Finanza — trovato su UnitedHealth', () => {
  const unh = AZIENDE_PANEL.find((a) => a.ticker === 'UNH');
  assert.ok(unh, 'UNH deve essere nel pannello per questo test');
  assert.equal(unh.sic, '6324');
  assert.equal(sicASettoreETF(unh.sic), 'XLV', 'un\'assicurazione sanitaria non è una banca');
  // Ma una banca vera nello stesso "cento" (60-67) resta Finanza.
  assert.equal(sicASettoreETF(6021), 'XLF');
});

test('ogni settore restituito è una delle 9 chiavi reali di historical-panel.js, mai un simbolo inventato', () => {
  const validi = new Set(Object.keys(NOMI_SETTORE_SPDR));
  assert.deepEqual([...validi].sort(), ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY']);
  for (const a of AZIENDE_PANEL) {
    if (!a.sic) continue;
    const s = sicASettoreETF(a.sic);
    if (s !== null) assert.ok(validi.has(s), `${a.ticker}: settore sconosciuto "${s}"`);
  }
});

test('input non valido o sconosciuto → null onesto, mai un settore a caso', () => {
  assert.equal(sicASettoreETF(null), null);
  assert.equal(sicASettoreETF(undefined), null);
  assert.equal(sicASettoreETF('non un codice'), null);
  assert.equal(sicASettoreETF(99999), null);
});

test('copertura reale sul pannello: la maggioranza delle aziende con SIC noto trova un settore', () => {
  let coperte = 0, tot = 0;
  for (const a of AZIENDE_PANEL) {
    if (!a.sic) continue;
    tot++;
    if (sicASettoreETF(a.sic)) coperte++;
  }
  assert.ok(tot > 0);
  assert.ok(coperte / tot > 0.7, `copertura troppo bassa: ${coperte}/${tot}`);
});
