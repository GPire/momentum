'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finestraLunga, finestraLungaText, PRIMO_GIORNO } from './eventi-lunghi.js';

test('IL 2008 c\'è, e i numeri sono quelli veri', () => {
  // Il bug che questo modulo risolve: alla domanda "cosa è successo nel 2008?"
  // l'app rispondeva "il mio archivio dettagliato parte dal 2021". Era vero
  // quando fu scritta e FALSA da quando l'archivio parte dal 1985: l'app aveva
  // i dati e diceva all'utente di non averli.
  const f = finestraLunga('2008-01-01', '2008-12-31');
  assert.equal(f.trovato, true);
  assert.ok(f.giorniDiBorsa > 240 && f.giorniDiBorsa < 260, `${f.giorniDiBorsa} giorni`);
  const azioni = f.perSerie.find((s) => s.chiave === 'azioniUsa');
  // L'S&P 500 nel 2008 ha fatto circa -38,5%: se questo numero non torna,
  // l'allineamento delle date è sbagliato e tutto il resto è rumore.
  assert.ok(azioni.totale < -35 && azioni.totale > -42, `azioni ${azioni.totale}%`);
  assert.equal(azioni.dataPeggiorGiorno.slice(0, 7), '2008-10');
});

test('MARZO 2020: -12,5% sulle azioni e il petrolio a -54%', () => {
  const f = finestraLunga('2020-03-01', '2020-03-31');
  assert.equal(f.trovato, true);
  const azioni = f.perSerie.find((s) => s.chiave === 'azioniUsa');
  assert.ok(azioni.totale < -10 && azioni.totale > -16, `azioni ${azioni.totale}%`);
  const petrolio = f.perSerie.find((s) => s.chiave === 'petrolio');
  assert.ok(petrolio.totale < -40, `petrolio ${petrolio.totale}%`);
});

test('le serie che NON esistevano vengono OMESSE e dichiarate, non mostrate a zero', () => {
  // Uno zero direbbe "è rimasta ferma", che è un'altra cosa da "non c'era".
  const f = finestraLunga('2008-01-01', '2008-12-31');
  assert.ok(!f.perSerie.some((s) => s.chiave === 'bitcoin'), 'Bitcoin non esisteva nel 2008');
  assert.ok(f.assenti.some((n) => /bitcoin/i.test(n)), 'e va dichiarato fra gli assenti');
  assert.match(finestraLungaText(f, 'il 2008'), /non esistevano ancora/);
});

test('IL VIX NON È "LA MIGLIORE": è l\'indice della paura', () => {
  // Nel 2008 il VIX è salito del 77,8% e la prima versione del testo lo
  // annunciava come la cosa andata meglio nell'anno del crollo. È il tipo di
  // errore che fa perdere fiducia in tutto il resto.
  const t = finestraLungaText(finestraLunga('2008-01-01', '2008-12-31'), 'il 2008');
  assert.ok(!/migliore e' stata indice della paura/i.test(t), t);
  assert.match(t, /indice della paura e' salito/);
  assert.match(t, /non e' un investimento/);
});

test('nel 2008 il DOLLARO risulta il migliore — conferma indipendente di rifugi.js', () => {
  // rifugi.js aveva già misurato, su dati mensili e con un altro metodo, che
  // il dollaro è il rifugio migliore dell'archivio. Qui la stessa cosa esce
  // dai dati giornalieri dell'anno peggiore: due strade, stesso risultato.
  const f = finestraLunga('2008-01-01', '2008-12-31');
  const investibili = f.perSerie.filter((s) => s.chiave !== 'paura');
  const migliore = investibili[investibili.length - 1];
  assert.equal(migliore.chiave, 'dollaro', `migliore: ${migliore.chiave}`);
  assert.ok(migliore.totale > 0);
});

test('periodo fuori archivio: si dichiara il primo giorno REALE, non una data scritta a mano', () => {
  const f = finestraLunga('1970-01-01', '1970-12-31');
  assert.equal(f.trovato, false);
  assert.match(f.motivo, new RegExp(PRIMO_GIORNO));
  assert.ok(PRIMO_GIORNO < '1986-01-01');
});

test('il testo non costruisce preposizioni articolate ("In il 2008")', () => {
  // Terzo caso in questa sessione: la preposizione articolata non si ottiene
  // concatenando "in" + "il 2008".
  for (const [da, a, et] of [['2008-01-01', '2008-12-31', 'il 2008'], ['2020-03-01', '2020-03-31', 'marzo 2020']]) {
    const t = finestraLungaText(finestraLunga(da, a), et);
    assert.ok(!/\b(in il|in i|su il|su gli|di il|da le)\b/i.test(t), t);
  }
});

test('il testo dichiara che sono fatti, non spiegazioni delle cause', () => {
  const t = finestraLungaText(finestraLunga('2008-01-01', '2008-12-31'), 'il 2008');
  assert.match(t, /non una spiegazione delle cause/);
  assert.ok(!/\b(compra|vendi|conviene|dovresti)\b/i.test(t));
});
