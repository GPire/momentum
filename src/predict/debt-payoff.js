// ============================================================
// PIANO DI ESTINZIONE DEBITI — valanga (avalanche) e palla di neve (snowball)
// ============================================================
// Gap reale trovato via ricerca di mercato (RICERCA_MERCATO_2026-08-25.md):
// nessuna app di categoria studiata fa altro che aritmetica dietro il nome
// "AI Debt Advisor" — saldo, tasso, pagamento minimo, un ordine di priorità.
// Qui è uguale, dichiarato: **puro calcolo deterministico, mai un consiglio**
// ("estingui prima questo") — mostriamo l'ordine e i numeri di ENTRAMBE le
// strategie, la scelta resta dell'utente, stesso principio "il quadro, non
// l'ordine" di tutto il resto di Momentum.
//
// Le due strategie:
//  - valanga (avalanche): priorità al tasso più alto — matematicamente
//    ottima (minimo interesse totale pagato).
//  - palla di neve (snowball): priorità al saldo più basso — paga qualcosa
//    in più di interesse, ma il primo debito si estingue prima: la vittoria
//    rapida che nella letteratura sul comportamento finanziario aiuta a
//    restare motivati (dichiarato come osservazione, non spacciato per
//    "la scelta giusta" — è l'utente a decidere cosa conta di più per sé).
'use strict';

// Bug reale segnalato dall'utente (2026-09-15, feedback diretto): la
// schermata "Debiti e prestiti" era per metà tradotta (le etichette del
// form passavano da tCh in main.js) e per metà sempre in italiano — ogni
// testo generato QUI (motivo di irrisolvibilità, confronto fra strategie)
// non riceveva mai la lingua dell'utente. Stesso pattern già in uso in
// `achievements.js` per un modulo puro che genera testo: importa `t()` da
// ui-strings.js, il chiamante passa sempre `lang` esplicito (mai un default
// silenzioso su 'it' che nasconderebbe la stessa regressione altrove).
import { t as tDebt } from '../i18n/ui-strings.js';

const MESI_MASSIMI = 600; // 50 anni: oltre, dichiariamo che il debito non si estingue, non giriamo all'infinito

function normalizzaDebito(d) {
  return {
    id: d.id, nome: d.nome || 'Debito', saldo: +d.saldo || 0,
    tasso: +d.tasso || 0, pagamentoMinimo: +d.pagamentoMinimo || 0,
    // Richiesto esplicitamente dall'utente (2026-09-15): "rendi più avanzata
    // la logica, anche per mutui". Un mutuo con penale di estinzione
    // anticipata (comune in Italia sui tassi fissi, e su molti mutui a tasso
    // variabile nei primi anni) è strutturalmente diverso da una carta di
    // credito: destinargli l'extra mensile potrebbe costare una penale che
    // vanifica il risparmio di interessi — quindi qui NON è un consiglio
    // ("non estinguerlo") ma un dato che lo stato passa alla simulazione:
    // un debito con `penaleEstinzione:true` non riceve MAI l'extra in
    // cascata, riceve solo il proprio pagamento minimo, esattamente come nella
    // realtà se l'utente sceglie di rispettare il vincolo contrattuale.
    tipo: d.tipo || 'altro',
    penaleEstinzione: !!d.penaleEstinzione,
    // Richiesto esplicitamente dall'utente (2026-09-16): "risolvere i
    // problemi degli utenti con mutui e tassi di interesse". Ricerca di
    // mercato reale (CMHC 2026, Canada — il dato più recente e concreto
    // trovato su questo tema): il 39% dei mutuatari resta preoccupato per la
    // rata, il 35% dei rinnovi registra un aumento reale (~375$/mese medio),
    // e per una quota di chi ha un tasso variabile l'aumento può superare il
    // 40% — il problema si chiama "payment shock", ed è quasi sempre una
    // sorpresa perché nessuno strumento lo mostra PRIMA che accada. Un
    // debito a tasso variabile dichiarato tale abilita `stressTestTasso`
    // sotto — mai un consiglio ("cambia mutuo"), solo il numero prima che
    // diventi una sorpresa.
    tassoVariabile: !!d.tassoVariabile,
  };
}

// Ordina i debiti secondo la strategia scelta. Pura, non muta l'input.
export function ordinaDebiti(debiti, strategia = 'valanga') {
  const validi = (debiti || []).map(normalizzaDebito).filter((d) => d.saldo > 0);
  const chiave = strategia === 'palla-di-neve' ? (d) => d.saldo : (d) => -d.tasso;
  return [...validi].sort((a, b) => chiave(a) - chiave(b));
}

// Un debito il cui pagamento minimo non copre nemmeno l'interesse mensile
// non si estinguerà MAI con quel pagamento — va dichiarato subito, non
// scoperto dopo 600 mesi di simulazione silenziosa.
export function pagamentoInsufficiente(d) {
  const interesseMensile = (d.saldo * (d.tasso / 100)) / 12;
  return d.pagamentoMinimo > 0 && d.pagamentoMinimo <= interesseMensile;
}

// Simula mese per mese l'estinzione di TUTTI i debiti con la strategia
// scelta: ogni mese si pagano i minimi su tutti, più `extraMensile` che va
// intero sul debito in cima all'ordine — quando quello si estingue, il suo
// intero pagamento (minimo + extra residuo) si sposta sul prossimo
// ("effetto valanga/palla di neve" vero, non solo il nome).
export function simulaEstinzione(debiti, { strategia = 'valanga', extraMensile = 0, lang = 'it', riallocaMinimi = true } = {}) {
  const ordine = ordinaDebiti(debiti, strategia);
  if (!ordine.length) return { debiti: [], mesiTotali: 0, interesseTotale: 0, dataLibero: null, irrisolvibile: false };

  const insufficienti = ordine.filter(pagamentoInsufficiente);
  if (insufficienti.length) {
    return {
      debiti: ordine, mesiTotali: null, interesseTotale: null, dataLibero: null,
      irrisolvibile: true,
      motivo: tDebt('debtMotivoInsufficiente', lang, insufficienti.map((d) => d.nome).join(', ')),
    };
  }

  // Stato mutabile SOLO dentro questa funzione (simulazione), copia dei dati puri.
  const stato = ordine.map((d) => ({ ...d, saldoResiduo: d.saldo, mesePagato: null }));
  let disponibileExtra = extraMensile;
  let interesseTotale = 0;
  let mese = 0;

  while (stato.some((d) => d.saldoResiduo > 0.005) && mese < MESI_MASSIMI) {
    mese++;
    // 1. Interesse mensile su ogni debito ancora aperto.
    for (const d of stato) {
      if (d.saldoResiduo <= 0.005) continue;
      const interesse = (d.saldoResiduo * (d.tasso / 100)) / 12;
      interesseTotale += interesse;
      d.saldoResiduo += interesse;
    }
    // 2. Pagamento minimo su ogni debito ancora aperto.
    for (const d of stato) {
      if (d.saldoResiduo <= 0.005) continue;
      d.saldoResiduo -= Math.min(d.pagamentoMinimo, d.saldoResiduo);
    }
    // 3. L'extra va in CASCATA sui debiti aperti, nell'ordine di priorità:
    // se il primo si estingue con margine, il resto passa al secondo nello
    // STESSO mese — la vera "valanga"/"palla di neve", non un'approssimazione.
    // I debiti con `penaleEstinzione` (tipicamente un mutuo) sono SALTATI
    // qui: ricevono sempre solo il proprio minimo, mai l'extra — l'ordine
    // di priorità passa al prossimo debito senza vincoli, mai bloccato da
    // uno che l'utente ha dichiarato di non voler/poter estinguere prima.
    let pool = disponibileExtra;
    for (const d of stato) {
      if (pool <= 0.005) break;
      if (d.saldoResiduo <= 0.005) continue;
      if (d.penaleEstinzione) continue;
      const pagatoOra = Math.min(pool, d.saldoResiduo);
      d.saldoResiduo -= pagatoOra;
      pool -= pagatoOra;
    }
    // 4. Ogni debito estinto QUESTO mese libera il suo minimo per i mesi
    // dopo — SOLO se `riallocaMinimi` (default sì): la baseline "cosa
    // succede senza fare nulla in più" (nessuna strategia, nessun extra)
    // passa `riallocaMinimi:false` per mostrare il vero scenario passivo,
    // dove ogni pagamento resta fisso al proprio minimo per sempre, mai
    // automaticamente redistribuito — altrimenti anche extraMensile=0
    // finirebbe comunque per comportarsi come una palla di neve blanda.
    for (const d of stato) {
      if (d.saldoResiduo <= 0.005 && d.mesePagato === null) {
        d.mesePagato = mese;
        if (riallocaMinimi) disponibileExtra += d.pagamentoMinimo;
      }
    }
  }

  const irrisolvibile = stato.some((d) => d.saldoResiduo > 0.005);
  const oggi = new Date();
  const dataLibero = irrisolvibile ? null : new Date(oggi.getFullYear(), oggi.getMonth() + mese, 1).toISOString().slice(0, 10);

  return {
    debiti: stato.map((d) => ({ id: d.id, nome: d.nome, saldo: d.saldo, tasso: d.tasso, mesePagato: d.mesePagato })),
    mesiTotali: irrisolvibile ? null : mese,
    interesseTotale: irrisolvibile ? null : +interesseTotale.toFixed(2),
    dataLibero,
    irrisolvibile,
    motivo: irrisolvibile ? tDebt('debtMotivoTroppoLungo', lang, extraMensile.toFixed ? extraMensile.toFixed(2) : extraMensile) : null,
  };
}

// Confronta le due strategie sugli stessi debiti/extra — mai una preferenza,
// solo i due risultati affiancati, coerente con "il quadro, non l'ordine".
export function confrontaStrategie(debiti, extraMensile = 0, lang = 'it') {
  const valanga = simulaEstinzione(debiti, { strategia: 'valanga', extraMensile, lang });
  const pallaDiNeve = simulaEstinzione(debiti, { strategia: 'palla-di-neve', extraMensile, lang });
  const differenzaInteresse = (!valanga.irrisolvibile && !pallaDiNeve.irrisolvibile)
    ? +(pallaDiNeve.interesseTotale - valanga.interesseTotale).toFixed(2) : null;
  const differenzaMesi = (!valanga.irrisolvibile && !pallaDiNeve.irrisolvibile)
    ? pallaDiNeve.mesiTotali - valanga.mesiTotali : null;
  // Baseline "cosa succede senza fare nulla in più" (richiesto esplicitamente
  // dall'utente, 2026-09-15): nessun extra, nessuna riallocazione dei minimi
  // liberati — il vero scenario passivo, non una terza strategia. Serve a
  // mostrare in euro/mesi QUANTO valgono le due strategie sopra, non solo
  // il confronto fra loro. Confrontabile solo se le strategie sopra sono
  // risolvibili (altrimenti la baseline lo è ancora meno, stesso motivo).
  const baseline = simulaEstinzione(debiti, { extraMensile: 0, riallocaMinimi: false, lang });
  return { valanga, pallaDiNeve, differenzaInteresse, differenzaMesi, baseline };
}

// Testo onesto per l'interfaccia: fatti, non un consiglio.
export function testoConfronto(confronto, lang = 'it') {
  const { valanga, pallaDiNeve, differenzaInteresse, differenzaMesi } = confronto;
  if (valanga.irrisolvibile || pallaDiNeve.irrisolvibile) {
    return (valanga.motivo || pallaDiNeve.motivo || tDebt('debtCompareUnresolvable', lang));
  }
  if (differenzaInteresse <= 0.01 && differenzaMesi === 0) {
    return tDebt('debtCompareSameResult', lang);
  }
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  return tDebt('debtCompareDiff', lang, eur(differenzaInteresse), differenzaMesi);
}

// Testo onesto sul valore della baseline (2026-09-15, richiesto
// esplicitamente): quanto vale DAVVERO la strategia scelta rispetto a non
// fare nulla in più — fatti, non un invito a mettere più extra di quanto
// l'utente possa permettersi.
export function testoBaseline(simScelta, baseline, lang = 'it') {
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  if (baseline.irrisolvibile && !simScelta.irrisolvibile) {
    return tDebt('debtBaselineUnresolvable', lang);
  }
  if (simScelta.irrisolvibile || baseline.irrisolvibile) return null; // niente da confrontare onestamente
  const eurSaved = +(baseline.interesseTotale - simScelta.interesseTotale).toFixed(2);
  const mesiSaved = baseline.mesiTotali - simScelta.mesiTotali;
  if (eurSaved <= 0.01 && mesiSaved <= 0) return tDebt('debtBaselineNoDiff', lang);
  return tDebt('debtBaselineSaving', lang, eur(eurSaved), mesiSaved);
}

// ── STRESS TEST TASSO VARIABILE (2026-09-16, richiesto esplicitamente) ──
// Simula QUESTO SOLO debito (mai gli altri: il punto è "cosa cambia per un
// mutuo/prestito preciso", non ricalcolare l'intero piano) con lo STESSO
// pagamento minimo dichiarato dall'utente, ma un tasso più alto — è
// esattamente ciò che succede a un tasso variabile quando il mercato sale:
// la rata contrattuale spesso resta fissa nel breve periodo, ma l'interesse
// dovuto cresce, quindi la stessa rata estingue il debito più lentamente (o,
// nei casi più seri, non basta più nemmeno a coprire l'interesse). Riusa
// simulaEstinzione così com'è, isolando il debito (extraMensile:0, un solo
// elemento nell'array) — nessuna nuova formula di ammortamento inventata.
export function stressTestTasso(debito, incrementi = [1, 2, 3], lang = 'it') {
  const base = simulaEstinzione([debito], { extraMensile: 0, lang });
  return incrementi.map((incremento) => {
    const conTassoAlto = simulaEstinzione([{ ...debito, tasso: (+debito.tasso || 0) + incremento }], { extraMensile: 0, lang });
    const confrontabile = !base.irrisolvibile && !conTassoAlto.irrisolvibile;
    return {
      incremento,
      irrisolvibile: conTassoAlto.irrisolvibile,
      motivo: conTassoAlto.motivo,
      mesiTotali: conTassoAlto.mesiTotali,
      interesseTotale: conTassoAlto.interesseTotale,
      differenzaMesi: confrontabile ? conTassoAlto.mesiTotali - base.mesiTotali : null,
      differenzaInteresse: confrontabile ? +(conTassoAlto.interesseTotale - base.interesseTotale).toFixed(2) : null,
    };
  });
}

// Testo onesto: il caso più grave PRIMA (se anche solo un incremento rende
// il debito irrisolvibile con la rata attuale, è l'unica cosa che conta
// davvero — mai un numero "in media" che nasconda quel rischio). Altrimenti
// l'impatto del PRIMO incremento (il più vicino/realistico da comunicare).
export function testoStressTasso(risultati, lang = 'it') {
  const primoIrrisolvibile = risultati.find((r) => r.irrisolvibile);
  if (primoIrrisolvibile) {
    return tDebt('debtStressTassoWarning', lang, primoIrrisolvibile.incremento);
  }
  const r = risultati[0];
  if (!r || r.differenzaMesi == null) return null;
  if (r.differenzaMesi <= 0 && r.differenzaInteresse <= 0.01) return null; // nessun impatto reale, mai un allarme vuoto
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  return tDebt('debtStressTassoImpact', lang, r.incremento, r.differenzaMesi, eur(r.differenzaInteresse));
}

// ── CONSOLIDAMENTO DEBITI (2026-09-16, richiesto esplicitamente) ──
// Ricerca di mercato (LendingTree, PrimeRates, usetoya.com 2026): il
// consolidamento fa risparmiare in media 1.750$ di interessi e libera 6 mesi
// prima — MA l'errore più comune è fidarsi della rata mensile più bassa come
// prova automatica del miglioramento: una rata più bassa a un termine più
// lungo può costare PIÙ interessi totali, e le spese di apertura (tipico
// 3-8 mesi per recuperarle) possono azzerare il beneficio. Qui si confronta
// SEMPRE il totale reale (interessi + mesi), mai solo la rata mensile — la
// stessa disciplina "il quadro, non un numero isolato" di tutto il modulo.
//
// `proposta`: { tasso, pagamentoMinimo, commissioneApertura = 0 }. La
// commissione è sommata al saldo del nuovo prestito (assunzione dichiarata:
// finanziata dentro il prestito, il caso più comune — se l'utente la paga
// cash separatamente, il confronto sui soli interessi resta comunque valido,
// solo il "saldo iniziale" del consolidato andrebbe letto senza la commissione).
// Il confronto usa SEMPRE la strategia valanga per lo scenario attuale (è
// il minimo interesse possibile con quei debiti separati — il confronto più
// onesto e favorevole possibile per lo status quo, mai una strategia peggiore
// scelta ad arte per far vincere il consolidamento).
export function confrontaConsolidamento(debitiEsistenti, proposta, { extraMensile = 0, lang = 'it' } = {}) {
  const attuale = simulaEstinzione(debitiEsistenti, { strategia: 'valanga', extraMensile, lang });
  const saldoTotale = (debitiEsistenti || []).reduce((s, d) => s + (+d.saldo || 0), 0);
  const nuovoDebito = {
    id: 'consolidato', nome: 'Prestito di consolidamento',
    saldo: saldoTotale + (+proposta.commissioneApertura || 0),
    tasso: +proposta.tasso || 0, pagamentoMinimo: +proposta.pagamentoMinimo || 0,
  };
  const consolidato = simulaEstinzione([nuovoDebito], { extraMensile, lang });
  const confrontabile = !attuale.irrisolvibile && !consolidato.irrisolvibile;
  return {
    attuale, consolidato,
    differenzaInteresse: confrontabile ? +(consolidato.interesseTotale - attuale.interesseTotale).toFixed(2) : null,
    differenzaMesi: confrontabile ? consolidato.mesiTotali - attuale.mesiTotali : null,
  };
}

// Testo onesto: la TRAPPOLA più comune (rata più bassa ma costo totale più
// alto o tempo più lungo) va segnalata sempre in chiaro, mai nascosta dietro
// "risparmi X€ al mese" — è esattamente l'errore di valutazione più citato
// nella ricerca di mercato su questo tema.
export function testoConsolidamento(confronto, lang = 'it') {
  const { attuale, consolidato, differenzaInteresse, differenzaMesi } = confronto;
  if (consolidato.irrisolvibile) return tDebt('debtConsolidationUnviable', lang, consolidato.motivo || '');
  if (attuale.irrisolvibile) return tDebt('debtConsolidationCurrentUnresolvable', lang);
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  const costaDiPiu = differenzaInteresse > 0.01;
  const ciMetteDiPiu = differenzaMesi > 0;
  if (costaDiPiu || ciMetteDiPiu) {
    return tDebt('debtConsolidationTrap', lang, eur(Math.abs(differenzaInteresse)), Math.abs(differenzaMesi));
  }
  if (differenzaInteresse < -0.01 || differenzaMesi < 0) {
    return tDebt('debtConsolidationBetter', lang, eur(Math.abs(differenzaInteresse)), Math.abs(differenzaMesi));
  }
  return tDebt('debtConsolidationNoDiff', lang);
}

// ── TASSO PROMOZIONALE IN SCADENZA (2026-09-16, richiesto esplicitamente) ──
// Ricerca di mercato (dato CFPB citato da più fonti concordanti 2026): solo
// il 21% di chi ha un tasso promozionale 0%/introduttivo salda il saldo
// prima che scada; l'83% non chiude la carta alla scadenza, oltre metà
// continua a spendere. Il CFPB segnala che questi conti finiscono con saldi
// PIÙ ALTI nel lungo periodo dei conti senza promozione — non perché il
// tasso promozionale sia un male, ma perché la scadenza arriva senza
// preavviso reale per l'utente. Un debito può dichiarare `promoFino` (data
// ISO) e `tassoPostPromo` (aliquota che scatta dopo) — entrambi opzionali,
// mai un consiglio ("salda prima"), solo il conto alla rovescia e il numero.
export function promoScadeTraGiorni(debito, oggi = new Date()) {
  if (!debito || !debito.promoFino) return null;
  const scadenza = new Date(debito.promoFino + 'T00:00:00');
  if (Number.isNaN(scadenza.getTime())) return null;
  const giorni = Math.round((scadenza.getTime() - oggi.getTime()) / (24 * 3600 * 1000));
  return giorni; // negativo se già scaduta — dichiarato, mai nascosto
}

// Confronta il piano di estinzione ATTUALE (al tasso promozionale) con
// quello che scatterebbe SE il saldo di oggi restasse invariato al tasso
// post-promo — stesso principio di stressTestTasso (isola il debito, stessa
// rata, riusa simulaEstinzione), qui con un tasso di destinazione noto e
// dichiarato dall'utente invece di un'ipotesi di mercato.
export function impattoFinePromo(debito, lang = 'it') {
  if (!debito || debito.tassoPostPromo == null) return null;
  const attuale = simulaEstinzione([debito], { extraMensile: 0, lang });
  const dopoPromo = simulaEstinzione([{ ...debito, tasso: +debito.tassoPostPromo || 0 }], { extraMensile: 0, lang });
  const confrontabile = !attuale.irrisolvibile && !dopoPromo.irrisolvibile;
  return {
    attuale, dopoPromo,
    differenzaMesi: confrontabile ? dopoPromo.mesiTotali - attuale.mesiTotali : null,
    differenzaInteresse: confrontabile ? +(dopoPromo.interesseTotale - attuale.interesseTotale).toFixed(2) : null,
  };
}

export function testoImpattoFinePromo(risultato, lang = 'it') {
  if (!risultato) return null;
  if (risultato.dopoPromo.irrisolvibile) return tDebt('debtPromoUnviable', lang, risultato.dopoPromo.motivo || '');
  if (risultato.attuale.irrisolvibile) return null; // già segnalato altrove (debito irrisolvibile anche oggi)
  if (risultato.differenzaMesi <= 0 && risultato.differenzaInteresse <= 0.01) return null;
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  return tDebt('debtPromoImpact', lang, eur(risultato.differenzaInteresse), risultato.differenzaMesi);
}

// Testo del conto alla rovescia — separato dall'impatto: l'utente deve
// vedere PRIMA "quando" (concreto, una data) e solo dopo "quanto" (un
// calcolo che richiede più dati). Mai unire le due cose in una frase sola.
export function testoPromoScadenza(giorni, lang = 'it') {
  if (giorni == null) return null;
  if (giorni < 0) return tDebt('debtPromoExpired', lang);
  if (giorni > 45) return null; // troppo lontano, un avviso ora sarebbe rumore
  return tDebt('debtPromoExpiring', lang, giorni);
}

// ── RAPPORTO DEBITO/REDDITO — "posso permettermi un nuovo prestito?" ──
// (2026-09-16, richiesto esplicitamente: "capire come e quando ottenere un
// prestito", non solo come estinguerlo). Ricerca di mercato: il 43% è la
// soglia citata storicamente per i mutui USA, ma un'analisi su 30 milioni di
// domande reali (St. Louis Fed, 2026) trova la soglia VERA al 50% — sotto,
// i prestatori trattano il 45% quasi come il 35% (poco cambia); sopra il
// 50% "cambia il gioco" (rifiuti molto più frequenti). Il 20% delle persone
// ha già pagamenti debito ≥26% del proprio reddito (Penny Hoarder 2026).
// Nessuna banca mostra questo calcolo PRIMA di una richiesta — lo si scopre
// spesso solo dopo un rifiuto, con un'interrogazione (hard inquiry) che
// resta sul referto creditizio. Qui il calcolo è fatto PRIMA, con i dati
// reali già in Momentum (stipendio rilevato/dichiarato + debiti dichiarati),
// mai un consiglio ("chiedi il prestito") — solo il numero e dove si colloca.
//
// Soglie dichiarate (mai indovinate): 36% = prudente (linea guida di
// settore diffusa), 43% = soglia storicamente citata, 50% = soglia reale
// trovata dalla ricerca 2026 sopra citata, oltre la quale i rifiuti
// aumentano nettamente.
export const DTI_SOGLIA_PRUDENTE = 0.36;
export const DTI_SOGLIA_STORICA = 0.43;
export const DTI_SOGLIA_CRITICA = 0.50;

// Pura: somma i pagamenti minimi mensili di TUTTI i debiti con saldo reale
// (mai un debito già estinto, saldo<=0, a gonfiare il rapporto). Non include
// affitto/mutuo/altri impegni fissi che non sono nell'elenco Debiti — limite
// dichiarato, non un dato nascosto: se l'utente ha un mutuo, va aggiunto
// come debito qui per essere conteggiato (stesso identico elenco che già usa
// per il piano di estinzione, nessun secondo posto dove dichiararlo).
export function calcolaDTI(debiti, redditoMensile) {
  const rate = (debiti || []).filter((d) => (+d.saldo || 0) > 0).reduce((s, d) => s + (+d.pagamentoMinimo || 0), 0);
  const reddito = +redditoMensile || 0;
  if (reddito <= 0) return { rate, reddito: 0, dti: null };
  return { rate, reddito, dti: +(rate / reddito).toFixed(4) };
}

// Quanto extra di rata mensile l'utente potrebbe sostenere restando sotto
// una soglia data (default: quella storica 43%, la più citata e prudente
// come riferimento pratico) — mai un incoraggiamento a spendere quel
// margine, solo il numero che risponde a "quanto potrei chiedere in modo
// sicuro". Può essere negativo: dichiarato esplicitamente (già oltre soglia).
export function capacitaExtraPrestito(debiti, redditoMensile, soglia = DTI_SOGLIA_STORICA) {
  const { rate, reddito } = calcolaDTI(debiti, redditoMensile);
  if (reddito <= 0) return null;
  return +(reddito * soglia - rate).toFixed(2);
}

export function testoDTI(dtiInfo, lang = 'it') {
  if (!dtiInfo || dtiInfo.dti == null) return tDebt('debtDtiUnknownIncome', lang);
  const pct = Math.round(dtiInfo.dti * 100);
  if (dtiInfo.dti >= DTI_SOGLIA_CRITICA) return tDebt('debtDtiCritico', lang, pct);
  if (dtiInfo.dti >= DTI_SOGLIA_STORICA) return tDebt('debtDtiAttenzione', lang, pct);
  if (dtiInfo.dti >= DTI_SOGLIA_PRUDENTE) return tDebt('debtDtiModerato', lang, pct);
  return tDebt('debtDtiOttimo', lang, pct);
}

export function testoCapacitaExtra(extra, lang = 'it') {
  if (extra == null) return null;
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  if (extra < 0) return tDebt('debtDtiOverThreshold', lang, eur(extra));
  return tDebt('debtDtiCapacity', lang, eur(extra));
}

// ── REGISTRA UN PAGAMENTO — chiudere il gap reale trovato nella ricerca
// competitor (2026-09-16): Tally (il concorrente più finanziato in questo
// spazio) ha chiuso nel 2024; i due sopravvissuti più citati (Undebt.it,
// Debt Payoff Planner) richiedono entrambi il tracciamento MANUALE del
// saldo — nessuno collega il piano ai dati reali, l'utente deve ricalcolare
// e riscrivere il nuovo saldo ogni mese a mano. Qui non serve ricalcolare
// nulla: un tocco solo, importo pre-compilato con la rata dichiarata (mai
// un automatismo silenzioso — l'utente conferma sempre, può correggere
// l'importo se ha pagato di più/meno quel mese). Pura, non muta l'input.
export function registraPagamento(debito, importo) {
  const pagato = Math.max(0, +importo || 0);
  const nuovoSaldo = Math.max(0, (+debito.saldo || 0) - pagato);
  return { ...debito, saldo: +nuovoSaldo.toFixed(2) };
}

// ── CONFRONTO DI PIÙ OFFERTE DI PRESTITO (2026-09-16, richiesto
// esplicitamente: deve valere in ogni Paese, non solo in Italia) ──
// Generalizza confrontaConsolidamento a N offerte contemporanee — lo stesso
// bisogno reale (nessun sito/app confronta le offerte sul COSTO TOTALE
// reale, quasi tutti si fermano al tasso nominale o alla rata, esattamente
// l'errore di valutazione già documentato per il consolidamento). QUESTA
// funzione è matematica di ammortamento pura (tasso/saldo/rata): **zero
// dipendenza da regole fiscali o soglie normative di un singolo Paese** —
// a differenza di calcolaDTI (soglie USA/Canada) o dei motori fiscali
// (IT/CH/ES), qui non c'è nessun dato locale da sbagliare o da coprire
// Paese per Paese. Funziona identica per un prestito in qualunque valuta
// (la cifra è già quella dell'utente, mai un cambio valuta assunto qui —
// confrontare offerte in valute diverse richiederebbe un tasso di cambio,
// instabile per natura: fuori scope, dichiarato).
export function confrontaOfferte(debitiEsistenti, offerte, { extraMensile = 0, lang = 'it' } = {}) {
  const attuale = simulaEstinzione(debitiEsistenti, { strategia: 'valanga', extraMensile, lang });
  const saldoTotale = (debitiEsistenti || []).reduce((s, d) => s + (+d.saldo || 0), 0);
  const risultati = (offerte || []).map((offerta, i) => {
    const nuovoDebito = {
      id: `offerta_${i}`, nome: offerta.nome || `Offerta ${i + 1}`,
      saldo: saldoTotale + (+offerta.commissioneApertura || 0),
      tasso: +offerta.tasso || 0, pagamentoMinimo: +offerta.pagamentoMinimo || 0,
    };
    const sim = simulaEstinzione([nuovoDebito], { extraMensile, lang });
    const confrontabile = !attuale.irrisolvibile && !sim.irrisolvibile;
    return {
      nome: nuovoDebito.nome,
      consolidato: sim,
      differenzaInteresse: confrontabile ? +(sim.interesseTotale - attuale.interesseTotale).toFixed(2) : null,
      differenzaMesi: confrontabile ? sim.mesiTotali - attuale.mesiTotali : null,
    };
  });
  // Classifica onesta: per costo totale REALE (interesse pagato), mai per
  // rata o tasso nominale — le offerte irrisolvibili vanno sempre in fondo,
  // mai spacciate per "vantaggiose" solo perché un campo è vuoto/null.
  const classifica = [...risultati].sort((a, b) => {
    const aIrr = a.consolidato.irrisolvibile, bIrr = b.consolidato.irrisolvibile;
    if (aIrr && bIrr) return 0;
    if (aIrr) return 1;
    if (bIrr) return -1;
    return a.consolidato.interesseTotale - b.consolidato.interesseTotale;
  });
  return { attuale, offerte: risultati, classifica };
}

// Testo per singola offerta: riusa ESATTAMENTE testoConsolidamento (stessa
// disciplina, mai una seconda formula/messaggio per lo stesso concetto).
export function testoOfferta(risultatoOfferta, attuale, lang = 'it') {
  return testoConsolidamento({ attuale, consolidato: risultatoOfferta.consolidato, differenzaInteresse: risultatoOfferta.differenzaInteresse, differenzaMesi: risultatoOfferta.differenzaMesi }, lang);
}

// Solo il VERDETTO della classifica (mai un consiglio su cosa fare, solo il
// fatto): quale offerta costa meno in totale, e quanto la seconda migliore
// perde rispetto a lei — utile per capire se il distacco è reale o marginale.
export function testoMigliorOfferta(classifica, lang = 'it') {
  if (!classifica || !classifica.length) return null;
  const [prima, seconda] = classifica;
  if (prima.consolidato.irrisolvibile) return tDebt('debtOffersAllUnviable', lang);
  if (!seconda || seconda.consolidato.irrisolvibile) return tDebt('debtOffersOnlyViable', lang, prima.nome);
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  const differenza = +(seconda.consolidato.interesseTotale - prima.consolidato.interesseTotale).toFixed(2);
  return tDebt('debtOffersBest', lang, prima.nome, eur(differenza), seconda.nome);
}
