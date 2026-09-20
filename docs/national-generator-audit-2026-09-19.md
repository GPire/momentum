# Collegamenti dei generatori nazionali

## Svizzera: implementato

Il generatore QR già presente ora propone di conservare la richiesta e collegare un incasso. Archivia payload, data, cliente, descrizione, importo CHF e identificativo stabile per quella generazione. Il record usa documentKind=payment-request e non inventa imponibile, IVA o entrate. Il doppio salvataggio dello stesso record non lo duplica. Non è una fattura fiscale completa. Una nuova generazione è un nuovo documento, non deduplicato arbitrariamente per cliente/importo.

Il report italiano ora esclude esplicitamente fatture estere e richieste di pagamento. Gli abbinamenti confermati esteri non diventano incassi italiani. Il resto del calcolo sulle transazioni conserva le regole precedenti.

24 test mirati superati (richiesta QR, report, export, percorsi nazionali). Il parser dell'importo svizzero rifiuta suffissi, decimali oltre i centesimi e valori non validi. Il validatore esistente del QR resta il controllo del payload prima di aprire il risultato; l'archiviazione non sostituisce quel validatore.

## Spagna: ancora incompleta

Il generatore comune espone IT e DEFAULT; DEFAULT non è un generatore spagnolo certificato. Occorrono campi e controlli nazionali, territorialità/regime, numerazione e rettifiche, tracciati e requisiti del sistema informatico applicabili. Nessuna conformità VeriFactu o trasmissione AEAT implementata in questo intervento.

Fonte ufficiale consultata: https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/contenido-facturas.html

Fonte svizzera di contesto IVA: https://www.estv.admin.ch/en/value-added-tax

## Abbonamenti e prove esterne

src/core/subscription.js gestisce piani/feature e licenze, non dimostra acquisto, rinnovo, rimborso, annullamento o notifiche server autenticate. Il servizio di pagamento non è stato attivato. Prima di una prova reale servono configurazione commerciale e ambiente autorizzato del provider scelto.

La revisione professionale e i dispositivi fisici non sono stati collaudati: non simulare firme, pareri o certificazioni. Servono un professionista con casi attesi verificabili e l'accesso ai dispositivi del proprietario. Nessun messaggio inviato a terzi, nessuna credenziale richiesta in chat, nessun push/deploy in questo intervento.
