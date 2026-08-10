import test from 'node:test';
import assert from 'node:assert/strict';
import {
  griglia, sentimentAnnuale, copertura, chiAnticipaChi, episodi,
  sentimentPrimaDeiPicchi, cosaSuccedeDopo, doveSiamo, doveSiamoText,
  cicliText, anticipiText, hypeText, ANNI, STATI, NOMI, SOGLIA_CORRELAZIONE,
} from './cicli.js';

test('QUARANTUN ANNI, dieci mercati, una sola griglia', () => {
  assert.equal(ANNI.length, 41);
  const c = copertura();
  assert.ok(c.length >= 10);
  // Azioni, metalli, energia, terre rare e case sulla stessa riga temporale:
  // è tutto il punto del modulo.
  for (const k of ['azioni', 'oro', 'petrolio', 'terreRare', 'caseItalia', 'caseGiappone']) {
    const r = c.find((x) => x.chiave === k);
    assert.ok(r && r.anni > 30, `${k}: ${r?.anni} anni`);
  }
  // Le terre rare finiscono prima: il limite resta visibile invece di essere
  // riempito con l'ultimo valore noto.
  assert.ok(c.find((x) => x.chiave === 'terreRare').a < 2025);
});

test('le serie già reali NON vengono deflazionate una seconda volta', () => {
  const g = griglia();
  // Le case BIS e le terre rare USGS arrivano già in valuta costante. Se
  // fossero passate dal deflatore, il livello del 1985 risulterebbe gonfiato
  // di circa tre volte rispetto al valore pubblicato.
  const it = g.caseItalia.filter((x) => x !== null);
  assert.ok(it[0] > 30 && it[0] < 200, `indice BIS fuori scala: ${it[0]}`);
  const tr = g.terreRare.filter((x) => x !== null);
  assert.ok(tr[0] > 1000 && tr[0] < 100000, `terre rare fuori scala: ${tr[0]}`);
});

// ── Il risultato negativo, che è il più importante ──

test('NESSUN MERCATO ANTICIPA GLI ALTRI: 6 trovati contro 4,5 attesi per caso', () => {
  const a = chiAnticipaChi();
  assert.ok(a.coppieEsaminate >= 80);
  assert.equal(a.sogliaUsata, SOGLIA_CORRELAZIONE);
  // Il controllo che rende il risultato onesto: provando novanta combinazioni,
  // qualcuna supera la soglia per puro caso. Senza questo confronto avrei
  // annunciato sei "scoperte".
  assert.ok(a.atteseSoloPerCaso > 4);
  assert.equal(a.piuDelCaso, false,
    'se un giorno diventasse vero, andrebbe verificato fuori campione prima di crederci');
  assert.match(anticipiText(), /non ho trovato nessun mercato che anticipi/);
  assert.match(anticipiText(), /chiedigli su quanti anni/);
});

// ── Gli episodi che si ripetono ──

test('NOVE episodi con la stessa forma, e la discesa dura più della salita', () => {
  const e = episodi();
  assert.ok(e.quanti >= 8, `episodi: ${e.quanti}`);
  assert.ok(e.formaTipica.anniDiSalita > 2 && e.formaTipica.anniDiSalita < 5);
  // Il fatto controintuitivo: si sale in tre anni e si scende in otto. Chi
  // aspetta che "rimbalzi" non sa quanto può durare.
  assert.equal(e.salitaPiuLungaDellaCaduta, false);
  assert.ok(e.formaTipica.anniDiCaduta > e.formaTipica.anniDiSalita * 1.5);
  // Una definizione sola per tutti i mercati: se il criterio cambiasse da
  // mercato a mercato, "bolla" diventerebbe una parola scelta a posteriori.
  assert.equal(e.criterio.salita, 0.6);
  for (const x of e.episodi) {
    assert.ok(x.salita >= 0.6, `${x.nome}: salita ${x.salita}`);
    assert.ok(x.caduta <= -0.3, `${x.nome}: caduta ${x.caduta}`);
    assert.ok(x.annoPartenza < x.annoPicco && x.annoPicco < x.annoFondo);
  }
});

test('il 2011 è l\'anno in cui quattro mercati hanno fatto picco insieme', () => {
  const e = episodi();
  const insieme = e.anniInCuiPiuMercatiHannoFattoPicco[0];
  assert.equal(insieme.anno, 2011);
  assert.ok(insieme.mercati.length >= 4, `mercati: ${insieme.mercati}`);
  assert.match(cicliText(), /2011/);
  assert.match(cicliText(), /costo del denaro/);
});

test('con un solo episodio il modulo RIFIUTA di calcolare una percentuale', () => {
  const s = sentimentPrimaDeiPicchi();
  assert.equal(s.abbastanzaCasi, false);
  assert.match(s.avvertenza, /coincidenza travestita da regola/);
});

// ── La previsione, nell'unica forma difendibile ──

test('la previsione è una frequenza storica condizionata, non un numero inventato', () => {
  const d = cosaSuccedeDopo();
  for (const s of STATI) assert.ok(d.perStato[s], `stato mancante: ${s}`);
  assert.ok(d.perStato.quiete.casi > 100, 'i casi si mettono insieme fra mercati per averne abbastanza');
  assert.ok(d.perStato.quiete.mercati >= 8);
  // E l'assunzione che questo richiede va dichiarata, perché è forte.
  assert.match(d.assunzione, /rame tirato e un'azione tirata/);
});

test('"È SALITO TROPPO, ADESSO SCENDE" non regge: cambia la coda, non la mediana', () => {
  const d = cosaSuccedeDopo();
  // Il risultato scomodo: dopo una corsa il risultato tipico NON è peggiore.
  assert.equal(d.laCorsaSiPaga, false);
  // Ma la coda sì, e di molto: è lì che sta il rischio vero.
  assert.equal(d.laCorsaAllargaLaCoda, true);
  assert.ok(d.quantoSiAllargaLaCoda < -0.2, `si allarga solo di ${d.quantoSiAllargaLaCoda}`);
  const t = hypeText();
  assert.match(t, /non e' vera|non regge/);
  assert.match(t, /futuro piu' largo/);
  assert.ok(!/compra|vendi|dovresti/i.test(t), `indicazione operativa: ${t}`);
});

test('"dove siamo" dice lo stato e quante volte è andata bene, senza promettere', () => {
  for (const m of ['azioni', 'oro', 'caseItalia']) {
    const d = doveSiamo(m);
    assert.equal(d.valido, true, `${m}: ${d.motivo}`);
    assert.ok(STATI.includes(d.stato));
    const t = doveSiamoText(d);
    assert.match(t, /volte su cento|non ho abbastanza casi/);
    assert.ok(!/salira|scendera|previsione affidabile/i.test(t), `promessa: ${t}`);
  }
  assert.equal(doveSiamo('inventato').valido, false);
  assert.equal(doveSiamoText(null), null);
});
