// ============================================================
// RILEVANZA — QUALE PEZZO DI MOMENTUM TI SERVE ADESSO
// ============================================================
// Secondo passo di profilo-feature.js. Quello decide se una cosa ESISTE per
// te; questo decide QUANTO CONTA per te oggi, e quindi in che ordine la vedi.
//
// Perché non bastavano i flag booleani. `cuscinettoInPrimoPiano` è acceso da
// una risposta data una volta in onboarding ("ho meno di due mesi di
// liquidità") e da quel momento resta vera per sempre, anche se nel frattempo
// la persona il cuscinetto se l'è costruito davvero. È una fotografia usata
// come se fosse un termometro. E soprattutto era un interruttore per UNA card:
// per la seconda sarebbe servito un secondo flag, per la terza un terzo, e
// dieci flag che si contendono la stessa cima di schermata non compongono un
// ordine — si contraddicono.
//
// Qui la priorità è un NUMERO, calcolato dai fatti veri (quanti mesi di
// cuscinetto hai ORA, quanti giorni mancano allo stipendio, da quanto tempo
// quei soldi del gruppo sono in sospeso) e dal profilo insieme. Un solo
// meccanismo, che si estende aggiungendo una riga invece che un flag.
//
// TRE GARANZIE DI PROGETTO, tutte verificate dai test accanto:
//
//  1. ZONA INTOCCABILE. Il filo logico della Dashboard è temporale — oggi
//     (l'orb), questa settimana, il mese, i movimenti — ed è una decisione di
//     design già presa e scritta in index.html. Il riordino NON la tocca: si
//     muovono solo le card "argomento" più in basso. Nessun algoritmo deve
//     poter smontare l'impaginazione da sotto i piedi dell'utente.
//
//  2. NIENTE BALLETTO. Una card che cambia posto a ogni render è peggio di
//     una card nel posto sbagliato: la memoria spaziale è la cosa che rende
//     un'app veloce da usare, e riordinare in continuazione la distrugge.
//     Serve un vantaggio netto (SOGLIA_SPOSTAMENTO) per scavalcare l'ordine
//     base, e a parità si resta fermi.
//
//  3. MAI NASCONDERE. Qui non si nasconde niente: una card irrilevante
//     scende, non sparisce. Quello che sparisce lo decide solo un segnale
//     esplicito dell'utente, e vive in profilo-feature.js.
'use strict';

// L'ordine attuale della Dashboard, quello disegnato in index.html. È il
// punto di partenza e il fallback: senza nessun segnale, l'app resta
// esattamente com'è oggi. Numeri distanziati per lasciare spazio in mezzo.
export const ORDINE_BASE = {
  'safe-to-spend-card': 10,     // "quanto posso spendere" — la domanda numero uno
  'ghost-forecast': 20,         // la stessa domanda, versione Cassa Unica
  'next-expense-nudge': 30,
  'dashboard-insight': 40,
  'split-reminder': 50,
  'tax-discover-card': 60,
  'veglia-mercato': 70,
  'jar-card': 80,               // salvadanaio / cuscinetto d'emergenza
  'savings-goals-card-dash': 90,
};

// Sotto questa soglia non ci si muove: il guadagno non vale la confusione di
// ritrovare le cose in un altro posto.
export const SOGLIA_SPOSTAMENTO = 25;

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── I SEGNALI, uno per card ──────────────────────────────────────────────
// Ogni voce restituisce { punti, motivo }: `punti` è quanto quella card
// guadagna rispetto alla sua posizione base, `motivo` è la frase che spiega
// perché — non decorativa, serve a poter dire all'utente (e a noi, tra sei
// mesi) perché quella card è finita in cima.
//
// I punti sono continui, non a gradini: una card non "si accende", sale in
// modo proporzionale a quanto il problema è reale. Sotto zero non si scende
// mai: una card può perdere la promozione, non essere punita.

function segnaleCuscinetto(state, ctx) {
  const prefs = state.investmentPrefs || {};
  const mesi = ctx.mesiCuscinetto;
  // Entrate irregolari: lo stesso cuscinetto copre meno, perché il prossimo
  // incasso non è garantito. Tre mesi da dipendente sono tranquillità; tre
  // mesi da freelance sono tre mesi e forse basta. Alza il peso, non lo crea:
  // se il cuscinetto è solido non promuove comunque niente.
  const irregolari = prefs.incomeRegularity === 'irregolare';
  const peso = irregolari ? 1.35 : 1;
  // Il FATTO batte la dichiarazione, sempre. Se sappiamo quanti mesi di
  // cuscinetto ha davvero, usiamo quello e ignoriamo la risposta data mesi fa
  // in onboarding: è esattamente il caso che i flag booleani sbagliavano.
  if (Number.isFinite(mesi)) {
    if (mesi >= 3) return { punti: 0, motivo: 'cuscinetto solido, nessuna urgenza' };
    // 3 mesi → 0 punti, 0 mesi → 90 punti. Continuo, non a scalini.
    const punti = Math.round((3 - clamp(mesi, 0, 3)) / 3 * 90 * peso);
    // Senza rete E con lo stipendio ancora lontano è il momento peggiore
    // possibile: è lì che la card serve davvero, non "in generale".
    const lontanoDalloStipendio = num(ctx.giorniAlPayday, 0) >= 10 && mesi < 1;
    return {
      punti: punti + (lontanoDalloStipendio ? 25 : 0),
      motivo: lontanoDalloStipendio
        ? `meno di un mese di cuscinetto e ${ctx.giorniAlPayday} giorni allo stipendio`
        : `cuscinetto sotto i 3 mesi (${mesi.toFixed(1)})`,
    };
  }
  // Nessun dato reale: resta la dichiarazione dell'onboarding, ma vale meno.
  if (prefs.cashflowStress === 'corto') return { punti: Math.round(60 * peso), motivo: 'ha dichiarato meno di due mesi di liquidità' };
  if (irregolari) return { punti: 30, motivo: 'entrate irregolari, cuscinetto sconosciuto' };
  return { punti: 0, motivo: 'nessun segnale sul cuscinetto' };
}

// `previsioneCassaInPrimoPiano` NON esiste come segnale, ed è una scoperta,
// non una dimenticanza. Il flag chiedeva di alzare la previsione di cassa per
// chi ha entrate irregolari — ma la previsione di cassa in Dashboard è la
// Cassa Unica (#ghost-forecast), che sta nella zona fissa, cioè è già la
// seconda cosa che vedi, per tutti. Il flag chiedeva di promuovere qualcosa
// di già promosso: collegarlo avrebbe aggiunto codice e zero effetto.
//
// Il bisogno vero dietro quella domanda resta, e ha un posto dove contare
// davvero: chi ha entrate irregolari ha bisogno di più cuscinetto a parità di
// mesi, perché il prossimo incasso non è una certezza. Quindi il segnale vive
// dentro segnaleCuscinetto, come amplificatore — dove sposta qualcosa.

function segnaleSplit(state, ctx) {
  const sospeso = num(ctx.sospesoSplit, 0);
  if (sospeso <= 0) return { punti: 0, motivo: 'niente in sospeso nei gruppi' };
  // `riepilogoGruppi`, secondo flag scollegato. Non basta "hai un gruppo":
  // conta quanto ti devono e da quanto. Un caffè di ieri non è una priorità,
  // duecento euro fermi da tre settimane sì — ed è la cosa che fa smettere di
  // usare le app di divisione spese: nessuno te lo ricorda al momento giusto.
  const giorni = num(ctx.giorniSospeso, 0);
  const perImporto = clamp(Math.round(sospeso / 5), 0, 45);
  const perAttesa = clamp(Math.round(giorni * 2.5), 0, 40);
  return {
    punti: perImporto + perAttesa,
    motivo: giorni >= 14
      ? `${sospeso.toFixed(0)}€ in sospeso da ${giorni} giorni`
      : `${sospeso.toFixed(0)}€ in sospeso`,
  };
}

function segnaleObiettivi(state, ctx) {
  const obiettivi = state.savingsGoals || [];
  if (!obiettivi.length) return { punti: 0, motivo: 'nessun obiettivo' };
  // Un obiettivo a rischio è l'unico motivo per alzarlo: un obiettivo che va
  // bene non ha bisogno della cima della schermata, ha bisogno di esserci.
  if (ctx.obiettivoARischio) return { punti: 55, motivo: 'un obiettivo sta andando fuori strada' };
  const gg = ctx.giorniAllaScadenzaObiettivo;
  if (Number.isFinite(gg) && gg >= 0 && gg <= 30) {
    return { punti: clamp(Math.round((30 - gg) * 1.5), 0, 45), motivo: `un obiettivo scade fra ${gg} giorni` };
  }
  return { punti: 10, motivo: 'obiettivi presenti e in linea' };
}

function segnaleMercato(state, ctx) {
  const prefs = state.investmentPrefs || {};
  if (prefs.invests === false) return { punti: 0, motivo: 'ha detto che non investe' };
  const posizioni = (state.positions || []).length;
  if (!posizioni) return { punti: 0, motivo: 'nessuna posizione' };
  // Il mercato sale in cima solo quando è successo qualcosa che riguarda TE:
  // un movimento forte sul tuo portafoglio, non "il mercato in generale".
  const scossa = Math.abs(num(ctx.variazionePortafoglioPct, 0));
  return {
    punti: scossa >= 3 ? clamp(Math.round(scossa * 12), 0, 65) : 0,
    motivo: scossa >= 3 ? `portafoglio mosso del ${scossa.toFixed(1)}% oggi` : 'mercato tranquillo',
  };
}

function segnaleInsight(state, ctx) {
  // L'insight della Dashboard è già selezionato a monte per essere UNA cosa
  // che vale la pena dire: se c'è, merita di stare alto.
  return ctx.haInsight ? { punti: 35, motivo: 'c’è qualcosa da raccontare' } : { punti: 0, motivo: 'niente di rilevante da dire' };
}

function segnaleNudge(state, ctx) {
  // La spesa che stai per fare vale solo NEL momento in cui stai per farla.
  return ctx.haNudge ? { punti: 40, motivo: 'abitudine riconosciuta in questo momento della giornata' } : { punti: 0, motivo: 'nessun pattern netto adesso' };
}

const SEGNALI = {
  'jar-card': segnaleCuscinetto,
  'split-reminder': segnaleSplit,
  'savings-goals-card-dash': segnaleObiettivi,
  'veglia-mercato': segnaleMercato,
  'dashboard-insight': segnaleInsight,
  'next-expense-nudge': segnaleNudge,
};

// Le card che rispondono a "quanto posso spendere" non si spostano MAI: sono
// la ragione per cui si apre l'app. Nessun segnale può scavalcarle.
export const ZONA_FISSA = new Set(['safe-to-spend-card', 'ghost-forecast']);

// ── LA FUNZIONE ──────────────────────────────────────────────────────────
// Pura: stesso stato + stesso contesto → stesso ordine, sempre. Niente Date
// letta da dentro, niente DOM, niente stato globale.
//
// `contesto` sono i fatti veri, calcolati da chi ha i dati sotto mano:
//   mesiCuscinetto, giorniAlPayday, sospesoSplit, giorniSospeso,
//   obiettivoARischio, giorniAllaScadenzaObiettivo, variazionePortafoglioPct,
//   haInsight, haNudge. Tutti opzionali: quello che manca vale "nessun
//   segnale", mai un'invenzione.
export function rilevanzaDashboard(state = {}, contesto = {}) {
  const voci = [];
  for (const [id, base] of Object.entries(ORDINE_BASE)) {
    const fn = SEGNALI[id];
    let punti = 0;
    let motivo = 'ordine predefinito';
    if (fn && !ZONA_FISSA.has(id)) {
      const r = fn(state, contesto) || {};
      punti = Math.max(0, num(r.punti, 0));
      motivo = r.motivo || motivo;
    }
    // Sotto soglia il guadagno si annulla del tutto: o una card si sposta per
    // un motivo forte, o resta dov'è. Niente micro-aggiustamenti invisibili
    // che però spostano le cose di una posizione a ogni apertura.
    const effettivi = punti >= SOGLIA_SPOSTAMENTO ? punti : 0;
    voci.push({ id, base, punti, effettivi, motivo, promossa: effettivi > 0 });
  }
  // Ordine finale: prima chi ha guadagnato di più; a parità, l'ordine base.
  // Il tie-break sull'ordine base è ciò che rende il risultato stabile e
  // riproducibile — mai due render uguali con due ordini diversi.
  voci.sort((a, b) => (b.effettivi - a.effettivi) || (a.base - b.base));
  return voci.map((v, i) => ({ ...v, posizione: i + 1 }));
}

// Comodo per l'interfaccia: id → valore da mettere in `style.order`.
export function ordineCss(state = {}, contesto = {}) {
  const out = {};
  for (const v of rilevanzaDashboard(state, contesto)) out[v.id] = v.posizione;
  return out;
}

// Spiegabilità: perché quella card sta in cima. Serve a poterlo dire, non a
// riempire la schermata — una promozione che non si sa spiegare è una
// promozione che non andava fatta.
export function motivoPromozione(state = {}, contesto = {}) {
  const prima = rilevanzaDashboard(state, contesto)[0];
  return prima && prima.promossa ? { id: prima.id, motivo: prima.motivo } : null;
}
