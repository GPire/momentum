// ============================================================
// PERCHÉ L'AVEVI COMPRATA — e se quelle ragioni valgono ancora
// ============================================================
// LA DOMANDA CHE MANCAVA, e a cui non si poteva rispondere. Il progetto sa
// dire a quali criteri dei maestri un'azienda risponde OGGI
// (`fondamentali.js`), ma non sapeva dire la cosa che conta di piu' per chi
// possiede gia' qualcosa: **le ragioni per cui l'hai comprata valgono
// ancora?**
//
// ── PERCHE' QUESTA E' LA FORMA GIUSTA DELLA DOMANDA "QUANDO USCIRE" ──
// Cercando cosa fanno i grandi investitori prima di comprare e prima di
// vendere, emerge un vuoto documentale preciso: i criteri di ACQUISTO sono
// codificati e citabili (cerchia di competenza, margine di sicurezza, owner
// earnings — lettere agli azionisti di Berkshire), quelli di VENDITA no.
// Buffett e' deliberatamente reticente sulle regole di uscita, e non esiste
// una fonte primaria che le formalizzi. Chiunque venda "il metodo Buffett per
// vendere" sta inventando.
//
// Quello che invece dice, e ripete, e' il PRINCIPIO: si esce quando l'azienda
// si deteriora, non quando il prezzo scende. E quel principio, a differenza di
// una regola inventata, si puo' MISURARE — perche' significa una cosa precisa:
// i numeri che rendevano vera la tua ragione di acquisto non la rendono piu'.
//
// ── COSA FA QUESTO MODULO, e cosa NON fa ──
// Al momento dell'acquisto si fotografa QUALI criteri erano soddisfatti. Poi,
// nel tempo, si guarda quali reggono ancora. Il risultato non e' mai "vendi":
// e' "delle quattro ragioni per cui l'hai presa, due non ci sono piu'".
// La decisione resta a chi possiede i soldi; qui si toglie solo l'alibi del
// non essersene accorti.
//
// IL PREZZO NON ENTRA, ed e' la scelta piu' importante del file. Un calo del
// prezzo non e' un deterioramento dell'azienda, ed e' esattamente la
// confusione che fa vendere nel momento peggiore. Simmetricamente, un rialzo
// non ripara una tesi rotta. Qui si guardano solo i fondamentali, e il prezzo
// resta fuori dalla porta.
//
// Funzioni PURE.
'use strict';

import { CRITERI, num } from './fondamentali.js';

// La fotografia al momento dell'acquisto: quali criteri erano veri, e con
// quali valori. Serve il valore, non solo il si'/no: "il ROE e' sceso dal 22%
// al 16%" dice molto piu' di "il criterio regge ancora".
export function registraTesi(overview = {}, { data = null, nome = null } = {}) {
  const criteri = {};
  for (const [id, c] of Object.entries(CRITERI)) {
    const v = num(overview[c.campo]);
    if (v === null) continue;
    const superato = c.verso === 'sotto' ? (v > 0 && v <= c.soglia) : (v >= c.soglia);
    criteri[id] = { valore: v, superato, soglia: c.soglia, verso: c.verso, maestro: c.maestro, misura: c.misura };
  }
  const soddisfatti = Object.entries(criteri).filter(([, x]) => x.superato).map(([id]) => id);
  return {
    nome: nome || overview?.Name || overview?.Symbol || null,
    data: data || null,
    settore: overview?.Sector || null,
    criteri,
    // LE RAGIONI: solo i criteri che erano VERI. Sono quelli che formano la
    // tesi — gli altri non c'erano nemmeno all'inizio, e non ha senso
    // lamentarsi che manchino oggi.
    ragioni: soddisfatti,
    completa: soddisfatti.length > 0,
    motivo: soddisfatti.length === 0
      ? 'Al momento dell\'acquisto nessuno di questi criteri era soddisfatto: non c\'e\' una tesi da controllare nel tempo, e va detto invece di inventarne una a posteriori.'
      : null,
  };
}

// Il controllo nel tempo. `tesi` e' la fotografia di prima, `oggi` il profilo
// attuale della stessa azienda.
export function verificaTesi(tesi, oggi = {}) {
  if (!tesi?.completa) {
    return { disponibile: false, motivo: tesi?.motivo || 'Serve una tesi registrata all\'acquisto per poterla controllare.' };
  }

  const rotte = [], regge = [], nonPiuMisurabili = [];
  for (const id of tesi.ragioni) {
    const c = CRITERI[id];
    const prima = tesi.criteri[id];
    const v = num(oggi[c.campo]);
    if (v === null) {
      // Un dato che sparisce non e' un dato peggiorato: e' un dato che non
      // c'e'. Confondere le due cose sarebbe inventare un allarme.
      nonPiuMisurabili.push({ id, maestro: c.maestro, misura: c.misura, valorePrima: prima.valore });
      continue;
    }
    const ancoraVero = c.verso === 'sotto' ? (v > 0 && v <= c.soglia) : (v >= c.soglia);
    const voce = {
      id, maestro: c.maestro, misura: c.misura,
      prima: prima.valore, adesso: v, soglia: c.soglia, verso: c.verso,
      variazione: +(v - prima.valore).toFixed(4),
      perBambini: c.perBambini,
    };
    (ancoraVero ? regge : rotte).push(voce);
  }

  const totale = tesi.ragioni.length;
  return {
    disponibile: true,
    nome: tesi.nome,
    dataAcquisto: tesi.data,
    ragioniIniziali: totale,
    regge, rotte, nonPiuMisurabili,
    quotaIntatta: totale ? +(100 * regge.length / totale).toFixed(0) : null,
    // Il verdetto e' sulla TESI, mai sulla mossa da fare.
    tesiIntatta: rotte.length === 0,
    tesiSvuotata: regge.length === 0 && rotte.length > 0,
  };
}

export function testoTesi(v) {
  if (!v?.disponibile) return v?.motivo || null;
  const righe = [];
  const nome = v.nome || 'questo titolo';

  if (v.tesiIntatta) {
    righe.push(`Le ${v.ragioniIniziali} ragioni per cui hai preso ${nome} valgono ancora tutte.`);
  } else if (v.tesiSvuotata) {
    righe.push(`Nessuna delle ${v.ragioniIniziali} ragioni per cui hai preso ${nome} vale piu'.`);
  } else {
    righe.push(`Delle ${v.ragioniIniziali} ragioni per cui hai preso ${nome}, ${v.regge.length} ${v.regge.length === 1 ? 'vale' : 'valgono'} ancora e ${v.rotte.length} no.`);
  }

  for (const r of v.rotte.slice(0, 3)) {
    const dir = r.verso === 'sopra' ? 'sceso' : 'salito';
    righe.push(`${r.misura.split(' — ')[0]}: era ${r.prima}, adesso ${r.adesso} — e' ${dir} oltre la soglia di ${r.maestro} (${r.soglia}).`);
  }
  if (v.nonPiuMisurabili.length) {
    righe.push(`Non piu' misurabili: ${v.nonPiuMisurabili.map((x) => x.misura.split(' — ')[0]).join(', ')}. Un dato che sparisce non e' un dato peggiorato.`);
  }

  // LE DUE FRASI CHE REGGONO L'INTERO MODULO.
  righe.push('Il prezzo non entra in questo conto: un calo non e\' un peggioramento dell\'azienda, ed e\' la confusione che fa vendere nel momento sbagliato.');
  righe.push('Non ti sto dicendo cosa fare: ti sto dicendo se le ragioni che avevi valgono ancora.');
  return righe.join(' ');
}

// ── COSA GUARDARE PRIMA DI COMPRARE, con le fonti ──
// L'altra meta' della domanda. Qui NON si inventano regole: si elencano i
// criteri che hanno una fonte primaria citabile, e si dice quali di questi
// Momentum sa misurare davvero e quali no. Un elenco che finge di poter
// misurare tutto sarebbe piu' bello e meno utile.
export const PRIMA_DI_COMPRARE = [
  {
    voce: 'Capisci come fa i soldi?',
    maestro: 'Buffett / Lynch — "cerchia di competenza"',
    misurabile: false,
    nota: 'Non e\' un dato di mercato: nessun numero puo\' rispondere per te. Se non sai spiegarlo a un amico in due frasi, la risposta e\' no.',
  },
  {
    voce: 'Rende bene sul capitale dei soci?',
    maestro: 'Buffett',
    misurabile: true,
    doveInMomentum: 'fondamentali.js — ROE',
  },
  {
    voce: 'Quanto resta di ogni euro venduto?',
    maestro: 'Buffett',
    misurabile: true,
    doveInMomentum: 'fondamentali.js — margine netto',
  },
  {
    voce: 'Stai pagando un prezzo ragionevole?',
    maestro: 'Graham — P/E, P/B, e il prodotto sotto 22,5',
    misurabile: true,
    doveInMomentum: 'fondamentali.js — regola combinata',
  },
  {
    voce: 'Il prezzo tiene conto della crescita?',
    maestro: 'Lynch — PEG',
    misurabile: true,
    doveInMomentum: 'fondamentali.js — PEG',
  },
  {
    voce: 'Quanto debito ha?',
    maestro: 'Graham',
    misurabile: false,
    nota: 'La fonte usata da Momentum non espone il debito. Due aziende con lo stesso ROE possono avere solidita' + ' molto diverse, e questo buco va dichiarato invece di far finta.',
  },
  {
    voce: 'I conti reggono da dieci anni o solo da uno?',
    maestro: 'Buffett',
    misurabile: false,
    nota: 'Momentum vede gli ultimi dodici mesi. Un ROE alto in un istante non e\' un ROE alto sostenuto, che e\' quello che Buffett chiede davvero.',
  },
  {
    voce: 'Saresti costretto a vendere in un anno brutto?',
    maestro: 'Klarman — "tieni liquidita\' per non essere il venditore forzato"',
    misurabile: true,
    doveInMomentum: 'forced-sale-risk.js — sui TUOI dati, non su quelli dell\'azienda',
  },
];

export function testoPrimaDiComprare() {
  const sa = PRIMA_DI_COMPRARE.filter((x) => x.misurabile);
  const no = PRIMA_DI_COMPRARE.filter((x) => !x.misurabile);
  return `Le domande che i grandi investitori si fanno prima di comprare sono ${PRIMA_DI_COMPRARE.length}. Momentum ne misura ${sa.length}: ${sa.map((x) => x.voce.toLowerCase().replace('?', '')).join('; ')}. Le altre ${no.length} non le misura, e il motivo e' scritto accanto a ciascuna — una lista che fingesse di poter misurare tutto sarebbe piu' bella e meno utile.`;
}
