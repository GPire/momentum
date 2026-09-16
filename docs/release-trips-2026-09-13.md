# Pubblicazione trasferte, voce e controlli — 13 settembre 2026

Base remota verificata: `a38f1cb8868f9d310c52ab6d11e50547cad3be05`, già antenata del lavoro locale. La pubblicazione conserva le modifiche Sciame e partita IVA presenti su main.

## Contenuto

- Voce: persistenza delle spese e gestione sessione, con test dedicati.
- Trasferte: allegati apribili, date locali coerenti e spese conservate quando il periodo viene definito successivamente.
- Modifica delle spese con UUID preservati, revisioni mantenute, sincronizzazione delle modifiche e conflitti espliciti.
- Validazione importi, soglia giustificativi per trasferta e controlli sull'archivio.
- Condivisione ricevute singola/multipla: annullare non apre un canale alternativo; preparare non equivale a inviare o ricevere.
- Esportazione JSON completa e importazione per il responsabile senza contaminare il suo registro personale.
- Revisione associata alla versione esatta di dati e allegati; esiti obsoleti rifiutati.
- Costi pagati da altri separati dal rimborso, anche nei link. Conflitti bloccanti sia durante la decisione sia durante la sua importazione.
- Storico locale: conserva esiti precedenti e note anche quando viene preparato un nuovo esito sulla stessa versione. I vecchi record restano leggibili; non è un audit aziendale autenticato.
- Previsioni di cassa: correzioni per scenari di spese condivise, documentate in split-cash-scenarios-2026-09-12.md.
- Novità nell'app in sette lingue, riusando la schermata esistente.

## Verifiche

Suite completa: 341/341 file passati. Dopo gli ultimi aggiornamenti: 4 test storico e 10 test novità multilingua passati. Build portable verificata. UI resoconto e allegato controllati in Chrome con dati sintetici su origine isolata; nessuna modifica ai dati reali per il collaudo.

## Non completato

- Casella aziendale condivisa sempre disponibile, identità verificate, ruoli e revoche.
- Policy centralizzate per organizzazione e relativi permessi.
- Connettori autenticati SAP Concur, Zoho, Expensify e Rydoo: non disponibili account autorizzati per il collaudo. I percorsi di esportazione non equivalgono a un'integrazione API.
- Collaudo su hardware fisico iOS/Android e ricezione fra dispositivi distinti.

Il repository contiene già un backend di telemetria. Non è stato aggiunto un backend finanziario o incorporato alcun segreto nel frontend. Per le funzioni aziendali online resta da scegliere un servizio opzionale o un gateway gestito dall'azienda.
