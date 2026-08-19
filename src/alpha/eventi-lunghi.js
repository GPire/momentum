// ============================================================
// COSA E' SUCCESSO IN QUEL PERIODO — sui quarant'anni, non su cinque
// ============================================================
// BUG TROVATO PROVANDO L'APP DAL VIVO (2026-08-19), e del tipo peggiore: alla
// domanda "cosa e' successo nel 2008?" l'app rispondeva **"il mio archivio
// dettagliato parte dal 2021"**. Era vero quando fu scritta quella frase, ed
// era diventata FALSA nel momento in cui l'archivio giornaliero e' passato a
// partire dal 1985: l'app aveva i dati e diceva all'utente di non averli.
// Nessun test poteva accorgersene — la frase era corretta come stringa, e il
// modulo che la produceva guardava ancora solo il pannello a cinque anni.
//
// Lezione ripetuta due volte in questa sessione (l'altra e' la panoramica che
// diceva "cinque anni recenti"): **una descrizione dei dati scritta a mano
// invecchia insieme ai dati, e invecchia in silenzio**. Qui i limiti si
// leggono dall'archivio, non da una frase.
//
// Funzioni PURE.
'use strict';

import { GIORNALIERO_LUNGO, DATE_LUNGO, NOMI_LUNGO_GIORNI, GIORNI_LUNGO_DA } from './daily-long.js';

export const PRIMO_GIORNO = GIORNI_LUNGO_DA;

// La finestra fra due date, con quello che e' successo a ciascuna serie che
// esisteva davvero in quel periodo.
export function finestraLunga(da, a) {
  const iDa = DATE_LUNGO.findIndex((d) => d >= da);
  let iA = -1;
  for (let i = DATE_LUNGO.length - 1; i >= 0; i--) { if (DATE_LUNGO[i] <= a) { iA = i; break; } }
  if (iDa < 0 || iA < iDa) {
    return { trovato: false, motivo: `Nessun giorno di borsa fra ${da} e ${a}: l'archivio giorno per giorno parte dal ${GIORNI_LUNGO_DA}.` };
  }

  const perSerie = [];
  for (const [chiave, serie] of Object.entries(GIORNALIERO_LUNGO)) {
    const pezzo = serie.slice(iDa, iA + 1);
    const validi = pezzo.filter((x) => x !== null);
    // Una serie che in quel periodo non esisteva non va mostrata a zero: va
    // omessa. Uno zero direbbe "e' rimasta ferma", che e' un'altra cosa.
    if (validi.length < pezzo.length * 0.8 || validi.length < 3) continue;
    let comp = 1, peggiore = 0, iPeggiore = -1;
    for (let i = 0; i < pezzo.length; i++) {
      const v = pezzo[i];
      if (v === null) continue;
      comp *= (1 + v);
      if (v < peggiore) { peggiore = v; iPeggiore = iDa + i; }
    }
    perSerie.push({
      chiave, nome: NOMI_LUNGO_GIORNI[chiave] || chiave,
      totale: +(100 * (comp - 1)).toFixed(1),
      peggiorGiorno: +(100 * peggiore).toFixed(1),
      dataPeggiorGiorno: iPeggiore >= 0 ? DATE_LUNGO[iPeggiore] : null,
      giorni: validi.length,
    });
  }

  perSerie.sort((x, y) => x.totale - y.totale);
  return {
    trovato: true,
    da: DATE_LUNGO[iDa], a: DATE_LUNGO[iA],
    giorniDiBorsa: iA - iDa + 1,
    perSerie,
    // Le serie che in quel periodo NON esistevano: dichiararle e' piu' utile
    // che farle sparire, perche' spiega perche' l'elenco e' piu' corto.
    assenti: Object.keys(GIORNALIERO_LUNGO)
      .filter((k) => !perSerie.some((s) => s.chiave === k))
      .map((k) => NOMI_LUNGO_GIORNI[k] || k),
  };
}

// IL VIX NON E' UN INVESTIMENTO, e trattarlo come tale produce una frase
// falsa: nel 2008 e' salito del 77,8% e la prima versione di questo testo lo
// annunciava come "la migliore" del periodo. E' l'indice della PAURA — sale
// quando le cose vanno male. Chiamarlo il migliore dell'anno del crollo e'
// esattamente il tipo di errore che fa perdere fiducia in tutto il resto.
// Trovato leggendo la risposta vera, non da un test.
const NON_INVESTIBILI = new Set(['paura']);

export function finestraLungaText(f, etichetta = 'quel periodo') {
  if (!f?.trovato) return f?.motivo || null;
  const investibili = f.perSerie.filter((s) => !NON_INVESTIBILI.has(s.chiave));
  const peggio = investibili[0];
  const meglio = investibili[investibili.length - 1];
  const righe = [];

  // Niente preposizione davanti all'etichetta: "In il 2008" e' il terzo caso
  // di preposizione articolata concatenata in questa sessione. L'etichetta si
  // mette in apertura, con la maiuscola.
  const apertura = etichetta.charAt(0).toUpperCase() + etichetta.slice(1);
  righe.push(`${apertura}, ${f.giorniDiBorsa} giorni di borsa dal ${f.da} al ${f.a}.`);
  if (peggio) righe.push(`La cosa andata peggio e' stata ${peggio.nome.toLowerCase()} con ${peggio.totale}%, e il suo giorno peggiore e' stato il ${peggio.dataPeggiorGiorno} con ${peggio.peggiorGiorno}%.`);
  if (meglio && meglio.chiave !== peggio?.chiave) righe.push(`La migliore e' stata ${meglio.nome.toLowerCase()} con ${meglio.totale > 0 ? '+' : ''}${meglio.totale}%.`);

  const azioni = f.perSerie.find((s) => s.chiave === 'azioniUsa');
  if (azioni && azioni !== peggio) righe.push(`Le azioni americane hanno fatto ${azioni.totale > 0 ? '+' : ''}${azioni.totale}%, col giorno peggiore il ${azioni.dataPeggiorGiorno} a ${azioni.peggiorGiorno}%.`);

  // La paura si racconta come paura, non come rendimento.
  const vix = f.perSerie.find((s) => s.chiave === 'paura');
  if (vix) righe.push(`L'indice della paura e' ${vix.totale > 0 ? `salito del ${vix.totale}%` : `sceso del ${Math.abs(vix.totale)}%`}: non e' un investimento, misura quanta paura c'era.`);

  if (f.assenti.length) righe.push(`Non compaiono ${f.assenti.join(', ').toLowerCase()}: in quel periodo non esistevano ancora, e mostrarle a zero direbbe che erano ferme.`);

  righe.push('Sono fatti misurati sui prezzi di quei giorni, non una spiegazione delle cause.');
  return righe.join(' ');
}
