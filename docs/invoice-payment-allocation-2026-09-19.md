# Ripartizione degli incassi: controllo dei piani

Implementato `src/invoice/payment-allocation.js`, funzione pura per validare abbinamenti espliciti molti-a-molti. Un movimento può coprire più fatture; più movimenti possono coprire una fattura. Tutti gli importi sono verificati in centesimi, solo EUR/CHF, senza conversioni implicite.

Il contratto richiede ID stabili, valuta esplicita e `amountDue` per ogni fattura. Quest'ultimo è il netto effettivamente da ricevere, NON l'imponibile. Lo storico attuale salvato da main.js non conserva sempre tale informazione: non convertirlo automaticamente usando aliquote correnti.

Controlli: importi positivi finiti a due decimali e nel range sicuro; riferimenti esistenti; ID duplicati; incompatibilità di valuta; sovra-allocazione della fattura o del movimento. Un errore respinge tutto il piano, restituisce codici strutturati e mantiene gli importi non allocati. Ricalcolare dopo una rimozione libera il residuo. Nessun movimento viene creato o mutato.

Test: incasso cumulativo, acconti, centesimi, errori, rimozione, movimento modificato, 300 scenari deterministici di conservazione e indipendenza dall'ordine. Non sono prove su dati bancari reali.

## Piano iniziale di integrazione (stato aggiornato sotto)

- Salvataggio del netto e della valuta effettivi della fattura, con versione del documento; per le vecchie fatture chiedere conferma quando manca il dato.
- Adattatore dagli ID delle fatture e UUID dei movimenti; storage degli abbinamenti e gestione del ripristino.
- UI per proposta, conferma, correzione, residuo ed errori tradotti nelle sette lingue.
- Collegamento del piano confermato ai riepiloghi, mantenendo distinta la liquidità ricevuta dalla base fiscale.
- Casi di ritenuta, nota di credito, commissioni, FX e modifiche successive: il controllo di capienza NON certifica che l'approvazione sia ancora valida dopo qualunque modifica. Servirà collegarla alla versione dei dati.

Non dichiarare il servizio fiscale completo sulla sola base dei test del motore.

## Passaggio successivo: conservazione del calcolo

`invoicePaymentSnapshot` conserva netto, totale, valuta e componenti dello stesso `computeInvoice` utilizzato per generare il documento. Collegato al salvataggio delle nuove fatture in `main.js` come campo additivo `paymentSnapshot`; versione 1 indica lo schema, NON una firma o una versione approvata del documento. Se mancano dati o il controllo aritmetico fallisce, restituisce null e non inventa il netto. Le fatture storiche non vengono migrate. La valuta deriva dallo stesso profilo documento esistente (attualmente EUR per IT e generico); questo non aggiunge un generatore nazionale CH.

46 test mirati passati sullo snapshot, motore fattura, allocazioni ed export italiano. Collegamento di salvataggio verificato nel codice; nessun salvataggio di una fattura reale eseguito nel browser in questo passaggio. Restano UI di conferma, persistenza delle allocazioni e validazione del ripristino del nuovo campo. Nessun push o deploy.

## Collegamento UI successivo

Ora `openInvoiceCollections` è raggiungibile da Vault → Pagamenti e lavoro → Incassi delle fatture. Lista cercabile e progressiva, fattura → movimento → importo → conferma. Nuove fatture usano lo snapshot; vecchie fatture chiedono netto e valuta. Per movimenti senza valuta viene richiesta una conferma esplicita prima del collegamento. Importi decimal input, messaggi di errore e residuo live, selettori EUR/CHF a pulsanti, testi in sette lingue. Nessuna nuova transazione generata.

Persistenza additiva in `invoiceCollections` tramite VaultDAO: targets, currencies, entries. Versioni dei dati sorgente e degli importi/valute confermati invalidano gli abbinamenti dopo modifiche; non sono firme crittografiche né prove bancarie. Rimozione libera i residui senza eliminare movimenti o fatture. Export JSON strutturato dei soli documenti/movimenti coinvolti. Nessun invio automatico a terzi.

68 test mirati passati, inclusi percorso prepareRestoredState, UUID, cumulativo, invalidazione e copertura testi. Collaudo browser su origine isolata 4181: fattura di prova da 102 euro salvata attraverso PDF di cortesia, entrata da 150 tramite Command Center; abbinamento di 50 e residuo 52, blocco 999 e valuta non confermata, persistenza dopo reload, rimozione e ritorno a 102. Vista Chrome 390×844 controllata. Nessun dispositivo fisico iOS/Android verificato in questo passaggio.

Limiti residui: il nuovo registro è una riconciliazione di liquidità esplicita; non cambia automaticamente i calcoli fiscali o i riepiloghi euristici precedenti (imponibile e incasso netto non sono intercambiabili). Gli altri generatori nazionali che non salvano nello storico fatture non vengono magicamente collegati. Commissioni, cambi valuta, note di credito e riattribuzioni fiscali richiedono percorsi ulteriori. Non è completato l'intero servizio fiscale a pagamento.

Osservazione separata nel test browser: la categorizzazione del Command Center ha cambiato il tipo selezionato durante la compilazione della descrizione. Il test ha riselezionato esplicitamente Entrata prima del salvataggio. Questa regressione preesistente va verificata e corretta separatamente; non attribuirla al modulo incassi.

## Chiusura del collegamento ai riepiloghi

Il report italiano ora usa gli abbinamenti confermati, separandoli dalle stime. I movimenti e le fatture già coinvolti non vengono riutilizzati dal matcher euristico. Abbinamenti invalidati sono esclusi dagli incassi e segnalati per revisione. Stati parziale/incassata/da verificare, residuo netto e valuta sono disponibili nei dati strutturati e nel riepilogo. Non cambia il calcolo della base fiscale: liquidità netta e imponibile restano distinti. Il collegamento non estende automaticamente questa logica ai report nazionali CH/ES.

Vault mostra il residuo confermato ed evita di riproporre la stessa fattura come totalmente insoluta. Salvataggio e rimozione aggiornano il riepilogo sottostante. Nel Command Center la previsione può suggerire un diverso tipo, ma lo applica soltanto dopo conferma; una categoria scelta manualmente non viene sovrascritta automaticamente.

Verifiche: 118 test mirati passati; build portabile di produzione riuscita. Browser Chrome su dati di prova: report JSON scaricato con incassato 50, stato parziale, residuo 52; Vault dopo reload mostra 52 euro. Verificata la permanenza del tipo Entrata durante la descrizione. I precedenti test a 390×844 restano emulazione di viewport, non collaudo iPhone fisico.

Blocco separato individuato nel browser: il percorso fiscale può presentare una scadenza 2025 come non versata su un nuovo profilo di prova 2026. La proiezione corrente non è prova di un debito storico. Occorre correggere questo percorso prima di presentare il servizio fiscale come completo e pronto alla vendita. Nessun push o deploy eseguito in questo passaggio.
