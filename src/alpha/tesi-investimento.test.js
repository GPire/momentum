'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registraTesi, verificaTesi, testoTesi, PRIMA_DI_COMPRARE, testoPrimaDiComprare,
  tesiDaiBilanci, storiaDellaTesi, testoStoriaTesi,
} from './tesi-investimento.js';

// Un'azienda di qualità comprata quando i conti erano buoni.
const ACQUISTO = {
  Name: 'Esempio', Sector: 'Technology',
  PERatio: '14.0', PriceToBookRatio: '1.3', PEGRatio: '0.9',
  ReturnOnEquityTTM: '0.22', ProfitMargin: '0.18', ReturnOnAssetsTTM: '0.11',
};

test('la tesi registra SOLO i criteri che erano veri all\'acquisto', () => {
  // Gli altri non c'erano nemmeno all'inizio: lamentarsi che manchino oggi
  // sarebbe inventare un deterioramento che non è avvenuto.
  const t = registraTesi(ACQUISTO, { data: '2024-01-15' });
  assert.equal(t.completa, true);
  assert.ok(t.ragioni.includes('roeAlto'));
  assert.ok(t.ragioni.includes('peBasso'));
  assert.equal(t.data, '2024-01-15');
  assert.equal(t.nome, 'Esempio');
});

test('nessun criterio soddisfatto all\'acquisto: nessuna tesi da controllare', () => {
  // E lo si dice, invece di costruirne una a posteriori.
  const t = registraTesi({ Name: 'Cara', PERatio: '90', PriceToBookRatio: '30', PEGRatio: '8', ReturnOnEquityTTM: '0.01', ProfitMargin: '0.01', ReturnOnAssetsTTM: '0.005' });
  assert.equal(t.completa, false);
  assert.match(t.motivo, /a posteriori/);
  assert.equal(verificaTesi(t, ACQUISTO).disponibile, false);
});

test('TESI INTATTA: i conti reggono, e si dice così', () => {
  const t = registraTesi(ACQUISTO);
  const v = verificaTesi(t, ACQUISTO);
  assert.equal(v.tesiIntatta, true);
  assert.equal(v.rotte.length, 0);
  assert.equal(v.quotaIntatta, 100);
  assert.match(testoTesi(v), /valgono ancora tutte/);
});

test('TESI ROTTA: il ROE crolla e viene detto col numero, non con un allarme', () => {
  const t = registraTesi(ACQUISTO);
  const oggi = { ...ACQUISTO, ReturnOnEquityTTM: '0.04', ProfitMargin: '0.02' };
  const v = verificaTesi(t, oggi);
  assert.equal(v.tesiIntatta, false);
  const roe = v.rotte.find((x) => x.id === 'roeAlto');
  assert.ok(roe, 'il ROE deve risultare rotto');
  assert.equal(roe.prima, 0.22);
  assert.equal(roe.adesso, 0.04);
  const t2 = testoTesi(v);
  assert.match(t2, /era 0\.22, adesso 0\.04/);
  assert.ok(!/\b(vendi|esci|liquida|allarme|pericolo)\b/i.test(t2), t2);
});

test('IL PREZZO NON ENTRA: è la scelta più importante del modulo', () => {
  // Un calo del prezzo fa scendere il P/E e SALIRE il P/B... cioè può
  // perfino MIGLIORARE i criteri di Graham. Ma non cambia niente su quanto
  // l'azienda guadagna. Un modulo che confondesse le due cose farebbe
  // vendere nel momento peggiore.
  const t = registraTesi(ACQUISTO);
  const dimezzato = { ...ACQUISTO, PERatio: '7.0', PriceToBookRatio: '0.65' };
  const v = verificaTesi(t, dimezzato);
  assert.equal(v.tesiIntatta, true, 'un prezzo dimezzato non rompe la tesi');
  assert.match(testoTesi(v), /Il prezzo non entra in questo conto/);
});

test('un dato che SPARISCE non è un dato peggiorato', () => {
  const t = registraTesi(ACQUISTO);
  const senzaRoe = { ...ACQUISTO, ReturnOnEquityTTM: 'None' };
  const v = verificaTesi(t, senzaRoe);
  assert.equal(v.rotte.find((x) => x.id === 'roeAlto'), undefined, 'non deve contare come rotto');
  assert.ok(v.nonPiuMisurabili.some((x) => x.id === 'roeAlto'));
  assert.match(testoTesi(v), /non e' un dato peggiorato/);
});

test('TESI SVUOTATA: tutte le ragioni cadute', () => {
  const t = registraTesi(ACQUISTO);
  const disastro = { ...ACQUISTO, PERatio: '95', PriceToBookRatio: '40', PEGRatio: '9', ReturnOnEquityTTM: '0.01', ProfitMargin: '0.005', ReturnOnAssetsTTM: '0.002' };
  const v = verificaTesi(t, disastro);
  assert.equal(v.tesiSvuotata, true);
  assert.equal(v.regge.length, 0);
  assert.match(testoTesi(v), /Nessuna delle/);
});

test('il testo NON dice mai cosa fare', () => {
  const t = registraTesi(ACQUISTO);
  const v = verificaTesi(t, { ...ACQUISTO, ReturnOnEquityTTM: '0.03' });
  const testo = testoTesi(v);
  // Solo le forme IMPERATIVE rivolte all'utente. "il prezzo non entra in
  // questo conto" e "fa vendere nel momento sbagliato" sono spiegazioni, non
  // istruzioni: un controllo troppo grezzo le scambierebbe per consigli e
  // costringerebbe a scrivere peggio per far passare un test.
  assert.ok(!/(^|[.!?]\s+)(vendi|compra|esci|entra)\b/i.test(testo), testo);
  assert.ok(!/\b(dovresti|ti consiglio|ti conviene|secondo me)\b/i.test(testo), testo);
  assert.match(testo, /Non ti sto dicendo cosa fare/);
});

// ── PRIMA DI COMPRARE ──
test('l\'elenco dichiara cosa Momentum NON sa misurare, con il motivo', () => {
  // Una lista che fingesse di poter misurare tutto sarebbe più bella e meno
  // utile. Ogni voce non misurabile deve dire perché.
  const nonMisurabili = PRIMA_DI_COMPRARE.filter((x) => !x.misurabile);
  assert.ok(nonMisurabili.length >= 3, 'devono essercene diverse: è il punto');
  for (const v of nonMisurabili) {
    assert.ok(v.nota && v.nota.length > 30, `"${v.voce}" senza motivo dichiarato`);
  }
  // E il debito, che è il buco più serio, deve essere fra queste.
  assert.ok(nonMisurabili.some((x) => /debito/i.test(x.voce)));
  // I dieci anni di conti pure: è ciò che Buffett chiede davvero.
  assert.ok(nonMisurabili.some((x) => /dieci anni/i.test(x.voce)));
});

test('ogni voce misurabile dice DOVE, in Momentum, viene misurata', () => {
  for (const v of PRIMA_DI_COMPRARE.filter((x) => x.misurabile)) {
    assert.ok(v.doveInMomentum, `"${v.voce}" dice di essere misurabile ma non dove`);
    assert.match(v.doveInMomentum, /\.js/);
  }
});

test('ogni voce cita un maestro: nessun criterio inventato', () => {
  for (const v of PRIMA_DI_COMPRARE) assert.ok(v.maestro && v.maestro.length > 3, `"${v.voce}" senza fonte`);
});

test('il testo riassuntivo non promette di misurare tutto', () => {
  const t = testoPrimaDiComprare();
  assert.match(t, /non le misura/);
  assert.match(t, /piu' bella e meno utile/);
});

// ── LA TESI SU DICIANNOVE ANNI: non "è rotta", ma QUANDO ──
test('INTEL: la tesi si è rotta nel 2017, otto anni fa — e nessuna fotografia poteva dirlo', () => {
  // La dimostrazione del perché servivano i bilanci storici. Confrontando due
  // fotografie si può solo dire "il ROE è sotto soglia". Con diciannove anni
  // si dice da QUANDO — e "dal 2017" non è un incidente recente, è un declino
  // lungo che l'utente ha attraversato senza che nessuno glielo dicesse.
  const s = storiaDellaTesi('INTC', 2015);
  assert.equal(s.disponibile, true);
  const roe = s.esiti.find((e) => e.misura === 'roe');
  assert.equal(roe.regge, false);
  assert.ok(roe.primaRottura <= 2018, `prima rottura nel ${roe.primaRottura}`);
  assert.ok(roe.allAcquisto >= 0.15, 'al momento dell\'acquisto la ragione c\'era davvero');
  assert.ok(roe.adesso < 0.05, `oggi ${roe.adesso}`);
  assert.match(testoStoriaTesi(s), /sotto soglia dal 20/);
});

test('APPLE: dieci anni dopo, tutte le ragioni reggono ancora', () => {
  const s = storiaDellaTesi('AAPL', 2015);
  assert.equal(s.rotte, 0);
  assert.equal(s.esiti.length, 3);
  assert.match(testoStoriaTesi(s), /non e' mai sceso sotto soglia/);
});

test('CALO O CICLO: distingue "prima volta" da "è già successo"', () => {
  // Un ROE sotto soglia in un'azienda che negli ultimi quindici anni ci è
  // finita altre undici volte non è la stessa cosa di una che ci arriva per
  // la prima volta. Il numero è identico; la storia no.
  const tesla = storiaDellaTesi('TSLA', 2021);
  const roeT = tesla.esiti.find((e) => e.misura === 'roe');
  assert.ok(roeT.cadutePrecedenti > 5, `solo ${roeT.cadutePrecedenti} cadute precedenti`);
  assert.match(testoStoriaTesi(tesla), /non e' una novita'/);

  const intel = storiaDellaTesi('INTC', 2015);
  const margine = intel.esiti.find((e) => e.misura === 'margine');
  assert.equal(margine.cadutePrecedenti, 0, 'per Intel il margine non era mai sceso prima');
  assert.match(testoStoriaTesi(intel), /e' la prima volta/);
});

test('RISALITA: "era scesa nel 2017 ed è risalita" non è una tesi rotta', () => {
  const s = storiaDellaTesi('KO', 2012);
  const roe = s.esiti.find((e) => e.misura === 'roe');
  assert.equal(roe.regge, true);
  assert.ok(roe.primaRottura, 'era comunque scesa una volta');
  assert.match(testoStoriaTesi(s), /ed e' risalito/);
});

test('LA COSA PIÙ SCOMODA: comprata quando i conti non la giustificavano', () => {
  // Non "l'azienda è peggiorata" ma "la ragione non c'è mai stata", e lo
  // dicono i bilanci depositati quell'anno, non un giudizio a posteriori.
  const t = tesiDaiBilanci('TSLA', 2015);
  assert.equal(t.disponibile, true);
  assert.equal(t.nessunaRagione, true, 'nel 2015 Tesla perdeva soldi');
  const s = storiaDellaTesi('TSLA', 2015);
  assert.match(testoStoriaTesi(s), /non c'e' una tesi che si sia rotta/i);
});

test('un anno fuori archivio si dichiara, non si inventa', () => {
  const t = tesiDaiBilanci('AAPL', 1995);
  assert.equal(t.disponibile, false);
  assert.match(t.motivo, /non lo invento/);
  assert.match(tesiDaiBilanci('ENI', 2015).motivo, /Stati Uniti/);
});

test('il testo storico non dice mai cosa fare', () => {
  const t = testoStoriaTesi(storiaDellaTesi('INTC', 2015));
  assert.ok(!/(^|[.!?]\s+)(vendi|compra|esci|entra)\b/i.test(t), t);
  assert.ok(!/\b(dovresti|ti consiglio|ti conviene)\b/i.test(t), t);
  assert.match(t, /bilanci depositati, non stime/);
});
