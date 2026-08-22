// ============================================================
// RISCHIO DI ROVINA — quanto rischiare per operazione, prima di non
// rialzarsi più
// ============================================================
// Cantiere E2 (PIANO_TASK_2026-08-21.md). La ricerca sul dimensionamento
// delle posizioni è netta: la DIMENSIONE della posizione pesa più del tasso
// di vincita — un trader che rischia il 2% del capitale a ogni operazione
// può rovinarsi anche con una strategia in pareggio, semplicemente perché
// abbastanza perdite consecutive erodono il capitale più in fretta di
// quanto le vincite lo ricostruiscano (l'asimmetria composta: perdere il
// 50% richiede un +100% per tornare pari).
//
// COSA QUESTO MODULO NON HA (onestà dichiarata, non aggirata): Momentum
// registra POSIZIONI (allocazioni) e TRANSAZIONI di spesa/entrata, non
// un registro di TRADE discreti (entrata/uscita/esito) — quindi non esiste
// un tasso di vincita REALE dell'utente da misurare, a differenza di
// portfolio-track-record.js che invece lavora sui pesi di allocazione
// veri. Qui la domanda è diversa: "SE rischio X% a operazione con un tasso
// di vincita Y, quanto è probabile la rovina" è un fatto MATEMATICO
// generale sul dimensionamento — vale per qualunque trader con quei
// parametri, non e' una previsione sul comportamento di chi legge. Si
// applica al capitale REALE dell'utente (l'importo in euro), mai a una
// sua strategia che non conosciamo.
//
// VERIFICATO QUI, NON CITATO: i numeri spesso ripetuti in letteratura
// (es. "2% per operazione -> 40-60% di rovina in 1000 operazioni") sono
// citazioni di altre fonti con altre assunzioni non sempre dichiarate.
// Questo modulo li MISURA da solo con Monte Carlo e le proprie assunzioni
// esplicite (soglia di rovina, tasso di vincita, rapporto vincita/perdita)
// — un numero diverso da quello citato altrove non è un errore, è una
// misura fatta con ipotesi diverse e dichiarate.
//
// Funzioni PURE, casualità iniettabile via seme (stesso RNG di
// forced-sale-risk.js, per coerenza nel progetto).
'use strict';

import { makeRng } from './forced-sale-risk.js';

// Sotto questa soglia di capitale residuo si conta "rovina": non zero (un
// conto non arriva quasi mai esattamente a zero, si liquida prima), ma un
// livello dal quale il capitale rimasto rende la strategia irrilevante — la
// meta' del capitale iniziale e' la soglia standard in letteratura sul
// dimensionamento delle posizioni, e resta il default qui.
export const SOGLIA_ROVINA_DEFAULT = 0.5;
export const OPERAZIONI_DEFAULT = 1000;
export const PERCORSI_DEFAULT = 3000;

// UNA simulazione: `operazioni` trade sequenziali su capitale che parte da 1,
// ognuno rischia `rischioPerOperazione` del capitale CORRENTE (non di quello
// iniziale — un conto che si e' gia' ridotto rischia una cifra assoluta più
// piccola, esattamente come un vero position sizing percentuale). Vince con
// probabilita' `tassoVincita`, guadagnando rischio*rapportoVincitaPerdita;
// perde altrimenti, perdendo l'intero rischio. Si ferma alla prima rovina
// (non serve continuare a simulare un conto già considerato perso).
function simulaUnPercorso(rng, { rischioPerOperazione, tassoVincita, rapportoVincitaPerdita, operazioni, sogliaRovina }) {
  let capitale = 1;
  for (let t = 0; t < operazioni; t++) {
    const vince = rng() < tassoVincita;
    capitale *= vince ? (1 + rischioPerOperazione * rapportoVincitaPerdita) : (1 - rischioPerOperazione);
    if (capitale <= sogliaRovina) return { rovinato: true, alTrade: t + 1 };
  }
  return { rovinato: false, capitaleFinale: capitale };
}

// La probabilita' di rovina su `percorsi` simulazioni indipendenti. Ritorna
// anche il numero di trade mediano alla rovina (per chi si rovina) — "quanto
// dura" e' informativo quanto "se succede".
export function rischioDiRovina({
  rischioPerOperazione, tassoVincita = 0.5, rapportoVincitaPerdita = 1,
  operazioni = OPERAZIONI_DEFAULT, sogliaRovina = SOGLIA_ROVINA_DEFAULT,
  percorsi = PERCORSI_DEFAULT, seed = 4242,
} = {}) {
  if (!Number.isFinite(rischioPerOperazione) || rischioPerOperazione <= 0 || rischioPerOperazione >= 1) {
    return { disponibile: false, motivo: 'il rischio per operazione deve essere una quota fra 0 e 1 (es. 0,02 per il 2%).' };
  }
  const rng = makeRng(seed);
  let rovine = 0;
  const tradeAllaRovina = [];
  for (let p = 0; p < percorsi; p++) {
    const r = simulaUnPercorso(rng, { rischioPerOperazione, tassoVincita, rapportoVincitaPerdita, operazioni, sogliaRovina });
    if (r.rovinato) { rovine++; tradeAllaRovina.push(r.alTrade); }
  }
  tradeAllaRovina.sort((a, b) => a - b);
  const mediana = tradeAllaRovina.length ? tradeAllaRovina[Math.floor(tradeAllaRovina.length / 2)] : null;
  return {
    disponibile: true,
    probabilitaRovina: +(rovine / percorsi).toFixed(4),
    percorsi, operazioni, rischioPerOperazione, tassoVincita, rapportoVincitaPerdita, sogliaRovina,
    tradeMedianiAllaRovina: mediana,
  };
}

// Applicato al capitale REALE dell'utente: stessa probabilita' matematica,
// ma raccontata in euro — "quanto resterebbe" invece di un rapporto astratto.
// `capitale` viene da fuori (net-worth.js/portfolio.js): questo modulo non
// legge mai lo stato del vault direttamente, resta puro e testabile.
export function rischioDiRovinaText(r, { capitale = null, unita = '€' } = {}) {
  if (!r?.disponibile) return r?.motivo || 'Dati insufficienti per calcolare il rischio di rovina.';
  const pct = Math.round(r.rischioPerOperazione * 100);
  const probPct = Math.round(r.probabilitaRovina * 100);
  const base = `Rischiando il ${pct}% del capitale a ogni operazione (${r.operazioni} operazioni simulate, tasso di vincita ${Math.round(r.tassoVincita * 100)}%): la probabilità misurata di scendere sotto il ${Math.round(r.sogliaRovina * 100)}% del capitale iniziale è ${probPct}%.`;
  const conCifra = Number.isFinite(capitale) && capitale > 0
    ? ` Sul tuo capitale di ${Math.round(capitale).toLocaleString('it-IT')}${unita}, significa scendere sotto ${Math.round(capitale * r.sogliaRovina).toLocaleString('it-IT')}${unita}.`
    : '';
  const durata = r.tradeMedianiAllaRovina
    ? ` Fra chi si rovina in questa simulazione, la mediana è dopo ${r.tradeMedianiAllaRovina} operazioni — non è quasi mai un crollo improvviso.`
    : '';
  return `${base}${conCifra}${durata} Non è una previsione su quello che farai: è la stessa matematica per chiunque rischi questa quota, a queste probabilità.`;
}
