# Archivio documentale verificabile

## Aggiornamento: backup e ripristino inclusi

Il backup cifrato, quello in chiaro e i due percorsi del kit di recupero includono ora gli archivi documentali in `invoiceDocumentBackup`. Il ripristino li valida prima delle scritture, conserva quelli già presenti e rifiuta versioni in conflitto. Il gruppo documenti viene scritto con un'unica transazione IndexedDB: nessuna importazione parziale di questo gruppo. La scrittura dello stato principale resta separata: se fallisce dopo il gruppo documenti, i nuovi documenti possono restare conservati, senza sovrascrivere originali preesistenti.

Gli allegati vengono separati dal payload attivo/localStorage per evitare duplicazioni pesanti. Il checkpoint prima del ripristino include i documenti precedenti. Gli export dei checkpoint storici mantengono il loro contenuto originale e non ricevono retroattivamente documenti attuali. Se lo storage non può essere letto, il backup completo si ferma con errore anziché ignorarlo. I vecchi backup senza questa estensione non cancellano i documenti presenti.

Prove: 43 test mirati superati (backup, restore, archivio, persistenza); build riuscita in 17,83 s. Chrome con IndexedDB reale: backup cifrato riaperto, ripristino in database vuoto, secondo ripristino senza duplicati, conflitto con rollback di tutte le scritture documentali. Il test isolato usa un database sintetico e non equivale a un dispositivo fisico. La sincronizzazione mesh non è stata estesa ai documenti.

Restano non implementati gli importatori nazionali degli esiti verificati. Nella documentazione tecnica AEAT gli stati del lotto e dei singoli registri sono distinti: `Correcto`, `AceptadoConErrores`, `Incorrecto` non vanno appiattiti in un flag di accettazione. [Specifica del servizio AEAT](https://sede.agenciatributaria.gob.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf). Un originale conservato e integro non certifica da solo provenienza, esito o conformità.

I paragrafi seguenti sono lo storico degli interventi: l'esclusione dai backup è stata superata da questo aggiornamento.

## Aggiornamento: persistenza sul dispositivo

Gli originali vengono ora salvati in IndexedDB, nello store `state` del database `momentum_vault`, sotto chiavi separate per Paese e fattura. Riaprire la schermata recupera e verifica il pacchetto. La scrittura è confermata solo al completamento della transazione; un confronto atomico della versione impedisce sovrascritture silenziose da altre schede. Nessun salvataggio dichiarato se IndexedDB è indisponibile.

Sei test unitari superati; test in Chrome con IndexedDB reale superato: scrittura, lettura verificata, rifiuto conflitto, aggiornamento della versione attesa e riapertura del database. Test isolato in `bench/document-storage-browser.html`, con dati sintetici e database dedicato. Build completata in 17,69 s prima dell'ultimo affinamento del messaggio sullo stato vuoto.

La cancellazione completa del database elimina anche questi documenti. I backup del solo stato Vault e la sincronizzazione NON includono automaticamente queste chiavi: occorre esportare il pacchetto dalla schermata. Non è conservazione fiscale a norma né una garanzia contro cancellazione/evizione del browser. Interpretazione degli esiti ufficiali, revisione esterna e accuratezza su incassi reali restano aperte.

Le note seguenti descrivono il passaggio precedente alla persistenza.

Modulo e strumento locale disponibili. Collegamento UI aggiunto in «Le tue fatture → Documenti e ricevute»: caricamento documento e ricevuta associata, esportazione pacchetto, riapertura con verifica e recupero originali tramite download. Il pacchetto deve corrispondere a Paese e ID fattura. Non sostituisce file già caricati nella schermata.

I file sono temporanei fino alla chiusura della schermata: l'utente deve esportare il pacchetto. Nessun salvataggio pesante nel Vault, nessuna conservazione permanente dichiarata. La UI mantiene esplicita questa limitazione. Non decodifica esiti fiscali né conferma accettazioni/scarti nazionali.

Browser Chrome: accesso dalla fattura e schermata vuota verificati, inclusi layout 390×844 e pulsanti ricevuta/esportazione disabilitati prima di aggiungere un documento. Il ciclo di selezione file non è stato collaudato nel browser in questo intervento; verifica archivio coperta dai test e dal precedente collaudo CLI. Build riuscita in 19,66 s.

`node scripts/document-archive.mjs create input.json output.json` crea un archivio senza sovrascrivere file esistenti. `node scripts/document-archive.mjs verify output.json` verifica ogni file e il manifesto. Nessun invio esterno, pagamento o modifica del Vault.

Formato di ingresso:

```json
{"country":"IT","invoiceId":"1/2026","files":[{"id":"doc","kind":"invoice","name":"fattura.xml","data":"contenuto originale"},{"id":"receipt","kind":"receipt","name":"ricevuta.xml","documentId":"doc","data":"contenuto originale"}]}
```

Paesi IT/CH/ES; testi originali o data URL per dati binari. Massimo 100 file, 10 milioni di caratteri per file e 20 MB UTF-8 complessivi. Le ricevute devono riferirsi a un documento presente. Duplicati, riferimenti orfani, percorsi nei nomi, file modificati e manifesti incoerenti vengono rifiutati. Nessuna interpretazione automatica dell'esito fiscale.

Gli hash SHA-256 rilevano incoerenze rispetto al manifesto. Chi può riscrivere tutto il pacchetto può ricalcolarli: NON attestano autenticità, firma, data certa, trasmissione o conservazione a norma. Anche un pacchetto integro può contenere una ricevuta di scarto o un documento falso. Non contiene cifratura: conservarlo in un luogo protetto.

## Verifiche esterne necessarie

- Italia: ricevute e notifiche dal [monitoraggio ufficiale](https://ivaservizi.agenziaentrate.gov.it/ser/monitoraggio/); non equiparare conferma manuale a esito SdI.
- Svizzera: [AFC, commercio elettronico nell'IVA](https://www.estv.admin.ch/it/commercio-elettronico-iva) richiede prova di provenienza e inalterabilità; un hash autocostruito non basta a dimostrarle.
- Spagna: [AEAT, conservazione dei registri SIF](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-conservacion-accesibilidad-legibilidad.html) va valutata secondo il sistema effettivamente utilizzato. Il modulo non è un SIF verificato.

Restano: collegamento UI, importatori degli esiti nazionali, verifica della provenienza, servizio di conservazione effettivamente collaudato, revisione da professionisti autorizzati. Nessuna delle verifiche è dichiarata completata da questo archivio.
