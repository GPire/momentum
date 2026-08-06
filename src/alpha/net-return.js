// ============================================================
// IL NETTO VERO — architettura pronta per ogni mercato (stesso schema di
// country-invoicing.js: l'Italia è l'implementazione completa, aggiungere
// un Paese è una entry di dati verificata, mai una riscrittura del motore)
// ============================================================
// I simulatori e le app di educazione finanziaria mostrano quasi sempre il
// rendimento LORDO ("il tuo ETF ha reso il 7%"). Un ETF al 7% lordo non è
// un ETF al 7%: le imposte sulle plusvalenze cambiano le decisioni più di
// qualsiasi consiglio, e sono diverse in ogni Paese. Onestà (regola #1):
// non è consulenza fiscale, sono le aliquote pubbliche di ogni Paese,
// verificate una per una — mai un numero "internazionale" inventato.
//
// Aliquote verificate incrociando più fonti indipendenti (agosto 2026):
//  - IT: capital gain 26% (12,5% titoli di Stato), bollo titoli 0,20%
//    annuo sul deposito con esenzione sotto 5.000€.
//    Fonti: consulenzavincente.it, funnifin.com, nevist.it, onlinesim.it.
//  - DE (Abgeltungssteuer): 25% + 5,5% Solidaritätszuschlag = 26,375%
//    flat su tutte le plusvalenze mobiliari, nessuna distinzione
//    breve/lungo termine. Franchigia (Sparerpauschbetrag) 1.000€/persona
//    l'anno su redditi da capitale, va richiesta in banca (Freistellungsauftrag)
//    per essere applicata automaticamente altrimenti si recupera in
//    dichiarazione. Imposta ecclesiastica opzionale (~1,5% extra) NON
//    inclusa: dipende dall'appartenenza religiosa dichiarata, non
//    deducibile dai soli dati del portafoglio.
//    Fonti: germanpedia.com, n26.com, allinvestview.com,
//    germancompanyformation.com (capital gains tax Germany 2026).
//  - FR (Prélèvement Forfaitaire Unique — flat tax): 31,4% dal 2026
//    (12,8% imposta sul reddito + 18,6% prelievi sociali, saliti da
//    17,2% per la Contribution Financière pour l'Autonomie), su azioni,
//    ETF/OPC, obbligazioni e cripto. Nessuna franchigia nel regime PFU
//    di default (esiste un'opzione per il barème progressivo, non
//    modellata qui: quasi sempre meno conveniente per redditi da
//    capitale medi, va valutata caso per caso).
//    Fonti: ramify.fr, socic.fr, meilleurescpi.com, straderz.com,
//    crypcool.com (flat tax France 2026).
//
// LIMITE ONESTO E DICHIARATO, uguale per ogni Paese: le minusvalenze non
// generano qui un credito d'imposta per gli anni futuri (zainetto fiscale/
// report de moins-value/Verlustverrechnung NON simulati) — ogni posizione
// in perdita semplicemente non paga nulla, mai un risparmio fiscale
// calcolato. Per la Germania, il regime agevolato Teilfreistellung sui
// fondi azionari (~30% di esenzione) NON è applicato: servirebbe
// classificare ogni fondo per tipo, dato che qui non abbiamo — verificare
// col proprio consulente se si tratta di un fondo azionario tedesco.
'use strict';

// `verificatoIl` + `periodoRevisione`: OGNI Paese dichiara QUANDO l'aliquota
// è stata verificata su fonte pubblica e ogni QUANTO tende storicamente a
// cambiare — non una promessa di aggiornamento automatico (servirebbe
// l'infrastruttura di tax-rules.js: fetch da fonte primaria firmata,
// separata e più grande di questo modulo), ma il minimo onesto: l'app SA e
// DICE quanto sono vecchi i propri dati, invece di spacciarli per eterni.
// `periodoRevisione` in giorni, verificato caso per caso: le aliquote di
// capital gain cambiano tipicamente con la legge di bilancio annuale (IT,
// FR) o restano stabili per anni (DE, invariata dal 2009) — dichiarato per
// Paese, mai una cadenza uguale per tutti a caso.
export const COUNTRY_TAX_PROFILES = {
  IT: {
    name: 'Italia', currency: 'EUR',
    aliquotaStandard: 0.26,
    aliquotaAgevolata: { assetClass: 'bond', aliquota: 0.125 }, // titoli di Stato
    allowanceAnnuo: 0,
    bollo: { aliquota: 0.002, sogliaEsenzione: 5000 },
    verificatoIl: '2026-08-06', periodoRevisioneGiorni: 365, // legge di bilancio annuale
  },
  DE: {
    name: 'Germania', currency: 'EUR',
    aliquotaStandard: 0.26375, // 25% Abgeltungssteuer + 5,5% Soli
    aliquotaAgevolata: null,
    allowanceAnnuo: 1000, // Sparerpauschbetrag, per persona
    bollo: null,
    verificatoIl: '2026-08-06', periodoRevisioneGiorni: 1460, // stabile dal 2009: revisione più rada
  },
  FR: {
    name: 'Francia', currency: 'EUR',
    aliquotaStandard: 0.314, // PFU 2026 (12,8% + 18,6%)
    aliquotaAgevolata: null,
    allowanceAnnuo: 0,
    bollo: null,
    verificatoIl: '2026-08-06', periodoRevisioneGiorni: 365, // loi de financement annuale (appena salita nel 2026)
  },
};

// Dice onestamente quanto sono vecchi i dati di un Paese, in 3 livelli —
// stesso schema a fasce di taxRulesFreshness (tax-rules.js), applicato qui.
export function netReturnFreshness(country = 'IT', { now = new Date(), profilesOverride = null } = {}) {
  const profile = profileFor(country, profilesOverride);
  const giorni = Math.max(0, Math.round((new Date(now) - new Date(profile.verificatoIl)) / 86400000));
  const scaduto = giorni > profile.periodoRevisioneGiorni;
  if (giorni <= 30) {
    return { aggiornato: true, giorni, livello: 'ok', messaggio: `Aliquote ${profile.name} verificate il ${profile.verificatoIl}: recenti.` };
  }
  if (!scaduto) {
    return { aggiornato: true, giorni, livello: 'probabile', messaggio: `Aliquote ${profile.name} verificate il ${profile.verificatoIl} (${giorni} giorni fa) — nel periodo in cui di solito restano stabili, ma controlla se sai di una legge recente.` };
  }
  return { aggiornato: false, giorni, livello: 'verifica', messaggio: `Aliquote ${profile.name} verificate il ${profile.verificatoIl}, oltre ${Math.round(profile.periodoRevisioneGiorni / 30)} mesi fa: potrebbero essere cambiate. Verificale su fonte ufficiale prima di fidarti del numero netto.` };
}

function aliquotaPer(profile, assetClass) {
  if (profile.aliquotaAgevolata && assetClass === profile.aliquotaAgevolata.assetClass) {
    return profile.aliquotaAgevolata.aliquota;
  }
  return profile.aliquotaStandard;
}

function profileFor(country, override) {
  return (override && override[country]) || COUNTRY_TAX_PROFILES[country] || COUNTRY_TAX_PROFILES.IT;
}

// `rows` = le righe già arricchite da analyzePortfolio (ticker, assetClass,
// value, cost, pl, plPct...). `country` = ISO 3166-1 alpha-2, default 'IT'.
// `profilesOverride`: profili scaricati e già validati da fetchNetReturnRatesUpdate
// (stesso meccanismo di rulesOverride in tax.js) — passarli fa usare le
// aliquote aggiornate SENZA aggiornare l'app. Ritorna le stesse righe con
// netPl/netPlPct in più, e i totali di portafoglio già al netto di imposta.
export function computeNetReturn(rows = [], totalValue = 0, country = 'IT', profilesOverride = null) {
  const profile = profileFor(country, profilesOverride);
  const righeGrezze = (rows || []).map((r) => ({ ...r, aliquotaCapitalGain: aliquotaPer(profile, r.assetClass) }));

  // Franchigia (es. Sparerpauschbetrag tedesco): riduce il guadagno
  // imponibile AGGREGATO, non l'imposta direttamente. Si distribuisce sulle
  // righe in proporzione al loro guadagno lordo, così la somma delle righe
  // torna esatta al totale — mai un'approssimazione che non quadra.
  const totalGains = +righeGrezze.reduce((s, r) => s + Math.max(0, r.pl || 0), 0).toFixed(2);
  const taxableGains = Math.max(0, +(totalGains - (profile.allowanceAnnuo || 0)).toFixed(2));
  const franchigiaRatio = totalGains > 0 ? taxableGains / totalGains : 0;

  const righe = righeGrezze.map((r) => {
    const imposta = r.pl > 0 ? +(r.pl * franchigiaRatio * r.aliquotaCapitalGain).toFixed(2) : 0;
    const netPl = +(r.pl - imposta).toFixed(2);
    const netPlPct = r.cost > 0 ? +((netPl / r.cost) * 100).toFixed(1) : 0;
    return { ...r, impostaCapitalGain: imposta, netPl, netPlPct };
  });

  const totaleImposta = +righe.reduce((s, r) => s + r.impostaCapitalGain, 0).toFixed(2);
  const bollo = profile.bollo && totalValue >= profile.bollo.sogliaEsenzione
    ? +(totalValue * profile.bollo.aliquota).toFixed(2)
    : 0;
  const totalPlLordo = +righe.reduce((s, r) => s + r.pl, 0).toFixed(2);
  const totalCost = +righe.reduce((s, r) => s + r.cost, 0).toFixed(2);
  const netTotalPl = +(totalPlLordo - totaleImposta - bollo).toFixed(2);
  const netTotalPlPct = totalCost > 0 ? +((netTotalPl / totalCost) * 100).toFixed(1) : 0;

  return {
    country, countryName: profile.name,
    rows: righe,
    totalPlLordo,
    totaleImpostaCapitalGain: totaleImposta,
    allowanceApplicata: profile.allowanceAnnuo ? Math.min(totalGains, profile.allowanceAnnuo) : 0,
    bolloTitoli: bollo,
    bolloEsente: profile.bollo ? totalValue < profile.bollo.sogliaEsenzione : null,
    netTotalPl,
    netTotalPlPct,
    freschezza: netReturnFreshness(country, { profilesOverride }),
    disclaimer: `Aliquote pubbliche ${profile.name} applicate ai dati che hai inserito — non è consulenza fiscale. Le minusvalenze non generano qui un credito d'imposta per gli anni futuri: verifica col tuo consulente se hai posizioni chiuse in perdita.`,
  };
}

// Backward-compat: le costanti italiane restano esportate (usate altrove
// come riferimento verificato), ma la fonte di verità è COUNTRY_TAX_PROFILES.IT.
export const ALIQUOTA_CAPITAL_GAIN = COUNTRY_TAX_PROFILES.IT.aliquotaStandard;
export const ALIQUOTA_CAPITAL_GAIN_TITOLI_STATO = COUNTRY_TAX_PROFILES.IT.aliquotaAgevolata.aliquota;
export const BOLLO_TITOLI_ALIQUOTA_ANNUA = COUNTRY_TAX_PROFILES.IT.bollo.aliquota;
export const BOLLO_TITOLI_SOGLIA_ESENZIONE = COUNTRY_TAX_PROFILES.IT.bollo.sogliaEsenzione;

// ============================================================
// AUTO-AGGIORNAMENTO — stesso meccanismo verificato di tax-rules.js, non uno
// nuovo. Momentum non "cerca da sola su internet": nessuna app on-device può
// farlo senza un indirizzo fidato deciso a monte (altrimenti sarebbe
// esattamente il tipo di dato non verificato che questo progetto vieta). Ma
// SE l'utente configura una fonte (stessa impostazione avanzata già usata
// per le regole fiscali italiane, src/main.js:runAutoUpdateCycle), queste
// aliquote di ogni Paese entrano nello STESSO ciclo di controllo periodico,
// con la STESSA validazione anti-veleno prima di essere adottate — mai un
// numero scaricato e usato alla cieca.

export const NET_RETURN_RATES_VERSION = '2026-08';

function isNewer(a, b) { return String(a) > String(b); }

// Payload atteso: { version, profiles: { IT: {...}, DE: {...}, ... } }.
// Ogni profilo deve avere valori PLAUSIBILI (mai un'aliquota fuori scala che
// romperebbe silenziosamente ogni calcolo netto) — stessa disciplina di
// validateRulesPayload: struttura E range, non solo presenza dei campi.
export function validateNetReturnPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'payload non valido' };
  if (typeof payload.version !== 'string' || payload.version.length < 4) return { ok: false, reason: 'versione mancante o non valida' };
  if (!payload.profiles || typeof payload.profiles !== 'object' || !Object.keys(payload.profiles).length) return { ok: false, reason: 'profili Paese mancanti' };
  for (const [code, p] of Object.entries(payload.profiles)) {
    if (!/^[A-Z]{2}$/.test(code)) return { ok: false, reason: `codice Paese non valido: ${code}` };
    if (typeof p.name !== 'string' || !p.name) return { ok: false, reason: `nome mancante per ${code}` };
    if (!(p.aliquotaStandard > 0 && p.aliquotaStandard < 0.6)) return { ok: false, reason: `aliquota standard implausibile per ${code}` };
    if (p.aliquotaAgevolata != null) {
      if (typeof p.aliquotaAgevolata.assetClass !== 'string') return { ok: false, reason: `aliquota agevolata malformata per ${code}` };
      if (!(p.aliquotaAgevolata.aliquota > 0 && p.aliquotaAgevolata.aliquota < p.aliquotaStandard)) return { ok: false, reason: `aliquota agevolata implausibile per ${code}` };
    }
    if (!(p.allowanceAnnuo >= 0 && p.allowanceAnnuo < 100000)) return { ok: false, reason: `franchigia implausibile per ${code}` };
    if (p.bollo != null) {
      if (!(p.bollo.aliquota > 0 && p.bollo.aliquota < 0.05)) return { ok: false, reason: `bollo implausibile per ${code}` };
      if (!(p.bollo.sogliaEsenzione >= 0 && p.bollo.sogliaEsenzione < 1000000)) return { ok: false, reason: `soglia bollo implausibile per ${code}` };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.verificatoIl || '')) return { ok: false, reason: `data di verifica mancante o malformata per ${code}` };
    if (!(p.periodoRevisioneGiorni > 0 && p.periodoRevisioneGiorni < 3650)) return { ok: false, reason: `periodo di revisione implausibile per ${code}` };
  }
  return { ok: true };
}

// Stesso schema di fetchRulesUpdate: fonte STRUTTURATA FIDATA (url whitelisted
// dall'utente, mai inclusa di default), validata, adottata solo se più
// recente. Senza url configurata → resta sui profili inclusi nell'app
// (fallback sicuro, mai un buco silenzioso).
export async function fetchNetReturnRatesUpdate({ url, fetchImpl, currentVersion = NET_RETURN_RATES_VERSION } = {}) {
  if (!url || typeof fetchImpl !== 'function') {
    return { updated: false, reason: 'nessuna fonte dati configurata: uso le aliquote incluse nell\'app' };
  }
  try {
    const res = await fetchImpl(url);
    if (!res || !res.ok) return { updated: false, reason: `fonte non raggiungibile (HTTP ${res && res.status})` };
    const payload = await res.json();
    const v = validateNetReturnPayload(payload);
    if (!v.ok) return { updated: false, reason: `dati NON adottati (anti-veleno): ${v.reason}` };
    if (!isNewer(payload.version, currentVersion)) return { updated: false, reason: 'aliquote già aggiornate' };
    return { updated: true, version: payload.version, profiles: payload.profiles };
  } catch (e) {
    return { updated: false, reason: `errore rete/parsing: ${e.message} — resto sulle aliquote incluse` };
  }
}
