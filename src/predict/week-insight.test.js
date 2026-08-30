import test from "node:test";
import assert from "node:assert/strict";

const { weekCategoryInsight } = await import("./week-insight.js");

// Costruisce la mappa {monthKey: [tx]} come nel vault reale.
function vault(voci) {
  const out = {};
  for (const [data, categoria, importo] of voci) {
    const k = data.slice(0, 7);
    (out[k] ||= []).push({ date: data, category: categoria, amount: importo, type: 'uscita' });
  }
  return out;
}

// Lunedì 24 agosto 2026. Le settimane precedenti sono 17/08, 10/08, 03/08...
const LUNEDI = new Date(2026, 7, 24);

test("settimana senza spese: nessun consiglio, motivo dichiarato", () => {
  const r = weekCategoryInsight(vault([]), LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.equal(r.tipo, null);
  assert.equal(r.motivo, 'nessuna-spesa');
});

test("storico troppo corto: dice che non sa ancora, mai un consiglio inventato", () => {
  const v = vault([
    ['2026-08-25', 'ristoranti', 60],
    ['2026-08-18', 'ristoranti', 20], // una sola settimana di storico
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.equal(r.tipo, null);
  assert.equal(r.motivo, 'poco-storico');
  assert.equal(r.settimane, 1);
});

test("categoria molto sopra il solito: la segnala col valore vero e col tipico", () => {
  const v = vault([
    ['2026-08-25', 'ristoranti', 90],
    ['2026-08-18', 'ristoranti', 20],
    ['2026-08-11', 'ristoranti', 20],
    ['2026-08-04', 'ristoranti', 20],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.equal(r.tipo, 'sopra');
  assert.equal(r.categoria, 'ristoranti');
  assert.equal(r.valore, 90);
  assert.equal(r.tipico, 20);
  assert.equal(r.settimane, 3);
});

test("confronto a PARI GIORNI: a metà settimana non confronta con settimane intere", () => {
  // Questa settimana: 30 € speso il lunedì. Le settimane passate hanno 30 € il
  // lunedì e altri 60 € più avanti nella settimana. Guardando solo il lunedì
  // (oggi è lunedì) il comportamento è identico → nessun allarme.
  const v = vault([
    ['2026-08-24', 'spesa', 30],
    ['2026-08-17', 'spesa', 30], ['2026-08-20', 'spesa', 60],
    ['2026-08-10', 'spesa', 30], ['2026-08-13', 'spesa', 60],
    ['2026-08-03', 'spesa', 30], ['2026-08-06', 'spesa', 60],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 24) });
  assert.equal(r.giorni, 1);
  assert.equal(r.tipo, null);
  assert.equal(r.motivo, 'in-linea');
});

test("mediana, non media: una sola settimana anomala non alza l'asticella", () => {
  // Tipico reale 20 €, ma una settimana da 300 €. La media sarebbe 113 € e
  // nasconderebbe una settimana da 60 €; la mediana (20 €) la segnala.
  const v = vault([
    ['2026-08-25', 'shopping', 60],
    ['2026-08-18', 'shopping', 20],
    ['2026-08-11', 'shopping', 300],
    ['2026-08-04', 'shopping', 20],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.equal(r.tipo, 'sopra');
  assert.equal(r.tipico, 20);
});

test("un eccesso irrilevante sul totale della settimana non diventa un consiglio", () => {
  // Trasporti triplicato (3 € invece di 1 €) ma la settimana vale 500 €:
  // segnalarlo sarebbe rumore. Nessuna soglia in euro: conta il peso relativo.
  const v = vault([
    ['2026-08-25', 'trasporti', 3], ['2026-08-25', 'casa', 500],
    ['2026-08-18', 'trasporti', 1], ['2026-08-18', 'casa', 500],
    ['2026-08-11', 'trasporti', 1], ['2026-08-11', 'casa', 500],
    ['2026-08-04', 'trasporti', 1], ['2026-08-04', 'casa', 500],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.notEqual(r.tipo, 'sopra');
});

test("rientro reale su una categoria abituale: riconosciuto come comportamento sano", () => {
  const v = vault([
    ['2026-08-25', 'spesa', 40],
    ['2026-08-18', 'ristoranti', 80], ['2026-08-18', 'spesa', 40],
    ['2026-08-11', 'ristoranti', 80], ['2026-08-11', 'spesa', 40],
    ['2026-08-04', 'ristoranti', 80], ['2026-08-04', 'spesa', 40],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.equal(r.tipo, 'sotto');
  assert.equal(r.categoria, 'ristoranti');
  assert.equal(r.valore, 0);
  assert.equal(r.tipico, 80);
});

test("una categoria comparsa una sola volta non ha un 'solito' e non viene giudicata", () => {
  const v = vault([
    ['2026-08-25', 'viaggi', 400],
    ['2026-08-18', 'spesa', 40],
    ['2026-08-11', 'spesa', 40],
    ['2026-08-04', 'spesa', 40],
  ]);
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.notEqual(r.categoria, 'viaggi');
});

test("le entrate non entrano mai nel conto delle spese", () => {
  const v = vault([
    ['2026-08-25', 'spesa', 40],
    ['2026-08-18', 'spesa', 40],
    ['2026-08-11', 'spesa', 40],
    ['2026-08-04', 'spesa', 40],
  ]);
  v['2026-08'].push({ date: '2026-08-25', category: 'stipendio', amount: 2000, type: 'entrata' });
  const r = weekCategoryInsight(v, LUNEDI, { oggi: new Date(2026, 7, 30) });
  assert.notEqual(r.categoria, 'stipendio');
});

test("settimana a cavallo di due mesi: legge da entrambi i mesi del vault", () => {
  // Lunedì 29 giugno 2026 → la settimana finisce il 5 luglio.
  const lunedi = new Date(2026, 5, 29);
  const v = vault([
    ['2026-07-02', 'ristoranti', 90],
    ['2026-06-22', 'ristoranti', 20],
    ['2026-06-15', 'ristoranti', 20],
    ['2026-06-08', 'ristoranti', 20],
  ]);
  const r = weekCategoryInsight(v, lunedi, { oggi: new Date(2026, 6, 6) });
  assert.equal(r.tipo, 'sopra');
  assert.equal(r.valore, 90);
});
