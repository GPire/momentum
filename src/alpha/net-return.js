// ============================================================
// IL NETTO VERO — nessuna app di educazione mostra questo numero
// ============================================================
// I simulatori e le app di educazione finanziaria mostrano quasi sempre il
// rendimento LORDO ("il tuo ETF ha reso il 7%"). Un ETF al 7% lordo non è
// un ETF al 7%: in Italia si applicano l'imposta sulle plusvalenze e il
// bollo titoli, e vederli sottratti cambia le decisioni più di qualsiasi
// consiglio. Onestà (regola #1): non è consulenza fiscale, sono le
// aliquote pubbliche italiane applicate al portafoglio dichiarato.
//
// Aliquote verificate incrociando più fonti indipendenti (agosto 2026):
//  - Capital gain su azioni/ETF/crypto: 26% sulla plusvalenza realizzata.
//  - Capital gain su titoli di Stato italiani ed equiparati (BTP, BOT...):
//    12,5% (aliquota agevolata, storicamente stabile).
//  - Bollo titoli: 0,20% annuo sul valore del deposito, con ESENZIONE se
//    il valore medio annuo è sotto 5.000€ — si applica al deposito nel suo
//    insieme, non posizione per posizione.
// Fonti: consulenzavincente.it, funnifin.com, nevist.it, onlinesim.it,
// investireitalia.com (tassazione investimenti Italia 2026).
//
// LIMITE ONESTO E DICHIARATO: l'aliquota agevolata 12,5% si applica ai
// titoli di Stato italiani ed equiparati, non a "tutte le obbligazioni" — qui la
// si applica quando assetClass è 'bond', un'approssimazione dichiarata
// (un'obbligazione societaria pagherebbe il 26% pieno, non 12,5%: verificare
// caso per caso). Le minusvalenze possono compensare plusvalenze future
// (zainetto fiscale) — qui NON simulato: ogni posizione in perdita non
// genera credito d'imposta, solo onestà "quella posizione non paga nulla".
'use strict';

export const ALIQUOTA_CAPITAL_GAIN = 0.26;
export const ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO = 0.125;
export const BOLLO_TITOLI_ALIQUOTA_ANNUA = 0.002;
export const BOLLO_TITOLI_SOGLIA_ESENZIONE = 5000;

function aliquotaPer(assetClass) {
  return assetClass === 'bond' ? ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO : ALIQUOTA_CAPITAL_GAIN;
}

// `rows` = le righe già arricchite da analyzePortfolio (ticker, assetClass,
// value, cost, pl, plPct...). Ritorna le stesse righe con netPl/netPlPct in
// più, e i totali di portafoglio già al netto di imposta e bollo.
export function computeNetReturn(rows = [], totalValue = 0) {
  const righe = (rows || []).map((r) => {
    const aliquota = aliquotaPer(r.assetClass);
    const imposta = r.pl > 0 ? +(r.pl * aliquota).toFixed(2) : 0;
    const netPl = +(r.pl - imposta).toFixed(2);
    const netPlPct = r.cost > 0 ? +((netPl / r.cost) * 100).toFixed(1) : 0;
    return { ...r, aliquotaCapitalGain: aliquota, impostaCapitalGain: imposta, netPl, netPlPct };
  });

  const totaleImposta = +righe.reduce((s, r) => s + r.impostaCapitalGain, 0).toFixed(2);
  const bollo = totalValue >= BOLLO_TITOLI_SOGLIA_ESENZIONE
    ? +(totalValue * BOLLO_TITOLI_ALIQUOTA_ANNUA).toFixed(2)
    : 0;
  const totalPlLordo = +righe.reduce((s, r) => s + r.pl, 0).toFixed(2);
  const totalCost = +righe.reduce((s, r) => s + r.cost, 0).toFixed(2);
  const netTotalPl = +(totalPlLordo - totaleImposta - bollo).toFixed(2);
  const netTotalPlPct = totalCost > 0 ? +((netTotalPl / totalCost) * 100).toFixed(1) : 0;

  return {
    rows: righe,
    totalPlLordo,
    totaleImpostaCapitalGain: totaleImposta,
    bolloTitoli: bollo,
    bolloEsente: totalValue < BOLLO_TITOLI_SOGLIA_ESENZIONE,
    netTotalPl,
    netTotalPlPct,
    disclaimer: 'Aliquote pubbliche italiane (26% capital gain, 12,5% titoli di Stato, bollo 0,2% annuo) applicate ai dati che hai inserito — non è consulenza fiscale. Le minusvalenze non generano qui un credito d\'imposta per gli anni futuri (zainetto fiscale non simulato): verifica col commercialista se hai posizioni chiuse in perdita.',
  };
}
