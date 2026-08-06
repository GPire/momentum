// ============================================================
// TRADUZIONE DELL'INTERFACCIA — primo modulo riusabile, non l'intera app
// ============================================================
// Onestà (regola #1): tradurre TUTTA l'interfaccia di Momentum (migliaia di
// stringhe sparse in index.html e main.js, tutte in italiano) è un progetto
// grande quanto il filone fisco appena chiuso, non una funzione in più — non
// lo si finge fatto qui. Questo modulo è il PRIMO pezzo reale e riusabile:
// le schermate svizzere (simulatore AVS/IVA, creazione fattura QR-bill),
// scelte perché sono l'unico punto oggi dove un utente non italiano
// interagisce con l'app in modo sostanziale. Il pattern (dizionario per
// lingua + resolveUiLanguage) è pensato per essere esteso schermata per
// schermata, non riscritto quando si aggiunge il prossimo mercato.
//
// Lingue scelte per la Svizzera, non a caso: le 3 lingue nazionali svizzere
// coperte dal rilevatore già esistente (i18n/detect.js: IT/DE/FR — manca il
// Romancio, minoranza sotto l'1% della popolazione, non coperta neppure dal
// rilevatore) + inglese come lingua franca del business svizzero e default
// onesto per chi non rientra in nessuna delle altre (richiesta esplicita:
// "se non riconosciuta, magari inglese").
'use strict';

import { detectDeviceLanguage } from './detect.js';

export const UI_LANG_DEFAULT = 'en';
export const UI_LANGS = ['it', 'en', 'de', 'fr'];

// Priorità: 1) scelta esplicita (mai ignorata), 2) lingua del dispositivo se
// tra quelle coperte, 3) inglese come rete di sicurezza — mai l'italiano
// imposto a chi non l'ha scelto e il cui dispositivo non lo suggerisce.
export function resolveUiLanguage({ override = null, navigatorLike = null } = {}) {
  if (override && UI_LANGS.includes(override)) return override;
  const device = detectDeviceLanguage(navigatorLike);
  return (device && UI_LANGS.includes(device)) ? device : UI_LANG_DEFAULT;
}

const S = {
  it: {
    chSimTitle: 'Lavori in Svizzera?',
    chSimSubtitle: 'Niente Partita IVA qui: AVS e IVA funzionano diversamente. Dimmi solo quanto pensi di fatturare in un anno (CHF) e calcolo io il resto.',
    chSimPlaceholder: 'Es. 80000',
    chSimCta: 'Scopri cosa ti resterebbe',
    chSimBack: '← Torna indietro',
    chResultTitle: (v) => `Con CHF ${v}/anno`,
    chResultSubtitle: 'Ecco cosa ti riguarda davvero — niente scelta di regime, niente fattura elettronica obbligatoria come in Italia.',
    chAvsLabel: 'AVS/AI/APG (10%)',
    chAvsDegressiveTitle: 'AVS/AI/APG: scala degressiva',
    chAvsDegressiveText: (soglia, minimo) => `Sotto CHF ${soglia}/anno l'aliquota è ridotta ma calcolata dal tuo ufficio di compensazione — il minimo verificato è CHF ${minimo}/anno.`,
    chAvsDegressiveLink: 'Calcola l\'esatto qui',
    chInvestText: 'Se investi in borsa: in Svizzera le plusvalenze sono esenti da imposta per investitori privati (0%, verificato) — vedi anche "Il netto vero" negli Investimenti.',
    chCantonNote: 'Stime su aliquote federali pubbliche — l\'imposta sul reddito varia molto per Cantone e non è calcolabile con un numero unico: verificala con la tua amministrazione cantonale.',
    chCreateInvoice: 'Crea una fattura con QR-bill',
    chRecalculate: '← Rifai il calcolo',
    chInvTitle: 'Fattura con QR-bill',
    chInvSubtitle: 'In Svizzera ogni fattura porta un codice QR di pagamento — lo genero io, tu compili solo i dati.',
    chInvYourData: 'I tuoi dati (una volta sola)',
    chInvIban: 'Il tuo IBAN o QR-IBAN (CH...)',
    chInvName: 'Il tuo nome o ragione sociale',
    chInvStreet: 'Via', chInvBuilding: 'N. civico', chInvCap: 'CAP', chInvCity: 'Città',
    chInvClientSection: 'Il cliente e l\'importo',
    chInvClientName: 'Nome del cliente', chInvAmount: 'Importo CHF', chInvDesc: 'Causale',
    chInvGenerate: 'Genera QR-bill',
    chInvDisclaimer: 'Il codice QR è verificato contro 3 esempi ufficiali SIX Group — funziona con qualunque app bancaria svizzera. Il layout di stampa a norma non è ancora replicato: oggi ottieni il codice corretto da allegare o mostrare, non ancora il modulo stampabile completo.',
    chInvErrMissing: 'Compila almeno IBAN, nome, CAP e città.',
    chInvErrAmount: 'Inserisci un importo valido.',
    chResTitle: 'QR-bill pronta',
    chResDisclaimer: 'Qualunque app bancaria svizzera legge questo codice per pagare — verificato contro il formato ufficiale SIX. Allegalo alla tua fattura o mostralo direttamente al cliente.',
    chResNewInvoice: '← Crea un\'altra fattura',
    chRefLabel: 'Riferimento',
  },
  en: {
    chSimTitle: 'Working in Switzerland?',
    chSimSubtitle: 'No Partita IVA here: AHV/AVS and VAT work differently. Just tell me your estimated yearly revenue (CHF) and I\'ll work out the rest.',
    chSimPlaceholder: 'E.g. 80000',
    chSimCta: 'See what you\'d keep',
    chSimBack: '← Go back',
    chResultTitle: (v) => `With CHF ${v}/year`,
    chResultSubtitle: 'Here\'s what actually concerns you — no regime to choose, no mandatory e-invoicing like in Italy.',
    chAvsLabel: 'AHV/IV/EO (10%)',
    chAvsDegressiveTitle: 'AHV/IV/EO: sliding scale',
    chAvsDegressiveText: (soglia, minimo) => `Below CHF ${soglia}/year the rate is reduced but calculated by your compensation office — the verified minimum is CHF ${minimo}/year.`,
    chAvsDegressiveLink: 'Calculate the exact amount here',
    chInvestText: 'If you invest: in Switzerland capital gains are tax-exempt for private investors (0%, verified) — see also "The real net return" in Investments.',
    chCantonNote: 'Estimates based on public federal rates — income tax varies a lot by Canton and can\'t be given as a single number: check with your cantonal tax office.',
    chCreateInvoice: 'Create an invoice with QR-bill',
    chRecalculate: '← Recalculate',
    chInvTitle: 'Invoice with QR-bill',
    chInvSubtitle: 'Every Swiss invoice carries a payment QR code — I generate it, you just fill in the details.',
    chInvYourData: 'Your details (once only)',
    chInvIban: 'Your IBAN or QR-IBAN (CH...)',
    chInvName: 'Your name or company name',
    chInvStreet: 'Street', chInvBuilding: 'Building no.', chInvCap: 'Postal code', chInvCity: 'Town',
    chInvClientSection: 'Client and amount',
    chInvClientName: 'Client name', chInvAmount: 'Amount CHF', chInvDesc: 'Description',
    chInvGenerate: 'Generate QR-bill',
    chInvDisclaimer: 'The QR code is verified against 3 official SIX Group examples — it works with any Swiss banking app. The compliant print layout isn\'t replicated yet: today you get the correct, scannable code, not yet the full printable slip.',
    chInvErrMissing: 'Fill in at least IBAN, name, postal code and town.',
    chInvErrAmount: 'Enter a valid amount.',
    chResTitle: 'QR-bill ready',
    chResDisclaimer: 'Any Swiss banking app can read this code to pay — verified against the official SIX format. Attach it to your invoice or show it directly to your client.',
    chResNewInvoice: '← Create another invoice',
    chRefLabel: 'Reference',
  },
  de: {
    chSimTitle: 'Arbeitest du in der Schweiz?',
    chSimSubtitle: 'Keine Partita IVA hier: AHV und MWST funktionieren anders. Sag mir einfach deinen geschätzten Jahresumsatz (CHF), den Rest berechne ich.',
    chSimPlaceholder: 'Z.B. 80000',
    chSimCta: 'Zeig mir, was übrig bleibt',
    chSimBack: '← Zurück',
    chResultTitle: (v) => `Mit CHF ${v}/Jahr`,
    chResultSubtitle: 'Das betrifft dich wirklich — keine Regimewahl, keine obligatorische E-Rechnung wie in Italien.',
    chAvsLabel: 'AHV/IV/EO (10%)',
    chAvsDegressiveTitle: 'AHV/IV/EO: sinkende Skala',
    chAvsDegressiveText: (soglia, minimo) => `Unter CHF ${soglia}/Jahr ist der Satz reduziert, wird aber von deiner Ausgleichskasse berechnet — das geprüfte Minimum ist CHF ${minimo}/Jahr.`,
    chAvsDegressiveLink: 'Hier genau berechnen',
    chInvestText: 'Bei Börseninvestitionen: In der Schweiz sind Kapitalgewinne für Privatanleger steuerfrei (0%, geprüft) — siehe auch "Die echte Nettorendite" bei Investitionen.',
    chCantonNote: 'Schätzungen basierend auf öffentlichen Bundessätzen — die Einkommenssteuer variiert stark je Kanton und lässt sich nicht mit einer einzigen Zahl berechnen: prüfe bei deiner kantonalen Steuerverwaltung.',
    chCreateInvoice: 'Rechnung mit QR-Rechnung erstellen',
    chRecalculate: '← Neu berechnen',
    chInvTitle: 'Rechnung mit QR-Code',
    chInvSubtitle: 'Jede Schweizer Rechnung trägt einen Zahlungs-QR-Code — ich erstelle ihn, du füllst nur die Daten aus.',
    chInvYourData: 'Deine Angaben (nur einmal)',
    chInvIban: 'Dein IBAN oder QR-IBAN (CH...)',
    chInvName: 'Dein Name oder Firmenname',
    chInvStreet: 'Strasse', chInvBuilding: 'Hausnummer', chInvCap: 'PLZ', chInvCity: 'Ort',
    chInvClientSection: 'Kunde und Betrag',
    chInvClientName: 'Name des Kunden', chInvAmount: 'Betrag CHF', chInvDesc: 'Zweck',
    chInvGenerate: 'QR-Rechnung erstellen',
    chInvDisclaimer: 'Der QR-Code ist gegen 3 offizielle SIX-Group-Beispiele geprüft — er funktioniert mit jeder Schweizer Banking-App. Das normgerechte Drucklayout ist noch nicht nachgebildet: heute erhältst du den korrekten, scanbaren Code, noch nicht den vollständigen Einzahlungsschein.',
    chInvErrMissing: 'Fülle mindestens IBAN, Name, PLZ und Ort aus.',
    chInvErrAmount: 'Gib einen gültigen Betrag ein.',
    chResTitle: 'QR-Rechnung bereit',
    chResDisclaimer: 'Jede Schweizer Banking-App kann diesen Code zum Bezahlen lesen — geprüft gegen das offizielle SIX-Format. Füge ihn deiner Rechnung bei oder zeige ihn direkt deinem Kunden.',
    chResNewInvoice: '← Weitere Rechnung erstellen',
    chRefLabel: 'Referenz',
  },
  fr: {
    chSimTitle: 'Vous travaillez en Suisse ?',
    chSimSubtitle: 'Pas de Partita IVA ici : l\'AVS et la TVA fonctionnent différemment. Dites-moi juste votre chiffre d\'affaires annuel estimé (CHF), je calcule le reste.',
    chSimPlaceholder: 'Ex. 80000',
    chSimCta: 'Voir ce qu\'il vous resterait',
    chSimBack: '← Retour',
    chResultTitle: (v) => `Avec CHF ${v}/an`,
    chResultSubtitle: 'Voici ce qui vous concerne vraiment — aucun régime à choisir, aucune facture électronique obligatoire comme en Italie.',
    chAvsLabel: 'AVS/AI/APG (10%)',
    chAvsDegressiveTitle: 'AVS/AI/APG : barème dégressif',
    chAvsDegressiveText: (soglia, minimo) => `Sous CHF ${soglia}/an le taux est réduit mais calculé par votre caisse de compensation — le minimum vérifié est CHF ${minimo}/an.`,
    chAvsDegressiveLink: 'Calculer le montant exact ici',
    chInvestText: 'Si vous investissez en bourse : en Suisse, les plus-values sont exonérées d\'impôt pour les investisseurs privés (0%, vérifié) — voir aussi « Le vrai rendement net » dans Investissements.',
    chCantonNote: 'Estimations basées sur les taux fédéraux publics — l\'impôt sur le revenu varie beaucoup selon le canton et ne peut pas être donné avec un seul chiffre : vérifiez auprès de votre administration cantonale.',
    chCreateInvoice: 'Créer une facture avec QR-facture',
    chRecalculate: '← Recalculer',
    chInvTitle: 'Facture avec QR-facture',
    chInvSubtitle: 'Chaque facture suisse porte un code QR de paiement — je le génère, vous remplissez juste les données.',
    chInvYourData: 'Vos données (une seule fois)',
    chInvIban: 'Votre IBAN ou QR-IBAN (CH...)',
    chInvName: 'Votre nom ou raison sociale',
    chInvStreet: 'Rue', chInvBuilding: 'N°', chInvCap: 'NPA', chInvCity: 'Ville',
    chInvClientSection: 'Le client et le montant',
    chInvClientName: 'Nom du client', chInvAmount: 'Montant CHF', chInvDesc: 'Motif',
    chInvGenerate: 'Générer la QR-facture',
    chInvDisclaimer: 'Le code QR est vérifié par rapport à 3 exemples officiels SIX Group — il fonctionne avec n\'importe quelle app bancaire suisse. La mise en page d\'impression conforme n\'est pas encore reproduite : vous obtenez aujourd\'hui le code correct et scannable, pas encore le bulletin imprimable complet.',
    chInvErrMissing: 'Remplissez au moins IBAN, nom, NPA et ville.',
    chInvErrAmount: 'Entrez un montant valide.',
    chResTitle: 'QR-facture prête',
    chResDisclaimer: 'N\'importe quelle app bancaire suisse peut lire ce code pour payer — vérifié par rapport au format officiel SIX. Joignez-le à votre facture ou montrez-le directement à votre client.',
    chResNewInvoice: '← Créer une autre facture',
    chRefLabel: 'Référence',
  },
};

// t(key, lang, ...args): stringa o funzione(args) -> stringa. Fallback a
// EN se la chiave manca nella lingua richiesta, poi a IT — mai una chiave
// grezza mostrata all'utente.
export function t(key, lang = UI_LANG_DEFAULT, ...args) {
  const dict = S[lang] || S[UI_LANG_DEFAULT];
  const v = dict[key] ?? S.en[key] ?? S.it[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
