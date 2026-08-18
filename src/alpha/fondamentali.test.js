import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, valutaFondamentali, tensioneTraScuole, testoFondamentali, CRITERI, GRAHAM_PRODOTTO } from './fondamentali.js';

// Un'azienda di qualita' cara: ROE e margini alti, multipli alti. E' il caso
// piu' frequente nella realta', e quello dove il punteggio unico mente di piu'.
const QUALITA_CARA = {
  Name: 'Esempio Qualita', Sector: 'Technology',
  PERatio: '38.4', PriceToBookRatio: '12.1', PEGRatio: '2.8',
  ReturnOnEquityTTM: '0.42', ProfitMargin: '0.25', ReturnOnAssetsTTM: '0.18',
};
// Un'azienda a sconto ma poco redditizia: lo specchio della precedente.
const PREZZO_BASSO = {
  Name: 'Esempio Sconto', Sector: 'Energy',
  PERatio: '7.2', PriceToBookRatio: '0.8', PEGRatio: '0.6',
  ReturnOnEquityTTM: '0.04', ProfitMargin: '0.02', ReturnOnAssetsTTM: '0.01',
};

test('num: "None", stringa vuota e assente diventano null, MAI zero', () => {
  // Il punto: uno zero finto entrerebbe nei confronti e produrrebbe un
  // verdetto costruito sul nulla.
  assert.equal(num('None'), null);
  assert.equal(num(''), null);
  assert.equal(num(undefined), null);
  assert.equal(num(null), null);
  assert.equal(num('-'), null);
  assert.equal(num('0'), 0); // uno zero VERO resta zero
  assert.equal(num('15.5'), 15.5);
});

test('qualita cara: la scuola della qualita promuove, quella del prezzo boccia', () => {
  const r = valutaFondamentali(QUALITA_CARA);
  assert.equal(r.disponibile, true);
  assert.equal(r.tensione.misurabile, true);
  assert.equal(r.tensione.inDisaccordo, true);
  assert.equal(r.tensione.scuolaFavorevole, 'qualita');
  assert.equal(r.tensione.qualita.superati, 3);
  assert.equal(r.tensione.prezzo.superati, 0);
});

test('prezzo basso: si ribalta esattamente — e nessun punteggio unico lo direbbe', () => {
  const r = valutaFondamentali(PREZZO_BASSO);
  assert.equal(r.tensione.inDisaccordo, true);
  assert.equal(r.tensione.scuolaFavorevole, 'prezzo');
  // Due criteri di prezzo, non tre: il PEG di Lynch e' una scuola a se'
  // (prezzo-crescita), perche' guarda il prezzo IN RAPPORTO alla crescita —
  // una domanda diversa sia da Graham sia da Buffett.
  assert.equal(r.tensione.prezzo.superati, 2);
  assert.equal(r.tensione.prezzo.totale, 2);
  assert.equal(r.tensione.qualita.superati, 0);
  assert.equal(r.tensione.qualita.totale, 3);
});

test('LA CONTRADDIZIONE E REALE: le due aziende hanno lo stesso numero di criteri superati', () => {
  // Il cuore del modulo. Un punteggio "3 su 6" le renderebbe indistinguibili,
  // mentre sono l'una l'opposto dell'altra. La tensione e' l'informazione che
  // il punteggio unico distrugge.
  const a = valutaFondamentali(QUALITA_CARA);
  const b = valutaFondamentali(PREZZO_BASSO);
  const superatiA = a.esiti.filter((e) => e.superato).length;
  const superatiB = b.esiti.filter((e) => e.superato).length;
  assert.equal(superatiA, superatiB);
  assert.notEqual(a.tensione.scuolaFavorevole, b.tensione.scuolaFavorevole);
});

test('regola combinata di Graham: P/E per P/B contro la soglia 22,5', () => {
  assert.equal(valutaFondamentali(PREZZO_BASSO).grahamCombinato.superato, true);   // 7,2 × 0,8 = 5,8
  assert.equal(valutaFondamentali(QUALITA_CARA).grahamCombinato.superato, false);  // 38,4 × 12,1
  assert.equal(GRAHAM_PRODOTTO, 22.5);
});

test('meno di tre criteri misurabili: si rifiuta invece di inventare un verdetto', () => {
  const r = valutaFondamentali({ Name: 'Quasi Vuota', PERatio: '12' });
  assert.equal(r.disponibile, false);
  assert.equal(r.misurati, 1);
  assert.match(r.motivo, /troppo poco/);
});

test('azienda in perdita: il P/E manca perche NON ESISTE, e va detto', () => {
  const r = valutaFondamentali({
    Name: 'In Perdita', PERatio: 'None', EPS: '-2.4',
    PriceToBookRatio: '1.1', PEGRatio: 'None',
    ReturnOnEquityTTM: '-0.08', ProfitMargin: '-0.15', ReturnOnAssetsTTM: '-0.05',
  });
  assert.equal(r.disponibile, true);
  assert.ok(r.avvisi.some((a) => /in perdita/.test(a)));
  assert.ok(r.mancanti.some((m) => m.id === 'peBasso'));
  // Un ROE negativo non deve mai "superare" una soglia di minimo.
  assert.equal(r.esiti.find((e) => e.id === 'roeAlto').superato, false);
});

test('un P/E negativo non conta come "multiplo basso"', () => {
  // Un P/E di -5 e' numericamente sotto 15, ma non e' un'azienda a sconto:
  // e' un'azienda che perde. Il confronto ingenuo `<=` qui mentirebbe.
  const r = valutaFondamentali({
    Name: 'PE Negativo', PERatio: '-5', PriceToBookRatio: '2.0', PEGRatio: '3',
    ReturnOnEquityTTM: '0.2', ProfitMargin: '0.12', ReturnOnAssetsTTM: '0.09',
  });
  assert.equal(r.esiti.find((e) => e.id === 'peBasso').superato, false);
});

test('tensione non misurabile se manca del tutto una delle due scuole', () => {
  const soloQualita = tensioneTraScuole([
    { scuola: 'qualita', superato: true, maestro: 'Warren Buffett' },
    { scuola: 'qualita', superato: true, maestro: 'Warren Buffett' },
  ]);
  assert.equal(soloQualita.misurabile, false);
});

test('ogni criterio dichiara cosa NON dice (nessuna soglia senza il suo limite)', () => {
  for (const [id, c] of Object.entries(CRITERI)) {
    assert.ok(c.nonDice && c.nonDice.length > 10, `${id} deve dichiarare il proprio limite`);
    assert.ok(c.maestro && c.perBambini, `${id} deve avere maestro e spiegazione semplice`);
    assert.ok(['sotto', 'sopra'].includes(c.verso));
  }
});

test('il testo non suggerisce mosse ne promette il futuro', () => {
  const t = testoFondamentali(valutaFondamentali(QUALITA_CARA));
  assert.ok(!/\b(compra|vendi|conviene|ti consiglio|dovresti|salira|scendera)\b/i.test(t), t);
  assert.match(t, /non e un consiglio|non un consiglio|non e\\?' un consiglio|non cosa succedera/i);
});

test('il testo dichiara sempre i limiti strutturali (12 mesi, debito, non ritestabile)', () => {
  const r = valutaFondamentali(QUALITA_CARA);
  assert.ok(r.avvisi.some((a) => /dodici mesi/.test(a)));
  assert.ok(r.avvisi.some((a) => /debito/.test(a)));
  assert.ok(r.avvisi.some((a) => /passato/.test(a)));
});

test('accordo raro: quando entrambe le scuole promuovono, si invita a chiedersi perche', () => {
  const r = valutaFondamentali({
    Name: 'Rara', PERatio: '11', PriceToBookRatio: '1.2', PEGRatio: '0.8',
    ReturnOnEquityTTM: '0.22', ProfitMargin: '0.18', ReturnOnAssetsTTM: '0.11',
  });
  assert.equal(r.tensione.inDisaccordo, false);
  assert.match(r.tensione.messaggio, /raro/);
});
