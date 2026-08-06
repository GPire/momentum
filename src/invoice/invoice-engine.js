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

import { invoiceCountry } from './country-invoicing.js';

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
export function computeInvoice({ imponibile, regime = 'forfettario', ivaPct, ritenutaPct, cassaPct, bollo, bolloACliente = true, country = 'IT' } = {}) {
  const c = invoiceCountry(country); // default per-Paese (IT completo; altri: internazionale)
  const base = Math.max(0, +imponibile || 0);
  const isForfettario = regime === 'forfettario';
  // I default (IVA/ritenuta/cassa/bollo) vengono dal Paese; l'utente può sempre
  // sovrascriverli. Il forfettario italiano resta esente IVA/ritenuta.
  const iva = isForfettario ? 0 : (ivaPct != null ? ivaPct : c.vatDefault);
  const ritenuta = isForfettario ? 0 : (ritenutaPct != null ? ritenutaPct : c.defaultRitenuta);
  const cassa = isForfettario ? 0 : (cassaPct != null ? cassaPct : c.defaultCassa);
  if (bollo == null) bollo = c.bollo;

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

// Rileva i CLIENTI RICORRENTI dallo storico fatture e predice la prossima
// fattura: cadenza (mensile/settimanale/trimestrale dai gap tra le date),
// importo tipico (mediana), e se la fattura di QUESTO mese è ancora da emettere
// (per i clienti mensili). Serve al "riutilizzo intelligente": un tap ricrea la
// fattura ricorrente. Onestà: serve ≥2 fatture per una cadenza; se i gap non
// sono regolari, cadenza = null (nessuna invenzione). Funzione pura.
export function detectRecurringClients(invoices = [], referenceDate = new Date()) {
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const byClient = {};
  for (const inv of invoices) { if (inv && inv.client) (byClient[inv.client] = byClient[inv.client] || []).push(inv); }
  const curMonth = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;
  const out = [];
  for (const [client, list] of Object.entries(byClient)) {
    // Flag ESPLICITO "ricorrente" (definito dall'utente): vale anche con UNA
    // sola fattura → memorizza l'intenzione subito. Altrimenti serve la storia.
    const explicit = list.find(i => i.recurring);
    if (list.length < 2 && !explicit) continue;
    const sorted = [...list].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date), d2 = new Date(sorted[i].date);
      if (!isNaN(d1) && !isNaN(d2)) gaps.push((d2 - d1) / 86400000);
    }
    const g = med(gaps);
    let cadence = null, monthly = false;
    if (g != null) {
      if (g >= 24 && g <= 36) { cadence = 'mensile'; monthly = true; }
      else if (g >= 6 && g <= 8) cadence = 'settimanale';
      else if (g >= 80 && g <= 100) cadence = 'trimestrale';
    }
    // L'esplicito ha la precedenza sull'inferenza (l'utente sa meglio).
    if (explicit) { cadence = explicit.cadence || 'mensile'; monthly = cadence === 'mensile'; }
    const amounts = sorted.map(s => s.imponibile).filter(Number.isFinite);
    const last = sorted[sorted.length - 1];
    // email/descrizione/regime: il valore più RECENTE disponibile (non per forza
    // dell'ultima fattura, che potrebbe non averlo) → riuso robusto.
    const lastWith = (field) => { for (let i = sorted.length - 1; i >= 0; i--) if (sorted[i][field]) return sorted[i][field]; return null; };
    const emittedThisMonth = list.some(i => String(i.date || '').slice(0, 7) === curMonth);
    out.push({
      client, invoiceCount: list.length, cadence, monthly,
      typicalAmount: med(amounts), lastDescription: lastWith('description'),
      lastEmail: lastWith('clientEmail'), lastRegime: lastWith('regime') || last.regime || null,
      dueThisMonth: monthly && !emittedThisMonth,
    });
  }
  // Prima le fatture DOVUTE questo mese, poi i clienti più frequenti.
  out.sort((a, b) => (b.dueThisMonth ? 1 : 0) - (a.dueThisMonth ? 1 : 0) || b.invoiceCount - a.invoiceCount);
  return out;
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

// CHIUSURA DEL CICLO SdI: rileva le fatture elettroniche CREATE ma non ancora
// segnate come TRASMESSE allo SdI. È il promemoria onesto che manca a chi crea
// la fattura ma dimentica di caricarla sul portale. Solo per l'Italia (country
// 'IT'), solo quelle marcate come e-fattura (isElectronic) e non trasmesse.
// Onestà: NON deduce la trasmissione (non può saperlo); si basa sul flag che
// l'utente mette dopo aver caricato. Funzione pura.
export function pendingSdiTransmission(invoices = []) {
  const pending = invoices.filter(i => i && (i.country || 'IT') === 'IT' && i.isElectronic && !i.sdiTransmitted);
  const totale = pending.reduce((s, i) => s + (+i.imponibile || 0), 0);
  return {
    count: pending.length,
    totaleImponibile: +totale.toFixed(2),
    invoices: pending.map(i => ({ number: i.number, year: i.year, client: i.client, imponibile: i.imponibile, date: i.date })),
  };
}

// I tre temi visivi per il documento di cortesia. Ognuno cambia SOLO il
// vestito (font, forme, uso del colore): dati, struttura e disclaimer legale
// restano identici — non è mai il tema a decidere cosa viene mostrato.
export const INVOICE_THEMES = ['minimale', 'tecnico', 'vivace'];

// Suggerimento PREDITTIVO del tema al primo utilizzo (mai dopo: una volta che
// l'utente ha scelto una volta, la scelta è sua e non si tocca più — stessa
// disciplina "impara ma non decide al posto tuo" usata per l'apprendimento
// fiscale). Euristica leggibile, non un modello: cliente con forma societaria
// (Srl/SpA/Ltd/GmbH) o importo grande → 'minimale' (il registro enterprise);
// descrizione che parla di sviluppo/IT → 'tecnico'; altrimenti 'vivace'
// (consumer/creator, dove farsi riconoscere vale più della formalità).
const SOCIETA_RE = /\b(s\.?r\.?l|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s|ltd|gmbh|inc|llc|plc)\b\.?/i;
const TECH_RE = /\b(sviluppo|software|app|sito|web|dev|coding|programmazione|IT|infrastruttura|cloud|API)\b/i;
export function suggestInvoiceTheme(client = '', description = '', imponibile = 0) {
  if (SOCIETA_RE.test(client) || +imponibile >= 10000) return 'minimale';
  if (TECH_RE.test(description) || TECH_RE.test(client)) return 'tecnico';
  return 'vivace';
}

function invoiceThemeCss(theme) {
  // 'minimale': il documento "carta pregiata" originale — quasi nessun colore,
  // il colore d'accento resta un dettaglio (una riga sottile, il totale).
  // Pensato per chi vuole restare invisibile: commercialisti, B2B formale.
  if (theme === 'tecnico') {
    // 'tecnico': sans-serif geometrico, numeri tabulari in monospazio (un
    // numero di fattura si legge come un ID, non come prosa), angoli vivi,
    // pannello dati a griglia — il registro di chi fattura consulenza IT/dev.
    return `
body{font-family:-apple-system,'Segoe UI',Roboto,'Inter',system-ui,sans-serif;max-width:760px;margin:0 auto;color:#0f172a;padding:48px 40px;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;border:1px solid #e2e8f0;border-left:4px solid var(--accent);padding:18px 22px;background:#fff}
.brand{display:flex;align-items:center;gap:14px}
.brand img{max-height:52px;max-width:180px;object-fit:contain}
.brand .name{font-size:18px;font-weight:800;letter-spacing:-.2px}
.doc{text-align:right;font-family:'SF Mono','Cascadia Code','Roboto Mono',ui-monospace,monospace}
.doc .n{font-size:16px;font-weight:700;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);padding:4px 10px;border-radius:3px;display:inline-block}
.doc .muted,.muted{color:#64748b;font-size:12px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
.parties>div{border:1px solid #e2e8f0;padding:14px 16px;background:#fff}
.parties .lbl{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--accent);font-weight:800;margin-bottom:6px;font-family:ui-monospace,monospace}
.desc{margin-top:20px;font-size:14px;border-left:2px solid #e2e8f0;padding-left:12px;color:#334155}
table{width:100%;border-collapse:collapse;margin-top:20px;font-family:ui-monospace,monospace}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.totbox{margin-top:20px;margin-left:auto;width:min(320px,100%);border:1px solid #e2e8f0;background:#fff}
.totbox .row{display:flex;justify-content:space-between;padding:10px 14px;font-family:ui-monospace,monospace;font-size:13px}
.totbox .net{border-top:2px solid var(--accent);margin-top:0;padding:14px;font-size:19px;font-weight:800;color:#0f172a;background:color-mix(in srgb,var(--accent) 8%,transparent)}
.note{margin-top:26px;font-size:11px;color:#64748b;line-height:1.6;font-family:ui-monospace,monospace}
.momentum-mark{margin-top:20px;font-size:10px;letter-spacing:1px;color:#64748b;font-family:ui-monospace,monospace}
@media print{body{padding:24px}}`;
  }
  if (theme === 'vivace') {
    // 'vivace': il colore d'accento diventa protagonista (banda in testata,
    // pillola del totale, card arrotondate) — il registro di chi vuole
    // un documento che si ricorda, creativi/freelance rivolti al consumer.
    return `
body{font-family:'Inter','Segoe UI',system-ui,sans-serif;max-width:760px;margin:0 auto;color:#1e1b2e;padding:0 0 48px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;padding:36px 40px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 65%,#1e1b2e));color:#fff;border-radius:0 0 28px 28px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{max-height:52px;max-width:170px;object-fit:contain;background:#fff;border-radius:10px;padding:4px}
.brand .name{font-size:21px;font-weight:800}
.doc{text-align:right}
.doc .n{font-size:15px;font-weight:800;background:rgba(255,255,255,.22);padding:6px 14px;border-radius:999px;display:inline-block}
.doc .muted{color:rgba(255,255,255,.85);font-size:12px;margin-top:6px}
.muted{color:#8b8398;font-size:13px}
.parties{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:26px 40px 0}
.parties>div{flex:1;min-width:200px;background:color-mix(in srgb,var(--accent) 7%,#faf9fc);border-radius:18px;padding:16px 18px}
.parties .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);font-weight:800;margin-bottom:5px}
.desc{margin:22px 40px 0;font-size:15px}
table{width:calc(100% - 80px);border-collapse:separate;border-spacing:0 8px;margin:20px 40px 0}
td{padding:12px 16px;font-size:14px;background:#faf9fc}
td:first-child{border-radius:14px 0 0 14px}
td:last-child{border-radius:0 14px 14px 0}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:700;color:var(--accent)}
.totbox{margin:22px 40px 0;margin-left:auto;width:min(320px,calc(100% - 80px))}
.totbox .row{display:flex;justify-content:space-between;padding:6px 4px;color:#8b8398;font-size:13px}
.totbox .net{margin-top:8px;padding:16px 20px;font-size:21px;font-weight:800;color:#fff;background:var(--accent);border-radius:16px;display:flex;justify-content:space-between}
.note{margin:26px 40px 0;font-size:12px;color:#8b8398;line-height:1.5}
.momentum-mark{margin:14px 40px 0;font-size:11px;color:#8b8398}
@media print{.top{border-radius:0}}`;
  }
  // default: minimale
  return `
body{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif;max-width:760px;margin:0 auto;color:#1a1a1a;padding:48px 40px;background:#fbfaf7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
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
/* Colophon tipografico, non uno slogan: maiuscoletto spaziato in un angolo,
   lo stesso registro con cui una tipografia pregiata firma un cartoncino —
   coerente con "la sobrietà è credibilità", mai una frase pubblicitaria. */
.momentum-mark{margin-top:22px;text-align:right;font-size:8px;letter-spacing:2.5px;text-transform:uppercase;color:#b3a996;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif}
@media print{body{padding:24px}}`;
}

// Genera il DOCUMENTO fattura come HTML stampabile/esportabile (il browser lo
// converte in PDF con "Stampa → Salva come PDF", 100% on-device, nessun server).
// Onesto: è il documento di cortesia/pro-forma; la fattura elettronica ufficiale
// (XML verso SdI) resta al gestionale/commercialista. `inv` = output di
// computeInvoice + dati anagrafici. Escape dell'input per sicurezza.
// `meta.theme`: 'minimale' (default) | 'tecnico' | 'vivace' — cambia solo la
// veste grafica, mai i dati o il disclaimer legale sotto.
// Etichette del documento (non i dati, non il disclaimer legale — quello vive
// già per-Paese in country-invoicing.js). Solo IT ha oggi un profilo fiscale
// dedicato: qualunque altro Paese usa il profilo internazionale in inglese —
// coerente col fatto che quel profilo dichiara `locale:'en'`.
const LABELS = {
  'it-IT': { invoiceNo: 'Fattura n.', date: 'Data', from: 'Da', to: 'A', total: 'Totale fattura', net: 'Netto a ricevere', credit: 'Documento creato con Momentum' },
  en: { invoiceNo: 'Invoice no.', date: 'Date', from: 'From', to: 'To', total: 'Invoice total', net: 'Net amount due', credit: 'Document created with Momentum' },
};

export function renderInvoiceHTML(inv = {}, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(meta.accent || '') ? meta.accent : '#0ea5e9';
  const theme = INVOICE_THEMES.includes(meta.theme) ? meta.theme : 'minimale';
  const country = invoiceCountry(meta.country);
  const L = LABELS[country.locale] || LABELS.en;
  const htmlLang = country.locale === 'it-IT' ? 'it' : 'en';
  // Logo: SOLO data:image (on-device, niente richieste esterne) → sicurezza.
  const logo = /^data:image\//.test(meta.logo || '') ? meta.logo : null;
  // Voci multiple ("4000 di sviluppo, 399 di hosting"): quando presenti,
  // sostituiscono la riga generica "Compenso (imponibile)" con l'elenco
  // vero — Cassa/IVA/Bollo/Ritenuta restano righe a parte, non fanno parte
  // della scomposizione del compenso.
  const hasVoci = Array.isArray(meta.voci) && meta.voci.length > 1;
  const vociTable = hasVoci
    ? `<table><tbody>${meta.voci.map((v) => `<tr><td>${esc(v.descrizione)}</td><td class="r">${eur(v.importo)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const righe = (inv.righe || [])
    .filter((r) => !hasVoci || r.voce !== 'Compenso (imponibile)')
    .map(r => `<tr><td>${esc(r.voce)}</td><td class="r">${r.importo < 0 ? '−' : ''}${eur(Math.abs(r.importo))}</td></tr>`).join('');
  return `<!doctype html><html lang="${htmlLang}" data-invoice-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.invoiceNo} ${esc(meta.number || '')}/${esc(meta.year || '')}</title>
<style>
:root{--accent:${accent}}
*{box-sizing:border-box}
${invoiceThemeCss(theme)}
</style></head><body>
<div class="top">
  <div class="brand">${logo ? `<img src="${logo}" alt="logo">` : ''}<div class="name">${esc(meta.emitter || '')}</div></div>
  <div class="doc"><div class="n">${L.invoiceNo} ${esc(meta.number || '—')}/${esc(meta.year || new Date().getFullYear())}</div>
  <div class="muted">${L.date}: ${esc(meta.date || new Date().toLocaleDateString('it-IT'))}</div></div>
</div>
<div class="parties">
  <div><div class="lbl">${L.from}</div><b>${esc(meta.emitter || '')}</b><br><span class="muted">${esc(meta.emitterInfo || '')}</span></div>
  <div style="text-align:right"><div class="lbl">${L.to}</div><b>${esc(meta.client || '')}</b><br><span class="muted">${esc(meta.clientInfo || '')}</span></div>
</div>
${meta.description ? `<div class="desc">${esc(meta.description)}</div>` : ''}
${vociTable}
<table><tbody>${righe}</tbody></table>
<div class="totbox">
  <div class="row"><span class="muted">${L.total}</span><b>${eur(inv.totaleFattura)}</b></div>
  <div class="row net"><span>${L.net}</span><span>${eur(inv.nettoARicevere)}</span></div>
</div>
${inv.note ? `<div class="note">${esc(inv.note)}</div>` : ''}
<div class="note">${esc(country.disclaimerLines.join(' '))}</div>
${meta.brandCredit ? `<div class="momentum-mark">${L.credit}</div>` : ''}
</body></html>`;
}
