import test from 'node:test';
import assert from 'node:assert/strict';
import { beneishMScore, piotroskiFScore, testoQualitaContabile } from './quality-scores.js';

// ── Beneish M-Score, validato su scenari calcolati A MANO (stessa
// disciplina di rumore-correlazione.js/E1: verità sintetica nota PRIMA di
// fidarsi dei dati veri) ──

const t1Flat = {
  ricavi: 1000, costoVenduto: 600, crediti: 100, attivo: 2000,
  attivoCorrente: 500, immobilizzazioniNette: 800, ammortamento: 100,
  speseSga: 200, passivoCorrente: 300, debitoLungo: 500,
  utileNetto: 150, flussoCassaOperativo: 150,
};
const tFlat = { ...t1Flat }; // anno identico: zero variazione, zero accrual

test('Beneish: un anno IDENTICO al precedente (zero variazione, zero accrual) → score sotto soglia, calcolato a mano ≈ -2,48', () => {
  const r = beneishMScore(tFlat, t1Flat);
  assert.equal(r.valido, true);
  // Ogni indice = 1 (nessuna variazione), TATA = 0: M = -4,84 + somma dei
  // coefficienti positivi (2,859) - somma dei negativi (0,499) = -2,481.
  assert.ok(Math.abs(r.score - (-2.481)) < 0.01, `score=${r.score}, atteso ≈ -2,481`);
  assert.equal(r.manipolazioneProbabile, false);
  for (const v of Object.values(r.componenti)) assert.ok(Math.abs(v) < 100); // nessun infinito/NaN travestito
});

test('Beneish: scenario da manuale con i segnali classici di manipolazione (crediti che crescono più delle vendite, margine in calo, utile senza cassa) → sopra soglia, calcolato a mano ≈ -0,42', () => {
  const t1 = t1Flat;
  const t = {
    ricavi: 1200, costoVenduto: 900, crediti: 250, attivo: 2200,
    attivoCorrente: 550, immobilizzazioniNette: 850, ammortamento: 110,
    speseSga: 220, passivoCorrente: 320, debitoLungo: 520,
    utileNetto: 200, flussoCassaOperativo: -50, // utile alto, CASSA NEGATIVA: il segnale classico
  };
  const r = beneishMScore(t, t1);
  assert.equal(r.valido, true);
  assert.ok(Math.abs(r.score - (-0.415)) < 0.02, `score=${r.score}, atteso ≈ -0,415`);
  assert.equal(r.manipolazioneProbabile, true, 'sopra -1,78: deve essere segnalato');
  assert.ok(r.componenti.dsri > 1.5, 'i crediti crescono molto più delle vendite');
  assert.ok(r.componenti.tata > 0.05, 'accrual ampio: utile riportato molto sopra la cassa vera');
});

test('Beneish: aziende finanziarie dichiarate NON applicabili, mai un numero fuorviante', () => {
  const r = beneishMScore(tFlat, t1Flat, { sic: 6022 }); // banche statali
  assert.equal(r.applicabile, false);
  assert.equal(r.valido, false);
  assert.match(r.motivo, /finanziarie/);
});

test('Beneish: dati mancanti dichiarati per nome, mai un punteggio con NaN dentro', () => {
  const t1 = { ...t1Flat };
  const t = { ...tFlat, costoVenduto: undefined }; // manca il costo del venduto
  const r = beneishMScore(t, t1);
  assert.equal(r.valido, false);
  assert.match(r.motivo, /gmi/);
});

test('Beneish: un solo anno (nessun precedente) → non calcolabile, mai una divisione per un anno inventato', () => {
  assert.equal(beneishMScore(tFlat, null).valido, false);
  assert.equal(beneishMScore(null, t1Flat).valido, false);
});

// ── Piotroski F-Score ──

test('Piotroski: anno IDENTICO al precedente → solo i 2 criteri "assoluti" (ROA e CFO positivi) contano, punteggio 2/8', () => {
  const r = piotroskiFScore(tFlat, t1Flat);
  assert.equal(r.valido, true);
  assert.equal(r.puntiMassimi, 8);
  assert.equal(r.punteggio, 2);
  assert.equal(r.criteri.roaPositiva, true);
  assert.equal(r.criteri.cfoPositivo, true);
  assert.equal(r.criteri.roaInCrescita, false, 'nessuna crescita: uguale non è "in crescita"');
});

test('Piotroski: azienda sana che migliora su tutti i fronti (calcolato a mano) → 8/8', () => {
  const t1 = {
    ricavi: 1000, costoVenduto: 650, utileNetto: 80, attivo: 2000,
    attivoCorrente: 500, passivoCorrente: 400, debitoLungo: 600, flussoCassaOperativo: 100,
  };
  const t = {
    ricavi: 1100, costoVenduto: 693, utileNetto: 110, attivo: 2100,
    attivoCorrente: 600, passivoCorrente: 380, debitoLungo: 550, flussoCassaOperativo: 140,
  };
  const r = piotroskiFScore(t, t1);
  assert.equal(r.valido, true);
  assert.equal(r.punteggio, 8);
  assert.ok(Object.values(r.criteri).every(Boolean), `criteri: ${JSON.stringify(r.criteri)}`);
});

test('Piotroski: dichiara SEMPRE il limite di 8 punti su 9 (manca il criterio di nuova emissione azioni)', () => {
  const r = piotroskiFScore(tFlat, t1Flat);
  assert.ok(r.limiti.some((l) => /nuova emissione/.test(l)));
  assert.equal(r.puntiMassimi, 8, 'mai promesso un 9° punto che non viene calcolato');
});

test('Piotroski: aziende finanziarie dichiarate NON applicabili', () => {
  const r = piotroskiFScore(tFlat, t1Flat, { sic: 6311 }); // assicurazioni vita
  assert.equal(r.applicabile, false);
  assert.equal(r.valido, false);
});

test('Piotroski: dati mancanti dichiarati per nome', () => {
  const t = { ...tFlat, attivoCorrente: undefined };
  const r = piotroskiFScore(t, t1Flat);
  assert.equal(r.valido, false);
  assert.match(r.motivo, /correnteT\b/);
});

// ── testoQualitaContabile: onestà su un limite REALE trovato sui dati veri (NVIDIA) ──

test('testoQualitaContabile: segnalazione Beneish con crescita ricavi molto alta (SGI>1,5) porta SEMPRE l\'avviso sul falso positivo — trovato su NVDA reale', () => {
  const r = {
    disponibile: true,
    beneish: { valido: true, score: -1.2, manipolazioneProbabile: true, soglia: -1.78, componenti: { sgi: 1.65 } },
    piotroski: { valido: true, punteggio: 2, puntiMassimi: 8 },
  };
  const t = testoQualitaContabile(r);
  assert.match(t, /limite noto/);
  assert.match(t, /crescita del tutto legittima/);
});

test('testoQualitaContabile: segnalazione Beneish SENZA crescita esplosiva non porta l\'avviso (sarebbe fuori luogo, non ogni segnalazione è quel caso)', () => {
  const r = {
    disponibile: true,
    beneish: { valido: true, score: -1.2, manipolazioneProbabile: true, soglia: -1.78, componenti: { sgi: 1.05 } },
  };
  const t = testoQualitaContabile(r);
  assert.ok(!/limite noto/.test(t));
});

test('testoQualitaContabile: senza segnalazione (nella norma), nessun avviso di falso positivo — non c\'è nulla da spiegare', () => {
  const r = { disponibile: true, beneish: { valido: true, score: -2.5, manipolazioneProbabile: false, soglia: -1.78 } };
  const t = testoQualitaContabile(r);
  assert.match(t, /nella norma/);
  assert.ok(!/limite noto/.test(t));
});
