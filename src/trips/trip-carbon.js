// ============================================================
// IMPRONTA DI CO2 DELLA TRASFERTA — stima dichiarata, non una misura
// ============================================================
// Driver reale (non marketing): la direttiva UE CSRD obbliga sempre più
// aziende a rendicontare le emissioni Scope 3 anche dei viaggi di lavoro —
// nessun competitor comune (Concur/Expensify/Zoho/Pleo) lo include gratis
// nel prodotto base, è quasi sempre un modulo o un tool a pagamento separato.
//
// Fattori di emissione da fonte PRIMARIA pubblica e verificabile (UK
// Government GHG Conversion Factors 2026, DESNZ):
// https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026
// Arrotondati a 3 decimali (mai una falsa precisione oltre quella che una
// stima media può onestamente dare). La soglia corto/lungo raggio per i
// voli (3.700 km) è la stessa usata dalla fonte.
//
// Limite dichiarato, non nascosto: sono fattori MEDI (occupante singolo per
// l'auto, classe economica per l'aereo, rete nazionale per il treno) — il
// consumo reale di un modello specifico o l'occupazione reale di un volo
// possono differire anche sensibilmente. L'autobus/coach non è ancora
// coperto (nessun fattore verificato con la stessa fonte primaria).
export const FATTORI_CO2_KG_PER_KM = Object.freeze({
  auto: 0.208,
  treno: 0.040,
  aereo_corto: 0.126,
  aereo_lungo: 0.117,
});

const SOGLIA_LUNGO_RAGGIO_KM = 3700;

// Suggerisce corto/lungo raggio dalla distanza, per chi non sa quale scegliere
// — l'utente resta comunque libero di scegliere l'altro modo esplicitamente.
export function modoAereoSuggerito(distanzaKm) {
  return distanzaKm >= SOGLIA_LUNGO_RAGGIO_KM ? 'aereo_lungo' : 'aereo_corto';
}

// mi -> km: unica conversione, mai duplicata altrove per lo stesso calcolo.
export function convertiInKm(distanza, unita) {
  if (!(distanza > 0)) return null;
  return unita === 'mi' ? Math.round(distanza * 1.60934 * 100) / 100 : distanza;
}

// Stima pura: nessun fattore noto o distanza non valida -> null, mai un
// numero indovinato per un modo di trasporto che non copriamo (es. bus).
export function stimaCo2Kg(modo, distanzaKm) {
  const fattore = FATTORI_CO2_KG_PER_KM[modo];
  if (!fattore || !(distanzaKm > 0)) return null;
  return Math.round(distanzaKm * fattore * 100) / 100;
}

// Somma le stime già calcolate e salvate sulle spese di una trasferta (mai
// ricalcolata da capo qui: ogni spesa porta la propria stima congelata al
// momento del salvataggio, coerente con la disciplina di audit del resto
// del modulo trasferte — un fattore di emissione aggiornato l'anno dopo non
// deve cambiare in silenzio il totale di una trasferta già chiusa).
export function totaleCo2Trasferta(expenses) {
  let kg = 0, coperte = 0, nonCoperte = 0;
  for (const tx of expenses || []) {
    if (tx?.co2?.kg > 0) { kg += tx.co2.kg; coperte++; }
    else if (tx?.tripCategory === 'trasporto') nonCoperte++;
  }
  return { kg: Math.round(kg * 100) / 100, speseCoperte: coperte, speseTrasportoNonCoperte: nonCoperte };
}
