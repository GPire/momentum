import test from 'node:test';
import assert from 'node:assert/strict';
import { AZIENDE_PANEL, PERCENTILI_SETTORE, SEC_PANEL_AZIENDE_TOTALI_MERCATO, SEC_PANEL_MIN_BUCKET, percentileSettore } from './panel-settoriale.js';

// Integrità del dato generato (stesso spirito di historical-panel.test.js:
// un file GENERATO merita un controllo sui numeri, non solo sul codice che
// lo consuma — un bug nello script di fetch produrrebbe dati plausibili ma
// sbagliati, che nessun test sulla logica a valle scoprirebbe).

test('AZIENDE_PANEL: scala vera rispetto alle 82 aziende scelte a mano di fondamentali-storici.js', () => {
  assert.ok(AZIENDE_PANEL.length >= 400, `attese almeno 400 aziende pubblicate, trovate ${AZIENDE_PANEL.length}`);
  assert.ok(SEC_PANEL_AZIENDE_TOTALI_MERCATO > AZIENDE_PANEL.length, 'il totale di mercato dichiarato deve superare quello pubblicato per intero');
});

test('AZIENDE_PANEL: ogni azienda ha un settore SIC e almeno 3 anni (soglia minima del generatore)', () => {
  for (const a of AZIENDE_PANEL) {
    assert.ok(a.sic, `${a.nome} senza SIC`);
    assert.ok(a.anni.length >= 3, `${a.nome} con solo ${a.anni.length} anni`);
  }
});

test('AZIENDE_PANEL: nessun valore NaN/Infinity nei rapporti calcolati', () => {
  for (const a of AZIENDE_PANEL) {
    for (const riga of a.anni) {
      for (const misura of ['margine', 'roe', 'roa']) {
        if (riga[misura] !== null) assert.ok(Number.isFinite(riga[misura]), `${a.nome} ${riga.anno} ${misura} = ${riga[misura]}`);
      }
    }
  }
});

test('AZIENDE_PANEL: nessun duplicato di ticker fra le aziende pubblicate', () => {
  const tickers = AZIENDE_PANEL.map((a) => a.ticker).filter(Boolean);
  assert.equal(tickers.length, new Set(tickers).size);
});

test('PERCENTILI_SETTORE: ogni cella rispetta la soglia minima dichiarata e p10<=p25<=p50<=p75<=p90', () => {
  for (const [chiave, p] of Object.entries(PERCENTILI_SETTORE)) {
    assert.ok(p.n >= SEC_PANEL_MIN_BUCKET, `${chiave}: n=${p.n} sotto la soglia ${SEC_PANEL_MIN_BUCKET}`);
    assert.ok(p.p10 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90, `${chiave}: percentili non ordinati`);
  }
});

test('percentileSettore: un valore molto sopra il p90 del settore riceve 95, molto sotto il p10 riceve 10', () => {
  const [chiave, p] = Object.entries(PERCENTILI_SETTORE)[0];
  const [gruppo, anno, misura] = chiave.split('|');
  const alto = percentileSettore(`${gruppo}00`, +anno, misura, p.p90 + 1);
  const basso = percentileSettore(`${gruppo}00`, +anno, misura, p.p10 - 1);
  assert.equal(alto, 95);
  assert.equal(basso, 10);
});

test('percentileSettore: settore/anno senza abbastanza aziende ritorna null, mai un numero inventato', () => {
  assert.equal(percentileSettore('9999', 1901, 'roe', 0.1), null);
});
