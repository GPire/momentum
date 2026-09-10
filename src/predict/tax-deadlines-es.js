// ============================================================
// TAX-DEADLINES-ES — Modelo 130 (pago fraccionado IRPF), Spagna
// ============================================================
// Mossa 5 dell'analisi competitiva 2026-09-10: Momentum aveva già un motore
// di scadenze fiscali molto maturo (tax-deadlines.js: cash-forecast,
// ravvedimento, F24 precompilato) ma SOLO per l'Italia. Qui SOLO la data
// della prossima scadenza spagnola, con un importo dichiarato ESPLICITAMENTE
// come stima — non lo stesso livello di dettaglio dell'Italia per un
// motivo preciso (onestà, non pigrizia): il Modelo 130 reale è il 20% del
// reddito netto CUMULATO dell'anno meno i pagamenti/ritenute precedenti,
// un calcolo che richiede rileggere ogni transazione dell'anno con la
// stessa disciplina di taxSetAsideForPeriod — non ancora costruito qui.
// Quello che si può dire con certezza VERIFICATA è la DATA; l'importo è
// una proiezione dichiarata (3 mesi al ritmo del mese corrente), mai
// spacciata per il calcolo ufficiale.
//
// Svizzera, deliberatamente ASSENTE da questo modulo: l'AVS non ha una
// scadenza fissa nazionale come F24/Modelo 130 — ogni Ausgleichskasse
// cantonale fattura acconti secondo il proprio calendario (verificato
// nella ricerca competitiva: nessuna fonte, nemmeno i concorrenti CH
// verificati, cita una data unica). Inventare una data qui violerebbe la
// stessa regola di onestà già applicata altrove nel progetto (scala
// degressiva AVS, imposte cantonali) — resta un limite dichiarato, non un
// gap da chiudere senza un dato reale su cui appoggiarsi.
//
// Date verificate via ricerca web 2026-09-10, fonti concordanti (BOE/AEAT
// tramite più guide fiscali specializzate autónomos, nessuna in
// contraddizione): 1-20 aprile (1T), 1-20 luglio (2T), 1-20 ottobre (3T),
// 1-30 gennaio dell'anno successivo (4T). Si usa sempre l'ultimo giorno
// utile (20 o 30), mai la data di apertura del periodo.
'use strict';

import { slittaSeFestivo } from './tax-deadlines.js';

const DAY_MS = 86_400_000;

const MODELO_130_SCADENZE = [
  { id: 'modelo130-t1', mese: 4, giorno: 20, label: 'Modelo 130 · 1er trimestre' },
  { id: 'modelo130-t2', mese: 7, giorno: 20, label: 'Modelo 130 · 2º trimestre' },
  { id: 'modelo130-t3', mese: 10, giorno: 20, label: 'Modelo 130 · 3er trimestre' },
  { id: 'modelo130-t4', mese: 1, giorno: 30, label: 'Modelo 130 · 4º trimestre' },
];

// Tutte le scadenze Modelo 130 nell'orizzonte richiesto, in ordine
// cronologico — stesso pattern di upcomingTaxDeadlines (tax-deadlines.js):
// genera i candidati su due anni solari, filtra la finestra, ordina.
export function upcomingModelo130Deadlines(irpfMensualStimato, { now = new Date(), orizzonteGiorni = 130 } = {}) {
  const irpf = Number.isFinite(+irpfMensualStimato) ? Math.max(0, +irpfMensualStimato) : 0;
  if (irpf === 0) return [];
  const oggi = new Date(now);
  const limite = new Date(oggi.getTime() + orizzonteGiorni * DAY_MS);
  const out = [];
  for (const anno of [oggi.getUTCFullYear(), oggi.getUTCFullYear() + 1]) {
    for (const s of MODELO_130_SCADENZE) {
      const data = slittaSeFestivo(new Date(Date.UTC(anno, s.mese - 1, s.giorno)));
      if (data <= oggi || data > limite) continue;
      out.push({
        id: `${s.id}-${anno}`,
        label: s.label,
        date: data.toISOString().slice(0, 10),
        ms: data.getTime(),
        giorniMancanti: Math.round((data - oggi) / DAY_MS),
        // Proiezione dichiarata: 3 mesi al ritmo del mese corrente, NON il
        // 20% cumulato reale del Modelo 130 — vedi nota in testa al file.
        importoStimato: +(irpf * 3).toFixed(2),
        stimato: true,
        approssimato: true,
      });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

// Comodo per la UI: solo la prossima, o null se non c'è nulla da accantonare.
export function nextModelo130Deadline(irpfMensualStimato, opts = {}) {
  return upcomingModelo130Deadlines(irpfMensualStimato, opts)[0] || null;
}
