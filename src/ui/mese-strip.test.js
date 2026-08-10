import test from 'node:test';
import assert from 'node:assert/strict';
import { giornoDelloStipendio, statoDelMese, stripHtml, MINIME_PER_LO_SCHEMA } from './mese-strip.js';

const entrata = (date, amount = 1850) => ({ type: 'entrata', date, amount });
const uscita = (date, amount = 50) => ({ type: 'uscita', date, amount });

test('il giorno dello stipendio si OSSERVA, non si chiede', () => {
  const tx = {
    '2026-05': [entrata('2026-05-27'), uscita('2026-05-01')],
    '2026-06': [entrata('2026-06-27'), uscita('2026-06-01')],
    '2026-07': [entrata('2026-07-27')],
  };
  const p = giornoDelloStipendio(tx, { meseCorrente: '2026-08' });
  assert.equal(p.giorno, 27);
  assert.equal(p.osservazioni, 3);
});

test('la MODA e non la media: fra il 3 e il 27 la media darebbe un giorno in cui non arriva niente', () => {
  const tx = {
    '2026-04': [entrata('2026-04-27')], '2026-05': [entrata('2026-05-27')],
    '2026-06': [entrata('2026-06-27')], '2026-07': [entrata('2026-07-03')],
  };
  const p = giornoDelloStipendio(tx, { meseCorrente: '2026-08' });
  assert.equal(p.giorno, 27, 'la media avrebbe dato il 21, giorno in cui non è mai arrivato niente');
});

test('senza uno SCHEMA non si inventa un giorno', () => {
  // Due sole entrate: troppo poche.
  assert.equal(giornoDelloStipendio({ '2026-06': [entrata('2026-06-11')], '2026-07': [entrata('2026-07-11')] }, { meseCorrente: '2026-08' }), null);
  assert.equal(MINIME_PER_LO_SCHEMA, 3);
  // Tre entrate ma tutte in giorni diversi: nessuno schema, nessun segno.
  const sparse = { '2026-05': [entrata('2026-05-04')], '2026-06': [entrata('2026-06-17')], '2026-07': [entrata('2026-07-28')] };
  assert.equal(giornoDelloStipendio(sparse, { meseCorrente: '2026-08' }), null);
  assert.equal(giornoDelloStipendio(null), null);
  assert.equal(giornoDelloStipendio({}), null);
});

test('il mese in corso non fa scuola: è a metà per definizione', () => {
  const tx = {
    '2026-05': [entrata('2026-05-27')], '2026-06': [entrata('2026-06-27')],
    '2026-07': [entrata('2026-07-27')],
    '2026-08': [entrata('2026-08-02'), entrata('2026-08-03'), entrata('2026-08-04')],
  };
  assert.equal(giornoDelloStipendio(tx, { meseCorrente: '2026-08' }).giorno, 27);
});

test('lo stato dice A CHE PUNTO del mese siamo e quanto manca alla paga', () => {
  const tx = { '2026-05': [entrata('2026-05-27')], '2026-06': [entrata('2026-06-27')], '2026-07': [entrata('2026-07-27')], '2026-08': [uscita('2026-08-01', 650)] };
  const s = statoDelMese(tx, { oggi: new Date(2026, 7, 10), speso: 922.13 });
  assert.equal(s.giorniTotali, 31);
  assert.equal(s.giornoOggi, 10);
  assert.equal(s.giornoPaga, 27);
  assert.equal(s.entrataArrivata, false);
  assert.equal(s.giorniAllaPaga, 17, '"deve ancora arrivare" non distingue 3 giorni da 17: la striscia sì');
  assert.ok(s.quotaPassata > 0.3 && s.quotaPassata < 0.35);
});

test('se lo stipendio è già arrivato, il prossimo è quello del mese dopo', () => {
  const tx = { '2026-05': [entrata('2026-05-05')], '2026-06': [entrata('2026-06-05')], '2026-07': [entrata('2026-07-05')], '2026-08': [entrata('2026-08-05')] };
  const s = statoDelMese(tx, { oggi: new Date(2026, 7, 20) });
  assert.equal(s.entrataArrivata, true);
  assert.equal(s.giorniAllaPaga, 16, '11 giorni a fine mese + 5');
});

// ── La striscia ──

test('la striscia MOSTRA quello che la frase raccontava', () => {
  const tx = { '2026-05': [entrata('2026-05-27')], '2026-06': [entrata('2026-06-27')], '2026-07': [entrata('2026-07-27')], '2026-08': [uscita('2026-08-01', 650)] };
  const h = stripHtml(statoDelMese(tx, { oggi: new Date(2026, 7, 10), speso: 922.13 }), { formatMoney: (v) => `${v.toFixed(2)} €` });
  assert.match(h, /ms-oggi/);
  assert.match(h, /ms-paga/);
  assert.match(h, /stipendio fra 17 giorni/, 'il numero di giorni è l\'informazione che la frase non dava');
  assert.match(h, /922\.13 € spesi/);
  // Accessibile: chi non vede la striscia deve ricevere la stessa cosa a parole.
  assert.match(h, /role="img"/);
  assert.match(h, /aria-label="[^"]*Giorno 10 di 31/);
});

test('"oggi" e "domani" invece di "fra 0 giorni"', () => {
  const base = { '2026-05': [entrata('2026-05-27')], '2026-06': [entrata('2026-06-27')], '2026-07': [entrata('2026-07-27')] };
  assert.match(stripHtml(statoDelMese(base, { oggi: new Date(2026, 7, 27) })), /stipendio oggi/);
  assert.match(stripHtml(statoDelMese(base, { oggi: new Date(2026, 7, 26) })), /stipendio domani/);
});

test('a stipendio arrivato il segno SPARISCE: indicare un giorno passato è rumore', () => {
  const tx = { '2026-05': [entrata('2026-05-05')], '2026-06': [entrata('2026-06-05')], '2026-07': [entrata('2026-07-05')], '2026-08': [entrata('2026-08-05')] };
  const h = stripHtml(statoDelMese(tx, { oggi: new Date(2026, 7, 20), speso: 400 }));
  assert.ok(!/ms-paga/.test(h), 'il segno della paga non deve restare dopo che è arrivata');
  assert.ok(!/stipendio fra/.test(h));
  assert.match(h, /ms-oggi/, 'ma dove siamo nel mese resta utile');
});

test('senza dati non si disegna niente invece di disegnare una striscia vuota', () => {
  assert.equal(stripHtml(null), '');
  assert.equal(stripHtml({}), '');
  const senzaSchema = statoDelMese({}, { oggi: new Date(2026, 7, 10), speso: 0 });
  const h = stripHtml(senzaSchema);
  assert.match(h, /ms-oggi/, 'il punto del mese si sa comunque');
  assert.ok(!/ms-paga/.test(h), 'ma il giorno di paga no, e non si inventa');
});

test('i valori percentuali restano dentro i limiti anche con date strane', () => {
  for (const g of [1, 15, 28, 31]) {
    const h = stripHtml(statoDelMese({}, { oggi: new Date(2026, 0, g), speso: 10 }));
    const perc = [...h.matchAll(/left:([\d.]+)%/g)].map((m) => +m[1]);
    for (const p of perc) assert.ok(p >= 0 && p <= 100, `percentuale fuori scala: ${p}`);
    assert.ok(!/NaN|undefined/.test(h));
  }
});

test('le settimane danno la SCALA: senza, "fra 17 giorni" resta astratto', () => {
  const tx = { '2026-05': [entrata('2026-05-27')], '2026-06': [entrata('2026-06-27')], '2026-07': [entrata('2026-07-27')] };
  const h = stripHtml(statoDelMese(tx, { oggi: new Date(2026, 7, 10), speso: 900 }));
  const stelle = [...h.matchAll(/class="ms-sett/g)].length;
  assert.equal(stelle, 4, 'agosto ha 31 giorni: settimane al 7, 14, 21, 28');
  // Quelle già superate si spengono: sono tappe fatte.
  assert.equal([...h.matchAll(/ms-sett passata/g)].length, 1, 'il 10 agosto ne è passata una sola');
  // E la scia c'è solo attaccata a oggi, non sparsa in giro.
  assert.equal([...h.matchAll(/ms-scia/g)].length, 1);
});

test('a febbraio le settimane sono quattro, non cinque', () => {
  const h = stripHtml(statoDelMese({}, { oggi: new Date(2026, 1, 5), speso: 0 }));
  const stelle = [...h.matchAll(/class="ms-sett/g)].length;
  assert.equal(stelle, 3, '28 giorni: 7, 14, 21 — il 28 è l\'ultimo giorno, non un traguardo intermedio');
});
