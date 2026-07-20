// ============================================================
// INVOICE ENGINE — creazione fatture on-device (v10)
// ============================================================
// Nessuna app di budgeting crea fatture; quelle di fatturazione sono tutte
// cloud. Momentum lo fa 100% on-device, con la matematica fiscale ITALIANA
// corretta e un predittore che impara dai clienti passati per pre-compilare.
//
// Onestà (regola #1): le regole fiscali sono REALI e dichiarate, non inventate,
// e configurabili. NON è un software di fatturazione elettronica certificato
// (SdI/XML): genera il DOCUMENTO e i calcoli corretti — la trasmissione allo
// SdI resta del commercialista/gestionale. Dichiarato, mai spacciato per di più.
// Funzioni pure, nessun DOM, nessuna rete.
'use strict';

// Marca da bollo 2€ obbligatoria sulle fatture SENZA IVA (es. forfettario)
// oltre 77,47€. Regola reale italiana.
export const BOLLO_SOGLIA = 77.47;
export const BOLLO_IMPORTO = 2.00;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Calcola una fattura dall'imponibile. Ritorna la scomposizione completa e
// tracciabile (mai un totale orfano). Parametri con default italiani reali,
// tutti sovrascrivibili:
//  - regime: 'forfettario' | 'ordinario'
//  - ivaPct: aliquota IVA (default 22% ordinario; 0 forfettario)
//  - ritenutaPct: ritenuta d'acconto (default 20% ordinario professionisti; il
//    forfettario NON è soggetto a ritenuta → 0)
//  - cassaPct: rivalsa cassa/INPS gestione separata (default 4% ordinario, su
//    cui si applica anche l'IVA; 0 forfettario)
//  - bollo: applica marca da bollo 2€ se dovuta (default true)
//  - bollo: applica la marca da bollo 2€ se dovuta (default true)
//  - bolloACliente: se true (default) il bollo è ADDEBITATO al cliente (entra
//    nel totale); se false lo paga l'emittente (resta un costo suo, non nel
//    totale fattura) — non sempre si fa pagare il bollo al cliente.
export function computeInvoice({ imponibile, regime = 'forfettario', ivaPct, ritenutaPct, cassaPct, bollo = true, bolloACliente = true } = {}) {
  const base = Math.max(0, +imponibile || 0);
  const isForfettario = regime === 'forfettario';
  const iva = isForfettario ? 0 : (ivaPct != null ? ivaPct : 0.22);
  const ritenuta = isForfettario ? 0 : (ritenutaPct != null ? ritenutaPct : 0.20);
  const cassa = isForfettario ? 0 : (cassaPct != null ? cassaPct : 0.04);

  const cassaImporto = round2(base * cassa);
  const imponibileIva = round2(base + cassaImporto);       // l'IVA si applica anche sulla cassa
  const ivaImporto = round2(imponibileIva * iva);
  const ritenutaImporto = round2(base * ritenuta);          // la ritenuta è sul solo compenso
  // Marca da bollo: dovuta sulle fatture senza IVA oltre soglia (tipico forfettario)
  const bolloDovuto = bollo && iva === 0 && base > BOLLO_SOGLIA;
  const bolloImporto = bolloDovuto ? BOLLO_IMPORTO : 0;
  // Il bollo entra nel totale (addebito al cliente) solo se bolloACliente.
  const bolloInTotale = bolloDovuto && bolloACliente ? bolloImporto : 0;

  const totaleFattura = round2(base + cassaImporto + ivaImporto + bolloInTotale);
  const nettoARicevere = round2(totaleFattura - ritenutaImporto);

  const righe = [
    { voce: 'Compenso (imponibile)', importo: round2(base) },
    ...(cassaImporto > 0 ? [{ voce: `Cassa previdenziale (${(cassa * 100).toFixed(0)}%)`, importo: cassaImporto }] : []),
    ...(ivaImporto > 0 ? [{ voce: `IVA (${(iva * 100).toFixed(0)}%)`, importo: ivaImporto }] : []),
    ...(bolloInTotale > 0 ? [{ voce: 'Marca da bollo', importo: bolloInTotale }] : []),
    ...(bolloDovuto && !bolloACliente ? [{ voce: 'Marca da bollo (a carico dell\'emittente, non addebitata)', importo: 0 }] : []),
    ...(ritenutaImporto > 0 ? [{ voce: `Ritenuta d'acconto (${(ritenuta * 100).toFixed(0)}%)`, importo: -ritenutaImporto }] : []),
  ];
  const note = isForfettario
    ? 'Operazione in regime forfettario (art. 1, commi 54-89, L. 190/2014): non soggetta a IVA né a ritenuta d\'acconto.'
    : null;
  return {
    imponibile: round2(base), cassaImporto, ivaImporto, ritenutaImporto, bolloImporto,
    totaleFattura, nettoARicevere, righe, regime, note,
  };
}

// Predice il prossimo numero di fattura per l'anno (max esistente + 1). La
// numerazione riparte da 1 ogni anno solare (prassi italiana comune).
export function nextInvoiceNumber(invoices = [], year = new Date().getFullYear()) {
  let max = 0;
  for (const inv of invoices) {
    if (inv.year === year && Number.isFinite(inv.number)) max = Math.max(max, inv.number);
  }
  return max + 1;
}

// Apprende dai clienti passati: dato un nome cliente (anche parziale), suggerisce
// l'importo tipico e l'ultima descrizione dalle fatture precedenti a quel
// cliente. Piccolo predittore on-device, zero invenzione: se non c'è storia,
// ritorna null.
export function suggestFromHistory(invoices = [], clientQuery = '') {
  const q = String(clientQuery).toLowerCase().trim();
  if (!q) return null;
  const matches = invoices.filter(inv => String(inv.client || '').toLowerCase().includes(q));
  if (!matches.length) return null;
  const amounts = matches.map(m => m.imponibile).filter(Number.isFinite).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : null;
  const last = matches.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  return {
    client: last.client,
    suggestedImponibile: median,
    lastDescription: last.description || null,
    lastEmail: last.clientEmail || null,   // email appresa dalle fatture passate
    invoiceCount: matches.length,
  };
}

// Genera l'EMAIL di accompagnamento in modo predittivo: destinatario (se noto
// dallo storico), oggetto e corpo professionale con gli importi REALI. Zero
// invenzione: se manca un dato, non lo si mette. Ritorna { to, subject, body }
// + un mailto pronto (apre il client email dell'utente già compilato, on-device,
// nessun server). L'allegato PDF si aggiunge a mano (mailto non supporta
// allegati) — dichiarato nell'hint UI.
export function buildInvoiceEmail({ inv = {}, meta = {}, clientEmail = '' } = {}) {
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const num = `${meta.number ?? '—'}/${meta.year ?? new Date().getFullYear()}`;
  const subject = `Fattura n. ${num}${meta.emitter ? ' — ' + meta.emitter : ''}`;
  const nettoDiverso = inv.nettoARicevere != null && inv.totaleFattura != null && Math.abs(inv.nettoARicevere - inv.totaleFattura) > 0.001;
  const linee = [
    `Gentile ${meta.client || 'cliente'},`,
    ``,
    `in allegato trova la fattura n. ${num} del ${meta.date || new Date().toLocaleDateString('it-IT')}${meta.description ? ` relativa a: ${meta.description}` : ''}.`,
    ``,
    `Totale fattura: ${eur(inv.totaleFattura)}${nettoDiverso ? ` (netto a ricevere: ${eur(inv.nettoARicevere)})` : ''}.`,
    meta.emitterInfo ? `Riferimenti per il pagamento: ${meta.emitterInfo}.` : '',
    ``,
    `Resto a disposizione per qualsiasi chiarimento.`,
    `Cordiali saluti,`,
    meta.emitter || '',
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')); // niente doppie righe vuote
  const body = linee.join('\n');
  const to = clientEmail || '';
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to, subject, body, mailto };
}

// Genera il DOCUMENTO fattura come HTML stampabile/esportabile (il browser lo
// converte in PDF con "Stampa → Salva come PDF", 100% on-device, nessun server).
// Onesto: è il documento di cortesia/pro-forma; la fattura elettronica ufficiale
// (XML verso SdI) resta al gestionale/commercialista. `inv` = output di
// computeInvoice + dati anagrafici. Escape dell'input per sicurezza.
export function renderInvoiceHTML(inv = {}, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(meta.accent || '') ? meta.accent : '#0ea5e9';
  // Logo: SOLO data:image (on-device, niente richieste esterne) → sicurezza.
  const logo = /^data:image\//.test(meta.logo || '') ? meta.logo : null;
  const righe = (inv.righe || []).map(r =>
    `<tr><td>${esc(r.voce)}</td><td class="r">${r.importo < 0 ? '−' : ''}${eur(Math.abs(r.importo))}</td></tr>`).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fattura ${esc(meta.number || '')}/${esc(meta.year || '')}</title>
<style>
:root{--accent:${accent}}
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:760px;margin:0 auto;color:#0f172a;padding:48px 32px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;border-bottom:3px solid var(--accent);padding-bottom:20px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{max-height:56px;max-width:180px;object-fit:contain}
.brand .name{font-size:20px;font-weight:800}
.doc{text-align:right}
.doc .n{font-size:22px;font-weight:800;color:var(--accent)}
.doc .muted,.muted{color:#64748b;font-size:13px}
.parties{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-top:28px}
.parties .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:700;margin-bottom:4px}
.desc{margin-top:22px;font-size:15px}
table{width:100%;border-collapse:collapse;margin-top:22px}
td{padding:11px 0;border-bottom:1px solid #eef2f7;font-size:14px}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.totbox{margin-top:22px;margin-left:auto;width:min(320px,100%)}
.totbox .row{display:flex;justify-content:space-between;padding:6px 0}
.totbox .net{border-top:2px solid var(--accent);margin-top:6px;padding-top:12px;font-size:20px;font-weight:800;color:#047857}
.note{margin-top:28px;font-size:12px;color:#64748b;line-height:1.5}
@media print{body{padding:24px}}
</style></head><body>
<div class="top">
  <div class="brand">${logo ? `<img src="${logo}" alt="logo">` : ''}<div class="name">${esc(meta.emitter || '')}</div></div>
  <div class="doc"><div class="n">Fattura n. ${esc(meta.number || '—')}/${esc(meta.year || new Date().getFullYear())}</div>
  <div class="muted">Data: ${esc(meta.date || new Date().toLocaleDateString('it-IT'))}</div></div>
</div>
<div class="parties">
  <div><div class="lbl">Da</div><b>${esc(meta.emitter || '')}</b><br><span class="muted">${esc(meta.emitterInfo || '')}</span></div>
  <div style="text-align:right"><div class="lbl">A</div><b>${esc(meta.client || '')}</b><br><span class="muted">${esc(meta.clientInfo || '')}</span></div>
</div>
${meta.description ? `<div class="desc">${esc(meta.description)}</div>` : ''}
<table><tbody>${righe}</tbody></table>
<div class="totbox">
  <div class="row"><span class="muted">Totale fattura</span><b>${eur(inv.totaleFattura)}</b></div>
  <div class="row net"><span>Netto a ricevere</span><span>${eur(inv.nettoARicevere)}</span></div>
</div>
${inv.note ? `<div class="note">${esc(inv.note)}</div>` : ''}
<div class="note">Documento generato on-device da Momentum. Non è fattura elettronica SdI: per la trasmissione ufficiale usa il tuo gestionale/commercialista.</div>
</body></html>`;
}
