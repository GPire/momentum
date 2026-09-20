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
import { retaIrpfPeriodo, irpfEstatal } from './tax-es.js';
import { collectionReport } from '../invoice/collection-report.js';
import { invoiceCollectionsCopy, invoiceCollectionReportNote } from '../i18n/invoice-collections.js';

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
  const avs = computeAvsIndipendente(incassato, { attivitaAccessoria: opts.attivitaAccessoria === true });
  return {
    paese: 'CH', valuta: 'CHF', anno: year, generatoIl: (opts.now || new Date()).toISOString(),
    invoiceCollections: collectionReport(opts.invoices || [], transactions, opts.invoiceCollections || {}, 'CH', year),
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
  const annualInvoices = entrateFatturaAnno(transactions, year, opts);
  const valid = annualInvoices.filter(t => Number.isFinite(Number(t.amount)) && Number(t.amount) >= 0);
  const annualGross = +valid.reduce((sum,t) => sum + Number(t.amount),0).toFixed(2);
  // The period engine expects ONE MONTH, never the entire year's receipts.
  // A 12-month average is a declared scenario, not proof of months registered in RETA.
  const r = retaIrpfPeriodo(valid.length ? [{ type:'entrata', taxable:true, amount:annualGross / 12 }] : [], { baseElegida: opts.baseElegida, territorio: opts.territorio });
  const cuotaRetaAnnua = r.reta ? +(r.reta.cuotaMensual * 12).toFixed(2) : 0;
  // Territorio foral (2026-09-06): irpfMensual è `null`, non 0 — MAI
  // trasformarlo in un IRPF annuo di €0 (sarebbe un numero inventato nella
  // direzione opposta, "non devi niente" invece di "non lo calcoliamo").
  const irpfAnnuo = r.irpfMensual != null ? irpfEstatal(annualGross) : null;
  return {
    paese: 'ES', valuta: 'EUR', anno: year, generatoIl: (opts.now || new Date()).toISOString(),
    invoiceCollections: collectionReport(opts.invoices || [], transactions, opts.invoiceCollections || {}, 'ES', year),
    incassato: annualGross, count: valid.length,
    contributi: r.reta ? [{ voce: 'RETA (estimación sobre media anual × 12)', importo: cuotaRetaAnnua }] : [],
    contributoNonCalcolabile: null,
    imposta: r.count > 0 && irpfAnnuo != null ? { voce: 'IRPF (solo escalón estatal)', importo: irpfAnnuo } : null,
    noteOneste: [
      'RETA: escenario sobre ingresos registrados / 12 meses; no acredita los meses reales de alta ni los rendimientos netos. Faltan gastos deducibles y regularización. No es una liquidación.',
      ...(valid.length !== annualInvoices.length ? ['Hay importes inválidos excluidos del cálculo: revisa los movimientos originales.'] : []),
      ...(r.territorioForal
        ? ['Tu territorio (País Vasco/Navarra) tiene un sistema de IRPF foral propio: el IRPF NO está incluido en este informe, solo RETA — pídeselo a tu Hacienda Foral o gestor.']
        : ['El IRPF mostrado es solo el tramo ESTATAL: falta el tramo autonómico (17 comunidades, cada una con su escala) — el importe real de la declaración será distinto.']),
      'La retención (7%/15%) que tus clientes ya aplican en cada factura no está restada aquí: este total es lo que se debe antes de esa retención.',
    ],
  };
}

// Etichette del documento in 7 lingue (2026-09-14): il Paese fiscale (CH/ES)
// e la lingua dell'utente sono cose DIVERSE — un ticinese o un romando ha la
// app in it/fr, non deve ricevere un documento forzato in tedesco solo
// perché il Paese è CH. LIMITE DICHIARATO: le note sostanziali di
// `noteOneste` (generate in tax-ch.js/tax-es.js con importi e URL ufficiali
// interpolati) restano nella lingua in cui sono scritte alla fonte —
// tradurle di corsa qui, senza verificare ogni cifra/norma citata, violerebbe
// lo stesso principio già applicato a tax.js nel progetto ("mai tradurre
// contenuto normativo senza aver verificato la fonte"). Solo le etichette
// strutturali (titolo, intestazioni, valuta) seguono la lingua dell'utente.
const ETICHETTE = {
  it: { titolo: 'Riepilogo fiscale', anno: 'Anno', incassato: 'Incassato', daAccantonare: 'Da accantonare', dettaglio: 'Dettaglio', voce: 'Voce', importo: 'Importo', nota: 'Documento generato automaticamente da Momentum a partire dai dati inseriti dal titolare nell\'app (100% on-device, nessun server). È un riepilogo di calcolo, non un documento fiscale ufficiale: gli importi vanno sempre verificati col professionista prima di qualunque adempimento.' },
  en: { titolo: 'Tax summary', anno: 'Year', incassato: 'Received', daAccantonare: 'To set aside', dettaglio: 'Breakdown', voce: 'Item', importo: 'Amount', nota: 'Document automatically generated by Momentum from the data entered by the account holder in the app (100% on-device, no server). This is a calculation summary, not an official tax document: amounts must always be verified with a professional before any filing.' },
  de: { titolo: 'Steuerübersicht', anno: 'Jahr', incassato: 'Einkommen', daAccantonare: 'Zurückzulegen', dettaglio: 'Aufschlüsselung', voce: 'Position', importo: 'Betrag', nota: 'Automatisch von Momentum aus den vom Inhaber in der App eingegebenen Daten erstellt (100% on-device, kein Server). Dies ist eine Berechnungsübersicht, kein amtliches Steuerdokument: die Beträge müssen vor jeder Massnahme immer von der Fachperson geprüft werden.' },
  fr: { titolo: 'Résumé fiscal', anno: 'Année', incassato: 'Encaissé', daAccantonare: 'À mettre de côté', dettaglio: 'Détail', voce: 'Poste', importo: 'Montant', nota: 'Document généré automatiquement par Momentum à partir des données saisies par le titulaire dans l\'application (100% on-device, aucun serveur). Il s\'agit d\'un résumé de calcul, pas d\'un document fiscal officiel : les montants doivent toujours être vérifiés avec le professionnel avant toute démarche.' },
  es: { titolo: 'Resumen fiscal', anno: 'Año', incassato: 'Ingresado', daAccantonare: 'A reservar', dettaglio: 'Desglose', voce: 'Concepto', importo: 'Importe', nota: 'Documento generado automáticamente por Momentum a partir de los datos introducidos por el titular en la app (100% on-device, sin servidor). Es un resumen de cálculo, no un documento fiscal oficial: los importes deben verificarse siempre con el profesional antes de cualquier trámite.' },
  nl: { titolo: 'Belastingoverzicht', anno: 'Jaar', incassato: 'Ontvangen', daAccantonare: 'Opzij te zetten', dettaglio: 'Uitsplitsing', voce: 'Post', importo: 'Bedrag', nota: 'Automatisch gegenereerd door Momentum op basis van de gegevens die de gebruiker in de app heeft ingevoerd (100% on-device, geen server). Dit is een berekeningsoverzicht, geen officieel belastingdocument: de bedragen moeten altijd met de adviseur worden geverifieerd vóór elke actie.' },
  pt: { titolo: 'Resumo fiscal', anno: 'Ano', incassato: 'Recebido', daAccantonare: 'A reservar', dettaglio: 'Detalhe', voce: 'Rubrica', importo: 'Montante', nota: 'Documento gerado automaticamente pelo Momentum a partir dos dados inseridos pelo titular na app (100% on-device, sem servidor). É um resumo de cálculo, não um documento fiscal oficial: os valores devem ser sempre verificados com o profissional antes de qualquer procedimento.' },
};

// Stesso stile del documento italiano (accountant-export.js), contenuto
// adattato: niente tabella fatture (non esiste l'equivalente strutturato in
// questi due Paesi), solo il riepilogo contributi/imposta/disponibile.
export function renderAccountantReportHTMLIntl(report, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Default INVARIATO per chi chiama senza `lang` (retrocompatibile): ES in
  // spagnolo, tutto il resto (oggi solo CH) in tedesco, come prima di questa
  // modifica — mai una rottura per un punto di chiamata non ancora aggiornato.
  const fallbackLang = report.paese === 'ES' ? 'es' : 'de';
  const et = ETICHETTE[meta.lang] || ETICHETTE[fallbackLang];
  const locale = `${meta.lang && ETICHETTE[meta.lang] ? meta.lang : fallbackLang}-${report.paese}`;
  const money = (n) => `${(+n || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${report.valuta}`;
  const totaleAccantonare = +([...report.contributi, ...(report.imposta ? [report.imposta] : [])].reduce((s, v) => s + v.importo, 0)).toFixed(2);
  const righeVoci = [...report.contributi, ...(report.imposta ? [report.imposta] : [])]
    .map(v => `<tr><td>${esc(v.voce)}</td><td class="r">${money(v.importo)}</td></tr>`).join('');
  const titolo = `${et.titolo} ${esc(meta.emitter || '')}`;
  const c=invoiceCollectionsCopy(meta.lang || fallbackLang), collections=report.invoiceCollections;
  const collectionHtml=collections && (collections.rows.length || collections.reviewCount) ? `<h2>${esc(c.title)}</h2><p>${esc(invoiceCollectionReportNote(meta.lang || fallbackLang))}</p>${collections.reviewCount ? `<p>${esc(c.stale)} (${collections.reviewCount})</p>` : ''}<table><thead><tr><th>${esc(c.invoice)}</th><th>${esc(c.receipt)}</th><th>${esc(c.amount)}</th><th>${esc(c.due)}</th></tr></thead><tbody>${collections.rows.map(r=>`<tr><td>${esc(r.invoiceNumber)}/${esc(r.invoiceYear)} · ${esc(r.client)}</td><td>${esc(r.date)} · ${esc(r.receiptId)}</td><td>${esc(r.amount)} ${esc(r.currency)}</td><td>${esc(r.remaining)} ${esc(r.currency)}</td></tr>`).join('')}</tbody></table>` : '';
  return `<!doctype html><html lang="${locale.split('-')[0]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo} — ${esc(report.anno)}</title>
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
td{overflow-wrap:anywhere;padding:6px 4px;border-bottom:1px solid #f1f5f9}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:11px;color:#64748b;margin-top:24px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px}
@media(max-width:480px){body{padding:16px}.grid{grid-template-columns:1fr}table{font-size:11px}}
@media print{body{padding:16px}}
</style></head><body>
<h1>${titolo}</h1>
<div class="sub">${et.anno} ${esc(report.anno)} · ${new Date(report.generatoIl).toLocaleDateString(locale)}</div>
<div class="grid">
  <div class="box"><div class="lbl">${et.incassato}</div><div class="val">${money(report.incassato)}</div></div>
  <div class="box"><div class="lbl">${et.daAccantonare}</div><div class="val">${money(totaleAccantonare)}</div></div>
</div>
${righeVoci ? `<h2>${et.dettaglio}</h2><table><thead><tr><th>${et.voce}</th><th class="r">${et.importo}</th></tr></thead><tbody>${righeVoci}</tbody></table>` : ''}
${report.contributoNonCalcolabile ? `<p style="font-size:12px;color:#334155">${esc(report.contributoNonCalcolabile)}</p>` : ''}
${collectionHtml}
<div class="note">${report.noteOneste.map(esc).join('<br><br>')}<br><br>${et.nota}</div>
</body></html>`;
}
