# Verifica delle finestre di incasso

## Implementazione

All'apertura di «Le tue fatture» Momentum conserva localmente la prima previsione per fattura e versione, prima dell'incasso. Il valutatore confronta la finestra con il saldo confermato successivo. Non invia dati a servizi esterni. Modifiche alla fattura, registri incoerenti e pagamenti già avvenuti non diventano prove positive di accuratezza. I casi ancora aperti restano pendenti.

Il registro locale non è una certificazione temporale né una prova non alterabile. La valutazione dei soli casi saldati può essere ottimistica: i ritardi ancora aperti devono restare visibili nel campione.

## Prove ripetibili

`node bench/payment-window-eval.mjs` esegue sei casi sintetici IT/CH/ES. Un percorso JSON opzionale permette di valutare un dataset autorizzato con snapshot antecedenti agli esiti; il programma non certifica la provenienza dichiarata.

Risultato sintetico: 6 previsioni, copertura 50%, errore medio assoluto 15 giorni, larghezza media 20 giorni. Il riferimento fisso a 30 giorni ha anch'esso errore medio di 15 giorni. Non è dimostrato un miglioramento e questi numeri non sono accuratezza su clienti reali.

Dieci test mirati superati: previsione, valutazione temporale e osservazioni prospettiche. Build di produzione completata (22,41 s), con avviso esistente sui chunk superiori a 500 kB.

## Verifica nel browser

Build aperta su origine locale separata 4193 con quattro fatture sintetiche e tre saldi storici, senza modificare l'archivio abituale. La fattura 4/2026 mostra effettivamente la finestra 11 settembre–1 ottobre 2026 e la spiegazione dei tre precedenti. Verificate leggibilità desktop e viewport Chrome 390×844: testo e comandi contenuti nella scheda. Non è un collaudo su iPhone fisico.

## Evidenze ancora necessarie

Accumulare previsioni antecedenti agli incassi reali e risultati autorizzati, riportando campione, pendenti, esclusioni, Paese e prestazioni rispetto al riferimento. Non dichiarare accuratezza reale, superiorità commerciale o validazione fiscale sulla base di questi test. Il valutatore è disponibile nel codice; non è ancora un cruscotto di metriche per utenti.
