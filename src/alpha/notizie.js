// ============================================================
// LE NOTIZIE — solo fonti ufficiali, e misurate prima di crederci
// ============================================================
// Avevo lasciato aperto il problema delle notizie perché non trovavo una fonte
// con una licenza pulita: gli aggregatori vietano la ridistribuzione, e
// costruirci sopra un prodotto è il genere di dipendenza che in una due
// diligence fa alzare un sopracciglio. La via d'uscita non era trovare un
// aggregatore più permissivo: era saltarli.
//
// **Le notizie che contano davvero per i mercati le pubblicano gli emittenti
// stessi.** La Fed pubblica i propri comunicati, la BCE i propri, il Federal
// Register gli atti, la SEC i depositi delle società. Sono le fonti PRIMARIE
// di cui i giornali scrivono il riassunto, escono prima, non hanno filtro
// editoriale, e — nel caso americano — sono in dominio pubblico perché
// prodotte da enti federali. Meglio della notizia: la cosa di cui la notizia
// parla.
//
// IL RISCHIO DA GESTIRE, e non è teorico. Un titolo è testo scritto da altri:
// va trattato come DATO, mai come istruzione. Se un comunicato contenesse una
// frase che sembra un ordine, questo modulo non deve eseguirla e il QA non
// deve ripeterla come propria. Qui dentro i testi esterni vengono solo
// ripuliti, accorciati e mostrati con la loro fonte accanto — mai interpretati
// come indicazioni operative.
//
// E LA PARTE CHE RENDE QUESTO MODULO DIVERSO DA UN LETTORE DI FEED: prima di
// dare peso agli annunci, si misura se ne hanno. `reazioneAllaFed` confronta
// quello che i mercati hanno fatto nei giorni in cui la Fed ha davvero mosso i
// tassi con quello che fanno in un giorno qualunque. Se non c'è differenza,
// la risposta lo dice, e mostrare quei titoli diventa cronaca, non segnale.
'use strict';

import { DATE_GIORNI, GIORNALIERO, NOMI_GIORNALIERI } from './daily-panel.js';

// ── Le fonti, con la licenza attaccata ──
// L'ordine è quello di preferenza: prima le più pulite dal punto di vista dei
// diritti, non le più comode.
export const FONTI_NOTIZIE = [
  {
    chiave: 'fed', nome: 'Federal Reserve — comunicati di politica monetaria',
    url: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
    formato: 'rss', lingua: 'en',
    licenza: 'ente federale USA: i contenuti non sono soggetti a copyright',
    pulita: true,
  },
  {
    chiave: 'fedTutti', nome: 'Federal Reserve — tutti i comunicati',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    formato: 'rss', lingua: 'en',
    licenza: 'ente federale USA: i contenuti non sono soggetti a copyright',
    pulita: true,
  },
  {
    chiave: 'bce', nome: 'Banca centrale europea — comunicati stampa',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    formato: 'rss', lingua: 'en',
    licenza: 'riproduzione permessa citando la fonte',
    pulita: true,
  },
  {
    chiave: 'federalRegister', nome: 'Federal Register — atti normativi USA',
    // FILTRATO PER ENTE, e non e' un dettaglio: senza filtro il Federal
    // Register pubblica centinaia di atti al giorno e la lista si riempiva di
    // spazi aerei del Texas e licenze televisive del Nevada. Veri, pubblici, e
    // completamente inutili qui. Si tengono solo gli enti che muovono i
    // mercati: Tesoro, SEC, Fed, CFTC.
    url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest'
      + '&conditions[agencies][]=treasury-department&conditions[agencies][]=securities-and-exchange-commission'
      + '&conditions[agencies][]=federal-reserve-system&conditions[agencies][]=commodity-futures-trading-commission'
      + '&fields[]=title&fields[]=publication_date&fields[]=html_url&fields[]=agencies',
    formato: 'json-fr', lingua: 'en',
    licenza: 'dominio pubblico: gli atti del governo federale non sono soggetti a copyright',
    pulita: true,
  },
];

// La SEC richiede che chi interroga si identifichi: è una condizione d'uso
// esplicita, e rispettarla è il minimo per poterci costruire sopra.
export const INTESTAZIONI = { 'User-Agent': 'Momentum PWA (contatto nel manifest)' };

// ── I lettori, uno per formato, difensivi ──
// Niente DOMParser: questo codice deve girare uguale nel browser e nei test.
// E niente fiducia: un feed malformato deve dare una lista vuota, non
// un'eccezione che porta giù la schermata.
const pulisci = (s) => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export function leggiRss(testo) {
  if (typeof testo !== 'string' || !testo.includes('<')) return [];
  const voci = [];
  // <item> per RSS, <entry> per Atom: si accettano entrambi senza chiedere.
  for (const m of testo.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)) {
    const b = m[0];
    const titolo = pulisci(b.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]);
    // La data va ripulita come il titolo: nel feed della Fed e' dentro un
    // CDATA, e passarla grezza a `new Date` dava sempre null. Le date sparite
    // in silenzio sono il tipo di bug che nessuno nota finche' non ordina
    // qualcosa per data.
    const data = pulisci(b.match(/<(pubDate|updated|published|dc:date)[^>]*>([\s\S]*?)<\/\1>/)?.[2]);
    const link = pulisci(b.match(/<link[^>]*href="([^"]+)"/)?.[1] || b.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]);
    if (!titolo) continue;
    voci.push({ titolo, data: normalizzaData(data), link: link || null });
  }
  return voci;
}

export function leggiFederalRegister(testo) {
  try {
    const j = typeof testo === 'string' ? JSON.parse(testo) : testo;
    if (!Array.isArray(j?.results)) return [];
    return j.results.filter((r) => r?.title).map((r) => ({
      titolo: pulisci(r.title),
      data: normalizzaData(r.publication_date),
      link: r.html_url || null,
      ente: Array.isArray(r.agencies) ? r.agencies.map((a) => a?.name).filter(Boolean).join(', ') : null,
    }));
  } catch (_) { return []; }
}

function normalizzaData(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function leggi(formato, testo) {
  if (formato === 'json-fr') return leggiFederalRegister(testo);
  return leggiRss(testo);
}

// ── Il recupero, con ricaduta e senza mai bloccare ──
// Se la rete non c'è — ed è la condizione normale per un'app che funziona
// offline — non succede niente di male: si restituisce quello che si ha.
export async function prendiNotizie({ fonti = FONTI_NOTIZIE, quante = 8, timeoutMs = 6000, fetchImpl = null } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return { voci: [], fonti: [], errore: 'nessun modo di andare in rete in questo ambiente' };
  const usate = [], voci = [];
  for (const fonte of fonti) {
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      const r = await f(fonte.url, { headers: INTESTAZIONI, signal: ctrl?.signal });
      if (t) clearTimeout(t);
      if (!r?.ok) continue;
      const testo = await r.text();
      const lette = leggi(fonte.formato, testo);
      if (!lette.length) continue;
      usate.push({ chiave: fonte.chiave, nome: fonte.nome, licenza: fonte.licenza, voci: lette.length });
      // La fonte resta attaccata a ogni voce: senza, fra un mese nessuno sa
      // piu' da dove venga una riga.
      for (const v of lette) voci.push({ ...v, fonte: fonte.chiave, nomeFonte: fonte.nome, licenza: fonte.licenza });
    } catch (_) { /* una fonte che non risponde non e' un errore: e' il caso normale */ }
  }
  // ORDINARE PER DATA SEMBRAVA OVVIO ED ERA SBAGLIATO. Il Federal Register
  // pubblica decine di atti ogni giorno, le banche centrali parlano ogni
  // qualche settimana: ordinando per data la lista diventava un elenco di
  // adempimenti amministrativi con le decisioni sui tassi sepolte sotto. Prima
  // viene il RILIEVO della fonte, poi la data — ed e' una scelta editoriale,
  // quindi e' giusto che sia scritta invece di emergere da un dettaglio
  // tecnico. Con un tetto per fonte, cosi' nessuna puo' occupare tutta la
  // lista solo perche' pubblica di piu'.
  const rilievo = { fed: 0, bce: 1, fedTutti: 2, federalRegister: 3 };
  const tetto = { federalRegister: 3, fedTutti: 2 };
  voci.sort((a, b) => ((rilievo[a.fonte] ?? 9) - (rilievo[b.fonte] ?? 9))
    || (b.data || '').localeCompare(a.data || ''));
  const contati = {};
  const scelte = [];
  const visti = new Set();
  for (const v of voci) {
    // Lo stesso comunicato compare sia nel feed monetario sia in quello
    // generale: senza questo controllo la lista mostrerebbe doppioni.
    const impronta = `${v.data}|${v.titolo}`;
    if (visti.has(impronta)) continue;
    contati[v.fonte] = (contati[v.fonte] || 0) + 1;
    if (tetto[v.fonte] && contati[v.fonte] > tetto[v.fonte]) continue;
    visti.add(impronta);
    scelte.push(v);
    if (scelte.length >= quante) break;
  }
  return { voci: scelte, fonti: usate, errore: usate.length ? null : 'nessuna fonte ha risposto' };
}

// ============================================================
// I GIORNI IN CUI LA FED HA MOSSO DAVVERO
// ============================================================
// Le date in cui il tasso obiettivo della Fed è effettivamente cambiato,
// ricavate una volta dalla serie DFEDTARU. Non le riunioni: i movimenti. Una
// riunione che lascia tutto com'è è una notizia, ma non è un fatto misurabile
// sui prezzi allo stesso modo.
//
// ATTENZIONE ALLA DATA, ed è una sottigliezza che cambia il risultato: qui
// c'è il giorno in cui il nuovo tasso ENTRA IN VIGORE, che è il giorno dopo
// l'annuncio. Il mercato reagisce all'annuncio. Per questo la finestra parte
// da −1 e non da 0: guardare solo il giorno di efficacia significherebbe
// misurare il giorno DOPO la notizia e concludere che non è successo niente.
export const MOSSE_FED = [
  { efficace: '2022-03-17', da: 0.25, a: 0.5 }, { efficace: '2022-05-05', da: 0.5, a: 1 },
  { efficace: '2022-06-16', da: 1, a: 1.75 }, { efficace: '2022-07-28', da: 1.75, a: 2.5 },
  { efficace: '2022-09-22', da: 2.5, a: 3.25 }, { efficace: '2022-11-03', da: 3.25, a: 4 },
  { efficace: '2022-12-15', da: 4, a: 4.5 }, { efficace: '2023-02-02', da: 4.5, a: 4.75 },
  { efficace: '2023-03-23', da: 4.75, a: 5 }, { efficace: '2023-05-04', da: 5, a: 5.25 },
  { efficace: '2023-07-27', da: 5.25, a: 5.5 }, { efficace: '2024-09-19', da: 5.5, a: 5 },
  { efficace: '2024-11-08', da: 5, a: 4.75 }, { efficace: '2024-12-19', da: 4.75, a: 4.5 },
  { efficace: '2025-09-18', da: 4.5, a: 4.25 }, { efficace: '2025-10-30', da: 4.25, a: 4 },
  { efficace: '2025-12-11', da: 4, a: 3.75 },
];
export const MOSSE_FED_FONTE = 'Federal Reserve, tasso obiettivo (DFEDTARU) via FRED — dominio pubblico';

// TRAPPOLA IN CUI SONO CADUTO, e vale la pena lasciarla scritta: il pannello
// giornaliero contiene gia' i RENDIMENTI, non i prezzi. Trattandolo come
// prezzi e dividendo un giorno per il precedente calcolavo la variazione della
// variazione, e uscivano ampiezze del 300% al giorno. Un numero assurdo si
// nota; uno solo un po' sbagliato no — ed e' il motivo per cui vale la pena
// guardare sempre l'ordine di grandezza di quello che esce.
// Il VIX e' l'eccezione dichiarata dal pannello stesso: quello e' un livello,
// e li' la variazione va calcolata davvero.
const variazioniGiornaliere = (chiave) => {
  const v = GIORNALIERO[chiave];
  if (!v) return null;
  if (chiave !== 'vix') return v.slice();
  return v.map((x, i) => (i === 0 || x === null || v[i - 1] === null || v[i - 1] <= 0 ? null : x / v[i - 1] - 1));
};

// ── LA MISURA: i giorni della Fed sono diversi dagli altri? ──
export function reazioneAllaFed(mercato = 'azioniUsa', { finestra = 1 } = {}) {
  const var_ = variazioniGiornaliere(mercato);
  if (!var_) return { valido: false, motivo: `mercato sconosciuto: ${mercato}` };

  const indiceDi = new Map(DATE_GIORNI.map((d, i) => [d, i]));
  const dellaFed = new Set();
  const eventi = [];
  for (const m of MOSSE_FED) {
    let i = indiceDi.get(m.efficace);
    // Se il giorno di efficacia non è di borsa (weekend o festivo), si prende
    // il primo giorno utile successivo. `findIndex` restituisce -1 quando non
    // ne trova: va escluso esplicitamente, altrimenti diventa un indice valido
    // contato dalla fine.
    if (i === undefined) { const k = DATE_GIORNI.findIndex((d) => d >= m.efficace); i = k >= 0 ? k : undefined; }
    if (i === undefined || i < 1) continue;
    const finestraIdx = [];
    for (let k = i - finestra; k <= i; k++) if (k >= 0 && var_[k] !== null) { finestraIdx.push(k); dellaFed.add(k); }
    if (!finestraIdx.length) continue;
    // Il movimento della finestra: si compone, non si somma.
    const mov = finestraIdx.reduce((acc, k) => acc * (1 + var_[k]), 1) - 1;
    eventi.push({ data: m.efficace, verso: m.a > m.da ? 'rialzo' : 'taglio', movimento: +mov.toFixed(4) });
  }
  if (eventi.length < 5) return { valido: false, motivo: `solo ${eventi.length} mosse dentro l'archivio giornaliero` };

  const altri = [];
  for (let i = 0; i < var_.length; i++) if (!dellaFed.has(i) && var_[i] !== null) altri.push(var_[i]);
  const ampiezzaFed = eventi.reduce((s, e) => s + Math.abs(e.movimento), 0) / eventi.length;
  const ampiezzaAltri = altri.reduce((s, x) => s + Math.abs(x), 0) / altri.length;
  // L'errore standard dell'ampiezza nei giorni Fed: senza, "più grande" non
  // vuol dire niente con diciassette osservazioni.
  const sd = Math.sqrt(eventi.reduce((s, e) => s + (Math.abs(e.movimento) - ampiezzaFed) ** 2, 0) / Math.max(1, eventi.length - 1));
  const errore = sd / Math.sqrt(eventi.length);
  const rialzi = eventi.filter((e) => e.verso === 'rialzo');
  const tagli = eventi.filter((e) => e.verso === 'taglio');
  const med = (a) => (a.length ? a.reduce((s, e) => s + e.movimento, 0) / a.length : null);

  return {
    valido: true, mercato, nome: NOMI_GIORNALIERI[mercato], finestraGiorni: finestra + 1,
    mosse: eventi.length, giorniNormali: altri.length,
    ampiezzaMediaNeiGiorniFed: +ampiezzaFed.toFixed(4),
    ampiezzaMediaNegliAltriGiorni: +ampiezzaAltri.toFixed(4),
    errore: +errore.toFixed(4),
    // Sono davvero giorni diversi, o solo giorni?
    giorniDiversi: ampiezzaFed - ampiezzaAltri > 2 * errore,
    quandoAlzaITassi: rialzi.length ? { casi: rialzi.length, movimentoMedio: +med(rialzi).toFixed(4), quotaInCalo: +(rialzi.filter((e) => e.movimento < 0).length / rialzi.length).toFixed(2) } : null,
    quandoTagliaITassi: tagli.length ? { casi: tagli.length, movimentoMedio: +med(tagli).toFixed(4), quotaInSalita: +(tagli.filter((e) => e.movimento > 0).length / tagli.length).toFixed(2) } : null,
    dettaglio: eventi,
    limite: 'sono 17 mosse in cinque anni: abbastanza per vedere se i giorni sono piu\' mossi del normale, non abbastanza per dire in che direzione andra\' la prossima volta',
  };
}

export function reazioneText(r) {
  if (!r?.valido) return null;
  const piu = Math.round((r.ampiezzaMediaNeiGiorniFed / r.ampiezzaMediaNegliAltriGiorni) * 10) / 10;
  const base = r.giorniDiversi
    ? `Quando la Fed muove davvero i tassi, ${r.nome.toLowerCase()} si muove circa ${piu} volte piu' del solito nelle due sedute intorno all'annuncio (${(r.ampiezzaMediaNeiGiorniFed * 100).toFixed(2)}% contro ${(r.ampiezzaMediaNegliAltriGiorni * 100).toFixed(2)}%). Sono giorni diversi dagli altri, misurati su ${r.mosse} mosse.`
    : `Ho controllato se i giorni in cui la Fed muove i tassi siano piu' agitati del normale: su ${r.mosse} mosse la differenza non supera il margine d'errore. Sembrano giorni come gli altri. Il fatto che se ne parli molto non vuol dire che i prezzi se ne accorgano.`;
  const verso = r.quandoAlzaITassi && r.quandoTagliaITassi
    ? ` Sulla direzione non c'e' una regola: quando ha alzato i tassi il mercato e' sceso ${Math.round(r.quandoAlzaITassi.quotaInCalo * 100)} volte su cento, quando li ha tagliati e' salito ${Math.round(r.quandoTagliaITassi.quotaInSalita * 100)} volte su cento. Con ${r.mosse} casi in tutto, chiunque ti dica che sa come reagira' la prossima volta sta indovinando.`
    : '';
  return base + verso;
}

// ── Il legame fra una notizia e i dati ──
// Data una notizia con una data, cosa hanno fatto i mercati quel giorno. Con
// l'avvertenza che serve, perché è il punto in cui è più facile ingannarsi:
// che una cosa sia successa lo stesso giorno di un'altra non vuol dire che
// l'abbia causata. In un giorno qualunque succedono mille cose.
export function cosaFecceroIMercati(data, { mercati = ['azioniUsa', 'oro', 'titoliStato', 'vix'] } = {}) {
  const i = DATE_GIORNI.indexOf(data);
  if (i < 1) return { valido: false, motivo: `il ${data} non e' nell'archivio giornaliero (${DATE_GIORNI[0]} - ${DATE_GIORNI.at(-1)})` };
  const righe = [];
  for (const m of mercati) {
    const v = GIORNALIERO[m];
    if (!v || v[i] === null || v[i - 1] === null) continue;
    righe.push({ mercato: m, nome: NOMI_GIORNALIERI[m], variazione: +(v[i] / v[i - 1] - 1).toFixed(4) });
  }
  return {
    valido: righe.length > 0, data, mercati: righe,
    avvertenza: 'in un giorno succedono molte cose insieme: questi numeri dicono cosa e\' successo, non che sia stata quella notizia a farlo succedere',
  };
}
