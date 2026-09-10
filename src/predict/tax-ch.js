// ============================================================
// INDIPENDENTI SVIZZERI — AVS/AI/APG + IVA, modulo separato (non P.IVA)
// ============================================================
// La Svizzera NON ha un equivalente della "Partita IVA" italiana: nessun
// regime forfettario/ordinario da scegliere, nessuno SdI da caricare (nessun
// obbligo di fattura elettronica B2B/B2C — verificato, solo gli appalti
// pubblici federali sopra CHF 5.000 lo richiedono). Per questo è un modulo
// SEPARATO da tax.js/fatturapa-xml.js, non un adattamento — i concetti non
// corrispondono, forzarli insieme produrrebbe calcoli sbagliati.
//
// Verificato incrociando più fonti indipendenti (agosto 2026): alpineexcellence.ch,
// nsixtalent.ch, ax-fiduciaire.ch, findea.ch, ahv-iv.ch (fonte ufficiale),
// tobill.ch, quaderno.io, scalemetrics.ai (AVS/IVA Svizzera 2026).
//
// LIMITE ONESTO E DICHIARATO: sotto CHF 60.500/anno di reddito, l'AVS
// applica una "scala degressiva" (dal 5,371% al 10,6%) calcolata dagli
// uffici di compensazione con tabelle ufficiali — NON una formula pubblica
// semplice che si possa riprodurre onestamente qui. Sopra quella soglia
// l'aliquota è piatta al 10% ed è quella che calcoliamo. Sotto, indichiamo
// il contributo minimo annuo verificato e rimandiamo al calcolatore
// ufficiale (ahv-iv.ch), mai una stima inventata spacciata per precisa.
'use strict';

export const AVS_ALIQUOTA_PIENA = 0.10; // da CHF 60.500/anno di reddito
export const AVS_SOGLIA_ALIQUOTA_PIENA = 60500;
export const AVS_CONTRIBUTO_MINIMO_ANNUO = 530;
export const AVS_CALCOLATORE_UFFICIALE_URL = 'https://www.ahv-iv.ch';

// ATTIVITÀ PRINCIPALE vs ACCESSORIA (2026-09-06) — BUG REALE trovato
// analizzando un audit esterno: computeAvsIndipendente presumeva SEMPRE
// "attività principale" (contributi dovuti dal PRIMO franco, minimo
// CHF 530 da CHF 1 in su). Per un'attività ACCESSORIA la regola è diversa
// e verificata su fonte primaria/fonti concordanti (ahv-iv.ch, medisuisse.ch,
// raiffeisen.ch, swisslife.ch, 2026-09-06):
//   < CHF 2.300/anno: iscrizione FACOLTATIVA se almeno una condizione vera
//     (già dipendente altrove, disoccupazione, o coniuge/partner registrato
//     che copre l'economia domestica versando almeno CHF 964/anno di AVS).
//   CHF 2.500-10.100/anno: contributo minimo CHF 530 (STESSO importo
//     dell'attività principale, ma la soglia di ENTRATA nell'obbligo è più
//     alta: sotto CHF 2.500 generalmente non si versa nulla per l'attività
//     accessoria, a differenza della principale dove si versa dal 1° franco).
// Assumere "principale" quando non specificato resta la scelta prudente
// (mai sottostimare un obbligo), ma per chi DICE esplicitamente che è
// un'attività accessoria e guadagna poco, dire "minimo CHF 530" sarebbe un
// numero sbagliato nella direzione opposta: gli si chiederebbe di
// accantonare per un obbligo che, sotto CHF 2.500, probabilmente non ha.
export const AVS_SOGLIA_ACCESSORIA_OBBLIGO = 2500;
export const AVS_SOGLIA_ACCESSORIA_FACOLTATIVA = 2300;

export const IVA_CH = {
  standard: 0.081,
  ridotta: 0.026, // beni di prima necessità, libri, farmaci...
  speciale: 0.038, // settore alberghiero
};
export const IVA_CH_SOGLIA_OBBLIGO = 100000; // fatturato annuo mondiale, CHF

// Contributi AVS/AI/APG per un indipendente. Sopra soglia: aliquota piena
// piatta, un calcolo reale. Sotto soglia: MAI un numero inventato — si
// dichiara il minimo verificato e si rimanda al calcolatore ufficiale.
// `opts.attivitaAccessoria` (2026-09-06): di default `false` (principale,
// la scelta prudente — mai sottostimare un obbligo quando non specificato).
export function computeAvsIndipendente(redditoAnnuo, opts = {}) {
  const reddito = Math.max(0, +redditoAnnuo || 0);
  const accessoria = opts.attivitaAccessoria === true;
  if (reddito === 0) {
    return { contributo: 0, aliquota: 0, fasciaPiena: false, nota: null };
  }
  // Attività ACCESSORIA sotto la soglia d'obbligo (CHF 2.500): a differenza
  // della principale (dovuta dal 1° franco), qui non si presume un minimo —
  // sotto CHF 2.300 l'iscrizione è perfino facoltativa a certe condizioni.
  if (accessoria && reddito < AVS_SOGLIA_ACCESSORIA_OBBLIGO) {
    return {
      contributo: null,
      aliquota: null,
      fasciaPiena: false,
      sottoSogliaAccessoria: true,
      nota: `Come attività ACCESSORIA, sotto CHF ${AVS_SOGLIA_ACCESSORIA_OBBLIGO.toLocaleString('it-CH')}/anno generalmente non versi contributi AVS per questa attività (a differenza di un'attività principale, dovuta dal primo franco). Sotto CHF ${AVS_SOGLIA_ACCESSORIA_FACOLTATIVA.toLocaleString('it-CH')}/anno l'iscrizione è addirittura facoltativa se sei già dipendente altrove, disoccupato/a, o il tuo coniuge/partner registrato versa almeno CHF 964/anno di AVS coprendo l'economia domestica. Verifica il tuo caso su ${AVS_CALCOLATORE_UFFICIALE_URL}.`,
    };
  }
  if (reddito >= AVS_SOGLIA_ALIQUOTA_PIENA) {
    return {
      contributo: +(reddito * AVS_ALIQUOTA_PIENA).toFixed(2),
      aliquota: AVS_ALIQUOTA_PIENA,
      fasciaPiena: true,
      nota: null,
    };
  }
  return {
    contributo: null, // MAI stimato: la scala degressiva non ha una formula pubblica semplice
    aliquota: null,
    fasciaPiena: false,
    contributoMinimoAnnuo: AVS_CONTRIBUTO_MINIMO_ANNUO,
    nota: `Sotto CHF ${AVS_SOGLIA_ALIQUOTA_PIENA.toLocaleString('it-CH')}/anno l'AVS applica una scala degressiva (dal 5,371% al 10,6%) calcolata dal tuo ufficio di compensazione — non è una formula pubblica semplice, quindi non la stimiamo qui. Il minimo verificato è CHF ${AVS_CONTRIBUTO_MINIMO_ANNUO}/anno. Calcola l'importo esatto su ${AVS_CALCOLATORE_UFFICIALE_URL}.`,
  };
}

// L'IVA svizzera è obbligatoria solo sopra la soglia — molti piccoli
// indipendenti non sono nemmeno registrati, a differenza dell'Italia dove
// la Partita IVA è obbligatoria dal primo franco. Dirlo esplicitamente
// evita l'errore più comune: registrarsi all'IVA senza doverlo fare.
export function ivaObbligatoriaCh(fatturatoAnnuo) {
  const fatturato = Math.max(0, +fatturatoAnnuo || 0);
  const obbligatoria = fatturato >= IVA_CH_SOGLIA_OBBLIGO;
  return {
    obbligatoria,
    sogliaCHF: IVA_CH_SOGLIA_OBBLIGO,
    messaggio: obbligatoria
      ? `Sopra CHF ${IVA_CH_SOGLIA_OBBLIGO.toLocaleString('it-CH')}/anno di fatturato mondiale: la registrazione IVA è obbligatoria.`
      : `Sotto CHF ${IVA_CH_SOGLIA_OBBLIGO.toLocaleString('it-CH')}/anno: NON sei obbligato a registrarti all'IVA (puoi farlo comunque volontariamente per detrarre l'IVA sugli acquisti — valuta col tuo consulente se conviene).`,
  };
}
