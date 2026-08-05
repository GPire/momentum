'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upcomingTaxDeadlines, taxDeadlinesToLedgerEvents, taxCashWarning, slittaSeFestivo,
  scadenzeForYear, SCADENZE_ANNUALI,
} from './tax-deadlines.js';
import { cashForecast } from './cash-forecast.js';
import { validateRulesPayload } from './tax-rules.js';

const MARZO = new Date(Date.UTC(2026, 2, 15)); // 15 marzo 2026

test('le scadenze sono quelle verificate: 30 giugno (saldo+1° acconto) e 30 novembre (2° acconto), 50%+50%', () => {
  assert.equal(SCADENZE_ANNUALI.length, 2);
  const giugno = SCADENZE_ANNUALI.find((s) => s.mese === 6);
  const novembre = SCADENZE_ANNUALI.find((s) => s.mese === 11);
  assert.equal(giugno.giorno, 30);
  assert.equal(novembre.giorno, 30);
  assert.equal(giugno.quota + novembre.quota, 1, 'gli acconti devono coprire il 100% del dovuto');
});

test('slittaSeFestivo: sabato → lunedì, domenica → lunedì, feriale invariato', () => {
  const sabato = new Date(Date.UTC(2026, 4, 30)); // 30 maggio 2026 = sabato
  assert.equal(slittaSeFestivo(sabato).getUTCDay(), 1);
  const domenica = new Date(Date.UTC(2026, 4, 31));
  assert.equal(slittaSeFestivo(domenica).getUTCDay(), 1);
  const mercoledi = new Date(Date.UTC(2026, 5, 3));
  assert.equal(slittaSeFestivo(mercoledi).getUTCDate(), 3, 'un giorno feriale non deve slittare');
});

test('upcomingTaxDeadlines: totale zero o assente → nessuna scadenza inventata', () => {
  assert.deepEqual(upcomingTaxDeadlines(0, { now: MARZO }), []);
  assert.deepEqual(upcomingTaxDeadlines(undefined, { now: MARZO }), []);
  assert.deepEqual(upcomingTaxDeadlines(NaN, { now: MARZO }), []);
});

test('upcomingTaxDeadlines: da marzo vede giugno e novembre dello stesso anno, in ordine', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  assert.equal(d.length, 2);
  assert.ok(d[0].date.startsWith('2026-06'));
  assert.ok(d[1].date.startsWith('2026-11'));
  assert.ok(d[0].ms < d[1].ms, 'devono essere ordinate nel tempo');
});

test('upcomingTaxDeadlines: gli importi si dividono 50/50 e sommano al totale', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  assert.equal(d[0].importo, 2000);
  assert.equal(d[1].importo, 2000);
  assert.equal(d[0].importo + d[1].importo, 4000);
});

test('upcomingTaxDeadlines: quanto già versato riduce gli importi futuri (mai allarmare per soldi già dati)', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO, giaVersato: 1000 });
  assert.equal(d[0].importo + d[1].importo, 3000);
});

test('upcomingTaxDeadlines: già versato tutto → nessuna scadenza residua', () => {
  assert.deepEqual(upcomingTaxDeadlines(4000, { now: MARZO, giaVersato: 4000 }), []);
});

test('upcomingTaxDeadlines: ogni scadenza è dichiarata STIMATA, mai un importo spacciato per certo', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  assert.ok(d.every((x) => x.stimato === true));
});

test('SCENARIO: da dicembre, la prossima scadenza è giugno dell\'anno DOPO (attraversa il cambio anno)', () => {
  const dicembre = new Date(Date.UTC(2026, 11, 10));
  const d = upcomingTaxDeadlines(4000, { now: dicembre });
  assert.ok(d.length >= 1);
  assert.ok(d[0].date.startsWith('2027-06'), `atteso giugno 2027, ricevuto ${d[0].date}`);
});

test('SCENARIO: il giorno DOPO una scadenza, quella non ricompare più', () => {
  const primoLuglio = new Date(Date.UTC(2026, 6, 1));
  const d = upcomingTaxDeadlines(4000, { now: primoLuglio });
  assert.ok(!d.some((x) => x.date.startsWith('2026-06')), 'una scadenza passata non deve restare in elenco');
});

// ── Il ponte verso la previsione di cassa ──

test('taxDeadlinesToLedgerEvents: importi NEGATIVI (sono uscite) e marcati come non certi nell\'importo', () => {
  const eventi = taxDeadlinesToLedgerEvents(upcomingTaxDeadlines(4000, { now: MARZO }));
  assert.equal(eventi.length, 2);
  assert.ok(eventi.every((e) => e.amount < 0), 'una scadenza fiscale è un\'uscita');
  assert.ok(eventi.every((e) => e.certain === false), 'l\'importo è una proiezione, non un impegno fisso');
  assert.ok(eventi.every((e) => e.kind === 'fisco'));
});

test('taxDeadlinesToLedgerEvents: lista vuota → nessun evento, nessun crash', () => {
  assert.deepEqual(taxDeadlinesToLedgerEvents([]), []);
  assert.deepEqual(taxDeadlinesToLedgerEvents(undefined), []);
});

test('INTEGRAZIONE: le scadenze fiscali entrano davvero in cashForecast e abbassano la cassa prevista', () => {
  const now = MARZO.getTime();
  const base = {
    allTx: {}, salary: { amount: 2500, dayOfMonth: 27 }, startBalance: 3000,
    now, horizonDays: 120,
  };
  const senzaFisco = cashForecast(base);
  const conFisco = cashForecast({
    ...base,
    extraLedgerEvents: taxDeadlinesToLedgerEvents(upcomingTaxDeadlines(4000, { now: MARZO })),
  });
  assert.ok(conFisco.end.p50 < senzaFisco.end.p50, 'con una scadenza da 2000 € la cassa a fine orizzonte deve essere più bassa');
});

// ── L'avviso predittivo ──

test('taxCashWarning: nessuna scadenza → nessun avviso inventato', () => {
  assert.equal(taxCashWarning([], null), null);
  assert.equal(taxCashWarning(undefined, null), null);
});

test('taxCashWarning: già accantonato abbastanza → messaggio tranquillizzante, nessun allarme', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  const w = taxCashWarning(d, null, { riservaGiaAccantonata: 5000 });
  assert.equal(w.urgenza, 'ok');
  assert.equal(w.perSettimana, 0);
  assert.match(w.messaggio, /Nessun pensiero/);
});

test('taxCashWarning: caso normale → piano settimanale concreto, tono calmo', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  const w = taxCashWarning(d, null);
  assert.equal(w.urgenza, 'media');
  assert.ok(w.perSettimana > 0);
  assert.match(w.messaggio, /a settimana/);
});

test('IL CASO CHE VALE TUTTO: cassa che va sotto PRIMA della scadenza → avviso alto con giorno critico e piano', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  const forecastConScoperto = { riskDay: { date: '2026-05-12', ms: Date.UTC(2026, 4, 12) } };
  const w = taxCashWarning(d, forecastConScoperto);
  assert.equal(w.urgenza, 'alta');
  assert.equal(w.giornoCritico, '2026-05-12');
  assert.match(w.messaggio, /12 maggio/);
  assert.match(w.messaggio, /rischi di restare senza/);
  assert.ok(w.perSettimana > 0, 'un avviso senza un piano concreto sarebbe solo ansia');
});

test('taxCashWarning: uno scoperto DOPO la scadenza non alza l\'urgenza (non c\'entra con questa scadenza)', () => {
  const d = upcomingTaxDeadlines(4000, { now: MARZO });
  const scopertoTardivo = { riskDay: { date: '2026-12-20', ms: Date.UTC(2026, 11, 20) } };
  const w = taxCashWarning(d, scopertoTardivo);
  assert.equal(w.urgenza, 'media');
});

test('taxCashWarning: il piano settimanale copre davvero l\'importo entro la scadenza (aritmetica verificata)', () => {
  const d = upcomingTaxDeadlines(5200, { now: MARZO });
  const w = taxCashWarning(d, null);
  const settimane = Math.max(1, Math.ceil(d[0].giorniMancanti / 7));
  assert.ok(w.perSettimana * settimane >= d[0].importo - 1, 'accantonando quella cifra ogni settimana si arriva coperti');
});

test('SCENARIO forfettario piccolo vs ordinario grande: entrambi producono un piano sensato, mai un crash', () => {
  for (const totale of [800, 4000, 45000, 200000]) {
    const d = upcomingTaxDeadlines(totale, { now: MARZO });
    const w = taxCashWarning(d, null);
    assert.ok(w && w.perSettimana >= 0, `fallito per totale ${totale}`);
    assert.ok(Number.isFinite(w.perSettimana), `NaN per totale ${totale}`);
  }
});

// ============================================================
// AUTO-AGGIORNAMENTO DELLE SCADENZE (richiesta esplicita dell'utente: "se
// passa del tempo e non aggiorno Momentum, deve prendere lo stesso i dati
// aggiornati per le scadenze fiscali"). Le scadenze vivono in tax-rules.js,
// quindi viaggiano sullo stesso canale firmato e validato già costruito per
// aliquote e tetti — nessun secondo meccanismo inventato.
// ============================================================

test('scadenzeForYear: senza override usa le scadenze verificate incluse nell\'app', () => {
  const s = scadenzeForYear(2026);
  assert.equal(s.length, 2);
  assert.ok(s.some((x) => x.mese === 6 && x.giorno === 30));
  assert.ok(s.some((x) => x.mese === 11 && x.giorno === 30));
});

test('AUTO-AGGIORNAMENTO: date cambiate da remoto → le scadenze seguono le nuove SENZA aggiornare l\'app', () => {
  // Scenario reale: una legge sposta il secondo acconto dal 30 novembre al
  // 16 dicembre. L'utente non ha aggiornato Momentum da mesi.
  const override = {
    rules: {
      2026: {
        forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.2607,
        scadenze: [
          { id: 'saldo-primo-acconto', mese: 6, giorno: 30, quota: 0.5, label: 'Saldo + primo acconto' },
          { id: 'secondo-acconto', mese: 12, giorno: 16, quota: 0.5, label: 'Secondo acconto' },
        ],
      },
    },
  };
  const d = upcomingTaxDeadlines(4000, { now: MARZO, rulesOverride: override });
  const secondo = d.find((x) => x.id.startsWith('secondo-acconto'));
  assert.ok(secondo.date.startsWith('2026-12-16'), `atteso 16 dicembre, ricevuto ${secondo.date}`);
});

test('AUTO-AGGIORNAMENTO: anche il numero di rate può cambiare (es. tre acconti invece di due)', () => {
  const override = {
    rules: {
      2026: {
        forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.2607,
        scadenze: [
          { id: 'r1', mese: 6, giorno: 30, quota: 0.4, label: 'Prima rata' },
          { id: 'r2', mese: 9, giorno: 30, quota: 0.3, label: 'Seconda rata' },
          { id: 'r3', mese: 11, giorno: 30, quota: 0.3, label: 'Terza rata' },
        ],
      },
    },
  };
  const d = upcomingTaxDeadlines(10000, { now: MARZO, rulesOverride: override });
  assert.equal(d.length, 3);
  const somma = d.reduce((s, x) => s + x.importo, 0);
  assert.ok(Math.abs(somma - 10000) < 1, 'le rate devono comunque coprire l\'intero dovuto');
});

test('ANTI-VELENO: scadenze remote con una data impossibile vengono RIFIUTATE prima di toccare i calcoli', () => {
  const payload = {
    version: '2099-01',
    rules: { 2099: {
      forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.26,
      scadenze: [{ id: 'x', mese: 13, giorno: 45, quota: 1, label: 'Mai esistita' }],
    } },
  };
  assert.equal(validateRulesPayload(payload).ok, false);
});

test('ANTI-VELENO: quote che non coprono il 100% vengono RIFIUTATE (farebbero sparire parte del dovuto)', () => {
  const payload = {
    version: '2099-01',
    rules: { 2099: {
      forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.26,
      scadenze: [{ id: 'x', mese: 6, giorno: 30, quota: 0.3, label: 'Solo un pezzo' }],
    } },
  };
  assert.equal(validateRulesPayload(payload).ok, false);
});

test('ANTI-VELENO: scadenze valide vengono accettate (il guardrail non blocca gli aggiornamenti legittimi)', () => {
  const payload = {
    version: '2099-01',
    rules: { 2099: {
      forfettarioCeiling: 85000, impostaStd: 0.15, impostaStartup: 0.05, inpsGestioneSeparata: 0.26,
      scadenze: [
        { id: 'a', mese: 6, giorno: 30, quota: 0.5, label: 'Prima' },
        { id: 'b', mese: 12, giorno: 16, quota: 0.5, label: 'Seconda' },
      ],
    } },
  };
  assert.equal(validateRulesPayload(payload).ok, true);
});

test('RETE DI SICUREZZA: un anno senza scadenze nelle regole ripiega sul default, mai un calendario vuoto', () => {
  // Il 2019 nelle regole non ha il campo `scadenze`: gli avvisi fiscali non
  // devono sparire in silenzio, sarebbe il peggior fallimento possibile.
  const s = scadenzeForYear(2019);
  assert.ok(s.length >= 2, 'senza scadenze note si usa comunque il default incluso');
});
