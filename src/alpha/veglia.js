// ============================================================
// LA VEGLIA — l'app guarda da sola, e parla solo se ha qualcosa da dire
// ============================================================
// LA CRITICA CHE QUESTO FILE RISOLVE, ed era giusta: per sapere qualcosa
// bisogna FARE UNA DOMANDA, e la domanda deve incontrare una regola. Anche col
// riconoscimento semantico, il modello resta "l'utente chiede, l'app risponde".
// Un'intelligenza che mastica i dati in continuazione non aspetta di essere
// interrogata: guarda, e quando trova qualcosa che vale la pena lo dice.
//
// Il motivo per cui quasi nessuno lo fa bene non e' tecnico. Un sistema che
// parla da solo deve decidere QUANDO TACERE, e tacere non si vende: ogni app
// di mercato notifica qualcosa ogni giorno, perche' un'app silenziosa sembra
// rotta. Il risultato e' che le notifiche diventano rumore e l'utente le
// spegne — e quando arriva quella che conta, non la legge nessuno.
//
// ── PERCHE' QUI SI PUO' FARE SUL SERIO ──
// Parlare senza essere interrogati e' pericoloso esattamente quanto e' utile:
// con dieci indicatori e cinque orizzonti, qualcosa "sembra notevole" ogni
// santo giorno per puro caso. Ma questa sessione ha costruito proprio gli
// strumenti che rendono la cosa onesta:
//   · `panoramica-incrociata.js` corregge per quante cose si sono guardate e
//     per quante direzioni siano DAVVERO distinte, e dichiara quando l'archivio
//     e' troppo corto per accorgersi di alcunche';
//   · `previsione-condizionata.js` corregge per quanti orizzonti si sono
//     provati (misurato: un p di 0,044 su tre orizzonti NON sopravvive);
//   · `causale-validita.js` impedisce di chiamare "causa" una coincidenza;
//   · `assorbimento.js` misura la struttura, non solo i livelli.
// Senza questi, una veglia produrrebbe un falso allarme al giorno. Con questi,
// parla raramente — ed e' quello il pregio, non il difetto.
//
// LA REGOLA: **il silenzio e' la risposta predefinita**, e quando si parla si
// dice sempre quante cose si sono guardate per arrivare a dirlo.
// Funzioni PURE: gli archivi arrivano dal chiamante.
'use strict';

import { panoramica } from './panoramica-incrociata.js';
import { serieAssorbimento, spostamentoAssorbimento } from './assorbimento.js';

// Quanto deve essere insolito lo stato della diversificazione per meritare una
// parola. Due scarti sono gia' raro; sotto, e' respiro normale.
export const SOGLIA_STRUTTURA = 2;

// Ogni osservazione porta con se' la propria provenienza e il proprio limite:
// una riga senza contesto e' un allarme travestito da informazione.
function osservazione({ tipo, testo, guardate, efficaci, limite = null }) {
  return { tipo, testo, guardate, efficaci, limite };
}

// ── Il giro di controllo ──
// `fonti`: { nome: serie }. `etichettaPeriodo`: come si chiama questo archivio
// in italiano, dichiarato dal chiamante che i dati li ha (le etichette scritte
// dentro i moduli invecchiano insieme ai dati — gia' successo).
export function veglia(fonti = {}, {
  finestra = 21, etichettaPeriodo = 'la storia disponibile', escludiDaStruttura = [],
} = {}) {
  const nomi = Object.keys(fonti);
  if (nomi.length < 3) {
    return { disponibile: false, motivo: `Servono almeno 3 fonti per un giro di controllo: qui ce ne sono ${nomi.length}.` };
  }

  const osservazioni = [];
  const p = panoramica(fonti, { finestra });

  // 1. C'e' qualcosa di davvero raro? Solo cio' che sopravvive alla correzione.
  if (p.disponibile && !p.cieco) {
    for (const n of p.notevoli) {
      osservazioni.push(osservazione({
        tipo: 'estremo',
        testo: `${n.nome} è nella fascia più ${n.verso === 'alto' ? 'alta' : 'bassa'} della sua storia (percentile ${n.percentile}).`,
        guardate: p.guardate, efficaci: p.fontiEfficaci,
        limite: n.robusto ? null : 'Non regge alla correzione più severa: da trattare come indicativo.',
      }));
    }
  }

  // 2. La struttura sta cambiando? E' l'osservazione che nessuno fa, e quella
  //    che conta di piu': la diversificazione muore prima che si veda nei
  //    prezzi.
  const perStruttura = Object.entries(fonti)
    .filter(([k]) => !escludiDaStruttura.includes(k))
    .map(([, v]) => v.map((x) => (Number.isFinite(x) ? x : 0)));
  let struttura = null;
  if (perStruttura.length >= 4) {
    const rap = serieAssorbimento(perStruttura, { finestra: 250, passo: 5 });
    struttura = spostamentoAssorbimento(rap);
    if (struttura && Math.abs(struttura.spostamento) >= SOGLIA_STRUTTURA) {
      osservazioni.push(osservazione({
        tipo: 'struttura',
        testo: struttura.spostamento > 0
          ? `I mercati si stanno muovendo all'unisono molto più del solito: il ${Math.round(struttura.valoreRecente * 100)}% dei movimenti è una direzione comune, contro una media di lungo periodo del ${Math.round(struttura.mediaLunga * 100)}%. Avere molte cose diverse, in queste fasi, protegge meno di quanto sembri.`
          : `I mercati si stanno muovendo in modo molto più indipendente del solito: la diversificazione sta funzionando meglio della sua media.`,
        guardate: perStruttura.length, efficaci: null,
        limite: 'Descrive lo stato di adesso: sui nostri dati questo indicatore non ha anticipato in modo affidabile i rendimenti futuri.',
      }));
    }
  }

  const parla = osservazioni.length > 0;
  return {
    disponibile: true,
    parla,
    osservazioni,
    // Il conto di cio' che si e' guardato per NON dire niente: e' la parte che
    // rende il silenzio un'informazione invece di un'assenza.
    controllate: p.disponibile ? p.guardate : nomi.length,
    efficaci: p.disponibile ? p.fontiEfficaci : null,
    cieco: p.disponibile ? p.cieco : null,
    struttura,
    messaggio: parla
      ? osservazioni.map((o) => o.testo + (o.limite ? ` (${o.limite})` : '')).join(' ')
      : p.cieco
        ? `Ho controllato ${p.guardate} indicatori, ma con ${etichettaPeriodo} non potrei accorgermi di nulla nemmeno se fosse estremo: il silenzio, qui, non è una rassicurazione.`
        : `Ho controllato ${p.guardate} indicatori (${p.fontiEfficaci} direzioni davvero distinte) e la struttura del mercato: niente che meriti la tua attenzione. È la risposta di quasi tutti i giorni, ed è una buona notizia — non un'app che non ha trovato niente da dire.`,
  };
}

// ── Quando vale la pena disturbare una persona ──
// Regola dura: si notifica SOLO cio' che regge alla correzione piu' severa. Un
// avviso indicativo puo' stare in un pannello che l'utente apre quando vuole;
// interrompere qualcuno per un risultato fragile e' il modo di far spegnere le
// notifiche, e allora anche quella importante non arrivera' mai.
export function meritaNotifica(v) {
  if (!v?.parla) return false;
  return v.osservazioni.some((o) => !o.limite || o.tipo === 'struttura');
}

export function testoVeglia(v) {
  if (!v?.disponibile) return v?.motivo || null;
  return v.messaggio;
}
