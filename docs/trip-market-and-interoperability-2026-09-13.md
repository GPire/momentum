# Trasferte: semplicità e interoperabilità

## Due modalità dello stesso prodotto

Momentum deve funzionare anche autonomamente: raccolta spese, giustificativi,
controlli, approvazione e monitoraggio del rimborso senza obbligare a un altro
gestionale. La modalità collegata affianca invece il sistema imposto
dall'azienda. I connettori sono facoltativi; non sostituiscono il percorso
autonomo e non certificano da soli l'idoneità a una grande impresa.

Ricerca del 13 settembre 2026. Proposta di prodotto, non certificazione enterprise né integrazione già distribuita.

## Evidenze e limiti

Le pagine ufficiali descrivono capacità commercializzate, non provano soddisfazione. Le recensioni sono testimonianze selezionate, non un campione rappresentativo: non ricavare tassi di problemi o abbandono. Alcune pagine G2 non erano leggibili integralmente; gli estratti indicizzati sono segnali esplorativi. Nessuna intervista con JPMorgan, VanEck o Accenture è stata effettuata: i requisiti sotto sono ipotesi da validare con un'azienda pilota.

| Prodotto | Cosa mantenere come riferimento | Evidenza e opportunità per Momentum |
|---|---|---|
| SAP Concur | Foto, categorizzazione, note spese, approvazioni e integrazioni | [ExpenseIt](https://www.concur.com/products/expenseit) e [integrazioni](https://www.concur.com/integrations). Il vantaggio non può essere semplicemente «abbiamo OCR»: mostrare cosa è stato letto, cosa manca e cosa correggere. |
| Expensify | Inserimento rapido da foto e multivaluta apprezzati negli estratti delle recensioni | [Recensioni G2](https://www.g2.com/products/expensify/reviews). [Integration Server](https://integrations.expensify.com/Integration-Server/doc/index.html) documenta import/export: valutare le operazioni supportate singolarmente, non promettere sincronizzazione universale. |
| Navan | Prenotazione e spese nello stesso percorso; semplificazione della presentazione delle spese | [Gartner](https://www.gartner.com/reviews/market/expense-management-software/vendor/navan) riporta esperienze sia positive sia problemi di addebiti duplicati e limiti di modifica. Priorità proposta: identificativi stabili e correzioni tracciabili. Non stimare la frequenza del problema da questi estratti. |
| Rydoo | Gestione mobile, abbinamento giustificativi/spese e integrazioni | [G2](https://www.g2.com/products/rydoo/reviews), [API e SFTP ufficiali](https://www.rydoo.com/integrations/). Verificare copertura del contratto e mapping prima di proporre il connettore. |
| Zoho Expense | API documentata e separazione delle organizzazioni | [REST API](https://www.zoho.com/expense/api/v1/introduction/). Ogni organizzazione ha valuta, fuso e lingua: evitare di mescolare dati o categorie fra aziende. Non abbiamo evidenza sufficiente per attribuirgli un difetto specifico generalizzato. |
| Perk / TravelPerk | Convivenza con sistemi spese già adottati | [Integrazioni](https://www.perk.com/spend-solutions/europe-expense-integrations/). Conferma che affiancare il gestionale è una direzione plausibile, non una novità esclusiva di Momentum. |
| Pleo | Foto e rimborso collegati alla contabilità | [Rimborsi](https://www.pleo.io/en/reimbursements), [integrazioni](https://www.pleo.io/en/integrations). Distinguere sempre «pagato dal dipendente» e «pagato dall'azienda». |
| Payhawk | Approvazioni condizionali e separazione dei compiti | [Workflow](https://help.payhawk.com/help/setting-approval-workflows-for-expense-types), [integrazioni](https://payhawk.com/en-us/integrations). UI del dipendente semplice, configurazione amministrativa separata. |
| Ramp | Policy prima dell'invio e requisiti di ricevuta | [Help Center](https://support.ramp.com/expense-management/expense-policies-and-submission/). Momentum deve mostrare eccezioni comprensibili, senza fingere di conoscere una policy mai importata. |

## La risposta proposta di Momentum

Per il dipendente: una foto o frase, una bozza correggibile, una conferma. In primo piano importo anticipato, documenti mancanti e stato del rimborso. Non chiedere informazioni già note e non nascondere gli errori dietro un punteggio AI.

Per il responsabile: una coda delle sole eccezioni, con motivo e documento originale. Una spesa respinta torna modificabile con una richiesta precisa; mai cancellarla o ricrearla perdendo la provenienza.

Per la contabilità: mapping verso centri di costo/categorie aziendali, export ripetibile e riconciliazione. Un invio preparato non equivale a ricevuto, approvato o rimborsato.

Per una grande impresa: separazione organizzazioni, accessi per ruolo, audit, conservazione concordata, gestione dei dispositivi e autorizzazione IT. Questi sono requisiti da realizzare e verificare; non sono garantiti dal solo Vault locale o dalla mesh.

## Integrare senza sostituire il sistema imposto

Il ponte esistente `src/trips/expense-bridge.js` prepara inoltro manuale degli scontrini; la UI offre anche CSV e riepilogo. Non è un connettore API bidirezionale. Il commento che presenta il programma partner Concur come unica strada assoluta va verificato per lo specifico cliente: accesso, scope e contratto dipendono dal percorso scelto.

1. Concordare con l'azienda pilota sistema, organizzazione, campi richiesti e sistema autorevole per approvazioni/rimborsi.
2. Definire un contratto Momentum versionato: ID locale e remoto, organizzazione, valuta originale, data locale, chi ha pagato, categoria aziendale, allegato e sua impronta, revisione, stato e provenienza.
3. Primo collegamento verificabile: export con anteprima, errori per riga e mapping salvato. Nessuna perdita silenziosa di campi; nessun caricamento finanziario senza autorizzazione alla destinazione.
4. Connettore autorizzato: credenziali fuori dalla PWA, scope minimi, code con retry e chiavi idempotenti. Nuovo tentativo dello stesso invio non deve creare una seconda spesa.
5. Ritorno dell'esito: ID esterno e ricevuta dell'operazione. Conflitti evidenziati; «preparato», «consegnato», «approvato» e «rimborsato» distinti. Webhook solo se disponibili e verificati.

La PWA rimane l'interfaccia; un servizio autorizzato dall'azienda gestisce i segreti e le operazioni che richiedono continuità. Non inserire segreti aziendali nel JavaScript distribuito. Nessun provider open banking è stato aggiunto.

## Voce e lingue: criteri di accettazione

Suite separata per IT/EN/DE/FR/ES/NL/PT: importi con virgola/punto, valute, nomi di categorie rinominati, frasi con più movimenti, correzioni, date relative, appuntamenti e fusi. Un importo stimato o una categoria ambigua richiedono conferma; un appuntamento mostra giorno/ora prima dell'esportazione. I risultati finali dello stesso riconoscimento non devono perdersi né duplicarsi.

Misurare salvataggi corretti, correzioni di categoria, duplicati, tempo alla prima spesa valida, recupero dopo errore e completamento del rimborso. Usare casi reali autorizzati e un test set indipendente dall'apprendimento. Non promettere conversioni universali o superiorità non misurata.

## Modifiche UI in questa iterazione

Calendario del periodo spostato fuori dalla mezza colonna; giorni visibili anche senza animazioni. Superfici, dimensioni dei controlli, testo e feedback di pressione uniformati. Configurazione aziendale chiusa finché richiesta. Nessuna API enterprise nuova è attiva con queste modifiche.

Il suggerimento di categoria durante l'uscita da un campo aggiorna soltanto
i pulsanti categoria: non ricrea più il form prima del clic su calendario o
salvataggio. Questa modifica resta da verificare su dispositivo touch reale.

La voce elabora tutti i risultati finali in un evento, anche quando l'ultimo
è ancora provvisorio. Gli indici già elaborati non vengono ripetuti; frasi
uguali dette separatamente rimangono valide. Il parser conserva le lettere
Unicode dei nomi di categoria (regressione riprodotta: Büro diventava Bro).
Sette test mirati includono salvataggio, sessioni, batch e categoria Unicode.
Questo non equivale a un nuovo modello addestrato o a copertura semantica
completa nelle sette lingue.
