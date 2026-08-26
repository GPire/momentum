// ============================================================
// PARTITA IVA — accantonamento fiscale automatico (bassa frizione)
// ============================================================
// Frizione enorme e reale per freelance/P.IVA: sapere quanto mettere da parte
// per tasse+contributi+IVA a ogni incasso, per non trovarsi scoperti a fine
// anno. Momentum lo calcola da ogni entrata. Onestà (regola #1): NON è
// consulenza fiscale né sostituisce il commercialista — sono STIME su aliquote
// DICHIARATE dall'utente (configurabili), coi valori di default del regime
// forfettario/ordinario italiano. Funzioni pure, testabili.
'use strict';

// Configurazioni di default (modificabili dall'utente). Regime forfettario:
// coefficiente di redditività (dipende dal codice ATECO, default 78% servizi),
// imposta sostitutiva 15% (5% primi 5 anni startup), gestione separata INPS
// ~26,07% sul reddito imponibile. Ordinario: IRPEF a scaglioni (stima con
// aliquota media dichiarata) + IVA 22% + INPS. Tutto DICHIARATO, mai nascosto.
export const REGIMI = {
  forfettario: { coeffRedditivita: 0.78, impostaSostitutiva: 0.15, inps: 0.2607, iva: 0, label: 'Forfettario (servizi, imposta 15%)' },
  forfettario_startup: { coeffRedditivita: 0.78, impostaSostitutiva: 0.05, inps: 0.2607, iva: 0, label: 'Forfettario startup (imposta 5%, primi 5 anni)' },
  ordinario: { coeffRedditivita: 1.0, impostaSostitutiva: 0.27, inps: 0.24, iva: 0.22, label: 'Ordinario (IRPEF media stimata + IVA 22%)' },
};

// Aliquota INPS Gestione Separata RIDOTTA per chi è GIÀ coperto da un'altra
// forma previdenziale obbligatoria (lavoratore dipendente, pensionato, o
// iscritto ad altra cassa che apre ANCHE una P.IVA in gestione separata):
// 24% invece del 26,07% pieno. LACUNA COLMATA (2026-08-06) — prima non era
// verificabile su fonte ufficiale e si poneva solo come domanda da fare al
// commercialista, mai un numero. Verificato incrociando due fonti
// indipendenti, entrambe citano la circolare INPS n. 8 del 3 febbraio 2026:
// https://www.partitaiva.it/gestione-separata-inps-2026/
// https://www.fiscoetasse.com/new-rassegna-stampa/3491-gestione-separata-inps-2026-aliquote-e-massimali-contributivi.html
export const INPS_GESTIONE_SEPARATA_RIDOTTA = 0.24;

// Coefficiente di redditività forfettario per gruppo ATECO (valori reali IT):
// l'imposta forfettaria si calcola sul fatturato × questo coefficiente. Senza
// conoscerlo, il calcolo è arbitrario — per questo va CHIESTO/appreso, non
// assunto. Default 78% (servizi/professionisti), il più comune.
// Coefficienti ATECO: anche questi devono poter arrivare aggiornati. Sono la
// cosa che cambia più spesso dopo le aliquote (la tabella ATECO è stata
// riclassificata di recente), e sbagliarli sposta la base imponibile del
// 38% fra un professionista e un commerciante — l'errore più grosso possibile
// in questo modulo. `coefficienteAteco()` è il punto unico di lettura: la
// tabella qui sotto è il ripiego, le regole dell'anno hanno la precedenza.
export function coefficienteAteco(settore, { year = new Date().getFullYear(), rulesOverride = null } = {}) {
  const daRegole = rulesForYear(year, rulesOverride).atecoCoefficienti;
  const v = daRegole && daRegole[settore];
  if (v && Number.isFinite(v.coeff)) return { coeff: v.coeff, label: v.label || ATECO_COEFFICIENTI[settore]?.label || settore, fonte: 'aggiornata' };
  const loc = ATECO_COEFFICIENTI[settore];
  return loc ? { ...loc, fonte: 'inclusa nell\'app' } : null;
}

// I 9 gruppi ufficiali del forfettario (Legge 190/2014, Allegato 4, modificata
// dalla Legge 145/2018 — coefficienti invariati con la riclassificazione ATECO
// 2025/2026, verificato via ricerca web 2026-08-25 su più fonti indipendenti,
// es. calcoloforfettario.it). GAP REALE trovato e corretto in questa sessione:
// mancavano "industria alimentare" (40%) e "ambulante altri prodotti" (54%) —
// senza, chi rientra in queste due categorie finiva su "altre" (67%), un
// imponibile sballato di 27 punti percentuali. "Alloggio e ristorazione" era
// già numericamente corretto per coincidenza (stesso 40% di "commercio"), ma
// senza una categoria propria un domani un cambio al coefficiente commercio
// l'avrebbe rotto in silenzio — separata per chiarezza e robustezza.
export const ATECO_COEFFICIENTI = {
  professionisti: { coeff: 0.78, label: 'Professionisti / servizi (78%)' },
  commercio: { coeff: 0.40, label: 'Commercio ingrosso/dettaglio (40%)' },
  alimentari_industria: { coeff: 0.40, label: 'Industria alimentare e bevande (40%)' },
  alloggio_ristorazione: { coeff: 0.40, label: 'Alloggio e ristorazione (40%)' },
  ambulante_alimentari: { coeff: 0.40, label: 'Ambulante alimentari (40%)' },
  ambulante_altri: { coeff: 0.54, label: 'Ambulante altri prodotti (54%)' },
  intermediari: { coeff: 0.62, label: 'Intermediari del commercio (62%)' },
  costruzioni: { coeff: 0.86, label: 'Costruzioni / immobiliare (86%)' },
  altre: { coeff: 0.67, label: 'Altre attività (67%)' },
};

// Codici ATECO reali più comuni per chi apre una Partita IVA, ciascuno
// collegato a UNA delle categorie di ATECO_COEFFICIENTI già verificate sopra
// (mai un coefficiente nuovo non testato). Elenco parziale e illustrativo,
// non l'anagrafica ufficiale ISTAT: aiuta a orientarsi e a parlare la lingua
// giusta col commercialista, ma il codice esatto va sempre confermato sullo
// strumento ufficiale gratuito ateco.infocamere.it prima di aprire la P.IVA
// — link e avviso onesto ripetuti ovunque questo elenco viene mostrato.
// Ogni voce ha `kw`: sinonimi/parole reali che una persona userebbe per
// descrivere il proprio lavoro (mai gergo ATECO), per la ricerca libera.
export const ATECO_COMUNI = [
  { code: '62.01.00', label: 'Sviluppo software', categoria: 'altre', kw: 'programmatore sviluppatore app sito web coding developer' },
  { code: '62.02.00', label: 'Consulenza informatica', categoria: 'altre', kw: 'consulente it informatico sistemista' },
  { code: '62.09.00', label: 'Altri servizi informatici', categoria: 'altre', kw: 'assistenza computer riparazione pc informatica' },
  { code: '63.11.00', label: 'Gestione siti web e hosting', categoria: 'altre', kw: 'hosting server siti internet webmaster' },
  { code: '63.99.00', label: 'Informazione online e blog', categoria: 'altre', kw: 'blogger content creator influencer social media' },
  { code: '96.02.00', label: 'Parrucchiere / estetista', categoria: 'altre', kw: 'parrucchiera estetica bellezza acconciature trucco' },
  { code: '93.13.00', label: 'Personal trainer e istruttori', categoria: 'altre', kw: 'palestra fitness allenatore sport yoga pilates' },
  { code: '90.03.00', label: 'Creazioni artistiche', categoria: 'altre', kw: 'artista pittore scultore illustratore artigianato artistico' },
  { code: '69.10.00', label: 'Avvocato', categoria: 'professionisti', kw: 'avvocatessa legale studio legale' },
  { code: '70.22.00', label: 'Consulenza aziendale e coaching', categoria: 'professionisti', kw: 'business coach consulente manageriale formatore aziendale' },
  { code: '71.11.00', label: 'Architetto', categoria: 'professionisti', kw: 'architettura progettazione edifici interior design' },
  { code: '73.11.00', label: 'Agenzia pubblicitaria / marketing', categoria: 'professionisti', kw: 'pubblicità marketing comunicazione social media manager' },
  { code: '74.10.00', label: 'Graphic e web design', categoria: 'professionisti', kw: 'grafico designer logo brand ux ui webdesign' },
  { code: '74.20.00', label: 'Fotografo professionista', categoria: 'professionisti', kw: 'fotografia matrimoni servizi fotografici video' },
  { code: '74.30.00', label: 'Traduttore / interprete', categoria: 'professionisti', kw: 'traduzioni lingue interpretariato' },
  { code: '85.59.00', label: 'Formazione privata / ripetizioni', categoria: 'professionisti', kw: 'insegnante lezioni private tutor corsi formatore' },
  { code: '86.90.00', label: 'Medico, psicologo, fisioterapista', categoria: 'professionisti', kw: 'sanitario terapista dentista nutrizionista' },
  { code: '41.10.00', label: 'Impresa edile', categoria: 'costruzioni', kw: 'muratore edilizia costruzioni cantiere' },
  { code: '43.21.00', label: 'Impianti elettrici', categoria: 'costruzioni', kw: 'elettricista impianti elettrico' },
  { code: '43.22.00', label: 'Idraulica e termoidraulica', categoria: 'costruzioni', kw: 'idraulico caldaie riscaldamento tubature' },
  { code: '43.30.00', label: 'Piastrellista / imbianchino', categoria: 'costruzioni', kw: 'ristrutturazioni pittura pavimenti imbiancatura' },
  { code: '68.31.00', label: 'Agente immobiliare', categoria: 'costruzioni', kw: 'immobiliare case affitti vendite' },
  { code: '46.11.00', label: 'Agente di commercio', categoria: 'intermediari', kw: 'rappresentante agente vendita provvigioni' },
  { code: '46.19.00', label: 'Mediatore commerciale', categoria: 'intermediari', kw: 'intermediazione commissioni mediazione' },
  { code: '45.20.00', label: 'Officina e riparazione veicoli', categoria: 'commercio', kw: 'meccanico autofficina riparazioni auto moto' },
  { code: '47.11.00', label: 'Negozio al dettaglio', categoria: 'commercio', kw: 'negozio vendita prodotti bottega commerciante' },
  { code: '47.91.00', label: 'E-commerce / vendita online', categoria: 'commercio', kw: 'vendo online shop negozio internet dropshipping etsy' },
  { code: '56.10.00', label: 'Ristorante / pizzeria', categoria: 'alloggio_ristorazione', kw: 'ristorazione cucina pizza cuoco chef' },
  { code: '56.30.00', label: 'Bar / caffetteria', categoria: 'alloggio_ristorazione', kw: 'bar caffè caffetteria' },
  { code: '55.20.00', label: 'B&B / affittacamere', categoria: 'alloggio_ristorazione', kw: 'bed and breakfast affitti brevi turistici casa vacanze' },
  { code: '10.71.00', label: 'Panificio / pasticceria artigianale', categoria: 'alimentari_industria', kw: 'panetteria pasticcere forno pane dolci produzione artigianale' },
  { code: '11.05.00', label: 'Birrificio artigianale', categoria: 'alimentari_industria', kw: 'birra artigianale microbirrificio brewery' },
  { code: '10.89.00', label: 'Produzione alimentare artigianale', categoria: 'alimentari_industria', kw: 'conserve marmellate sottaceti produzione cibo artigianale gastronomia' },
  { code: '47.82.00', label: 'Ambulante abbigliamento / mercatini', categoria: 'ambulante_altri', kw: 'bancarella mercato ambulante vestiti abbigliamento non alimentare' },
  { code: '47.89.00', label: 'Ambulante altri prodotti', categoria: 'ambulante_altri', kw: 'bancarella mercato ambulante oggettistica artigianato hobbistica' },
];
export const ATECO_UFFICIALE_URL = 'https://ateco.infocamere.it';
// Ricerca libera in italiano: normalizza (minuscolo, accenti via, spazi) e
// cerca nel codice/etichetta/parole chiave. Nessuna corrispondenza esatta
// richiesta — "vendo vestiti" trova "e-commerce" tramite "vendo online".
function tl1Normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
export function searchAtecoComuni(query, limit = 6) {
  const q = tl1Normalize(query);
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = ATECO_COMUNI.map((entry) => {
    const hay = tl1Normalize(`${entry.label} ${entry.kw} ${entry.code}`);
    const hits = terms.filter((t) => hay.includes(t)).length;
    return { entry, hits };
  }).filter((s) => s.hits > 0);
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, limit).map((s) => s.entry);
}

// Professioni regolamentate (albo) con CASSA PREVIDENZIALE PROPRIA, elenco
// verificato — nomi reali, non aliquote inventate. Fatto di mercato reale e
// significativo, ignorato finché non lo si è verificato in questa sessione:
// chi è iscritto a una di queste casse è ESENTE dall'INPS Gestione Separata
// (le due sono incompatibili per legge) — applicare comunque l'INPS al
// 26,07% come faceva Momentum per TUTTI, in silenzio, era un errore reale
// per un'ampia fetta del mercato P.IVA (avvocati, commercialisti, ingegneri,
// architetti, medici e altre professioni ordinistiche).
export const CASSE_PROFESSIONALI = {
  avvocati: 'Cassa Forense', commercialisti: 'CNPADC', ragionieri: 'Cassa Ragionieri',
  geometri: 'Cassa Geometri', ingegneri_architetti: 'INARCASSA', consulenti_lavoro: 'ENPACL',
  medici_odontoiatri: 'ENPAM', veterinari: 'ENPAV', giornalisti: 'INPGI',
  periti_industriali: 'EPPI', psicologi: 'ENPAP', infermieri: 'ENPAPI', farmacisti: 'ENPAF',
  attuari_chimici_geologi: 'EPAP', biologi: 'ENPAB', agenti_rappresentanti: 'Enasarco',
  notai: 'Cassa Nazionale del Notariato',
};

// Regole REALI delle 3 casse più numerose (ADEPP 2025: Cassa Forense 217k
// iscritti attivi, Inarcassa 173k, CNPADC 74k — insieme ~480k professionisti
// che finora Momentum trattava con un contributo a zero e la nota "non lo
// calcoliamo"). Le altre 13 casse in CASSE_PROFESSIONALI restano SENZA
// regole: stesso comportamento onesto di sempre, mai un'aliquota indovinata
// per una cassa non verificata riga per riga.
// Fonti incrociate (agosto 2026), aliquote/minimi 2026:
//  - Cassa Forense: fiscoetasse.com, centrofiscale.com, tedeschiepartners.it
//  - Inarcassa: money.it, centrofiscale.com, taxmanapp.it
//  - CNPADC: cnpadc.it (sito ufficiale) — il contributo integrativo NON ha
//    un minimo confermato da fonte primaria (a differenza delle altre due):
//    qui si applica SOLO l'aliquota %, mai un minimo indovinato.
export const CASSE_CON_REGOLE = {
  avvocati: {
    nomeBreve: 'Cassa Forense',
    aliquotaSoggettivo: 0.17, sogliaAliquotaRidotta: 131800, aliquotaSoggettivoOltreSoglia: 0.03,
    minimoSoggettivo: 2790,
    aliquotaIntegrativo: 0.04, minimoIntegrativo: 355,
  },
  ingegneri_architetti: {
    nomeBreve: 'Inarcassa',
    aliquotaSoggettivo: 0.145, sogliaAliquotaRidotta: null, aliquotaSoggettivoOltreSoglia: 0,
    minimoSoggettivo: 2800,
    aliquotaIntegrativo: 0.04, minimoIntegrativo: 850,
  },
  commercialisti: {
    nomeBreve: 'CNPADC',
    // Aliquota BASE: CNPADC permette di versarne di più volontariamente
    // (12%-100%, per una pensione futura più alta) — qui si usa sempre la
    // base, mai una scelta volontaria che Momentum non può conoscere.
    aliquotaSoggettivo: 0.12, sogliaAliquotaRidotta: null, aliquotaSoggettivoOltreSoglia: 0,
    minimoSoggettivo: 3180,
    aliquotaIntegrativo: 0.04, minimoIntegrativo: null,
  },
};

// Contributi alla cassa professionale propria (contributo soggettivo +
// integrativo), SOLO per le 3 casse sopra. `redditoImponibile` = base per il
// soggettivo (stesso reddito su cui si calcolerebbe l'INPS); `fatturato` =
// base per l'integrativo (il volume d'affari IVA, non il reddito netto: è
// così che le casse lo calcolano davvero, mai approssimato sul reddito).
// Pura, testabile: nessun accesso a VaultDAO.
export function contributiCassaProfessionale(redditoImponibile, fatturato, cassaKey) {
  const regole = CASSE_CON_REGOLE[cassaKey];
  if (!regole) return null; // cassa non coperta — onestà, non un numero a caso
  const reddito = Math.max(0, redditoImponibile || 0);
  const entro = regole.sogliaAliquotaRidotta ? Math.min(reddito, regole.sogliaAliquotaRidotta) : reddito;
  const oltre = regole.sogliaAliquotaRidotta && reddito > regole.sogliaAliquotaRidotta
    ? (reddito - regole.sogliaAliquotaRidotta) * regole.aliquotaSoggettivoOltreSoglia : 0;
  const soggettivo = Math.max(entro * regole.aliquotaSoggettivo + oltre, regole.minimoSoggettivo);
  const integrativoCalcolato = Math.max(0, fatturato || 0) * regole.aliquotaIntegrativo;
  const integrativo = regole.minimoIntegrativo != null ? Math.max(integrativoCalcolato, regole.minimoIntegrativo) : integrativoCalcolato;
  return {
    nomeBreve: regole.nomeBreve,
    soggettivo: +soggettivo.toFixed(2),
    integrativo: +integrativo.toFixed(2),
    totale: +(soggettivo + integrativo).toFixed(2),
  };
}

// Tetto di ricavi per restare nel regime forfettario (Italia, 85.000€/anno).
// Superarlo obbliga al regime ordinario: è un'informazione predittiva reale
// e utile, non una previsione inventata.
export const FORFETTARIO_CEILING = 85000;

import { rulesForYear, computeIrpef } from './tax-rules.js';

// ── CONSIGLI FISCALI (come un commercialista, ma onesto) ──
// Genera consigli PRIORITIZZATI dalla situazione REALE dell'utente, con le
// regole dell'anno pertinente (tax-rules.js). Onestà (regola #1): suggerimenti
// su regole pubbliche, MAI consulenza personalizzata — il disclaimer "verifica
// col commercialista" resta sempre. input: { annualizedRevenue, invoicedYTD,
// currentSetAside, estimatedAnnualTax, regime, startupYearsLeft, year }
export function taxAdvice(input = {}) {
  const year = input.year || new Date().getFullYear();
  const rules = rulesForYear(year);
  const advice = [];
  const eur = (n) => `${Math.round(n).toLocaleString('it-IT')}€`;

  if (input.regime && input.regime.startsWith('forfettario') && input.annualizedRevenue > 0) {
    const pct = input.annualizedRevenue / rules.forfettarioCeiling;
    if (pct > 1) advice.push({ priority: 'high', icon: '⚠️', text: `A questo ritmo superi il tetto forfettario (${eur(rules.forfettarioCeiling)}): preparati al passaggio all'ordinario, dove cambiano IVA e aliquote.` });
    else if (pct >= 0.8) advice.push({ priority: 'medium', icon: '📊', text: `Sei al ${Math.round(pct * 100)}% del tetto forfettario (${eur(rules.forfettarioCeiling)}): tieni d'occhio il fatturato per non superarlo senza accorgertene.` });
  }

  if (input.estimatedAnnualTax > 0 && input.currentSetAside != null && input.annualizedRevenue > 0) {
    const dovutoOra = input.estimatedAnnualTax * Math.min(1, (input.invoicedYTD || 0) / input.annualizedRevenue);
    if (input.currentSetAside < dovutoOra * 0.9) {
      advice.push({ priority: 'high', icon: '🏦', text: `Per le tasse dovresti aver messo da parte ~${eur(dovutoOra)}: ne hai ${eur(input.currentSetAside)}. Accantona la differenza ora per non trovarti scoperto a fine anno.` });
    } else if (input.currentSetAside >= dovutoOra) {
      advice.push({ priority: 'info', icon: '✅', text: `Sei in pari con l'accantonamento tasse (~${eur(input.currentSetAside)}): ottimo, continua così.` });
    }
  }

  if (input.regime === 'forfettario_startup' && input.startupYearsLeft > 0) {
    advice.push({ priority: 'info', icon: '🚀', text: `Sei sull'aliquota startup al ${(rules.impostaStartup * 100).toFixed(0)}% (ti restano ~${input.startupYearsLeft} anni): dal termine sale al ${(rules.impostaStd * 100).toFixed(0)}%, mettine un po' di più da parte in vista di quel salto.` });
  }

  const rank = { high: 0, medium: 1, info: 2 };
  advice.sort((a, b) => rank[a.priority] - rank[b.priority]);
  return { advice, rulesYear: rules.year };
}

// Quanto accantonare da UN incasso lordo. Ritorna la scomposizione completa
// e tracciabile (mai un numero orfano).
// `amount` = importo incassato (imponibile per forfettario; per ordinario si
// assume amount = imponibile + IVA se `ivaInclusa`).
export function taxSetAside(amount, opts = {}) {
  const regimeKey = opts.regime || 'forfettario';
  const r = { ...REGIMI[regimeKey] || REGIMI.forfettario, ...opts.overrides };
  const gross = Math.max(0, amount || 0);
  if (gross === 0) return { setAside: 0, net: 0, breakdown: [], regime: r.label };

  // Chi ha una CASSA PREVIDENZIALE PROPRIA (albo professionale) è esente per
  // legge dall'INPS Gestione Separata: applicarlo comunque sarebbe un errore
  // reale, non solo una semplificazione. Non conosciamo l'aliquota della sua
  // cassa (varia per ente, spesso con un minimo fisso indipendente dal
  // reddito) — quindi NON la inventiamo: l'INPS si azzera qui, e lo si dice
  // sempre in chiaro nella scomposizione, mai in silenzio.
  const cassaNome = opts.cassaPropria ? (CASSE_PROFESSIONALI[opts.cassaPropria] || 'la tua cassa professionale') : null;

  // IVA (solo ordinario): quota da versare, separata dal reddito
  let iva = 0, imponibile = gross;
  if (r.iva > 0) {
    if (opts.ivaInclusa) { imponibile = gross / (1 + r.iva); iva = gross - imponibile; }
    else { iva = gross * r.iva; } // IVA aggiunta a parte
  }

  // Reddito imponibile su cui calcolare imposta + contributi
  const redditoImponibile = imponibile * r.coeffRedditivita;
  // Aliquota ridotta (24% invece di 26,07%) per chi è già coperto da
  // un'altra forma previdenziale obbligatoria — mai insieme a una cassa
  // propria (le due riduzioni sono alternative, non cumulabili: chi ha una
  // cassa propria non versa affatto alla Gestione Separata).
  // TERZO STRATO dello stesso difetto (trovato il 2026-08-07 verificando che
  // l'aggiornamento raggiungesse TUTTI i regimi, non solo il forfettario):
  // `inpsGestioneSeparata` esisteva fra le regole aggiornabili e NON entrava
  // in nessun calcolo — l'aliquota veniva sempre da REGIMI/costante locale.
  // Un aggiornamento dell'INPS non avrebbe cambiato un centesimo per nessuno.
  // Le regole hanno la precedenza; le costanti locali restano il ripiego per
  // un anno che non le dichiara.
  const rInps = rulesForYear(opts.year || new Date().getFullYear(), opts.rulesOverride);
  const inpsPiena = Number.isFinite(rInps.inpsGestioneSeparata) && regimeKey !== 'ordinario'
    ? rInps.inpsGestioneSeparata : r.inps;
  const inpsRidotta = Number.isFinite(rInps.inpsGestioneSeparataRidotta)
    ? rInps.inpsGestioneSeparataRidotta : INPS_GESTIONE_SEPARATA_RIDOTTA;
  const aliquotaInps = opts.altraCoperturaPrevidenziale ? inpsRidotta : inpsPiena;
  const inps = cassaNome ? 0 : redditoImponibile * aliquotaInps;
  // Cassa professionale REALE (2026-08-26): prima qui l'INPS si azzerava e
  // basta, "vai a calcolarlo altrove" — ora, per le 3 casse più numerose
  // (Cassa Forense/Inarcassa/CNPADC, vedi CASSE_CON_REGOLE sopra), il
  // contributo soggettivo+integrativo è calcolato per davvero, con le
  // stesse aliquote/minimi verificati. Per le altre 13 casse resta null:
  // stesso comportamento onesto di prima, mai un numero indovinato.
  const cassaCalcolo = opts.cassaPropria ? contributiCassaProfessionale(redditoImponibile, imponibile, opts.cassaPropria) : null;
  // Il soggettivo è deducibile dall'imponibile IRPEF, stesso trattamento
  // dell'INPS (sono entrambi contributi previdenziali obbligatori) —
  // l'integrativo NO: è in rivalsa sul cliente, un pass-through come l'IVA,
  // non un costo che riduce il reddito imponibile del professionista.
  const baseImposta = redditoImponibile - inps - (cassaCalcolo ? cassaCalcolo.soggettivo : 0);

  // Regime ordinario: usa gli scaglioni IRPEF REALI dell'anno se sono stati
  // verificati (tax-rules.js, computeIrpef — ogni fascia paga solo la sua
  // aliquota, mai l'intero imponibile alla fascia più alta), altrimenti
  // ripiega sulla stima piatta dichiarata come tale — MAI in silenzio: la
  // voce nello scomposizione dice sempre quale dei due calcoli è stato usato.
  // Anno/override: stesso meccanismo di rulesForYear (opts.year, opts.rulesOverride
  // per un aggiornamento già scaricato e verificato via fetchRulesUpdate).
  let imposta, impostaLabel;
  if (regimeKey === 'ordinario') {
    const year = opts.year || new Date().getFullYear();
    const scaglioni = rulesForYear(year, opts.rulesOverride).irpefScaglioni;
    if (scaglioni) {
      imposta = computeIrpef(baseImposta, scaglioni);
      impostaLabel = 'IRPEF (scaglioni reali)';
    } else {
      imposta = baseImposta * r.impostaSostitutiva;
      impostaLabel = 'IRPEF (stima piatta — scaglioni non ancora verificati per quest\'anno)';
    }
  } else {
    // FONTE UNICA per l'aliquota forfettaria. Difetto trovato il 2026-08-07:
    // la stessa aliquota viveva in DUE posti con lo stesso valore — `REGIMI`
    // qui (impostaSostitutiva: 0.15) e `TAX_RULES` in tax-rules.js
    // (impostaStd: 0.15) — e il calcolo usava REGIMI. Conseguenza: un
    // aggiornamento firmato che cambiava `impostaStd` non toccava il regime
    // forfettario, cioè la MAGGIORANZA degli utenti. Due fonti di verità per
    // lo stesso numero non restano d'accordo: restano d'accordo finché
    // nessuno le aggiorna, che è il momento in cui servirebbero.
    // Ora l'aliquota arriva dalle regole dell'anno; REGIMI resta il ripiego
    // per un anno che non ne dichiara una, e un override esplicito del
    // chiamante vince comunque su tutto.
    const year = opts.year || new Date().getFullYear();
    const daRegole = regimeKey === 'forfettario_startup'
      ? rulesForYear(year, opts.rulesOverride).impostaStartup
      : rulesForYear(year, opts.rulesOverride).impostaStd;
    const aliquota = (opts.overrides && opts.overrides.impostaSostitutiva != null)
      ? r.impostaSostitutiva
      : (Number.isFinite(daRegole) ? daRegole : r.impostaSostitutiva);
    imposta = baseImposta * aliquota;
    impostaLabel = aliquota <= 0.15 ? 'Imposta sostitutiva' : 'Imposta (stima)';
  }

  const setAside = +(iva + inps + imposta + (cassaCalcolo ? cassaCalcolo.totale : 0)).toFixed(2);
  const net = +(gross - setAside).toFixed(2);
  const breakdown = [
    ...(iva > 0 ? [{ voce: 'IVA da versare', importo: +iva.toFixed(2) }] : []),
    ...(cassaCalcolo
      ? [{ voce: `Contributo soggettivo (${cassaCalcolo.nomeBreve})`, importo: cassaCalcolo.soggettivo, nota: 'Deducibile dal reddito imponibile, come l\'INPS.' },
         { voce: `Contributo integrativo (${cassaCalcolo.nomeBreve})`, importo: cassaCalcolo.integrativo, nota: 'In rivalsa sul cliente, non deducibile — come l\'IVA.' }]
      : cassaNome
      ? [{ voce: `Contributi (${cassaNome}, non INPS)`, importo: 0, nota: `Sei iscritto a ${cassaNome}: i contributi vanno lì, non all'INPS Gestione Separata (le due sono incompatibili per legge). Momentum non conosce ancora le aliquote di questa cassa — quindi qui non le calcola: aggiungile tu o chiedi al commercialista.` }]
      : opts.altraCoperturaPrevidenziale
      ? [{ voce: 'Contributi INPS (aliquota ridotta 24%)', importo: +inps.toFixed(2), nota: 'Aliquota ridotta al 24% (invece del 26,07% pieno) perché sei già coperto da un\'altra forma previdenziale obbligatoria — verificato su circolare INPS n. 8 del 3 febbraio 2026.' }]
      : [{ voce: 'Contributi INPS', importo: +inps.toFixed(2) }]),
    { voce: impostaLabel, importo: +imposta.toFixed(2) },
  ];
  return { setAside, net, breakdown, regime: r.label, effectiveRate: +((setAside / gross) * 100).toFixed(1), cassaNome, cassaCalcolo };
}

// ── Classificazione INTELLIGENTE dell'entrata (fix "tasse messe a caso") ──
// Il problema reale: non ogni entrata è una FATTURA P.IVA. Uno stipendio è già
// tassato alla fonte; un rimborso/regalo/giroconto NON è reddito imponibile.
// Applicare l'accantonamento a TUTTE le entrate è arbitrario. Qui si inferisce
// dal testo (e da un flag esplicito se presente), con onestà: le entrate
// ambigue NON si assumono in silenzio, si marcano 'uncertain' così la UI può
// chiedere "è una fattura?". Regola #1: mai un numero spacciato per certo.
const INVOICE_KW = /(fattura|invoice|compenso|parcella|prestazione|onorario|notula|saldo\s?fatt|acconto\s?fatt|p\.?\s?iva|partita iva|corrispettiv|cliente|consulenz|consulting|freelance|collaborazione)/i;
const SALARY_KW = /(stipendio|cedolino|busta paga|emolument|salary|payroll|wage|tredicesima|quattordicesima|netto in busta|retribuzione)/i;
// Non imponibili come fattura P.IVA: rimborsi, regali, giroconti, interessi,
// dividendi, bonus bancari, prestiti (IT + EN per gli export Revolut).
const PERSONAL_KW = /(rimborso|refund|regalo|gift|restituzione|giroconto|storno|reversal|cashback|vincita|prestito|loan|bonifico da|transfer from|ricarica|top.?up|interess|interest|dividend|bonus)/i;

// Ritorna { kind: 'invoice'|'salary'|'personal'|'uncertain', reason }.
// Priorità: (1) flag esplicito dell'utente; (2) parole nella DESCRIZIONE (il
// segnale forte e specifico); (3) la categoria da sola NON basta — 'stipendio'
// è la categoria DI DEFAULT di Momentum per ogni entrata, quindi non informa:
// meglio 'uncertain' (da confermare) che un'etichetta sbagliata.
// `learned` = mappa APPRESA dalle correzioni dell'utente { tokenNormalizzato:
// kind }. È l'integrazione con l'auto-apprendimento: quando l'utente conferma
// "questa è una fattura" (o non lo è), Momentum lo ricorda per quel mittente
// e non lo richiede più — come l'orchestratore impara le categorie.
function incomeKey(description = '') {
  return String(description).toLowerCase().replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
// Token per l'apprendimento GENERALIZZANTE: parole "mittente" (studio, verdi,
// acme...) togliendo connettori, mesi e verbi bancari generici (che non
// identificano un mittente). Così una conferma su "Studio Verdi marzo" insegna
// i token studio/verdi e riconosce anche "Studio Verdi aprile" — cosa che la
// sola chiave esatta non fa. È un mini Naive-Bayes appreso online dalle conferme.
const INCOME_STOP = new Set([
  'bonifico', 'pagamento', 'pagam', 'accredito', 'ricevuto', 'ricevut', 'saldo', 'acconto', 'importo',
  'del', 'della', 'dei', 'delle', 'dal', 'dalla', 'per', 'con', 'una', 'uno', 'gli', 'lei', 'the', 'for',
  'from', 'payment', 'transfer', 'srl', 'spa', 'snc', 'sas', 'ditta',
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);
function tokenizeIncome(description = '') {
  return String(description).toLowerCase()
    .replace(/[^a-zàèéìòùç]+/gi, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !INCOME_STOP.has(t));
}
// Normalizza la memoria fiscale in { k:{chiaveEsatta:kind}, t:{token:{invoice,
// salary,personal}} }, MIGRANDO le vecchie mappe piatte { chiave:kind } già
// salvate nei vault degli utenti (retro-compatibilità totale).
const INCOME_KINDS = ['invoice', 'salary', 'personal'];
function normalizeLearned(learned) {
  if (!learned || typeof learned !== 'object') return { k: {}, t: {} };
  if (learned.k && typeof learned.k === 'object' && learned.t && typeof learned.t === 'object') return learned; // già nuovo formato
  const k = {}; // vecchia mappa piatta { chiave: kind } → migra in .k
  for (const [key, kind] of Object.entries(learned)) if (typeof kind === 'string' && INCOME_KINDS.includes(kind)) k[key] = kind;
  return { k, t: {} };
}
// Voto dei token appresi sulla descrizione: somma i conteggi per classe dei
// token riconosciuti; classifica solo con supporto e maggioranza netti (mai a
// bassa evidenza). Ritorna { kind, share, support } o null.
function tokenVote(t, description) {
  const agg = { invoice: 0, salary: 0, personal: 0 };
  let support = 0;
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = t[tok]; if (!c) continue;
    for (const k of INCOME_KINDS) { const n = +c[k] || 0; agg[k] += n; support += n; }
  }
  if (support < 2) return null;
  const winner = INCOME_KINDS.reduce((a, b) => agg[a] >= agg[b] ? a : b);
  const share = agg[winner] / support;
  return share >= 0.8 ? { kind: winner, share, support } : null;
}
// Segnale SOFT dei token (per la FUSIONE d'ensemble): come tokenVote ma con
// soglie più basse (supporto ≥1), usato solo per RAFFORZARE una predizione
// concorde del modello, mai per decidere da solo. strength ∈ [0,1] cresce con la
// nettezza (share) e il supporto (satura a 3 conferme). Onesto: evidenza debole
// resta debole.
function tokenLean(t, description) {
  const agg = { invoice: 0, salary: 0, personal: 0 };
  let support = 0;
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = t[tok]; if (!c) continue;
    for (const k of INCOME_KINDS) { const n = +c[k] || 0; agg[k] += n; support += n; }
  }
  if (support < 1) return null;
  const winner = INCOME_KINDS.reduce((a, b) => agg[a] >= agg[b] ? a : b);
  const share = agg[winner] / support;
  if (share < 0.6) return null;                     // ambiguo → nessuna spinta
  const strength = share * Math.min(1, support / 3);
  return { kind: winner, strength };
}
// Fusione probabilistica onesta di due evidenze concordi (noisy-OR): due segnali
// deboli ma d'accordo diventano una convinzione più forte; se discordano, non si
// fondono (l'ensemble si astiene, non inventa). Riusa il pattern già in uso
// nell'orchestratore per combinare esperti.
function fuseConfidence(a, b) { return 1 - (1 - a) * (1 - b); }
// `model` (opzionale) = classificatore fiscale ADDESTRATO (HashedLogReg,
// public/momentum_income_model.json) con .predict(text) → {category,
// confidence}. È un MODELLO NUOVO, stessa architettura del LogReg esperto,
// specializzato su fattura/stipendio/personale. Nell'ensemble entra DOPO le
// regole a parole-chiave (alta precisione, interpretabili) come segnale di
// GENERALIZZAZIONE (n-grammi di caratteri) sui casi che le regole non colgono.
export function classifyIncome(tx = {}, learned = null, model = null) {
  if (tx.taxable === true) return { kind: 'invoice', reason: 'marcata come fattura dall\'utente' };
  if (tx.taxable === false) return { kind: 'personal', reason: 'marcata come non imponibile dall\'utente' };
  const desc = String(tx.description || '').toLowerCase();
  if (learned) {
    const L = normalizeLearned(learned);
    const key = incomeKey(desc);
    // (a) corrispondenza ESATTA su una tua conferma → priorità massima.
    if (key && L.k[key]) return { kind: L.k[key], reason: 'appreso da una tua conferma precedente' };
    // (b) GENERALIZZAZIONE: i token appresi dai tuoi mittenti riconoscono anche
    // descrizioni nuove/simili (es. stesso cliente, mese diverso). Solo con
    // evidenza netta (supporto ≥2, maggioranza ≥80%): mai forzare.
    const v = tokenVote(L.t, desc);
    if (v) return { kind: v.kind, reason: 'appreso dai tuoi mittenti simili' };
  }
  if (INVOICE_KW.test(desc)) return { kind: 'invoice', reason: 'sembra una fattura/compenso P.IVA' };
  if (PERSONAL_KW.test(desc)) return { kind: 'personal', reason: 'sembra un rimborso/regalo/interessi/giroconto (non imponibile)' };
  if (SALARY_KW.test(desc)) return { kind: 'salary', reason: 'sembra uno stipendio (già tassato alla fonte)' };
  // Modello addestrato: usa la predizione solo se abbastanza sicuro (≥0.7),
  // altrimenti resta 'uncertain' (mai un'etichetta forzata a bassa confidenza).
  if (model && typeof model.predict === 'function' && desc) {
    try {
      const p = model.predict(desc);
      if (p && INCOME_KINDS.includes(p.category)) {
        // ENSEMBLE: fonde la confidenza del modello con il lean SOFT dei tuoi
        // token appresi, ma SOLO se concordi (stessa classe). Così un modello a
        // 0.6 + una tua conferma coerente supera la soglia (decisione fondata),
        // mentre evidenze discordi restano 'uncertain' (mai forzare). Il modello
        // da solo mantiene il comportamento (e la reason) di prima.
        let conf = p.confidence;
        const lean = learned ? tokenLean(normalizeLearned(learned).t, desc) : null;
        const concorde = lean && lean.kind === p.category;
        if (concorde) conf = fuseConfidence(p.confidence, lean.strength);
        if (conf >= 0.7) {
          return concorde
            ? { kind: p.category, reason: `modello e tue conferme concordi (${Math.round(conf * 100)}%)` }
            : { kind: p.category, reason: `modello fiscale addestrato (${Math.round(p.confidence * 100)}%)` };
        }
      }
    } catch (_) { /* modello assente/rotto: si continua col fallback onesto */ }
  }
  return { kind: 'uncertain', reason: 'origine non chiara: confermala tu (è una fattura?)' };
}

// Auto-apprendimento: registra la correzione dell'utente sul mittente. Ritorna
// la NUOVA mappa (immutabile). Da qui in poi entrate simili si classificano da
// sole. Integra le tasse nel loop di apprendimento di Momentum.
export function learnIncomeType(learned = {}, description, kind) {
  const key = incomeKey(description);
  if (!key || !INCOME_KINDS.includes(kind)) return learned; // no-op: forma invariata (retro-compat test)
  const L = normalizeLearned(learned);
  const k = { ...L.k, [key]: kind };                 // chiave esatta (come prima)
  const t = { ...L.t };                              // + token per la generalizzazione
  for (const tok of new Set(tokenizeIncome(description))) {
    const c = { ...(t[tok] || { invoice: 0, salary: 0, personal: 0 }) };
    c[kind] = (+c[kind] || 0) + 1;
    t[tok] = c;
  }
  return { k, t };
}

// ── ZERO CONFIGURAZIONE: dedurre il SETTORE ATECO dalle fatture, non chiederlo ──
// BUG REALE trovato testando (2026-08-05): ATECO_COEFFICIENTI esiste da
// sempre ma non era mai stato collegato — ogni forfettario veniva calcolato
// col coefficiente "professionisti" (78%) a prescindere dal settore reale,
// sovrastimando pesantemente l'accantonamento di chi fa commercio (40%) o
// altri settori. Qui si chiude il collegamento: si guardano le DESCRIZIONI
// delle fatture già presenti (stessa fonte di classifyIncome, mai un nuovo
// dato chiesto all'utente) e si cerca un segnale di settore. Onesto: senza
// un segnale netto (almeno 2 fatture concordi) resta 'professionisti' — lo
// stesso comportamento di sempre, mai un'inferenza forzata da un indizio solo.
const SETTORE_KW = {
  commercio: /(vendita|negozio|e-?commerce|\bshop\b|prodott|merce|articol)/i,
  costruzioni: /(edile|costruzion|ristrutturazion|muratore|cantiere|idraulic|elettricist|impiant)/i,
  intermediari: /(agenzia|intermediazion|commission|provvigion|rappresentant)/i,
  ambulante_alimentari: /(ambulante|banco\s?mercato|alimentari)/i,
};

export function inferAtecoSettore(transactions = [], opts = {}) {
  const { learned = null, model = null } = opts;
  const votes = {};
  let totalInvoices = 0;
  for (const t of transactions || []) {
    if (t.type !== 'entrata') continue;
    if (classifyIncome(t, learned, model).kind !== 'invoice') continue;
    totalInvoices++;
    const desc = String(t.description || '');
    for (const [settore, re] of Object.entries(SETTORE_KW)) {
      if (re.test(desc)) votes[settore] = (votes[settore] || 0) + 1;
    }
  }
  const fallback = { settore: 'professionisti', coeff: ATECO_COEFFICIENTI.professionisti.coeff, inferred: false };
  if (!totalInvoices) return { ...fallback, reason: 'nessuna fattura ancora: non c\'è abbastanza per dedurre il settore' };
  const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { ...fallback, reason: 'nessuna parola tipica di un settore diverso: uso il default più comune (professionisti/servizi)' };
  const [settore, count] = entries[0];
  // Richiede un segnale netto — mai un'inferenza forzata da un indizio solo,
  // stessa disciplina "n piccoli non bastano" usata ovunque nel progetto.
  if (count < 2) return { ...fallback, reason: 'segnale troppo debole per dedurre un settore diverso dal default' };
  return {
    settore, coeff: ATECO_COEFFICIENTI[settore].coeff, inferred: true,
    reason: `dedotto da ${count} fatture con parole tipiche di ${ATECO_COEFFICIENTI[settore].label.toLowerCase()}`,
  };
}

// Suggerisce il regime in base al fatturato ANNUO imponibile: sopra il tetto
// forfettario (85.000€) non si può stare nel forfettario → ordinario. Sotto,
// il forfettario è tipicamente più conveniente. Informazione reale, con caveat.
export function suggestRegime(annualInvoiced = 0) {
  if (annualInvoiced > FORFETTARIO_CEILING) {
    return { suggested: 'ordinario', reason: `Fatturato annuo ~${Math.round(annualInvoiced).toLocaleString('it-IT')}€ oltre il tetto forfettario (${FORFETTARIO_CEILING.toLocaleString('it-IT')}€): serve il regime ordinario.`, overCeiling: true };
  }
  const pct = Math.round((annualInvoiced / FORFETTARIO_CEILING) * 100);
  return { suggested: 'forfettario', reason: `Fatturato annuo ~${Math.round(annualInvoiced).toLocaleString('it-IT')}€ (${pct}% del tetto forfettario): il forfettario è di solito più conveniente. Verifica col commercialista.`, overCeiling: false, pctOfCeiling: pct };
}

// Proiezione fiscale annuale PREDITTIVA: dalle fatture dell'anno in corso
// annualizza il fatturato e stima le tasse di fine anno + avviso tetto. Onesto:
// è una proiezione lineare sul ritmo attuale, dichiarata tale, non una certezza.
export function projectAnnualTax(transactions = [], opts = {}) {
  const ref = opts.referenceDate || new Date();
  const learned = opts.learned || null;
  const model = opts.model || null;
  const year = ref.getFullYear();
  let invoicedYTD = 0;
  for (const t of transactions) {
    if (t.type !== 'entrata') continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year) continue;
    if (classifyIncome(t, learned, model).kind === 'invoice') invoicedYTD += t.amount;
  }
  // mesi trascorsi = mesi pieni prima del corrente + frazione del mese corrente
  // (giorno / giorni-del-mese). Più accurato del +1 fisso.
  const daysInMonth = new Date(year, ref.getMonth() + 1, 0).getDate();
  const monthsElapsed = ref.getMonth() + (ref.getDate() / daysInMonth);
  const annualized = monthsElapsed > 0 ? invoicedYTD * (12 / monthsElapsed) : 0;
  const regime = opts.regime || 'forfettario';
  const taxOnAnnual = taxSetAside(annualized, { regime, overrides: opts.overrides }).setAside;
  const suggestion = suggestRegime(annualized);
  return {
    invoicedYTD: +invoicedYTD.toFixed(2),
    annualizedRevenue: +annualized.toFixed(2),
    estimatedAnnualTax: +taxOnAnnual.toFixed(2),
    monthsElapsed: +monthsElapsed.toFixed(1),
    regimeSuggestion: suggestion,
    note: invoicedYTD > 0
      ? `A questo ritmo fatturi ~${Math.round(annualized).toLocaleString('it-IT')}€ nel ${year}: metti da parte ~${Math.round(taxOnAnnual).toLocaleString('it-IT')}€ di tasse totali (proiezione lineare, non una certezza).`
      : `Nessuna fattura nel ${year}: nessuna proiezione fiscale.`,
  };
}

// Totale da accantonare su un periodo — SOLO sulle entrate imponibili
// (fatture P.IVA). Stipendi e movimenti personali sono ESCLUSI e riportati a
// parte. Le entrate ambigue ('uncertain') sono prudenzialmente conteggiate ma
// segnalate (uncertainCount) così la UI può chiedere conferma con un tap.
// DEFAULT PRUDENTE (fix "tasse messe a caso"): si tassano SOLO le fatture
// chiare; le entrate ambigue NON si tassano d'ufficio (sarebbe di nuovo
// arbitrario) — si segnalano perché l'utente le confermi. opts.taxUncertain=true
// per la modalità cautelativa (accantona anche sull'incerto).
export function taxSetAsideForPeriod(transactions, opts = {}) {
  const taxUncertain = opts.taxUncertain === true;
  const learned = opts.learned || null;
  const model = opts.model || null;
  const entrate = (transactions || []).filter(t => t.type === 'entrata');
  let taxableGross = 0, totalSet = 0, excludedGross = 0, uncertainGross = 0;
  let taxableCount = 0, excludedCount = 0, uncertainCount = 0;
  const uncertain = [];
  for (const t of entrate) {
    const { kind } = classifyIncome(t, learned, model);
    const isTaxable = kind === 'invoice' || (kind === 'uncertain' && taxUncertain);
    if (kind === 'uncertain') { uncertainGross += t.amount; uncertainCount++; uncertain.push(t); }
    if (isTaxable) {
      taxableGross += t.amount;
      totalSet += taxSetAside(t.amount, opts).setAside;
      taxableCount++;
    } else if (kind !== 'uncertain') {
      excludedGross += t.amount; excludedCount++;
    }
  }
  const excludedTxt = excludedCount ? ` (${excludedCount} entrate non imponibili escluse: stipendio/rimborsi ~${excludedGross.toFixed(0)}€)` : '';
  const uncertainTxt = uncertainCount ? ` ${uncertainCount} entrata${uncertainCount > 1 ? 'e' : ''} da confermare (fattura?).` : '';
  return {
    incassato: +taxableGross.toFixed(2),
    daAccantonare: +totalSet.toFixed(2),
    disponibileReale: +(taxableGross - totalSet).toFixed(2),
    count: taxableCount,
    excludedGross: +excludedGross.toFixed(2), excludedCount,
    uncertainGross: +uncertainGross.toFixed(2), uncertainCount, uncertain,
    note: taxableCount
      ? `Su ${taxableCount} fattur${taxableCount > 1 ? 'e' : 'a'} (${taxableGross.toFixed(0)}€) metti da parte ~${totalSet.toFixed(0)}€ per il fisco: il "vero" disponibile è ${(taxableGross - totalSet).toFixed(0)}€${excludedTxt}.${uncertainTxt}`
      : (excludedCount || uncertainCount ? `Nessuna fattura imponibile qui${excludedTxt}.${uncertainTxt}` : 'Nessun incasso registrato in questo periodo.'),
  };
}

// ── LIVELLO 0/1 — SIMULATORE PER CHI NON HA ANCORA LA PARTITA IVA ──
// Il buco di mercato che nessun portale copre: chi sta VALUTANDO se aprirla
// non trova mai "se fatturi X, ti resta Y" prima di decidere. Riusa
// suggestRegime + taxSetAside (stessa aritmetica di chi la P.IVA ce l'ha già,
// mai una seconda formula inventata). L'avviso sul PRIMO ANNO è il punto che
// affonda più nuove partite IVA (verificato: gli acconti fanno pagare il
// secondo anno quasi il doppio) — dichiarato qui, non nascosto.
export function simulateNewPartitaIva(annualInvoiced = 0, opts = {}) {
  const fatturato = Math.max(0, +annualInvoiced || 0);
  if (fatturato <= 0) {
    return { fatturato: 0, regime: null, setAside: 0, netAnnuo: 0, netMensile: 0, primoAnnoNote: null, note: 'Inserisci quanto pensi di fatturare in un anno per vedere una stima.' };
  }
  const suggestion = suggestRegime(fatturato);
  const regimeKey = suggestion.overCeiling ? 'ordinario' : (opts.startup ? 'forfettario_startup' : 'forfettario');
  // Il coefficiente di redditività dipende dal settore ATECO (tabella già
  // verificata in ATECO_COEFFICIENTI): un commerciante paga su una base
  // imponibile molto più bassa (40%) di un professionista (78%) — ignorarlo
  // renderebbe la stima sbagliata proprio per chi fa commercio.
  const atecoInfo = regimeKey.startsWith('forfettario') && opts.ateco
    ? coefficienteAteco(opts.ateco, { year: opts.year, rulesOverride: opts.rulesOverride }) : null;
  const atecoCoeff = atecoInfo ? { coeffRedditivita: atecoInfo.coeff } : null;
  const { setAside, net, cassaNome, cassaCalcolo } = taxSetAside(fatturato, { regime: regimeKey, cassaPropria: opts.cassaPropria, altraCoperturaPrevidenziale: opts.altraCoperturaPrevidenziale, overrides: { ...atecoCoeff, ...opts.overrides } });
  const netMensile = net / 12;
  // Strategie legittime, non trucchi: entrambe verificate su fonte ufficiale
  // (Agenzia delle Entrate), mai un'ottimizzazione inventata. L'eleggibilità
  // reale (storia lavorativa dell'utente) non è verificabile da qui — per
  // questo sono poste come DOMANDE da fare al commercialista, non come fatti.
  const strategie = [];
  if (!suggestion.overCeiling && regimeKey === 'forfettario') {
    // Non un avviso generico: il NUMERO vero della differenza, calcolato con
    // la stessa aritmetica (taxSetAside), non un fattore "circa la metà"
    // buttato lì. Così si vede subito perché vale la pena chiederlo.
    const startupCalc = taxSetAside(fatturato, { regime: 'forfettario_startup', cassaPropria: opts.cassaPropria, altraCoperturaPrevidenziale: opts.altraCoperturaPrevidenziale, overrides: { ...atecoCoeff, ...opts.overrides } });
    const nettoStartupMensile = startupCalc.net / 12;
    strategie.push({
      icon: 'startup',
      testo: `Se è la tua PRIMA attività (nessuna attività analoga negli ultimi 3 anni, e non la semplice prosecuzione di un lavoro dipendente) potresti avere diritto all'aliquota startup al 5% invece del 15% per i primi 5 anni: ti resterebbero ~${Math.round(nettoStartupMensile).toLocaleString('it-IT')}€/mese invece di ~${Math.round(netMensile).toLocaleString('it-IT')}€/mese. Chiedilo al commercialista prima di aprire la Partita IVA.`,
    });
  }
  if (!suggestion.overCeiling && suggestion.pctOfCeiling >= 70) {
    strategie.push({
      icon: 'timing',
      testo: `Sei già al ${suggestion.pctOfCeiling}% del tetto forfettario da fermo: se ti avvicini ulteriormente, valuta con chi ti paga di spostare gli incassi di fine anno a gennaio — nel forfettario conta quando INCASSI, non quando fatturi.`,
    });
  }
  // Cassa previdenziale propria (albo professionale): l'INPS non c'entra.
  // Per le 3 casse più numerose (CASSE_CON_REGOLE) il numero sopra include
  // GIÀ il contributo reale (soggettivo+integrativo, aliquote 2026
  // verificate) — per le altre 13, resta escluso e va detto chiaramente,
  // mai lasciato intuire da un totale più basso del previsto.
  if (cassaNome) {
    strategie.push({
      icon: 'cassa',
      testo: cassaCalcolo
        ? `Sei iscritto a ${cassaNome}: il numero sopra include già il contributo soggettivo (${Math.round(cassaCalcolo.soggettivo).toLocaleString('it-IT')}€) e quello integrativo (${Math.round(cassaCalcolo.integrativo).toLocaleString('it-IT')}€), con le aliquote 2026 verificate — non l'INPS, che per te non si applica.`
        : `Sei iscritto a ${cassaNome}: i contributi previdenziali vanno lì, non all'INPS — per questo il numero sopra NON li include. Aggiungi tu l'importo della tua cassa (spesso ha un minimo fisso, indipendente dal reddito) per avere la cifra vera.`,
    });
  }
  // Dipendente che apre ANCHE la Partita IVA (nessuna cassa propria, quindi
  // rientra comunque nella Gestione Separata): aliquota INPS ridotta al 24%
  // (invece del 26,07% pieno) per chi è GIÀ coperto da un'altra forma
  // previdenziale obbligatoria — LACUNA COLMATA (2026-08-06): prima non era
  // verificabile e restava solo una domanda; ora è già applicata nel numero
  // qui sopra (taxSetAside la usa automaticamente con questo stesso flag).
  if (!cassaNome && opts.altraCoperturaPrevidenziale && regimeKey.startsWith('forfettario')) {
    strategie.push({
      icon: 'dipendente',
      testo: `Lavori già come dipendente (o hai un'altra copertura previdenziale obbligatoria): il numero qui sopra usa già l'aliquota INPS ridotta al 24% invece del 26,07% pieno — la differenza è reale, verificata sulla circolare INPS n. 8 del 3 febbraio 2026, non serve chiederla al commercialista.`,
    });
  }
  return {
    fatturato,
    regime: regimeKey,
    regimeLabel: REGIMI[regimeKey].label,
    atecoLabel: atecoCoeff ? ATECO_COEFFICIENTI[opts.ateco].label : null,
    cassaNome,
    cassaCalcolo,
    suggestion,
    strategie,
    setAside: +setAside.toFixed(2),
    netAnnuo: +net.toFixed(2),
    netMensile: +netMensile.toFixed(2),
    // Il primo anno di attività si versa MENO (nessun acconto sull'anno
    // precedente, che non esiste ancora): dal secondo anno si aggiunge il
    // saldo dell'anno appena chiuso + l'acconto sul nuovo, quindi si paga
    // quasi il doppio. È la sorpresa di cassa che affonda più aperture nuove.
    primoAnnoNote: `Il primo anno verserai solo il dovuto sul primo anno (~${Math.round(setAside).toLocaleString('it-IT')}€). Dal SECONDO anno si aggiunge anche l'acconto sull'anno nuovo: ti aspetta un versamento quasi doppio — mettilo in conto da subito, non a sorpresa.`,
    note: `Fatturando ~${Math.round(fatturato).toLocaleString('it-IT')}€/anno, con ${REGIMI[regimeKey].label.toLowerCase()} ti resterebbero in tasca circa ${Math.round(net).toLocaleString('it-IT')}€/anno (~${Math.round(netMensile).toLocaleString('it-IT')}€/mese) dopo tasse e contributi.`,
  };
}

// ==========================================
// FATTURA da UNA RIGA (NL) — stessa filosofia anti-attrito della voce
// ==========================================
// "fattura a Rossi Srl 500 per consulenza" · "500 a Mario Rossi per sito web" ·
// "emetti 1200 a Studio Bianchi per progetto". Estrae cliente, importo e causale
// da testo libero. ONESTO: senza un importo ritorna null (una fattura senza
// importo non esiste); il cliente può mancare (lo chiede la UI) ma se c'è lo
// riconosce. Pura e testabile — il DOM sta in main.js.
export function parseInvoiceLine(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const amtMatch = raw.replace(/€/g, ' ').match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!amtMatch) return null;
  const amount = Math.round(parseFloat(amtMatch[1].replace(',', '.')) * 100) / 100;
  if (!(amount > 0)) return null;

  let rest = raw.replace(amtMatch[0], ' ');
  // Causale: tutto ciò che segue "per".
  let description = '';
  const per = rest.match(/\bper\s+(.+)$/i);
  if (per) { description = per[1].trim(); rest = rest.slice(0, per.index); }

  // Cliente: dopo "a/al/alla/all'/cliente/ditta/fattura a", togliendo i verbi di
  // comando iniziali. Ciò che resta, ripulito, è il nome (anche multi-parola,
  // "Rossi Srl", "Mario Rossi"). Le preposizioni/connettivi di servizio via.
  let client = rest
    .replace(/\b(fattura|fatturare|emetti|emettere|crea|creare|nuova|una)\b/gi, ' ')
    .replace(/\b(a|al|allo|alla|all'|ai|agli|alle|il|lo|la|di|del|della|cliente|ditta|per)\b/gi, ' ')
    .replace(/[^\wàèéìòùÀÈÉÌÒÙ&.\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Capitalizza ogni parola del nome (Srl/SpA restano leggibili comunque).
  client = client.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return { client, amount, description };
}
