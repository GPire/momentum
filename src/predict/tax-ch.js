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

export const IVA_CH = {
  standard: 0.081,
  ridotta: 0.026, // beni di prima necessità, libri, farmaci...
  speciale: 0.038, // settore alberghiero
};
export const IVA_CH_SOGLIA_OBBLIGO = 100000; // fatturato annuo mondiale, CHF

// Contributi AVS/AI/APG per un indipendente. Sopra soglia: aliquota piena
// piatta, un calcolo reale. Sotto soglia: MAI un numero inventato — si
// dichiara il minimo verificato e si rimanda al calcolatore ufficiale.
export function computeAvsIndipendente(redditoAnnuo) {
  const reddito = Math.max(0, +redditoAnnuo || 0);
  if (reddito === 0) {
    return { contributo: 0, aliquota: 0, fasciaPiena: false, nota: null };
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
