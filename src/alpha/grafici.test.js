import test from 'node:test';
import assert from 'node:assert/strict';
import { linea, barre, distribuzione, graficoPrevisione, assottiglia, POCHI_PUNTI } from './grafici.js';

const svgValido = (s) => {
  assert.ok(typeof s === 'string' && s.startsWith('<svg'), 'non è un SVG');
  assert.ok(s.endsWith('</svg>'));
  // Ogni tag aperto deve chiudersi: un SVG rotto non dà errore, semplicemente
  // non si vede, ed è il modo peggiore di fallire.
  const aperti = (s.match(/<(svg|text|rect|path|line|circle|title)\b/g) || []).length;
  const chiusi = (s.match(/<\/(svg|text|title)>|\/>/g) || []).length;
  assert.equal(aperti, chiusi, `tag sbilanciati:\n${s}`);
  return s;
};

test('la linea disegna la serie e scrive il valore finale', () => {
  const s = svgValido(linea([10, 12, 9, 15, 14, 20, 18, 25], { titolo: 'prova' }));
  assert.match(s, /<path/);
  assert.match(s, /role="img"/, 'senza ruolo un lettore di schermo non sa cos\'è');
  assert.match(s, /aria-label="prova"/);
  assert.match(s, /25/, 'il valore finale va scritto, non dedotto dalla lunghezza');
});

test('con POCHI punti il grafico lo DICE invece di sembrare autorevole', () => {
  const s = linea([1, 2, 3, 4], { titolo: 'poca roba' });
  assert.match(s, /solo 4 punti/);
  const tanti = linea(Array.from({ length: 40 }, (_, i) => i), { titolo: 'tanti' });
  assert.ok(!/solo \d+ punti/.test(tanti));
  assert.equal(POCHI_PUNTI, 8);
});

test('la linea rifiuta di disegnare quando non c\'è niente da disegnare', () => {
  assert.equal(linea([]), null);
  assert.equal(linea([5]), null);
  assert.equal(linea([null, null, null]), null);
  // I null in mezzo non devono spezzare il tracciato né produrre NaN.
  const s = svgValido(linea([1, null, 3, null, 5, 7, 9, 11]));
  assert.ok(!/NaN|Infinity|undefined/.test(s), `numeri non validi nell'SVG:\n${s}`);
});

test('LE BARRE PARTONO DA ZERO: è la regola che impedisce di mentire con un grafico', () => {
  const s = svgValido(barre([
    { nome: 'Italia', valore: -0.28 }, { nome: 'Giappone', valore: -0.36 }, { nome: 'Spagna', valore: 0.05 },
  ], { titolo: 'case' }));
  // Con valori di segno opposto ci deve essere la linea dello zero.
  assert.match(s, /<line/);
  assert.match(s, /-28\.0%/);
  assert.match(s, /\+5\.0%/, 'il segno positivo esplicito: il colore non basta da solo');
});

test('il segno non è affidato SOLO al colore', () => {
  const s = barre([{ nome: 'giù', valore: -0.4 }, { nome: 'su', valore: 0.4 }]);
  // Chi non distingue rosso e verde deve leggere lo stesso grafico.
  assert.match(s, /-40\.0%/);
  assert.match(s, /\+40\.0%/);
});

test('la distribuzione mostra la fascia, il tipico e il punto di pareggio', () => {
  const s = svgValido(distribuzione({ mediano: 0.08, andataMale: -0.51, andataBene: 1.25, casi: 29 }));
  assert.match(s, /tipico \+8%/);
  assert.match(s, /-51%/);
  assert.match(s, /\+125%/);
  assert.match(s, /in pari/, 'la linea dello zero va etichettata');
  assert.match(s, /su 29 casi storici/, 'quanti dati ci sono dietro fa parte del grafico');
});

test('senza abbastanza casi il grafico di previsione NON viene disegnato', () => {
  assert.equal(graficoPrevisione({ abbastanza: false, casi: 3 }), null);
  assert.equal(graficoPrevisione(null), null);
  assert.ok(graficoPrevisione({ abbastanza: true, casi: 40, mediano: 0.1, andataMale: -0.2, andataBene: 0.4 }));
});

test('l\'assottigliamento tiene i picchi invece di lisciarli via', () => {
  const v = Array.from({ length: 600 }, () => 100);
  v[321] = 300; // il picco che non deve sparire
  v[500] = 10;  // e il crollo
  const s = assottiglia(v, 60);
  assert.equal(s.length, 60);
  assert.ok(s.includes(300), 'il picco è stato perso: un campionamento ingenuo fa esattamente questo');
  assert.ok(s.includes(10), 'il crollo è stato perso');
  // Se la serie è già corta non si tocca.
  assert.equal(assottiglia([1, 2, 3], 60).length, 3);
});

test('i testi nei grafici sono protetti da caratteri che romperebbero l\'SVG', () => {
  const s = barre([{ nome: 'AT&T <script>', valore: 0.1 }]);
  assert.ok(!/<script>/.test(s), 'markup non neutralizzato');
  assert.match(s, /AT&amp;T/);
});
