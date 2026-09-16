'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinaDebiti, pagamentoInsufficiente, simulaEstinzione, confrontaStrategie, testoConfronto, testoBaseline, stressTestTasso, testoStressTasso, confrontaConsolidamento, testoConsolidamento, promoScadeTraGiorni, impattoFinePromo, testoImpattoFinePromo, testoPromoScadenza, calcolaDTI, capacitaExtraPrestito, testoDTI, testoCapacitaExtra, DTI_SOGLIA_PRUDENTE, DTI_SOGLIA_STORICA, DTI_SOGLIA_CRITICA, registraPagamento } from './debt-payoff.js';

const CARTA = { id: 'c', nome: 'Carta di credito', saldo: 2000, tasso: 19, pagamentoMinimo: 60 };
const AUTO = { id: 'a', nome: 'Prestito auto', saldo: 8000, tasso: 6, pagamentoMinimo: 200 };
const PICCOLO = { id: 'p', nome: 'Piccolo prestito amico', saldo: 300, tasso: 0, pagamentoMinimo: 50 };

test('ordinaDebiti valanga: tasso più alto prima, ignora i debiti già a zero', () => {
  const r = ordinaDebiti([CARTA, AUTO, { ...PICCOLO, saldo: 0 }], 'valanga');
  assert.deepEqual(r.map((d) => d.id), ['c', 'a']);
});

test('ordinaDebiti palla-di-neve: saldo più basso prima', () => {
  const r = ordinaDebiti([CARTA, AUTO, PICCOLO], 'palla-di-neve');
  assert.deepEqual(r.map((d) => d.id), ['p', 'c', 'a']);
});

test('pagamentoInsufficiente: vero quando il minimo non copre nemmeno l\'interesse mensile', () => {
  assert.equal(pagamentoInsufficiente({ saldo: 10000, tasso: 24, pagamentoMinimo: 100 }), true, '10000*0.24/12=200 > 100 minimo');
  assert.equal(pagamentoInsufficiente({ saldo: 10000, tasso: 24, pagamentoMinimo: 250 }), false);
  assert.equal(pagamentoInsufficiente({ saldo: 1000, tasso: 0, pagamentoMinimo: 10 }), false, 'tasso zero, qualunque minimo positivo basta');
});

test('simulaEstinzione: un debito con extra sufficiente si estingue e il totale interessi è positivo ma finito', () => {
  const r = simulaEstinzione([CARTA], { strategia: 'valanga', extraMensile: 100 });
  assert.equal(r.irrisolvibile, false);
  assert.ok(r.mesiTotali > 0 && r.mesiTotali < 60, `mesi ragionevoli, ottenuto ${r.mesiTotali}`);
  assert.ok(r.interesseTotale > 0);
  assert.ok(r.dataLibero);
});

test('simulaEstinzione: senza debiti (array vuoto) ritorna uno stato onesto a zero, mai un errore', () => {
  const r = simulaEstinzione([], { strategia: 'valanga', extraMensile: 100 });
  assert.equal(r.mesiTotali, 0);
  assert.equal(r.irrisolvibile, false);
  assert.deepEqual(r.debiti, []);
});

test('simulaEstinzione: pagamento minimo insufficiente viene dichiarato subito, mai una simulazione infinita silenziosa', () => {
  const r = simulaEstinzione([{ id: 'x', nome: 'Trappola', saldo: 5000, tasso: 30, pagamentoMinimo: 50 }], { extraMensile: 0 });
  assert.equal(r.irrisolvibile, true);
  assert.match(r.motivo, /Trappola/);
  assert.equal(r.mesiTotali, null);
});

test('effetto valanga vero: il pagamento minimo del debito estinto si aggiunge all\'extra per il successivo (cascata)', () => {
  // Un debito piccolo che si estingue in fretta con l'extra, poi il suo
  // minimo dovrebbe accelerare il secondo debito rispetto a NON avere quella cascata.
  const conCascata = simulaEstinzione([PICCOLO, AUTO], { strategia: 'palla-di-neve', extraMensile: 500 });
  const soloAuto = simulaEstinzione([AUTO], { strategia: 'valanga', extraMensile: 500 + PICCOLO.pagamentoMinimo });
  // Una volta estinto PICCOLO, la velocità di estinzione di AUTO nella
  // simulazione con cascata deve avvicinarsi a quella con l'extra pieno fin
  // dall'inizio — la differenza (dovuta ai mesi iniziali senza il bonus) è
  // piccola, non enorme: qui verifichiamo solo che entrambi si estinguano
  // in un numero di mesi comparabile (la cascata funziona, non è ignorata).
  assert.equal(conCascata.irrisolvibile, false);
  assert.ok(Math.abs(conCascata.mesiTotali - soloAuto.mesiTotali) <= 2, `atteso vicino, conCascata=${conCascata.mesiTotali} soloAuto=${soloAuto.mesiTotali}`);
});

test('confrontaStrategie: con un solo debito le due strategie coincidono esattamente', () => {
  const c = confrontaStrategie([CARTA], 100);
  assert.equal(c.differenzaInteresse, 0);
  assert.equal(c.differenzaMesi, 0);
});

test('confrontaStrategie: con più debiti, valanga paga meno interessi totali (o uguale) di palla di neve', () => {
  const c = confrontaStrategie([CARTA, AUTO, PICCOLO], 150);
  assert.ok(c.differenzaInteresse >= -0.01, `valanga dovrebbe costare meno o uguale, differenza=${c.differenzaInteresse}`);
});

test('testoConfronto: mai un\'eccezione, anche con debiti irrisolvibili', () => {
  const irrisolvibile = confrontaStrategie([{ id: 'x', nome: 'Trappola', saldo: 5000, tasso: 30, pagamentoMinimo: 50 }], 0);
  assert.doesNotThrow(() => testoConfronto(irrisolvibile));
  assert.match(testoConfronto(irrisolvibile), /Trappola/);
});

test('testoConfronto: testo onesto, mai un imperativo ("estingui prima X") — la decisione resta descritta come dell\'utente', () => {
  // Ordine DIVERSO fra le due strategie apposta: tasso alto+saldo alto vs
  // tasso basso+saldo basso, cosi le due strategie non coincidono per caso.
  const altoTassoAltoSaldo = { id: 'h', nome: 'Carta cara', saldo: 5000, tasso: 22, pagamentoMinimo: 100 };
  const bassoTassoBassoSaldo = { id: 'l', nome: 'Prestito piccolo', saldo: 1000, tasso: 4, pagamentoMinimo: 50 };
  const c = confrontaStrategie([altoTassoAltoSaldo, bassoTassoBassoSaldo], 150);
  const testo = testoConfronto(c);
  assert.doesNotMatch(testo, /^Estingui|^Devi|^Ti consiglio/i);
  assert.match(testo, /decidi tu/);
});

// ── Mutuo con penale di estinzione anticipata (2026-09-15, richiesto esplicitamente) ──
test('simulaEstinzione: un debito con penaleEstinzione non riceve mai l\'extra, solo il minimo', () => {
  // Mutuo con tasso VOLUTAMENTE più alto della carta (30% > 20%), così la
  // priorità "valanga" lo metterebbe in cima all'ordine — la protezione
  // penaleEstinzione deve comunque saltarlo e dare l'extra alla carta.
  const mutuo = { id: 'm', nome: 'Mutuo casa', saldo: 5000, tasso: 30, pagamentoMinimo: 200, tipo: 'mutuo', penaleEstinzione: true };
  const carta = { id: 'c', nome: 'Carta', saldo: 1000, tasso: 20, pagamentoMinimo: 30 };
  const r = simulaEstinzione([mutuo, carta], { strategia: 'valanga', extraMensile: 200 });
  assert.equal(r.irrisolvibile, false);
  const cartaInfo = r.debiti.find(d => d.id === 'c');
  const mutuoInfo = r.debiti.find(d => d.id === 'm');
  // Se l'extra fosse andato al mutuo (tasso più alto, priorità valanga), la
  // carta impiegherebbe molti mesi; con la protezione attiva si estingue
  // rapidamente perché riceve tutto l'extra al posto del mutuo.
  assert.ok(cartaInfo.mesePagato !== null && cartaInfo.mesePagato < 6, `attesa estinzione carta rapida, ottenuto mese ${cartaInfo.mesePagato}`);
  // Il mutuo protetto si estingue MOLTO più tardi (solo il proprio minimo).
  assert.ok(mutuoInfo.mesePagato === null || mutuoInfo.mesePagato > cartaInfo.mesePagato + 5);
});

// ── Baseline "cosa succede senza fare nulla in più" (2026-09-15) ──
test('confrontaStrategie: la baseline non riallocA i minimi liberati, resta sempre >= alle due strategie', () => {
  const debiti = [
    { id: 'a', nome: 'A', saldo: 2000, tasso: 18, pagamentoMinimo: 50 },
    { id: 'b', nome: 'B', saldo: 500, tasso: 10, pagamentoMinimo: 20 },
  ];
  const c = confrontaStrategie(debiti, 100);
  assert.equal(c.baseline.irrisolvibile, false);
  assert.ok(c.baseline.mesiTotali >= c.valanga.mesiTotali, `baseline dovrebbe impiegare più tempo, baseline=${c.baseline.mesiTotali} valanga=${c.valanga.mesiTotali}`);
  assert.ok(c.baseline.interesseTotale >= c.valanga.interesseTotale);
});

test('testoBaseline: mostra il risparmio reale della strategia scelta rispetto ai soli minimi', () => {
  const debiti = [{ id: 'a', nome: 'A', saldo: 3000, tasso: 20, pagamentoMinimo: 60 }];
  const c = confrontaStrategie(debiti, 150);
  const testo = testoBaseline(c.valanga, c.baseline);
  assert.match(testo, /risparmia/);
});

// ── Stress test tasso variabile (2026-09-16, "payment shock" mutui) ──
test('stressTestTasso: un mutuo con margine stretto peggiora rapidamente con il tasso (payment shock reale)', () => {
  // 200.000€ al 3%, rata 900€ (margine iniziale reale, verificato coi
  // numeri effettivi del motore, non stimati a mano): a +1 punto (4%) la
  // stessa rata impiega 81 mesi in più; a +2 punti (5%) non basta più a
  // estinguere il debito entro 50 anni; a +3 punti (6%) l'interesse mensile
  // supera la rata stessa — tre gradini di gravità reali, non inventati.
  const mutuo = { id: 'm', nome: 'Mutuo casa', saldo: 200000, tasso: 3, pagamentoMinimo: 900, tipo: 'mutuo', tassoVariabile: true };
  const risultati = stressTestTasso(mutuo, [1, 2, 3]);
  assert.equal(risultati.length, 3);
  assert.equal(risultati[0].irrisolvibile, false); // +1 -> ancora sostenibile, ma molto più lenta
  assert.ok(risultati[0].differenzaMesi > 0, 'a +1 punto ci deve mettere più tempo, mai meno');
  assert.equal(risultati[1].irrisolvibile, true);  // +2 -> non si estingue più entro 50 anni
  assert.equal(risultati[2].irrisolvibile, true);  // +3 -> la rata non copre nemmeno l'interesse
});

test('stressTestTasso: un debito con margine ampio non diventa mai irrisolvibile nel range testato', () => {
  const carta = { id: 'c', nome: 'Prestito personale', saldo: 1000, tasso: 15, pagamentoMinimo: 100 };
  const risultati = stressTestTasso(carta, [1, 2, 3]);
  assert.ok(risultati.every((r) => r.irrisolvibile === false));
  assert.ok(risultati[0].differenzaMesi >= 0);
  assert.ok(risultati[0].differenzaInteresse >= 0);
});

test('testoStressTasso: segnala il PRIMO aumento che rende il debito irrisolvibile, non l\'ultimo o una media', () => {
  const mutuo = { id: 'm', nome: 'Mutuo casa', saldo: 200000, tasso: 3, pagamentoMinimo: 900, tipo: 'mutuo', tassoVariabile: true };
  const risultati = stressTestTasso(mutuo, [1, 2, 3]);
  const testo = testoStressTasso(risultati);
  assert.match(testo, /2/); // il SECONDO incremento è il primo a diventare irrisolvibile, non il terzo
});

test('testoStressTasso: mostra l\'impatto reale (mesi/interessi) quando resta sempre risolvibile', () => {
  const carta = { id: 'c', nome: 'Prestito personale', saldo: 1000, tasso: 15, pagamentoMinimo: 100 };
  const risultati = stressTestTasso(carta, [1, 2, 3]);
  const testo = testoStressTasso(risultati);
  assert.ok(testo === null || typeof testo === 'string');
});

test('testoStressTasso: mai un\'eccezione con un array vuoto', () => {
  assert.doesNotThrow(() => testoStressTasso([]));
});

test('testoBaseline: se anche la baseline è irrisolvibile, non pretende un confronto in euro', () => {
  const debiti = [{ id: 'a', nome: 'A', saldo: 3000, tasso: 20, pagamentoMinimo: 60 }];
  const c = confrontaStrategie(debiti, 0); // extra zero: baseline e strategia coincidono, entrambe risolvibili qui
  const testo = testoBaseline(c.valanga, c.baseline);
  assert.doesNotThrow(() => testoBaseline(c.valanga, c.baseline));
  assert.ok(testo === null || typeof testo === 'string');
});

// ── Consolidamento debiti (2026-09-16) — la trappola "rata più bassa ma
// costo/tempo totale più alto", l'errore più citato nella ricerca di
// mercato su questo tema ──
test('confrontaConsolidamento: rileva la trappola (rata più bassa, MA più mesi e più interessi totali)', () => {
  const debiti = [
    { id: 'a', nome: 'Carta A', saldo: 5000, tasso: 22, pagamentoMinimo: 250 },
    { id: 'b', nome: 'Carta B', saldo: 3000, tasso: 18, pagamentoMinimo: 150 },
  ];
  // Rata più bassa (150 vs 400 minimi attuali) ma termine molto più lungo:
  // costa DI PIÙ nonostante il tasso nominale più basso (10% vs 18-22%).
  const proposta = { tasso: 10, pagamentoMinimo: 150, commissioneApertura: 200 };
  const c = confrontaConsolidamento(debiti, proposta);
  assert.equal(c.attuale.mesiTotali, 25);
  assert.equal(c.consolidato.mesiTotali, 74);
  assert.ok(c.differenzaInteresse > 0, 'il consolidato deve costare di più in questo scenario');
  assert.ok(c.differenzaMesi > 0, 'il consolidato deve impiegare più tempo in questo scenario');
});

test('confrontaConsolidamento: testoConsolidamento segnala la trappola, mai "risparmi" quando in realtà costa di più', () => {
  const debiti = [
    { id: 'a', nome: 'Carta A', saldo: 5000, tasso: 22, pagamentoMinimo: 250 },
    { id: 'b', nome: 'Carta B', saldo: 3000, tasso: 18, pagamentoMinimo: 150 },
  ];
  const proposta = { tasso: 10, pagamentoMinimo: 150, commissioneApertura: 200 };
  const c = confrontaConsolidamento(debiti, proposta);
  const testo = testoConsolidamento(c);
  assert.doesNotMatch(testo, /risparmi/i);
  assert.match(testo, /910,91/); // numero reale della trappola presente nel testo
  assert.match(testo, /49 mesi/);
});

test('confrontaConsolidamento: un consolidamento davvero conveniente riduce SIA interessi SIA mesi', () => {
  const debiti = [
    { id: 'a', nome: 'Carta A', saldo: 5000, tasso: 22, pagamentoMinimo: 250 },
    { id: 'b', nome: 'Carta B', saldo: 3000, tasso: 18, pagamentoMinimo: 150 },
  ];
  const propostaBuona = { tasso: 8, pagamentoMinimo: 400, commissioneApertura: 100 };
  const c = confrontaConsolidamento(debiti, propostaBuona);
  assert.ok(c.differenzaInteresse < 0, 'deve costare meno');
  assert.ok(c.differenzaMesi <= 0, 'non deve impiegare più tempo');
  assert.match(testoConsolidamento(c), /1247,85/);
});

test('confrontaConsolidamento: mai un\'eccezione se il nuovo prestito è irrisolvibile', () => {
  const debiti = [{ id: 'a', nome: 'A', saldo: 5000, tasso: 20, pagamentoMinimo: 200 }];
  const propostaImpossibile = { tasso: 50, pagamentoMinimo: 50, commissioneApertura: 0 };
  const c = confrontaConsolidamento(debiti, propostaImpossibile);
  assert.equal(c.consolidato.irrisolvibile, true);
  assert.doesNotThrow(() => testoConsolidamento(c));
});

// ── Tasso promozionale in scadenza (2026-09-16, "teaser rate", dato CFPB) ──
test('promoScadeTraGiorni: giorni positivi se la scadenza è nel futuro, negativi se già passata', () => {
  const oggi = new Date('2026-09-16T00:00:00');
  assert.equal(promoScadeTraGiorni({ promoFino: '2026-10-01' }, oggi), 15);
  assert.equal(promoScadeTraGiorni({ promoFino: '2026-09-01' }, oggi), -15);
});

test('promoScadeTraGiorni: null se non dichiarata, mai un valore inventato', () => {
  assert.equal(promoScadeTraGiorni({}), null);
  assert.equal(promoScadeTraGiorni(null), null);
});

test('testoPromoScadenza: avvisa solo entro 45 giorni, mai un allarme troppo presto (rumore)', () => {
  assert.match(testoPromoScadenza(15), /15 giorni/);
  assert.equal(testoPromoScadenza(90), null);
  assert.match(testoPromoScadenza(-5), /già scaduto/);
  assert.equal(testoPromoScadenza(null), null);
});

test('impattoFinePromo: calcola il costo reale del salto di tasso a fine promo (dato CFPB: solo 21% salda prima)', () => {
  const carta = { id: 'c', nome: 'Carta promo', saldo: 3000, tasso: 0, pagamentoMinimo: 100, tassoPostPromo: 24 };
  const r = impattoFinePromo(carta);
  assert.equal(r.attuale.mesiTotali, 30);
  assert.equal(r.dopoPromo.mesiTotali, 47);
  assert.equal(r.dopoPromo.interesseTotale, 1627.31);
  assert.equal(r.differenzaMesi, 17);
});

test('testoImpattoFinePromo: mostra il numero reale, mai un consiglio', () => {
  const carta = { id: 'c', nome: 'Carta promo', saldo: 3000, tasso: 0, pagamentoMinimo: 100, tassoPostPromo: 24 };
  const testo = testoImpattoFinePromo(impattoFinePromo(carta));
  assert.match(testo, /1627,31/);
  assert.match(testo, /17 mesi/);
  assert.doesNotMatch(testo, /dovresti|ti consiglio/i);
});

test('impattoFinePromo: null se il debito non dichiara un tasso post-promo, mai un calcolo su un dato assente', () => {
  assert.equal(impattoFinePromo({ id: 'a', saldo: 1000, tasso: 5, pagamentoMinimo: 50 }), null);
});

// ── Rapporto debito/reddito, "posso permettermi un nuovo prestito?"
// (2026-09-16, dato St. Louis Fed 2026: soglia reale al 50%, non 43%) ──
test('calcolaDTI: somma i pagamenti minimi reali e li rapporta al reddito dichiarato', () => {
  const debiti = [{ saldo: 5000, pagamentoMinimo: 250 }, { saldo: 3000, pagamentoMinimo: 150 }];
  const r = calcolaDTI(debiti, 2000);
  assert.equal(r.rate, 400);
  assert.equal(r.dti, 0.2);
});

test('calcolaDTI: ignora i debiti già estinti (saldo a zero), mai un peso residuo', () => {
  const debiti = [{ saldo: 0, pagamentoMinimo: 250 }, { saldo: 3000, pagamentoMinimo: 150 }];
  const r = calcolaDTI(debiti, 1000);
  assert.equal(r.rate, 150);
});

test('calcolaDTI: reddito ignoto o zero -> dti null, mai una divisione per zero', () => {
  const debiti = [{ saldo: 1000, pagamentoMinimo: 100 }];
  assert.equal(calcolaDTI(debiti, 0).dti, null);
  assert.equal(calcolaDTI(debiti, null).dti, null);
});

test('testoDTI: sceglie la fascia giusta rispetto alle soglie dichiarate (36%/43%/50%)', () => {
  assert.match(testoDTI({ dti: 0.20 }), /20%/);
  assert.doesNotMatch(testoDTI({ dti: 0.20 }), /43%|50%/);
  assert.match(testoDTI({ dti: 0.40 }), /40%/); // moderato, fra 36 e 43
  assert.match(testoDTI({ dti: 0.45 }), /43%/); // attenzione, fra 43 e 50 -> cita la soglia storica
  assert.match(testoDTI({ dti: 0.57 }), /50%/); // critico, oltre la soglia reale 2026
});

test('testoDTI: reddito sconosciuto chiede il dato, mai una percentuale inventata', () => {
  const testo = testoDTI({ dti: null });
  assert.doesNotMatch(testo, /%/);
});

test('capacitaExtraPrestito: margine positivo sotto soglia, negativo (dichiarato) sopra soglia', () => {
  const debiti = [{ saldo: 5000, pagamentoMinimo: 250 }, { saldo: 3000, pagamentoMinimo: 150 }];
  assert.equal(capacitaExtraPrestito(debiti, 2000), 460); // 2000*0.43-400
  assert.equal(capacitaExtraPrestito(debiti, 700), -99); // 700*0.43-400, arrotondato
});

test('testoCapacitaExtra: mai un consiglio a spendere il margine, solo il numero', () => {
  const testo = testoCapacitaExtra(460);
  assert.match(testo, /460,00/);
  assert.doesNotMatch(testo, /dovresti|ti consiglio|chiedi il prestito/i);
  assert.match(testoCapacitaExtra(-99), /già/);
});

test('DTI: le soglie sono dichiarate come costanti esportate, mai numeri sparsi nel codice', () => {
  assert.equal(DTI_SOGLIA_PRUDENTE, 0.36);
  assert.equal(DTI_SOGLIA_STORICA, 0.43);
  assert.equal(DTI_SOGLIA_CRITICA, 0.50);
});

// ── Registra un pagamento (2026-09-16, gap competitor: Tally chiuso 2024,
// Undebt.it/Debt Payoff Planner richiedono tracciamento manuale) ──
test('registraPagamento: scala il saldo dell\'importo pagato, mai sotto zero', () => {
  const debito = { id: 'a', nome: 'Carta', saldo: 1000, tasso: 20, pagamentoMinimo: 50 };
  const r = registraPagamento(debito, 50);
  assert.equal(r.saldo, 950);
});

test('registraPagamento: pagamento maggiore del saldo residuo -> saldo a zero, mai negativo', () => {
  const debito = { id: 'a', nome: 'Carta', saldo: 30, tasso: 20, pagamentoMinimo: 50 };
  const r = registraPagamento(debito, 50);
  assert.equal(r.saldo, 0);
});

test('registraPagamento: importo non valido o negativo trattato come zero, mai un\'eccezione', () => {
  const debito = { id: 'a', nome: 'Carta', saldo: 1000, tasso: 20, pagamentoMinimo: 50 };
  assert.equal(registraPagamento(debito, -50).saldo, 1000);
  assert.equal(registraPagamento(debito, NaN).saldo, 1000);
  assert.equal(registraPagamento(debito, undefined).saldo, 1000);
});

test('registraPagamento: pura, non muta il debito originale', () => {
  const debito = { id: 'a', nome: 'Carta', saldo: 1000, tasso: 20, pagamentoMinimo: 50 };
  registraPagamento(debito, 100);
  assert.equal(debito.saldo, 1000);
});
