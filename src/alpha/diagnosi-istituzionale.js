// ============================================================
// LE DOMANDE CHE FA CHI GESTISCE SOLDI DI MESTIERE
// ============================================================
// Un investitore alle prime armi guarda quanto ha guadagnato. Chi gestisce
// patrimoni guarda altre tre cose, e sono tutte calcolabili sui dati che
// Momentum ha gia' — solo, finora, nessuno le aveva messe insieme.
//
// ─────────────────────────────────────────────────────────────
// 1. "DOVE SONO I SOLDI" NON E' "DOVE E' IL RISCHIO"
// ─────────────────────────────────────────────────────────────
// E' l'osservazione che ha reso famoso l'approccio RISK PARITY: un classico
// 60% azioni / 40% obbligazioni ha il 60% del CAPITALE in azioni, ma circa il
// 90% del RISCHIO — perche' le azioni sono molto piu' volatili. Chi guarda la
// torta delle percentuali crede di essere bilanciato e non lo e'.
// Qui la stessa cosa si misura sui settori del portafoglio vero: quota di
// capitale contro quota della perdita nei mesi peggiori. Il DIVARIO fra i due
// numeri e' la diagnosi, e non e' visibile in nessun estratto conto.
//
// ─────────────────────────────────────────────────────────────
// 2. QUANTE SCOMMESSE DIVERSE HAI DAVVERO
// ─────────────────────────────────────────────────────────────
// Avere nove posizioni non significa avere nove scommesse: se si muovono
// insieme, e' una sola scommessa scritta nove volte. La differenza si misura
// confrontando due numeri:
//   · scommesse per CAPITALE — quante sembrano, guardando i pesi;
//   · scommesse per RISCHIO  — quante sono, guardando da dove arriva la
//     perdita quando le cose vanno male.
// Il secondo e' quasi sempre piu' basso del primo, e quanto piu' basso e'
// esattamente quanta diversificazione e' apparente invece che reale.
//
// ─────────────────────────────────────────────────────────────
// 3. NON E' IL CALO CHE TI ROVINA: E' DOVER VENDERE DENTRO IL CALO
// ─────────────────────────────────────────────────────────────
// Chi investe da decenni lo ripete in ogni forma: un portafoglio che scende
// del 40% e risale non ha fatto danni a chi ha potuto aspettare. Ha distrutto
// chi ha dovuto vendere a meta' strada per pagare le bollette. La differenza
// fra i due non e' il portafoglio — e' la cassa.
// Qui la domanda si smette di porre in astratto: si fa passare il portafoglio
// dell'utente **dentro i mesi veri del 2008** (e degli altri episodi peggiori
// del pannello), con la SUA liquidita' e le SUE spese mensili, e si guarda se
// sarebbe stato costretto a vendere. E' il collegamento fra il modello di
// mercato e il modello di cassa, che finora vivevano separati.
//
// ─────────────────────────────────────────────────────────────
// SUGLI EPISODI STORICI: NON SONO SIMULAZIONI
// ─────────────────────────────────────────────────────────────
// Il rischio di coda (portfolio-tail-risk.js) usa scenari ricampionati: serve
// a rispondere "quanto puo' andare male", comprese combinazioni mai viste.
// Qui invece si usano i mesi VERI, nell'ordine VERO. Sono due domande diverse
// e servono entrambe: la simulazione dice cosa e' possibile, la storia dice
// cosa e' gia' successo. La seconda e' piu' difficile da liquidare come
// pessimismo teorico, ed e' per questo che convince.
//
// ─────────────────────────────────────────────────────────────
// COSA QUESTO FILE NON FA
// ─────────────────────────────────────────────────────────────
// Non dice cosa comprare, cosa vendere, ne' cosa "farebbe" un investitore
// famoso con questo portafoglio: attribuire un'opinione su un caso specifico a
// una persona reale sarebbe inventarla. I metodi qui dentro (parita' di
// rischio, scommesse efficaci, prova sugli episodi storici) sono pubblici e
// documentati, e vengono usati per MISURARE cio' che c'e'. La decisione resta
// intera a chi legge.
//
// Funzioni PURE.
'use strict';

import { PANNELLO_SETTORI, DATE_PANNELLO } from './historical-panel.js';
import { tailRiskPortafoglio, mappaPortafoglio, settoriEquivalenti, SETTORI, NOMI_SETTORI } from './portfolio-tail-risk.js';
import { simulaConSerie } from './forced-sale-risk.js';

// Un divario sotto questa soglia non si segnala: sarebbe rumore presentato
// come scoperta, e ogni allarme non necessario rende meno credibile il
// prossimo che conta davvero.
export const DIVARIO_RILEVANTE = 0.1;

// Il mese di indice 0 del pannello, per dare una data vera agli episodi.
const [ANNO0, MESE0] = DATE_PANNELLO[0].split('-').map(Number);

export function dataDiIndice(i) {
  const totale = (MESE0 - 1) + i;
  const anno = ANNO0 + Math.floor(totale / 12);
  const mese = (totale % 12) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

// Rendimento mensile del portafoglio dell'utente sui mesi VERI del pannello.
function serieStoricaPortafoglio(pesi) {
  const n = PANNELLO_SETTORI[0].r.length;
  const out = new Array(n).fill(0);
  for (const s of PANNELLO_SETTORI) {
    const w = pesi[s.simbolo] || 0;
    if (!w) continue;
    for (let t = 0; t < n; t++) out[t] += w * s.r[t];
  }
  return out;
}

// ── 1. IL DIVARIO FRA DOVE SONO I SOLDI E DOVE E' IL RISCHIO ──
export function divarioCapitaleRischio(tail) {
  if (!tail?.valutabile) return { valutabile: false };
  const righe = tail.contributi.map((c) => ({
    settore: c.settore, nome: c.nome,
    quotaCapitale: +c.peso.toFixed(4),
    quotaRischio: c.quotaDellaPerdita,
    divario: +(c.quotaDellaPerdita - c.peso).toFixed(4),
  })).sort((a, b) => b.divario - a.divario);

  const peggiore = righe[0] || null;
  return {
    valutabile: true,
    righe,
    // Il settore che "pesa" di piu' nel rischio di quanto pesi nel portafoglio.
    sbilanciato: peggiore && peggiore.divario >= DIVARIO_RILEVANTE ? peggiore : null,
    // Il divario massimo, che riassume quanto la torta delle percentuali
    // stia raccontando una cosa diversa dalla realta'.
    divarioMassimo: peggiore ? peggiore.divario : 0,
  };
}

// ── 2. SCOMMESSE EFFICACI: quante ne hai davvero ──
// Per capitale: l'inverso della somma dei quadrati dei pesi (Herfindahl).
// Per rischio: lo stesso indice applicato alle quote di perdita, che tengono
// gia' dentro la correlazione — due settori che crollano sempre insieme
// concentrano la perdita anche se i pesi sono spalmati.
export function scommesseEfficaci(tail) {
  if (!tail?.valutabile) return { valutabile: false };
  const perCapitale = settoriEquivalenti(tail.mappa.pesi);
  const somma = tail.contributi.reduce((s, c) => s + c.quotaDellaPerdita ** 2, 0);
  const perRischio = somma > 0 ? +(1 / somma).toFixed(2) : 0;
  return {
    valutabile: true,
    perCapitale, perRischio,
    // Quanta della diversificazione che sembri avere e' reale.
    quotaReale: perCapitale > 0 ? +(perRischio / perCapitale).toFixed(3) : null,
    apparente: perCapitale - perRischio >= 0.5,
  };
}

// ── 3. GLI EPISODI VERI, non ricampionati ──
// Le finestre di dodici mesi peggiori nella storia reale del pannello, per
// QUESTA composizione. Le finestre vengono scelte senza sovrapporsi, cosi'
// non si conta tre volte lo stesso crollo con lo scarto di un mese.
export function episodiStorici(pesi, { finestra = 12, quanti = 3 } = {}) {
  const serie = serieStoricaPortafoglio(pesi);
  const finestre = [];
  for (let i = 0; i + finestra <= serie.length; i++) {
    const cum = serie.slice(i, i + finestra).reduce((v, r) => v * (1 + r), 1) - 1;
    finestre.push({ i, cum });
  }
  finestre.sort((a, b) => a.cum - b.cum);

  const scelte = [];
  for (const f of finestre) {
    if (scelte.some((s) => Math.abs(s.i - f.i) < finestra)) continue; // niente sovrapposizioni
    scelte.push(f);
    if (scelte.length >= quanti) break;
  }

  return scelte.map((f) => ({
    da: dataDiIndice(f.i),
    a: dataDiIndice(f.i + finestra - 1),
    perdita: +f.cum.toFixed(4),
    indice: f.i,
    // La serie vera di quei mesi: serve alla prova sulla cassa qui sotto.
    serie: serie.slice(f.i, f.i + finestra),
  }));
}

// ── 4. LA PROVA CHE CONTA: saresti stato costretto a vendere? ──
// Non "quanto avresti perso sulla carta", ma "avresti dovuto vendere dentro
// il crollo". Usa il modello di cassa gia' esistente (forced-sale-risk.js)
// sui mesi VERI dell'episodio, con la liquidita' e le spese reali.
export function provaDiTenuta(pesi, { liquidita = 0, speseMensili = 0, contributoMensile = 0, portafoglio = 0 } = {}, opts = {}) {
  const episodi = episodiStorici(pesi, opts);
  if (!episodi.length || !(portafoglio > 0)) return { valutabile: false, motivo: 'servono un portafoglio e almeno un episodio storico' };

  const esiti = episodi.map((e) => {
    const r = simulaConSerie({ liquidita, contributoMensile, portafoglio, speseMensili }, e.serie);
    return {
      da: e.da, a: e.a, perdita: e.perdita,
      costretto: r.costretto, vendite: r.vendite,
      perditaRealizzata: +r.perditaRealizzata.toFixed(2),
      valoreFinale: +r.valoreFinale.toFixed(2),
    };
  });

  const quantiCostretto = esiti.filter((e) => e.costretto).length;
  return {
    valutabile: true, esiti,
    avrestiVenduto: quantiCostretto > 0,
    quantiCostretto, episodiProvati: esiti.length,
    // Il numero che rende la cosa azionabile: quanti mesi di spese copre la
    // cassa. E' la grandezza che decide l'esito, molto piu' della composizione.
    mesiDiCassa: speseMensili > 0 ? +(liquidita / speseMensili).toFixed(1) : null,
  };
}

// ── IL REFERTO COMPLETO ──
// Mette insieme i tre livelli e li restituisce gia' ordinati per gravita',
// perche' un elenco di misure senza priorita' e' un altro modo di non dire
// niente.
export function diagnosiIstituzionale(positions = [], {
  priceByTicker = {}, sectorByTicker = {},
  liquidita = 0, speseMensili = 0, contributoMensile = 0,
  percorsi = 1500, seed = 4242,
} = {}) {
  const tail = tailRiskPortafoglio(positions, { priceByTicker, sectorByTicker, percorsi, seed });
  if (!tail.valutabile) return { valutabile: false, motivo: tail.motivo, mappa: tail.mappa };

  const divario = divarioCapitaleRischio(tail);
  const scommesse = scommesseEfficaci(tail);
  const valorePortafoglio = tail.mappa.valoreTotale;
  const tenuta = provaDiTenuta(tail.mappa.pesi, {
    liquidita, speseMensili, contributoMensile, portafoglio: valorePortafoglio,
  });

  // Le osservazioni, ognuna con la sua misura accanto: mai un giudizio senza
  // il numero che lo sostiene.
  const osservazioni = [];
  if (tenuta.valutabile && tenuta.avrestiVenduto) {
    osservazioni.push({
      gravita: 'alta', tipo: 'vendita-forzata',
      titolo: 'Nei mesi peggiori della storia vera saresti stato costretto a vendere',
      dettaglio: `In ${tenuta.quantiCostretto} dei ${tenuta.episodiProvati} episodi peggiori dal 1999, la tua liquidita' non sarebbe bastata a coprire le spese: avresti venduto dentro il calo, trasformando una perdita sulla carta in una perdita vera.`,
      misura: tenuta.mesiDiCassa != null ? `${tenuta.mesiDiCassa} mesi di spese in cassa` : null,
    });
  }
  if (divario.sbilanciato) {
    osservazioni.push({
      gravita: 'media', tipo: 'divario-capitale-rischio',
      titolo: `${divario.sbilanciato.nome}: molto piu' rischio che capitale`,
      dettaglio: `E' il ${Math.round(divario.sbilanciato.quotaCapitale * 100)}% dei tuoi soldi ma produce il ${Math.round(divario.sbilanciato.quotaRischio * 100)}% della perdita nei mesi brutti. La percentuale che vedi nell'estratto conto non e' la tua esposizione vera.`,
      misura: `divario ${Math.round(divario.sbilanciato.divario * 100)} punti`,
    });
  }
  if (scommesse.valutabile && scommesse.apparente) {
    osservazioni.push({
      gravita: 'media', tipo: 'diversificazione-apparente',
      titolo: 'Meno scommesse diverse di quante sembrino',
      dettaglio: `I pesi fanno sembrare ${scommesse.perCapitale} settori distinti, ma quando le cose vanno male si comportano come ${scommesse.perRischio}: una parte della diversificazione e' apparente, perche' quei settori scendono insieme.`,
      misura: `${scommesse.perRischio} su ${scommesse.perCapitale}`,
    });
  }
  if (tail.piuFragileDelMercato) {
    osservazioni.push({
      gravita: 'bassa', tipo: 'costo-concentrazione',
      titolo: 'Com\'e\' composto ti costa in coda',
      dettaglio: `Negli stessi mesi simulati, un portafoglio spalmato su tutti i settori perderebbe ${(Math.abs(tail.esDiversificato) * 100).toFixed(1).replace('.', ',')}% contro il tuo ${(Math.abs(tail.es) * 100).toFixed(1).replace('.', ',')}%.`,
      misura: `${(Math.abs(tail.costoConcentrazione) * 100).toFixed(1).replace('.', ',')} punti`,
    });
  }
  const ordine = { alta: 0, media: 1, bassa: 2 };
  osservazioni.sort((a, b) => ordine[a.gravita] - ordine[b.gravita]);

  return {
    valutabile: true,
    tail, divario, scommesse, tenuta,
    osservazioni,
    // Se non c'e' niente da segnalare va detto, invece di cercare un problema
    // per giustificare il pannello.
    nienteDaSegnalare: osservazioni.length === 0,
  };
}

// ── Per chi non ha mai investito: la stessa diagnosi, senza una parola tecnica ──
export function diagnosiTextSemplice(d) {
  if (!d?.valutabile) return null;
  if (d.nienteDaSegnalare) {
    return 'Il tuo portafoglio non mostra nessuno degli squilibri che di solito fanno danno: il rischio e\' distribuito piu\' o meno come i soldi, e nei periodi brutti della storia la tua liquidita\' sarebbe bastata.';
  }
  const prima = d.osservazioni[0];
  const altre = d.osservazioni.length - 1;
  return `${prima.titolo}. ${prima.dettaglio}${altre > 0 ? ` Ci sono altre ${altre} cose da guardare qui sotto.` : ''}`;
}
