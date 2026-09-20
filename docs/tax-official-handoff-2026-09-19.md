# Percorsi guidati verso i portali fiscali

Implementati quattro passi localizzati in sette lingue: prepara, apri, controlla, torna. Accesso dal Vault per Italia/Svizzera/Spagna; guida italiana incorporata nel riepilogo fattura senza sostituire la modale o distruggere la bozza. Nascosta nel generatore per il profilo internazionale: non implica un supporto nazionale che quel generatore non possiede.

I collegamenti aprono una nuova scheda con noopener/noreferrer, mostrano il dominio e non includono importi, anagrafiche o token. Nessun click o avanzamento della guida cambia invoices, sdiTransmitted, pagamenti o regime. L'ultimo passo chiude la guida e restituisce il controllo; nel riepilogo la fattura resta aperta. Nessuna persistenza nuova o migrazione dei dati.

## Percorsi coperti

- Italia: preparazione XML, portale Fatture e Corrispettivi, distinzione fra invio/esito/scarto e conservazione. Non è trasmissione SdI integrata.
- Svizzera: accesso al portale AFC, autorizzazione impresa, rendiconto IVA pro, conferma. Il QR di pagamento non è una dichiarazione e l'export Momentum non è eCH-0217.
- Spagna: verifica adeguatezza dell'app gratuita AEAT, accesso, compilazione e controllo nel portale, documento/conferma. L'XML italiano non è utilizzabile come invio spagnolo. Le dichiarazioni periodiche rimangono separate.

## Fonti e limiti dei collegamenti

- https://ivaservizi.agenziaentrate.gov.it/portale/ verificato nel browser: apre l'accesso ufficiale con SPID/CIE/CNS. Non effettuato accesso, caricamento o invio fiscale.
- https://www.fiscooggi.it/guideagenzia/fattura-elettronica-e-servizi-gratuiti-dellagenzia-delle-entrate-settembre-2018 — guida storica dell'Agenzia reperita nel motore di ricerca; lettura diretta bloccata da 403 nel tool web. Non usata per soglie, esenzioni o scadenze attuali.
- https://www.estv.admin.ch/it/rendiconto-iva-online — fonte ufficiale del collegamento https://estvportal.estv.admin.ch/ e del servizio IVA pro; verificata sul web.
- https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html — fonte ufficiale del collegamento https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/MenuAplicacionFacturacion; accesso diretto richiede identificazione, non collaudato con account.

Le istruzioni non fingono di conoscere menu autenticati non osservati. Verificare periodicamente URL e cambiamenti dei portali. Restano fuori da questa consegna guide complete a tutte le dichiarazioni, deleghe, apertura attività, conservazione e pagamenti nazionali/cantonali: richiedono percorsi dedicati e verifica dell'ambito.

## Verifiche

- 93 test mirati superati: guide, profili fiscali UI, calcolo fatture, FatturaPA, QR svizzero. Test di completezza delle sette lingue, whitelist degli host, assenza di parametri privati, Paesi ignoti senza fallback fiscale.
- Build portable superata. Rimane l'avviso preesistente sui chunk grandi.
- Browser reale Chrome: guida dal Vault, percorso italiano in quattro passi e guida spagnola; viewport mobile 390×844. Apertura del portale italiano in nuova scheda; bozza ancora con cliente di prova e importo 500. Nessun overflow orizzontale nel controllo della pagina. Nessuna fattura salvata o inviata.
- Queste prove non equivalgono a test su iPhone fisico, Safari, account fiscali autenticati o trasmissione/conservazione a norma.

Modifiche locali, nessun push/deploy in questo passaggio.
