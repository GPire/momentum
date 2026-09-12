# UUID: verifica completa e prossimo perimetro open banking

## Prova eseguita

Server isolato `node scripts/uuid-schedule-preview.mjs`, origine 127.0.0.1:4181, dati sintetici. Nessun uso dell'archivio utente su 4177. Il driver passa un File al vero input di ripristino; non sostituisce il gestore di importazione. La finestra di selezione file del sistema operativo non è stata testata.

1. Importato un export Momentum con una transazione UUID da 23,45 euro, datata 5 settembre a mezzanotte locale. Conferma del ripristino dalla UI: archivio vuoto, una transazione in ingresso.
2. Cliccato Pianifica nella riga importata: nome e importo corretti; inizio 5 settembre, senza slittamento UTC.
3. Scelta ricorrenza mensile, prossimo pagamento 17 settembre, fine 30 settembre. Salvato dalla UI.
4. Ricaricato: una transazione, una scadenza; riaperto dal movimento e verificati nome, importo e tre date.
5. Modificato il prossimo pagamento al 18 settembre e ricaricato nuovamente.
6. Controllo fixture PASS: campi originali del movimento, incluso UUID/hash/prevHash, invariati; esattamente un piano con sourceTxId corretto, importo 23,45, prossimo pagamento 18 settembre e fine 30 settembre.

Browser IAB Chromium, non iPhone/Safari fisici. Il lancio headless separato è bloccato da spawn EPERM. Prova di importazione backup, non di CSV bancario né open banking. Il server di prova applica connect-src self per evitare invii esterni delle fixture; è uno strumento locale e non entra nel bundle di produzione.

## Direzione consigliata

Confermata la priorità open banking in sola lettura: conti, saldi e movimenti. Riusare categorizzazione, scadenze, riconoscimento entrate, Vault e apprendimento già presenti. Nessun nuovo connettore è stato implementato o attivato in questa verifica.

Prima consegna: contratto dei dati e riconciliazione indipendenti dal provider, con test di reimportazione, conto riconnesso, pending/booked, storni, operazioni uguali ma distinte, valute e correzioni personali. Separare ID interno, ID banca, conto e provenienza; non deduplicare solo per data/importo/descrizione. Prima di collegare API, completare anche l'audit degli altri handler delle transazioni: alcune azioni diverse da Pianifica interpolano ancora ID non quotati.

Seconda consegna: gateway autenticato con credenziali server-side, consenso/revoca, callback verificata e adattatore sandbox. Terza: percorso Collega banca nella gestione dati, con ultimo aggiornamento, errori recuperabili e ritorno da banca alla PWA/Capacitor. Infine pilot sulle banche reali del pubblico iniziale.

## Verifica fonti commerciali e tecniche

- [Enable Banking FAQ](https://enablebanking.com/docs/faq/): sandbox/prova dei propri conti prima del contratto; accesso pubblico dopo contratto e KYB; prezzi a volume con minimo mensile da quotare. Non offre categorizzazione, compatibile con il riuso del motore Momentum. Non tutti gli identificativi bancari sono stabili fra sessioni.
- [Tink prezzi](https://tink.com/pricing/): confronto commerciale da richiedere per lo stesso perimetro e volumi.
- [TrueLayer connessioni v3](https://docs.truelayer.com/docs/create-a-connection-v3): verificare prodotto/API offerti nel contratto e mercato scelto; non mescolare identificativi e lifecycle v1/v3. [Consenso](https://docs.truelayer.com/docs/collect-user-consent): il percorso deve esplicitare accesso e preferenze dell'utente.

Non è ancora possibile scegliere il provider più economico: servono copertura delle banche/paesi prioritari, volumi, conti per utente e preventivi comparabili. Valutare costo per conto sincronizzato con successo, completezza storico e riconnessioni, non solo prezzo nominale. Nessun contratto, pagamento o email commerciale inviati.
