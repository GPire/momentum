// ============================================================
// COSA È SUCCESSO STORICAMENTE DOPO UN PATTERN SIMILE — per asset singolo
// ============================================================
// La via di mezzo decisa esplicitamente il 2026-09-11 dopo aver segnalato il
// rischio legale: MAI un prezzo futuro, MAI un segnale compra/vendi — SOLO
// "quante volte, su quanti casi, storicamente, dopo un pattern simile in
// QUESTO asset, il mercato si è mosso in un certo modo". Stessa disciplina
// già in uso in `cicli.js` (frequenza storica condizionata, mai un punto
// stimato), applicata qui al pannello giornaliero di 40 anni (`daily-long.js`,
// 1985-2026, azioni USA/Nasdaq/Russell 2000/oro/argento/rame/petrolio/
// bitcoin) invece che alla griglia annuale a 10 mercati — molte più
// osservazioni indipendenti, e con Bitcoin dentro per la prima volta in
// questo genere di analisi.
//
// ONESTÀ (regola #1): ogni risultato dichiara QUANTI episodi lo sostengono
// (mai una percentuale su troppo pochi casi), e gli episodi sono resi NON
// sovrapposti per costruzione (si salta in avanti dell'intero orizzonte dopo
// ogni trigger trovato) — altrimenti un solo ribasso prolungato genererebbe
// decine di "episodi" quasi identici, gonfiando artificialmente il conteggio
// (lo stesso errore, in forma diversa, già evitato in cicli.js con gli anni
// consecutivi in salita).
// Funzioni PURE.
'use strict';

import { GIORNALIERO_LUNGO, DATE_LUNGO, NOMI_LUNGO_GIORNI } from './daily-long.js';
export { NOMI_LUNGO_GIORNI } from './daily-long.js';

const MIN_CASI_DEFAULT = 10;

// Rendimento composto della serie fra gli indici [da, a) — null se manca
// anche un solo giorno nella finestra (mai un'interpolazione silenziosa).
function rendimentoComposto(serie, da, a) {
  let comp = 1;
  for (let j = da; j < a; j++) {
    if (serie[j] === null) return null;
    comp *= (1 + serie[j]);
  }
  return comp - 1;
}

// Trova ogni episodio in cui la serie `chiave` ha superato la soglia
// (caduta o salita) sulla finestra scelta, e misura cosa è successo nei
// `orizzonteGiorni` successivi. Episodi NON sovrapposti: dopo un trigger si
// salta avanti dell'intero orizzonte prima di cercarne un altro.
export function episodiPattern(chiave, {
  direzione = 'caduta', soglia = 0.10, finestraGiorni = 20, orizzonteGiorni = 20,
} = {}) {
  const serie = GIORNALIERO_LUNGO[chiave];
  if (!serie) return { trovato: false, motivo: `asset sconosciuto: "${chiave}"` };
  if (!Number.isFinite(soglia) || soglia <= 0) return { trovato: false, motivo: 'la soglia deve essere positiva (es. 0.10 = 10%)' };
  if (!['caduta', 'salita'].includes(direzione) || !Number.isInteger(finestraGiorni) || finestraGiorni < 1
    || !Number.isInteger(orizzonteGiorni) || orizzonteGiorni < 1) {
    return { trovato: false, motivo: 'direzione o numero di giorni non valido' };
  }
  const nome = NOMI_LUNGO_GIORNI[chiave] || chiave;
  const episodi = [];
  let i = finestraGiorni;
  while (i + orizzonteGiorni < serie.length) {
    const mossa = rendimentoComposto(serie, i - finestraGiorni, i);
    const scattato = mossa !== null && (direzione === 'caduta' ? mossa <= -soglia : mossa >= soglia);
    if (scattato) {
      const dopo = rendimentoComposto(serie, i, i + orizzonteGiorni);
      if (dopo !== null) {
        episodi.push({
          dataInizio: DATE_LUNGO[i - finestraGiorni], dataTrigger: DATE_LUNGO[i],
          mossa: +mossa.toFixed(4), dopo: +dopo.toFixed(4),
        });
      }
      i += orizzonteGiorni; // salta l'intero orizzonte: episodi mai sovrapposti
    } else {
      i += 1;
    }
  }
  return {
    trovato: true, chiave, nome,
    criterio: { direzione, soglia, finestraGiorni, orizzonteGiorni },
    episodi,
  };
}

// Riassunto statistico di una lista di episodi — stessa forma di `riassumi`
// in cicli.js (mediano + code, non solo la media): gli estremi contano più
// della media per chi deve decidere se reggere una posizione o uscirne nel
// momento peggiore. `abbastanza:false` sotto la soglia minima di casi — MAI
// una percentuale mostrata su un campione troppo piccolo per significare
// qualcosa.
export function riassumiEpisodi(episodi, { minCasi = MIN_CASI_DEFAULT } = {}) {
  if (!episodi || episodi.length < minCasi) {
    return { casi: episodi ? episodi.length : 0, minCasi, abbastanza: false };
  }
  const ord = episodi.map((e) => e.dopo).sort((a, b) => a - b);
  const q = (p) => ord[Math.min(ord.length - 1, Math.floor(p * ord.length))];
  return {
    casi: episodi.length, minCasi, abbastanza: true,
    mediano: +q(0.5).toFixed(4),
    quotaInGuadagno: +(episodi.filter((e) => e.dopo > 0).length / episodi.length).toFixed(3),
    peggioreDecile: +q(0.1).toFixed(4),
    miglioreDecile: +q(0.9).toFixed(4),
    primaData: episodi[0].dataTrigger, ultimaData: episodi[episodi.length - 1].dataTrigger,
  };
}

// Chiama insieme episodiPattern+riassumiEpisodi per UN asset — la forma che
// la UI/QA consumerà davvero, un solo punto d'ingresso.
export function cosaSuccedeDopoAsset(chiave, opzioni = {}) {
  const ep = episodiPattern(chiave, opzioni);
  if (!ep.trovato) return ep;
  return { ...ep, riassunto: riassumiEpisodi(ep.episodi, opzioni) };
}

// Stessa domanda su OGNI asset del pannello, per confrontare: un ribasso del
// 10% si comporta allo stesso modo su azioni/oro/bitcoin, o no? Ogni asset
// porta con sé il proprio riassunto (o `abbastanza:false` se non ha
// abbastanza episodi — un asset più giovane, es. bitcoin, ne avrà
// strutturalmente meno: dichiarato, non nascosto).
export function confrontoAsset(opzioni = {}) {
  const chiavi = Object.keys(GIORNALIERO_LUNGO);
  return chiavi.map((chiave) => {
    const r = cosaSuccedeDopoAsset(chiave, opzioni);
    return r.trovato ? { chiave, nome: r.nome, ...r.riassunto } : { chiave, trovato: false, motivo: r.motivo };
  });
}

// Testo onesto, mai un consiglio: descrive la frequenza storica misurata,
// dichiara sempre quanti casi la sostengono, non nomina mai un'azione da
// intraprendere ("compra"/"vendi"/"aspettati").
export function patternStoricoText(risultato) {
  if (!risultato || !risultato.trovato) return risultato?.motivo || 'Dati non disponibili.';
  const { nome, criterio, riassunto: r } = risultato;
  const verbo = criterio.direzione === 'caduta' ? 'sceso' : 'salito';
  const pct = (x) => `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  if (!r.abbastanza) {
    return `${nome}: solo ${r.casi} caso/i storico/i in cui è ${verbo} di almeno ${(criterio.soglia * 100).toFixed(0)}% in ${criterio.finestraGiorni} giorni di borsa — troppo pochi per dire qualcosa di credibile (servono almeno ${r.minCasi}).`;
  }
  return `${nome}: quando è ${verbo} di almeno ${(criterio.soglia * 100).toFixed(0)}% in ${criterio.finestraGiorni} giorni di borsa (${r.casi} casi fra ${r.primaData} e ${r.ultimaData}), nei ${criterio.orizzonteGiorni} giorni successivi il risultato mediano è stato ${pct(r.mediano)}, positivo nel ${Math.round(r.quotaInGuadagno * 100)}% dei casi. Il decimo peggiore: ${pct(r.peggioreDecile)}. Il decimo migliore: ${pct(r.miglioreDecile)}. Questa è una frequenza storica misurata, non una previsione: il prossimo caso può andare diversamente.`;
}
