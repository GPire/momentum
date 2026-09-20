# Ricezione dei controlli sulle fatture

Percorso: Momentum Vault → Pagamenti e lavoro → Controlli e correzioni → Importa controlli.

Il file `momentum-invoice-review` esportato da Momentum viene letto localmente, con anteprima e conferma prima del salvataggio. Si importano soltanto richieste di controllo, mai fatture, transazioni o risoluzioni. Non si autentica l'identità di un commercialista e non si acquisisce un esito SdI.

La fattura deve esistere una sola volta e coincidere con la versione nel file. Le nuove richieste devono riguardare quella versione. Identificativi duplicati con contenuti diversi bloccano l'intero import; richieste già presenti vengono saltate. La validazione viene ripetuta al salvataggio. Limiti: 1 MB e 500 eventi per file. Le note importate conservano la provenienza `imported-file`.

## Verifiche eseguite

- 47 test passati: import idempotente, conflitti, versione cambiata, esclusione delle risoluzioni, giornale, incassi, export, recupero dati e feedback nelle sette lingue.
- Build di produzione completata in 20,39 secondi.
- Chrome sul server locale 4181: verificata navigazione fino alla schermata di importazione. Upload/conferma del file tramite browser e dispositivi fisici ancora da collaudare.
- Testi del nuovo percorso presenti in sette lingue.

Secondo collaudo browser: esportazione del pacchetto della fattura di prova riuscita. Preparato file sintetico di rientro; `fileChooser.setFiles` rifiutato da Chrome (`Not allowed`), quindi upload e conferma non sono certificati. L'estensione richiede l'accesso agli URL dei file; nessuna autorizzazione modificata automaticamente. L'anteprima ora identifica esplicitamente numero, anno e cliente; errori distinti indicano come recuperare fattura mancante, versione cambiata, conflitto o giornale non valido.

## Limiti commerciali

Questo passaggio non completa i sei requisiti del rilascio. Restano la revisione fiscale esterna per il perimetro venduto, verifica integrale di rettifiche/storni/crediti ed esiti ufficiali, collaborazione autenticata, benchmark dell'intelligenza, pagamenti/annullamento abbonamenti e collaudo sui dispositivi reali. Non dichiarare pronto alla vendita l'intero servizio IT/CH/ES sulla base di questi test. Nessun push o deploy eseguito in questo intervento.
