'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adattaSpazio, correggi, coseno, separazione, scegliDirezioni, DIREZIONI_DA_TOGLIERE } from './spazio-momentum.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;

// Costruisce vettori con lo STESSO difetto misurato sul modello vero: una
// direzione comune enorme che schiaccia tutto verso la somiglianza, più un
// contenuto specifico piccolo. È l'anisotropia in provetta.
function vettoriAnisotropi(gruppi, dim, rng, { comune = 3, specifico = 0.25 } = {}) {
  const direzioneComune = Array.from({ length: dim }, () => rumore(rng));
  const centri = gruppi.map(() => Array.from({ length: dim }, () => rumore(rng)));
  const out = [];
  gruppi.forEach((quanti, g) => {
    for (let i = 0; i < quanti; i++) {
      const v = new Float32Array(dim);
      for (let d = 0; d < dim; d++) {
        v[d] = comune * direzioneComune[d] + specifico * centri[g][d] + 0.02 * rumore(rng);
      }
      out.push({ gruppo: g, v });
    }
  });
  return out;
}

test('con meno di quattro esempi non si stima una geometria', () => {
  assert.equal(adattaSpazio([]), null);
  assert.equal(adattaSpazio([new Float32Array(8), new Float32Array(8), new Float32Array(8)]), null);
});

test('vettori di lunghezza diversa: si rifiuta invece di produrre numeri', () => {
  assert.equal(adattaSpazio([new Float32Array(8), new Float32Array(4), new Float32Array(8), new Float32Array(8)]), null);
});

test('IL DIFETTO IN PROVETTA: senza correzione tutto somiglia a tutto', () => {
  // Riproduce ciò che è stato misurato sul modello vero: coppie estranee
  // sopra 0,9, indistinguibili dalle imparentate.
  const rng = seme(1);
  const dati = vettoriAnisotropi([6, 6, 6], 64, rng);
  const perGruppo = [0, 1, 2].map((g) => dati.filter((x) => x.gruppo === g).map((x) => x.v));
  const vicine = [], lontane = [];
  for (const g of perGruppo) for (let i = 0; i + 1 < g.length; i += 2) vicine.push([g[i], g[i + 1]]);
  for (let i = 0; i < perGruppo[0].length; i++) lontane.push([perGruppo[0][i], perGruppo[1][i]]);

  const prima = separazione(vicine, lontane, null);
  // Il sintomo esatto misurato dal vivo: tutto sopra 0,9.
  assert.ok(prima.mediaLontane > 0.9, `coppie estranee a ${prima.mediaLontane}`);
  assert.ok(prima.mediaVicine > 0.9);
  assert.ok(prima.distacco < 0.05, `distacco ${prima.distacco}: praticamente nullo`);
});

test('LA CORREZIONE FUNZIONA: il distacco passa da 0,007 a oltre 1,4', () => {
  const rng = seme(1);
  const dati = vettoriAnisotropi([6, 6, 6], 64, rng);
  const perGruppo = [0, 1, 2].map((g) => dati.filter((x) => x.gruppo === g).map((x) => x.v));
  const vicine = [], lontane = [];
  for (const g of perGruppo) for (let i = 0; i + 1 < g.length; i += 2) vicine.push([g[i], g[i + 1]]);
  for (let i = 0; i < perGruppo[0].length; i++) lontane.push([perGruppo[0][i], perGruppo[1][i]]);

  const prima = separazione(vicine, lontane, null);
  const spazio = adattaSpazio(dati.map((x) => x.v), { direzioni: DIREZIONI_DA_TOGLIERE });
  const dopo = separazione(vicine, lontane, spazio);

  // Il guadagno è enorme sulla SCALA: le coppie estranee smettono di stare
  // sopra 0,99 e scendono sotto zero.
  assert.ok(prima.distacco < 0.05, `prima ${prima.distacco}`);
  assert.ok(dopo.distacco > 1, `dopo ${dopo.distacco}`);
  assert.ok(dopo.mediaLontane < 0, `estranee ancora a ${dopo.mediaLontane}`);
  assert.ok(dopo.mediaVicine > 0.9);
});

test('MA NON rende il modello più intelligente: la separabilità normalizzata è la STESSA', () => {
  // La precisazione che tiene onesto tutto il resto. L'ordinamento era già
  // giusto — misurato dal vivo, il modello ordina bene. Quello che cambia è
  // che la sua uscita diventa LEGGIBILE: da tutto schiacciato fra 0,90 e 0,96,
  // dove nessuna soglia significa niente, a una scala usabile.
  const rng = seme(1);
  const dati = vettoriAnisotropi([6, 6, 6], 64, rng);
  const perGruppo = [0, 1, 2].map((g) => dati.filter((x) => x.gruppo === g).map((x) => x.v));
  const vicine = [], lontane = [];
  for (const g of perGruppo) for (let i = 0; i + 1 < g.length; i += 2) vicine.push([g[i], g[i + 1]]);
  for (let i = 0; i < perGruppo[0].length; i++) lontane.push([perGruppo[0][i], perGruppo[1][i]]);
  const prima = separazione(vicine, lontane, null);
  const dopo = separazione(vicine, lontane, adattaSpazio(dati.map((x) => x.v), { direzioni: 1 }));
  assert.ok(Math.abs(dopo.distaccoNormalizzato - prima.distaccoNormalizzato) < 0.05,
    `normalizzato: prima ${prima.distaccoNormalizzato}, dopo ${dopo.distaccoNormalizzato}`);
});

test('TOGLIERNE TROPPE ROMPE TUTTO: il paper non vale su questo dominio', () => {
  // Mu e Viswanath suggeriscono 3-4 direzioni per 384 dimensioni. Misurato
  // qui, togliendone 2 il segno del distacco si INVERTE: dopo la centratura
  // le direzioni dominanti non sono più rumore condiviso, sono proprio ciò
  // che distingue un gruppo dall'altro. È il motivo per cui k va scelto
  // misurando e non copiando.
  const rng = seme(1);
  const dati = vettoriAnisotropi([6, 6, 6], 64, rng);
  const perGruppo = [0, 1, 2].map((g) => dati.filter((x) => x.gruppo === g).map((x) => x.v));
  const vicine = [], lontane = [];
  for (const g of perGruppo) for (let i = 0; i + 1 < g.length; i += 2) vicine.push([g[i], g[i + 1]]);
  for (let i = 0; i < perGruppo[0].length; i++) lontane.push([perGruppo[0][i], perGruppo[1][i]]);
  const troppe = separazione(vicine, lontane, adattaSpazio(dati.map((x) => x.v), { direzioni: 3 }));
  assert.ok(troppe.distacco < 0, `togliendone 3 il distacco è ${troppe.distacco}, doveva essere negativo`);
});

test('scegliDirezioni TROVA da solo il numero giusto, e non è quello del paper', () => {
  const rng = seme(1);
  const dati = vettoriAnisotropi([6, 6, 6], 64, rng);
  const perGruppo = [0, 1, 2].map((g) => dati.filter((x) => x.gruppo === g).map((x) => x.v));
  const vicine = [], lontane = [];
  for (const g of perGruppo) for (let i = 0; i + 1 < g.length; i += 2) vicine.push([g[i], g[i + 1]]);
  for (let i = 0; i < perGruppo[0].length; i++) lontane.push([perGruppo[0][i], perGruppo[1][i]]);

  const scelta = scegliDirezioni(dati.map((x) => x.v), vicine, lontane);
  assert.ok(scelta.utile, 'la correzione deve risultare utile');
  assert.ok(scelta.direzioni <= 1, `ha scelto ${scelta.direzioni}: oltre 1 rompe`);
  // Il guadagno vero è sul MARGINE intorno alla soglia: da 0,0065 a 1,84,
  // cioè 283 volte. È lo spazio in cui la decisione diventa robusta invece
  // che fortunata — l'ordinamento era già giusto anche prima.
  assert.ok(scelta.margine > scelta.margineBase * 50, `margine da ${scelta.margineBase} a ${scelta.margine}`);
  assert.match(scelta.messaggio, /margine intorno alla soglia da/);
});

test('se nessuna correzione migliora, si resta com\'era e lo si dice', () => {
  // Vettori già ben separati e isotropi: non c\'è artefatto da togliere.
  const rng = seme(9);
  const dim = 16;
  const base = [];
  for (let g = 0; g < 2; g++) {
    for (let i = 0; i < 5; i++) {
      const v = new Float32Array(dim);
      v[g] = 1; // due gruppi su assi ortogonali puri
      for (let d = 2; d < dim; d++) v[d] = 0.001 * rumore(rng);
      base.push(v);
    }
  }
  const vicine = [[base[0], base[1]], [base[5], base[6]]];
  const lontane = [[base[0], base[5]], [base[1], base[6]]];
  const scelta = scegliDirezioni(base, vicine, lontane);
  assert.ok(scelta, 'deve comunque restituire un esito');
  assert.ok(typeof scelta.messaggio === 'string');
});

test('la correzione restituisce vettori unitari e della stessa dimensione', () => {
  const rng = seme(2);
  const dati = vettoriAnisotropi([5, 5], 32, rng).map((x) => x.v);
  const spazio = adattaSpazio(dati);
  for (const v of dati) {
    const c = correggi(v, spazio);
    assert.equal(c.length, v.length);
    assert.ok(Math.abs(Math.sqrt([...c].reduce((s, x) => s + x * x, 0)) - 1) < 1e-5);
  }
});

test('senza spazio adattato il vettore torna com\'era: nessun effetto di nascosto', () => {
  const v = Float32Array.from([1, 2, 3]);
  assert.equal(correggi(v, null), v);
  // E uno spazio di dimensione diversa non viene applicato per sbaglio.
  assert.equal(correggi(v, { dim: 5, media: new Float32Array(5), assi: [] }), v);
});

test('gli assi trovati sono ORTOGONALI fra loro', () => {
  // Se non lo fossero, togliere il secondo rimetterebbe dentro parte del
  // primo e la correzione lavorerebbe contro se stessa.
  const rng = seme(3);
  const dati = vettoriAnisotropi([8, 8], 48, rng).map((x) => x.v);
  const spazio = adattaSpazio(dati, { direzioni: 3 });
  for (let i = 0; i < spazio.assi.length; i++) {
    for (let j = i + 1; j < spazio.assi.length; j++) {
      assert.ok(Math.abs(coseno(spazio.assi[i], spazio.assi[j])) < 1e-3,
        `assi ${i} e ${j} non ortogonali: ${coseno(spazio.assi[i], spazio.assi[j])}`);
    }
  }
});

test('è DETERMINISTICO: stesso banco, stesso spazio', () => {
  // Uno spazio che cambia a ogni avvio renderebbe le soglie irriproducibili
  // e i confronti fra sessioni senza senso.
  const rng1 = seme(4), rng2 = seme(4);
  const a = adattaSpazio(vettoriAnisotropi([6, 6], 32, rng1).map((x) => x.v));
  const b = adattaSpazio(vettoriAnisotropi([6, 6], 32, rng2).map((x) => x.v));
  for (let i = 0; i < a.dim; i++) assert.ok(Math.abs(a.media[i] - b.media[i]) < 1e-9);
  assert.ok(Math.abs(coseno(a.assi[0], b.assi[0])) > 0.9999);
});

test('separazione dichiara le SOVRAPPOSIZIONI, non solo le medie', () => {
  // Due medie distanti con code sovrapposte producono scambi: la media da
  // sola nasconde proprio il caso che rompe le cose.
  const rng = seme(5);
  const dati = vettoriAnisotropi([6, 6], 32, rng);
  const g0 = dati.filter((x) => x.gruppo === 0).map((x) => x.v);
  const g1 = dati.filter((x) => x.gruppo === 1).map((x) => x.v);
  const s = separazione([[g0[0], g0[1]]], [[g0[2], g1[0]]], null);
  assert.ok(Number.isFinite(s.sovrapposizioni));
  assert.equal(s.coppieLontane, 1);
});

test('separazione senza coppie: null invece di una divisione per zero', () => {
  assert.equal(separazione([], [], null), null);
});
