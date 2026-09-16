# Controlli azionabili prima della richiesta

- `inspectTripArchive` distingue errori bloccanti, giustificativi da verificare secondo la soglia della trasferta e allegati facoltativi assenti. Il file completo rimane sempre esportabile.
- Identificativi duplicati sono segnalati su entrambe le righe. Importi negativi/non sicuri e date impossibili, come 30 febbraio, vengono rilevati senza cambiare o eliminare i dati.
- L'import del resoconto usa la stessa validazione delle date e rifiuta importi fuori dal limite numerico e identificativi vuoti.
- La schermata mostra gli errori direttamente. “Apri la spesa” riusa l'editor con UUID originale e revisioni: non crea una nuova spesa. Gli identificativi ambigui non ricevono un comando che rischi di modificare la riga sbagliata.
- Preparazione richiesta e importazione approvazione controllano nuovamente gli errori bloccanti. Un giustificativo richiesto ma assente resta un avviso, non una decisione automatica sulla rimborsabilità.
- Il file completo è disponibile anche nella schermata di approvazione, con istruzioni per il responsabile. Il download da quella schermata rifiuta dati cambiati rispetto al riepilogo preparato.
- Rimossa la descrizione fissa “25€” dall'avviso della singola spesa: era incoerente con la soglia personalizzata già usata nel calcolo.
- Nuovi testi nelle sette lingue dell'app.

## Verifica

44 test mirati passati, build portable riuscita. Chrome con dati sintetici su origine isolata: avviso su spesa da 30€ senza allegato, apertura editor precompilato della stessa spesa, richiesta consentita in presenza del solo avviso. Download effettivo dal percorso di approvazione verificato leggendo il JSON: trip-test, una transazione da 30€. Nessun invio a terzi.

Non sono attestati test su dispositivi fisici, identità aziendali verificate, una casella centrale o collegamenti API autenticati ai gestionali. Le regole rimangono per trasferta e non rappresentano una policy centralizzata autorizzata dall'azienda.
