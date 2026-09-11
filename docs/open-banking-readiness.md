# Open banking: decisione di integrazione

Verifica del codice e delle fonti: 11 settembre 2026. Questo documento è un piano tecnico, non un connettore attivo né una certificazione di rilascio.

## Stato verificato

Momentum dispone di importatori CSV/PDF/OCR/CAMT, riconciliazione in `core/deduplicator.js`, persistenza con catena hash in `core/vault.js` e riconoscimento entrate in `predict/income-model.js`. Non è presente un'integrazione API con un aggregatore bancario. Il percorso iniziale riusa i dati reali già disponibili; uno storico sufficientemente coerente può evitare la richiesta dell'accredito. Il budget resta una scelta esplicita.

## Scelta economica da validare

Acquistare inizialmente solo lettura conti, saldi e movimenti. Conservare categorizzazione, riconoscimento ricorrenze e previsioni nei modelli locali di Momentum. Nessuna inizializzazione di pagamenti nel primo perimetro.

| Candidato | Evidenza ufficiale | Decisione ancora necessaria |
|---|---|---|
| Enable Banking | Prezzi per volumi con minimo mensile; sandbox e prova sui propri conti; distribuzione pubblica dopo contratto e KYB. Non offre categorizzazione. | Preventivo e copertura delle banche effettivamente usate dagli utenti. |
| Tink | Per i nuovi clienti preventivo personalizzato; pagina prodotto include lettura conti e aggiornamenti. | Preventivo comparabile, copertura, condizioni per conti personali/aziendali e assistenza. |
| GoCardless Bank Account Data | Documentazione API disponibile e credenziali richieste. | Confermare ammissibilità commerciale di una nuova applicazione; non basare il lancio su una presunta offerta gratuita. |

Fonti: [Enable Banking FAQ](https://enablebanking.com/docs/faq/), [Tink prezzi](https://tink.com/pricing/), [GoCardless documentazione](https://docs.gocardless.com/docs/bank-account-data).

Il vincitore non è determinabile senza preventivi. Confrontare lo stesso insieme di banche e scenari: 100, 1.000 e 10.000 utenti collegati, numero di conti per utente, frequenza aggiornamenti, minimo contrattuale, supporto, rinnovi consenso e IVA. Misurare costo per utente sincronizzato con successo, completezza storico, latenza e percentuale di riconnessioni riuscite. Nessuna promessa di superiorità prima del pilot.

## Architettura proposta

- Un adattatore sostituibile per provider, con capacità dichiarate per banca e paese. UI unica in Vault, nello stesso percorso di importazione, senza pulsante pubblico finché il servizio non è disponibile.
- Gateway minimo autenticato: credenziali del provider esclusivamente server-side, controllo di appartenenza di ogni sessione/conto, callback con stato monouso e scadenza, limiti e revoca. Nessun token globale nel bundle PWA o Capacitor. Il provider e il gateway trattano necessariamente dati: l'informativa dovrà descriverlo e non promettere un percorso interamente locale.
- Elaborazione finanziaria nel Vault locale; nessun dato finanziario nei log o nella telemetria. Il gateway dovrebbe evitare archiviazione dei movimenti; questo non equivale a non trattarli durante il trasferimento. Valutare esplicitamente eventuali necessità di conservazione del fornitore.
- Autorizzazione bancaria nel browser di sistema e ritorno verificato all'app o alla PWA. Testare annullamento, ritorno in un altro browser, processo dell'app terminato e link ripetuto. Le FAQ Enable Banking documentano limiti delle WebView e vietano di condividere i token applicativi con gli utenti.
- Aggiornamenti incrementali a richiesta o all'apertura, con riuso dell'ultimo risultato, un'unica richiesta simultanea per conto, backoff su errori e rispetto dei limiti del provider. Non promettere sincronizzazione continua a PWA chiusa.
- Per Free conservare inserimento manuale, importazione ed esportazione; valutare sincronizzazione automatica in Pro o in un'opzione separata solo dopo averne misurato il costo. Nessun blocco dei dati già importati quando termina un abbonamento.

## Integrità prima di collegare l'API

L'attuale deduplicazione non basta per dichiarare l'open banking pronto. L'identità bancaria deve essere distinta dall'ID interno del Vault: provider, conto e identificativo stabile dell'operazione; dopo una riconnessione occorre riconciliare anche gli identificativi del conto. Non assumere che un ID transazione sia sempre disponibile o stabile.

1. Importare pagine complete, registrando il cursore solo dopo persistenza riuscita. Un retry non deve aggiungere nuovamente le operazioni.
2. Distinguere contabilizzato, in attesa, storno e rimborso. Le autorizzazioni pendenti non devono duplicare la spesa contabilizzata né essere usate come storico confermato dai modelli.
3. Distinguere conto e valuta: stesso giorno/importo/esercente può indicare due acquisti reali. La somiglianza del testo da sola non autorizza una fusione automatica tra fonti.
4. Proporre conferma per corrispondenze ambigue con CSV, foto o inserimenti manuali. Preservare categorie e correzioni esplicite dell'utente.
5. Non modificare importi/categorie sotto la catena hash esistente. Le rettifiche richiedono una strategia compatibile con il Vault e test della catena, prima dell'integrazione.
6. Conservare distinti saldo disponibile, saldo contabile, valuta e istante di aggiornamento; un saldo non diventa un budget o un'entrata.
7. Dopo l'import confermato, riutilizzare gli stessi modelli entrate/ricorrenze/previsioni delle importazioni locali; non riavviare onboarding o chiedere informazioni già disponibili.

## Condizioni prima del rilascio

Contratto e copertura verificati; flusso di consenso/revoca e informativa aggiornati; isolamento utenti del gateway verificato; prove di retry, paginazione interrotta, rate limit, consenso scaduto, doppi acquisti, pending→booked, storni, valute e riconnessione; catena hash intatta; test app-to-bank-to-app su iOS e Android reali. Fino a quel momento rimangono operativi i percorsi manuali e di importazione, senza dichiarare disponibile il collegamento bancario.
