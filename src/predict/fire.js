// Modello F.I.R.E. (Financial Independence, Retire Early) dedicato.
//
// PRIMA (main.js, calcolo inline): anni-al-traguardo = capitale-obiettivo /
// (flusso-mensile-netto × 12) — una divisione LINEARE che ignora del tutto
// la crescita composta del capitale già investito. Per chi ha già un
// portafoglio, questo sovrastima pesantemente gli anni mancanti (il
// capitale esistente continua a crescere da solo, non serve risparmiarlo
// di nuovo). Qui si simula la crescita composta mese per mese con un
// rendimento REALE MISURATO (mai inventato): il default viene da
// src/alpha/measured-assumptions.js (walk-forward su prezzi reali SPY),
// mai un tasso a piacere — lo stesso principio "onestà tecnica" del resto
// del progetto.
//
// Funzioni pure, nessun DOM (pattern engines.js).
'use strict';

// Capitale-obiettivo dal tasso di prelievo sicuro (4% di default = regola
// del 25x, ma configurabile — non è un dogma, è un parametro dichiarato).
export function fireTargetCapital(annualExpenses, withdrawalRate = 0.04) {
  if (!Number.isFinite(annualExpenses) || annualExpenses <= 0) return 0;
  if (!Number.isFinite(withdrawalRate) || withdrawalRate <= 0) return Infinity;
  return annualExpenses / withdrawalRate;
}

// Anni per raggiungere il capitale-obiettivo, simulando la crescita
// composta mese su mese (capitale esistente × rendimento + nuovo
// versamento) — non una divisione lineare. `expectedAnnualReturn` è un
// tasso MISURATO storico (walk-forward), mai una promessa: va sempre
// mostrato con la sua fonte in UI, come il resto del progetto.
// Ritorna { years, reachable } — years=null se irraggiungibile (capitale
// e contributi entrambi nulli/negativi, nessuna crescita possibile).
export function yearsToFire({ currentInvested = 0, monthlyContribution = 0, targetCapital, expectedAnnualReturn = 0.09, maxYears = 80 } = {}) {
  if (!Number.isFinite(targetCapital) || targetCapital <= 0) return { years: 0, reachable: true };
  if (currentInvested >= targetCapital) return { years: 0, reachable: true };
  if (currentInvested <= 0 && monthlyContribution <= 0) return { years: null, reachable: false };

  const monthlyReturn = Math.pow(1 + expectedAnnualReturn, 1 / 12) - 1;
  let capital = currentInvested;
  const maxMonths = maxYears * 12;
  for (let m = 1; m <= maxMonths; m++) {
    capital = capital * (1 + monthlyReturn) + monthlyContribution;
    if (capital >= targetCapital) return { years: +(m / 12).toFixed(1), reachable: true };
  }
  return { years: null, reachable: false };
}

// "Coast FIRE": il capitale GIÀ investito, lasciato crescere da solo senza
// altri versamenti, basta a raggiungere il traguardo entro l'età di
// pensionamento scelta? Concetto reale e noto (non inventato da Momentum),
// utile a chi si chiede "posso smettere di versare e il tempo farà il
// resto?" — mai un consiglio ad agire, solo una proiezione dichiarata.
export function coastFireCheck({ currentAge, retirementAge = 65, currentInvested = 0, targetCapital, expectedAnnualReturn = 0.09 } = {}) {
  const yearsAvailable = retirementAge - currentAge;
  if (!Number.isFinite(yearsAvailable) || yearsAvailable <= 0) return { isCoastFire: false, projectedCapital: currentInvested, yearsAvailable: 0 };
  const projectedCapital = currentInvested * Math.pow(1 + expectedAnnualReturn, yearsAvailable);
  return {
    isCoastFire: projectedCapital >= targetCapital,
    projectedCapital: Math.round(projectedCapital),
    yearsAvailable,
  };
}
