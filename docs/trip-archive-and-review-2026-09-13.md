# Trasferte: archivio e revisione

L'interfaccia mantiene CSV e riepilogo stampabile per dipendenti, PMI e
commercialisti. Aggiunge un archivio JSON versionato, limitato alla trasferta
selezionata, con metadati, spese originali, UUID, valuta, hash e allegati presenti.
Non è un backup completo del Vault né un formato di importazione dei fornitori.
Il download è esplicito: nessun dato viene inviato a servizi esterni.

La revisione offre un destinatario esplicito e una conferma manuale dell'invio.
Aprire la condivisione non imposta più automaticamente la trasferta come inviata.
Lo storico del revisore è locale e conserva snapshot distinti e decisioni
preparate. Non certifica identità, consegna o autorizzazione aziendale.

## Verifiche

- 25 test mirati: archivio, storico revisione e periodo; tutti passati.
- Build portable riuscita; restano gli avvisi di dimensione bundle.
- Chrome: apertura trasferta sintetica e download `momentum-trip.json` riusciti.
- Il file scaricato contiene la trasferta sintetica e le sue transazioni.
- Nessun nuovo test su hardware iPhone/tablet in questa verifica.
- Suite completa conclusa: 337/337 file passati.
- Correzione successiva del ponte email/Web Share: prepara senza certificare
  l'invio; 12 test del ponte passati, compresi due nuovi casi. I precedenti
  timbri di invio sono conservati, senza reinterpretare dati storici.
- Corretto il confronto degli ID numerici nei pulsanti di invio scontrino.
  Nessuna email realmente spedita e nessuna API aziendale chiamata nei test.

## Integrazioni ancora da implementare

Zoho, Expensify Integration Server, Rydoo API/SFTP e SAP Concur richiedono
adapter specifici e accessi aziendali: non sono attivati da questo export.
Servono mappatura contabile e campi per azienda, gestione sicura dei segreti
fuori dal browser, upload allegati, idempotenza e riconciliazione degli esiti.
Prima di una casella aziendale condivisa servono identità, ruoli e separazione
tra organizzazioni verificati lato server. Non presentare lo storico locale
come sostituto di queste garanzie.

Le traduzioni dei nuovi comandi coprono IT, EN, DE, FR, ES, NL e PT.
