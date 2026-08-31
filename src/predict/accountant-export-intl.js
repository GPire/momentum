// ============================================================
// PONTE COMMERCIALISTA — Svizzera e Spagna
// ============================================================
// Stesso principio di accountant-export.js (Italia): un documento leggibile
// e stampabile, calcolato SOLO da funzioni fiscali già esistenti (mai una
// seconda formula), che dice esplicitamente cosa NON copre invece di tacere.
// File separato apposta: CH ed ES non hanno un equivalente delle fatture
// strutturate italiane (FatturaPA, invoices[]) — l'utente in quei Paesi
// traccia solo le transazioni, quindi il report è più semplice per
// costruzione, non per pigrizia. Funzioni pure, nessun DOM.
'use strict';

import { classifyIncome } from './tax.js';
import { computeAvsIndipendente } from './tax-ch.js';
import { retaIrpfPeriodo } from './tax-es.js';

function entrateFatturaAnno(transactions, year, opts = {}) {
  const flat = Object.values(transactions || {}).flat()
    .filter(t => t.type === 'entrata' && new Date(t.date).getFullYear() === year);
  return flat.filter(t => classifyIncome(t, opts.learned, opts.model).kind === 'invoice');
}

// Svizzera: solo AVS indipendente (contributo previdenziale). Le imposte
// cantonali/comunali NON sono calcolate — limite dichiarato altrove nel
// progetto (26 cantoni, ognuno con moltiplicatori propri, mai stimati senza
// dato reale): il report lo dice in chiaro, non lo nasconde sommando uno 0.
export function buildAccountantReportCh(transactions, year, opts = {}) {
  // La Svizzera non ha un accantonamento continuativo dalle transazioni
  // come IT/ES (solo un simulatore: l'utente dichiara un reddito annuo a
  // mano). `opts.redditoManuale`, quando presente, usa QUEL valore — così
  // il riepilogo scaricato dal simulatore combacia col numero appena
  // simulato, invece di ricalcolare (magari a zero) dalle transazioni.
  const usaManuale = opts.redditoManuale != null;
  const fatture = usaManuale ? [] : entrateFatturaAnno(transactions, year, opts);
  const incassato = usaManuale ? +(+opts.redditoManuale).toFixed(2) : +fatture.reduce((s, t) => s + t.amount, 0).toFixed(2);
  const avs = computeAvsIndipendente(incassato);
  return {
    paese: 'CH', valuta: 'CHF', anno: year, generatoIl: (opts.now || new Date()).toISOString(),
    incassato, count: usaManuale ? 1 : fatture.length,
    contributi: avs.contributo !== null ? [{ voce: 'AVS indipendente', importo: avs.contributo }] : [],
    contributoNonCalcolabile: avs.contributo === null ? avs.nota : null,
    imposta: null,
    noteOneste: [
      'Le imposte cantonali e comunali (equivalente svizzero dell\'IRPEF) NON sono calcolate qui: variano per i 26 cantoni con moltiplicatori propri, e senza il dato reale del tuo Comune il numero sarebbe indovinato.',
      avs.nota || null,
    ].filter(Boolean),
  };
}

// Spagna: RETA (contributi, per tramo di reddito mensile) + IRPF statale.
// riusa retaIrpfPeriodo così com'è (già separa le due voci) — nessuna
// somma "a mano" per non introdurre un secondo calcolo divergente.
export function buildAccountantReportEs(transactions, year, opts = {}) {
  const flat = Object.values(transactions || {}).flat()
    .filter(t => t.type === 'entrata' && new Date(t.date).getFullYear() === year);
  const r = retaIrpfPeriodo(flat, { learned: opts.learned, model: opts.model, baseElegida: opts.baseElegida });
  const cuotaRetaAnnua = r.reta ? +(r.reta.cuotaMensual * 12).toFixed(2) : 0;
  const irpfAnnuo = +(r.irpfMensual * 12).toFixed(2);
  return {
    paese: 'ES', valuta: 'EUR', anno: year, generatoIl: (opts.now || new Date()).toISOString(),
    incassato: r.incassato, count: r.count,
    contributi: r.reta ? [{ voce: 'RETA (cuota mensual × 12)', importo: cuotaRetaAnnua }] : [],
    contributoNonCalcolabile: null,
    imposta: r.count > 0 ? { voce: 'IRPF (solo escalón estatal)', importo: irpfAnnuo } : null,
    noteOneste: [
      'El IRPF mostrado es solo el tramo ESTATAL: falta el tramo autonómico (17 comunidades, cada una con su escala) — el importe real de la declaración será distinto.',
      'La retención (7%/15%) que tus clientes ya aplican en cada factura no está restada aquí: este total es lo que se debe antes de esa retención.',
    ],
  };
}

// Stesso stile del documento italiano (accountant-export.js), contenuto
// adattato: niente tabella fatture (non esiste l'equivalente strutturato in
// questi due Paesi), solo il riepilogo contributi/imposta/disponibile.
export function renderAccountantReportHTMLIntl(report, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => `${(+n || 0).toLocaleString(report.paese === 'ES' ? 'es-ES' : 'de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${report.valuta}`;
  const totaleAccantonare = +([...report.contributi, ...(report.imposta ? [report.imposta] : [])].reduce((s, v) => s + v.importo, 0)).toFixed(2);
  const righeVoci = [...report.contributi, ...(report.imposta ? [report.imposta] : [])]
    .map(v => `<tr><td>${esc(v.voce)}</td><td class="r">${money(v.importo)}</td></tr>`).join('');
  const titolo = report.paese === 'ES' ? `Resumen fiscal ${esc(meta.emitter || '')}` : `Steuerübersicht ${esc(meta.emitter || '')}`;
  return `<!doctype html><html lang="${report.paese === 'ES' ? 'es' : 'de'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo} — ${esc(report.anno)}</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#1a1a1a;background:#fff}
h1{font-size:19px;margin:0 0 2px}
.sub{color:#64748b;font-size:12px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
.box{border:1px solid #e2e8f0;border-radius:8px;padding:12px}
.box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px}
.box .val{font-size:18px;font-weight:800}
h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#334155;border-bottom:2px solid #1a1a1a;padding-bottom:4px;margin-top:28px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th{text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;padding:6px 4px;border-bottom:1px solid #e2e8f0}
td{padding:6px 4px;border-bottom:1px solid #f1f5f9}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:11px;color:#64748b;margin-top:24px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px}
@media print{body{padding:16px}}
</style></head><body>
<h1>${titolo}</h1>
<div class="sub">${report.paese === 'ES' ? 'Año' : 'Jahr'} ${esc(report.anno)} · ${new Date(report.generatoIl).toLocaleDateString(report.paese === 'ES' ? 'es-ES' : 'de-CH')}</div>
<div class="grid">
  <div class="box"><div class="lbl">${report.paese === 'ES' ? 'Ingresado' : 'Einkommen'}</div><div class="val">${money(report.incassato)}</div></div>
  <div class="box"><div class="lbl">${report.paese === 'ES' ? 'A reservar' : 'Zurückzulegen'}</div><div class="val">${money(totaleAccantonare)}</div></div>
</div>
${righeVoci ? `<h2>${report.paese === 'ES' ? 'Desglose' : 'Aufschlüsselung'}</h2><table><thead><tr><th>${report.paese === 'ES' ? 'Concepto' : 'Position'}</th><th class="r">${report.paese === 'ES' ? 'Importe' : 'Betrag'}</th></tr></thead><tbody>${righeVoci}</tbody></table>` : ''}
${report.contributoNonCalcolabile ? `<p style="font-size:12px;color:#334155">${esc(report.contributoNonCalcolabile)}</p>` : ''}
<div class="note">${report.noteOneste.map(esc).join('<br><br>')}<br><br>${report.paese === 'ES' ? 'Documento generado automáticamente por Momentum a partir de los datos introducidos por el titular en la app (100% on-device, sin servidor). Es un resumen de cálculo, no un documento fiscal oficial: los importes deben verificarse siempre con el profesional antes de cualquier trámite.' : 'Automatisch von Momentum aus den vom Inhaber in der App eingegebenen Daten erstellt (100% on-device, kein Server). Dies ist eine Berechnungsübersicht, kein amtliches Steuerdokument: die Beträge müssen vor jeder Massnahme immer von der Fachperson geprüft werden.'}</div>
</body></html>`;
}
