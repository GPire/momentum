# Chiusura delle prove esterne — 19 settembre 2026

## Ultimo aggiornamento: lettore SdI tra privati

Implementato `readSdiReceipt`, collegato a “Leggi ricevuta SdI” negli archivi
IT. Copertura limitata a RicevutaConsegna, RicevutaScarto e
RicevutaImpossibilitaRecapito, namespace fattura/messaggi/v1.0 e versione 1.0.
Legge riferimenti file, hash, data, errori e suggerimenti. Non legge notifiche
PA, P7M, non verifica XAdES e non associa automaticamente l'esito a una fattura.
Un tag Signature non implica firma valida; il rapporto lo dichiara.

Fonte: Allegato A, specifiche tecniche versione 1.9, appendice 4, schema
MessaggiFatturaTypes_v1.0, ripubblicato qui:
https://www.fiscoetasse.com/files/19533/fattura-elettrnocha-specifiche-1-9-2925.pdf
Il download diretto FatturaPA ha risposto 403; la copia è usata per sviluppare
il lettore, non come prova di provenienza di un documento fiscale.

20 controlli browser IT/ES su fixture sintetiche passati; UI SdI provata con
mancato recapito sintetico. Sei test Node su traduzioni/controlli documentali
passati e build riuscita (avviso chunk >500 kB preesistente). Nessun portale
fiscale, file autentico o firma collaudato. Nessun push in questo passaggio.

CH: resta senza importatore automatico di ricevute AFC, perché non è stata
verificata una specifica di esito. Non chiamare eCH-0217 un formato di ricevuta.
Per chiudere questo punto occorre un campione autorizzato o una specifica AFC;
gli originali si possono già archiviare senza attribuire loro accettazione.

Revisione e conservazione rimangono esterne non attivate. Il fascicolo e la
matrice di revisione esistono, ma non c'è un incarico professionale. Per la
conservazione IT il titolare deve accedere a Fatture e Corrispettivi, leggere
l'accordo, aderire se appropriato e verificare copertura e presa in carico.
L'accesso o l'adesione non sono eseguiti da un test locale. CH/ES richiedono
una verifica nazionale degli obblighi e del servizio scelto.

## AEAT: verificatore locale con certificato

Implementato `scripts/aeat_cotejo.py`, separato dalla PWA. Usa il servizio
ufficiale CotejoInternetV1, SOAP 1.1, richiesta non ENI. Il CSV viene richiesto
in modo nascosto; non compare negli argomenti del processo o nel rapporto.
Il certificato e la chiave PEM restano locali. TLS verifica il server e usa
il certificato client. Nessun proxy applicativo, redirect o retry automatico.

Comando di prova (sostituire i percorsi con file autorizzati locali):
`python scripts/aeat_cotejo.py documento.pdf --cert certificato.pem --key chiave.pem`

L'ambiente predefinito è TEST. `--production` abilita esplicitamente il servizio
reale; `--seal` seleziona il certificato di sigillo. Non inviare chiavi private,
password o CSV in chat. La conversione da P12 e la gestione di smart card non
sono implementate: usare il proprio gestore certificati autorizzato.

Il confronto richiede codice 1 e identità binaria completa fra originale e
documento restituito direttamente dal servizio. Codici di annullamento,
documento non cotejable, CSV assente/sconosciuto e problemi tecnici non possono
produrre un riscontro positivo. Un hash MD5/SHA1 senza il binario non basta.
I risultati di TEST non sono promossi a prova di produzione. Il rapporto
locale è modificabile e NON costituisce una firma verificabile da terzi.
Non certifica la correttezza fiscale, la conservazione né qualsiasi XML
VERI*FACTU: il CSV deve identificare proprio il documento confrontato.

Quattro test Python passati (confronto, errori, XML ostili/ambigui, richiesta).
Trasporto con certificato e portale reale NON collaudati: nessun certificato
autorizzato e documento reale sono disponibili. Nessuna richiesta fiscale
è stata inviata. Questo è codice pronto al collaudo, non integrazione
operativa già verificata. Non è collegato all'interfaccia dell'app.

Fonti ufficiali consultate:
- https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/kata/apli/ws/CotejoInternetV1.pdf
- https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/kata/apli/ws/CotejoInternetV1.wsdl
- https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/kata/apli/ws/cotejo_request_int_V1.xsd
- https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/kata/apli/ws/cotejo_response_int_V1.xsd

Alternativa guidata senza integrazione del certificato: servizio web umano
https://sede.agenciatributaria.gob.es/Sede/procedimientoini/ZZ05.shtml

Per chiudere i blocchi esterni: selezionare un professionista e ottenere un
preventivo sul fascicolo già preparato; un titolare autorizzato deve effettuare
l'adesione alla conservazione e fornire prova della presa in carico; il
collaudo di produzione richiede originali autorizzati e accesso appropriato.
Questi passaggi non sono eseguiti da test sintetici o da un consenso generico.

## Registro di collaudo IT/CH/ES aggiunto

`src/invoice/fiscal-evidence.js` verifica che ogni controllo dichiarato sia
legato al Paese, identificativo fattura, documento e impronte esatte del
documento e della prova allegata. Una modifica invalida il controllo anche
se l'archivio viene rigenerato correttamente. Rileva riferimenti estranei,
date future o impossibili, identificativi duplicati e tipi sconosciuti.

Uso tecnico: `node scripts/fiscal-evidence.mjs archive.json [checks.json]`.
L'esito distingue integrità del fascicolo, prove mancanti e registrazioni
non verificate. Un record contiene id, country, invoiceId, documentId,
documentHash, evidenceId, evidenceHash, kind, checkedAt UTC, reviewer e
reference. Tipi: authority-outcome, origin-check, professional-review,
preservation. Le impronte sono quelle interne del formato archivio Momentum,
non hash firmati da un'autorità. Nessuna fonte di fiducia esterna è collegata.
Anche un fascicolo completo mantiene i tre indicatori di verifica esterna a
false: non è una certificazione. Interfaccia utente non ancora collegata.

CH: l'AFC richiede eCH-0217 **2.0.0** per caricare i dati del rendiconto,
seguito da verifica e inoltro nel portale. È un formato di presentazione,
non una ricevuta autentica di accettazione. Non implementare un parser di
esiti basandosi su questo schema.
Fonte: https://www.estv.admin.ch/it/rendiconto-iva-online

Per IT l'accesso allo schema messaggi dal sito FatturaPA non è riuscito in
questa sessione. Il parser non è stato inventato usando esempi non verificati.
Restano importatori IT/CH e verificatori di provenienza effettivi.

## Implementato e collaudato in questo passaggio

La misurazione prospettica `scoreObservedPaymentWindows(state, asOf)` esclude
incassi datati dopo la data di valutazione e osservazioni non ancora effettuate.
Confronta l'errore della previsione con l'incasso a 30 giorni dalla fattura, sugli
stessi casi saldati, riportando anche ampiezza dell'intervallo e fatture aperte
oltre la fine dell'intervallo previsto. Questo ritardo rispetto alla previsione
non è una scadenza contrattuale. Riepiloghi separati IT/CH/ES.

12 test automatici passati con dati sintetici. Il punteggio non verifica la
provenienza dei dati, non certifica un pagamento bancario e non dimostra un
miglioramento reale. Le osservazioni sono già raccolte localmente all'apertura
dello spazio fatture; il nuovo riepilogo è disponibile al codice, non ancora
in un pannello utente. Nessun invio di dati o nuovo addestramento.

## Importatori: separare tre livelli

1. Lettura: documento originale, formato e versione, identificativo fattura,
   protocollo e stato riportato; protezione da XML malformato, DTD, duplicati,
   namespace errato e associazioni ambigue.
2. Provenienza: riscontro presso l'autorità o verifica della firma attendibile,
   con identità del verificatore, data, metodo e impronta dell'originale.
3. Effetto sul flusso: solo l'esito pertinente al documento corretto e alla
   versione corretta può far avanzare il percorso. Nessuna equivalenza fra
   ricevuta caricata, documento autentico, fattura valida e conservazione.

ES: schema AEAT effettivamente consultato:
https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/RespuestaSuministro.xsd

La radice è RespuestaRegFactuSistemaFacturacion. EstadoEnvio riguarda il lotto;
RespuestaLinea/EstadoRegistro riguarda ciascun registro. AceptadoConErrores
richiede uno stato distinto; RegistroDuplicado non autorizza a considerare
accettato il nuovo invio. CSV e identificazione completa della fattura vanno
conservati. Il formato è verificato sulla fonte. È ora implementato un lettore
dei campi principali, collegato al pulsante “Leggi esito AEAT” nelle ricevute
degli archivi ES. Supporta XML diretto e buste SOAP, esiti per riga e avviso
duplicati. Rifiuta DTD, campi ambigui, date impossibili e file troppo grandi.
Non è un validatore XSD completo e non autentica le ricevute; non cambia lo
stato delle fatture. IT/CH restano da implementare per i rispettivi formati.
14 controlli browser superati con fixture sintetiche; componente verificato
in Chrome anche a 390 px con archivio sintetico e adattatore di sola lettura.
Nessun collaudo con ricevute autentiche, caricamento file o portali ufficiali
eseguito in questa sessione. Build riuscita, avviso preesistente chunk >500 kB.

Documentazione e portale prove ufficiali:
https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html

IT: distinguere messaggi SdI per canale/versione e verifica della provenienza;
non usare una ricerca testuale di "accettata" o il solo nome del file.
https://telematici.agenziaentrate.gov.it/Abilitazione/IVerificaFile.jsp

CH: nessun formato generico di ricevuta autenticata è stato verificato in
questo lavoro. Conservare l'originale e usare il riscontro nel portale AFC;
non presentare un generatore QR come un connettore fiscale.
https://www.estv.admin.ch/it/rendiconto-iva-online

## Conservazione: percorso a costo contenuto

IT: valutare il servizio gratuito dell'Agenzia delle Entrate, con adesione,
verifica del periodo coperto e riscontro dell'effettiva presa in carico.
La consultazione non equivale all'adesione alla conservazione. Il documento
ufficiale conferma 15 anni secondo l'accordo: non estendere questa garanzia
ad allegati o documenti estranei al servizio.
https://ivaservizi.agenziaentrate.gov.it/cons/cons-web/resources/pdf/Adesione.pdf

CH: dimostrare provenienza e inalterabilità e mantenere una contabilità
ordinata e verificabile; un hash riscritto insieme al file non basta.
https://www.estv.admin.ch/it/commercio-elettronico-iva
https://www.estv.admin.ch/it/controllo-iva

ES: verificare i requisiti applicabili al SIF e alla conservazione senza
considerare l'invio VERI*FACTU come conservazione universale degli originali.
https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-conservacion-accesibilidad-legibilidad.html

Nessun servizio di conservazione è stato attivato per conto dell'utente.

## Revisione indipendente pronta da richiedere

Usare fiscal-professional-review-matrix.csv e il fascicolo di validazione
esistente. Partire da una revisione delimitata per Paese e regime, con prezzo
concordato prima dell'incarico; non è dimostrato che possa essere gratuita.
Verificare titolo, competenza nazionale e conflitti del revisore.

Ricerca ufficiale iscritti italiani:
https://commercialisti.it/albo-nazionale/ricerca-iscritti/

Bozza di richiesta, NON inviata:

> Richiediamo una revisione indipendente del percorso fattura–incasso–tributi–
> documenti per il Paese e regime indicati nella matrice allegata. Per ogni
> caso servono risultato atteso calcolato indipendentemente, fonti e anno
> applicabile, differenze riscontrate e giudizio motivato. Chiediamo preventivo,
> perimetro, tempi e modalità sicure per eventuali documenti autorizzati.
> I test sintetici del software non devono essere assunti come risultato
> fiscale corretto. Nessuna attestazione generale è richiesta senza prove.

## Incassi reali senza comprare un dataset

Pilota autorizzato su utenti effettivi: salvare la prima previsione prima del
saldo, collegare gli incassi confermati e misurare dopo la data di pagamento.
Mantenere visibili pendenti, revisioni e casi esclusi; confrontare lo stesso
campione con la regola semplice. Conservare i dati sul dispositivo per default.
L'eventuale raccolta di risultati esterna richiede un flusso dedicato,
autorizzazione e minimizzazione: non è attivata dalla telemetria generale.
Un campione di soli incassi già saldati sottostima i ritardi; pubblicare sempre
numerosità, periodo, Paese e limiti, senza dichiarare accuratezza globale.

Restano necessari campioni autentici autorizzati, revisori effettivi e verifica
del servizio di conservazione scelto. Nessuna di queste prove è inventata.
