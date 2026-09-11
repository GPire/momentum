# Benessere finanziario e Apple Salute — proposta tecnica

Stato: direzione verificata nella documentazione Apple; nessun accesso HealthKit implementato o richiesto. Nessuna raccolta di dati di salute aggiunta alla PWA.

## Esperienza proposta

Accesso facoltativo in Vault, senza popup al primo avvio: «Come ti senti rispetto ai tuoi soldi?». Risposta dichiarata dall'utente, modificabile prima della conferma. Il check-in può essere usato per scegliere un tono più rassicurante e spiegazioni più brevi, senza cambiare i calcoli finanziari o nascondere rischi. Nessun punteggio diagnostico, nessuna deduzione di stress dal saldo.

Apple espone HKStateOfMind e l'associazione money. Il collegamento concettuale utile è uno stato d'animo dichiarato con associazione denaro, non l'anello del budget trasformato in attività fisica. Il prodotto va validato come servizio di benessere prima della richiesta dei permessi.

## Implementazione prevista

1. Definire un check-in locale con data, risposta esplicita e provenienza user-reported. Nessuna importazione automatica da transazioni o chat. Evitare campi di testo libero nella prima versione.
2. Conservare il dato separatamente dal Vault finanziario, dalla telemetria, dall'apprendimento condiviso e dai backup generici. La cancellazione deve essere comprensibile e indipendente.
3. Aggiungere un plugin Capacitor iOS con verifica di disponibilità dell'API e autorizzazione al solo tipo richiesto. Mappatura esplicita della risposta a HKStateOfMind, con associazione money; nessun importo, commerciante o debito nei metadati.
4. «Salva anche in Apple Salute» deve essere una scelta separata; rifiuto o API non disponibile lasciano funzionante il check-in locale. Nessun retry silenzioso dopo una revoca.
5. Android e browser conservano il percorso locale. Non simulare un collegamento a Health Connect senza verificarne i tipi disponibili.
6. Verificare su iPhone reale: autorizzazione negata/concessa/revocata, duplicati, fusi orari, cancellazione, indisponibilità, accessibilità e dichiarazioni privacy degli store. Valutazione separata per minori prima del rilascio del check-in.

## Fonti primarie consultate

- https://developer.apple.com/documentation/healthkit/hkstateofmind/association/money
- https://developer.apple.com/documentation/healthkit/hkstateofmind
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data

L'esistenza dell'API non garantisce l'approvazione App Store. La funzione non deve essere presentata come già disponibile.
