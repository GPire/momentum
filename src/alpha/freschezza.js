// ============================================================
// I DATI INVECCHIANO IN SILENZIO — e questa è la parte che nessuno costruisce
// ============================================================
// Tutti i pannelli costruiti finora (macro, settori, multi-attivo, giornaliero)
// sono ISTANTANEE CONGELATE: generate una volta, incorporate nel codice. Oggi
// sono corrette. Fra tre anni darebbero gli stessi numeri, con la stessa
// sicurezza, e nessuno se ne accorgerebbe — perché un dato vecchio non ha
// l'aria di essere vecchio: ha l'aria di essere un dato.
//
// È lo stesso errore che il progetto ha già corretto una volta per le regole
// fiscali (`taxRulesFreshness`): un utente nel 2031 avrebbe visto le aliquote
// del 2026 senza un solo indizio. Qui il rischio è identico e più subdolo,
// perché una percentuale di mercato sbagliata sembra plausibile per sempre.
//
// COSA FA QUESTO MODULO, e sono due cose diverse che vanno tenute separate:
//
//  1. SAPERE quanto sono vecchi i dati, per ciascun pannello, con una tolleranza
//     diversa a seconda del tipo. Un indice di condizioni finanziarie
//     settimanale invecchia in settimane; una serie di rendimenti mensili
//     lunga trent'anni non cambia significato se le manca un mese.
//
//  2. AGGIORNARLI da solo quando c'è rete, e — questo è il punto — **senza
//     rigenerare il codice**: si scaricano solo le osservazioni NUOVE e si
//     tengono da parte come "coda", che viene appesa al pannello congelato al
//     momento dell'uso. Il pannello resta la base verificata, la coda è
//     l'aggiornamento, e le due cose non si confondono mai.
//
// PERCHÉ NON È "SI AUTO-ADDESTRA", e vale la pena essere precisi: nessun
// modello impara qui. Si va a prendere un dato pubblico che prima non c'era.
// Chiamarlo apprendimento sarebbe la solita esagerazione da presentazione;
// chiamarlo aggiornamento è esatto ed è già molto, perché è la differenza fra
// uno strumento che invecchia e uno che resta vero.
//
// L'ONESTÀ GRADUATA, come per le regole fiscali: non "affidabile / non
// affidabile" ma tre gradi, perché la realtà è graduata e un avviso che
// grida sempre viene ignorato sempre.
//
// Funzioni PURE: `fetchImpl` e `adesso` sono iniettabili, quindi i test non
// toccano la rete e non dipendono dal calendario.
'use strict';

// Tolleranza per tipo di dato, in giorni. Non sono numeri tondi scelti a caso:
// riflettono ogni quanto la fonte pubblica un valore nuovo, piu' un margine.
export const TOLLERANZE = {
  giornaliero: { fresco: 7, invecchiato: 35, nome: 'prezzi giorno per giorno' },
  settimanale: { fresco: 21, invecchiato: 70, nome: 'condizioni finanziarie' },
  mensile: { fresco: 65, invecchiato: 200, nome: 'serie mensili di mercato' },
  storico: { fresco: 400, invecchiato: 1100, nome: 'archivio storico lungo' },
};

const GIORNO = 86400000;

// Converte 'AAAA-MM' o 'AAAA-MM-GG' in millisecondi, prendendo la FINE del
// periodo: un pannello che arriva a '2026-07' contiene tutto luglio, e datarlo
// al primo del mese lo farebbe risultare piu' vecchio di quanto sia.
export function fineDi(data) {
  const p = String(data || '').split('-').map(Number);
  if (p.length >= 3) return Date.UTC(p[0], p[1] - 1, p[2], 23, 59, 59);
  if (p.length === 2) return Date.UTC(p[0], p[1], 0, 23, 59, 59); // giorno 0 del mese dopo = ultimo del mese
  return NaN;
}

export function eta(ultimaData, { adesso = Date.now() } = {}) {
  const t = fineDi(ultimaData);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((adesso - t) / GIORNO));
}

// Il giudizio su UN pannello.
export function giudizio({ nome, ultimaData, tipo = 'mensile' }, { adesso = Date.now() } = {}) {
  const t = TOLLERANZE[tipo] || TOLLERANZE.mensile;
  const giorni = eta(ultimaData, { adesso });
  if (giorni === null) return { nome, valutabile: false, motivo: 'data non leggibile' };
  const stato = giorni <= t.fresco ? 'fresco' : giorni <= t.invecchiato ? 'invecchiato' : 'vecchio';
  return {
    nome, tipo, ultimaData, giorni, stato, valutabile: true,
    // Cosa significa per chi legge una risposta costruita su questo pannello.
    // Graduato apposta: un avviso che grida sempre viene ignorato sempre.
    avviso: stato === 'fresco' ? null
      : stato === 'invecchiato'
        ? `i dati su ${t.nome} si fermano a ${ultimaData}: per le tendenze di fondo vanno ancora bene, per lo stato di oggi meno`
        : `i dati su ${t.nome} si fermano a ${ultimaData}, cioe' ${Math.round(giorni / 30)} mesi fa: quello che ti dico sul PRESENTE potrebbe non valere piu'`,
    // Le affermazioni storiche restano valide comunque: trent'anni di storia
    // non diventano falsi perche' manca l'ultimo mese. Distinguere le due cose
    // evita sia il falso allarme sia la falsa sicurezza.
    storiaAncoraValida: true,
    presenteAffidabile: stato !== 'vecchio',
  };
}

// Il quadro completo, letto dai pannelli veri invece che da una lista scritta
// a mano: se domani si aggiunge un pannello e ci si dimentica di registrarlo,
// meglio che manchi dall'elenco piuttosto che comparire con una data inventata.
export async function statoDeiDati({ adesso = Date.now() } = {}) {
  const voci = [];
  const prova = async (carica, mappa) => {
    try { voci.push(giudizio(mappa(await carica()), { adesso })); } catch (_) { /* pannello assente: non si finge */ }
  };
  await prova(() => import('./daily-panel.js'), (m) => ({ nome: 'prezzi giornalieri', ultimaData: m.GIORNI_A, tipo: 'giornaliero' }));
  await prova(() => import('./macro-panel.js'), (m) => ({ nome: 'macro e tassi', ultimaData: m.MACRO_A, tipo: 'mensile' }));
  await prova(() => import('./global-panel.js'), (m) => ({ nome: 'mercati globali', ultimaData: m.GLOBALE_A, tipo: 'mensile' }));
  await prova(() => import('./long-asset-panel.js'), (m) => ({ nome: 'multi-attivo lungo', ultimaData: m.LUNGO_A, tipo: 'storico' }));
  await prova(() => import('./historical-returns.js'), (m) => ({ nome: 'archivio azionario', ultimaData: m.SERIE_STORICHE.spy.a, tipo: 'storico' }));

  const vecchi = voci.filter((v) => v.stato === 'vecchio');
  const invecchiati = voci.filter((v) => v.stato === 'invecchiato');
  return {
    pannelli: voci,
    tuttoFresco: voci.length > 0 && vecchi.length === 0 && invecchiati.length === 0,
    daAggiornare: [...vecchi, ...invecchiati].map((v) => v.nome),
    // La frase da appendere a una risposta, quando serve. `null` quando non
    // serve: nessun rumore inutile.
    avviso: vecchi.length
      ? `Attenzione: ${vecchi.map((v) => v.nome).join(' e ')} ${vecchi.length > 1 ? 'si fermano' : 'si ferma'} a piu' di sei mesi fa. Quello che dico sul passato resta valido; sul presente, meno.`
      : null,
  };
}

// ── L'AGGIORNAMENTO, quando c'è rete ──
// Scarica SOLO le osservazioni successive all'ultima nota. Non riscrive il
// pannello incorporato — restituisce una "coda" da conservare a parte.
// `fetchImpl` iniettabile: i test non toccano la rete.
export const FONTI_AGGIORNABILI = {
  nfci: { url: (da) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=NFCI&cosd=${da}`, tipo: 'fred', etichetta: 'condizioni finanziarie' },
  curva: { url: (da) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M&cosd=${da}`, tipo: 'fred', etichetta: 'curva dei rendimenti' },
  disoccupazione: { url: (da) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE&cosd=${da}`, tipo: 'fred', etichetta: 'disoccupazione' },
};

// Un CSV di FRED, letto senza fidarsi: le righe con '.' sono buchi dichiarati
// dalla fonte, e vanno saltate invece che trasformate in zeri.
export function leggiCsvFred(testo) {
  const righe = String(testo || '').trim().split('\n');
  if (righe.length < 2) return [];
  const out = [];
  for (const r of righe.slice(1)) {
    const [d, v] = r.split(',');
    if (!d || v === undefined || v === '.' || v === '') continue;
    const n = parseFloat(v);
    if (Number.isFinite(n)) out.push({ data: d.trim(), valore: n });
  }
  return out;
}

export async function aggiorna(quali = Object.keys(FONTI_AGGIORNABILI), {
  daDate = {}, fetchImpl, adesso = Date.now(), timeoutMs = 8000,
} = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { riuscito: false, motivo: 'nessun modo di scaricare dati in questo ambiente', code: [] };

  const code = [], falliti = [];
  for (const chiave of quali) {
    const fonte = FONTI_AGGIORNABILI[chiave];
    if (!fonte) { falliti.push({ chiave, motivo: 'fonte sconosciuta' }); continue; }
    const da = daDate[chiave] || new Date(adesso - 400 * GIORNO).toISOString().slice(0, 10);
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      const res = await f(fonte.url(da), ctrl ? { signal: ctrl.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (!res?.ok) { falliti.push({ chiave, motivo: `risposta ${res?.status ?? '?'}` }); continue; }
      const punti = leggiCsvFred(await res.text());
      if (!punti.length) { falliti.push({ chiave, motivo: 'nessuna osservazione utile' }); continue; }
      code.push({ chiave, etichetta: fonte.etichetta, punti, ultimo: punti[punti.length - 1] });
    } catch (e) {
      // Nessuna rete, nessun problema: si resta sui dati incorporati e lo si
      // dichiara. Un aggiornamento fallito non deve mai rompere l'app.
      falliti.push({ chiave, motivo: String(e?.name === 'AbortError' ? 'tempo scaduto' : e?.message || e).slice(0, 80) });
    }
  }
  return {
    riuscito: code.length > 0,
    aggiornatoIl: adesso,
    code, falliti,
    motivo: code.length ? null : 'nessuna fonte raggiungibile: resto sui dati che ho gia\'',
  };
}

// La coda si conserva nel vault come campo ADDITIVO, come ogni altra cosa in
// questo progetto: se manca, tutto funziona come prima.
export function applicaCoda(valoriIncorporati = [], coda = null, { chiave } = {}) {
  if (!coda?.code?.length) return { valori: valoriIncorporati, aggiunti: 0, fonte: 'incorporati' };
  const c = coda.code.find((x) => x.chiave === chiave);
  if (!c?.punti?.length) return { valori: valoriIncorporati, aggiunti: 0, fonte: 'incorporati' };
  return {
    valori: valoriIncorporati.concat(c.punti.map((p) => p.valore)),
    aggiunti: c.punti.length,
    ultimaData: c.ultimo.data,
    fonte: 'incorporati + aggiornamento',
  };
}

export function freschezzaText(stato) {
  if (!stato?.pannelli?.length) return null;
  if (stato.tuttoFresco) return null; // quando va tutto bene non si dice niente
  return stato.avviso || `Alcuni dati non sono freschissimi (${stato.daAggiornare.join(', ')}), ma per le tendenze di fondo vanno ancora bene.`;
}
