// In quale categoria stai spendendo più del tuo solito, in questa settimana.
//
// Perché un modulo nuovo e non `period-compare.js`: quello confronta MESI
// interi (monthKey), qui la domanda è settimanale e a settimana in corso —
// due periodi di lunghezza diversa non sono confrontabili con la stessa
// funzione senza mentire.
//
// Tre scelte che lo tengono onesto:
// 1. CONFRONTO A PARI GIORNI: una settimana in corso al mercoledì viene
//    confrontata con i primi 3 giorni delle settimane passate, mai con le
//    settimane passate INTERE (altrimenti ogni settimana risulterebbe
//    "sotto la media" fino al sabato, e il consiglio sarebbe una bugia
//    sistematica).
// 2. MEDIANA, non media: una sola settimana con un acquisto grosso
//    sposterebbe la media e alzerebbe l'asticella proprio dove serve
//    attenzione. La mediana include gli zeri delle settimane senza spesa
//    in quella categoria: il "tuo solito" comprende anche il non spendere.
// 3. SOGLIA RELATIVA ALLA SETTIMANA STESSA, mai un importo fisso: Momentum
//    è multivaluta e "almeno 10 €" non significherebbe niente in un'altra
//    valuta. Un eccesso conta solo se pesa davvero sulla settimana.
'use strict';

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKeyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function mediana(valori) {
  if (!valori.length) return 0;
  const v = [...valori].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Somma per categoria delle uscite nei primi `giorni` giorni a partire da
// `inizio` (incluso).
function speseCategoriaFinestra(allTx, inizio, giorni) {
  const totali = {};
  for (let i = 0; i < giorni; i++) {
    const d = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + i);
    const iso = isoDay(d);
    const txs = allTx?.[monthKeyOf(d)] || [];
    for (const t of txs) {
      if (t.type !== 'uscita') continue;
      if (String(t.date).slice(0, 10) !== iso) continue;
      totali[t.category] = (totali[t.category] || 0) + t.amount;
    }
  }
  return totali;
}

/**
 * @param allTx  mappa {monthKey: [tx]} — la stessa già usata ovunque nell'app.
 * @param inizioSettimana  lunedì della settimana mostrata.
 * @param opts.oggi  data reale (per capire quanti giorni della settimana sono passati).
 * @returns {tipo:'sopra'|'sotto'|null, categoria, valore, tipico, settimane, giorni, motivo}
 *          `tipo:null` con `motivo` dichiarato quando non c'è abbastanza storico:
 *          meglio dire che non si sa ancora che inventare un consiglio.
 */
export function weekCategoryInsight(allTx, inizioSettimana, opts = {}) {
  const {
    oggi = new Date(),
    settimaneStorico = 8,
    minSettimaneCategoria = 3,
    fattoreSopra = 1.5,
    fattoreSotto = 0.5,
    quotaMinimaSettimana = 0.15,
  } = opts;

  const lunedi = new Date(inizioSettimana.getFullYear(), inizioSettimana.getMonth(), inizioSettimana.getDate());
  const fineSettimana = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + 6);
  const oggiSolo = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  // Giorni della settimana già trascorsi (1..7): una settimana passata ne ha 7.
  const giorni = oggiSolo >= fineSettimana
    ? 7
    : Math.max(1, Math.min(7, Math.round((oggiSolo - lunedi) / 86_400_000) + 1));

  const questa = speseCategoriaFinestra(allTx, lunedi, giorni);
  const totaleSettimana = Object.values(questa).reduce((s, v) => s + v, 0);
  if (totaleSettimana <= 0) return { tipo: null, motivo: 'nessuna-spesa', settimane: 0, giorni };

  // Storico: solo le settimane precedenti, stessa finestra di giorni.
  const storico = [];
  for (let w = 1; w <= settimaneStorico; w++) {
    const inizio = new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() - w * 7);
    storico.push(speseCategoriaFinestra(allTx, inizio, giorni));
  }
  // Una settimana "conta" solo se ha almeno una spesa: settimane precedenti
  // all'installazione sono zeri finti, non un comportamento osservato.
  const settimaneReali = storico.filter(s => Object.keys(s).length > 0);
  if (settimaneReali.length < minSettimaneCategoria) {
    return { tipo: null, motivo: 'poco-storico', settimane: settimaneReali.length, giorni };
  }

  let migliore = null;
  for (const [cat, valore] of Object.entries(questa)) {
    const serie = settimaneReali.map(s => s[cat] || 0);
    const presenze = serie.filter(v => v > 0).length;
    if (presenze < minSettimaneCategoria) continue; // categoria troppo rara per avere un "solito"
    const tipico = mediana(serie);
    if (tipico <= 0) continue;
    const scarto = valore - tipico;
    if (valore >= tipico * fattoreSopra && scarto >= totaleSettimana * quotaMinimaSettimana) {
      if (!migliore || scarto > migliore.scarto) {
        migliore = { tipo: 'sopra', categoria: cat, valore: +valore.toFixed(2), tipico: +tipico.toFixed(2), scarto, settimane: settimaneReali.length, giorni };
      }
    }
  }
  if (migliore) { delete migliore.scarto; return migliore; }

  // Nessun eccesso: cerca invece un rientro reale su una categoria che di
  // solito pesa — il rinforzo del comportamento sano vale quanto l'avviso
  // (neurodesign a favore dell'utente), ma solo se è un fatto misurato.
  let calo = null;
  const categorieStoriche = new Set(settimaneReali.flatMap(s => Object.keys(s)));
  for (const cat of categorieStoriche) {
    const serie = settimaneReali.map(s => s[cat] || 0);
    if (serie.filter(v => v > 0).length < minSettimaneCategoria) continue;
    const tipico = mediana(serie);
    if (tipico <= 0) continue;
    const valore = questa[cat] || 0;
    const risparmio = tipico - valore;
    if (valore <= tipico * fattoreSotto && risparmio >= totaleSettimana * quotaMinimaSettimana) {
      if (!calo || risparmio > calo.risparmio) {
        calo = { tipo: 'sotto', categoria: cat, valore: +valore.toFixed(2), tipico: +tipico.toFixed(2), risparmio, settimane: settimaneReali.length, giorni };
      }
    }
  }
  if (calo) { delete calo.risparmio; return calo; }

  return { tipo: null, motivo: 'in-linea', settimane: settimaneReali.length, giorni };
}
