import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloCot, indice, rientroDagliEstremi, estremiSonoSpeciali,
  perAnno, perMese, quadroPosizionamento, posizionamentoText,
  mercatoNominato, quadroMercato, mercatoText,
  FINESTRA, ESTREMO_ALTO, ESTREMO_BASSO,
} from './posizionamento.js';
import { COT_NETTO, COT_DATE } from './cot-panel.js';

// ── I dati: quarant'anni, e ogni mercato con la sua storia ──

test('QUARANT\'ANNI di posizionamento vero, senza accorciare al mercato più giovane', () => {
  const p = pannelloCot();
  assert.ok(p.settimane > 1900, `settimane: ${p.settimane}`);
  assert.ok(p.da <= '1986-12', `l'archivio parte da ${p.da}`);
  const oro = p.mercati.find((m) => m.chiave === 'oro');
  const btc = p.mercati.find((m) => m.chiave === 'bitcoin');
  assert.ok(oro.settimane > 1900, 'l\'oro deve avere la storia completa');
  assert.ok(btc.settimane < 500, 'il bitcoin ne ha molta meno, ed è giusto così');
  assert.ok(oro.settimane > btc.settimane * 4,
    'se le finestre fossero uguali, avremmo buttato via trent\'anni di oro per far posto al bitcoin');
  assert.match(p.fonte, /dominio pubblico/);
});

test('dove un mercato non esisteva c\'è null, non uno zero', () => {
  const btc = COT_NETTO.bitcoin;
  assert.equal(btc[0], null, 'nel 1986 il bitcoin non esisteva');
  assert.ok(btc.filter((x) => x === null).length > 1000);
  assert.ok(btc.at(-1) !== null, 'ma oggi c\'è');
  // L'oro copre quasi tutto, ma non proprio tutto: due settimane (1997-12-19 e
  // 2003-02-18) esistono nell'archivio solo perché altri mercati hanno
  // pubblicato quel giorno e l'oro no. Sono buchi VERI della fonte, e restano
  // null: riempirli per interpolazione significherebbe inventarsi un dato.
  const buchiOro = COT_NETTO.oro.filter((x) => x === null).length;
  assert.ok(buchiOro <= 5, `troppi buchi nell'oro: ${buchiOro}`);
  assert.notEqual(COT_NETTO.oro[0], null, 'l\'oro c\'è fin dalla prima settimana del 1986');
  for (const k of Object.keys(COT_NETTO)) {
    assert.equal(COT_NETTO[k].length, COT_DATE.length, `${k} disallineato con le date`);
  }
});

test('CONTROLLO STORICO: le date sono settimanali e ordinate', () => {
  for (let i = 1; i < COT_DATE.length; i++) {
    assert.ok(COT_DATE[i] > COT_DATE[i - 1], `date fuori ordine attorno a ${COT_DATE[i]}`);
  }
  const giorni = (new Date(COT_DATE.at(-1)) - new Date(COT_DATE[0])) / 86400000;
  const passo = giorni / (COT_DATE.length - 1);
  assert.ok(passo > 6 && passo < 8, `passo medio ${passo.toFixed(1)} giorni: doveva essere settimanale`);
});

// ── L'indice ──

test('l\'indice è un percentile: dice dove siamo rispetto alla storia recente, non un valore assoluto', () => {
  for (const k of Object.keys(COT_NETTO)) {
    const i = indice(k);
    if (!i.valido) continue;
    assert.ok(i.indice >= 0 && i.indice <= 100, `${k}: ${i.indice}`);
    assert.equal(i.estremoRialzista, i.indice >= ESTREMO_ALTO);
    assert.equal(i.estremoRibassista, i.indice <= ESTREMO_BASSO);
  }
  assert.equal(indice('inventato').valido, false);
  assert.equal(FINESTRA, 156, 'tre anni di settimane');
});

// ── LA PARTE CHE CONTA: la tesi contraria, e il controllo che la smonta ──

test('gli estremi RIENTRANO su tutti i mercati — e da solo questo non vuol dire niente', () => {
  for (const k of ['azioniUsa', 'oro', 'titoliStato', 'euro']) {
    const r = rientroDagliEstremi(k);
    assert.equal(r.valido, true);
    assert.equal(r.rientrano, true, `${k} non rientra`);
    assert.ok(r.dopoUnEstremoRialzista.casi > 50, `pochi casi per ${k}`);
    // La nota che impedisce di leggere questo come "il prezzo si gira".
    assert.match(r.nota, /non se il prezzo si gira/);
  }
});

test('IL CONTROLLO: una serie limitata rientra SEMPRE dai suoi estremi, per costruzione', () => {
  // Il test più importante del modulo. Se `estremiSonoSpeciali` dicesse "sì"
  // ovunque, starebbe solo rimisurando il ritorno alla media con un altro nome.
  const esiti = ['azioniUsa', 'oro', 'titoliStato', 'euro', 'bitcoin']
    .map((k) => estremiSonoSpeciali(k)).filter((r) => r.valido);
  assert.ok(esiti.length >= 4);
  const speciali = esiti.filter((r) => r.specialiDavvero);
  assert.ok(speciali.length < esiti.length,
    'se gli estremi risultassero speciali su TUTTI i mercati, il controllo non starebbe controllando niente');
  assert.ok(speciali.length > 0,
    'e se non lo fossero su nessuno, il posizionamento non aggiungerebbe nulla');
});

test('SULLE AZIONI gli estremi NON sono speciali: è solo ritorno alla media', () => {
  const a = estremiSonoSpeciali('azioniUsa');
  assert.equal(a.specialiDavvero, false,
    `eccesso ${a.eccesso} contro un errore di ${a.errore}: dentro il rumore`);
  assert.match(a.conclusione, /niente di speciale/);
});

test('SU ORO, TASSI ED EURO invece qualcosa in più c\'è', () => {
  for (const k of ['oro', 'titoliStato', 'euro']) {
    const r = estremiSonoSpeciali(k);
    assert.equal(r.specialiDavvero, true, `${r.nome}: eccesso ${r.eccesso} ± ${r.errore}`);
    assert.ok(Math.abs(r.eccesso) > 2 * r.errore);
  }
});

// ── Le cadenze: anno e mese ──

test('per anno: quarant\'anni di medie, con le settimane su cui poggiano', () => {
  const a = perAnno('oro');
  assert.ok(a.length > 35, `anni coperti: ${a.length}`);
  assert.equal(a[0].anno, '1986');
  for (const r of a) {
    assert.ok(r.settimane > 0 && r.settimane <= 53);
    assert.ok(r.minimo <= r.medio && r.medio <= r.massimo);
  }
});

test('per mese: la stagionalità viene SOTTOPOSTA A UN TEST, non pubblicata e basta', () => {
  const m = perMese('oro');
  assert.equal(m.length, 12);
  const distinguibili = m.filter((x) => x.distinguibile).length;
  assert.ok(distinguibili < 7,
    `${distinguibili} mesi su 12 dichiarati significativi: con questo campione è implausibile`);
  for (const x of m) assert.ok(x.osservazioni > 100, `mese ${x.mese}: ${x.osservazioni} osservazioni`);
});

// ── Il quadro e il testo ──

test('il quadro dice dove gli operatori sono schierati, e se è un clima diffuso', () => {
  const q = quadroPosizionamento();
  assert.ok(q.mercati.length >= 4);
  assert.equal(typeof q.climaDiffuso, 'boolean');
  assert.equal(q.climaDiffuso, q.estremi.length >= Math.ceil(q.mercati.length / 2));
});

test('il testo non trasforma MAI una condizione in una previsione', () => {
  const t = posizionamentoText(quadroPosizionamento());
  assert.ok(t.length > 40);
  if (/estremi|stessa parte/.test(t)) {
    assert.match(t, /e' una condizione, non una previsione/);
  }
  assert.ok(!/comprare|vendere|si girera' presto|opportunit/i.test(t), `indicazione operativa: ${t}`);
  assert.ok(!/percentile|contrarian|open interest/i.test(t), `gergo: ${t}`);
});

// ── La risposta su un mercato solo ──

test('chi nomina un mercato riceve QUEL mercato, non la panoramica', () => {
  assert.equal(mercatoNominato('come sono messi i trader sull\'oro?'), 'oro');
  assert.equal(mercatoNominato('sentiment sul bitcoin'), 'bitcoin');
  assert.equal(mercatoNominato('posizionamento sulle azioni americane'), 'azioniUsa');
  assert.equal(mercatoNominato('come va il cambio euro dollaro'), 'euro');
  assert.equal(mercatoNominato('qual è il sentiment del mercato?'), null, 'domanda generica: nessun mercato');
  // "criptovalute" contiene "valut": senza l'ordine giusto finirebbe su euro.
  assert.equal(mercatoNominato('c\'è euforia sulle criptovalute?'), 'bitcoin');
});

test('la risposta su un mercato dice SEMPRE se lì il segnale vale qualcosa', () => {
  const oro = mercatoText(quadroMercato('oro'));
  assert.match(oro, /conta davvero/, 'sull\'oro il controllo ha retto: va detto');
  const btc = mercatoText(quadroMercato('bitcoin'));
  assert.match(btc, /non ci leggerei un segnale/, 'sul bitcoin no: va detto ancora più chiaramente');
  for (const t of [oro, btc]) {
    assert.match(t, /1986|2018/, 'quanta storia c\'è dietro');
    assert.ok(!/percentile|non commerciali|open interest/i.test(t), `gergo: ${t}`);
  }
});
