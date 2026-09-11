'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { episodiPattern, riassumiEpisodi, cosaSuccedeDopoAsset, patternStoricoText } from './pattern-storico.js';

test('episodiPattern: asset sconosciuto -> trovato false, mai un crash', () => {
  const r = episodiPattern('asset_mai_sentito');
  assert.equal(r.trovato, false);
  assert.match(r.motivo, /sconosciuto/);
});

test('episodiPattern: soglia non positiva -> trovato false', () => {
  const r = episodiPattern('azioniUsa', { soglia: 0 });
  assert.equal(r.trovato, false);
});

test('cosaSuccedeDopoAsset: su dati reali (azioniUsa, 40 anni) trova almeno il crollo dell\'ottobre 1987', () => {
  const r = cosaSuccedeDopoAsset('azioniUsa', { direzione: 'caduta', soglia: 0.10, finestraGiorni: 20, orizzonteGiorni: 20 });
  assert.equal(r.trovato, true);
  assert.ok(r.episodi.some((e) => e.dataTrigger.startsWith('1987-10')), 'deve trovare il crollo del 1987 fra gli episodi');
  assert.ok(r.riassunto.abbastanza, 'con 40 anni di dati ci sono abbastanza episodi di una caduta del 10%');
});

test('cosaSuccedeDopoAsset: soglia impossibile (200%) -> zero episodi, riassunto onestamente insufficiente', () => {
  const r = cosaSuccedeDopoAsset('azioniUsa', { direzione: 'caduta', soglia: 2.0, finestraGiorni: 20, orizzonteGiorni: 20 });
  assert.equal(r.episodi.length, 0);
  assert.equal(r.riassunto.abbastanza, false);
});

test('riassumiEpisodi: sotto la soglia minima di casi -> abbastanza false, nessuna statistica mostrata', () => {
  const pochi = [{ dopo: 0.1 }, { dopo: -0.05 }];
  const r = riassumiEpisodi(pochi, { minCasi: 10 });
  assert.equal(r.abbastanza, false);
  assert.equal(r.casi, 2);
  assert.equal(r.mediano, undefined);
});

test('riassumiEpisodi: mediano/decili/quota-in-guadagno calcolati correttamente su un campione costruito a mano', () => {
  // 10 episodi con esiti noti: 5 negativi, 5 positivi, ordinati.
  const episodi = [-0.20, -0.10, -0.05, -0.02, -0.01, 0.01, 0.02, 0.05, 0.10, 0.30].map((dopo, i) => ({
    dataTrigger: `2020-01-${String(i + 1).padStart(2, '0')}`, dopo,
  }));
  const r = riassumiEpisodi(episodi, { minCasi: 10 });
  assert.equal(r.abbastanza, true);
  assert.equal(r.casi, 10);
  assert.equal(r.quotaInGuadagno, 0.5); // 5 su 10 positivi
  // mediano: floor(0.5*10)=5 -> ord[5] = 0.01 (indice 0-based)
  assert.equal(r.mediano, 0.01);
  assert.equal(r.peggioreDecile, ord10pct(episodi));
});

function ord10pct(episodi) {
  const ord = episodi.map((e) => e.dopo).sort((a, b) => a - b);
  return +ord[Math.floor(0.1 * ord.length)].toFixed(4);
}

test('episodiPattern: episodi non sovrapposti per costruzione (un ribasso prolungato non genera decine di episodi quasi identici)', () => {
  const r = episodiPattern('azioniUsa', { direzione: 'caduta', soglia: 0.10, finestraGiorni: 20, orizzonteGiorni: 20 });
  for (let i = 1; i < r.episodi.length; i++) {
    const giorniFraTrigger = (new Date(r.episodi[i].dataTrigger) - new Date(r.episodi[i - 1].dataTrigger)) / 86400000;
    // Con episodi non sovrapposti la distanza minima fra due trigger consecutivi
    // è vicina all'orizzonte (20 giorni di borsa ~ 28 giorni di calendario);
    // qualunque distanza molto più corta indicherebbe sovrapposizione.
    assert.ok(giorniFraTrigger >= 20, `episodi troppo vicini: ${r.episodi[i - 1].dataTrigger} -> ${r.episodi[i].dataTrigger}`);
  }
});

test('patternStoricoText: mai le parole "compra"/"vendi"/"aspettati" — solo frequenza misurata, mai un consiglio', () => {
  const r = cosaSuccedeDopoAsset('azioniUsa', { direzione: 'caduta', soglia: 0.10, finestraGiorni: 20, orizzonteGiorni: 20 });
  const testo = patternStoricoText(r);
  assert.doesNotMatch(testo.toLowerCase(), /compra|vendi|aspettati|dovresti/);
  assert.match(testo, /non una previsione/);
});

test('patternStoricoText: caso senza abbastanza dati dichiara il numero minimo richiesto, mai una statistica finta', () => {
  const r = cosaSuccedeDopoAsset('azioniUsa', { direzione: 'caduta', soglia: 2.0, finestraGiorni: 20, orizzonteGiorni: 20 });
  const testo = patternStoricoText(r);
  assert.match(testo, /troppo pochi/);
});
