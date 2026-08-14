import test from 'node:test';
import assert from 'node:assert/strict';

const dc = await import('./divario-comportamento.js');
const ms = await import('./market-stress.js');

// Costruisce transazioni { 'YYYY-MM': [{type:'invest', amount}] }
const tx = (coppie) => Object.fromEntries(coppie.map(([m, a]) => [m, [{ type: 'invest', amount: a }]]));
const mesiConsecutivi = (daAnno, daMese, quanti) => Array.from({ length: quanti }, (_, k) => {
  const t = (daMese - 1) + k;
  return `${daAnno + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
});

test('indiceDiMese: il primo mese del pannello è indice 0, i mesi fuori finestra sono null', () => {
  assert.equal(dc.indiceDiMese('1999-02'), 0);
  assert.equal(dc.indiceDiMese('1999-03'), 1);
  assert.equal(dc.indiceDiMese('2000-02'), 12);
  assert.equal(dc.indiceDiMese('1998-01'), null, 'prima del pannello');
  assert.equal(dc.indiceDiMese('2099-01'), null, 'dopo il pannello');
  assert.equal(dc.indiceDiMese('non-una-data'), null);
});

test('versamentiPerMese: conta SOLO i movimenti invest, non entrate e uscite', () => {
  const t = {
    '2024-01': [{ type: 'invest', amount: 100 }, { type: 'uscita', amount: 500 }, { type: 'entrata', amount: 2000 }],
    '2024-02': [{ type: 'uscita', amount: 300 }],
  };
  const v = dc.versamentiPerMese(t);
  assert.equal(v.perMese.size, 1);
  assert.equal(v.perMese.get(dc.indiceDiMese('2024-01')), 100);
});

test('versamentiPerMese: i versamenti fuori dalla finestra storica sono DICHIARATI, non ignorati in silenzio', () => {
  const v = dc.versamentiPerMese(tx([['1990-01', 500], ['2024-01', 100]]));
  assert.equal(v.fuoriFinestra, 500);
  assert.equal(v.perMese.size, 1);
});

test('divarioComportamento: rifiuta con pochi versamenti invece di giudicare su un campione', () => {
  const d = dc.divarioComportamento(tx([['2024-01', 100], ['2024-02', 100]]));
  assert.equal(d.valutabile, false);
  assert.equal(d.versamenti, 2);
  assert.match(d.motivo, /almeno/);
  assert.equal(dc.divarioText(d), null);
});

test('CONTROLLO DECISIVO — chi versa già la stessa cifra ogni mese HA divario zero (il confronto non è truccato)', () => {
  const mesi = mesiConsecutivi(2023, 1, 24);
  const d = dc.divarioComportamento(tx(mesi.map((m) => [m, 200])));
  assert.equal(d.valutabile, true);
  // È letteralmente il piano di accumulo con cui viene confrontato: differenza nulla.
  assert.ok(Math.abs(d.divario) < 1e-9, `divario atteso 0, trovato ${d.divario}`);
  assert.ok(Math.abs(d.divarioEuro) < 0.01);
  assert.equal(d.rilevante, false);
});

test('divarioComportamento: importi diversi ma stessi mesi → il totale versato resta quello vero', () => {
  const mesi = mesiConsecutivi(2023, 1, 12);
  const d = dc.divarioComportamento(tx(mesi.map((m, k) => [m, 100 + k * 10])));
  const atteso = mesi.reduce((s, _, k) => s + 100 + k * 10, 0);
  assert.equal(d.totaleVersato, atteso);
  assert.equal(d.versamenti, 12);
});

// Il tempismo buono o cattivo si definisce sul rendimento SUCCESSIVO al
// versamento (dal mese in cui entri fino a oggi), non su quello del mese
// stesso: è quello che il denaro versato sperimenta davvero.
const rendimentoDaQuiInPoi = (mese) => {
  const mercato = ms.rendimentoMercato();
  let v = 1;
  for (let t = dc.indiceDiMese(mese); t < mercato.length; t++) v *= (1 + mercato[t]);
  return v - 1;
};

test('divarioComportamento: azzeccare i mesi migliori batte il piano di accumulo', () => {
  const finestra = mesiConsecutivi(2022, 1, 30);
  const migliori = [...finestra].sort((a, b) => rendimentoDaQuiInPoi(b) - rendimentoDaQuiInPoi(a)).slice(0, 8);
  // Primo e ultimo mese inclusi con una briciola: fissano lo stesso ARCO per
  // entrambe le strategie, così l'unica differenza resta il QUANDO.
  const coppie = [[finestra[0], 0.01], [finestra[finestra.length - 1], 0.01], ...migliori.map((m) => [m, 1000])];
  const d = dc.divarioComportamento(tx(coppie));
  assert.equal(d.valutabile, true);
  assert.ok(d.divario > 0, `azzeccare i mesi deve battere il PAC, divario=${d.divario}`);
  assert.equal(d.aTuoFavore, true);
  assert.ok(d.divarioEuro > 0);
});

test('divarioComportamento: sbagliare i mesi costa rispetto al piano di accumulo', () => {
  const finestra = mesiConsecutivi(2022, 1, 30);
  const peggiori = [...finestra].sort((a, b) => rendimentoDaQuiInPoi(a) - rendimentoDaQuiInPoi(b)).slice(0, 8);
  const coppie = [[finestra[0], 0.01], [finestra[finestra.length - 1], 0.01], ...peggiori.map((m) => [m, 1000])];
  const d = dc.divarioComportamento(tx(coppie));
  assert.ok(d.divario < 0, `sbagliare i mesi deve costare, divario=${d.divario}`);
  assert.equal(d.aTuoFavore, false);
  assert.ok(d.divarioEuro < 0);
});

test('divarioComportamento: il divario in euro concorda di segno con quello in percentuale', () => {
  const mesi = mesiConsecutivi(2021, 1, 20);
  const d = dc.divarioComportamento(tx(mesi.map((m, k) => [m, k % 3 === 0 ? 900 : 100])));
  assert.equal(Math.sign(d.divario), Math.sign(d.divarioEuro));
  assert.ok(Math.abs(d.valoreReale - d.valorePac - d.divarioEuro) < 0.02);
});

test('tempismoDeiVersamenti: versare sempre uguale NON risulta inseguire i massimi', () => {
  const mesi = mesiConsecutivi(2015, 1, 60);
  const t = dc.tempismoDeiVersamenti(tx(mesi.map((m) => [m, 100])));
  assert.equal(t.valutabile, true);
  assert.equal(t.inseguiIMassimi, false, `posizione media ${t.posizioneMedia}`);
});

test('tempismoDeiVersamenti: la posizione media sta sempre fra 0 e 1', () => {
  const mesi = mesiConsecutivi(2018, 1, 40);
  const t = dc.tempismoDeiVersamenti(tx(mesi.map((m, k) => [m, 50 + k * 20])));
  assert.ok(t.posizioneMedia >= 0 && t.posizioneMedia <= 1);
  for (const p of t.punti) assert.ok(p.posizione >= 0 && p.posizione <= 1);
});

test('tempismoDeiVersamenti: rifiuta senza abbastanza storia precedente', () => {
  const t = dc.tempismoDeiVersamenti(tx([['1999-03', 100], ['1999-04', 100]]));
  assert.equal(t.valutabile, false);
});

test('divarioText: dice le cose in euro e senza gergo tecnico', () => {
  const mesi = mesiConsecutivi(2021, 1, 20);
  const d = dc.divarioComportamento(tx(mesi.map((m, k) => [m, k % 3 === 0 ? 900 : 100])));
  const testo = dc.divarioText(d);
  assert.match(testo, /€/);
  assert.doesNotMatch(testo, /money.weighted|IRR|Dietz|percentile|bootstrap|volatilit/i);
});

test('divarioText: quando è andata BENE lo dice, senza cercare una colpa a tutti i costi', () => {
  const finestra = mesiConsecutivi(2022, 1, 30);
  const migliori = [...finestra].sort((a, b) => rendimentoDaQuiInPoi(b) - rendimentoDaQuiInPoi(a)).slice(0, 8);
  const d = dc.divarioComportamento(tx([[finestra[0], 0.01], [finestra[29], 0.01], ...migliori.map((m) => [m, 1000])]));
  const testo = dc.divarioText(d);
  assert.match(testo, /guadagnare|andata bene/i);
  // ...ma senza trasformarlo in un complimento che incoraggia a rifarlo.
  assert.match(testo, /piu' facile da riconoscere dopo|più facile da riconoscere dopo/i);
});

test('divarioText: non promette e non consiglia mai una mossa futura', () => {
  const mesi = mesiConsecutivi(2021, 1, 20);
  const d = dc.divarioComportamento(tx(mesi.map((m, k) => [m, k % 3 === 0 ? 900 : 100])));
  const testo = dc.divarioText(d, dc.tempismoDeiVersamenti(tx(mesi.map((m) => [m, 100]))));
  assert.doesNotMatch(testo, /dovresti|ti consiglio|compra ora|vendi|prevedo|guadagnerai/i);
});

test('IL PROBLEMA DELL INVECCHIAMENTO: senza coda i versamenti dopo il pannello cadono fuori finestra', () => {
  // Il pannello finisce a 2026-07: agosto e settembre 2026 non hanno un
  // mercato con cui essere confrontati, e finiscono in `fuoriFinestra`.
  const v = dc.versamentiPerMese(tx([['2026-08', 300], ['2026-09', 300]]));
  assert.equal(v.perMese.size, 0);
  assert.equal(v.fuoriFinestra, 600);
});

test('LA SOLUZIONE: con la coda dal vivo gli stessi versamenti rientrano nel conto', () => {
  const coda = { punti: [{ mese: '2026-08', rendimento: 0.01 }, { mese: '2026-09', rendimento: 0.02 }] };
  const v = dc.versamentiPerMese(tx([['2026-08', 300], ['2026-09', 300]]), { coda });
  assert.equal(v.perMese.size, 2, 'i due mesi devono essere ora misurabili');
  assert.equal(v.fuoriFinestra, 0);
});

test('la coda estende davvero il divario: un versamento nel mese nuovo viene valutato', () => {
  const coda = { punti: [{ mese: '2026-08', rendimento: 0.05 }] };
  const mesi = [...mesiConsecutivi(2026, 1, 7), '2026-08'];
  const senza = dc.divarioComportamento(tx(mesi.map((m) => [m, 100])));
  const con = dc.divarioComportamento(tx(mesi.map((m) => [m, 100])), { coda });
  assert.equal(senza.versamenti, 7, 'senza coda agosto è escluso');
  assert.equal(con.versamenti, 8, 'con la coda agosto rientra');
  assert.equal(con.a, '2026-08');
});

test('fonteDivario: dichiara sempre da dove vengono i numeri e che non c è senno di poi', () => {
  const f = dc.fonteDivario();
  assert.match(f, /settori/);
  assert.match(f, /mesi reali/);
  assert.match(f, /senno di poi/);
});
