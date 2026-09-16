# Limiti di spesa per trasferta

La sezione delle regole include quattro limiti facoltativi per singola spesa:
trasporto, vitto, alloggio e altro. Vuoto significa nessun limite, zero è un
limite attivo. I valori sono in EUR; una valuta della transazione differente
produce un avviso di verifica manuale, mai una conversione implicita.

Il controllo del resoconto segnala i superamenti senza cambiare importi o
decidere la rimborsabilità. Un limite malformato usato da una spesa produce
un errore bloccante. I limiti sono conservati in receiptPolicy.expenseLimits,
quindi inclusi nell'archivio e nell'impronta della versione da approvare.
Nessuna migrazione o modifica delle transazioni esistenti.

15 test mirati passati; build portable completata. Apertura e disposizione
dei campi verificate in Chrome locale con dati sintetici. Non collaudati
in questo intervento inserimento da tastiera fisica mobile e invio esterno.

Sono regole locali per trasferta, non policy aziendali amministrate da un ruolo
verificato. Restano limiti giornalieri/cumulativi, eccezioni motivate, versioni
di policy assegnate dall'azienda, casella condivisa e connettori autenticati.
Il controllo attuale riguarda le spese del dipendente, non gli importi offerti
dall'azienda. Non certificare copertura enterprise completa.
