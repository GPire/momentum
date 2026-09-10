// ============================================================
// PONTE COMMERCIALISTA — formato strutturato (CSV/JSON)
// ============================================================
// Mossa 1 dell'analisi competitiva 2026-09-10: l'HTML stampabile
// (accountant-export.js / accountant-export-intl.js) risolve "niente
// account, apribile da chiunque" ma resta un documento da RILEGGERE a
// mano — il commercialista che vuole importarlo nel proprio gestionale
// (B.Point, TeamSystem, un foglio di calcolo, qualunque cosa accetti CSV)
// oggi deve ridigitare ogni numero. Qui SOLO una seconda serializzazione
// dello stesso `report` già calcolato da buildAccountantReport/Ch/Es —
// mai una seconda formula fiscale, mai un dato che l'HTML non ha già.
// Funzioni pure, nessun DOM: main.js le collega a un download reale.
'use strict';

// JSON: l'intero report, con un involucro minimo che identifica formato/
// versione e ripete il disclaimer anche qui — un JSON può finire aperto da
// solo, senza il testo che lo accompagna nell'HTML.
export function accountantReportToJson(report, meta = {}) {
  const envelope = {
    formato: 'momentum-accountant-report',
    versione: 1,
    emittente: meta.emitter || null,
    nota: 'Riepilogo di calcolo generato da Momentum (on-device) dai dati inseriti dal titolare. Non è un documento fiscale ufficiale: verificare sempre col professionista prima di qualunque adempimento.',
    ...report,
  };
  return JSON.stringify(envelope, null, 2);
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells) { return cells.map(csvEscape).join(',') + '\n'; }
function csvSection(title, headerCells, rows) {
  let out = `## ${title}\n`;
  out += csvRow(headerCells);
  for (const r of rows) out += csvRow(r);
  return out + '\n';
}

// Italia: fatture/scomposizione/scadenze/fatture non incassate — la forma
// che buildAccountantReport() produce (accountant-export.js).
function csvIt(report, meta) {
  let out = `# Momentum — riepilogo commercialista (${meta.emitter || ''})\n`;
  out += `# Anno,${report.anno}\n# Regime,${report.regime || 'non impostato'}\n# Generato,${report.generatoIl}\n\n`;
  out += csvSection('Riepilogo', ['Voce', 'Valore (EUR)'], [
    ['Fatturato (competenza)', report.fatturato],
    ['Incassato (cassa)', report.incassato],
    ['Differenza fatturato/incassato', report.differenzaFatturatoIncassato],
    ['Accantonamento dovuto', report.accantonamento.dovuto],
    ['Accantonamento già versato', report.accantonamento.versato],
    ['Accantonamento mancante', report.accantonamento.mancante],
  ]);
  out += csvSection('Fatture', ['Numero', 'Anno', 'Data', 'Cliente', 'Imponibile', 'Stato', 'Data incasso', 'Confidenza incasso'],
    report.fatture.map(f => [f.numero, f.anno, f.data, f.cliente, f.imponibile, f.stato, f.dataIncasso || '', f.confidenzaIncasso || '']));
  if (report.accantonamento.scomposizione.length) {
    out += csvSection('Composizione accantonamento', ['Voce', 'Importo (EUR)'],
      report.accantonamento.scomposizione.map(v => [v.voce, v.importo]));
  }
  if (report.scadenze.length) {
    out += csvSection('Scadenze', ['Nome', 'Data', 'Importo (EUR)', 'Giorni mancanti'],
      report.scadenze.map(s => [s.nome, s.data, s.importo, s.giorniMancanti]));
  }
  if (report.fattureNonIncassate.length) {
    out += csvSection('Fatture non incassate', ['Cliente', 'Imponibile (EUR)', 'Giorni dall\'emissione'],
      report.fattureNonIncassate.map(f => [f.cliente, f.imponibile, f.giorniDaEmissione]));
  }
  if (report.anomalie.entrateAmbigueDaConfermare) {
    out += csvSection('Da verificare', ['Voce', 'Valore'], [
      ['Entrate ambigue da confermare (numero)', report.anomalie.entrateAmbigueDaConfermare],
      ['Totale entrate ambigue (EUR)', report.anomalie.totaleEntrateAmbigue],
    ]);
  }
  return out;
}

// Svizzera/Spagna: forma più semplice, contributi[]/imposta/noteOneste —
// buildAccountantReportCh()/buildAccountantReportEs() (accountant-export-intl.js).
function csvIntl(report, meta) {
  let out = `# Momentum — riepilogo commercialista/gestor (${meta.emitter || ''})\n`;
  out += `# Paese,${report.paese}\n# Anno,${report.anno}\n# Generato,${report.generatoIl}\n\n`;
  const voci = [...report.contributi, ...(report.imposta ? [report.imposta] : [])];
  const totale = +voci.reduce((s, v) => s + v.importo, 0).toFixed(2);
  out += csvSection('Riepilogo', ['Voce', `Valore (${report.valuta})`], [
    ['Incassato', report.incassato],
    ['Totale da accantonare', totale],
  ]);
  if (voci.length) {
    out += csvSection('Composizione', ['Voce', `Importo (${report.valuta})`], voci.map(v => [v.voce, v.importo]));
  }
  if (report.contributoNonCalcolabile) {
    out += csvSection('Non calcolabile', ['Nota'], [[report.contributoNonCalcolabile]]);
  }
  if (report.noteOneste?.length) {
    out += csvSection('Note', ['Testo'], report.noteOneste.map(n => [n]));
  }
  return out;
}

// CSV multi-sezione (non una singola tabella): un report fiscale ha voci
// di forma diversa (fatture, scadenze, composizione...) — separarle in
// blocchi con intestazione `## Nome` resta leggibile sia a un umano sia a
// un import che sa cercare la sezione che gli serve, senza forzare tutto
// in un'unica tabella innaturale.
export function accountantReportToCsv(report, meta = {}) {
  return Array.isArray(report.fatture) ? csvIt(report, meta) : csvIntl(report, meta);
}
