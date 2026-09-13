# Resoconto aziendale: costi separati e conflitti

## Modifiche

- Il responsabile vede le voci offerte da altri (azienda o terzi), con totale separato dal rimborso. Nessuna duplicazione nei conti personali.
- Il link conserva queste voci; nelle sintesi lunghe mostra al massimo dieci voci offerte, dichiarando il numero completo e conservando il totale. L'archivio JSON conserva il dettaglio completo.
- Le revisioni in conflitto attraversano sia l'archivio sia il link, anche ridotto. La schermata impedisce di approvare e spiega come chiedere la correzione. Rimane possibile richiedere modifiche con una nota.
- Il dipendente verifica nuovamente i conflitti quando importa l'esito. Un vecchio client del responsabile non può quindi aggirare il controllo nel nuovo client del dipendente.
- L'esito rimane legato all'impronta SHA-256 del resoconto completo: cambiare un allegato rende inapplicabile l'esito precedente.
- Nuovi messaggi in italiano, inglese, tedesco, francese, spagnolo, olandese e portoghese.

## Verifica

53 test passati: motore trasferte, revisioni, archivio, impronta e codec di approvazione. Build portable passata. Prova in Chrome su origine isolata con dati sintetici: rimborso 15 €, hotel offerto 80 €, allegato apribile e pulsante Approva disabilitato per conflitto. Fixture riproducibile: `node scripts/trip-receipt-preview.mjs 4185`, pagina `http://127.0.0.1:4185/?lang=it&review=1`, pulsante di prova.

## Limiti espliciti

Questa modifica non certifica l'identità del responsabile, non crea una casella aziendale condivisa e non attiva API di gestionali. Non è un collaudo su dispositivi fisici o con account SAP Concur/Zoho/Expensify/Rydoo. L'impronta verifica la corrispondenza dei dati, non una firma aziendale. I vecchi client del dipendente non acquisiscono automaticamente il nuovo controllo: devono aggiornare l'app.

Prossima priorità aziendale: identità e autorizzazioni del responsabile, stato condiviso e audit affidabile; per collegamenti autenticati serve un ambiente autorizzato, eventualmente un gateway dell'azienda, senza incorporare segreti nel frontend.
