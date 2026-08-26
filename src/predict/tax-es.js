// ============================================================
// AUTÓNOMOS SPAGNOLI — RETA (contributi) + IRPF (solo scaglione statale) + IVA
// ============================================================
// Modulo SEPARATO da tax.js (Italia) e da tax-ch.js (Svizzera): il sistema
// spagnolo non ha un forfettario/ordinario da scegliere come l'Italia — dal
// 2023 i contributi RETA si scelgono per TRAMO di reddito netto MENSILE
// (rendimientos netos), non calcolati come percentuale pura del reddito
// come l'INPS Gestione Separata italiana. Forzare i due sistemi in un unico
// modulo produrrebbe calcoli sbagliati — stessa ragione già scritta per
// tax-ch.js.
//
// Verificato su fonte PRIMARIA (agosto 2026): la tabella dei tramos viene
// dal Boletín Oficial del Estado stesso (Orden PJC/297/2026, Articolo 18
// apartado 1 — boe.es/buscar/act.php?id=BOE-A-2026-7296), NON da siti di
// aggregazione. 15 tramos in tutto (3 tabla reducida + 12 tabla general),
// confermato con DUE letture separate della fonte primaria dopo che la
// prima aveva sotto-contato le righe della tabla general (9 invece di 12,
// errore di riassunto proprio — non delle fonti secondarie, che invece
// avevano ragione fin dall'inizio: caso reale di un doppio controllo che
// ha trovato un errore mio, non altrui, ed è per questo che qui c'è la
// riga riga confrontata due volte invece di una fidata alla prima lettura.
//
// LIMITE ONESTO E DICHIARATO (stessa disciplina di tax-ch.js sull'AVS sotto
// soglia): l'IRPF spagnolo ha DUE componenti sommate sulla stessa base —
// statale (uguale per tutti, tabella qui sotto, verificata su fonti
// concordanti) e autonómica (decisa da ciascuna delle 17 comunidades
// autónomas, aliquote diverse ognuna, spesso variate di anno in anno). Qui
// si calcola SOLO la componente statale: la parte autonómica NON è stimata
// — sarebbe un'aliquota indovinata per una delle 17 comunità, esattamente
// il tipo di numero che questo progetto si rifiuta di inventare. Il totale
// reale è più alto di quanto calcolato qui, e lo si dice sempre in chiaro.
'use strict';

import { computeIrpef } from './tax-rules.js';
import { classifyIncome } from './tax.js';

// ── RETA: contributi per tramo di reddito netto mensile ──
// Tabla reducida (rendimientos bassi) + tabla general, tabella 2026
// completa dal BOE. `baseMinima` è la scelta di default (la più comune:
// molti autónomos versano il minimo del proprio tramo) — l'utente PUÒ
// scegliere una base più alta fino a `baseMaxima` per una pensione futura
// maggiore, mai imposto da Momentum.
export const RETA_TRAMOS_2026 = [
  { rendimientoHasta: 670, baseMinima: 653.59, baseMaxima: 718.94 },
  { rendimientoHasta: 900, baseMinima: 718.95, baseMaxima: 900.00 },
  { rendimientoHasta: 1166.70, baseMinima: 849.67, baseMaxima: 1166.70 },
  { rendimientoHasta: 1300, baseMinima: 950.98, baseMaxima: 1300.00 },
  { rendimientoHasta: 1500, baseMinima: 960.78, baseMaxima: 1500.00 },
  { rendimientoHasta: 1700, baseMinima: 960.78, baseMaxima: 1700.00 },
  { rendimientoHasta: 1850, baseMinima: 1143.79, baseMaxima: 1850.00 },
  { rendimientoHasta: 2030, baseMinima: 1209.15, baseMaxima: 2030.00 },
  { rendimientoHasta: 2330, baseMinima: 1274.51, baseMaxima: 2330.00 },
  { rendimientoHasta: 2760, baseMinima: 1356.21, baseMaxima: 2760.00 },
  { rendimientoHasta: 3190, baseMinima: 1437.91, baseMaxima: 3190.00 },
  { rendimientoHasta: 3620, baseMinima: 1519.61, baseMaxima: 3620.00 },
  { rendimientoHasta: 4050, baseMinima: 1601.31, baseMaxima: 4050.00 },
  { rendimientoHasta: 6000, baseMinima: 1732.03, baseMaxima: 5101.20 },
  { rendimientoHasta: Infinity, baseMinima: 1928.10, baseMaxima: 5101.20 },
];
// Tipo di cotización 2026: contingencias comunes 28,30% + contingencias
// profesionales 1,30% + MEI (Mecanismo de Equidad Intergeneracional) 0,90%
// — sale dallo 0,80% del 2025, verificato su più fonti concordanti.
export const RETA_ALIQUOTA_2026 = 0.283 + 0.013 + 0.009; // 0.305

// Il tramo che corrisponde al reddito netto MENSILE dichiarato — chi lo
// stima sbagliato può cambiare tramo fino a 6 volte l'anno (regola reale,
// non applicata qui: Momentum calcola solo il tramo di OGGI).
export function tramoReta(rendimientoNetoMensual) {
  const reddito = Math.max(0, +rendimientoNetoMensual || 0);
  return RETA_TRAMOS_2026.find((t) => reddito <= t.rendimientoHasta) || RETA_TRAMOS_2026[RETA_TRAMOS_2026.length - 1];
}

// Cuota RETA mensile. `baseElegida` opzionale: se assente, usa la base
// mínima del tramo (la scelta più comune, mai un valore più alto imposto).
export function cuotaReta(rendimientoNetoMensual, { baseElegida = null } = {}) {
  const tramo = tramoReta(rendimientoNetoMensual);
  const base = baseElegida != null
    ? Math.min(Math.max(baseElegida, tramo.baseMinima), tramo.baseMaxima)
    : tramo.baseMinima;
  return {
    tramo,
    baseUsata: +base.toFixed(2),
    cuotaMensual: +(base * RETA_ALIQUOTA_2026).toFixed(2),
    baseÈMinima: baseElegida == null,
  };
}

// ── IRPF: SOLO scaglione statale (vedi limite onesto in testa al file) ──
export const IRPF_ESTATAL_2026 = [
  { fino: 12450, aliquota: 0.095 },
  { fino: 20200, aliquota: 0.12 },
  { fino: 35200, aliquota: 0.15 },
  { fino: 60000, aliquota: 0.185 },
  { fino: 300000, aliquota: 0.225 },
  { fino: null, aliquota: 0.245 },
];

// Imposta statale sul reddito imponibile annuo — riusa la stessa aritmetica
// a scaglioni già scritta per l'Italia (computeIrpef, tax-rules.js): ogni
// fascia paga solo la sua aliquota, mai l'intero imponibile alla fascia
// più alta. Nessuna seconda formula duplicata.
export function irpfEstatal(baseImponibleAnnua) {
  return +computeIrpef(Math.max(0, baseImponibleAnnua || 0), IRPF_ESTATAL_2026).toFixed(2);
}

// ── IVA (verificato su Agencia Tributaria, agosto 2026, invariata dal 2025) ──
export const IVA_ES = {
  general: 0.21,   // la maggior parte dei servizi professionali
  reducido: 0.10,  // alimentazione, ristorazione, trasporto
  superreducido: 0.04, // beni di prima necessità
};

// ── Retención IRPF sulle fatture: un meccanismo che l'Italia non ha ──
// A differenza del forfettario italiano (nessuna ritenuta d'acconto), i
// professionisti autónomos in Spagna hanno una ritenuta applicata
// direttamente dal CLIENTE su ogni fattura, versata da lui all'Hacienda —
// poi scontata dall'IRPF dovuto in dichiarazione annuale. Non è un costo
// aggiuntivo: è liquidità che l'autónomo non vede subito, va dichiarato
// perché altrimenti il "netto in tasca per fattura" sembrerebbe più alto
// di quanto arriva davvero sul conto.
export const RETENCION_IRPF = {
  general: 0.15,
  reducidaPrimeriAnni: 0.07, // primo anno di attività + i due successivi
};

// Quanto arriva REALMENTE sul conto per una fattura di `importe` (IVA
// esclusa), al netto della ritenuta trattenuta dal cliente — non del
// contributo RETA/IRPF finale, che si versano a parte (stessa separazione
// già usata in tax.js fra IVA/INPS/imposta).
export function nettoFatturaConRitenuta(importe, { primeriAnni = false } = {}) {
  const imp = Math.max(0, +importe || 0);
  const aliquota = primeriAnni ? RETENCION_IRPF.reducidaPrimeriAnni : RETENCION_IRPF.general;
  const ritenuta = +(imp * aliquota).toFixed(2);
  return { importe: imp, ritenuta, netto: +(imp - ritenuta).toFixed(2), aliquota };
}

// ── Accantonamento reale su un periodo (2026-08-26) — dalle TRANSAZIONI VERE
// del Vault, non da un importo digitato a mano ogni volta. Riusa
// classifyIncome (tax.js, ora esteso con parole spagnole: factura, honorarios,
// nómina, reembolso...) per riconoscere quali entrate sono fatture.
//
// DIFFERENZA IMPORTANTE rispetto a taxSetAsideForPeriod (Italia): lì si somma
// il "da accantonare" transazione per transazione, corretto perché l'INPS/
// IRPEF italiani sono proporzionali al singolo incasso. La RETA spagnola
// NON lo è — è un IMPORTO FISSO per tramo di reddito MENSILE TOTALE. Sommare
// per-transazione produrrebbe più tramos bassi invece di uno solo corretto
// sul totale (es. 10 fatture da 300€ darebbero 10 cuote basse invece di UNA
// cuota sul tramo dei 3.000€ reali) — qui si somma PRIMA, si cerca il tramo
// DOPO, una volta sola.
export function retaIrpfPeriodo(transactions, opts = {}) {
  const learned = opts.learned || null;
  const model = opts.model || null;
  const entrate = (transactions || []).filter((t) => t.type === 'entrata');
  let taxableGross = 0, excludedGross = 0, uncertainGross = 0;
  let taxableCount = 0, excludedCount = 0, uncertainCount = 0;
  const uncertain = [];
  for (const t of entrate) {
    const { kind } = classifyIncome(t, learned, model);
    if (kind === 'invoice') { taxableGross += t.amount; taxableCount++; }
    else if (kind === 'uncertain') { uncertainGross += t.amount; uncertainCount++; uncertain.push(t); }
    else { excludedGross += t.amount; excludedCount++; }
  }
  if (taxableCount === 0) {
    return {
      incassato: 0, count: 0, reta: null, irpfMensual: 0, disponibleReal: 0,
      excludedGross: +excludedGross.toFixed(2), excludedCount,
      uncertainGross: +uncertainGross.toFixed(2), uncertainCount, uncertain,
      note: excludedCount || uncertainCount ? 'Ninguna factura este periodo.' : 'Ningún ingreso registrado en este periodo.',
    };
  }
  const reta = cuotaReta(taxableGross, { baseElegida: opts.baseElegida });
  // IRPF: annualizza il reddito di QUESTO periodo (assume reddito costante
  // nel resto dell'anno) — stessa semplificazione dichiarata di
  // projectAnnualTax per l'Italia, mai spacciata per una dichiarazione
  // fiscale vera: è una stima del mese, non un calcolo annuale definitivo.
  const irpfAnnuo = irpfEstatal(taxableGross * 12);
  const irpfMensual = +(irpfAnnuo / 12).toFixed(2);
  const disponibleReal = +(taxableGross - reta.cuotaMensual - irpfMensual).toFixed(2);
  return {
    incassato: +taxableGross.toFixed(2), count: taxableCount, reta, irpfMensual, disponibleReal,
    excludedGross: +excludedGross.toFixed(2), excludedCount,
    uncertainGross: +uncertainGross.toFixed(2), uncertainCount, uncertain,
    note: `Sobre ${taxableCount} factura${taxableCount > 1 ? 's' : ''} (${taxableGross.toFixed(0)}€) aparta ~${(reta.cuotaMensual + irpfMensual).toFixed(0)}€ (RETA+IRPF): lo disponible real es ${disponibleReal.toFixed(0)}€.`,
  };
}
