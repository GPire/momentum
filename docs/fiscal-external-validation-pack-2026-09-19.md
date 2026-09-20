# Fascicolo per il collaudo esterno e l'attivazione commerciale

Stato: preparato, NON approvato. Nessun invio fiscale, incarico professionale o abbonamento attivato.

## Evidenze già disponibili

- 580 test locali superati il 19 settembre 2026: tutti i test `src/invoice/*.test.js` e `src/predict/{tax*,accountant*}.test.js`. Log locale: `../audit-tools/fiscal-review-pack-tests.log` rispetto alla radice del repository.
- Tre percorsi sintetici IT/CH/ES con incasso 40 + 60, identificativi UUID, residuo, saldo, richiesta di correzione e rientro senza duplicati: `src/invoice/invoice-country-workflow.test.js`.
- Misurazione previsioni: `bench/payment-window-eval.mjs`; dati sintetici separati dai reali. Il campione sintetico non mostra miglioramento rispetto al riferimento fisso a 30 giorni.
- Archivio con controllo di integrità: `scripts/document-archive.mjs`. Non autentica emittenti, firme o date, né prova conservazione legale.

## Protocollo per un professionista

Per ciascun caso della matrice allegata, il revisore deve indicare anno, regime, input anonimizzati, risultato atteso indipendente, fonte vigente, risultato Momentum, differenza ammessa motivata, esito e identità professionale. Conservare l'esatto commit e i file verificati. Non ricavare il risultato atteso dalla funzione sottoposta a test. Una correzione successiva richiede nuova verifica dei casi interessati.

La firma o conferma del revisore va ottenuta da un professionista incaricato; il compilatore del fascicolo non può attribuirgliela. Nessun nominativo esterno o dato reale è stato inserito senza autorizzazione.

## Collaudo dei canali ufficiali

1. Identificare il contribuente o una delega valida e il servizio pertinente. Non usare documenti fittizi nei canali di produzione.
2. Se esiste un ambiente di prova autorizzato, registrarne URL e limiti; distinguerne gli esiti da quelli di produzione.
3. Per operazioni reali, il titolare o delegato conferma l'invio sul portale. Conservare documento esatto, riferimento dell'invio e ricevuta originale.
4. Verificare provenienza ed esito della ricevuta, compresi scarto e mancato recapito. Il caricamento di un file non significa accettazione.
5. Verificare recupero del documento e della ricevuta, modifica del documento dopo l'esito, ripetizione dell'importazione e riconciliazione senza duplicati.

Italia: [Monitoraggio flussi](https://ivaservizi.agenziaentrate.gov.it/ser/monitoraggio/) e [Verifica file firmato dall'Agenzia](https://telematici.agenziaentrate.gov.it/Abilitazione/IVerificaFile.jsp). Il secondo servizio controlla la firma dell'Agenzia, non la correttezza fiscale del contenuto.

Svizzera: [Rendiconto IVA online](https://www.estv.admin.ch/it/rendiconto-iva-online) e [portale AFC](https://estvportal.estv.admin.ch/). L'accesso e le operazioni richiedono identità e autorizzazioni pertinenti.

Spagna: [manuale dell'applicazione gratuita AEAT](https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/Manual_facturacion/Manual_Usuario_Verifactu_Accesible.pdf). Verificare applicabilità al contribuente e territorio prima dell'uso. L'uso del portale esterno non certifica Momentum come SIF.

## Accuratezza reale

Usare osservazioni salvate prima dell'incasso, escludendo esiti già conosciuti. Pubblicare dimensione del campione, casi pendenti, esclusioni, Paese, errore e confronto col riferimento. Non considerare gli incassi ancora aperti come successi. I dati locali sono modificabili: un confronto indipendente richiede documenti autorizzati e controllo del revisore. Nessuna percentuale reale disponibile oggi.

## Attivazione commerciale

Da `public/termini.html` risultano lo sviluppatore Giorgio Piredda e il contatto giorgiopiredda96@gmail.com. Sono dati già pubblicati, NON una conferma del soggetto venditore o dell'apertura di un'attività. Gli stessi Termini dichiarano ancora beta gratuita: non sono condizioni di vendita di un abbonamento.

Servono identificazione del venditore effettivo, Paese, offerta/prezzo, condizioni e contatto assistenza confermati. Il fornitore di pagamento richiede verifica del titolare: [Stripe, verifica account](https://support.stripe.com/questions/what-do-i-need-to-do-to-verify-my-stripe-account). Stripe è un esempio verificato, non un provider scelto o integrato.

Collaudare in ambiente di prova: acquisto, pagamento fallito, eventi duplicati e fuori ordine, rinnovo, disdetta a fine periodo, revoca e ripristino del diritto, rimborso, accesso/esportazione dei dati dopo scadenza, richiesta assistenza senza allegati fiscali automatici. Successivamente verificare il percorso reale autorizzato. Un flag Pro locale non dimostra un pagamento.
