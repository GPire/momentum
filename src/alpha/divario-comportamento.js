// ============================================================
// IL DIVARIO CHE COSTA PIU' DI OGNI SCELTA DI PORTAFOGLIO: IL TUO
// ============================================================
// RICERCA CHE HA PORTATO A QUESTO FILE (agosto 2026). Il problema numero uno
// di chi investe non e' la mancanza di informazioni — di quelle ce n'e' troppe.
// E' il COMPORTAMENTO, e i numeri sono impietosi:
//   · nel 2024 l'investitore azionario medio ha ottenuto il 16,54% mentre
//     l'indice faceva il 25,02%: 848 punti base persi non dal mercato, ma dal
//     modo in cui la gente entra ed esce (DALBAR, secondo divario piu' ampio
//     del decennio);
//   · il 48% degli investitori al dettaglio dichiara almeno un acquisto fatto
//     per paura di restare fuori negli ultimi dodici mesi (63% fra la Gen Z),
//     tipicamente su qualcosa gia' ai massimi;
//   · il "guess right ratio" — quante volte si indovina la direzione — e'
//     sceso al 25%, minimo storico: una volta su quattro;
//   · quindici anni consecutivi di sottoperformance rispetto all'indice.
//
// PERCHE' NESSUNO LO MISURA, E MOMENTUM PUO'. Per calcolare il divario di
// comportamento di UNA persona servono due cose nello stesso posto: **quando**
// ha messo i soldi, e **cosa ha fatto il mercato in quei mesi**. Il broker sa
// le operazioni ma non conosce la vita di chi le fa; l'app di bilancio conosce
// le spese ma non gli investimenti. Momentum ha i movimenti `invest` mese per
// mese E 331 mesi di mercato reale. E' l'unico posto dove il conto si puo'
// chiudere davvero, e per questo non e' un pannello in piu': e' la cosa che
// gli altri non possono copiare senza avere gli stessi dati.
//
// IL CONFRONTO E' ONESTO, e questa e' la parte delicata. Non si confronta con
// il timing perfetto col senno di poi — sarebbe un paragone truccato che fa
// sentire tutti stupidi e non insegna niente. Si confronta con **la stessa
// identica cifra totale, versata in parti uguali negli stessi identici mesi**:
// il piano di accumulo, cioe' l'alternativa che chiunque poteva davvero
// scegliere senza sapere nulla del futuro. La differenza fra i due risultati
// e' attribuibile solo a QUANDO si e' messo il denaro, perche' quanto e su
// cosa sono identici per costruzione.
//
// E LA DIREZIONE OPPOSTA VA DETTA CON LA STESSA FORZA: se il divario e'
// positivo, questo file lo dichiara. Un'app che trova sempre una colpa non e'
// onesta, e' solo pessimista — e la ricerca sui modelli di intelligenza
// artificiale in finanza segnala esattamente il difetto speculare (compiacere
// chi legge dicendogli cio' che vuole sentirsi dire). Qui il verdetto lo
// decidono i numeri in entrambe le direzioni.
//
// COSA NON SI PUO' CONCLUDERE. Un divario negativo misurato sul passato non
// dimostra che la persona sbagliera' anche domani, e questo file non lo dice
// mai. Dice cosa e' successo, con quanti mesi di storia, e quanto quel numero
// sia affidabile viste le poche osservazioni: con sei versamenti non si
// giudica nessuno, e sotto una soglia minima si rifiuta di rispondere.
//
// Funzioni PURE.
'use strict';

import { rendimentoMercato, pannello } from './market-stress.js';
import { DATE_PANNELLO } from './historical-panel.js';
import { mercatoVivo } from './mercato-vivo.js';

// Sotto questo numero di mesi con un versamento non si parla di divario: e'
// un campione, non un comportamento.
export const MIN_VERSAMENTI = 6;
// Sotto questa differenza in punti percentuali il divario non si segnala:
// e' rumore, e gridare al problema per mezzo punto brucia la credibilita'
// necessaria a farsi ascoltare quando il problema c'e' davvero.
export const SOGLIA_RILEVANTE = 0.01;

const [ANNO0, MESE0] = DATE_PANNELLO[0].split('-').map(Number);

// La serie di mercato usata dai calcoli. Di default lo scatto incorporato;
// con una `coda` (src/alpha/mercato-vivo.js) diventa lo scatto PIU' i mesi
// aggiornati dal vivo — cosi' i versamenti fatti dopo la generazione del
// pannello smettono di cadere fuori finestra col passare del tempo, che era
// il difetto destinato a peggiorare da solo ogni mese.
function serieMercato(coda = null) {
  return coda?.punti?.length ? mercatoVivo(coda).valori : rendimentoMercato();
}

// 'YYYY-MM' -> indice nel pannello storico. null se fuori dalla finestra
// coperta: mai un mese inventato per far quadrare un conto.
export function indiceDiMese(chiave, coda = null) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(chiave || ''));
  if (!m) return null;
  const anno = Number(m[1]), mese = Number(m[2]);
  const i = (anno - ANNO0) * 12 + (mese - MESE0);
  const n = serieMercato(coda).length;
  return i >= 0 && i < n ? i : null;
}

// ── I versamenti veri, mese per mese ──
// Solo i movimenti di tipo `invest`: sono quelli in cui l'utente ha spostato
// denaro dal contante agli investimenti, cioe' esattamente le decisioni di
// cui si sta misurando il tempismo.
export function versamentiPerMese(transactions = {}, { coda = null } = {}) {
  const perMese = new Map();
  let fuoriFinestra = 0;
  for (const chiave of Object.keys(transactions)) {
    const i = indiceDiMese(chiave, coda);
    let somma = 0;
    for (const t of transactions[chiave] || []) {
      if (t?.type === 'invest') somma += Number(t.amount) || 0;
    }
    if (!(somma > 0)) continue;
    if (i === null) { fuoriFinestra += somma; continue; }
    perMese.set(i, (perMese.get(i) || 0) + somma);
  }
  return { perMese, fuoriFinestra: +fuoriFinestra.toFixed(2) };
}

// Quanto vale oggi una cifra versata al mese `da`, lasciata nel mercato fino
// al mese `fino` incluso.
function cresciuto(importo, da, fino, mercato) {
  let v = importo;
  for (let t = da; t <= fino; t++) v *= (1 + mercato[t]);
  return v;
}

// ── IL CALCOLO ──
export function divarioComportamento(transactions = {}, { fino = null, coda = null } = {}) {
  const mercato = serieMercato(coda);
  const { perMese, fuoriFinestra } = versamentiPerMese(transactions, { coda });
  const indici = [...perMese.keys()].sort((a, b) => a - b);

  if (indici.length < MIN_VERSAMENTI) {
    return {
      valutabile: false,
      versamenti: indici.length,
      motivo: `servono almeno ${MIN_VERSAMENTI} mesi con un investimento per dire qualcosa sul tuo tempismo: finora ne ho ${indici.length}`,
    };
  }

  // Due date diverse, e tenerle distinte e' cio' che rende il confronto equo:
  //  · l'ARCO dei versamenti (primo -> ultimo mese in cui si e' messo denaro)
  //    e' lo spazio su cui il piano di accumulo distribuisce la stessa cifra;
  //  · la data di VALUTAZIONE (ultimo mese disponibile) e' dove si misurano
  //    entrambi.
  // BUG TROVATO DAL TEST: distribuendo il piano di accumulo fino alla fine del
  // pannello invece che fino all'ultimo versamento, il confronto metteva soldi
  // in mesi in cui l'utente non ne aveva messi — e chi versava gia' in modo
  // perfettamente regolare risultava in ritardo del 12,5% contro se stesso.
  const primo = indici[0];
  const ultimoVersamento = indici[indici.length - 1];
  const valutazione = fino === null ? mercato.length - 1 : Math.min(fino, mercato.length - 1);
  const mesiArco = ultimoVersamento - primo + 1;
  const totaleVersato = indici.reduce((s, i) => s + perMese.get(i), 0);

  // A) Quello che e' successo davvero: ogni versamento cresce dal SUO mese.
  let valoreReale = 0;
  for (const i of indici) valoreReale += cresciuto(perMese.get(i), i, valutazione, mercato);

  // B) Il confronto onesto: la stessa cifra totale, in parti uguali su tutti i
  // mesi dell'ARCO — il piano di accumulo, che chiunque poteva scegliere senza
  // sapere nulla del futuro. Stessa cifra, stesso arco, stessa valutazione:
  // l'unica differenza rimasta e' QUANDO.
  const rata = totaleVersato / mesiArco;
  let valorePac = 0;
  for (let i = primo; i <= ultimoVersamento; i++) valorePac += cresciuto(rata, i, valutazione, mercato);

  const rendReale = valoreReale / totaleVersato - 1;
  const rendPac = valorePac / totaleVersato - 1;
  const divario = rendReale - rendPac;

  return {
    valutabile: true,
    versamenti: indici.length,
    mesiArco,
    da: nomeMese(primo), a: nomeMese(ultimoVersamento),
    valutatoA: nomeMese(valutazione),
    totaleVersato: +totaleVersato.toFixed(2),
    valoreReale: +valoreReale.toFixed(2),
    valorePac: +valorePac.toFixed(2),
    rendimentoTuo: +rendReale.toFixed(4),
    rendimentoPac: +rendPac.toFixed(4),
    // Negativo = il tuo tempismo e' costato rispetto al versare sempre uguale.
    divario: +divario.toFixed(4),
    // Lo stesso numero in euro, che e' l'unica unita' che si sente davvero.
    divarioEuro: +(valoreReale - valorePac).toFixed(2),
    rilevante: Math.abs(divario) >= SOGLIA_RILEVANTE,
    aTuoFavore: divario > 0,
    fuoriFinestra,
  };
}

function nomeMese(i) {
  const totale = (MESE0 - 1) + i;
  const anno = ANNO0 + Math.floor(totale / 12);
  const mese = (totale % 12) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

// ── COMPRI QUANDO E' GIA' SALITO? La FOMO, misurata sui tuoi movimenti ──
// Per ogni mese in cui hai versato si guarda dove stava il mercato rispetto ai
// dodici mesi precedenti (0 = al minimo del periodo, 1 = al massimo). La media
// PESATA per quanto hai versato dice se il denaro e' entrato dopo le corse o
// dopo i cali.
// IL RIFERIMENTO NON E' 0,5, ED E' UN ERRORE CHE UN TEST HA SMASCHERATO.
// Sembra ovvio che "in mezzo" sia 0,5, ma non lo e': il mercato sale nel lungo
// periodo, quindi il livello di oggi sta quasi sempre vicino al massimo
// dell'ultimo anno. Misurando contro 0,5, un versamento automatico perfetto
// risultava "insegue i massimi" — cioe' l'app avrebbe accusato di FOMO
// praticamente chiunque, compresi quelli che fanno esattamente la cosa giusta.
// Il riferimento corretto e' la posizione media di TUTTI i mesi dell'arco:
// e' dove sarebbe finito, per costruzione, chi versa senza guardare il
// mercato. Si confronta un comportamento con l'alternativa meccanica, non con
// un numero tondo che sembrava ragionevole.
export function tempismoDeiVersamenti(transactions = {}, { finestra = 12, coda = null } = {}) {
  const mercato = serieMercato(coda);
  const { perMese } = versamentiPerMese(transactions, { coda });
  const indici = [...perMese.keys()].sort((a, b) => a - b).filter((i) => i >= finestra);

  if (indici.length < MIN_VERSAMENTI) {
    return { valutabile: false, motivo: `servono almeno ${MIN_VERSAMENTI} versamenti con dodici mesi di storia prima` };
  }

  // Livello dell'indice mese per mese (prezzo ricostruito dai rendimenti).
  const livello = new Array(mercato.length);
  let v = 1;
  for (let t = 0; t < mercato.length; t++) { v *= (1 + mercato[t]); livello[t] = v; }

  const posizioneDi = (i) => {
    const storia = livello.slice(i - finestra, i + 1);
    const min = Math.min(...storia), max = Math.max(...storia);
    return max > min ? (livello[i] - min) / (max - min) : 0.5;
  };

  let pesoTot = 0, sommaPercentili = 0;
  const punti = [];
  for (const i of indici) {
    const p = posizioneDi(i);
    const peso = perMese.get(i);
    sommaPercentili += p * peso;
    pesoTot += peso;
    punti.push({ mese: nomeMese(i), posizione: +p.toFixed(3), importo: +peso.toFixed(2) });
  }
  const medio = sommaPercentili / pesoTot;

  // Il riferimento: la posizione media di tutti i mesi dell'arco, cioe' dove
  // finisce chi versa senza guardare il mercato.
  const primo = indici[0], ultimo = indici[indici.length - 1];
  let sommaRif = 0, nRif = 0;
  for (let i = primo; i <= ultimo; i++) { sommaRif += posizioneDi(i); nRif++; }
  const riferimento = nRif > 0 ? sommaRif / nRif : 0.5;
  const scostamento = medio - riferimento;

  return {
    valutabile: true,
    posizioneMedia: +medio.toFixed(3),
    riferimentoAutomatico: +riferimento.toFixed(3),
    // Quanto ci si discosta da chi versa senza guardare: e' il numero vero.
    scostamento: +scostamento.toFixed(3),
    versamenti: indici.length,
    punti,
    // Soglia larga di proposito: serve uno scostamento netto dal versamento
    // automatico prima di dire a qualcuno che insegue i massimi.
    inseguiIMassimi: scostamento > 0.15,
    compriNeiCali: scostamento < -0.15,
    testo: scostamento > 0.15
      ? 'Rispetto a chi versa ogni mese senza guardare, i tuoi versamenti sono arrivati piu' + '\' spesso quando il mercato era gia\' salito.'
      : scostamento < -0.15
        ? 'Rispetto a chi versa ogni mese senza guardare, i tuoi versamenti sono arrivati piu\' spesso dopo i cali: e\' il contrario di quello che fa la maggior parte delle persone.'
        : 'I tuoi versamenti sono arrivati piu\' o meno dove sarebbero arrivati versando ogni mese senza guardare il mercato: nessuna rincorsa ai massimi.',
  };
}

// ── IL REFERTO, nella lingua di chi non ha mai investito ──
export function divarioText(d, t = null) {
  if (!d?.valutabile) return null;
  const eur = (x) => `${Math.abs(x).toFixed(0)} €`;
  const pct = (x) => `${(Math.abs(x) * 100).toFixed(1).replace('.', ',')}%`;

  if (!d.rilevante) {
    return `Hai investito ${eur(d.totaleVersato)} in ${d.versamenti} mesi diversi. Il momento in cui li hai messi non ha fatto quasi differenza: avresti ottenuto praticamente lo stesso risultato versando sempre la stessa cifra ogni mese.${t?.valutabile ? ` ${t.testo}` : ''}`;
  }
  if (d.aTuoFavore) {
    return `Hai investito ${eur(d.totaleVersato)} in ${d.versamenti} mesi diversi, e il momento che hai scelto ti ha fatto guadagnare ${eur(d.divarioEuro)} in piu' rispetto a versare sempre la stessa cifra ogni mese (${pct(d.divario)} meglio). E' andata bene: ricorda pero' che indovinare il momento giusto e' molto piu' facile da riconoscere dopo che da ripetere prima.${t?.valutabile ? ` ${t.testo}` : ''}`;
  }
  return `Hai investito ${eur(d.totaleVersato)} in ${d.versamenti} mesi diversi. Se avessi messo la stessa identica cifra totale, ma sempre uguale ogni mese, oggi avresti ${eur(d.divarioEuro)} in piu' (${pct(d.divario)}). Non e' il mercato che te li ha tolti: e' il momento in cui hai scelto di entrare.${t?.valutabile ? ` ${t.testo}` : ''}`;
}

// Da dove vengono i numeri, sempre disponibile: un verdetto sul proprio
// comportamento senza la fonte accanto e' difficile da accettare, e giustamente.
export function fonteDivario() {
  const p = pannello();
  return `Mercato = media equipesata di ${p.settori.length} settori dello S&P 500, ${p.mesi} mesi reali da ${p.da} a ${p.a}. Il confronto usa la tua stessa cifra totale distribuita in parti uguali sugli stessi mesi: nessun senno di poi.`;
}
