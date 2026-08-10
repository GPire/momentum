import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FONTI_NOTIZIE, leggiRss, leggiFederalRegister, prendiNotizie,
  reazioneAllaFed, reazioneText, cosaFecceroIMercati, MOSSE_FED,
} from './notizie.js';

// ── Le fonti ──

test('SOLO fonti ufficiali, e ognuna dichiara la propria licenza', () => {
  assert.ok(FONTI_NOTIZIE.length >= 4);
  for (const f of FONTI_NOTIZIE) {
    assert.ok(f.licenza && f.licenza.length > 10, `${f.chiave} senza licenza`);
    assert.equal(f.pulita, true, `${f.chiave}: qui dentro entrano solo fonti con diritti chiari`);
    assert.match(f.url, /^https:\/\//);
  }
  // Nessun aggregatore: sono loro il problema di licenza da cui siamo partiti.
  const domini = FONTI_NOTIZIE.map((f) => new URL(f.url).hostname);
  for (const d of domini) {
    assert.match(d, /federalreserve\.gov|ecb\.europa\.eu|federalregister\.gov|sec\.gov/,
      `${d} non è un emittente ufficiale`);
  }
});

// ── I lettori, provati su forme vere e su spazzatura ──

test('legge RSS con le date dentro CDATA — errore vero, trovato dal vivo', () => {
  const rss = `<rss><channel><item>
    <title>Federal Reserve issues FOMC statement</title>
    <link><![CDATA[https://www.federalreserve.gov/x.htm]]></link>
    <pubDate><![CDATA[Tue, 4 Aug 2026 20:30:00 GMT]]></pubDate>
  </item></channel></rss>`;
  const v = leggiRss(rss);
  assert.equal(v.length, 1);
  assert.equal(v[0].titolo, 'Federal Reserve issues FOMC statement');
  // Senza ripulire il CDATA la data usciva null, e l'ordinamento per data
  // diventava silenziosamente casuale.
  assert.equal(v[0].data, '2026-08-04');
  assert.match(v[0].link, /federalreserve/);
});

test('legge anche Atom, e non si fida di niente', () => {
  const atom = '<feed><entry><title>Un titolo</title><updated>2026-01-15T10:00:00Z</updated>'
    + '<link href="https://www.sec.gov/a"/></entry></feed>';
  assert.equal(leggiRss(atom)[0].data, '2026-01-15');
  // Spazzatura: lista vuota, mai un'eccezione. Un feed rotto non deve portare
  // giù la schermata di chi sta guardando altro.
  for (const b of [null, undefined, '', 'non xml', '<rss>', '{}', 42, {}]) {
    assert.deepEqual(leggiRss(b), [], `input ${JSON.stringify(b)}`);
  }
  assert.deepEqual(leggiFederalRegister('non json'), []);
  assert.deepEqual(leggiFederalRegister('{"results":"non un array"}'), []);
});

test('il markup dentro i titoli viene neutralizzato, non eseguito', () => {
  const rss = '<rss><item><title>Tasso &amp; inflazione &lt;b&gt;su&lt;/b&gt;</title></item></rss>';
  const v = leggiRss(rss);
  assert.equal(v[0].titolo, 'Tasso & inflazione <b>su</b>');
});

test('senza rete si risponde "non ho potuto", non si finge', async () => {
  const r = await prendiNotizie({ fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(r.voci, []);
  assert.match(r.errore, /nessuna fonte/);
  // È la condizione NORMALE per un'app che funziona senza rete: non è un errore
  // da mostrare all'utente come un guasto.
});

test('una fonte prolifica non può occupare tutta la lista', async () => {
  const finto = async (url) => ({
    ok: true,
    text: async () => (url.includes('federalregister')
      ? JSON.stringify({ results: Array.from({ length: 20 }, (_, i) => ({ title: `Atto ${i}`, publication_date: '2026-08-10', html_url: 'https://x' })) })
      : '<rss><item><title>Comunicato Fed</title><pubDate>Tue, 4 Aug 2026 20:30:00 GMT</pubDate></item></rss>'),
  });
  const r = await prendiNotizie({ fetchImpl: finto, quante: 8 });
  const daFr = r.voci.filter((v) => v.fonte === 'federalRegister').length;
  assert.ok(daFr <= 3, `il Federal Register ha preso ${daFr} posti su 8`);
  // E le banche centrali vengono prima, anche se le loro notizie sono più vecchie.
  assert.equal(r.voci[0].fonte, 'fed');
  // La fonte resta attaccata a ogni voce.
  for (const v of r.voci) assert.ok(v.nomeFonte && v.licenza);
});

test('lo stesso comunicato in due feed compare una volta sola', async () => {
  const stesso = '<rss><item><title>Federal Reserve issues FOMC statement</title><pubDate>Tue, 4 Aug 2026 20:30:00 GMT</pubDate></item></rss>';
  const finto = async () => ({ ok: true, text: async () => stesso });
  const r = await prendiNotizie({ fetchImpl: finto, quante: 8 });
  assert.equal(r.voci.length, 1, 'il comunicato monetario esce anche nel feed generale');
});

// ── La parte che rende il modulo diverso da un lettore di feed ──

test('I GIORNI DELLA FED sono davvero diversi: 2,6 volte più mossi', () => {
  const r = reazioneAllaFed('azioniUsa');
  assert.equal(r.valido, true);
  assert.equal(r.mosse, MOSSE_FED.length, 'nessuna mossa deve andare persa perché cade di sabato');
  // Ordine di grandezza: un movimento giornaliero di borsa sta sotto il 10%.
  // Con questo controllo avrei visto subito il bug dei "295% al giorno".
  assert.ok(r.ampiezzaMediaNeiGiorniFed > 0.005 && r.ampiezzaMediaNeiGiorniFed < 0.1,
    `ampiezza implausibile: ${r.ampiezzaMediaNeiGiorniFed}`);
  assert.ok(r.ampiezzaMediaNegliAltriGiorni > 0.002 && r.ampiezzaMediaNegliAltriGiorni < 0.05);
  assert.equal(r.giorniDiversi, true);
  assert.ok(r.ampiezzaMediaNeiGiorniFed - r.ampiezzaMediaNegliAltriGiorni > 2 * r.errore);
});

test('ma sulla DIREZIONE il modulo si rifiuta di dare una regola', () => {
  const t = reazioneText(reazioneAllaFed('azioniUsa'));
  assert.match(t, /sta indovinando/);
  assert.match(t, /17 casi|17 mosse/);
  assert.ok(!/quindi compra|quindi vendi|salira|scendera/i.test(t), `previsione: ${t}`);
});

test('dove NON c\'è differenza, il modulo lo dice invece di forzarla', () => {
  // Il bitcoin e il VIX nei giorni della Fed non sono distinguibili dal
  // rumore. Un modulo che trovasse un effetto ovunque non starebbe misurando.
  const esiti = ['azioniUsa', 'tecnologia', 'titoliStato', 'oro', 'vix', 'bitcoin']
    .map((m) => reazioneAllaFed(m)).filter((r) => r.valido);
  const diversi = esiti.filter((r) => r.giorniDiversi).length;
  assert.ok(diversi > 0 && diversi < esiti.length,
    `${diversi} su ${esiti.length}: se fossero tutti o nessuno, il criterio non starebbe discriminando`);
});

test('una data si lega ai mercati SENZA pretendere di averne trovato la causa', () => {
  const c = cosaFecceroIMercati('2022-06-16');
  assert.equal(c.valido, true);
  assert.ok(c.mercati.length >= 3);
  assert.match(c.avvertenza, /non che sia stata quella notizia a farlo succedere/);
  const fuori = cosaFecceroIMercati('1999-01-01');
  assert.equal(fuori.valido, false);
  assert.match(fuori.motivo, /archivio giornaliero/);
});
