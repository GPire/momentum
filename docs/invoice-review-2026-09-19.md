# Registro locale delle correzioni

Percorso: Vault → Pagamenti e lavoro → Controlli e correzioni → fattura italiana.

Richieste e verifiche vengono aggiunte a `invoiceReviewEvents`, senza riscrivere eventi precedenti né modificare fatture o incassi. La verifica è una dichiarazione dell'utente. Non attesta un'approvazione del commercialista o un esito SdI.

Ogni evento è legato alla rappresentazione canonica dei dati archiviati della fattura. Modifiche successive riaprono la richiesta. Riordinare le proprietà non la invalida. Campi esterni al record della fattura (per esempio un profilo emittente condiviso o file non conservati nel record) non sono inclusi: questo non sostituisce hash degli allegati, firma o conservazione del documento emesso.

Export dedicato JSON con fattura, richieste, verifiche e stato corrente; report commercialista IT con riepilogo HTML, cronologia CSV e dati JSON. Nessun invio a terzi. Interfaccia in sette lingue, senza menu nativi aggiuntivi. Input vuoto respinto; risoluzione inesistente/duplicata respinta; eventi corrotti non producono una verifica positiva.

44 test mirati passati (registro, mutazioni, serializzazione/ripristino, export, escaping HTML, testi). Browser locale: richiesta vuota bloccata, richiesta di prova registrata, verifica registrata e ritrovata dopo reload. Build portabile di produzione completata. Nessuna nuova prova su dispositivo fisico, nessun push/deploy.

Restano: import sicuro delle correzioni ricevute dal professionista, identità del revisore, allegati con hash, documenti emessi/crediti/storni e riscontri ufficiali. Il registro locale è un passaggio del percorso, non il completamento dei sei obiettivi di rilascio.
