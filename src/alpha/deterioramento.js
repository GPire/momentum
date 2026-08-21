// ============================================================
// ACCORGERSENE PRIMA — e la prova che si possa
// ============================================================
// LA DOMANDA, ed e' quella che un analista di credito si fa davvero: quando
// un'azienda finisce sotto soglia, si poteva vedere arrivare?
//
// Non e' previsione dei prezzi — questa sessione ha misurato piu' volte che
// quella non funziona, e continua a non funzionare. E' una cosa piu' modesta e
// piu' solida: i conti si deteriorano lentamente, e un numero che scende per
// tre anni prima di sfondare la soglia e' visibile prima di sfondarla.
// Se e' vero. Ed e' esattamente cio' che qui si mette alla prova.
//
// ── IL SEGNALE, deliberatamente semplice ──
// Tre esercizi consecutivi in calo, ancora SOPRA soglia. Nessun parametro da
// tarare, nessuna curva da adattare: piu' un segnale e' semplice, meno modi ha
// di essere stato costruito a posteriori sui dati che poi lo confermano.
//
// ── LA VALIDAZIONE, che e' il vero contenuto del file ──
// Si scorre ogni azienda anno per anno, e in ogni anno si guarda SOLO il
// passato: nessun dato futuro entra nella decisione. Poi si conta:
//  · quante volte il segnale ha preceduto una caduta sotto soglia entro due
//    anni (allarmi utili);
//  · quante volte ha suonato e non e' successo niente (falsi allarmi);
//  · quante cadute sono arrivate senza nessun preavviso (mancate).
// E soprattutto si confronta con il TASSO DI BASE: se le cadute avvengono nel
// 30% degli anni comunque, un segnale che ne indovina il 30% non sta
// segnalando niente. E' la stessa disciplina applicata alla curva dei
// rendimenti e al rapporto di assorbimento, e in entrambi i casi il verdetto
// e' stato negativo. Qui si vedra'.
//
// ── E IL VERDETTO E' NEGATIVO ANCHE QUI. Misurato su 82 aziende:
//     ROE      587 esercizi valutati, 134 cadute -> tasso di base 22,8%
//              segnale scattato 81 volte, giusto 21 -> precisione 25,9%
//              guadagno 1,14 volte il caso: praticamente niente
//     MARGINE  655 esercizi, 148 cadute -> tasso di base 22,6%
//              scattato 67 volte, giusto 13 -> precisione 19,4%
//              guadagno 0,86: PEGGIO del caso
//
// Cioe': "i conti scendono da tre anni" non dice quasi nulla su dove saranno
// fra due. L'intuizione e' fortissima — un declino si vede arrivare — e i
// bilanci depositati di ottantadue aziende dicono di no.
// La ragione plausibile, e vale la pena scriverla: un'azienda che scende per
// tre anni molto spesso RISALE, perche' i conti aziendali sono ciclici e
// perche' chi la dirige reagisce proprio quando i numeri peggiorano. Il calo
// non e' l'inizio di una caduta: e' la parte bassa di un'oscillazione.
//
// QUESTO MODULO RESTA, e non e' uno spreco: il suo valore e' la MISURA, non
// il segnale. Serve a impedire che qualcuno — noi compresi, fra sei mesi —
// aggiunga "attenzione, i conti scendono da tre anni" credendo di dare un
// preavviso. Il numero per rispondere e' qui.
//
// Funzioni PURE.
'use strict';

import { FONDAMENTALI_STORICI } from './fondamentali-storici.js';
import { SOGLIE } from './qualita-nel-tempo.js';

export const ANNI_DI_CALO = 3;
export const ORIZZONTE = 2; // entro quanti esercizi deve arrivare la caduta

// Il segnale all'anno `i`, guardando SOLO i valori fino a li'.
export function segnaleAllAnno(valori, i, soglia) {
  if (i < ANNI_DI_CALO - 1) return false;
  const finestra = valori.slice(i - ANNI_DI_CALO + 1, i + 1);
  if (finestra.some((v) => !Number.isFinite(v))) return false;
  if (finestra[finestra.length - 1] < soglia) return false; // gia' caduta: non e' un preavviso
  for (let k = 1; k < finestra.length; k++) if (finestra[k] >= finestra[k - 1]) return false;
  return true;
}

// La validazione su TUTTE le aziende dell'archivio.
export function validaPreavviso({ misura = 'roe', orizzonte = ORIZZONTE } = {}) {
  const soglia = SOGLIE[misura];
  let utili = 0, falsi = 0, mancate = 0, anniValutati = 0, cadute = 0;
  const esempi = [];

  for (const [ticker, d] of Object.entries(FONDAMENTALI_STORICI)) {
    const anni = d.anni.filter((x) => Number.isFinite(x[misura]));
    if (anni.length < ANNI_DI_CALO + orizzonte + 2) continue;
    const v = anni.map((x) => x[misura]);

    for (let i = ANNI_DI_CALO - 1; i < v.length - orizzonte; i++) {
      // Si valuta solo dagli anni in cui l'azienda e' ANCORA sopra soglia:
      // "preavviso" ha senso solo prima della caduta.
      if (v[i] < soglia) continue;
      anniValutati++;
      const cadraPresto = v.slice(i + 1, i + 1 + orizzonte).some((x) => x < soglia);
      if (cadraPresto) cadute++;
      const suona = segnaleAllAnno(v, i, soglia);
      if (suona && cadraPresto) {
        utili++;
        if (esempi.length < 6) esempi.push({ ticker, nome: d.nome, anno: anni[i].anno, valore: +v[i].toFixed(3) });
      } else if (suona) falsi++;
      else if (cadraPresto) mancate++;
    }
  }

  const suonate = utili + falsi;
  const precisione = suonate ? utili / suonate : null;       // quando suona, quanto spesso ha ragione
  const richiamo = cadute ? utili / cadute : null;           // delle cadute, quante ne ha viste
  const tassoDiBase = anniValutati ? cadute / anniValutati : null; // quante cadute ci sono comunque

  return {
    misura, soglia, orizzonte,
    anniValutati, cadute, suonate, utili, falsi, mancate,
    precisione: precisione === null ? null : +precisione.toFixed(3),
    richiamo: richiamo === null ? null : +richiamo.toFixed(3),
    tassoDiBase: tassoDiBase === null ? null : +tassoDiBase.toFixed(3),
    // IL CONFRONTO CHE DECIDE: precisione contro tasso di base. Un segnale che
    // ha ragione quanto il caso non sta segnalando niente.
    guadagno: (precisione !== null && tassoDiBase) ? +(precisione / tassoDiBase).toFixed(2) : null,
    funziona: precisione !== null && tassoDiBase !== null && precisione > tassoDiBase * 1.3,
    esempi,
  };
}

export function testoPreavviso(v) {
  if (!v || v.suonate === 0) return 'Il segnale non e\' mai scattato sull\'archivio: non c\'e\' niente da validare.';
  const pc = (x) => `${Math.round(x * 100)}%`;
  const righe = [];

  righe.push(`Su ${v.anniValutati} esercizi in cui l'azienda era ancora sopra soglia, in ${v.cadute} e' arrivata una caduta entro ${v.orizzonte} anni: cioe' capita comunque nel ${pc(v.tassoDiBase)} dei casi. E' il numero da battere.`);
  righe.push(`Il segnale — tre esercizi consecutivi in calo, ancora sopra soglia — e' scattato ${v.suonate} volte e ha avuto ragione ${v.utili}: precisione ${pc(v.precisione)}.`);

  righe.push(v.funziona
    ? `Vuol dire ${v.guadagno} volte meglio del caso: quando i conti scendono per tre anni di fila, la caduta arriva molto piu' spesso del normale. Non e' una previsione dei prezzi — e' un deterioramento che si vedeva.`
    : `Contro un tasso di base del ${pc(v.tassoDiBase)}, non e' una differenza che valga qualcosa: il segnale suona quasi quanto capiterebbe comunque, e presentarlo come preavviso sarebbe vendere rumore.`);

  righe.push(`Delle ${v.cadute} cadute ne ha viste arrivare ${v.utili} (${pc(v.richiamo)}): le altre ${v.mancate} sono arrivate senza preavviso, e nessun segnale semplice le avrebbe prese.`);
  righe.push('Validato sui bilanci depositati, guardando in ogni anno solo il passato: nessun dato futuro e\' entrato nella decisione.');
  return righe.join(' ');
}
