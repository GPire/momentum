// ============================================================
// QUANDO TUTTO DIVENTA UNA COSA SOLA
// ============================================================
// Tutto quello che il progetto misura finora guarda i LIVELLI: quanto e' alto
// l'indice di paura, quanto e' raro il valore di oggi, quanto ha reso un
// titolo. Ma il guasto che distrugge davvero i portafogli non e' un livello:
// e' un cambio di STRUTTURA. La diversificazione non fallisce perche' un
// numero diventa grande — fallisce perche' cose che si muovevano in modo
// indipendente cominciano a muoversi insieme, e quasi sempre lo fanno
// **prima** che il calo si veda nei prezzi.
//
// Chi ha dieci investimenti diversi crede di avere dieci scommesse. Quando le
// correlazioni salgono ne ha una sola, con dieci nomi. E' la ragione per cui
// nel 2008 "portafogli diversificati" sono scesi tutti insieme.
//
// ── LA MISURA, che esiste ed e' pubblicata ──
// Il RAPPORTO DI ASSORBIMENTO (Kritzman, Li, Page, Rigobon 2011, "Principal
// Components as a Measure of Systemic Risk"): la quota di variabilita' totale
// spiegata dalle prime poche componenti principali. E' la traduzione esatta di
// "quanto tutto si sta muovendo come una cosa sola", e si calcola dagli
// autovalori della matrice di correlazione — che questo progetto sa gia'
// calcolare (panoramica-incrociata.js, Jacobi scritto da zero).
//   · valore basso  -> molte direzioni indipendenti, la diversificazione c'e';
//   · valore alto   -> una sola direzione domina, i pezzi sono lo stesso pezzo.
// La proprieta' documentata dagli autori: **sale prima dei cali**, perche' la
// fragilita' si accumula prima di manifestarsi.
//
// ── E QUI VIENE LA PARTE CHE IL PROGETTO NON PUO' SALTARE ──
// Una misura pubblicata non e' una misura verificata sui NOSTRI dati. Il
// progetto ha gia' smontato con la validazione walk-forward la fama della
// curva dei rendimenti (a 6 mesi il segnale e' girato al contrario). Quindi
// qui il rapporto di assorbimento **viene validato allo stesso modo, e il
// risultato viene riportato qualunque sia** — anche se dice che non funziona.
// La funzione `validaAssorbimento` fa esattamente questo: nessuna soglia
// scelta guardando i dati, nessun periodo scelto a posteriori.
//
// Funzioni PURE.
'use strict';

import { autovaloriSimmetrica, matriceCorrelazione } from './panoramica-incrociata.js';

// Quante componenti considerare "la parte comune". Gli autori usano circa un
// quinto delle serie; con poche serie si tiene almeno una.
export const QUOTA_COMPONENTI = 0.2;

export function numeroComponenti(nSerie) {
  return Math.max(1, Math.round(nSerie * QUOTA_COMPONENTI));
}

// Il rapporto su UNA finestra: quota di varianza spiegata dalle prime
// componenti. Fra 0 e 1.
export function rapportoAssorbimento(serieFinestra = []) {
  const valide = serieFinestra.filter((s) => Array.isArray(s) && s.filter(Number.isFinite).length >= 3);
  if (valide.length < 3) return null;
  const lambda = autovaloriSimmetrica(matriceCorrelazione(valide)).map((v) => Math.max(0, v));
  const totale = lambda.reduce((s, v) => s + v, 0);
  if (!(totale > 0)) return null;
  const k = numeroComponenti(valide.length);
  const prime = lambda.slice(0, k).reduce((s, v) => s + v, 0);
  return {
    valore: +(prime / totale).toFixed(4),
    componenti: k,
    serie: valide.length,
    // Il minimo possibile: se le serie fossero perfettamente indipendenti
    // ogni autovalore varrebbe 1, e le prime k spiegherebbero k/n. Serve a
    // capire se un valore alto sia davvero alto o solo aritmetica.
    minimoPossibile: +(k / valide.length).toFixed(4),
  };
}

// La serie storica del rapporto, finestra scorrevole. E' la grandezza da
// guardare: il livello assoluto dipende da quante serie ci sono, la sua
// VARIAZIONE no.
export function serieAssorbimento(serie = [], { finestra = 250, passo = 5 } = {}) {
  const lung = Math.min(...serie.map((s) => s.length));
  if (!Number.isFinite(lung) || lung < finestra + passo) return [];
  const out = [];
  for (let fine = finestra; fine <= lung; fine += passo) {
    const pezzo = serie.map((s) => s.slice(fine - finestra, fine));
    const r = rapportoAssorbimento(pezzo);
    if (r) out.push({ fine, valore: r.valore });
  }
  return out;
}

// ── LO SPOSTAMENTO, che e' il segnale vero ──
// Gli autori non guardano il livello ma il suo spostamento standardizzato: di
// quanto il valore di adesso si discosta dalla sua media di lungo periodo,
// misurato nella sua stessa dispersione. Un livello alto puo' essere normale
// per quel paniere; uno spostamento no.
export function spostamentoAssorbimento(serieRapporto = [], { breve = 15, lungo = 100 } = {}) {
  const v = serieRapporto.map((x) => x.valore).filter(Number.isFinite);
  if (v.length < lungo + breve) return null;
  const recente = v.slice(-breve);
  const storico = v.slice(-lungo - breve, -breve);
  const mediaB = recente.reduce((a, b) => a + b, 0) / recente.length;
  const mediaL = storico.reduce((a, b) => a + b, 0) / storico.length;
  const sd = Math.sqrt(storico.reduce((s, x) => s + (x - mediaL) ** 2, 0) / Math.max(1, storico.length - 1));
  if (!(sd > 0)) return null;
  return {
    valoreRecente: +mediaB.toFixed(4),
    mediaLunga: +mediaL.toFixed(4),
    spostamento: +((mediaB - mediaL) / sd).toFixed(3),
  };
}

// ── LA VALIDAZIONE, e qui non si bara ──
// Domanda: uno spostamento verso l'alto e' seguito da rendimenti peggiori?
// Si confrontano i rendimenti futuri dopo gli spostamenti ALTI contro quelli
// dopo gli spostamenti BASSI, con la soglia fissata a un quantile DICHIARATO
// (non scelto guardando i risultati) e la significativita' da permutazione a
// blocchi — la stessa disciplina di previsione-condizionata.js, perche' le
// finestre future si sovrappongono anche qui.
export function validaAssorbimento(serie = [], rendimentiMercato = [], {
  finestra = 250, passo = 5, breve = 15, lungo = 100,
  orizzonte = 21, quantile = 0.8, permutazioni = 499, rng = Math.random,
} = {}) {
  const rapporti = serieAssorbimento(serie, { finestra, passo });
  if (rapporti.length < lungo + breve + 10) {
    return { disponibile: false, motivo: `Servono più finestre per validare: qui ce ne sono ${rapporti.length}.` };
  }

  // Per ogni punto: spostamento in quel momento, e rendimento composto nei
  // successivi `orizzonte` giorni. Nessun dato futuro entra nello spostamento.
  const punti = [];
  const v = rapporti.map((x) => x.valore);
  for (let i = lungo + breve; i < rapporti.length; i++) {
    const recente = v.slice(i - breve, i);
    const storico = v.slice(i - breve - lungo, i - breve);
    const mB = recente.reduce((a, b) => a + b, 0) / recente.length;
    const mL = storico.reduce((a, b) => a + b, 0) / storico.length;
    const sd = Math.sqrt(storico.reduce((s, x) => s + (x - mL) ** 2, 0) / Math.max(1, storico.length - 1));
    if (!(sd > 0)) continue;

    const fine = rapporti[i].fine;
    if (fine + orizzonte >= rendimentiMercato.length) continue;
    let comp = 1, valido = true;
    for (let k = fine; k < fine + orizzonte; k++) {
      const r = rendimentiMercato[k];
      if (!Number.isFinite(r)) { valido = false; break; }
      comp *= (1 + r);
    }
    if (!valido) continue;
    punti.push({ spostamento: (mB - mL) / sd, futuro: comp - 1 });
  }

  if (punti.length < 40) return { disponibile: false, motivo: `Solo ${punti.length} osservazioni utilizzabili: troppo poche.` };

  const ordinati = [...punti].map((p) => p.spostamento).sort((a, b) => a - b);
  const soglia = ordinati[Math.floor(ordinati.length * quantile)];
  const alti = punti.filter((p) => p.spostamento >= soglia).map((p) => p.futuro);
  const bassi = punti.filter((p) => p.spostamento < soglia).map((p) => p.futuro);
  if (alti.length < 10 || bassi.length < 10) return { disponibile: false, motivo: 'Gruppi troppo sbilanciati per un confronto.' };

  const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const differenza = med(alti) - med(bassi);

  // Permutazione A BLOCCHI: le finestre future si sovrappongono, e mescolare
  // punto per punto gonfierebbe la significativita' — lo stesso errore da
  // fattore cento gia' misurato in previsione-condizionata.js.
  const tutti = punti.map((p) => p.futuro);
  const blocco = Math.max(1, Math.ceil(orizzonte / passo));
  const nBlocchi = Math.ceil(tutti.length / blocco);
  let estremi = 0;
  for (let p = 0; p < permutazioni; p++) {
    const ordine = Array.from({ length: nBlocchi }, (_, k) => k);
    for (let k = ordine.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [ordine[k], ordine[j]] = [ordine[j], ordine[k]]; }
    const mesc = [];
    for (const b of ordine) mesc.push(...tutti.slice(b * blocco, (b + 1) * blocco));
    const a2 = mesc.slice(0, alti.length), b2 = mesc.slice(alti.length);
    if (a2.length < 5 || b2.length < 5) continue;
    if (Math.abs(med(a2) - med(b2)) >= Math.abs(differenza)) estremi++;
  }
  const pv = (estremi + 1) / (permutazioni + 1);

  return {
    disponibile: true,
    osservazioni: punti.length,
    osservazioniIndipendenti: Math.floor(punti.length / blocco),
    orizzonte,
    sogliaSpostamento: +soglia.toFixed(3),
    medianaDopoAlti: +(100 * med(alti)).toFixed(2),
    medianaDopoBassi: +(100 * med(bassi)).toFixed(2),
    differenza: +(100 * differenza).toFixed(2),
    p: +pv.toFixed(3),
    // Il verso atteso dalla letteratura: dopo spostamenti ALTI i rendimenti
    // dovrebbero essere PEGGIORI. Si dichiara anche se esce il contrario.
    versoAtteso: differenza < 0,
    funziona: pv < 0.05 && differenza < 0,
    messaggio: pv >= 0.05
      ? `Sui nostri dati la differenza (${(100 * differenza).toFixed(2)} punti a ${orizzonte} giorni) NON è distinguibile dal caso: probabilità che sia fortuna ${pv.toFixed(3)}, su circa ${Math.floor(punti.length / blocco)} osservazioni davvero indipendenti. La misura è pubblicata e sensata, ma qui non si conferma — e vale più dirlo che ripetere la citazione.`
      : differenza < 0
        ? `Dopo gli spostamenti alti il rendimento mediano a ${orizzonte} giorni è stato ${(100 * differenza).toFixed(2)} punti peggiore (probabilità che sia fortuna: ${pv.toFixed(3)}). Va nel verso previsto dalla letteratura.`
        : `Il legame è distinguibile dal caso ma va nel verso OPPOSTO a quello atteso: dopo gli spostamenti alti il rendimento è stato migliore. Da trattare con sospetto — è il tipo di risultato che di solito non regge fuori campione.`,
  };
}

// Cosa dire all'utente sullo stato di ADESSO. Mai un allarme: una descrizione.
export function testoAssorbimento(spost, validazione = null) {
  if (!spost) return null;
  const righe = [];
  righe.push(`Quanto i tuoi mercati si muovono come una cosa sola: ${Math.round(spost.valoreRecente * 100)}% della loro variabilità è una direzione comune (media di lungo periodo: ${Math.round(spost.mediaLunga * 100)}%).`);
  righe.push(spost.spostamento > 1
    ? 'Si stanno muovendo più all\'unisono del solito: in queste fasi avere molte cose diverse protegge meno di quanto sembri, perché sono meno diverse di quanto sembrino.'
    : spost.spostamento < -1
      ? 'Si stanno muovendo in modo più indipendente del solito: la diversificazione, adesso, sta funzionando meglio della sua media.'
      : 'È in linea con la sua media di lungo periodo: niente di particolare da segnalare.');
  if (validazione?.disponibile) {
    righe.push(validazione.funziona
      ? `Verificato sui nostri dati: storicamente questo indicatore ha anticipato rendimenti peggiori.`
      : `Onestà: sui nostri dati questo indicatore NON ha anticipato in modo distinguibile i rendimenti futuri. Descrive quanto la diversificazione stia funzionando adesso, non cosa succederà.`);
  }
  return righe.join(' ');
}
