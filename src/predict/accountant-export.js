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
import { taxSetAsideForPeriod, taxSetAside, classifyIncome } from './tax.js';
import { taxReserveStatus } from './tax-payments.js';
import { upcomingTaxDeadlines } from './tax-deadlines.js';
import { buildItalianTaxPosition } from './tax-position.js';

// LA SCOMPOSIZIONE CHE UN COMMERCIALISTA CHIEDE PER PRIMA.
// Verificato con ricerca reale (2026-08-31): per un forfettario, quello che
// il commercialista vuole a fine anno è soprattutto due numeri SEPARATI —
// i contributi previdenziali versati (deducibili dal reddito imponibile) e
// l'imposta sostitutiva dovuta (Cassa Forense/Inarcassa/CNPADC comprese,
// se c'è una cassa propria). Il report mostrava solo il totale aggregato
// (`daAccantonare`), la stessa cifra che serve all'UTENTE per sapere quanto
// mettere da parte ma inutile a chi deve compilare la dichiarazione. Qui si
// sommano i `breakdown` che `taxSetAside` calcola già per singola
// transazione (mai una seconda formula fiscale) e si aggregano per voce.
function scomponiAccantonamentoAnno(transactionsFlat, regime, opts) {
  const totali = {}; // etichetta voce -> somma
  const ordine = []; // per mostrare le voci nell'ordine in cui compaiono
  for (const t of transactionsFlat) {
    const { kind } = classifyIncome(t, opts.learned, opts.model);
    if (kind !== 'invoice') continue;
    const { breakdown } = taxSetAside(t.amount, { regime, learned: opts.learned, model: opts.model, cassaPropria: opts.cassaPropria, altraCoperturaPrevidenziale: opts.altraCoperturaPrevidenziale, year: opts.year, rulesOverride: opts.rulesOverride });
    for (const voce of breakdown) {
      if (!(voce.voce in totali)) { totali[voce.voce] = 0; ordine.push(voce.voce); }
      totali[voce.voce] += voce.importo;
    }
  }
  return ordine.map(voce => ({ voce, importo: +totali[voce].toFixed(2) }));
}

function invoiceYear(invoice) {
  const date = new Date(invoice?.date);
  if (Number.isFinite(date.getTime())) return date.getFullYear();
  const y = Number(invoice?.year);
  return Number.isInteger(y) ? y : null;
}

function paymentMatchesForYear(matched, year) {
  const intere = (matched?.incassate || [])
    .filter(m => m.annoIncasso === year)
    .map(m => ({ ...m, parziale: false }));
  const rate = (matched?.parziali || []).flatMap(m => (m.pagamenti || [])
    .filter(p => invoiceYear({ date: p.date }) === year)
    .map(p => ({ ...m, parziale: true, importoIncassato: Number(p.amount), incassoData: p.date, annoIncasso: year })));
  return [...intere, ...rate];
}

// Assembla il report per un anno: SOLO calcoli già esistenti nel progetto
// (nessuna seconda formula), messi in un unico posto leggibile. `opts`:
// { transactions (tutte, per mese), taxPayments, learned, model, rulesOverride }.
export function buildAccountantReport(invoices = [], transactions = {}, year, regime, opts = {}) {
  const allTx = Array.isArray(transactions)
    ? { all: transactions }
    : (transactions && typeof transactions === 'object' ? transactions : {});
  const nowDate = opts.now instanceof Date
    ? new Date(opts.now.getTime())
    : new Date(opts.now || Date.now());
  const now = Number.isFinite(nowDate.getTime()) ? nowDate : new Date();
  const allInvoices = Array.isArray(invoices) ? invoices : [];
  const invoicesYear = allInvoices.filter(i => invoiceYear(i) === year);
  // Match against the complete invoice history. An invoice issued in
  // December can be paid in January: the cash basis for the requested year
  // must see that payment even though the visible invoice list stays scoped
  // to `year`.
  const matchOptions = { allowPartialPayments: true, ...(opts.matchOptions || {}) };
  const matched = matchInvoicePayments(allInvoices, allTx, matchOptions);
  const fatturato = accrualRevenue(invoicesYear, year);
  const incassato = cashBasisRevenue(matched, year);
  const matchedCurrent = {
    incassate: matched.incassate.filter(m => invoiceYear(m.fattura) === year),
    parziali: (matched.parziali || []).filter(m => invoiceYear(m.fattura) === year),
    nonIncassate: matched.nonIncassate.filter(m => invoiceYear(m.fattura) === year),
    tolleranza: matched.tolleranza,
  };
  const esposizione = unpaidExposure(matchedCurrent, { now: now.getTime() });

  const flatTx = Object.values(allTx).flatMap(list => Array.isArray(list) ? list : [])
    .filter(t => t?.type === 'entrata' && new Date(t.date).getFullYear() === year);
  const taxOptions = {
    regime: regime || 'forfettario',
    year,
    learned: opts.learned,
    model: opts.model,
    rulesOverride: opts.rulesOverride,
    cassaPropria: opts.cassaPropria,
    altraCoperturaPrevidenziale: opts.altraCoperturaPrevidenziale,
    overrides: opts.overrides,
    taxUncertain: opts.taxUncertain === true,
  };
  const posizione = buildItalianTaxPosition({
    invoices: allInvoices,
    transactions: allTx,
    taxPayments: opts.taxPayments || [],
    regime: regime || null,
    year,
    now,
    learned: opts.learned,
    model: opts.model,
    ateco: opts.ateco,
    cassaPropria: opts.cassaPropria,
    altraCoperturaPrevidenziale: opts.altraCoperturaPrevidenziale,
    forfettarioAnswers: opts.forfettarioAnswers,
    rulesOverride: opts.rulesOverride,
    overrides: opts.overrides,
    taxUncertain: opts.taxUncertain === true,
    matchOptions,
  });
  // For the cash regime, a matched bank payment is stronger evidence than
  // the invoice description. Reuse the position's already calculated period
  // result; the fallback remains the historical classifier for old exports.
  const usesCashMatches = String(regime || '').startsWith('forfettario')
    && posizione?.estimate?.basis === 'incassi-abbinati-alle-fatture';
  const accantonamento = usesCashMatches
    ? posizione.estimate.period
    : taxSetAsideForPeriod(flatTx, taxOptions);
  const matchedYearTransactions = paymentMatchesForYear(matched, year)
    .map((m, index) => ({
      id: `invoice-payment-${m.fattura?.number ?? index}-${m.fattura?.year ?? ''}-${index}`,
      type: 'entrata', amount: m.importoIncassato, date: m.incassoData,
      description: 'fattura incassata', taxable: true,
    }));
  const breakdownTransactions = usesCashMatches && matchedYearTransactions.length
    ? matchedYearTransactions
    : flatTx;
  const scomposizione = scomponiAccantonamentoAnno(breakdownTransactions, regime || 'forfettario', taxOptions);
  const riserva = taxReserveStatus(accantonamento.daAccantonare, opts.taxPayments || []);
  // Keep the report's existing meaning for `accantonamento`: the amount
  // calculated on the year's observed receipts. The unified position also
  // exposes an annual projection in `posizione.stimaAnnuale`, but it must not
  // silently replace the observed-period number or make the breakdown and
  // the reserve disagree.
  const scadenze = upcomingTaxDeadlines(accantonamento.daAccantonare, {
    now, orizzonteGiorni: 400, giaVersato: riserva.versato, rulesOverride: opts.rulesOverride,
  });

  const fattureRiepilogo = invoicesYear.map(f => {
    const inc = matched.incassate.find(m => m.fattura === f
      || (m.fattura?.number === f.number && invoiceYear(m.fattura) === invoiceYear(f)));
    const parziale = (matched.parziali || []).find(m => m.fattura === f
      || (m.fattura?.number === f.number && invoiceYear(m.fattura) === invoiceYear(f)));
    const importoIncassato = inc?.importoIncassato ?? parziale?.importoIncassato ?? 0;
    const stato = inc || parziale?.completa ? 'incassata' : parziale ? 'parziale' : 'non incassata';
    return {
      numero: f.number, anno: f.year, data: f.date, cliente: f.client, imponibile: f.imponibile,
      descrizione: f.description || '',
      stato,
      importoIncassato: importoIncassato ? +importoIncassato.toFixed(2) : 0,
      residuo: parziale ? parziale.residuo : 0,
      dataIncasso: inc?.incassoData || parziale?.incassoData || null,
      confidenzaIncasso: inc?.confidenza || parziale?.confidenza || null,
    };
  }).sort((a, b) => new Date(a.data) - new Date(b.data));

  return {
    anno: year,
    regime: regime || null,
    generatoIl: now.toISOString(),
    fatturato: +fatturato.toFixed(2),
    incassato: +incassato.toFixed(2),
    differenzaFatturatoIncassato: +(fatturato - incassato).toFixed(2),
    // Audit trail for the professional: every number in this export can be
    // traced back to the same unified tax position used by the app UI.
    posizione: posizione ? {
      versione: posizione.version,
      stato: posizione.status,
      baseStima: posizione.estimate?.basis || null,
      stimaAnnuale: posizione.estimate?.projection?.estimatedAnnualTax ?? null,
      confidenza: posizione.confidence,
      datiMancanti: posizione.missingInputs,
      regole: posizione.rules,
    } : null,
    fatture: fattureRiepilogo,
    accantonamento: {
      dovuto: riserva.totaleDovuto,
      versato: riserva.versato,
      mancante: riserva.daAccantonare,
      // Contributi previdenziali (deducibili) separati dall'imposta dovuta:
      // la scomposizione che il commercialista chiede per primo, non un
      // totale unico — vedi scomponiAccantonamentoAnno sopra.
      scomposizione,
    },
    scadenze: scadenze.map(s => ({ nome: s.label, data: s.date, importo: s.importo, giorniMancanti: s.giorniMancanti })),
    fattureNonIncassate: esposizione.aperte.map(a => ({ numero: a.fattura.number, cliente: a.fattura.client, imponibile: a.fattura.imponibile, giorniDaEmissione: a.giorniDaEmissione })),
    anomalie: {
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
  const posizioneNota = report.posizione
    ? `<div class="sub">Base della stima: ${esc(report.posizione.baseStima || 'movimenti classificati')} · Stato dati: ${esc(report.posizione.stato || 'da verificare')}${Number.isFinite(Number(report.posizione.stimaAnnuale)) ? ` · Proiezione annuale: ${eur(report.posizione.stimaAnnuale)}` : ''}</div>`
    : '';
  const righeFatture = report.fatture.map(f => `<tr>
    <td>${esc(f.numero)}/${esc(f.anno)}</td><td>${esc(f.data)}</td><td>${esc(f.cliente)}</td>
    <td class="r">${eur(f.imponibile)}</td>
    <td>${f.stato === 'incassata'
      ? `Incassata ${esc(f.dataIncasso || '')}${f.confidenzaIncasso === 'media' ? ' (da confermare)' : ''}`
      : f.stato === 'parziale'
        ? `Parziale: ${eur(f.importoIncassato)} · residuo ${eur(f.residuo)}`
        : 'Non incassata'}</td>
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
${posizioneNota}
<div class="grid">
  <div class="box"><div class="lbl">Fatturato (competenza)</div><div class="val">${eur(report.fatturato)}</div></div>
  <div class="box"><div class="lbl">Incassato (cassa)</div><div class="val">${eur(report.incassato)}</div></div>
  <div class="box"><div class="lbl">Da accantonare</div><div class="val">${eur(report.accantonamento.mancante)}</div></div>
</div>
<h2>Fatture (${report.fatture.length})</h2>
<table><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th class="r">Imponibile</th><th>Stato incasso</th></tr></thead><tbody>${righeFatture || '<tr><td colspan="5">Nessuna fattura in questo anno.</td></tr>'}</tbody></table>
${report.accantonamento.scomposizione.length ? `<h2>Come si compone l'accantonamento</h2><table><thead><tr><th>Voce</th><th class="r">Importo</th></tr></thead><tbody>${report.accantonamento.scomposizione.map(v => `<tr><td>${esc(v.voce)}</td><td class="r">${eur(v.importo)}</td></tr>`).join('')}<tr><td><b>Totale</b></td><td class="r"><b>${eur(report.accantonamento.mancante)}</b></td></tr></tbody></table>` : ''}
${report.scadenze.length ? `<h2>Scadenze</h2><table><thead><tr><th>Scadenza</th><th>Data</th><th class="r">Importo</th><th>Tra</th></tr></thead><tbody>${righeScadenze}</tbody></table>` : ''}
${report.fattureNonIncassate.length ? `<h2>Fatture non ancora incassate (${report.fattureNonIncassate.length})</h2><table><thead><tr><th>Cliente</th><th class="r">Imponibile</th><th>Giorni dall'emissione</th></tr></thead><tbody>${report.fattureNonIncassate.map(f => `<tr><td>${esc(f.cliente)}</td><td class="r">${eur(f.imponibile)}</td><td>${f.giorniDaEmissione}</td></tr>`).join('')}</tbody></table>` : ''}
${report.anomalie.entrateAmbigueDaConfermare ? `<h2>Da verificare</h2><p style="font-size:12px">${report.anomalie.entrateAmbigueDaConfermare} entrata/e non ancora classificate come fattura o personali (${eur(report.anomalie.totaleEntrateAmbigue)} totali) — l'utente non le ha ancora confermate nell'app.</p>` : ''}
<div class="note">Documento generato automaticamente da Momentum a partire dai dati inseriti dal titolare nell'app (100% on-device, nessun server). È un riepilogo di calcolo, non un documento fiscale ufficiale né una dichiarazione: gli importi vanno sempre verificati dal professionista prima di qualunque adempimento.</div>
</body></html>`;
}
