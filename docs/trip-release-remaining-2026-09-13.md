# Trasferte: chiusura e accessi di collaudo

## Verificato in questa revisione

- Controlli archivio su ID mancanti/ripetuti, importi e date non validi,
  allegati assenti. Tutte le righe restano esportabili; nessuna correzione
  automatica né regola aziendale inventata.
- Input importo con virgola/punto, controllo dell'intero valore e del limite
  numerico, focus sul campo errato; tastiera decimale richiesta via inputmode.
- Duplicazione di una spesa con identificativo numerico ora trova la riga.
- 25 test mirati passati; build portable riuscita; Chrome verifica riepilogo
  e focus dopo salvataggio senza importo. Hardware iPhone non verificato qui.

## Test esterni senza account aziendale

Ricerca ufficiale del 13 settembre 2026:

- [Zoho Expense Sandbox](https://www.zoho.com/us/expense/help/developer-space/sandbox/):
  richiede organizzazione e abilitazione Early Access tramite supporto.
- [Expensify Integration Server](https://integrations.expensify.com/Integration-Server/doc/index.html):
  account e credenziali; Expense Creator richiede permessi avanzati per
  employeeEmail. Il parametro test del Report Exporter non costituisce
  un ambiente anonimo per la creazione di spese.
- [Rydoo Sandbox](https://help.rydoo.com/hc/en-be/articles/8467440063132-Use-the-Rydoo-app-on-Sandbox):
  accesso autenticato all'ambiente sandbox.
- [SAP Concur partner guide](https://developer.concur.com/manage-apps/app-center-partner-guidebook.pdf):
  gli ambienti di test e i requisiti dipendono dalla configurazione e dal
  programma di integrazione.

Non trovato un endpoint anonimo ufficiale per collaudare l'intero invio.
Nessun account creato, nessun messaggio al supporto e nessuna spesa spedita.
Si possono sviluppare test di contratto locali, che non attestano compatibilità
reale finché non si esegue un test autenticato.

## Resta da chiudere prima di dichiarare il prodotto aziendale completo

- Adapter, credenziali lato server, mappatura contabile e riconciliazione
  degli esiti per ciascun fornitore; retry senza duplicazione e allegati.
- Casella condivisa con identità verificate, ruoli e isolamento aziende.
  Lo storico locale del responsabile non equivale a questo servizio.
- Collaudo mobile/touch e ciclo completo dipendente-responsabile su dispositivi
  distinti, comprese revisioni concorrenti e rimborso.
- Modifica completa delle spese già registrate con aggiornamento coerente
  del registro Vault; non sostituire o perdere UUID e allegati.
- Policy ricevute configurabile per organizzazione: il motore esistente usa
  ancora una soglia fissa 25, che non rappresenta tutte le aziende.

Questa lista è esplicita per evitare che il passaggio dei test venga presentato
come completamento delle integrazioni o sostituzione universale dei gestionali.
