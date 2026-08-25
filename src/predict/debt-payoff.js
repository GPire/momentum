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

const MESI_MASSIMI = 600; // 50 anni: oltre, dichiariamo che il debito non si estingue, non giriamo all'infinito

function normalizzaDebito(d) {
  return {
    id: d.id, nome: d.nome || 'Debito', saldo: +d.saldo || 0,
    tasso: +d.tasso || 0, pagamentoMinimo: +d.pagamentoMinimo || 0,
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
export function simulaEstinzione(debiti, { strategia = 'valanga', extraMensile = 0 } = {}) {
  const ordine = ordinaDebiti(debiti, strategia);
  if (!ordine.length) return { debiti: [], mesiTotali: 0, interesseTotale: 0, dataLibero: null, irrisolvibile: false };

  const insufficienti = ordine.filter(pagamentoInsufficiente);
  if (insufficienti.length) {
    return {
      debiti: ordine, mesiTotali: null, interesseTotale: null, dataLibero: null,
      irrisolvibile: true,
      motivo: `${insufficienti.map((d) => d.nome).join(', ')}: il pagamento minimo non copre nemmeno l'interesse — questo debito non si estinguerà mai a queste condizioni, serve un pagamento più alto.`,
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
    let pool = disponibileExtra;
    for (const d of stato) {
      if (pool <= 0.005) break;
      if (d.saldoResiduo <= 0.005) continue;
      const pagatoOra = Math.min(pool, d.saldoResiduo);
      d.saldoResiduo -= pagatoOra;
      pool -= pagatoOra;
    }
    // 4. Ogni debito estinto QUESTO mese libera il suo minimo per i mesi dopo.
    for (const d of stato) {
      if (d.saldoResiduo <= 0.005 && d.mesePagato === null) {
        d.mesePagato = mese;
        disponibileExtra += d.pagamentoMinimo;
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
    motivo: irrisolvibile ? `Con ${extraMensile.toFixed ? extraMensile.toFixed(2) : extraMensile}€/mese extra, alcuni debiti non si estinguono entro 50 anni: serve un extra più alto.` : null,
  };
}

// Confronta le due strategie sugli stessi debiti/extra — mai una preferenza,
// solo i due risultati affiancati, coerente con "il quadro, non l'ordine".
export function confrontaStrategie(debiti, extraMensile = 0) {
  const valanga = simulaEstinzione(debiti, { strategia: 'valanga', extraMensile });
  const pallaDiNeve = simulaEstinzione(debiti, { strategia: 'palla-di-neve', extraMensile });
  const differenzaInteresse = (!valanga.irrisolvibile && !pallaDiNeve.irrisolvibile)
    ? +(pallaDiNeve.interesseTotale - valanga.interesseTotale).toFixed(2) : null;
  const differenzaMesi = (!valanga.irrisolvibile && !pallaDiNeve.irrisolvibile)
    ? pallaDiNeve.mesiTotali - valanga.mesiTotali : null;
  return { valanga, pallaDiNeve, differenzaInteresse, differenzaMesi };
}

// Testo onesto per l'interfaccia: fatti, non un consiglio.
export function testoConfronto(confronto) {
  const { valanga, pallaDiNeve, differenzaInteresse, differenzaMesi } = confronto;
  if (valanga.irrisolvibile || pallaDiNeve.irrisolvibile) {
    return (valanga.motivo || pallaDiNeve.motivo || 'Con questi numeri, il debito non si estingue in un tempo ragionevole.');
  }
  if (differenzaInteresse <= 0.01 && differenzaMesi === 0) {
    return 'Con un solo debito, valanga e palla di neve danno lo stesso risultato — la scelta della strategia conta solo con più di un debito.';
  }
  const eur = (n) => `${Math.abs(n).toFixed(2).replace('.', ',')} €`;
  return `Valanga (priorità al tasso più alto) ti fa risparmiare ${eur(differenzaInteresse)} di interessi rispetto a palla di neve, ma palla di neve estingue il primo debito prima (${differenzaMesi > 0 ? `${differenzaMesi} mes${Math.abs(differenzaMesi) === 1 ? 'e' : 'i'} di differenza sul totale` : 'stesso tempo totale'}) — quale conta di più per te, i soldi o la vittoria rapida, lo decidi tu.`;
}
