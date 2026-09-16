# Momentum come fornitore di collaborazione aziendale

## Scelta

Momentum può fornire direttamente il servizio, le API, l'assistenza e il contratto con il cliente, acquistando infrastruttura da operatori esterni. Questo è diverso dal possedere data center. La prima opzione è coerente con lo stato del progetto; la seconda richiede una valutazione di capitale, personale operativo, disponibilità e volumi che oggi manca.

La proposta è un servizio Momentum con infrastruttura sostituibile: un ambiente gestito per le PMI e un'opzione nell'infrastruttura del cliente per le aziende che hanno un reparto IT. Non imporre al dipendente la scelta del cloud. Non promettere costo totale zero: anche software senza licenza e hardware già acquistato richiedono gestione.

## Più provider, con uno scopo preciso

Tre ruoli possibili: servizio primario, conservazione di documenti consultati raramente e copia di recupero indipendente. I ruoli possono inizialmente stare sullo stesso operatore; un secondo operatore si introduce quando risparmio misurato o requisiti di recupero lo giustificano. Una copia di backup costa di più della singola copia e non è automaticamente un sistema di failover.

Le approvazioni devono avere una sola autorità di scrittura per azienda. In caso di indisponibilità si conservano bozze e richieste da inviare, senza registrare due decisioni concorrenti su due provider. L'eventuale subentro richiede verifica della replica, blocco del vecchio scrittore e procedura collaudata. Non costruire ora un database globale con scritture simultanee su tutti i provider.

Ogni azienda va assegnata a una regione e a un ambiente operativo compatibile con i suoi requisiti. Una migrazione non deve essere avviata soltanto perché un'offerta diventa più economica: occorrono criteri su localizzazione, chiavi, autorizzazioni, contratti, integrità e ripristino. Il prezzo è uno dei vincoli, non l'unico.

## Risparmio economico verificabile

Cloudflare R2 Standard indica 0,015 USD/GB-mese ed egress gratuito; include quote gratuite. Backblaze B2 indica un prezzo iniziale di 6,95 USD/TB/mese, con egress gratuito entro tre volte lo storage medio e condizioni favorevoli per determinati partner. I rispettivi modelli di operazioni e trasferimenti vanno confrontati sul carico reale. Fonti consultate il 14 settembre 2026: [R2](https://developers.cloudflare.com/r2/pricing/), [B2](https://www.backblaze.com/cloud-storage/pricing).

Esempio di confronto delle sole tariffe marginali, con TB decimale, escludendo quote gratuite, operazioni, trasferimenti, imposte e copie: 1 TB costa nominalmente 15 USD/mese su R2 contro 6,95 USD su B2; differenza 8,05 USD. A 10 TB la differenza nominale è 80,50 USD/mese. Non sono preventivi completi e non dimostrano che B2 sia sempre preferibile. A piccoli volumi una singola ora di manutenzione può assorbire il risparmio.

Regola decisionale proposta:

`beneficio = costo attuale evitato - costo nuovo - trasferimenti - replica - gestione aggiuntiva - migrazione ammortizzata`

Per migrare servono beneficio positivo sul carico osservato, margine per errori di previsione e recupero dell'investimento in un periodo concordato. Le quote gratuite condivise si contabilizzano una volta per account, non per ogni cliente. Non aprire account artificiosi per moltiplicarle.

Hetzner documenta uno storage con prezzo base per account: è un'alternativa da valutare quando il volume giustifica un minimo fisso, non una quota gratuitamente disponibile. Prezzo applicabile e traffico vanno verificati nella configurazione geografica e fiscale scelta. [Documentazione Hetzner](https://docs.hetzner.com/storage/object-storage/overview/).

## Le ottimizzazioni da realizzare prima

1. Conservare gli originali una volta per azienda e usare manifesti nelle revisioni. Una modifica a una nota non deve ricaricare tutte le ricevute.
2. Caricare file binari separatamente dal JSON, con ripresa dopo interruzione e verifica dei byte. Il formato base64 aumenta il volume di circa un terzo; la sostituzione richiede compatibilità con gli archivi esistenti.
3. Preparare anteprime leggere e dati estratti sul dispositivo dove possibile, mantenendo controllo server prima dell'accettazione. Non scambiare una previsione OCR per un dato certo.
4. Leggere cambiamenti mediante cursore e notifiche di eventi, evitando riletture complete e polling continuo di ogni documento.
5. Registrare consumi per azienda: byte, operazioni, calcolo e tentativi. Le metriche operative non richiedono il contenuto delle ricevute.
6. Usare limiti dichiarati, avvisi e code che preservano i dati quando si raggiunge una quota. Nessun invio incompleto deve apparire ricevuto.

Una cache migliora la velocità, ma non sostituisce l'archivio. La deduplicazione non deve rivelare file appartenenti ad altre aziende. Una copia compressa non sostituisce silenziosamente l'originale. La conservazione viene definita con il cliente, non accorciata automaticamente per risparmiare.

## Componente proprietario

Il componente da progettare è il coordinamento tra identità, azienda, documenti e destinazioni. L'interfaccia degli allegati deve distinguere `inizia`, `carica`, `verifica`, `finalizza`, `leggi` e `scadi`; quella dei connettori deve distinguere `prepara`, `invia`, `verifica esito` e `riconcilia`. I nomi sono un contratto proposto, non API già implementate.

Una tabella autorizzata dal servizio associa ogni azienda a provider, regione, riferimento della chiave e versione della configurazione. Il browser non decide liberamente dove leggere o scrivere documenti aziendali. Il manifesto contiene riferimenti stabili e hash, non credenziali. La sostituzione del provider avviene dietro questi riferimenti, con verifica dell'integrità prima del passaggio.

Per clienti grandi, un agente installato nell'ambiente del cliente può eseguire export e collegamenti verso gestionali senza trasferire le credenziali al frontend. È un componente da mantenere e aggiornare, non un modo di eliminare ogni costo. Per le PMI il percorso predefinito resta interamente gestito da Momentum.

## Mesh e calcolo distribuito

La rete tra dispositivi può assistere preparazione locale, trasferimenti autorizzati o elaborazioni non urgenti su nodi consenzienti. Non deve essere necessaria per approvare o recuperare una ricevuta. Dispositivi spenti, revoche non ancora ricevute e connessioni assenti impediscono di promettere continuità aziendale basata solo sui telefoni.

I documenti aziendali non devono finire automaticamente sui dispositivi di altri clienti per risparmiare storage. Condivisione del calcolo, accesso ai dati e responsabilità operative sono problemi separati. La disponibilità di risorse volontarie non costituisce uno SLA.

## Percorso globale realistico

Iniziare con una regione e un percorso di approvazione completo. Aggiungere ambienti regionali con lo stesso modello dati e configurazioni distinte quando emergono requisiti reali. Identità e indirizzamento possono essere coordinati, mentre documenti e audit rimangono nell'ambiente assegnato. La collocazione regionale da sola non certifica conformità normativa.

Prima di aprire un secondo provider servono: ripristino provato, migrazione ripetibile, revoca funzionante, misure dei costi e osservabilità. Prima di offrire il servizio a una multinazionale servono anche disponibilità concordata, procedure operative, deleghe, gestione degli incidenti e assistenza. Il prezzo basso non sostituisce questi requisiti.

Stato: estensione progettuale del rapporto `company-low-cost-research-2026-09-14.md`. Nessun provider nuovo, trasferimento dati, replica, agente o routing globale è stato attivato. Il prossimo sviluppo concreto rimane il manifesto allegati compatibile con le revisioni già esistenti.
