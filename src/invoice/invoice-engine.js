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
export function computeInvoice({ imponibile, regime = 'forfettario', ivaPct, ritenutaPct, cassaPct, bollo = true } = {}) {
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

  const totaleFattura = round2(base + cassaImporto + ivaImporto + bolloImporto);
  const nettoARicevere = round2(totaleFattura - ritenutaImporto);

  const righe = [
    { voce: 'Compenso (imponibile)', importo: round2(base) },
    ...(cassaImporto > 0 ? [{ voce: `Cassa previdenziale (${(cassa * 100).toFixed(0)}%)`, importo: cassaImporto }] : []),
    ...(ivaImporto > 0 ? [{ voce: `IVA (${(iva * 100).toFixed(0)}%)`, importo: ivaImporto }] : []),
    ...(bolloImporto > 0 ? [{ voce: 'Marca da bollo', importo: bolloImporto }] : []),
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
    invoiceCount: matches.length,
  };
}

// Genera il DOCUMENTO fattura come HTML stampabile/esportabile (il browser lo
// converte in PDF con "Stampa → Salva come PDF", 100% on-device, nessun server).
// Onesto: è il documento di cortesia/pro-forma; la fattura elettronica ufficiale
// (XML verso SdI) resta al gestionale/commercialista. `inv` = output di
// computeInvoice + dati anagrafici. Escape dell'input per sicurezza.
export function renderInvoiceHTML(inv = {}, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const righe = (inv.righe || []).map(r =>
    `<tr><td>${esc(r.voce)}</td><td style="text-align:right">${eur(r.importo)}</td></tr>`).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Fattura ${esc(meta.number || '')}/${esc(meta.year || '')}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:40px auto;color:#111;padding:0 20px}
h1{font-size:22px;margin:0 0 4px}.muted{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:8px 0;border-bottom:1px solid #eee}.tot{font-weight:800;font-size:18px}.note{margin-top:24px;font-size:12px;color:#555}
.head{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}</style></head><body>
<div class="head"><div><h1>Fattura n. ${esc(meta.number || '—')}/${esc(meta.year || new Date().getFullYear())}</h1>
<div class="muted">Data: ${esc(meta.date || new Date().toLocaleDateString('it-IT'))}</div></div>
<div class="muted" style="text-align:right"><b>${esc(meta.emitter || '')}</b><br>${esc(meta.emitterInfo || '')}</div></div>
<div style="margin-top:20px"><div class="muted">Cliente</div><b>${esc(meta.client || '')}</b><br><span class="muted">${esc(meta.clientInfo || '')}</span></div>
<div style="margin-top:16px">${esc(meta.description || '')}</div>
<table><tbody>${righe}</tbody></table>
<div style="text-align:right;margin-top:16px"><div class="muted">Totale fattura ${eur(inv.totaleFattura)}</div>
<div class="tot">Netto a ricevere ${eur(inv.nettoARicevere)}</div></div>
${inv.note ? `<div class="note">${esc(inv.note)}</div>` : ''}
<div class="note">Documento generato on-device da Momentum. Non è fattura elettronica SdI: per la trasmissione ufficiale usa il tuo gestionale/commercialista.</div>
</body></html>`;
}
