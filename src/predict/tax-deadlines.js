// ============================================================
// TAX-DEADLINES — il fisco entra nella PREVISIONE DI CASSA
// ============================================================
// È il pezzo che un portale di fatturazione non può costruire, per un motivo
// strutturale: lui vede le fatture, non il conto. Momentum vede entrambi.
// Da qui la differenza tra "il 30 novembre paghi 3.200 €" (un promemoria,
// come tutti) e "il 12 novembre saresti sotto di 900 €: mettine via 150 a
// settimana da adesso e ci arrivi" (una previsione, che nessun altro può
// fare senza vedere la cassa).
//
// Le scadenze NON sono un calendario scritto a mano: sono generate dalle
// regole dell'anno (tax-rules.js, versionate e aggiornabili) e dagli importi
// REALI calcolati dalle fatture dell'utente (tax.js). Se cambia una fattura,
// cambiano anche gli importi delle scadenze — mai due verità separate.
//
// Onestà (regola #1): sono STIME su regole pubbliche, mai consulenza
// fiscale. Le date sono verificate, gli importi sono proiezioni dichiarate
// come tali, e il commercialista resta sempre l'ultima parola.
'use strict';

import { rulesForYear } from './tax-rules.js';

const DAY_MS = 86_400_000;

// Le scadenze vivono in tax-rules.js (versionate per anno d'imposta e
// AGGIORNABILI da remoto via fetchRulesUpdate, con guardrail anti-veleno) —
// richiesta esplicita dell'utente: se le date cambiano e lui non aggiorna
// l'app, deve poterle ricevere lo stesso. Qui resta solo la rete di
// sicurezza per un anno privo di scadenze verificate: mai un calendario
// vuoto che farebbe sparire in silenzio ogni avviso fiscale.
const SCADENZE_FALLBACK = [
  { id: 'saldo-primo-acconto', mese: 6, giorno: 30, quota: 0.5, label: 'Saldo + primo acconto' },
  { id: 'secondo-acconto', mese: 11, giorno: 30, quota: 0.5, label: 'Secondo acconto' },
];

export function scadenzeForYear(anno, rulesOverride = null) {
  const r = rulesForYear(anno, rulesOverride);
  return Array.isArray(r?.scadenze) && r.scadenze.length ? r.scadenze : SCADENZE_FALLBACK;
}

// Mantenuto per compatibilità con chi importava la costante: sono le
// scadenze dell'anno corrente secondo le regole in vigore.
export const SCADENZE_ANNUALI = SCADENZE_FALLBACK;

// Sabato/domenica → primo giorno lavorativo successivo. Nota onesta: NON
// tiene conto delle festività infrasettimanali (servirebbe un calendario
// festivo per anno, che non abbiamo verificato) — per questo la data è
// dichiarata come "indicativa" nella UI, mai come una certezza al giorno.
export function slittaSeFestivo(date) {
  const d = new Date(date);
  const giorno = d.getUTCDay();
  if (giorno === 6) d.setUTCDate(d.getUTCDate() + 2); // sabato → lunedì
  else if (giorno === 0) d.setUTCDate(d.getUTCDate() + 1); // domenica → lunedì
  return d;
}

// Genera le prossime scadenze fiscali con gli importi stimati.
// `totaleAnnuoStimato` = quanto si prevede di dover versare in un anno
// (tax.js: projectAnnualTax.estimatedAnnualTax) — mai un numero inventato qui.
// `giaVersato` = quanto l'utente ha già dichiarato di aver pagato
// (tax-payments.js), così una scadenza già coperta non allarma inutilmente.
// `rulesOverride`: regole scaricate e già validate (auto-aggiornamento T13).
// Passandole, le scadenze seguono le date nuove SENZA aggiornare l'app.
export function upcomingTaxDeadlines(totaleAnnuoStimato, {
  now = new Date(), orizzonteGiorni = 400, giaVersato = 0, rulesOverride = null,
} = {}) {
  const totale = Number.isFinite(+totaleAnnuoStimato) ? Math.max(0, +totaleAnnuoStimato) : 0;
  if (totale === 0) return [];
  const daCoprire = Math.max(0, totale - (Number.isFinite(+giaVersato) ? +giaVersato : 0));
  if (daCoprire === 0) return [];

  const oggi = new Date(now);
  const limite = new Date(oggi.getTime() + orizzonteGiorni * DAY_MS);
  const out = [];
  // Due anni di finestra: basta a coprire qualunque orizzonte fino a ~400
  // giorni partendo da qualsiasi punto dell'anno.
  for (const anno of [oggi.getUTCFullYear(), oggi.getUTCFullYear() + 1]) {
    // Le scadenze si leggono per ANNO: se cambiano da un anno all'altro
    // (o arrivano aggiornate da remoto), ogni anno usa le sue.
    for (const s of scadenzeForYear(anno, rulesOverride)) {
      const data = slittaSeFestivo(new Date(Date.UTC(anno, s.mese - 1, s.giorno)));
      if (data <= oggi || data > limite) continue;
      out.push({
        id: `${s.id}-${anno}`,
        label: s.label,
        date: data.toISOString().slice(0, 10),
        ms: data.getTime(),
        importo: +(daCoprire * s.quota).toFixed(2),
        giorniMancanti: Math.round((data - oggi) / DAY_MS),
        stimato: true, // MAI spacciato per un importo certo
      });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

// Converte le scadenze in eventi per cash-forecast.js — usa il ponte
// `extraLedgerEvents` già esistente, così il motore di cassa NON deve
// conoscere il fisco (resta indipendente, come già fa con le rate BNPL).
export function taxDeadlinesToLedgerEvents(deadlines) {
  return (deadlines || []).map((d) => ({
    date: d.date,
    ms: d.ms,
    amount: -Math.abs(d.importo),
    kind: 'fisco',
    label: d.label,
    source: 'tax-deadline',
    id: d.id,
    // Una scadenza fiscale è certa nella DATA ma non nell'IMPORTO (è una
    // proiezione sul fatturato dell'anno): non va trattata come un impegno
    // a importo fisso, altrimenti la banda di incertezza mentirebbe.
    certain: false,
  }));
}

// L'AVVISO PREDITTIVO: il pezzo che nessun portale può dare.
// `forecast` = risultato di cashForecast() con le scadenze già innestate.
// Ritorna il piano di accantonamento settimanale per arrivare alla scadenza
// senza scoprirsi, oppure null se non serve (già coperti).
export function taxCashWarning(deadlines, forecast, { riservaGiaAccantonata = 0 } = {}) {
  const prossima = (deadlines || [])[0];
  if (!prossima) return null;

  const scoperto = forecast?.riskDay || null;
  const settimane = Math.max(1, Math.ceil(prossima.giorniMancanti / 7));
  const daMettereVia = Math.max(0, prossima.importo - (Number.isFinite(+riservaGiaAccantonata) ? +riservaGiaAccantonata : 0));
  const perSettimana = +(daMettereVia / settimane).toFixed(2);

  if (daMettereVia === 0) {
    return {
      urgenza: 'ok',
      scadenza: prossima,
      perSettimana: 0,
      messaggio: `Per ${prossima.label.toLowerCase()} del ${formatDate(prossima.date)} hai già messo via abbastanza. Nessun pensiero.`,
    };
  }

  // Il caso che vale l'intera funzione: la cassa prevista scende sotto zero
  // PRIMA della scadenza. Qui non è un promemoria, è un avviso vero.
  if (scoperto && scoperto.ms <= prossima.ms) {
    return {
      urgenza: 'alta',
      scadenza: prossima,
      perSettimana,
      giornoCritico: scoperto.date,
      messaggio: `Il ${formatDate(scoperto.date)} rischi di restare senza, e il ${formatDate(prossima.date)} devi versare ~${euro(prossima.importo)}. Mettine via ${euro(perSettimana)} a settimana da adesso e ci arrivi.`,
    };
  }

  return {
    urgenza: 'media',
    scadenza: prossima,
    perSettimana,
    messaggio: `Il ${formatDate(prossima.date)} versi ~${euro(prossima.importo)}: mettine via ${euro(perSettimana)} a settimana e non te ne accorgi nemmeno.`,
  };
}

function euro(n) { return `${Math.round(+n || 0).toLocaleString('it-IT')} €`; }
function formatDate(iso) {
  const [y, m, d] = String(iso).split('-');
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  return `${+d} ${mesi[+m - 1]}`;
}
