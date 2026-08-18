// ============================================================
// FONDAMENTALI — i criteri dei maestri sul BILANCIO, e dove si contraddicono
// ============================================================
// Il buco che questo file chiude. `asset-overview.js` scarica gia' da Alpha
// Vantage l'intero profilo fondamentale di un'azienda — redditivita', margini,
// crescita, multipli — e ne tiene DUE campi: capitalizzazione e P/E. Tutto il
// resto viene buttato via a ogni ricerca. Qui non si aggiunge una fonte: si
// smette di sprecare quella che c'e' gia'.
//
// Cosa fa il settore: un "punteggio di qualita'" da 0 a 100, o cinque stelle.
// Il problema non e' che sia impreciso — e' che MEDIA criteri che sono in
// conflitto tra loro, e la media nasconde proprio l'informazione utile.
//
// IL PUNTO CENTRALE, ed e' un fatto aritmetico, non un'opinione:
//   Graham compra a MULTIPLI BASSI (P/E ≤ 15, P/B ≤ 1,5).
//   Buffett compra QUALITA' ALTA (ROE ≥ 15%, margini solidi).
// Un'azienda con ROE alto e margini alti, se il mercato funziona, viene
// prezzata cara — quindi ha multipli alti. Le due scuole quasi mai indicano
// la stessa azienda, e quando un punteggio unico ne esce alto vuol dire che
// ha mediato una contraddizione vera. Momentum la mostra invece di appianarla:
// **quale maestro direbbe di si', quale direbbe di no, e perche' non possono
// essere d'accordo tutti e due**.
//
// I limiti, dichiarati qui e ripetuti nel referto (regola #1 del progetto):
//  - Sono numeri di OGGI (TTM: ultimi dodici mesi). Un ROE alto in un istante
//    non e' un ROE alto sostenuto per dieci anni, che e' cio' che Buffett
//    chiede davvero. Non abbiamo la serie storica dei bilanci: va detto.
//  - NON sono ritestabili sul passato. Alpha Vantage OVERVIEW da' la foto di
//    adesso, non com'era il bilancio nel 2015. Quindi qui NON si puo' fare
//    quello che `strategy-validation.js` fa sui prezzi: nessuno Sharpe
//    deflazionato, nessun "bravura o fortuna". Chi lo promettesse mentirebbe.
//  - Un multiplo basso puo' essere un'azienda in crisi, non un affare. Il
//    nome tecnico e' trappola di valore, e nessun criterio quantitativo qui
//    dentro sa distinguerla da un'occasione.
//  - Manca il DEBITO: questo endpoint non lo espone. Graham senza debito e'
//    Graham dimezzato, e il referto lo dichiara invece di far finta.
//
// Nessun consiglio, mai: qui si dice cosa dicono i CRITERI, non cosa fare.
// Funzioni PURE — i dati arrivano dal chiamante, nessuna rete.
'use strict';

// Un numero dall'API arriva come stringa, come "None", o assente. Tutte e tre
// le cose devono diventare `null`, non zero: uno zero finto entrerebbe nei
// confronti e produrrebbe un verdetto costruito sul nulla.
export function num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === 'None' || s === '-' || s === 'NaN') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── I criteri, con la soglia PUBBLICATA da chi l'ha scritta ──
// Ogni voce porta: cosa misura, la soglia originale, e cosa NON dice. La terza
// colonna e' quella che il settore omette, ed e' quella che evita l'errore.
export const CRITERI = {
  peBasso: {
    maestro: 'Benjamin Graham',
    scuola: 'prezzo',
    misura: 'P/E — quanti anni di utili attuali stai pagando',
    soglia: 15,
    verso: 'sotto',
    campo: 'PERatio',
    perBambini: 'Quanti anni di guadagni dell\'azienda costa comprarla. Meno anni, meno paghi.',
    nonDice: 'Un P/E basso puo\' voler dire che il mercato si aspetta che gli utili crollino.',
  },
  pbBasso: {
    maestro: 'Benjamin Graham',
    scuola: 'prezzo',
    misura: 'P/B — quanto paghi rispetto a cio\' che l\'azienda possiede',
    soglia: 1.5,
    verso: 'sotto',
    campo: 'PriceToBookRatio',
    perBambini: 'Quanto costa comprarla rispetto alle cose che possiede davvero.',
    nonDice: 'Per le aziende fatte di software e marchi il valore contabile non misura quasi nulla.',
  },
  peg: {
    maestro: 'Peter Lynch',
    scuola: 'prezzo-crescita',
    misura: 'PEG — il prezzo degli utili messo a confronto con quanto crescono',
    soglia: 1,
    verso: 'sotto',
    campo: 'PEGRatio',
    perBambini: 'Se un\'azienda costa tanto ma cresce in fretta, puo\' valerne la pena.',
    nonDice: 'Si appoggia su una crescita futura STIMATA da altri: e\' l\'unico criterio qui che non e\' un fatto passato.',
  },
  roeAlto: {
    maestro: 'Warren Buffett',
    scuola: 'qualita',
    misura: 'ROE — quanto rende il capitale dei soci',
    soglia: 0.15,
    verso: 'sopra',
    campo: 'ReturnOnEquityTTM',
    perBambini: 'Per ogni euro dei proprietari, quanto ne guadagna in un anno.',
    nonDice: 'Un ROE alto ottenuto con molti debiti non e\' qualita\', e qui il debito non si vede.',
  },
  margineAlto: {
    maestro: 'Warren Buffett',
    scuola: 'qualita',
    misura: 'Margine netto — quanto resta di ogni euro venduto',
    soglia: 0.1,
    verso: 'sopra',
    campo: 'ProfitMargin',
    perBambini: 'Di ogni 100 euro incassati, quanti ne restano davvero in tasca.',
    nonDice: 'Margini alti attirano concorrenti: restano alti solo se qualcosa li protegge.',
  },
  roaAlto: {
    maestro: 'Joel Greenblatt',
    scuola: 'qualita',
    misura: 'ROA — quanto rende tutto cio\' che l\'azienda usa, debito compreso',
    soglia: 0.07,
    verso: 'sopra',
    campo: 'ReturnOnAssetsTTM',
    perBambini: 'Quanto guadagna rispetto a tutte le cose che usa per lavorare.',
    nonDice: 'Confrontabile solo dentro lo stesso settore: una fabbrica e un sito web non si paragonano.',
  },
};

// La regola COMBINATA di Graham, che vale piu' dei due pezzi separati: il
// prodotto P/E × P/B non deve superare 22,5. E' l'unico criterio del gruppo che
// mette in relazione due numeri invece di guardarli uno per volta, e per questo
// e' piu' difficile da soddisfare per caso.
export const GRAHAM_PRODOTTO = 22.5;

const passa = (valore, soglia, verso) =>
  verso === 'sotto' ? valore > 0 && valore <= soglia : valore >= soglia;

// ── Il referto su UN'azienda ──
// `overview` e' il JSON grezzo di Alpha Vantage OVERVIEW, cosi' com'e'.
export function valutaFondamentali(overview = {}) {
  const nome = overview?.Name || overview?.Symbol || 'questa azienda';
  const esiti = [];
  const mancanti = [];

  for (const [id, c] of Object.entries(CRITERI)) {
    const v = num(overview[c.campo]);
    if (v === null) {
      mancanti.push({ id, maestro: c.maestro, misura: c.misura });
      continue;
    }
    const superato = passa(v, c.soglia, c.verso);
    esiti.push({
      id, maestro: c.maestro, scuola: c.scuola, misura: c.misura,
      valore: v, soglia: c.soglia, verso: c.verso, superato,
      perBambini: c.perBambini, nonDice: c.nonDice,
    });
  }

  // Servono almeno tre criteri misurabili perche' il confronto tra scuole
  // abbia senso: con due, "le scuole si contraddicono" e' una frase vuota.
  if (esiti.length < 3) {
    return {
      disponibile: false,
      nome,
      misurati: esiti.length,
      mancanti,
      motivo: `Per ${nome} la fonte espone solo ${esiti.length} ${esiti.length === 1 ? 'dato di bilancio utile' : 'dati di bilancio utili'}: troppo poco per dire qualcosa che non sia inventato.`,
    };
  }

  const pe = num(overview.PERatio);
  const pb = num(overview.PriceToBookRatio);
  const grahamCombinato = pe !== null && pb !== null && pe > 0 && pb > 0
    ? {
      prodotto: +(pe * pb).toFixed(1),
      soglia: GRAHAM_PRODOTTO,
      superato: pe * pb <= GRAHAM_PRODOTTO,
      spiegazione: `Graham chiedeva che P/E per P/B non superasse ${GRAHAM_PRODOTTO}: qui fa ${(pe * pb).toFixed(1)}.`,
    }
    : null;

  return {
    disponibile: true,
    nome,
    esiti,
    mancanti,
    grahamCombinato,
    tensione: tensioneTraScuole(esiti),
    ...limitiStrutturali(overview),
  };
}

// ── LA PARTE CHE NESSUNO MOSTRA: dove i maestri litigano ──
// Si contano i criteri superati dentro ciascuna scuola, non in totale. Se il
// prezzo dice si' e la qualita' dice no (o viceversa), non c'e' una sintesi
// onesta possibile: c'e' una scelta, e va restituita a chi legge.
export function tensioneTraScuole(esiti = []) {
  const perScuola = {};
  for (const e of esiti) {
    const s = perScuola[e.scuola] = perScuola[e.scuola] || { superati: 0, totale: 0, maestri: new Set() };
    s.totale++;
    if (e.superato) s.superati++;
    s.maestri.add(e.maestro);
  }
  const prezzo = perScuola.prezzo;
  const qualita = perScuola.qualita;
  if (!prezzo || !qualita || !prezzo.totale || !qualita.totale) {
    return { misurabile: false, motivo: 'Servono criteri di entrambe le scuole — prezzo e qualita\' — per vedere se si contraddicono.' };
  }

  const quotaPrezzo = prezzo.superati / prezzo.totale;
  const quotaQualita = qualita.superati / qualita.totale;
  // "In disaccordo" quando una scuola approva in maggioranza e l'altra boccia
  // in maggioranza. La soglia e' la meta': e' il confine tra "in prevalenza
  // si'" e "in prevalenza no", non un numero scelto per far tornare i conti.
  const inDisaccordo = (quotaPrezzo > 0.5 && quotaQualita < 0.5) || (quotaQualita > 0.5 && quotaPrezzo < 0.5);
  const scuolaFavorevole = quotaPrezzo > quotaQualita ? 'prezzo' : 'qualita';

  return {
    misurabile: true,
    prezzo: { superati: prezzo.superati, totale: prezzo.totale, maestri: [...prezzo.maestri] },
    qualita: { superati: qualita.superati, totale: qualita.totale, maestri: [...qualita.maestri] },
    inDisaccordo,
    scuolaFavorevole: inDisaccordo ? scuolaFavorevole : null,
    messaggio: inDisaccordo
      ? (scuolaFavorevole === 'prezzo'
        ? `Costa poco ma guadagna poco: i criteri sul prezzo (${[...prezzo.maestri].join(', ')}) la promuovono, quelli sulla qualita\' (${[...qualita.maestri].join(', ')}) la bocciano. Non e\' un difetto del calcolo — sono due domande diverse, e qui danno risposta opposta.`
        : `Guadagna bene ma costa cara: i criteri sulla qualita\' (${[...qualita.maestri].join(', ')}) la promuovono, quelli sul prezzo (${[...prezzo.maestri].join(', ')}) la bocciano. E\' la situazione piu\' comune per le aziende forti: il mercato le ha gia\' notate.`)
      : (quotaPrezzo > 0.5 && quotaQualita > 0.5
        ? `Qui prezzo e qualita\' vanno d'accordo, ed e\' raro: di solito un\'azienda che guadagna bene non costa poco. Vale la pena chiedersi PERCHE\' costa poco — spesso il mercato sa qualcosa che questi numeri non mostrano.`
        : `Ne\' i criteri sul prezzo ne\' quelli sulla qualita\' la promuovono: su questi numeri nessuna delle due scuole la sceglierebbe.`),
  };
}

// I limiti che dipendono dai DATI di questa azienda, non dal metodo in
// generale. Vanno calcolati caso per caso: dire "manca il debito" quando il
// debito c'e' sarebbe rumore, e il rumore fa smettere di leggere gli avvisi.
function limitiStrutturali(overview) {
  const avvisi = [];
  const settore = overview?.Sector || null;

  avvisi.push('Sono i numeri degli ultimi dodici mesi, una foto di oggi. Buffett chiede dieci anni di conti buoni, e la storia dei bilanci qui non c\'e\'.');
  avvisi.push(`Nessuno di questi criteri sa distinguere un\'azienda a buon prezzo da un\'azienda in difficolta\'${settore ? ` nel settore ${settore}` : ''}: il numero e\' lo stesso, il destino no.`);

  if (num(overview?.PERatio) === null && num(overview?.EPS) !== null && num(overview.EPS) < 0) {
    avvisi.push('Il P/E manca perche\' l\'azienda e\' in perdita: non e\' un dato assente, e\' un dato che non esiste. Un\'azienda che perde non ha "anni di utili" da pagare.');
  }
  avvisi.push('Il livello di debito non e\' compreso in questi dati: due aziende con lo stesso ROE possono avere solidita\' molto diverse.');
  avvisi.push('Questi valori sono di adesso e non si possono ricontrollare sul passato: a differenza dei prezzi, qui non e\' possibile dire se il criterio avrebbe funzionato.');

  return { avvisi, settore };
}

// ── Il testo per l'utente ──
// Regola del progetto: comprensibile a un bambino di otto anni, e mai una
// mossa suggerita. Si dice cosa dicono i criteri, e che sono criteri.
export function testoFondamentali(referto) {
  if (!referto?.disponibile) return referto?.motivo || null;

  const righe = [];
  const superati = referto.esiti.filter((e) => e.superato);
  righe.push(`${referto.nome}: ${superati.length} criteri superati su ${referto.esiti.length}.`);

  if (referto.tensione?.misurabile) righe.push(referto.tensione.messaggio);
  if (referto.grahamCombinato) righe.push(referto.grahamCombinato.spiegazione);

  if (referto.mancanti.length) {
    righe.push(`Non calcolabili qui: ${referto.mancanti.map((m) => m.misura.split(' — ')[0]).join(', ')} — la fonte non li espone per questa azienda.`);
  }

  righe.push('Questi sono criteri di scuole diverse, non un giudizio e non un consiglio: dicono a quali regole questa azienda risponde, non cosa succedera\'.');
  return righe.join(' ');
}
