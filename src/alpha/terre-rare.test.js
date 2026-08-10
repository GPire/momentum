import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloTerreRare, scarsitaOSconcentrazione, chiLeProduce,
  panicoDel2010, etfSegueIlMetallo, terreRareText,
} from './terre-rare.js';
import { etfTerreRarePerAnno } from './materie-prime.js';
import { TR_ANNO, TR_PREZZO_REALE, TR_PRODUZIONE_MONDO } from './terre-rare-panel.js';

test('CENTOVENTUN ANNI di terre rare: il dato pubblico esisteva, avevo solo cercato male', () => {
  const p = pannelloTerreRare();
  assert.equal(p.da, 1900);
  assert.ok(p.anni >= 121);
  assert.ok(p.anniConPrezzo > 90, `anni con prezzo: ${p.anniConPrezzo}`);
  assert.match(p.fonte, /Geological Survey/);
  assert.match(p.fonte, /dominio pubblico/);
  // I limiti fanno parte del dato, non sono una nota a piè di pagina.
  assert.ok(p.limiti.length >= 3);
  assert.ok(p.limiti.some((l) => /annuale/.test(l)));
  assert.ok(p.limiti.some((l) => /2020/.test(l)));
  for (const a of [TR_PREZZO_REALE, TR_PRODUZIONE_MONDO]) assert.equal(a.length, TR_ANNO.length);
});

test('NON SONO RARE: cento volte più produzione e prezzo reale crollato', () => {
  const s = scarsitaOSconcentrazione();
  assert.ok(s.produzioneMondiale.volteDal1960 > 50, `solo ${s.produzioneMondiale.volteDal1960}x`);
  assert.ok(s.prezzoReale.variazione < -0.5, 'in termini reali costano molto meno di un secolo fa');
  assert.equal(s.piuAbbondantiCheMai, true);
  // Il contrario esatto di come se ne parla: più se ne produce, meno costano.
  assert.ok(s.prezzoReale.sottoIlMassimo < -0.9);
});

test('IL PROBLEMA È LA CONCENTRAZIONE: dall\'82% del mondo a ZERO per 13 anni', () => {
  const c = chiLeProduce();
  assert.equal(c.valido, true);
  assert.ok(c.massimoAmericano.quota > 0.75, `massimo: ${c.massimoAmericano.quota}`);
  assert.ok(c.anniAQuotaZero >= 10, `anni a zero: ${c.anniAQuotaZero}`);
  assert.equal(c.daDominanteAZero, true);
  // E quello che questi dati NON possono dire va dichiarato: la quota cinese
  // non è deducibile da una serie che ha solo Stati Uniti e totale mondiale.
  assert.match(c.nonDeducibileDaQui, /Cina/);
});

test('IL PANICO DEL 2010: +493%, e oggi sotto il punto di partenza', () => {
  const p = panicoDel2010();
  assert.equal(p.valido, true);
  assert.ok(p.alPicco.salita > 3, `salita: ${p.alPicco.salita}`);
  assert.equal(p.alPicco.anno, 2011);
  assert.ok(p.oggi.dalPicco < -0.85, 'quasi tutto restituito');
  assert.equal(p.tornatoSottoIlLivelloDiPartenza, true,
    'chi comprò quando se ne parlava di più comprò il massimo');
});

test('L\'ETF azzecca il verso e sbaglia la misura — e vanno dette entrambe', () => {
  const r = etfSegueIlMetallo(etfTerreRarePerAnno());
  assert.equal(r.valido, true);
  assert.ok(r.anniInComune >= 10);
  // Le due facce del risultato. Da sole porterebbero a conclusioni opposte.
  assert.equal(r.azzeccaIlVerso, true, 'la direzione coincide quasi ogni anno');
  assert.equal(r.seguelaMisura, false, 'ma la correlazione è debole');
  assert.equal(r.abbastanzaDatiPerConcludere, false, 'e dieci punti sono pochi, va detto');
  assert.match(r.verdetto, /azzecca il verso e sbaglia la misura/);
});

test('senza i dati del fondo si risponde "non li ho", non si inventa', () => {
  assert.equal(etfSegueIlMetallo().valido, false);
  assert.equal(etfSegueIlMetallo({ 2011: 100 }).valido, false, 'un solo anno non basta');
  assert.match(etfSegueIlMetallo(null).motivo, /li passa il chiamante/);
});

test('il testo racconta la storia giusta: concentrazione, non scarsità', () => {
  const t = terreRareText();
  assert.match(t, /non sono rare/i);
  assert.match(t, /dipendenza/);
  assert.match(t, /121 anni/);
  assert.ok(!/l 82%|il 82%/.test(t), `articolo storto: ${t}`);
  assert.ok(!/dovresti|ti consiglio|conviene comprare/i.test(t));
});
