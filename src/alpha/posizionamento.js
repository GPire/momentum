// ============================================================
// IL SENTIMENT CHE NON È UN'OPINIONE — soldi veri, dichiarati per legge
// ============================================================
// "Sentiment" in finanza vuol dire quasi sempre due cose deboli: un sondaggio
// (in cui la gente dice quello che pensa, non quello che fa) oppure un indice
// dedotto dai prezzi (che è il prezzo raccontato con altre parole). Qui c'è la
// terza, l'unica solida e l'unica pubblica: **le posizioni vere**.
//
// Ogni settimana la CFTC pubblica quante scommesse al rialzo e al ribasso hanno
// in essere gli operatori sui mercati a termine americani, divisi per
// categoria. Non è un'opinione: è denaro impegnato, dichiarato per obbligo di
// legge a un ente federale. Ed è in dominio pubblico, senza vincoli di
// ridistribuzione — cosa che, dopo la ricerca sulle fonti, non è affatto
// scontata.
//
// QUARANT'ANNI: l'oro parte dal 1986, i titoli di Stato dal 1993, le azioni e
// l'euro dal 2000, il bitcoin dal 2018. Le finestre sono diverse e restano
// diverse: accorciarle tutte alla più corta avrebbe buttato via trentadue anni
// di oro per far posto al bitcoin.
//
// L'INDICE DI POSIZIONAMENTO, che è come si legge davvero questo dato: non il
// valore assoluto (quanto sia "molto" un 20% netto dipende dal mercato) ma il
// suo PERCENTILE su una finestra mobile. Zero = mai stati così ribassisti in
// tre anni; cento = mai stati così rialzisti. È la forma in cui gli operatori
// lo usano da decenni, e ha una ragione: ogni mercato ha il suo livello
// normale, e confrontare l'oro con l'euro sui valori grezzi non significa
// niente.
//
// LA TESI DA VERIFICARE, e questo modulo esiste soprattutto per quello. Si
// dice che il posizionamento estremo sia un segnale CONTRARIO: quando tutti
// sono dalla stessa parte, il mercato va dall'altra. È una delle convinzioni
// più diffuse fra gli operatori. Qui non si assume: si misura, mercato per
// mercato, e il risultato è meno lusinghiero della fama — come quasi sempre
// quando si misura una convinzione diffusa.
//
// Funzioni PURE.
'use strict';

import { COT_NETTO, COT_DATE, NOMI_COT, COT_DA, COT_A, COT_SETTIMANE, COT_FONTE } from './cot-panel.js';

// Tre anni di settimane: la finestra classica per l'indice di posizionamento.
// Più corta reagirebbe al rumore, più lunga non distinguerebbe più i regimi.
export const FINESTRA = 156;
export const ESTREMO_ALTO = 90;
export const ESTREMO_BASSO = 10;

const MERCATI = Object.keys(COT_NETTO);

export function pannelloCot() {
  return {
    mercati: MERCATI.map((k) => ({
      chiave: k, nome: NOMI_COT[k],
      settimane: COT_NETTO[k].filter((x) => x !== null).length,
      da: COT_DATE[COT_NETTO[k].findIndex((x) => x !== null)],
    })),
    settimane: COT_SETTIMANE, da: COT_DA, a: COT_A, fonte: COT_FONTE,
  };
}

// ── L'indice: dove sta il posizionamento di oggi rispetto alla sua storia ──
export function indice(mercato, { fino = null, finestra = FINESTRA } = {}) {
  const serie = COT_NETTO[mercato];
  if (!serie) return { valido: false, motivo: `mercato sconosciuto: ${mercato}` };
  const t = fino === null ? serie.length : Math.min(fino, serie.length);
  const fetta = serie.slice(Math.max(0, t - finestra), t).filter((x) => x !== null);
  if (fetta.length < 30) return { valido: false, motivo: 'storia insufficiente in questa finestra' };
  const attuale = fetta[fetta.length - 1];
  const percentile = (fetta.filter((x) => x <= attuale).length / fetta.length) * 100;
  return {
    valido: true, mercato, nome: NOMI_COT[mercato],
    netto: attuale,
    indice: +percentile.toFixed(1),
    osservazioni: fetta.length,
    estremoRialzista: percentile >= ESTREMO_ALTO,
    estremoRibassista: percentile <= ESTREMO_BASSO,
    stato: percentile >= ESTREMO_ALTO ? 'tutti dalla stessa parte, al rialzo'
      : percentile <= ESTREMO_BASSO ? 'tutti dalla stessa parte, al ribasso'
        : 'posizionamento nella norma',
  };
}

// ── LA VERIFICA DELLA TESI CONTRARIA ──
// Si prendono le settimane in cui il posizionamento era estremo e si guarda
// cosa ha fatto il POSIZIONAMENTO STESSO dopo: se la tesi contraria vale, un
// estremo rialzista dovrebbe rientrare (e viceversa). Si misura sul dato che
// si ha, senza pretendere di avere i prezzi allineati settimana per settimana
// per ogni mercato — e questo limite va detto, non nascosto: qui si verifica
// che gli estremi RIENTRANO, non che il prezzo si giri. Sono due affermazioni
// diverse, e la seconda richiederebbe prezzi settimanali per tutti e cinque i
// mercati che al momento non ho.
export function rientroDagliEstremi(mercato, { orizzonte = 13, finestra = FINESTRA } = {}) {
  const serie = COT_NETTO[mercato];
  if (!serie) return { valido: false, motivo: `mercato sconosciuto: ${mercato}` };

  const casi = { alto: [], basso: [], normale: [] };
  for (let t = finestra; t + orizzonte < serie.length; t++) {
    const i = indice(mercato, { fino: t + 1, finestra });
    if (!i.valido) continue;
    const ora = serie[t], dopo = serie[t + orizzonte];
    if (ora === null || dopo === null) continue;
    const variazione = dopo - ora;
    if (i.estremoRialzista) casi.alto.push(variazione);
    else if (i.estremoRibassista) casi.basso.push(variazione);
    else casi.normale.push(variazione);
  }
  const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const quota = (a, f) => (a.length ? a.filter(f).length / a.length : null);
  const mAlto = media(casi.alto), mBasso = media(casi.basso), mNorm = media(casi.normale);

  return {
    valido: true, mercato, nome: NOMI_COT[mercato], orizzonte,
    dopoUnEstremoRialzista: { casi: casi.alto.length, variazioneMedia: mAlto === null ? null : +mAlto.toFixed(4), quotaInCalo: quota(casi.alto, (x) => x < 0) },
    dopoUnEstremoRibassista: { casi: casi.basso.length, variazioneMedia: mBasso === null ? null : +mBasso.toFixed(4), quotaInSalita: quota(casi.basso, (x) => x > 0) },
    daPosizioneNormale: { casi: casi.normale.length, variazioneMedia: mNorm === null ? null : +mNorm.toFixed(4) },
    rientrano: mAlto !== null && mBasso !== null && mAlto < 0 && mBasso > 0,
    nota: 'qui si misura se gli ESTREMI RIENTRANO, non se il prezzo si gira: sono due affermazioni diverse e la seconda richiederebbe prezzi settimanali allineati per tutti i mercati',
  };
}

// ── IL CONTROLLO CHE SMONTA IL RISULTATO PRECEDENTE ──
// `rientroDagliEstremi` trova che la tesi "regge" su tutti e cinque i mercati.
// Prima di rallegrarsene bisogna chiedersi una cosa: **una serie limitata che
// oscilla intorno a una media RIENTRA SEMPRE dai suoi estremi, per
// costruzione.** Non serve nessun comportamento contrario degli operatori: la
// matematica basta da sola. Trovare il rientro e chiamarlo "la tesi contraria
// funziona" e' uno dei modi piu' eleganti di ingannarsi.
//
// Il controllo giusto: si misura quanto il rientro dipende SOLO dalla distanza
// dalla media, su TUTTI i punti. Se il rientro dagli estremi e' quello che
// quella relazione prevede, allora negli estremi non c'e' niente di speciale —
// sono solo i punti piu' lontani. Se invece rientrano piu' del previsto,
// allora si', qualcosa di specifico agli estremi c'e'.
export function estremiSonoSpeciali(mercato, { orizzonte = 13, finestra = FINESTRA } = {}) {
  const serie = COT_NETTO[mercato];
  if (!serie) return { valido: false, motivo: `mercato sconosciuto: ${mercato}` };

  const punti = [];
  for (let t = finestra; t + orizzonte < serie.length; t++) {
    const ora = serie[t], dopo = serie[t + orizzonte];
    if (ora === null || dopo === null) continue;
    const fetta = serie.slice(Math.max(0, t - finestra), t + 1).filter((x) => x !== null);
    if (fetta.length < 30) continue;
    const med = fetta.reduce((x, y) => x + y, 0) / fetta.length;
    const perc = (fetta.filter((x) => x <= ora).length / fetta.length) * 100;
    punti.push({ distanza: ora - med, variazione: dopo - ora, estremo: perc >= ESTREMO_ALTO || perc <= ESTREMO_BASSO });
  }
  if (punti.length < 100) return { valido: false, motivo: 'osservazioni insufficienti' };

  // Pendenza della retta variazione ~ distanza, stimata sui soli punti NON
  // estremi: e' la "gravita' naturale" della serie, quella che c'e' comunque.
  const normali = punti.filter((p) => !p.estremo);
  const mx = normali.reduce((s, p) => s + p.distanza, 0) / normali.length;
  const my = normali.reduce((s, p) => s + p.variazione, 0) / normali.length;
  let num = 0, den = 0;
  for (const p of normali) { num += (p.distanza - mx) * (p.variazione - my); den += (p.distanza - mx) ** 2; }
  const pendenza = den > 0 ? num / den : 0;

  // Quanto rientrano davvero gli estremi, contro quanto la sola gravita'
  // naturale prevedeva per loro.
  const estremi = punti.filter((p) => p.estremo);
  const osservato = estremi.reduce((s, p) => s + p.variazione, 0) / estremi.length;
  const previsto = estremi.reduce((s, p) => s + (my + pendenza * (p.distanza - mx)), 0) / estremi.length;
  const extra = osservato - previsto;
  // Errore standard dell'eccesso: senza, "un po' di piu'" non vuol dire niente.
  const sd = Math.sqrt(estremi.reduce((s, p) => s + (p.variazione - osservato) ** 2, 0) / Math.max(1, estremi.length - 1));
  const errore = sd / Math.sqrt(estremi.length);

  return {
    valido: true, mercato, nome: NOMI_COT[mercato],
    casiEstremi: estremi.length, casiNormali: normali.length,
    gravitaNaturale: +pendenza.toFixed(4),
    rientroOsservato: +osservato.toFixed(4),
    rientroPrevistoDallaSolaGravita: +previsto.toFixed(4),
    eccesso: +extra.toFixed(4),
    errore: +errore.toFixed(4),
    // Speciali solo se rientrano SIGNIFICATIVAMENTE piu' del previsto.
    specialiDavvero: Math.abs(extra) > 2 * errore,
    conclusione: Math.abs(extra) > 2 * errore
      ? 'agli estremi succede qualcosa in piu' + String.fromCharCode(39) + ' del semplice ritorno alla media'
      : 'il rientro dagli estremi e' + String.fromCharCode(39) + ' esattamente quello che la sola tendenza a tornare verso la media produce: negli estremi non c' + String.fromCharCode(39) + 'e' + String.fromCharCode(39) + ' niente di speciale',
  };
}

// ── Le cadenze: anno, mese, e il ciclo ──
// Lo stesso dato letto a tre passi diversi. Non e' un vezzo: un posizionamento
// puo' essere estremo questa settimana e normale come media dell'anno, e le
// due cose rispondono a domande diverse.
export function perAnno(mercato) {
  const serie = COT_NETTO[mercato];
  if (!serie) return [];
  const gruppi = new Map();
  COT_DATE.forEach((d, i) => {
    if (serie[i] === null) return;
    const a = d.slice(0, 4);
    if (!gruppi.has(a)) gruppi.set(a, []);
    gruppi.get(a).push(serie[i]);
  });
  return [...gruppi.entries()].map(([anno, v]) => ({
    anno,
    medio: +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(4),
    minimo: +Math.min(...v).toFixed(4), massimo: +Math.max(...v).toFixed(4),
    settimane: v.length,
  })).sort((a, b) => (a.anno < b.anno ? -1 : 1));
}

// Stagionalita' del POSIZIONAMENTO, con lo stesso scrupolo gia' usato per la
// stagionalita' dei prezzi: si dichiara quali mesi si distinguono davvero dal
// caso e quali no, invece di pubblicare dodici numeri tutti con la stessa
// dignita'.
export function perMese(mercato) {
  const serie = COT_NETTO[mercato];
  if (!serie) return [];
  const gruppi = Array.from({ length: 12 }, () => []);
  COT_DATE.forEach((d, i) => {
    if (serie[i] === null) return;
    gruppi[Number(d.slice(5, 7)) - 1].push(serie[i]);
  });
  const tutti = serie.filter((x) => x !== null);
  const mediaTot = tutti.reduce((x, y) => x + y, 0) / tutti.length;
  const sdTot = Math.sqrt(tutti.reduce((s, x) => s + (x - mediaTot) ** 2, 0) / (tutti.length - 1));
  return gruppi.map((v, m) => {
    if (!v.length) return { mese: m + 1, osservazioni: 0, distinguibile: false };
    const med = v.reduce((x, y) => x + y, 0) / v.length;
    const errore = sdTot / Math.sqrt(v.length);
    return {
      mese: m + 1, osservazioni: v.length,
      medio: +med.toFixed(4),
      scostamento: +(med - mediaTot).toFixed(4),
      // Due errori standard: sotto, la differenza sta dentro il rumore.
      distinguibile: Math.abs(med - mediaTot) > 2 * errore,
    };
  });
}

// ── Il quadro di oggi su tutti i mercati ──
export function quadroPosizionamento() {
  const righe = MERCATI.map((k) => indice(k)).filter((r) => r.valido);
  const estremi = righe.filter((r) => r.estremoRialzista || r.estremoRibassista);
  return {
    mercati: righe,
    estremi: estremi.map((r) => ({ nome: r.nome, indice: r.indice, verso: r.estremoRialzista ? 'rialzo' : 'ribasso' })),
    // Quando molti mercati sono estremi insieme, non e' piu' una storia sul
    // singolo mercato: e' un clima.
    climaDiffuso: estremi.length >= Math.ceil(righe.length / 2),
  };
}

export function posizionamentoText(q) {
  if (!q?.mercati?.length) return null;
  if (!q.estremi.length) {
    return 'Gli operatori non sono schierati in modo particolare su nessuno dei mercati che guardo: il posizionamento e\' nella norma ovunque.';
  }
  const elenco = q.estremi.map((e) => `${e.nome.toLowerCase()} (tutti al ${e.verso})`).join(', ');
  const clima = q.climaDiffuso
    ? ' Essendo su piu\' mercati insieme, e\' un clima generale piu\' che una storia su un singolo mercato.'
    : '';
  return `Su ${elenco} gli operatori sono schierati quasi tutti dalla stessa parte, ai livelli piu\' estremi degli ultimi tre anni.${clima} Attenzione: schierarsi tutti insieme non vuol dire che il mercato si girera\' — e\' una condizione, non una previsione.`;
}

// ── La risposta su UN mercato solo ──
// Chi chiede "come sono messi sull'oro" vuole l'oro, non la panoramica. E
// vuole sapere, sullo stesso respiro, se su quel mercato il segnale vale
// qualcosa: il controllo va attaccato al dato, non messo in fondo a un
// documento che nessuno legge.
export const ALIAS_MERCATO = {
  oro: ['oro', 'gold', 'lingott'],
  azioniUsa: ['azioni', 'azionario', 'borsa', 's&p', 'sp500', 's p 500', 'wall street', 'indice americano'],
  titoliStato: ['titoli di stato', 'obbligazion', 'bond', 'treasury', 'decennale', 'tassi'],
  euro: ['euro', 'dollaro', 'cambio', 'valut'],
  bitcoin: ['bitcoin', 'btc', 'cript'],
};

export function mercatoNominato(domanda) {
  const q = (domanda || '').toLowerCase();
  // Le chiavi piu' specifiche prima: "criptovalute" non deve finire in "valut".
  for (const k of ['bitcoin', 'oro', 'titoliStato', 'azioniUsa', 'euro']) {
    if (ALIAS_MERCATO[k].some((a) => q.includes(a))) return k;
  }
  return null;
}

export function quadroMercato(mercato) {
  const i = indice(mercato);
  if (!i.valido) return null;
  return { indice: i, controllo: estremiSonoSpeciali(mercato), storia: pannelloCot().mercati.find((m) => m.chiave === mercato) };
}

export function mercatoText(m) {
  if (!m) return null;
  const { indice: i, controllo: c, storia } = m;
  const dove = i.indice >= ESTREMO_ALTO ? `schierati quasi tutti al rialzo (${i.indice} su 100)`
    : i.indice <= ESTREMO_BASSO ? `schierati quasi tutti al ribasso (${i.indice} su 100)`
      : i.indice >= 60 ? `piu' al rialzo del solito, ma senza esagerare (${i.indice} su 100)`
        : i.indice <= 40 ? `piu' al ribasso del solito, ma senza esagerare (${i.indice} su 100)`
          : `su posizioni normali (${i.indice} su 100)`;
  const base = `Su ${i.nome.toLowerCase()} gli operatori con soldi veri sono ${dove}, misurato sugli ultimi tre anni. Lo so perche' negli Stati Uniti chi opera sui future e' obbligato per legge a dichiarare le proprie posizioni ogni settimana: e' l'unica misura di umore del mercato che non sia un sondaggio o un'opinione. Ho ${storia?.settimane} settimane di storia, dal ${String(storia?.da).slice(0, 4)}.`;
  const verifica = !c?.valido ? ''
    : c.specialiDavvero
      ? ` E su questo mercato la cosa conta davvero: quando il posizionamento arriva agli estremi, dopo succede qualcosa in piu' del semplice rientro verso la media. E' uno dei pochi mercati dove l'ho verificato e ha retto.`
      : ` Ma su questo mercato non ci leggerei un segnale: ho verificato, e gli estremi rientrano esattamente come farebbe qualunque serie che oscilla intorno a una media. Sembra un'informazione e non lo e'.`;
  return base + verifica;
}
