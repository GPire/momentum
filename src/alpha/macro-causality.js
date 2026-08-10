// ============================================================
// CAUSA ED EFFETTO SUI MERCATI — soprattutto: quando NON si può dire
// ============================================================
// Momentum ha già un motore causale serio: PCMCI con p-value veri e correzione
// di Benjamini-Yekutieli (`predict/causal-discovery.js`), effetti con
// aggiustamento backdoor e propagazione dell'incertezza
// (`predict/causal-effects.js`), e una diagnostica che misura i cinque difetti
// che affliggono OGNI metodo causale (`predict/causal-diagnostics.js`). È stato
// costruito per le categorie di spesa e non è mai stato puntato sui mercati.
//
// Puntarlo sui mercati è utile — ma il risultato utile non è quello che ci si
// aspetta. Su dati macro mensili la risposta corretta è quasi sempre **"non si
// può dire"**, e un sistema che lo dice invece di produrre una freccia vale più
// di uno che la produce. Chi opera su questi mercati non ha bisogno di un'altra
// scatola che sputa relazioni: ha bisogno di sapere quali delle relazioni che
// ha in testa reggono a un controllo serio. Quasi nessuna.
//
// I TRE MODI IN CUI CI SI INGANNA, tutti e tre misurati qui su dati veri:
//
// 1. LIVELLI INVECE DI VARIAZIONI (regressione spuria, Granger & Newbold 1974).
//    Due serie che tendono entrambe a salire o scendere nel tempo risultano
//    legate anche quando non c'entrano niente. Misurato: sul pannello macro in
//    LIVELLI il motore trova cinque legami con p-value minuscoli (fino a
//    0,0e+0); in VARIAZIONI **non ne sopravvive nemmeno uno**. L'unico legame
//    che compare sulle variazioni è tasso→curva, che nei livelli non c'era e
//    che comunque è un'identità meccanica — la banca centrale fissa il tasso
//    breve, che è una gamba della curva. Non è una scoperta, è aritmetica.
//    **Cinque "cause" su cinque erano l'andamento del tempo.**
//
// 2. CONFONDERE PREVISIONE CON CAUSA. La curva dei rendimenti prevede le
//    recessioni (misurato in `macro-regime.js`: AUC 0,82 a 18 mesi). Non le
//    causa: nessuno è mai andato in recessione PERCHÉ due rendimenti si erano
//    incrociati. La curva è un termometro che riassume l'aspettativa del
//    mercato. La distinzione sembra filosofica e non lo è: un termometro si
//    legge, una causa si manipola — e se si prova a manipolare un termometro
//    si rompe il termometro senza cambiare la febbre.
//
// 3. ENDOGENEITÀ DELLA POLITICA MONETARIA, il più insidioso. Chiedere "cosa
//    succede se la banca centrale taglia i tassi?" a dati osservativi non
//    funziona, perché la banca centrale taglia PROPRIO QUANDO l'economia sta
//    peggiorando. Nei dati "taglio" e "recessione" arrivano insieme, e un
//    modello ingenuo conclude che i tagli causano le recessioni. È lo stesso
//    meccanismo del "price puzzle" dei VAR macro. Rispondere davvero richiede
//    di isolare la parte di decisione NON spiegata dall'economia (la strada di
//    Romer & Romer), che con queste serie non si può fare. Qui si rifiuta di
//    rispondere e si dice perché, invece di dare un numero sbagliato.
//
// LA COSA CHE INVECE I DATI DICONO, ed è controintuitiva quanto basta:
// **nessuna variabile macro precede causalmente i rendimenti azionari**, in
// nessuno dei ritardi provati. Ma i rendimenti azionari precedono
// disoccupazione e inflazione. La borsa non segue l'economia: la anticipa. Chi
// costruisce strategie su "quando esce il dato macro, allora compro" sta
// leggendo la freccia al contrario, e questo lo si misura invece di dirlo.
//
// Funzioni PURE.
'use strict';

import { MACRO, MACRO_DA, MACRO_MESI } from './macro-panel.js';
import { SERIE_STORICHE } from './historical-returns.js';
import { discoverCausalGraph } from '../predict/causal-discovery.js';
import { diagnoseCausalGraph } from '../predict/causal-diagnostics.js';

// Primo mese del pannello macro coperto anche dai rendimenti SPY.
const SPY_DA = '1993-03';

function offsetSpy() {
  const [ya, ma] = MACRO_DA.split('-').map(Number);
  const [ys, ms] = SPY_DA.split('-').map(Number);
  return (ys - ya) * 12 + (ms - ma);
}

const differenze = (a) => a.map((v, i) => (i === 0 || v === null || a[i - 1] === null ? null : +(v - a[i - 1]).toFixed(5)));

// Tiene solo i mesi in cui TUTTE le serie hanno un valore: un metodo causale
// che salta i buchi in modo diverso per ogni coppia confronta campioni diversi
// e produce legami che non esistono.
function soloCompleti(obj) {
  const chiavi = Object.keys(obj);
  const n = obj[chiavi[0]].length;
  const out = Object.fromEntries(chiavi.map((k) => [k, []]));
  for (let i = 0; i < n; i++) {
    if (chiavi.every((k) => obj[k][i] !== null && Number.isFinite(obj[k][i]))) {
      for (const k of chiavi) out[k].push(obj[k][i]);
    }
  }
  return out;
}

// ── Le serie, nelle due forme che decidono tutto ──
export function serieMacro({ variazioni = true, conAzioni = false } = {}) {
  const f = variazioni ? differenze : (a) => a.slice();
  const base = {
    curva: f(MACRO.curva),
    tasso: f(MACRO.ff),
    inflazione: f(MACRO.infl),
    disoccupazione: f(MACRO.disocc),
  };
  if (!conAzioni) return soloCompleti(base);

  const off = offsetSpy();
  const spy = SERIE_STORICHE.spy.rendimenti;
  const n = Math.min(spy.length, MACRO_MESI - off);
  const conAz = { azioni: [], curva: [], tasso: [], inflazione: [], disoccupazione: [] };
  for (let i = 0; i < n; i++) {
    const j = off + i;
    conAz.azioni.push(spy[i]);
    conAz.curva.push(base.curva[j]); conAz.tasso.push(base.tasso[j]);
    conAz.inflazione.push(base.inflazione[j]); conAz.disoccupazione.push(base.disoccupazione[j]);
  }
  return soloCompleti(conAz);
}

function scopri(serie, opts = {}) {
  const d = discoverCausalGraph(serie, { maxLag: 3, alpha: 0.01, ...opts });
  const g = diagnoseCausalGraph(d, { alpha: 0.01 });
  return { grafo: d, diagnosi: g };
}

// ── 1. LA TRAPPOLA DEI LIVELLI, misurata ──
// Lo stesso identico motore, sugli stessi identici dati, in due forme.
export function trappolaLivelli() {
  const liv = scopri(serieMacro({ variazioni: false }));
  const var_ = scopri(serieMacro({ variazioni: true }));

  const chiave = (l) => `${l.from}@${l.lag}->${l.to}`;
  const insiemeVar = new Set(var_.grafo.links.map(chiave));
  const svaniti = liv.grafo.links.filter((l) => !insiemeVar.has(chiave(l))).map(chiave);

  return {
    suLivelli: liv.grafo.links.length,
    suVariazioni: var_.grafo.links.length,
    svaniti: svaniti.length,
    quali: svaniti,
    quotaSpuria: liv.grafo.links.length ? +(svaniti.length / liv.grafo.links.length).toFixed(3) : null,
    sopravvissuti: var_.grafo.links.map((l) => ({ da: l.from, a: l.to, ritardo: l.lag, p: l.p })),
    // Verdetto scritto, non lasciato dedurre.
    lezione: svaniti.length > 0
      ? `${svaniti.length} legami su ${liv.grafo.links.length} esistono solo perche' le serie hanno una tendenza comune nel tempo. In variazioni spariscono.`
      : 'nessuna differenza fra le due forme in questo campione',
  };
}

// ── 2. LA DOMANDA DEL TRADER: la macro muove le azioni? ──
export function causeSuAzioni() {
  const { grafo, diagnosi } = scopri(serieMacro({ variazioni: true, conAzioni: true }), { alpha: 0.05 });
  const versoAzioni = grafo.links.filter((l) => l.to === 'azioni');
  const daAzioni = grafo.links.filter((l) => l.from === 'azioni');
  return {
    mesi: grafo.frame?.T || 0,
    legamiTotali: grafo.links.length,
    macroVersoAzioni: versoAzioni.map((l) => ({ da: l.from, ritardo: l.lag, p: l.p })),
    azioniVersoMacro: daAzioni.map((l) => ({ a: l.to, ritardo: l.lag, p: l.p })),
    perDecidere: diagnosi.perDecidere,
    // Il risultato che conta, e la direzione della freccia.
    laBorsaAnticipa: versoAzioni.length === 0 && daAzioni.length > 0,
    conclusione: versoAzioni.length === 0 && daAzioni.length > 0
      ? 'nessuna variabile macro precede i rendimenti azionari, ma i rendimenti azionari precedono disoccupazione e inflazione: la borsa anticipa l\'economia, non la segue'
      : versoAzioni.length === 0
        ? 'nessun legame fra macro e azioni a questa frequenza'
        : 'in questo campione qualche variabile macro precede le azioni: da trattare con sospetto, e\' il tipo di risultato che di solito non regge fuori campione',
  };
}

// ── 3. PREVISIONE ≠ CAUSA, e perché non si può rispondere all'intervento ──
// Non è una rinuncia: è la risposta corretta, e dice anche cosa servirebbe per
// dare quella vera.
export function previsioneNonIntervento() {
  const { diagnosi } = scopri(serieMacro({ variazioni: true }));
  const gravi = (diagnosi.avvertimenti || []).filter((a) => a.gravita === 'alta');
  return {
    perDecidere: diagnosi.perDecidere,
    problemi: gravi.map((a) => a.tipo),
    domandeAmmesse: [
      'quanto e\' probabile una recessione entro diciotto mesi, viste le condizioni di oggi',
      'quanto e\' turbolento il mercato adesso rispetto alla sua storia',
      'quanto rischio di dover vendere in perdita, con la mia cassa e le mie scadenze',
    ],
    domandeNonAmmesse: [
      { domanda: 'cosa succede se la banca centrale taglia di 100 punti base',
        perche: 'la banca centrale taglia PROPRIO QUANDO l\'economia peggiora: nei dati taglio e recessione arrivano insieme, e un modello ingenuo conclude che i tagli causano le recessioni',
        cosaServirebbe: 'isolare la parte di decisione non spiegata dall\'economia (una serie di shock di politica monetaria, alla Romer & Romer), che queste serie non contengono' },
      { domanda: 'se la curva si disinverte, il rischio di recessione scende',
        perche: 'la curva PREVEDE le recessioni, non le causa: nessuno e\' mai andato in recessione perche\' due rendimenti si erano incrociati. Un termometro si legge, non si manipola',
        cosaServirebbe: 'un esperimento, che in macroeconomia non esiste' },
    ],
    nota: 'la distinzione fra prevedere e causare non e\' filosofia: decide quali domande hanno una risposta e quali no',
  };
}

// ── Il referto, in italiano ──
export function refertoCausale() {
  const t = trappolaLivelli();
  const a = causeSuAzioni();
  const p = previsioneNonIntervento();
  return {
    trappolaLivelli: t, azioni: a, intervento: p,
    testo: [
      `Ho cercato legami di causa ed effetto fra tassi, inflazione, disoccupazione e borsa su ${MACRO_MESI} mesi.`,
      t.svaniti > 0
        ? `Lavorando sui valori grezzi ne uscivano ${t.suLivelli}; guardando le variazioni mese su mese ne resta ${t.suVariazioni}. Gli altri erano solo il fatto che quasi tutto, nel tempo, tende a salire.`
        : '',
      a.laBorsaAnticipa
        ? 'Nessun dato economico anticipa la borsa. La borsa anticipa i dati economici: quando esce la notizia, i prezzi l\'hanno gia\' incorporata.'
        : '',
      'Su cosa succederebbe SE la banca centrale facesse una cosa o l\'altra, questi dati non permettono di rispondere, e preferisco dirlo.',
    ].filter(Boolean).join(' '),
  };
}
