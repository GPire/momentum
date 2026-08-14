// Il pannello storico non aveva NESSUN test: e' il motivo per cui un mese
// inesistente (2026-07 duplicato nei dati grezzi di Yahoo) e' rimasto dentro
// senza che nulla se ne accorgesse, pur essendo gia' visibile come incoerenza
// fra il conteggio dichiarato e le date dichiarate.
// Questi controlli valgono per QUALUNQUE rigenerazione futura del file.
import test from 'node:test';
import assert from 'node:assert/strict';

const hp = await import('./historical-panel.js');

const mesiFra = (da, a) => {
  const [a0, m0] = da.split('-').map(Number);
  const [a1, m1] = a.split('-').map(Number);
  return (a1 - a0) * 12 + (m1 - m0) + 1;
};

test('il numero di mesi dichiarato coincide con le date dichiarate (l incoerenza che nascondeva il mese fantasma)', () => {
  const [da, a] = hp.DATE_PANNELLO;
  assert.equal(hp.MESI_PANNELLO, mesiFra(da, a),
    `MESI_PANNELLO=${hp.MESI_PANNELLO} ma da ${da} a ${a} ci sono ${mesiFra(da, a)} mesi`);
});

test('ogni settore ha esattamente i mesi dichiarati, e tutti la stessa lunghezza (allineamento per data)', () => {
  for (const s of hp.PANNELLO_SETTORI) {
    assert.equal(s.r.length, hp.MESI_PANNELLO, `${s.simbolo} ha ${s.r.length} mesi invece di ${hp.MESI_PANNELLO}`);
  }
});

test('NESSUN mese ha tutti i settori a zero: sarebbe un mese inesistente, non un mese calmo', () => {
  // Un mese cosi' non capita nemmeno a borsa chiusa: e' la firma di un
  // duplicato nei dati grezzi. Falsava dispersione, correlazioni e bootstrap.
  for (let t = 0; t < hp.MESI_PANNELLO; t++) {
    const tuttiZero = hp.PANNELLO_SETTORI.every((s) => s.r[t] === 0);
    assert.ok(!tuttiZero, `il mese di indice ${t} ha tutti e nove i settori a zero: dato inventato`);
  }
});

test('NESSUN mese ha tutti i settori identici fra loro: stessa firma, forma piu' + ' generale', () => {
  for (let t = 0; t < hp.MESI_PANNELLO; t++) {
    const primo = hp.PANNELLO_SETTORI[0].r[t];
    const tuttiUguali = hp.PANNELLO_SETTORI.every((s) => s.r[t] === primo);
    assert.ok(!tuttiUguali, `il mese di indice ${t} ha nove settori con lo stesso identico rendimento`);
  }
});

test('i rendimenti sono numeri finiti e plausibili: nessun buco diventato zero, nessun valore assurdo', () => {
  for (const s of hp.PANNELLO_SETTORI) {
    for (let t = 0; t < s.r.length; t++) {
      const v = s.r[t];
      assert.ok(Number.isFinite(v), `${s.simbolo}[${t}] non e' un numero`);
      // Un settore che in un mese fa piu' di +100% o meno di -90% sarebbe un
      // errore di dati, non un mercato: nemmeno nel 2008 e' successo.
      assert.ok(v > -0.9 && v < 1, `${s.simbolo}[${t}] = ${v}: fuori da ogni intervallo plausibile`);
    }
  }
});

test('i nove settori attesi ci sono tutti e con un nome leggibile', () => {
  assert.equal(hp.PANNELLO_SETTORI.length, 9);
  const simboli = hp.PANNELLO_SETTORI.map((s) => s.simbolo).sort();
  assert.deepEqual(simboli, ['XLB', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLU', 'XLV', 'XLY']);
  for (const s of hp.PANNELLO_SETTORI) assert.ok(s.nome && s.nome.length > 2, `${s.simbolo} senza nome leggibile`);
});

test('la finestra contiene davvero le crisi che il file dichiara di contenere', () => {
  // dot-com, 2008, COVID, 2022: se la finestra si accorciasse, il pannello
  // perderebbe il suo valore e va saputo subito.
  const [da, a] = hp.DATE_PANNELLO;
  assert.ok(da <= '2000-03', `la finestra deve iniziare prima del dot-com, inizia a ${da}`);
  assert.ok(a >= '2022-12', `la finestra deve arrivare oltre il 2022, arriva a ${a}`);
  assert.ok(hp.MESI_PANNELLO > 300, 'servono piu di 25 anni di storia');
});
