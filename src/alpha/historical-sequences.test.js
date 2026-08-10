import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serieDisponibili, statisticheSerie, bootstrapSequence, crolliConfronto,
  mesiNegativiConsecutivi, autocorrelazioneAssoluti, ricostruisciPrezzi,
  contestoStorico, contestoText, fonteText, BLOCCO_MEDIO_MESI,
} from './historical-sequences.js';
import { SERIE_STORICHE } from './historical-returns.js';
import { makeRng, forcedSaleRisk } from './forced-sale-risk.js';

// ── I dati sono veri, e si può controllare che lo siano ──

test('le serie storiche dichiarano da dove vengono e quanto sono lunghe', () => {
  const s = serieDisponibili();
  const spy = s.find((x) => x.id === 'spy');
  assert.ok(spy, 'SPY deve esserci');
  assert.ok(spy.mesi > 380, `attesi oltre 380 mesi reali, trovati ${spy.mesi}`);
  assert.match(spy.fonte, /Yahoo/);
  assert.match(spy.da, /^\d{4}-\d{2}$/);
});

test('le statistiche di SPY corrispondono a quelle misurate altrove nel progetto', () => {
  const st = statisticheSerie('spy');
  // measured-assumptions.js dichiara mu 9,03% e sigma 15% per SPY buy&hold su
  // un campione simile: se questi numeri divergessero molto, una delle due
  // fonti sarebbe sbagliata.
  assert.ok(Math.abs(st.muAnnuo - 0.09) < 0.02, `mu annuo ${st.muAnnuo}`);
  assert.ok(Math.abs(st.sigmaAnnua - 0.15) < 0.02, `sigma annua ${st.sigmaAnnua}`);
});

test('LE CODE SONO GRASSE, ed è il motivo per cui esiste questo modulo', () => {
  const st = statisticheSerie('spy');
  // Curtosi 3 = normale. Sopra significa estremi più frequenti di quanto una
  // gaussiana ammetta.
  assert.ok(st.curtosi > 3.5, `curtosi ${st.curtosi}: se fosse ~3 il modello basterebbe`);
  assert.equal(st.codeGrasse, true);
  assert.ok(st.asimmetria < 0, 'i mercati scendono più violentemente di quanto salgano');
  assert.ok(st.peggiorMese < -0.15, `il mese peggiore dell'archivio è ${st.peggiorMese}`);
});

test('una serie inesistente fallisce subito e dice quali ci sono', () => {
  assert.throws(() => bootstrapSequence(12, makeRng(1), { serie: 'inventata' }), /serie storica sconosciuta/);
});

// ── Il bootstrap conserva ciò che deve conservare ──

test('il bootstrap restituisce solo rendimenti REALMENTE accaduti', () => {
  const veri = new Set(statisticheSerie('spy') && [] );
  const r = makeRng(3);
  const seq = bootstrapSequence(240, r);
  assert.equal(seq.length, 240);
  for (const x of seq) assert.ok(Number.isFinite(x));
  // Nessun valore inventato: ogni mese generato deve esistere nell'archivio.
  const { closes } = ricostruisciPrezzi('spy');
  const insieme = new Set();
  for (let i = 1; i < closes.length; i++) insieme.add(+(closes[i] / closes[i - 1] - 1).toFixed(6));
  const fuori = seq.filter((x) => !insieme.has(+x.toFixed(6)));
  assert.equal(fuori.length, 0, `${fuori.length} rendimenti non presenti nell'archivio`);
});

test('CONSERVA IL RAGGRUPPAMENTO DELLA VOLATILITÀ, che è la ragione dei blocchi', () => {
  const r = makeRng(9);
  const st = statisticheSerie('spy');
  const muM = st.muAnnuo / 12, sdM = st.sigmaAnnua / Math.sqrt(12);
  const gauss = () => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const reale = autocorrelazioneAssoluti(SERIE_STORICHE.spy.rendimenti);
  let boot = 0, modello = 0;
  const N = 300;
  for (let k = 0; k < N; k++) {
    boot += autocorrelazioneAssoluti(bootstrapSequence(120, r));
    modello += autocorrelazioneAssoluti(Array.from({ length: 120 }, () => Math.exp((muM - sdM * sdM / 2) + sdM * gauss()) - 1));
  }
  boot /= N; modello /= N;

  assert.ok(reale > 0.15, `l'archivio reale deve mostrare raggruppamento: ${reale}`);
  assert.ok(Math.abs(modello) < 0.05, `la log-normale non ne ha, per costruzione: ${modello}`);
  assert.ok(boot > 0.5 * reale, `il bootstrap deve conservarne la maggior parte: ${boot} contro ${reale}`);
});

test('IPOTESI MIA SMENTITA: il SEGNO non è la grandezza giusta da guardare', () => {
  // Documentato perché non venga ritentato: davo per scontato che il bootstrap
  // producesse sequenze negative più lunghe. È il contrario, e la ragione è
  // il diverso tasso di base di mesi negativi (37,5% reale contro ~43% del
  // modello), che sommerge l'effetto del raggruppamento.
  const r = makeRng(7);
  const st = statisticheSerie('spy');
  const muM = st.muAnnuo / 12, sdM = st.sigmaAnnua / Math.sqrt(12);
  const gauss = () => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let b = 0, m = 0;
  for (let k = 0; k < 300; k++) {
    b += mesiNegativiConsecutivi(bootstrapSequence(120, r));
    m += mesiNegativiConsecutivi(Array.from({ length: 120 }, () => Math.exp((muM - sdM * sdM / 2) + sdM * gauss()) - 1));
  }
  assert.ok(m > b, `il modello produce sequenze negative PIÙ lunghe: ${m / 300} contro ${b / 300}`);
  const negativi = SERIE_STORICHE.spy.rendimenti.filter((x) => x < 0).length / SERIE_STORICHE.spy.rendimenti.length;
  assert.ok(negativi < 0.42, `nell'archivio solo il ${(negativi * 100).toFixed(1)}% dei mesi è negativo`);
});

test('blocchi più lunghi conservano più raggruppamento, blocchi da 1 lo distruggono', () => {
  const r = makeRng(11);
  let lunghi = 0, singoli = 0;
  for (let k = 0; k < 250; k++) {
    lunghi += autocorrelazioneAssoluti(bootstrapSequence(120, r, { bloccoMedio: 24 }));
    singoli += autocorrelazioneAssoluti(bootstrapSequence(120, r, { bloccoMedio: 1 }));
  }
  assert.ok(lunghi / 250 > singoli / 250, `blocchi da 24: ${lunghi / 250}, da 1: ${singoli / 250}`);
  assert.ok(Math.abs(singoli / 250) < 0.06, 'con blocchi da un mese si perde tutta la struttura, come deve essere');
  assert.equal(BLOCCO_MEDIO_MESI, 12);
});

test('IL NUMERO CHE GIUSTIFICA TUTTO: la log-normale sottostima i crolli gravi', () => {
  const c = crolliConfronto({ mesi: 120, prove: 600, rng: makeRng(5) });
  assert.ok(c.storico.gravi > c.logNormale.gravi,
    `crollo grave storico ${c.storico.gravi} vs modello ${c.logNormale.gravi}`);
  // Non un decimale: una differenza che cambia una decisione.
  assert.ok(c.sottostimaGravi > 0.05,
    `il modello sottostima di soli ${(c.sottostimaGravi * 100).toFixed(1)} punti: troppo poco per giustificare il cambio`);
});

// ── L'innesto nel rischio di vendita forzata ──

test('INNESTO: con la storia vera il costo di essere costretti risulta PIÙ ALTO', () => {
  const usc = {};
  for (let a = 0; a < 5; a++) { usc[a * 12 + 5] = 3200; usc[a * 12 + 11] = 2100; }
  const base = {
    liquidita: 18000, sigmaReddito: 0.3, contributoMensile: 2600, speseMensili: 2400,
    portafoglio: 30000, usciteProgrammate: usc, mu: 0.0956, sigma: 0.148, mesi: 60,
  };
  const modello = forcedSaleRisk({ ...base, generatore: 'modello' }, { percorsi: 4000 });
  const storico = forcedSaleRisk({ ...base, generatore: 'storico' }, { percorsi: 4000 });
  assert.ok(storico.costoMedio > modello.costoMedio,
    `storico ${storico.costoMedio} deve superare il modello ${modello.costoMedio}`);
  // La differenza non è marginale: è la parte di rischio che un modello
  // gaussiano non sa produrre.
  assert.ok(storico.costoMedio / modello.costoMedio > 1.15,
    `divario solo del ${((storico.costoMedio / modello.costoMedio - 1) * 100).toFixed(0)}%`);
});

test('INNESTO: chi è ben protetto è quello che il modello inganna di più', () => {
  // Con poca cassa ti costringe a vendere qualunque cosa; con un buon
  // cuscinetto solo i crolli veri ti toccano — cioè esattamente quello che la
  // log-normale non sa generare. Il divario deve quindi CRESCERE col
  // cuscinetto, non calare.
  const usc = {};
  for (let a = 0; a < 5; a++) { usc[a * 12 + 5] = 3200; usc[a * 12 + 11] = 2100; }
  const base = {
    sigmaReddito: 0.3, contributoMensile: 2600, speseMensili: 2400,
    portafoglio: 30000, usciteProgrammate: usc, mu: 0.0956, sigma: 0.148, mesi: 60,
  };
  const divario = (liquidita) => {
    const m = forcedSaleRisk({ ...base, liquidita, generatore: 'modello' }, { percorsi: 4000 }).costoMedio;
    const s = forcedSaleRisk({ ...base, liquidita, generatore: 'storico' }, { percorsi: 4000 }).costoMedio;
    return s / m;
  };
  const poco = divario(12000), tanto = divario(25000);
  assert.ok(tanto > poco, `il divario deve crescere col cuscinetto: ${poco} -> ${tanto}`);
});

test('la storia vera è il comportamento PREDEFINITO: non un\'opzione avanzata', () => {
  const usc = { 5: 3200 };
  const base = { liquidita: 8000, sigmaReddito: 0.3, contributoMensile: 2600, speseMensili: 2400, portafoglio: 20000, usciteProgrammate: usc, mesi: 24 };
  const predefinito = forcedSaleRisk(base, { percorsi: 1500, seed: 4 });
  const esplicito = forcedSaleRisk({ ...base, generatore: 'storico' }, { percorsi: 1500, seed: 4 });
  assert.deepEqual(predefinito, esplicito);
});

// ── I cali, i recuperi e la stagionalità: market-cycles finalmente su dati veri ──

test('i prezzi ricostruiti dai rendimenti sono coerenti e datati correttamente', () => {
  const p = ricostruisciPrezzi('spy');
  assert.equal(p.closes.length, p.dates.length);
  assert.equal(p.dates[0], statisticheSerie('spy').da);
  assert.ok(p.closes.every((c) => c > 0), 'un prezzo non può essere negativo');
  // I mesi devono avanzare di uno alla volta, senza buchi.
  const num = (d) => { const [a, m] = d.split('-').map(Number); return a * 12 + m; };
  for (let i = 1; i < p.dates.length; i++) assert.equal(num(p.dates[i]) - num(p.dates[i - 1]), 1, `buco fra ${p.dates[i - 1]} e ${p.dates[i]}`);
});

test('I CALI VERI: quanti, quanto profondi, e quanto ci hanno messo a rientrare', async () => {
  const c = await contestoStorico('spy');
  assert.ok(c.episodi >= 4, `attesi almeno 4 cali importanti in trent'anni, trovati ${c.episodi}`);
  assert.ok(c.caloPeggiore > 40, `il calo peggiore dell'archivio è ${c.caloPeggiore}%`);
  assert.ok(c.recuperoMediano > 0 && c.recuperoPeggiore >= c.recuperoMediano);
  assert.match(contestoText(c), /non quello che succederà/);
});

test('PIÙ IL CALO È PROFONDO, PIÙ IL RECUPERO È LUNGO — e i numeri lo dicono', async () => {
  const c = await contestoStorico('spy');
  const perFascia = Object.fromEntries(c.perFascia.filter((r) => r.medianRecoveryMonths !== null).map((r) => [r.band, r.medianRecoveryMonths]));
  const leggeri = perFascia['10-20%'], gravi = perFascia['35%+'];
  if (leggeri !== undefined && gravi !== undefined) {
    assert.ok(gravi > leggeri * 3,
      `un calo oltre il 35% deve richiedere molto più tempo: ${gravi} mesi contro ${leggeri}`);
  }
});

test('LA STAGIONALITÀ VIENE SOTTOPOSTA A UN TEST, non pubblicata e basta', async () => {
  const c = await contestoStorico('spy');
  assert.equal(c.stagionalita.length, 12);
  // Con ~33 osservazioni per mese, la maggior parte dei mesi NON è
  // distinguibile da una moneta. Pubblicare dodici numeri come se fossero
  // tutti significativi sarebbe il modo più elegante di mentire.
  assert.ok(c.stagionalitaCredibile.length < 6,
    `troppi mesi dichiarati significativi (${c.stagionalitaCredibile.length}): con questo campione è implausibile`);
  assert.ok(c.stagionalita.every((m) => m.count > 20), 'ogni mese deve avere abbastanza osservazioni');
});

test('il testo sulla fonte dice esplicitamente che sono dati veri', () => {
  const t = fonteText('spy');
  assert.match(t, /realmente accaduti/);
  assert.match(t, /SPY/);
  assert.ok(!/bootstrap|curtosi|log-normale|stazionario/i.test(t), `gergo: ${t}`);
});

test('anche BTC è disponibile, con la sua volatilità vera', () => {
  const st = statisticheSerie('btc');
  assert.ok(st.sigmaAnnua > 0.5, `volatilità di BTC ${st.sigmaAnnua}: dovrebbe essere enorme`);
  assert.ok(st.mesi > 100);
  const seq = bootstrapSequence(36, makeRng(2), { serie: 'btc' });
  assert.equal(seq.length, 36);
});

// ── Il perché dei cali: contesto verificabile, mai una storia inventata ──

test('IL PERCHÉ: ogni calo trovato nei prezzi porta il nome dell\'evento, quando coincide', async () => {
  const { episodiConNome, episodioText } = await import('./historical-sequences.js');
  const ep = await episodiConNome('spy');
  assert.ok(ep.length >= 5);
  const gfc = ep.find((e) => e.fondo === '2009-02');
  assert.ok(gfc, 'il fondo della crisi finanziaria deve essere trovato DAI PREZZI');
  assert.match(gfc.nome, /Crisi finanziaria globale/);
  assert.ok(gfc.caloPct > 50);
  assert.equal(gfc.mesiPerRecuperare, 49);
  assert.match(episodioText(gfc), /da 2007-10 a 2009-02/);
  // Il covid c'è, e ha una firma diversa: crollo rapidissimo e recupero rapido.
  const covid = ep.find((e) => e.fondo === '2020-03');
  assert.match(covid.nome, /COVID/);
  assert.ok(covid.mesiDiDiscesa <= 3 && covid.mesiPerRecuperare <= 6,
    'il crollo da pandemia è stato il più rapido a scendere e a rientrare');
});

test('un\'etichetta è CONTESTO, e ogni riga lo dichiara', async () => {
  const { episodiConNome } = await import('./historical-sequences.js');
  const ep = await episodiConNome('spy');
  for (const e of ep.filter((x) => x.nome)) {
    assert.match(e.nota, /non una causa dimostrata/);
  }
});

test('nessun episodio inventato: le etichette esistono solo dove i prezzi trovano un calo', async () => {
  const { episodiConNome, EPISODI_NOTI } = await import('./historical-sequences.js');
  const ep = await episodiConNome('spy');
  const date = new Set(ep.map((e) => e.fondo));
  for (const noto of EPISODI_NOTI) {
    assert.ok(date.has(noto.fondo), `etichetta "${noto.nome}" senza un calo corrispondente nei dati (${noto.fondo})`);
  }
  // E su BTC, dove non abbiamo etichette, non ne compaiono per magia.
  const btc = await episodiConNome('btc');
  assert.ok(btc.every((e) => e.nome === null || EPISODI_NOTI.some((n) => n.fondo === e.fondo)));
});
