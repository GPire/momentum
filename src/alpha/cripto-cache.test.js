'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuovaCache, salva, cuci, rendimenti, pianoAggiornamento, giorniMancanti, freschezza, MAX_GIORNI_PER_CUCIRE, elencoValido, salvaElenco, GIORNI_VALIDITA_ELENCO } from './cripto-cache.js';

const G = (d) => new Date(d).getTime();

test('IL PROBLEMA RISOLTO: la seconda volta non servono richieste', () => {
  // CoinGecko gratuito chiude la porta dopo poche richieste ravvicinate:
  // chiedendo otto monete di fila ne arrivano quattro (misurato). La risposta
  // non è aggirare il limite ma smettere di averne bisogno — un prezzo di
  // ieri non cambia mai più.
  let c = nuovaCache();
  const primo = pianoAggiornamento(c, ['BTC', 'ETH', 'SOL'], { adesso: G('2026-08-20') });
  assert.equal(primo.richieste, 3, 'la prima volta si scarica tutto');

  for (const s of ['BTC', 'ETH', 'SOL']) c = salva(c, s, [{ data: '2026-08-20', prezzo: 100 }]);
  const secondo = pianoAggiornamento(c, ['BTC', 'ETH', 'SOL'], { adesso: G('2026-08-20') });
  assert.equal(secondo.richieste, 0, 'lo stesso giorno non serve nulla');
  assert.match(secondo.messaggio, /nessuna richiesta/);
});

test('il giorno dopo serve UNA richiesta per moneta, non l\'intero anno', () => {
  let c = nuovaCache();
  for (const s of ['BTC', 'ETH']) c = salva(c, s, [{ data: '2026-08-20', prezzo: 100 }]);
  const p = pianoAggiornamento(c, ['BTC', 'ETH'], { adesso: G('2026-08-22') });
  assert.equal(p.daCucire.length, 2);
  assert.equal(p.daScaricare.length, 0);
  assert.equal(p.daCucire[0].giorni, 2);
});

test('con un buco troppo grande si riscarica invece di cucire', () => {
  // Se l'archivio ha mesi di buco, la richiesta incrementale non risparmia
  // niente e cucire due tratti lontani è solo un rischio in più.
  let c = salva(nuovaCache(), 'BTC', [{ data: '2026-01-01', prezzo: 100 }]);
  const p = pianoAggiornamento(c, ['BTC'], { adesso: G('2026-08-20') });
  assert.deepEqual(p.daScaricare, ['BTC']);
  assert.equal(p.daCucire.length, 0);
  assert.ok(MAX_GIORNI_PER_CUCIRE <= 60);
});

test('CUCIRE non duplica né somma: a parità di giorno vince il più recente', () => {
  // Una fonte può correggere un prezzo provvisorio: il valore nuovo deve
  // sostituire il vecchio, non affiancarsi.
  const uniti = cuci(
    [{ data: '2026-08-18', prezzo: 60000 }, { data: '2026-08-19', prezzo: 61000 }],
    [{ data: '2026-08-19', prezzo: 61500 }, { data: '2026-08-20', prezzo: 62000 }],
  );
  assert.equal(uniti.length, 3, 'tre giorni distinti, non quattro');
  assert.equal(uniti[1].prezzo, 61500, 'il prezzo corretto sostituisce il provvisorio');
  for (let i = 1; i < uniti.length; i++) assert.ok(uniti[i].data > uniti[i - 1].data, 'ordinati per data');
});

test('cuci ignora i punti malformati invece di propagarli', () => {
  const u = cuci([{ data: '2026-01-01', prezzo: 10 }], [{ data: null, prezzo: 5 }, { data: '2026-01-02', prezzo: NaN }, { data: '2026-01-03', prezzo: 12 }]);
  assert.deepEqual(u.map((x) => x.data), ['2026-01-01', '2026-01-03']);
});

test('i rendimenti si calcolano dalla cache, saltando i prezzi non validi', () => {
  const c = salva(nuovaCache(), 'BTC', [
    { data: '2026-01-01', prezzo: 100 }, { data: '2026-01-02', prezzo: 110 }, { data: '2026-01-03', prezzo: 99 },
  ]);
  const r = rendimenti(c, 'BTC');
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.1) < 1e-9);
  assert.equal(rendimenti(c, 'MAI-VISTA'), null);
});

test('LA FRESCHEZZA VA DETTA: un\'analisi su prezzi vecchi non è di adesso', () => {
  let c = salva(nuovaCache(), 'BTC', [{ data: '2026-08-20', prezzo: 100 }]);
  c = salva(c, 'ETH', [{ data: '2026-08-01', prezzo: 50 }]);
  const f = freschezza(c, ['BTC', 'ETH'], { adesso: G('2026-08-20') });
  assert.equal(f.fresca, false);
  assert.equal(f.giorniPeggiore, 19, 'conta il dato PEGGIORE, non la media');
  assert.match(f.messaggio, /non e' una fotografia di adesso/);
});

test('una moneta mai vista richiede lo scaricamento completo', () => {
  assert.equal(giorniMancanti(undefined), Infinity);
  assert.equal(giorniMancanti({ ultimoGiorno: '2026-08-20' }, G('2026-08-20')), 0);
});

test('salvare non muta la cache precedente', () => {
  // Lo stato dell'app è condiviso: una funzione che muta in silenzio è il
  // modo più veloce di far comparire dati dove non dovrebbero esserci.
  const a = nuovaCache();
  const b = salva(a, 'BTC', [{ data: '2026-01-01', prezzo: 1 }]);
  assert.equal(Object.keys(a.monete).length, 0);
  assert.equal(Object.keys(b.monete).length, 1);
});

// ── ANCHE L'ELENCO VA IN CACHE ──
test('L\'ELENCO CHIESTO OGNI VOLTA FACEVA FALLIRE TUTTO IL RAMO CRIPTO', () => {
  // Trovato provando l'app: la prima versione teneva i PREZZI ma chiedeva ogni
  // volta alla rete quali fossero le prime monete per capitalizzazione. Quella
  // richiesta è piccola ma conta come tutte le altre nel limite: al secondo
  // giro CoinGecko l'ha rifiutata, l'intero ramo cripto è fallito in silenzio,
  // e "sono diversificato sulle cripto?" ha ricevuto la risposta
  // sull'assorbimento delle AZIONI.
  // Una risposta di un altro argomento è peggio di un errore: l'utente non ha
  // modo di accorgersene.
  const monete = [{ id: 'bitcoin', simbolo: 'BTC' }, { id: 'ethereum', simbolo: 'ETH' }];
  let c = nuovaCache();
  assert.equal(elencoValido(c), null, 'una cache nuova non ha elenco');

  c = salvaElenco(c, monete);
  assert.deepEqual(elencoValido(c, { adesso: G('2026-08-20') }), monete);
});

test('l\'elenco scade: la classifica per capitalizzazione cambia, anche se di rado', () => {
  const c = salvaElenco(nuovaCache(), [{ id: 'bitcoin', simbolo: 'BTC' }]);
  const dopoUnGiorno = elencoValido(c, { adesso: Date.now() + 86400000 });
  assert.ok(dopoUnGiorno, 'il giorno dopo vale ancora');
  const dopoUnMese = elencoValido(c, { adesso: Date.now() + 30 * 86400000 });
  assert.equal(dopoUnMese, null, 'dopo un mese va richiesto');
  assert.ok(GIORNI_VALIDITA_ELENCO >= 3 && GIORNI_VALIDITA_ELENCO <= 30);
});

test('salvaElenco non muta la cache precedente', () => {
  const a = nuovaCache();
  const b = salvaElenco(a, [{ id: 'x', simbolo: 'X' }]);
  assert.equal(a.elenco, null);
  assert.ok(b.elenco.monete.length === 1);
});
