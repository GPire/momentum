// ============================================================
// PONTE COMMERCIALISTA — un pacchetto che si apre senza account
// ============================================================
// Il pezzo di T11 "Livello 2" che trasforma il commercialista da ostacolo a
// canale di distribuzione: invece di portargli le fatture una a una, o
// dargli accesso a un portale con account e password, gli si consegna un
// UNICO documento leggibile con tutto quello che gli serve per la
// liquidazione — fatturato, incassato per cassa, accantonamento, scadenze,
// e le anomalie che Momentum ha già intercettato da solo (fatture non
// incassate, entrate ambigue mai confermate). Gli si toglie il data entry,
// non gli si chiede di usare un altro strumento.
// Onestà (regola #1): questo è un RIEPILOGO calcolato dai dati che l'utente
// ha inserito nell'app — non sostituisce la contabilità del commercialista,
// non è un documento fiscale ufficiale. Lo dice esplicitamente nel testo.
// Funzioni pure, nessun DOM.
'use strict';

import { matchInvoicePayments, cashBasisRevenue, accrualRevenue, unpaidExposure } from './tax-cash-basis.js';
import { taxSetAsideForPeriod } from './tax.js';
import { taxReserveStatus } from './tax-payments.js';
import { upcomingTaxDeadlines } from './tax-deadlines.js';
import { collectionWorkspace, collectionInvoiceId } from '../invoice/collection-workspace.js';
import {invoiceReviewState} from '../invoice/invoice-review.js';

// Assembla il report per un anno: SOLO calcoli già esistenti nel progetto
// (nessuna seconda formula), messi in un unico posto leggibile. `opts`:
// { transactions (tutte, per mese), taxPayments, learned, model, rulesOverride }.
export function buildAccountantReport(invoices = [], transactions = {}, year, regime, opts = {}) {
  const allTx = transactions || {};
  const italianInvoices=(invoices || []).filter(i=>i && (i.country || 'IT')==='IT' && i.documentKind!=='payment-request');
  const invoicesYear = italianInvoices.filter(i => i.year === year);
  // Match the whole archive once: a January receipt may settle a December invoice.
  const collection = collectionWorkspace(invoices, allTx, opts.invoiceCollections || {});
  const reservedInvoices = new Set(collection.entries.map(e => e.invoiceId));
  const reservedReceipts = new Set(collection.entries.map(e => e.receiptId));
  // Never let a heuristic reuse money already assigned (or awaiting revalidation).
  const unmatchedTx = Object.fromEntries(Object.entries(allTx).map(([k,rows]) => [k,rows.filter(t => !reservedReceipts.has(String(t.id)))]));
  const matched = matchInvoicePayments(italianInvoices.filter(f => !reservedInvoices.has(collectionInvoiceId(f))), unmatchedTx);
  const confirmed = collection.ok ? collection.entries.flatMap(e => {
    const f=invoices.find(f=>collectionInvoiceId(f)===e.invoiceId), t=collection.receipts.find(t=>t.id===e.receiptId);
    const bill=collection.bills.find(b=>b.id===e.invoiceId);
    if (!f || (f.country || 'IT')!=='IT' || f.documentKind==='payment-request' || !t || bill?.currency !== 'EUR' || !Number.isFinite(Date.parse(t.date))) return [];
    return [{fattura:f,incassoData:t.date,annoIncasso:new Date(t.date).getUTCFullYear(),importoIncassato:e.amount,confidenza:'confermato'}];
  }) : [];
  const allReceipts = [...matched.incassate,...confirmed];
  const fatturato = accrualRevenue(invoicesYear, year);
  const incassato = cashBasisRevenue({incassate:allReceipts}, year);
  const esposizione = unpaidExposure({ nonIncassate: matched.nonIncassate.filter(m => m.fattura.year === year) }, { now: +(opts.now || new Date()) });

  const flatTx = Object.values(allTx).flat().filter(t => t.type === 'entrata' && new Date(t.date).getFullYear() === year);
  const accantonamento = taxSetAsideForPeriod(flatTx, { ...opts, regime: regime || 'forfettario', year });
  // Same normalized calculation for total and breakdown, including the selected pension profile.
  const scomposizione = accantonamento.breakdown;
  const riserva = taxReserveStatus(accantonamento.daAccantonare, opts.taxPayments || [], {year});
  const scadenze = upcomingTaxDeadlines(accantonamento.daAccantonare, {
    now: opts.now || new Date(), orizzonteGiorni: 400, giaVersato: riserva.versato, rulesOverride: opts.rulesOverride,
  });

  const fattureRiepilogo = invoicesYear.map(f => {
    const id=collectionInvoiceId(f);
    const explicit=reservedInvoices.has(id);
    const balance=collection.ok && explicit ? collection.result.invoices.find(i=>i.id===id) : null;
    const inc = matched.incassate.find(m => m.fattura.number === f.number && m.fattura.year === f.year);
    return {
      numero: f.number, anno: f.year, data: f.date, cliente: f.client, imponibile: f.imponibile,
      descrizione: f.description || '',
      stato: explicit ? (balance ? balance.remaining > 0 ? 'parziale' : 'incassata' : 'da verificare') : inc ? 'incassata' : 'non incassata',
      ...(balance ? {residuoNetto:balance.remaining,valuta:balance.currency,incassoConfermato:balance.allocated} : {}),
      dataIncasso: inc?.incassoData || null,
      confidenzaIncasso: balance ? 'confermato' : inc?.confidenza || null,
    };
  }).sort((a, b) => new Date(a.data) - new Date(b.data));

  return {
    anno: year,
    invoiceReviews: invoicesYear.filter(f=>(f.country || 'IT')==='IT').map(f=>({invoiceId:collectionInvoiceId(f),...invoiceReviewState(f,opts.invoiceReviewEvents || [])})),
    taxDocuments: (opts.taxPayments || []).filter(p=>p.taxYear===year && p.document).map(p=>({paymentId:p.id,...p.document})),
    regime: regime || null,
    generatoIl: (opts.now || new Date()).toISOString(),
    fatturato: +fatturato.toFixed(2),
    incassato: +incassato.toFixed(2),
    incassi: allReceipts.filter(m => m.annoIncasso === year).map(m => ({
      numeroFattura: m.fattura.number, annoFattura: m.fattura.year,
      cliente: m.fattura.client, data: m.incassoData,
      importo: m.importoIncassato, confidenza: m.confidenza,
    })),
    differenzaFatturatoIncassato: +(fatturato - incassato).toFixed(2),
    fatture: fattureRiepilogo,
    accantonamento: {
      dovuto: riserva.totaleDovuto,
      versato: riserva.versato,
      mancante: riserva.daAccantonare,
      // Contributi previdenziali (deducibili) separati dall'imposta dovuta:
      // la scomposizione che il commercialista chiede per primo, non un
      // totale unico.
      scomposizione,
    },
    scadenze: scadenze.map(s => ({ nome: s.label, data: s.date, importo: s.importo, giorniMancanti: s.giorniMancanti })),
    fattureNonIncassate: esposizione.aperte.map(a => ({ numero: a.fattura.number, cliente: a.fattura.client, imponibile: a.fattura.imponibile, giorniDaEmissione: a.giorniDaEmissione })),
    anomalie: {
      versamentiSenzaAnno: riserva.unassignedCount,
      importoVersamentiSenzaAnno: riserva.unassignedAmount,
      versamentiInvalidi: riserva.invalidCount,
      abbinamentiDaRivedere: collection.ok ? 0 : collection.entries.length,
      entrateAmbigueDaConfermare: accantonamento.uncertainCount,
      totaleEntrateAmbigue: accantonamento.uncertainGross,
    },
  };
}

// Documento HTML leggibile e stampabile — nessun account, nessun login,
// apribile da chiunque riceva il file. Volutamente sobrio (registro
// "documento di lavoro", non "fattura di design"): chi lo riceve è un
// professionista che deve trovare i numeri in fretta, non essere impressionato.
export function renderAccountantReportHTML(report, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const righeFatture = report.fatture.map(f => `<tr>
    <td>${esc(f.numero)}/${esc(f.anno)}</td><td>${esc(f.data)}</td><td>${esc(f.cliente)}</td>
    <td class="r">${eur(f.imponibile)}</td>
    <td>${f.stato === 'incassata' ? `Incassata ${esc(f.dataIncasso || '')}${f.confidenzaIncasso === 'media' ? ' (da confermare)' : ''}` : f.stato === 'parziale' ? `Parziale · residuo netto ${esc(f.residuoNetto)} ${esc(f.valuta)}` : f.stato === 'da verificare' ? 'Abbinamento da verificare' : 'Non incassata'}</td>
  </tr>`).join('');
  const righeScadenze = report.scadenze.map(s => `<tr><td>${esc(s.nome)}</td><td>${esc(s.data)}</td><td class="r">${eur(s.importo)}</td><td>tra ${esc(s.giorniMancanti)} giorni</td></tr>`).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Riepilogo ${esc(meta.emitter || '')} — ${esc(report.anno)}</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#1a1a1a;background:#fff}
h1{font-size:19px;margin:0 0 2px}
.sub{color:#64748b;font-size:12px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
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
<h1>Riepilogo fiscale ${esc(meta.emitter || '')}</h1>
<div class="sub">Anno ${esc(report.anno)} · Regime: ${esc(report.regime || 'non impostato')} · Generato il ${new Date(report.generatoIl).toLocaleDateString('it-IT')}</div>
<p class="note">Gli incassi abbinati descrivono la liquidità ricevuta: non sono automaticamente l'imponibile fiscale. IVA, ritenute, contributi e bollo possono rendere diverso il netto. Le conferme sono registrate dall'utente, non certificate dalla banca.</p>
${report.anomalie.abbinamentiDaRivedere ? `<p class="note">${esc(report.anomalie.abbinamentiDaRivedere)} abbinamento/i da rivedere: esclusi dagli incassi fino a nuova conferma.</p>` : ''}
${report.anomalie.versamentiSenzaAnno ? `<p class="note">${esc(report.anomalie.versamentiSenzaAnno)} versamento/i senza anno di riferimento (${eur(report.anomalie.importoVersamentiSenzaAnno)}): conservati ma esclusi dal totale versato di questo anno. Conferma l'anno dal documento di pagamento.</p>` : ''}
${report.anomalie.versamentiInvalidi ? `<p class="note">${esc(report.anomalie.versamentiInvalidi)} versamento/i con importo non valido esclusi: controlla il registro.</p>` : ''}
${report.invoiceReviews?.some(r=>r.history.length) ? `<h2>Controlli annotati sulle fatture</h2><p class="note">Registro locale dell'utente, non approvazioni del commercialista o esiti SdI.</p>${report.invoiceReviews.map(r=>r.history.length ? `<h3>${esc(r.invoiceId)}</h3><p>${r.open.length} da controllare · ${r.stale.length} riaperti dopo modifiche</p><ul>${r.open.map(e=>`<li>${esc(e.note)}</li>`).join('')}</ul>` : '').join('')}` : ''}
${report.taxDocuments?.length ? `<h2>Riferimenti F24 dichiarati</h2><p class="note">Non certificati dall'Agenzia delle Entrate. I crediti non sono dedotti automaticamente dal dovuto: verificarne utilizzo e disponibilità.</p><table><thead><tr><th>Documento</th><th>Tributo / anno</th><th>Cassa</th><th>Credito</th><th>Stato</th></tr></thead><tbody>${report.taxDocuments.map(d=>`<tr><td>${esc(d.reference)}</td><td>${esc(d.code)} / ${esc(d.taxYear)}</td><td>${eur(d.cashPaid)}</td><td>${eur(d.credit)}</td><td>${esc(d.status)}</td></tr>`).join('')}</tbody></table>` : ''}
<div class="grid">
  <div class="box"><div class="lbl">Fatturato (competenza)</div><div class="val">${eur(report.fatturato)}</div></div>
  <div class="box"><div class="lbl">Incassato (cassa)</div><div class="val">${eur(report.incassato)}</div></div>
  <div class="box"><div class="lbl">Da accantonare</div><div class="val">${eur(report.accantonamento.mancante)}</div></div>
</div>
<h2>Fatture (${report.fatture.length})</h2>
<table><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th class="r">Imponibile</th><th>Stato incasso</th></tr></thead><tbody>${righeFatture || '<tr><td colspan="5">Nessuna fattura in questo anno.</td></tr>'}</tbody></table>
${report.incassi?.length ? `<h2>Incassi abbinati nell'anno (${report.incassi.length})</h2><p class="note">Include fatture emesse in anni precedenti. La colonna Confidenza distingue le stime dagli abbinamenti confermati dall’utente. Questi ultimi possono essere parziali o cumulativi; non certificano un accredito bancario.</p><table><thead><tr><th>Fattura</th><th>Cliente</th><th>Data incasso</th><th class="r">Importo</th><th>Confidenza</th></tr></thead><tbody>${report.incassi.map(i => `<tr><td>${esc(i.numeroFattura)}/${esc(i.annoFattura)}</td><td>${esc(i.cliente)}</td><td>${esc(i.data)}</td><td class="r">${eur(i.importo)}</td><td>${esc(i.confidenza)}</td></tr>`).join('')}</tbody></table>` : ''}
${report.accantonamento.scomposizione.length ? `<h2>Come si compone l'accantonamento</h2><table><thead><tr><th>Voce</th><th class="r">Importo</th></tr></thead><tbody>${report.accantonamento.scomposizione.map(v => `<tr><td>${esc(v.voce)}</td><td class="r">${eur(v.importo)}</td></tr>`).join('')}<tr><td><b>Totale</b></td><td class="r"><b>${eur(report.accantonamento.mancante)}</b></td></tr></tbody></table>` : ''}
${report.scadenze.length ? `<h2>Scadenze</h2><table><thead><tr><th>Scadenza</th><th>Data</th><th class="r">Importo</th><th>Tra</th></tr></thead><tbody>${righeScadenze}</tbody></table>` : ''}
${report.fattureNonIncassate.length ? `<h2>Fatture non ancora incassate (${report.fattureNonIncassate.length})</h2><table><thead><tr><th>Cliente</th><th class="r">Imponibile</th><th>Giorni dall'emissione</th></tr></thead><tbody>${report.fattureNonIncassate.map(f => `<tr><td>${esc(f.cliente)}</td><td class="r">${eur(f.imponibile)}</td><td>${f.giorniDaEmissione}</td></tr>`).join('')}</tbody></table>` : ''}
${report.anomalie.entrateAmbigueDaConfermare ? `<h2>Da verificare</h2><p style="font-size:12px">${report.anomalie.entrateAmbigueDaConfermare} entrata/e non ancora classificate come fattura o personali (${eur(report.anomalie.totaleEntrateAmbigue)} totali) — l'utente non le ha ancora confermate nell'app.</p>` : ''}
<div class="note">Documento generato automaticamente da Momentum a partire dai dati inseriti dal titolare nell'app (100% on-device, nessun server). È un riepilogo di calcolo, non un documento fiscale ufficiale né una dichiarazione: gli importi vanno sempre verificati dal professionista prima di qualunque adempimento.</div>
</body></html>`;
}
