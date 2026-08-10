import test from 'node:test';
import assert from 'node:assert/strict';
import { linea, barre, distribuzione, graficoPrevisione, assottiglia, POCHI_PUNTI } from './grafici.js';

// Il grafico non è più solo un SVG: è una figura con dentro il disegno e sotto
// la frase che spiega cosa si sta guardando. La didascalia sta FUORI dall'SVG
// perché dentro sarebbe un'immagine per un lettore di schermo.
const svgValido = (s) => {
  assert.ok(typeof s === 'string', 'non è una stringa');
  assert.ok(s.startsWith('<figure') || s.startsWith('<svg'), `forma inattesa: ${s.slice(0, 40)}`);
  assert.ok(s.includes('<svg') && s.includes('</svg>'));
  // Ogni tag aperto deve chiudersi: un SVG rotto non dà errore, semplicemente
  // non si vede, ed è il modo peggiore di fallire.
  const aperti = (s.match(/<(svg|text|rect|path|line|circle|title|figure|figcaption)\b/g) || []).length;
  const chiusi = (s.match(/<\/(svg|text|title|figure|figcaption)>|\/>/g) || []).length;
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

// ── Le regole di lettura: la parte che decide se lo capisce anche un bambino ──

test('OGNI grafico porta una frase in italiano che dice cosa si sta guardando', () => {
  const casi = [
    linea([10, 12, 9, 15, 14, 20, 18, 25], { etichette: ['1985', '', '', '', '', '', '', '2025'] }),
    barre([{ nome: 'Italia', valore: -0.28 }, { nome: 'Spagna', valore: 0.05 }]),
    distribuzione({ mediano: 0.08, andataMale: -0.51, andataBene: 1.25, casi: 29 }),
  ];
  for (const g of casi) {
    assert.match(g, /<figcaption class="g-dice">/, 'manca la spiegazione');
    const frase = g.match(/<figcaption class="g-dice">([^<]+)</)[1];
    assert.ok(frase.length > 40, `spiegazione troppo corta: ${frase}`);
    // Niente gergo: se serve sapere cos'è una mediana per leggerla, non serve.
    assert.ok(!/mediana|percentile|deviazione|correlazion|asse (x|y)|trend/i.test(frase),
      `gergo nella spiegazione: ${frase}`);
  }
});

test('la spiegazione della linea si scrive DA SOLA leggendo i dati', () => {
  const sale = linea([10, 20, 30, 40, 50, 60, 70, 80], { etichette: Array(8).fill('') });
  assert.match(sale, /Oggi vale di piu&#39;|Oggi vale di piu'/);
  const scende = linea([80, 70, 60, 50, 40, 30, 20, 10]);
  assert.match(scende, /Oggi vale di meno/);
  // E se siamo sotto un vecchio massimo lo dice, perché è il fatto che conta.
  const dopoIlPicco = linea([10, 40, 100, 60, 50, 45, 44, 43], { etichette: ['1980', '', '1990', '', '', '', '', '2025'] });
  assert.match(dopoIlPicco, /massimo/);
});

test('un numero solo è protagonista: gli altri restano piccoli', () => {
  const s = linea([10, 12, 9, 15, 14, 20, 18, 25]);
  const eroi = (s.match(/class="g-eroe"/g) || []).length;
  assert.equal(eroi, 1, 'con due numeri grandi l\'occhio non trova dove fermarsi');
  assert.match(s, /font-size="14"/);
});

test('le barre crescono DALLA LINEA DELLO ZERO, e il movimento è sfalsato', () => {
  const s = barre([{ nome: 'a', valore: 0.5 }, { nome: 'b', valore: -0.3 }, { nome: 'c', valore: 0.2 }]);
  // L'origine della trasformazione deve stare sullo zero, non sul bordo:
  // è ciò che fa "sentire" la base invece di doverla cercare.
  const origini = [...s.matchAll(/transform-origin:([\d.]+)px/g)].map((m) => m[1]);
  assert.equal(origini.length, 3);
  assert.equal(new Set(origini).size, 1, 'tutte le barre devono partire dallo stesso zero');
  // Lo sfalsamento c'è ma resta breve: uno stagger lungo si legge come lentezza.
  const ritardi = [...s.matchAll(/animation-delay:(\d+)ms/g)].map((m) => +m[1]);
  assert.deepEqual(ritardi, [0, 45, 90]);
  assert.ok(Math.max(...ritardi) < 400, 'sfalsamento troppo lungo');
});

test('tutte le animazioni passano da classi CSS, così si possono spegnere', () => {
  // Nessuna animazione scritta dentro l'SVG con SMIL o con uno style inline
  // completo: chi ha chiesto meno movimento deve poterlo togliere davvero,
  // e con prefers-reduced-motion questo si spegne dal foglio di stile.
  const tutti = [
    linea([1, 2, 3, 4, 5, 6, 7, 8]),
    barre([{ nome: 'a', valore: 0.5 }]),
    distribuzione({ mediano: 0.1, andataMale: -0.2, andataBene: 0.4, casi: 30 }),
  ].join('');
  assert.ok(!/<animate|<set\b/.test(tutti), 'animazione SMIL: non si spegne con prefers-reduced-motion');
  assert.match(tutti, /class="g-traccia"/);
  assert.match(tutti, /class="g-barra"/);
});

test('TUTTI dello stesso segno: si usa tutta la larghezza, non meta\'', () => {
  // Bug visto solo guardando il grafico vero: dodici Paesi tutti sotto zero
  // dividevano l'asse in due e lasciavano meta' figura vuota, facendo sembrare
  // le differenze la meta' di quanto sono.
  const negativi = [{ nome: 'Giappone', valore: -0.36 }, { nome: 'Italia', valore: -0.28 }, { nome: 'Svezia', valore: -0.19 }];
  const s = barre(negativi);
  const origini = [...s.matchAll(/transform-origin:([\d.]+)px/g)].map((m) => +m[1]);
  const zero = origini[0];
  // Con tutti negativi lo zero sta a DESTRA della zona barre, non in mezzo.
  assert.ok(zero > 200, `zero a ${zero}: con tutti negativi deve stare a destra`);
  // E la barra piu' lunga usa quasi tutta la zona disponibile.
  const larghezze = [...s.matchAll(/height="20"/g)];
  assert.equal(larghezze.length, 3);
  assert.match(s, /crescono verso sinistra/, 'la spiegazione deve dire da che parte si legge');

  // A segni misti, invece, lo zero torna in mezzo.
  const misti = barre([{ nome: 'a', valore: -0.3 }, { nome: 'b', valore: 0.4 }]);
  const zeroMisto = [...misti.matchAll(/transform-origin:([\d.]+)px/g)].map((m) => +m[1])[0];
  assert.ok(zeroMisto < zero, 'con entrambi i segni lo zero deve stare piu\' a sinistra (in mezzo)');
  assert.match(misti, /riga verticale in mezzo/);

  // Tutti positivi: zero a sinistra, si cresce verso destra.
  const positivi = barre([{ nome: 'a', valore: 0.3 }, { nome: 'b', valore: 0.9 }]);
  const zeroPos = [...positivi.matchAll(/transform-origin:([\d.]+)px/g)].map((m) => +m[1])[0];
  assert.ok(zeroPos < zeroMisto, 'con tutti positivi lo zero e\' il bordo sinistro');
  // Nella didascalia l'apostrofo è escapato in entità HTML: il test deve
  // cercare quello che finisce davvero nella pagina, non quello che ho scritto
  // nel sorgente.
  assert.match(positivi, /Barre piu(&#39;|') lunghe/);
});
