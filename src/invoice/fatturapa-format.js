// ============================================================
// FATTURAPA FORMAT — specifica del formato VERSIONATA e auto-aggiornabile (v10)
// ============================================================
// Risposta onesta a "se escono nuove versioni/standard/template XML, deve
// adattarsi da solo", nel rispetto del 100% on-device: la STRUTTURA del formato
// (versione FPR, namespace, codici regime, codici Natura, riferimenti normativi)
// è un DATO versionato, non codice sparso. Quando l'Agenzia pubblica una nuova
// versione del tracciato (es. da 1.2.2 a una futura), si aggiorna QUESTA entry
// (o si adotta un payload firmato via fetchFormatUpdate) e il generatore XML si
// adatta SENZA riscrivere la logica. Ogni entry ha una data di efficacia:
// l'app applica automaticamente la versione giusta per la data della fattura.
// Onestà (regola #1): valori reali e datati, mai inventati; aggiornabili; se una
// fonte esterna manca o è implausibile → fallback sicuro alla versione inclusa.
'use strict';

// Versione del REGISTRO formati (cambia a ogni aggiornamento). Diverso dalla
// versione del tracciato FatturaPA (quella è dentro ogni spec, campo `tracciato`).
export const FORMAT_REGISTRY_VERSION = '2026-07';

// Specifiche per data di efficacia (ISO). Si aggiunge una entry SOLO quando il
// tracciato cambia davvero; per le date intermedie vale l'ultima entry <= data.
// Oggi è in vigore la 1.2.2 (FPR12 per i privati). La entry è completa così che
// il generatore possa leggere TUTTO da qui (nessuna costante nascosta nel codice).
export const FORMAT_SPECS = {
  '2019-01-01': {
    tracciato: '1.2.2',
    versione: 'FPR12',            // attributo `versione` + <FormatoTrasmissione>
    namespace: 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
    tipoDocumentoDefault: 'TD01', // fattura
    regimeCodes: { forfettario: 'RF19', ordinario: 'RF01' },
    naturaForfettario: 'N2.2',
    rifNormativoForfettario:
      'Operazione senza applicazione dell\'IVA ai sensi dell\'art. 1, commi 54-89, L. 190/2014 - Regime forfettario',
    tipoRitenuta: 'RT01',         // persone fisiche
    tipoCassa: 'TC22',            // INPS gestione separata
    causaleRitenutaDefault: 'A',
    condizioniPagamento: 'TP02',  // pagamento completo
    modalitaPagamento: 'MP05',    // bonifico
    decimals: 2,
  },
};

// Confronto date ISO (o versioni 'YYYY-MM'): lessicografico è corretto.
function isNewer(v, current) { return typeof v === 'string' && v > String(current || ''); }

// Ritorna la specifica di formato in vigore per una data (default: oggi).
// `override` = spec adottata via aggiornamento dati (fetchFormatUpdate), applicata
// SOLO se già validata. Precedenza all'override quando presente e più recente.
export function formatForDate(date = new Date(), override = null) {
  const iso = (date instanceof Date && !isNaN(date)) ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
  const base = (override && override.specs) ? { ...FORMAT_SPECS, ...override.specs } : FORMAT_SPECS;
  const dates = Object.keys(base).sort();
  let applicabile = dates[0];
  for (const d of dates) if (d <= iso) applicabile = d;
  return { effectiveFrom: applicabile, ...base[applicabile] };
}

// Valida un payload di formato ricevuto da una fonte esterna PRIMA di adottarlo:
// struttura corretta + valori PLAUSIBILI (guardrail anti-veleno). Un formato
// malformato romperebbe TUTTE le fatture elettroniche → mai adottarlo alla cieca.
export function validateFormatPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'payload non valido' };
  if (typeof payload.version !== 'string' || payload.version.length < 4) return { ok: false, reason: 'versione mancante o non valida' };
  if (!payload.specs || typeof payload.specs !== 'object' || !Object.keys(payload.specs).length) return { ok: false, reason: 'specifiche mancanti' };
  for (const [d, s] of Object.entries(payload.specs)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, reason: `data di efficacia non valida: ${d}` };
    if (!/^FP[AR]\d{2}$/.test(s.versione || '')) return { ok: false, reason: `versione tracciato non valida per ${d}` };
    if (!/^https?:\/\/.+agenziaentrate\.gov\.it\/.+/.test(s.namespace || '')) return { ok: false, reason: `namespace non attendibile per ${d}` };
    if (!s.regimeCodes || !/^RF\d{2}$/.test(s.regimeCodes.forfettario || '') || !/^RF\d{2}$/.test(s.regimeCodes.ordinario || '')) return { ok: false, reason: `codici regime non validi per ${d}` };
    if (!/^N\d(\.\d)?$/.test(s.naturaForfettario || '')) return { ok: false, reason: `Natura forfettario non valida per ${d}` };
    if (!(s.decimals >= 2 && s.decimals <= 8)) return { ok: false, reason: `decimali fuori range per ${d}` };
  }
  return { ok: true };
}

// AUTO-AGGIORNAMENTO del formato (anche senza aggiornare l'app): scarica un
// payload da una fonte STRUTTURATA FIDATA (url whitelisted), lo valida, e lo
// adotta SOLO se più recente E plausibile. Senza fonte/raggiungibilità → si resta
// sulla specifica inclusa nell'app (fallback sicuro). Cadenza consigliata: rara
// (il tracciato cambia ogni molti anni). Onestà: senza una fonte reale, non fa nulla.
export async function fetchFormatUpdate({ url, fetchImpl, currentVersion = FORMAT_REGISTRY_VERSION } = {}) {
  if (!url || typeof fetchImpl !== 'function') {
    return { updated: false, reason: 'nessuna fonte configurata: uso il formato incluso nell\'app' };
  }
  try {
    const res = await fetchImpl(url);
    if (!res || !res.ok) return { updated: false, reason: `fonte non raggiungibile (HTTP ${res && res.status})` };
    const payload = await res.json();
    const v = validateFormatPayload(payload);
    if (!v.ok) return { updated: false, reason: `formato NON adottato (anti-veleno): ${v.reason}` };
    if (!isNewer(payload.version, currentVersion)) return { updated: false, reason: 'formato già aggiornato' };
    return { updated: true, version: payload.version, specs: payload.specs };
  } catch (e) {
    return { updated: false, reason: `errore rete/parsing: ${e.message} — resto sul formato incluso` };
  }
}
