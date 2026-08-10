// ============================================================
// LE DOMANDE VERE — il ponte fra quello che si chiede e quello che si sa
// ============================================================
// A questo punto Momentum misura: cosa protegge nei crolli, cosa è successo in
// un qualunque giorno degli ultimi cinque anni, quanto vale la curva dei
// rendimenti a ciascun orizzonte, quali settori tengono, se le cripto
// proteggono (no), quanto rischi di dover vendere. Tutto questo è motore: nella
// app non se ne vede niente, e un motore che nessuno può interrogare vale zero.
//
// Questo modulo è il ponte. Non aggiunge una misura: rende interrogabile in
// italiano quello che c'è già, e — cosa che conta di più — **dichiara quando la
// domanda non ha risposta**.
//
// LA REGOLA CHE LO GOVERNA, ed è la stessa dell'intero progetto: non si
// risponde mai "compra" o "vendi". Non perché sia prudente, ma perché non lo
// sappiamo e nessuno lo sa. Si risponde a tre tipi di domanda che invece hanno
// una risposta vera:
//   · cos'è SUCCESSO (un fatto, verificabile);
//   · cosa ha FUNZIONATO storicamente (una misura, con il suo margine);
//   · come sei messo TU (un conto sui tuoi dati).
// Tutto il resto viene rifiutato dicendo perché.
//
// Il riconoscimento dell'intento è deterministico e testabile, come nel resto
// del QA: parole-chiave robuste, nessun modello, nessuna rete. Su un insieme
// chiuso di domande finanziarie funziona meglio di qualunque cosa più
// complicata, ed è verificabile riga per riga.
'use strict';

const NOMI_STATI_QA = ['condizioni distese', 'condizioni normali', 'condizioni tese'];

const MESI = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

// ── Estrazione del periodo dalla domanda ──
// "aprile 2025", "nel 2022", "2025-04": tre forme che una persona usa davvero.
export function estraiPeriodo(domanda) {
  const q = normalizza(domanda);
  const iso = q.match(/(\d{4})-(\d{2})/);
  if (iso) return { da: `${iso[1]}-${iso[2]}-01`, a: `${iso[1]}-${iso[2]}-31`, etichetta: `${iso[1]}-${iso[2]}` };
  for (const [nome, n] of Object.entries(MESI)) {
    const re = new RegExp(`${nome}\\s+(?:del\\s+)?(\\d{4})`);
    const m = q.match(re);
    if (m) {
      const mm = String(n).padStart(2, '0');
      return { da: `${m[1]}-${mm}-01`, a: `${m[1]}-${mm}-31`, etichetta: `${nome} ${m[1]}` };
    }
  }
  const anno = q.match(/\b(19|20)(\d{2})\b/);
  if (anno) {
    const y = anno[0];
    return { da: `${y}-01-01`, a: `${y}-12-31`, etichetta: `il ${y}`, interoAnno: true };
  }
  return null;
}

// Gli accenti vanno tolti PRIMA di confrontare: "salirà" e "salira" sono la
// stessa domanda, e senza questo passaggio il rifiuto motivato non scattava
// proprio sulle domande scritte correttamente. Trovato provando le frasi vere.
export const normalizza = (s) => (s || '').toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['\u2019]/g, ' ').replace(/\s+/g, ' ');

const ha = (q, ...parole) => parole.some((p) => q.includes(p));

// ── Il riconoscimento dell'intento ──
export function intentoMercato(domanda) {
  const q = normalizza(domanda);
  if (!q) return null;

  // L'ordine conta: le domande più specifiche prima.
  if (ha(q, 'cript', 'bitcoin', 'ethereum', 'btc')) {
    if (ha(q, 'proteg', 'rifugio', 'ripar', 'difend', 'crolla', 'crollo')) return 'cripto-rifugio';
  }
  if (ha(q, 'oro') && ha(q, 'proteg', 'rifugio', 'convien', 'serve', 'funziona')) return 'oro';
  if (ha(q, 'proteg', 'rifugio', 'ripar', 'difend', 'salva')) return 'rifugi';
  if (ha(q, 'settor') && ha(q, 'crolla', 'crollo', 'cala', 'scend', 'peggior', 'tengon', 'reggon')) return 'settori';
  if (ha(q, 'diversific') && ha(q, 'mondo', 'geografic', 'paesi', 'estero', 'global')) return 'diversificazione';
  if (ha(q, 'recession', 'crisi in arrivo', 'curva dei tassi', 'curva dei rendimenti', 'curva invertita')) return 'recessione';
  if (ha(q, 'come sta il mercato', 'come va il mercato', 'situazione dei mercati', 'clima di mercato', 'quanto e teso', 'stress')) return 'regime';
  if (ha(q, 'quanto posso perdere', 'perdita massima', 'caso peggiore', 'quanto rischio di perdere', 'scenario peggiore')) return 'perdita-massima';
  if (ha(q, 'se tornasse', 'se si ripetesse', 'e se succedesse di nuovo', 'come nel 2008', 'un altro 2008', 'ripetesse il')) return 'scenario-storico';
  if (ha(q, 'quanto dura', 'quanto durano', 'quanto tempo per recuperare', 'quando recupera', 'tempi di recupero', 'mercato orso')) return 'durata-orso';
  if (ha(q, 'cosa non sai', 'cosa non puoi', 'quali sono i tuoi limiti', 'di cosa non sei sicuro', 'dove sbagli', 'cosa ti manca')) return 'limiti';
  if (ha(q, 'quanto e affidabile', 'quanto ti posso credere', 'quanto sono affidabili', 'che affidabilita')) return 'limiti';
  if (ha(q, 'cosa e successo', 'cos e successo', 'che e successo', 'cosa succes', 'com e andata', 'perche e crollat', 'crollo di', 'cosa ando storto')) return 'evento';
  // Una data da sola, in una domanda, quasi sempre chiede un evento.
  if (estraiPeriodo(q) && ha(q, '?', 'spieg', 'raccont', 'dimm')) return 'evento';
  return null;
}

// ── Il caricamento, e perche' non e' banale ──
// Il QA del progetto e' SINCRONO, questi moduli portano 145 KB di dati e non
// vanno messi nel pacchetto principale: chi non chiede mai di mercati non deve
// pagarli. La soluzione non e' rendere il QA asincrono (toccherebbe ogni
// chiamante) ne' importare tutto staticamente (peserebbe su tutti): si
// precarica in sottofondo dopo l'avvio, e da quel momento la risposta e'
// sincrona. Se qualcuno chiede prima che il caricamento sia finito, il QA
// risponde come ha sempre fatto — nessun errore, nessuna attesa.
let MODULI = null;
let inCorso = null;
// I settori arrivano da una funzione asincrona (import dinamico interno):
// si calcolano una volta e si tengono.
let SETTORI_CACHE = null;
let CONTESTO_CACHE = null;

export function precarica() {
  if (MODULI) return Promise.resolve(MODULI);
  if (inCorso) return inCorso;
  inCorso = Promise.all([
    import('./eventi.js'), import('./rifugi.js'), import('./global-stress.js'),
    import('./macro-regime.js'), import('./quadro-unico.js'), import('./market-stress.js'),
    import('./historical-sequences.js'),
  ]).then(async ([eventi, rifugi, globale, macro, quadro, stress, storiche]) => {
    // I settori si calcolano con una funzione ASINCRONA (che a sua volta
    // importa il pannello settoriale). Se non la si scalda qui, la PRIMA
    // domanda sui settori riceve "non lo so" e solo la seconda funziona.
    // BUG VISTO SOLO PROVANDO NEL BROWSER: nei test non emergeva perche' le
    // chiamate precedenti avevano gia' riempito la cache. Una prova dal vivo
    // vale quindici test che si aiutano a vicenda.
    // Stessa ragione anche per il contesto storico dei cali: funzione
    // asincrona, si scalda qui una volta per tutte.
    try { SETTORI_CACHE = await rifugi.settoriNeiCrolli(); } catch (_) { SETTORI_CACHE = null; }
    try { CONTESTO_CACHE = await storiche.contestoStorico('spy'); } catch (_) { CONTESTO_CACHE = null; }
    MODULI = { eventi, rifugi, globale, macro, quadro, stress, storiche };
    return MODULI;
  }).catch(() => { inCorso = null; return null; });
  return inCorso;
}

export function pronto() { return MODULI !== null; }

// ── Le risposte ──
export async function rispostaMercato(domanda) {
  await precarica();
  return rispostaSincrona(domanda);
}

// La versione sincrona: funziona solo dopo il precaricamento, ed e' quella che
// il QA usa.
export function rispostaSincrona(domanda) {
  const intento = intentoMercato(domanda);
  if (!intento) return null;
  if (!MODULI) { precarica(); return null; }
  const { eventi, rifugi, globale, macro, quadro, stress, storiche } = MODULI;

  try {
    if (intento === 'evento') {
      const p = estraiPeriodo(domanda);
      if (!p) return { intent: 'mercato-evento', answer: 'Di quale periodo parli? Dimmi un mese e un anno, per esempio "aprile 2025".' };
      const { finestra, finestraText } = eventi;
      const f = finestra(p.da, p.a);
      if (!f.trovato) {
        return { intent: 'mercato-evento', answer: `Su ${p.etichetta} non ho i dati giorno per giorno: il mio archivio dettagliato parte dal 2021. Posso dirti come è andato il mese nel complesso, ma non cosa è successo nei singoli giorni.` };
      }
      return { intent: 'mercato-evento', data: f, answer: finestraText(f) };
    }

    if (intento === 'cripto-rifugio') {
      const { criptoNeiCrolli } = eventi;
      const c = criptoNeiCrolli();
      const btc = c.cripto.find((x) => x.classe === 'bitcoin');
      const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
      return {
        intent: 'mercato-cripto', data: c,
        answer: `No. Nei ${c.giorniConsiderati} giorni peggiori per le azioni — quando la borsa ha perso in media il ${pct(c.azioniInQueiGiorni)}% in un giorno — il bitcoin ha perso il ${pct(btc.medio)}%, cioè di più. È stato positivo solo ${Math.round(btc.quotaPositiva * 100)} volte su 100. Nei momenti di paura le cripto non riparano: amplificano.`,
      };
    }

    if (intento === 'oro') {
      const { rifugiNeiCrolli } = rifugi;
      const r = rifugiNeiCrolli();
      const oro = r.classifica.find((x) => x.attivo === 'oro');
      const migliore = r.classifica[0];
      const pct = (x) => (Math.abs(x) * 100).toFixed(2).replace('.', ',');
      return {
        intent: 'mercato-oro', data: r,
        answer: `Meno di quanto si dica. Nei mesi peggiori per le azioni (in media −${pct(r.azioniInQueiMesi)}% in un mese) l'oro è finito quasi in pari, ${oro.rendimentoMedio >= 0 ? '+' : '−'}${pct(oro.rendimentoMedio)}%, ed è stato positivo solo ${Math.round(oro.quotaPositiva * 100)} volte su 100: una monetina. Quello che ha protetto di più è stato ${migliore.nome.toLowerCase()}, +${pct(migliore.rendimentoMedio)}%.`,
      };
    }

    if (intento === 'rifugi') {
      const { rifugiNeiCrolli, rifugiText } = rifugi;
      const r = rifugiNeiCrolli();
      return { intent: 'mercato-rifugi', data: r, answer: rifugiText(r) };
    }

    if (intento === 'settori') {
      const { settoriNeiCrolli, settoriText } = rifugi;
      const s = SETTORI_CACHE;
      if (!s) { settoriNeiCrolli().then((x) => { SETTORI_CACHE = x; }); return null; }
      return { intent: 'mercato-settori', data: s, answer: settoriText(s) };
    }

    if (intento === 'diversificazione') {
      const { diversificazioneGeografica, portafoglioGlobaleVsUsa, globaleText } = globale;
      const d = diversificazioneGeografica(), p = portafoglioGlobaleVsUsa();
      return { intent: 'mercato-diversificazione', data: { d, p }, answer: globaleText(d, p) };
    }

    if (intento === 'recessione') {
      const { quadroMacro, quadroText } = macro;
      const q = quadroMacro();
      return { intent: 'mercato-recessione', data: q, answer: quadroText(q) };
    }

    if (intento === 'regime') {
      const { statoOggi } = quadro;
      const { stressText, stressIndex } = stress;
      const s = statoOggi();
      const testo = stressText(stressIndex());
      const extra = s.concordi
        ? ' I tre segnali che guardo dicono la stessa cosa.'
        : ' I segnali che guardo non concordano fra loro: qualcosa è teso, qualcos\'altro no.';
      return { intent: 'mercato-regime', data: s, answer: (testo || '') + extra };
    }
    if (intento === 'perdita-massima') {
      const { expectedShortfall, rendimentoMercato } = stress;
      const es = expectedShortfall(rendimentoMercato());
      const pct = (x) => (Math.abs(x) * 100).toFixed(1).replace('.', ',');
      return {
        intent: 'mercato-perdita', data: es,
        answer: `Nel 2,5% dei mesi peggiori della storia recente si e' perso in media il ${pct(es.es)}% in un mese solo, e il mese peggiore di tutti ha fatto ${pct(es.peggiore)}%. Attenzione a una cosa: la soglia oltre la quale si entra in quel 2,5% e' il ${pct(es.var)}%, quindi guardare solo la soglia fa sottostimare la perdita di ${pct(es.quantoIlVarNonVede)} punti. E' l'errore che ha reso famoso il VaR.`,
      };
    }

    if (intento === 'scenario-storico') {
      const { statiStorici, matriceTransizione } = rifugi;
      const st = statiStorici(), tr = matriceTransizione();
      const oggi = st.oggi;
      const versoTeso = tr.probabilita[oggi][2];
      const pct = (x) => Math.round(x * 100);
      return {
        intent: 'mercato-scenario', data: { st, tr },
        answer: `Posso simularlo, ma non prevederlo. Oggi siamo in ${NOMI_STATI_QA[oggi]}, e dalla storia degli ultimi trent'anni la probabilita' di trovarsi in condizioni tese il mese prossimo e' del ${pct(versoTeso)}%. Una cosa la storia la dice con chiarezza: i regimi non saltano. Dalle condizioni distese a quelle tese in un mese e' successo lo ${pct(tr.probabilita[0][2])}% delle volte — ci si passa sempre per il mezzo, e questo da' tempo per accorgersene.`,
      };
    }

    if (intento === 'durata-orso') {
      const { contestoText } = storiche;
      const c = CONTESTO_CACHE;
      if (!c) return null;
      const perFascia = c.perFascia.filter((r) => r.medianRecoveryMonths !== null)
        .map((r) => `${r.band}: ${r.medianRecoveryMonths} mesi`).join(', ');
      return {
        intent: 'mercato-durata', data: c,
        answer: `${contestoText(c)} E dipende molto da quanto e' profondo il calo — ${perFascia}. E' il numero che serve per sapere se puoi permetterti di aspettare.`,
      };
    }

    if (intento === 'limiti') {
      const { orizzonteDiCiascunSegnale } = quadro;
      const o = orizzonteDiCiascunSegnale();
      const cieca = o.finestraCieca.filter((h) => h > 0);
      return {
        intent: 'mercato-limiti', data: o,
        answer: `Parecchie cose, e preferisco dirle. Non so dove andra' il mercato e nessuno lo sa. Non posso dirti cosa succederebbe se la banca centrale muovesse i tassi, perche' nei dati la banca centrale si muove proprio quando l'economia peggiora e le due cose sono inseparabili. E c'e' un buco preciso: a ${cieca.join(' e ')} mesi di distanza nessuno dei segnali che uso e' affidabile — misurato, non stimato. Quello che so fare e' dirti cos'e' successo, cosa ha funzionato in passato e quanto sei esposto tu.`,
      };
    }

  } catch (e) {
    return { intent: 'mercato-errore', answer: 'Ho i dati ma non riesco a leggerli in questo momento.', errore: String(e?.message || e) };
  }
  return null;
}

// ── Le domande che NON hanno risposta, e perché ──
// Elencate apposta: rifiutare senza spiegare è una scusa. E riconoscerle serve
// a non far scattare per sbaglio uno degli intenti sopra su una domanda che
// merita un no.
export const DOMANDE_SENZA_RISPOSTA = [
  { riconosce: ['cosa compro', 'cosa devo comprare', 'su cosa investo', 'quale azione', 'conviene comprare', 'devo vendere', 'e il momento di comprare', 'quando comprare'],
    risposta: 'Non te lo dico, e non è prudenza: nessuno sa cosa farà il mercato, e chi te lo dice o sta indovinando o ti sta vendendo qualcosa. Quello che posso dirti è cosa è successo, cosa ha funzionato in passato e quanto sei esposto tu: sono tre domande a cui esiste una risposta vera.' },
  { riconosce: ['salira', 'scendera', 'dove va il mercato', 'previsione del mercato', 'cosa fara la borsa', 'quanto salira', 'quanto scendera'],
    risposta: 'La direzione non la so, e i dati dicono che non la sa nessuno: l\'indice di paura che calcolo prevede quanto il mercato ballerà, non da che parte andrà. Posso dirti quanto è probabile un rallentamento economico entro un anno e mezzo, che è una cosa diversa.' },
  { riconosce: ['taglier', 'la fed abbass', 'la fed alz', 'cosa fara la fed', 'prossima mossa della fed'],
    risposta: 'Non lo so, e c\'è una ragione tecnica per cui nemmeno i dati lo direbbero: la banca centrale taglia proprio quando l\'economia peggiora, quindi nei numeri "taglio" e "recessione" arrivano insieme e un modello ingenuo concluderebbe che i tagli causano le recessioni.' },
];

export function rifiutoMotivato(domanda) {
  const q = normalizza(domanda);
  for (const d of DOMANDE_SENZA_RISPOSTA) {
    if (d.riconosce.some((r) => q.includes(r))) return { intent: 'mercato-non-si-puo', answer: d.risposta };
  }
  return null;
}

// Il punto d'ingresso unico: prima si guarda se la domanda è di quelle a cui
// non si deve rispondere, poi si prova a rispondere.
export async function chiediAlMercato(domanda) {
  const rifiuto = rifiutoMotivato(domanda);
  if (rifiuto) return rifiuto;
  await precarica();
  // I settori richiedono un secondo giro (la loro funzione e' asincrona):
  // qui lo si aspetta, perche' chi chiama in modo asincrono puo' permetterselo.
  if (MODULI && SETTORI_CACHE === null && intentoMercato(domanda) === 'settori') {
    SETTORI_CACHE = await MODULI.rifugi.settoriNeiCrolli();
  }
  return rispostaSincrona(domanda);
}

// Il punto d'ingresso SINCRONO per il QA: rifiuto motivato + risposta se i
// moduli sono gia' pronti.
export function chiediAlMercatoSync(domanda) {
  return rifiutoMotivato(domanda) || rispostaSincrona(domanda);
}
