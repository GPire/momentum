'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veglia, meritaNotifica, testoVeglia, SOGLIA_STRUTTURA } from './veglia.js';
import { GIORNALIERO_LUNGO, DATE_LUNGO, NOMI_LUNGO_GIORNI, serieComplete } from './daily-long.js';

const I2000 = DATE_LUNGO.findIndex((d) => d >= '2000-09-01');
const VIX = 'Indice della paura (VIX)';

// Costruisce le fonti come le vedeva l'app IN QUEL GIORNO: nessun dato
// successivo entra. Una veglia validata con dati futuri non è una veglia.
function fontiAl(data) {
  const fine = DATE_LUNGO.findIndex((d) => d >= data);
  const out = {};
  for (const [k, v] of Object.entries(serieComplete(I2000, 0.98))) {
    out[NOMI_LUNGO_GIORNI[k] || k] = v.slice(0, fine - I2000).map((x) => (x === null ? 0 : x));
  }
  return out;
}

const giro = (data) => veglia(fontiAl(data), {
  etichettaPeriodo: 'i dati fino a quel giorno',
  escludiDaStruttura: [VIX],
});

test('meno di tre fonti: nessun giro di controllo inventato', () => {
  const r = veglia({ a: [1, 2, 3], b: [1, 2, 3] });
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /almeno 3 fonti/);
});

// ── LA PROVA CHE CONTA: parla quando serve, tace quando non serve ──
test('COVID (20 marzo 2020): parla, e riconosce gli estremi veri', () => {
  const r = giro('2020-03-20');
  assert.equal(r.parla, true);
  assert.equal(meritaNotifica(r), true);
  const testi = r.osservazioni.map((o) => o.testo).join(' ');
  // Il VIX al suo massimo storico e le azioni al minimo: se una veglia non
  // vede questo, non vede niente.
  assert.match(testi, /paura \(VIX\).*più alta/);
  assert.match(testi, /S&P 500.*più bassa/);
  assert.ok(r.osservazioni.filter((o) => o.tipo === 'estremo').length >= 4);
});

test('LEHMAN (15 ottobre 2008): parla, e la coglie LA STRUTTURA, non i livelli', () => {
  // Il risultato che giustifica assorbimento.js. Nel pieno della crisi
  // finanziaria l'allarme non arriva dai livelli dei singoli indicatori ma
  // dal fatto che tutto si stava muovendo come una cosa sola: 72% di
  // direzione comune contro una media del 64%. È la diversificazione che
  // muore, e nessun indicatore di livello la vede.
  const r = giro('2008-10-15');
  assert.equal(r.parla, true);
  assert.equal(meritaNotifica(r), true);
  const struttura = r.osservazioni.find((o) => o.tipo === 'struttura');
  assert.ok(struttura, 'la struttura deve essere il segnale');
  assert.match(struttura.testo, /all'unisono molto più del solito/);
  assert.ok(r.struttura.spostamento >= SOGLIA_STRUTTURA, `spostamento ${r.struttura.spostamento}`);
});

test('PERIODI NORMALI: tace, ed è il comportamento voluto', () => {
  // Un sistema che parla da solo deve saper tacere. Ogni app di mercato
  // notifica qualcosa ogni giorno perché un'app silenziosa sembra rotta, e il
  // risultato è che l'utente spegne le notifiche — così quando arriva quella
  // che conta non la legge nessuno.
  for (const data of ['2011-08-10', '2015-06-01']) {
    const r = giro(data);
    assert.equal(r.parla, false, `ha parlato il ${data}: ${testoVeglia(r)}`);
    assert.equal(meritaNotifica(r), false);
  }
});

test('quando tace, DICE QUANTO HA GUARDATO per non dire niente', () => {
  // È la parte che rende il silenzio un'informazione invece di un'assenza.
  const r = giro('2015-06-01');
  assert.ok(r.controllate >= 8, `controllate ${r.controllate}`);
  assert.ok(r.efficaci < r.controllate, 'le direzioni distinte sono meno degli indicatori');
  const t = testoVeglia(r);
  assert.match(t, /Ho controllato \d+ indicatori/);
  assert.match(t, /direzioni davvero distinte/);
  assert.match(t, /quasi tutti i giorni/);
});

test('OGGI: il silenzio è la risposta predefinita', () => {
  const fonti = {};
  for (const [k, v] of Object.entries(serieComplete(I2000, 0.98))) {
    fonti[NOMI_LUNGO_GIORNI[k] || k] = v.map((x) => (x === null ? 0 : x));
  }
  const r = veglia(fonti, { escludiDaStruttura: [VIX] });
  assert.equal(r.disponibile, true);
  assert.equal(r.cieco, false, 'con 26 anni giornalieri la veglia deve poter vedere');
  // Non si asserisce che taccia — dipende dal giorno — ma che se parla lo
  // faccia con osservazioni complete di provenienza e limite.
  for (const o of r.osservazioni) {
    assert.ok(o.tipo && o.testo, 'ogni osservazione deve avere tipo e testo');
    assert.ok(Number.isFinite(o.guardate), 'e dichiarare quante cose sono state guardate');
  }
});

test('ogni osservazione porta il proprio limite: mai un allarme senza contesto', () => {
  const r = giro('2020-03-20');
  const struttura = giro('2008-10-15').osservazioni.find((o) => o.tipo === 'struttura');
  assert.match(struttura.limite, /non ha anticipato in modo affidabile/);
  for (const o of r.osservazioni) assert.ok(Number.isFinite(o.guardate));
});

test('un archivio CIECO non produce un silenzio rassicurante', () => {
  // Se la storia è troppo corta per accorgersi di qualcosa, tacere non
  // significa "va tutto bene": significa "non potrei vederlo". Le due cose
  // non vanno confuse, e il testo le distingue.
  const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rng = seme(3);
  const rumore = () => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;
  const fonti = {};
  for (let i = 0; i < 8; i++) fonti[`serie${i}`] = Array.from({ length: 300 }, () => rumore() * 0.02);
  const r = veglia(fonti, { etichettaPeriodo: 'trecento giorni' });
  assert.equal(r.cieco, true);
  assert.equal(r.parla, false);
  assert.match(testoVeglia(r), /il silenzio, qui, non è una rassicurazione/);
});

test('non si notifica per un risultato fragile', () => {
  // Interrompere una persona per qualcosa che non regge alla correzione più
  // severa è il modo di far spegnere le notifiche.
  const finto = {
    disponibile: true, parla: true,
    osservazioni: [{ tipo: 'estremo', testo: 'x', guardate: 10, limite: 'Non regge alla correzione più severa: da trattare come indicativo.' }],
  };
  assert.equal(meritaNotifica(finto), false);
});
