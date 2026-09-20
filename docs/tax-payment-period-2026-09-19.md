# Versamenti fiscali: periodo esplicito

Il pagamento effettuato in un anno può riferirsi a un periodo diverso. La data non costituisce una conferma del periodo fiscale.

## Modifiche

- `recordTaxPayment` conserva anno esplicito e Paese IT nei nuovi versamenti della UI. Non aggiunge importi non finiti o date invalide. La compatibilità dei record storici è preservata.
- `taxReserveStatus` accetta un anno opzionale. Nei riepiloghi annuali considera solo i versamenti attribuiti a quell'anno; quelli senza periodo e gli importi invalidi vengono esclusi e contati separatamente. L'uso aggregato senza anno resta disponibile.
- Report italiano e proiezione annuale Vault usano il periodo esplicito. HTML/CSV/JSON segnalano i versamenti non attribuiti. Nessuna attribuzione automatica o modifica retroattiva dei record storici.
- Modulo con importo, data del pagamento, anno di riferimento e nota. Istruzioni in sette lingue, validazione, errore in pagina e nessun autofocus che apra subito la tastiera mobile. Per un pagamento relativo a più periodi si registrano le quote separatamente.
- Registro: correggere l'anno mantiene ID, importo, data, nota e campi aggiuntivi. Non crea duplicati. Versamenti mancanti di periodo raggiungibili da un avviso nel Vault.

## Prove

58 test mirati passati: anno fiscale diverso dalla data del pagamento, record legacy senza anno, correzione immutabile, importi non finiti/negativi, esclusione Paese estero, report, sette lingue e ripristino attraverso prepareRestoredState. Build portabile riuscita in 18,03 secondi.

Browser Chrome su origine di prova 4181: salvataggio vuoto bloccato; registrato 10,50 euro per 2025; corretto a 2026; ricaricato e verificata una sola voce con stesso importo e nota. Verificato layout a 390×844: campi e azione visibili senza overflow orizzontale. Nessun dispositivo fisico iOS o Android collaudato.

## Limiti

È un registro dichiarato dall'utente, non una verifica bancaria/F24. Anno e totale non identificano ancora tributo, singola obbligazione, credito compensato o ripartizione fra imposte e contributi. Non va usato per certificare un debito estinto. Le quote non sono ricavate automaticamente da un F24. Le proiezioni future restano stime. Nessun nuovo sistema di invio, conservazione o dichiarazione aggiunto; nessun push/deploy.
