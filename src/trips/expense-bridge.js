// ============================================================
// PONTE verso i sistemi di nota spese aziendali (Concur, Expensify, Zoho...)
// ============================================================
// Richiesta reale: molti dipendenti sono OBBLIGATI dalla propria azienda a
// usare un sistema di nota spese esterno (SAP Concur, Expensify, Zoho
// Expense, o altri) e Momentum non può sostituirlo — ma può togliere la
// doppia battitura, che è il vero attrito segnalato.
//
// ONESTÀ verificata con ricerca reale, non assunta: un'integrazione API vera
// con SAP Concur richiede diventare partner certificato del loro App Center
// (accordo commerciale a pagamento + certificazione tecnica) — non
// raggiungibile scrivendo solo codice, e qui non si finge il contrario.
//
// Il ponte che ESISTE davvero, verificato per ciascuna voce sotto: questi
// strumenti offrono ai propri utenti un indirizzo email a cui inoltrare uno
// scontrino, che la LORO OCR legge da sola e trasforma in una spesa —
// Momentum prepara il file giusto e apre l'email già pronta; il dipendente
// la manda con la propria identità aziendale, Momentum non manda nulla al
// posto suo.
'use strict';

export const EXPENSE_PLATFORMS = [
  {
    id: 'concur',
    nome: 'SAP Concur',
    indirizzoFisso: 'receipts@concur.com',
    nota: 'Il mittente deve essere l\'email verificata nel tuo profilo Concur.',
  },
  {
    id: 'expensify',
    nome: 'Expensify',
    indirizzoFisso: 'receipts@expensify.com',
    nota: 'Il mittente deve essere l\'email registrata sul tuo account Expensify.',
  },
  {
    id: 'zoho',
    nome: 'Zoho Expense',
    indirizzoFisso: null,
    nota: 'Il tuo indirizzo personale è in Zoho Expense → Impostazioni → Preferenze.',
  },
  {
    id: 'altro',
    nome: 'Altro',
    indirizzoFisso: null,
    nota: 'Molti sistemi (Rydoo, Mobilexpense, Emburse, Pleo, Ramp...) hanno lo stesso inoltro via email: cercalo nelle impostazioni del tuo account.',
  },
];

export function trovaPiattaforma(id) {
  return EXPENSE_PLATFORMS.find(p => p.id === id) || null;
}

// Validazione minima — mai bloccare un formato raro ma valido.
export function indirizzoValido(indirizzo) {
  return typeof indirizzo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(indirizzo.trim());
}

// Nome file per lo scontrino da allegare — data + un suffisso dall'id, mai
// solo la data: un invio multiplo con due scontrini nello stesso giorno
// produrrebbe altrimenti due allegati con lo stesso nome (visto succedere,
// non ipotizzato: una trasferta con taxi+pranzo lo stesso giorno).
export function nomeFileGiustificativo(expense, isPdf) {
  const data = String(expense?.date || '').slice(0, 10) || 'senza-data';
  const suffisso = expense?.id ? `-${String(expense.id).slice(-4)}` : '';
  return `scontrino-${data}${suffisso}.${isPdf ? 'pdf' : 'jpg'}`;
}

// Gli scontrini di questa trasferta non ancora mandati al sistema aziendale
// (o mai mandati) — mai un doppio invio automatico, la scelta di rimandarne
// uno già segnato resta sempre manuale.
export function scontriniDaInviare(expenses = []) {
  return expenses.filter(t => t?.receiptImage && !t.bridgeSentAt);
}

export function scontriniGiaInviati(expenses = []) {
  return expenses.filter(t => t?.receiptImage && t.bridgeSentAt);
}
