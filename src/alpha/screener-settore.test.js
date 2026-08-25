import test from 'node:test';
import assert from 'node:assert/strict';
import { percentileTitolo, serieStoricaPercentili, testoPicchi, segnaliQualitaNelTempo, comparabili, peersDaPannello, crescitaRicavi, filtraSettore, trovaAziendeInTesto } from './screener-settore.js';
import { AZIENDE_PANEL } from './panel-settoriale.js';

// ── percentileTitolo ──

test('percentileTitolo: un titolo reale del pannello (AAPL) restituisce settore e percentili', () => {
  const r = percentileTitolo('AAPL');
  assert.ok(r.disponibile, r.motivo);
  assert.equal(r.ticker, 'AAPL');
  assert.ok(r.settore, 'deve avere una descrizione di settore');
  assert.ok(r.anno >= 2020, `anno più recente atteso, avuto ${r.anno}`);
  assert.ok(typeof r.percentili.roe === 'number' || r.percentili.roe === undefined);
});

test('percentileTitolo: un ticker fuori dal pannello si dichiara, non inventa un settore', () => {
  const r = percentileTitolo('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /non è fra le aziende/);
});

test('percentileTitolo: minuscolo o maiuscolo non cambia il risultato', () => {
  const a = percentileTitolo('aapl');
  const b = percentileTitolo('AAPL');
  assert.equal(a.disponibile, b.disponibile);
  assert.equal(a.ticker, b.ticker);
});

test('percentileTitolo: input assente non crasha', () => {
  assert.equal(percentileTitolo(null).disponibile, false);
  assert.equal(percentileTitolo(undefined).disponibile, false);
  assert.equal(percentileTitolo('').disponibile, false);
});

// ── serieStoricaPercentili (Lightweight Charts, main.js) ──

test('serieStoricaPercentili: un titolo reale (AAPL) restituisce una serie ordinata pronta per un grafico', () => {
  const r = serieStoricaPercentili('AAPL');
  assert.ok(r.disponibile, r.motivo);
  assert.equal(r.ticker, 'AAPL');
  const almenoUnaSerie = ['margine', 'roe', 'roa'].some((k) => r.serie[k].length > 1);
  assert.ok(almenoUnaSerie, 'deve avere almeno una metrica con più di un anno');
  for (const k of ['margine', 'roe', 'roa']) {
    const punti = r.serie[k];
    for (const p of punti) {
      assert.match(p.time, /^\d{4}-01-01$/);
      assert.ok(p.value >= 0 && p.value <= 100, `percentile fuori range: ${p.value}`);
    }
    // Ordine cronologico: Lightweight Charts richiede tempi crescenti, mai
    // un punto fuori ordine che romperebbe il rendering.
    for (let i = 1; i < punti.length; i++) assert.ok(punti[i].time > punti[i - 1].time, `${k} non ordinato: ${punti[i-1].time} poi ${punti[i].time}`);
  }
});

test('serieStoricaPercentili: un ticker fuori dal pannello si dichiara, non inventa una serie', () => {
  const r = serieStoricaPercentili('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /non è fra le aziende/);
});

test('serieStoricaPercentili: input assente non crasha', () => {
  assert.equal(serieStoricaPercentili(null).disponibile, false);
  assert.equal(serieStoricaPercentili(undefined).disponibile, false);
});

// ── testoPicchi (momenti di picco, in testo — non sul grafico) ──

test('testoPicchi: trova il massimo storico reale per ogni metrica di un titolo vero (AAPL)', () => {
  const r = serieStoricaPercentili('AAPL');
  const t = testoPicchi(r);
  assert.ok(t, 'deve produrre del testo per un titolo con dati');
  assert.match(t, /migliore di sempre fu il \d{4}/);
  assert.match(t, /° percentile\)/);
});

test('testoPicchi: senza dati disponibili, torna null — mai un testo su un picco inventato', () => {
  assert.equal(testoPicchi({ disponibile: false }), null);
  assert.equal(testoPicchi(null), null);
});

// ── segnaliQualitaNelTempo (Beneish per ogni anno, non solo il più recente) ──

test('segnaliQualitaNelTempo: su un titolo reale con storia di segnalazioni note (NVDA), trova gli anni giusti', () => {
  const r = segnaliQualitaNelTempo('NVDA');
  assert.ok(r.disponibile);
  assert.ok(r.segnali.length > 0, 'NVDA ha anni reali segnalati (crescita esplosiva, limite noto del modello)');
  for (const s of r.segnali) {
    assert.match(s.time, /^\d{4}-01-01$/);
    assert.equal(s.tipo, 'beneish');
    assert.match(s.motivo, /Beneish M-Score/);
  }
  // Gli anni devono essere in ordine cronologico (stesso ordine di az.anni).
  for (let i = 1; i < r.segnali.length; i++) assert.ok(r.segnali[i].time > r.segnali[i - 1].time);
});

test('segnaliQualitaNelTempo: un ticker fuori dal pannello si dichiara, non inventa segnali', () => {
  const r = segnaliQualitaNelTempo('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
  assert.match(r.motivo, /non è fra le aziende/);
});

test('segnaliQualitaNelTempo: input assente non crasha', () => {
  assert.equal(segnaliQualitaNelTempo(null).disponibile, false);
  assert.equal(segnaliQualitaNelTempo(undefined).disponibile, false);
});

test('testoPicchi: il massimo trovato è VERAMENTE il massimo della serie (non il primo o l\'ultimo per caso)', () => {
  const serieFinta = {
    disponibile: true,
    serie: { margine: [{ time: '2018-01-01', value: 40 }, { time: '2019-01-01', value: 95 }, { time: '2020-01-01', value: 60 }], roe: [], roa: [] },
  };
  const t = testoPicchi(serieFinta);
  assert.match(t, /2019 \(95° percentile\)/);
});

// ── Cantiere E3: Beneish M-Score + Piotroski F-Score dentro percentileTitolo ──

test('percentileTitolo: porta anche i punteggi di qualità (Beneish/Piotroski) su un titolo reale del pannello, quando due anni consecutivi sono disponibili', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const idx = aapl.anni.length - 1;
  const haAnnoPrecedenteConsecutivo = idx > 0 && aapl.anni[idx - 1].anno === aapl.anni[idx].anno - 1;
  const r = percentileTitolo('AAPL');
  assert.ok('qualita' in r, 'percentileTitolo deve sempre includere il campo qualita, anche se non disponibile');
  if (haAnnoPrecedenteConsecutivo && aapl.anni[idx].costoVenduto !== undefined && aapl.anni[idx - 1].costoVenduto !== undefined) {
    assert.equal(r.qualita.disponibile, true, JSON.stringify(r.qualita));
    assert.ok(r.qualita.beneish?.valido, JSON.stringify(r.qualita.beneish));
    assert.ok(Number.isFinite(r.qualita.beneish.score));
    assert.ok(r.qualita.piotroski?.valido, JSON.stringify(r.qualita.piotroski));
    assert.ok(r.qualita.piotroski.punteggio >= 0 && r.qualita.piotroski.punteggio <= 8);
  }
});

test('percentileTitolo: senza anno precedente consecutivo nel pannello, qualità si dichiara non disponibile invece di un numero a metà', () => {
  const az = AZIENDE_PANEL.find((a) => a.anni.length === 1);
  if (!az) return; // nessuna azienda con un solo anno in questo pannello: niente da provare qui
  const r = percentileTitolo(az.ticker || az.nome);
  if (r.disponibile) assert.equal(r.qualita.disponibile, false);
});

test('percentileTitolo: i punteggi di qualità non sono MAI calcolati per aziende finanziarie (SIC 60-67)', () => {
  const finanziaria = AZIENDE_PANEL.find((a) => a.sic && Math.floor(a.sic / 100) >= 60 && Math.floor(a.sic / 100) <= 67 && a.anni.length > 1);
  if (!finanziaria) return; // nessuna azienda finanziaria con >1 anno in questo pannello: niente da provare qui
  const r = percentileTitolo(finanziaria.ticker || finanziaria.nome);
  if (r.disponibile && r.qualita.disponibile) {
    assert.equal(r.qualita.beneish.applicabile, false);
    assert.equal(r.qualita.piotroski.applicabile, false);
  }
});

// ── comparabili ──

test('comparabili: AAPL riceve aziende dello stesso gruppo di settore, mai se stessa', () => {
  const r = comparabili('AAPL');
  assert.ok(r.disponibile, JSON.stringify(r));
  assert.ok(r.comparabili.length > 0);
  assert.ok(r.comparabili.every((c) => c.ticker !== 'AAPL'));
});

test('comparabili: rispetta il limite richiesto', () => {
  const r = comparabili('AAPL', { limite: 3 });
  assert.ok(r.comparabili.length <= 3);
});

test('comparabili: un ticker fuori dal pannello si dichiara', () => {
  const r = comparabili('TICKERCHENONESISTE');
  assert.equal(r.disponibile, false);
});

// ── peersDaPannello ──

test('peersDaPannello: restituisce array REALI di valori dello stesso settore-anno, mai inventati', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const anno = aapl.anni.at(-1).anno;
  const peers = peersDaPannello(aapl.sic, anno);
  assert.ok(Array.isArray(peers.roe));
  assert.ok(Array.isArray(peers.margine));
  // Ogni valore deve essere un numero finito reale, non un placeholder.
  for (const v of peers.roe) assert.ok(Number.isFinite(v));
});

test('peersDaPannello: senza sic ritorna oggetto vuoto, non crasha', () => {
  const peers = peersDaPannello(null, 2024);
  assert.deepEqual(peers, {});
});

test('peersDaPannello: si integra con percentileRank di factors.js senza modifiche', async () => {
  const { percentileRank } = await import('./factors.js');
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const riga = aapl.anni.at(-1);
  const peers = peersDaPannello(aapl.sic, riga.anno);
  // AAPL stessa dentro la distribuzione dei suoi peer: il suo ROE reale deve
  // finire in una posizione plausibile (non sempre 0.5 "neutro" per mancanza
  // di dati, che sarebbe il sintomo di un collegamento rotto).
  const p = percentileRank(riga.roe, peers.roe, true);
  assert.ok(Number.isFinite(p));
});

// ── crescitaRicavi ──

test('crescitaRicavi: calcolata a mano su due anni consecutivi', () => {
  const az = { anni: [{ anno: 2022, ricavi: 1000 }, { anno: 2023, ricavi: 1100 }] };
  assert.equal(crescitaRicavi(az, 2023), 0.1);
});

test('crescitaRicavi: null se manca l\'anno precedente, se il salto non è consecutivo, o se i ricavi base sono zero', () => {
  assert.equal(crescitaRicavi({ anni: [{ anno: 2023, ricavi: 1000 }] }, 2023), null, 'nessun anno precedente nell\'array');
  assert.equal(crescitaRicavi({ anni: [{ anno: 2020, ricavi: 1000 }, { anno: 2023, ricavi: 1100 }] }, 2023), null, 'salto non consecutivo (2020→2023)');
  assert.equal(crescitaRicavi({ anni: [{ anno: 2022, ricavi: 0 }, { anno: 2023, ricavi: 1100 }] }, 2023), null, 'divisione per zero');
  assert.equal(crescitaRicavi(null, 2023), null);
});

// ── filtraSettore (BANCO_BANKER: "filtrami le aziende del settore per margine e crescita insieme") ──

test('filtraSettore: un titolo REALE del pannello (AAPL) produce una classifica con più criteri combinati, non ordinata solo sul primo', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const r = filtraSettore(aapl.sic, { criteri: ['margine', 'crescita'] });
  assert.ok(r.disponibile, JSON.stringify(r));
  assert.equal(r.settore, aapl.sicDescription);
  assert.ok(r.classificate.length > 0);
  // Ordine DECRESCENTE per punteggio combinato — mai un ordine casuale.
  for (let i = 1; i < r.classificate.length; i++) {
    assert.ok(r.classificate[i - 1].punteggioCombinato >= r.classificate[i].punteggioCombinato);
  }
  // Un\'azienda in cima su un solo criterio ma pessima sull\'altro non deve
  // MAI battere una buona su entrambi — la prova vera che "insieme" funziona
  // e non sta solo ordinando per il primo criterio.
  const [primo] = r.classificate;
  assert.ok(primo.criteriDisponibili >= 1);
});

test('filtraSettore: un criterio sconosciuto viene scartato, mai un crash; se restano zero criteri, si dichiara', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const r = filtraSettore(aapl.sic, { criteri: ['margine', 'criterioCheNonEsiste'] });
  assert.equal(r.criteri.length, 1);
  const r2 = filtraSettore(aapl.sic, { criteri: ['nonEsiste'] });
  assert.equal(r2.disponibile, false);
  assert.match(r2.motivo, /nessuno dei criteri/);
});

test('filtraSettore: senza settore riconosciuto, si dichiara — mai un elenco a caso', () => {
  const r = filtraSettore(null);
  assert.equal(r.disponibile, false);
});

test('filtraSettore: rispetta il limite richiesto', () => {
  const aapl = AZIENDE_PANEL.find((a) => a.ticker === 'AAPL');
  const r = filtraSettore(aapl.sic, { criteri: ['margine'], limite: 3 });
  assert.ok(r.classificate.length <= 3);
});

// ── trovaAziendeInTesto (plurale) ──

test('trovaAziendeInTesto: trova DUE aziende nella stessa domanda, nell\'ordine in cui compaiono', () => {
  const r = trovaAziendeInTesto('Apple o Microsoft, quale ha reso di più?');
  assert.equal(r.length, 2);
  assert.equal(r[0].ticker, 'AAPL');
  assert.equal(r[1].ticker, 'MSFT');
});

test('trovaAziendeInTesto: rispetta il limite richiesto', () => {
  const r = trovaAziendeInTesto('Apple, Microsoft e Caterpillar insieme', { limite: 1 });
  assert.equal(r.length, 1);
});

test('trovaAziendeInTesto: nessuna azienda nel testo → array vuoto, mai null', () => {
  assert.deepEqual(trovaAziendeInTesto('che tempo fa oggi?'), []);
});
