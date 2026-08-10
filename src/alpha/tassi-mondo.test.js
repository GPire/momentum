import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloPaesi, sincroniaConGliUsa, scartoFraPaesi, cicloGlobale,
  quadroPaese, tassiMondoText, scartoText,
} from './tassi-mondo.js';
import { TASSI_PAESI } from './country-rates-panel.js';

let _s = null;
const sinc = () => (_s ??= sincroniaConGliUsa());

// ── Il pannello, e i controlli che dicono se i dati sono veri ──

test('dodici Paesi, stessa misura, stessa finestra', () => {
  const p = pannelloPaesi();
  assert.ok(p.paesi.length >= 12, `Paesi: ${p.paesi.length}`);
  assert.ok(p.mesi > 400, `mesi: ${p.mesi}`);
  assert.match(p.fonte, /OCSE/);
  const lung = new Set(Object.values(TASSI_PAESI).map((v) => v.length));
  assert.equal(lung.size, 1, 'tutte le serie devono avere la stessa lunghezza');
});

test('CONTROLLO STORICO: i numeri devono corrispondere a fatti noti', () => {
  const max = (k) => Math.max(...TASSI_PAESI[k]);
  const oggi = (k) => TASSI_PAESI[k].at(-1);
  // L'Italia nei primi anni Novanta pagava tassi a due cifre: se non risultasse,
  // la serie sarebbe sbagliata.
  assert.ok(max('it') > 12, `massimo italiano ${max('it')}%`);
  // Il Giappone e' il Paese dei tassi bassi da trent'anni.
  const mediaJp = TASSI_PAESI.jp.reduce((a, b) => a + b, 0) / TASSI_PAESI.jp.length;
  assert.ok(mediaJp < 2.5, `media giapponese ${mediaJp}%`);
  // La Svizzera oggi ha i tassi piu' bassi del gruppo.
  const tuttiOggi = Object.keys(TASSI_PAESI).map((k) => [k, oggi(k)]);
  const minimo = tuttiOggi.sort((a, b) => a[1] - b[1])[0];
  assert.equal(minimo[0], 'ch', `il tasso piu' basso oggi e' ${minimo[0]}, atteso ch`);
});

// ── IL RISULTATO CHE CONTA ──

test('NON TUTTI SEGUONO GLI USA: la Germania si', () => {
  const s = sinc();
  const de = s.righe.find((r) => r.paese === 'de');
  assert.ok(de.sincronia > 0.65, `Germania-USA: ${de.sincronia}`);
  assert.equal(de.seguelUsa, true);
});

test('...E L\'ITALIA MOLTO MENO, ed è il punto di tutto il modulo', () => {
  const s = sinc();
  const it = s.righe.find((r) => r.paese === 'it');
  const de = s.righe.find((r) => r.paese === 'de');
  assert.ok(it.sincronia < de.sincronia * 0.6,
    `Italia ${it.sincronia} contro Germania ${de.sincronia}: il rendimento italiano porta dentro un rischio-Paese locale`);
  assert.equal(it.seguelUsa, false,
    'per un utente italiano il ciclo americano NON e\' una buona guida, e l\'app deve saperlo');
});

test('si correlano le VARIAZIONI, non i livelli: due serie che scendono da trent\'anni sembrerebbero legate comunque', () => {
  // Controprova: sui LIVELLI quasi tutti risultano molto correlati, ed e'
  // proprio l'illusione che questo modulo evita.
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const cor = (a, b) => {
    const ma = media(a), mb = media(b);
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
    return n / Math.sqrt(da * db);
  };
  const suLivelli = cor(TASSI_PAESI.us, TASSI_PAESI.it);
  const it = sinc().righe.find((r) => r.paese === 'it');
  assert.ok(suLivelli > it.sincronia + 0.2,
    `sui livelli Italia-USA sembra ${suLivelli.toFixed(2)}, sulle variazioni e' ${it.sincronia}: la differenza e' l'illusione`);
});

// ── Lo scarto fra Paesi ──

test('LO SCARTO ITALIA-GERMANIA: il massimo storico cade nella crisi del debito', () => {
  const s = scartoFraPaesi('it', 'de');
  assert.equal(s.valido, true);
  assert.ok(s.massimo > 5, `massimo dello scarto: ${s.massimo} punti`);
  assert.ok(s.minimo >= 0, 'l\'Italia non ha mai pagato meno della Germania in questo campione');
  assert.ok(s.oggi < s.massimo / 3, `oggi ${s.oggi}: molto sotto il massimo`);
  assert.match(scartoText(s), /punti in piu/);
});

test('la funzione è generale: vale per qualunque coppia, non solo quella famosa', () => {
  const es = scartoFraPaesi('es', 'de');
  assert.equal(es.valido, true);
  assert.ok(es.massimo > 2);
  const gb = scartoFraPaesi('gb', 'ez');
  assert.equal(gb.valido, true);
  assert.equal(scartoFraPaesi('it', 'inventato').valido, false);
});

test('un valore assoluto senza percentile non significa niente, e infatti c\'è', () => {
  const s = scartoFraPaesi('it', 'de');
  assert.ok(s.percentile >= 0 && s.percentile <= 1);
  assert.equal(typeof s.tesoStoricamente, 'boolean');
  assert.equal(s.tesoStoricamente, s.percentile > 0.8);
});

// ── Il ciclo globale ──

test('il ciclo globale dei tassi esiste e varia nel tempo', () => {
  const c = cicloGlobale();
  assert.ok(c.finestre.length > 10);
  assert.ok(c.oggi >= -1 && c.oggi <= 1);
  assert.ok(c.massimo > c.minimo + 0.1,
    'se la sincronia fosse costante non ci sarebbe niente da misurare');
});

// ── Il quadro per chi ci vive ──

test('il quadro di un Paese dice dove sono i tassi rispetto alla SUA storia', () => {
  for (const p of ['it', 'de', 'us', 'jp']) {
    const q = quadroPaese(p);
    assert.equal(q.valido, true);
    assert.ok(q.tasso > 0 && q.tasso < 20);
    assert.ok(q.percentileStorico >= 0 && q.percentileStorico <= 1);
    assert.ok(q.minimoStorico <= q.tasso && q.tasso <= q.massimoStorico);
  }
  assert.equal(quadroPaese('marte').valido, false);
});

test('il testo dice a un italiano che il ciclo americano lo riguarda poco', () => {
  const t = tassiMondoText('it');
  assert.match(t, /In Italia/);
  assert.match(t, /seguono poco quelli americani/);
  const d = tassiMondoText('de');
  assert.match(d, /si muovono quasi insieme a quelli americani/);
});

test('i testi non usano gergo e non suggeriscono cosa fare', () => {
  for (const p of ['it', 'de', 'us', 'jp', 'ch']) {
    const t = tassiMondoText(p);
    assert.ok(!/correlazione|percentile|sincronia|volatilit/i.test(t), `gergo in ${p}: ${t}`);
    assert.ok(!/compra|vendi|conviene investire/i.test(t), `consiglio in ${p}: ${t}`);
  }
});
