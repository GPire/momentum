// ============================================================
// F24 PRECOMPILATO — mai trasmesso da Momentum, sempre pronto da copiare
// ============================================================
// Momentum non ha accesso al conto bancario né a un canale di trasmissione
// verso l'Agenzia delle Entrate (stessa regola già applicata a tax-payments.js
// e alla trasmissione SdI): non può versare l'F24 al posto dell'utente. Quello
// che PUÒ fare, e che nessun portale di fatturazione tipicamente mostra prima
// del riepilogo finale, è preparare le RIGHE ESATTE — sezione, codice
// tributo, anno di riferimento, importo — pronte da copiare nell'home
// banking o nel modello F24 web dell'Agenzia, usando gli STESSI numeri già
// calcolati e mostrati altrove nell'app (mai un secondo calcolo parallelo
// che potrebbe divergere).
//
// Codici tributo verificati incrociando più fonti indipendenti (agosto 2026):
// partitaiva.it, fiscozen.it, f24editabile.com, finom.co, apridigitale.it.
//  - 1790/1791/1792: imposta sostitutiva regime forfettario (primo acconto,
//    secondo acconto, saldo) — art. 1 c. 64 legge 190/2014.
//  - 4033/4034/4001: IRPEF regime ordinario (primo acconto, secondo acconto,
//    saldo).
//  - 6001..6012: IVA periodica mensile (un codice per mese, gennaio=6001).
//  - 6031/6032/6033/6034: IVA periodica trimestrale (T1..T4).
//  - P10: contributi INPS Gestione Separata per chi non ha una cassa
//    professionale propria — un solo codice per acconto e saldo, distinti
//    nel campo periodo/rata del modulo (non da un codice diverso).
'use strict';

import { taxSetAside } from './tax.js';

export const CODICI_TRIBUTO = {
  forfettario: { primoAcconto: '1790', secondoAcconto: '1791', saldo: '1792' },
  ordinario: { primoAcconto: '4033', secondoAcconto: '4034', saldo: '4001' },
  ivaMensile: (mese) => `60${String(mese).padStart(2, '0')}`,
  ivaTrimestrale: { 1: '6031', 2: '6032', 3: '6033', 4: '6034' },
  inpsGestioneSeparataSenzaCassa: 'P10',
};

// Una riga per periodo IVA con qualcosa da versare (computeIvaLiquidazione,
// già al netto del credito acquisti se dichiarato — nessun nuovo calcolo).
export function righeF24Iva(periodiIva, { anno, periodicita = 'mensile' } = {}) {
  return (periodiIva || [])
    .filter((p) => p.totaleDaVersare > 0)
    .map((p) => ({
      sezione: 'Erario',
      codiceTributo: periodicita === 'trimestrale' ? CODICI_TRIBUTO.ivaTrimestrale[p.trimestre] : CODICI_TRIBUTO.ivaMensile(p.mese),
      annoRiferimento: String(anno),
      importo: p.totaleDaVersare,
      scadenza: p.scadenza,
      etichetta: `IVA ${p.periodo}`,
      nota: p.ivaCreditoNota,
    }));
}

// Scompone ogni scadenza fiscale (tax-deadlines.js: già un importo STIMATO,
// mai una certezza) nelle righe imposta + INPS che la compongono, usando le
// PROPORZIONI reali calcolate da taxSetAside sullo stesso regime — non una
// nuova formula: la frazione imposta/INPS è invariante rispetto alla scala,
// quindi si applica correttamente sia al totale annuo che al residuo di una
// singola scadenza.
export function righeF24Imposte(deadlines, { regime = 'forfettario', annualizedRevenue, opts = {} } = {}) {
  const codici = CODICI_TRIBUTO[regime] || CODICI_TRIBUTO.forfettario;
  const { breakdown } = taxSetAside(annualizedRevenue, { regime, ...opts });
  const impostaVoce = (breakdown || []).find((b) => /Imposta|IRPEF/.test(b.voce));
  const inpsVoce = (breakdown || []).find((b) => /INPS|Contributi/.test(b.voce) && b.importo > 0);
  const totaleFrazionabile = (impostaVoce?.importo || 0) + (inpsVoce?.importo || 0);
  const fraz = totaleFrazionabile > 0
    ? { imposta: (impostaVoce?.importo || 0) / totaleFrazionabile, inps: (inpsVoce?.importo || 0) / totaleFrazionabile }
    : { imposta: 1, inps: 0 };

  return (deadlines || []).flatMap((d) => {
    const isSecondoAcconto = d.id.startsWith('secondo-acconto');
    const codiceImposta = isSecondoAcconto ? codici.secondoAcconto : codici.primoAcconto;
    const anno = d.date.slice(0, 4);
    const righe = [];

    const impostaImporto = +(d.importo * fraz.imposta).toFixed(2);
    if (impostaImporto > 0) {
      righe.push({
        sezione: 'Erario',
        codiceTributo: codiceImposta,
        annoRiferimento: anno,
        importo: impostaImporto,
        scadenza: d.date,
        etichetta: d.label,
        // Il "saldo" nel nome della scadenza (giugno) è una convenzione del
        // calendario, non un vero saldo dichiarazione: Momentum proietta solo
        // l'anno corrente, non conosce l'imposta effettiva dell'anno chiuso.
        nota: !isSecondoAcconto
          ? `Copre solo l'acconto stimato sull'anno corrente. Se hai anche un saldo dell'anno precedente da versare, quello usa il codice ${codici.saldo} e si somma — richiede la dichiarazione dei redditi già presentata, che Momentum non gestisce.`
          : null,
      });
    }

    if (inpsVoce && fraz.inps > 0) {
      const inpsImporto = +(d.importo * fraz.inps).toFixed(2);
      if (inpsImporto > 0) {
        righe.push({
          sezione: 'INPS',
          codiceTributo: CODICI_TRIBUTO.inpsGestioneSeparataSenzaCassa,
          annoRiferimento: anno,
          importo: inpsImporto,
          scadenza: d.date,
          etichetta: `${d.label} — INPS Gestione Separata`,
          nota: 'Stesso codice P10 per acconto e saldo: si distingue nel campo periodo/rata del modulo F24. Se hai una cassa professionale propria (albo), questa riga non ti riguarda: i contributi vanno lì, non in F24 come INPS.',
        });
      }
    }

    return righe;
  });
}

export function f24Riepilogo(righe) {
  const tutte = righe || [];
  const totale = +tutte.reduce((s, r) => s + (+r.importo || 0), 0).toFixed(2);
  return { righe: tutte, totale, pronto: tutte.length > 0 };
}
