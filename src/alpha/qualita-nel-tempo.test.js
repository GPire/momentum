'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualitaNelTempo, testoQualita, classifica, disponibile, SOGLIE, MIN_ANNI } from './qualita-nel-tempo.js';
import { FONDAMENTALI_STORICI, anniCoperti } from './fondamentali-storici.js';

test('IL LIMITE CHIUSO: non più dodici mesi, ma diciannove anni', () => {
  // fondamentali.js dichiarava dal primo giorno il suo limite più serio:
  // "Buffett chiede dieci anni di conti buoni, e la storia dei bilanci qui non
  // c'è". Ora c'è, e dalla fonte primaria — i documenti che le aziende sono
  // obbligate per legge a depositare, non un aggregatore.
  const c = anniCoperti('AAPL');
  assert.ok(c.quanti >= 15, `solo ${c.quanti} esercizi`);
  assert.ok(c.da <= 2010 && c.a >= 2024);
});

test('APPLE: 19 esercizi su 19 sopra il 15%, e i numeri sono quelli veri', () => {
  const q = qualitaNelTempo('AAPL');
  assert.equal(q.disponibile, true);
  assert.equal(q.sempreSopra, true, `solo ${q.anniSopra}/${q.anni}`);
  // Il ROE di Apple è notoriamente altissimo per via dei riacquisti che
  // riducono il patrimonio: se questo numero non fosse molto sopra il 100%,
  // vorrebbe dire che stiamo leggendo il bilancio sbagliato.
  assert.ok(q.media > 0.5, `media ${q.media}`);
});

test('TESLA: il contrario, e viene detto senza addolcirlo', () => {
  const q = qualitaNelTempo('TSLA');
  assert.equal(q.sempreSopra, false);
  assert.ok(q.quotaSopra < 40, `${q.quotaSopra}% degli anni sopra soglia`);
  assert.ok(q.media < 0, `media ${q.media}: Tesla ha perso per anni`);
  assert.ok(q.peggiorAnno.valore < -1, 'il peggior anno deve essere disastroso');
});

test('la media NEGATIVA non viene descritta come "media alta"', () => {
  // Difetto trovato leggendo la risposta vera: la frase sull'oscillazione
  // diceva "una media alta ottenuta a zig-zag" anche su un -39%.
  const t = testoQualita(qualitaNelTempo('TSLA'));
  assert.ok(!/media alta/.test(t), t);
  assert.match(t, /sotto la soglia/);
});

test('NON la media, ma QUANTI ANNI: la media nasconde l\'anno che conta', () => {
  // Una media di dieci anni buoni e uno disastroso resta buona. Il criterio di
  // Buffett letto alla lettera è "alto quasi sempre", non "in media alto".
  const ko = qualitaNelTempo('KO');
  assert.ok(Number.isFinite(ko.anniSopra));
  assert.ok(ko.anniSopra <= ko.anni);
  // E l'anno peggiore viene sempre dichiarato, non solo la media.
  assert.ok(Number.isFinite(ko.peggiorAnno.valore));
  assert.match(testoQualita(ko), /anno peggiore/);
});

test('un\'azienda EUROPEA non è un dato mancante: è un\'altra autorità', () => {
  const q = qualitaNelTempo('ENI');
  assert.equal(q.disponibile, false);
  assert.match(q.motivo, /Stati Uniti/);
  assert.match(q.motivo, /non e' un dato mancante/);
  assert.equal(disponibile('ENI'), false);
  assert.equal(disponibile('aapl'), true, 'il ticker minuscolo deve funzionare');
});

test('sotto cinque esercizi non si parla di costanza', () => {
  const q = qualitaNelTempo('AAPL', { misura: 'inesistente' });
  assert.equal(q.disponibile, false);
  assert.ok(MIN_ANNI >= 5);
});

test('le soglie sono le STESSE di fondamentali.js', async () => {
  // Un criterio che cambia numero a seconda di dove lo si guarda non è un
  // criterio.
  const { CRITERI } = await import('./fondamentali.js');
  assert.equal(SOGLIE.roe, CRITERI.roeAlto.soglia);
  assert.equal(SOGLIE.margine, CRITERI.margineAlto.soglia);
  assert.equal(SOGLIE.roa, CRITERI.roaAlto.soglia);
});

test('la classifica mette in cima chi è stato costante, non chi è alto oggi', () => {
  const c = classifica();
  assert.ok(c.length >= 8);
  // Le prime devono essere le aziende di qualità classiche: se in cima
  // uscissero Tesla o aziende in perdita, l'ordinamento sarebbe rotto.
  const primi = c.slice(0, 4).map((q) => q.ticker);
  assert.ok(primi.includes('AAPL') && primi.includes('MSFT'), `in cima: ${primi}`);
  assert.ok(!primi.includes('TSLA'));
  for (let i = 1; i < c.length; i++) assert.ok(c[i - 1].quotaSopra >= c[i].quotaSopra);
});

test('ogni referto dichiara la FONTE e la data, e non consiglia', () => {
  const t = testoQualita(qualitaNelTempo('MSFT'));
  assert.match(t, /bilanci depositati alla SEC/);
  assert.match(t, /non sono un consiglio/);
  assert.ok(!/\b(compra|vendi|dovresti|conviene)\b/i.test(t), t);
});

test('i dati coprono aziende di settori diversi, non solo tecnologia', () => {
  // Una banca (JPM), un bene di consumo (KO), la finanza (V), il commercio
  // (WMT): serve a poter dire se un ROE alto sia normale nel settore.
  for (const t of ['JPM', 'KO', 'WMT', 'BRK-B']) {
    assert.ok(FONDAMENTALI_STORICI[t], `manca ${t}`);
  }
});

// ── LE TRAPPOLE EMERSE PASSANDO DA 14 A 82 AZIENDE ──
test('IL ROE NON SI CALCOLA se il patrimonio è quasi zero', () => {
  // Con 82 aziende invece di 14 è saltato fuori il problema: in cima alla
  // classifica finivano Colgate (688%), Lockheed (515%), Boeing (326%).
  // Non sono aziende straordinarie: hanno il patrimonio ridotto quasi a zero
  // da riacquisti e passività pensionistiche, e dividere un utile normale per
  // un numero minuscolo fa esplodere il rapporto. Boeing ha addirittura
  // patrimonio NEGATIVO in diversi esercizi.
  // Presentarlo come qualità avrebbe messo in cima alla lista di Buffett
  // esattamente le aziende che lui non comprerebbe.
  const c = classifica();
  for (const q of c) {
    assert.ok(q.media < 2, `${q.nome}: media ROE ${q.media}, un rapporto con denominatore che tende a zero`);
  }
  // E Boeing non deve comparire fra i primi.
  assert.ok(!c.slice(0, 10).some((q) => /BOEING/i.test(q.nome)));
});

test('gli esercizi NON calcolabili vengono dichiarati, non nascosti', () => {
  // Senza dichiararli, "7 su 7" sembra una storia completa quando metà è
  // stata scartata.
  const q = qualitaNelTempo('CL');
  if (q.disponibile) {
    assert.ok(Number.isFinite(q.esercizioEsclusi));
    if (q.esercizioEsclusi > 0) assert.match(testoQualita(q), /non (e' calcolabile|sono calcolabili)/);
  }
});

test('a parità di costanza vince chi ha PIÙ ANNI, non la media più alta', () => {
  // La lezione che questa sessione ha incontrato quattro volte: un campione
  // piccolo sembra impressionante. "7 esercizi su 7" e "18 su 18" sono
  // entrambi il 100%, ma non sono la stessa prova — e ordinando per media,
  // Colgate con sette anni superava Apple con diciotto.
  const c = classifica();
  const cento = c.filter((q) => q.quotaSopra === 100);
  for (let i = 1; i < cento.length; i++) {
    assert.ok(cento[i - 1].anni >= cento[i].anni,
      `${cento[i - 1].nome} (${cento[i - 1].anni} anni) prima di ${cento[i].nome} (${cento[i].anni} anni)`);
  }
  // E in cima devono esserci le aziende di qualità classiche.
  assert.ok(cento.slice(0, 4).some((q) => /Apple/i.test(q.nome)));
});

test('ottantadue aziende, di settori diversi', () => {
  // Il settore conta più della dimensione: serve a dire se un ROE alto sia
  // raro o normale dove quell'azienda opera. Una lista di sole società
  // tecnologiche renderebbe "normale" il 30% e "scarso" il 15% di una banca.
  const t = Object.keys(FONDAMENTALI_STORICI);
  assert.ok(t.length >= 70, `solo ${t.length} aziende`);
  for (const settore of [['JPM', 'GS', 'MS'], ['KO', 'PEP', 'PG'], ['XOM', 'CVX'], ['JNJ', 'PFE', 'LLY']]) {
    assert.ok(settore.some((x) => t.includes(x)), `manca il settore di ${settore[0]}`);
  }
});
