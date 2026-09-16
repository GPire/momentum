# Trasferte senza un nuovo backend

Momentum ha una PWA con elaborazione e archivio locali. Il repository contiene
anche server/telemetry-worker.js: non è corretto definire tutto il progetto
esclusivamente frontend.

## Percorso locale implementato

Il dipendente esporta il JSON della trasferta e lo consegna con un canale scelto.
Il responsabile apre Richieste da verificare → Apri un resoconto ricevuto.
L'importazione produce una revisione completa con allegati, senza aggiungere
transazioni ai conti del responsabile. Il file è limitato a 50 MB, validato per
formato/versione, identificativi, importi, date e allegati incorporati. URL remoti
non vengono accettati come giustificativi.

Il fingerprint viene ricalcolato sugli stessi fatti del dipendente; la risposta
si applica solo se il resoconto corrente coincide. Il responsabile può conservare
la revisione nello storico locale già disponibile. Questa è una consegna di file
con revisione locale, non una casella cloud sempre raggiungibile né identità
aziendali certificate.

Sei test import/fingerprint passati. Build portable verificata nel log
review-import-build.log. L'import tramite selettore file e il PDF viewer richiedono
ancora collaudo UI su dispositivi fisici; non sono attestati dai test delle funzioni.

## Strategie

- PWA + file/link: nessun nuovo backend Momentum, funziona anche senza presenza
  simultanea. Il canale di consegna può usare servizi esterni scelti dagli utenti.
- P2P: riusare la mesh quando entrambi i dispositivi sono disponibili; non garantisce
  consegna asincrona quando tutti i destinatari sono offline.
- Gateway dell'azienda: tiene segreti e mapping ERP nell'infrastruttura del cliente.
  È comunque un backend, ma non gestito da Momentum.
- Servizio minimo opzionale: utile per coda cifrata, identità/ruoli e revoche quando
  un cliente richiede accesso aziendale centralizzato. Non implementato qui.

Fonti ufficiali consultate:
- https://webrtc.org/getting-started/peer-connections
- https://www.zoho.com/expense/api/v1/authentication/

Non tutte le API sono utilizzabili direttamente dal browser: verificare per ogni
fornitore OAuth per client pubblici, CORS, gestione allegati e permessi. Non assumere
che un segreto esposto in frontend diventi sicuro mediante offuscamento.
