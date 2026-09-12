# Motore storico multi-asset

`src/alpha/portfolio-history-risk.js` calcola scenari storici buy-and-hold
su storici per strumento. È separato dalla simulazione settoriale ribilanciata:
i due metodi non sono intercambiabili né i loro orizzonti confrontabili.

Contratto: posizioni `{ticker, valueBase}` già valutate nella stessa valuta;
storici `{currency, source, points:[{date,price}]}`; eventuali cambi storici
`fx[quoteCurrency] = {baseCurrency,source,points}`. Ogni cambio esprime unità
di valuta base per una unità della valuta quotata, sulla stessa data.
Se manca una valutazione il calcolo si ferma. Se mancano serie o cambi,
la posizione resta nel denominatore della copertura ma è esclusa dai risultati.
Sotto il 50% di copertura non viene emessa una misura.

Sono esclusi prezzi invalidi, date conflittuali e osservazioni dopo `asOf`.
Il risultato espone date iniziale/finale, età dell'ultima osservazione e
copertura. La frequenza è giornaliera per contratto del chiamante: `horizon`
indica osservazioni comuni, NON giorni di calendario o mesi. Mercati con
chiusure non simultanee restano un limite. Non si interpolano cambi o prezzi.
Le finestre sono disgiunte; ciò elimina sovrapposizioni ma non dimostra
indipendenza statistica. Servono almeno cinque osservazioni nella coda.

L'Expected Shortfall mantiene il segno: un contributo positivo protegge,
non è presentato come perdita. `changeBase` riguarda solo il valore coperto.
Somma dei contributi verificata contro ES, anche quando cambia la valuta.
Le rettifiche storiche e la qualità delle fonti non diventano point-in-time
per il solo fatto di usare questo motore.

## Prova sull'archivio reale

`npm run bench:research-eval` usa il motore e verifica SHA-256 prima della lettura.
Due portafogli ipotetici di 1.000 USD per posizione, orizzonte 5 osservazioni:

- SPY, QQQ, TLT, GLD: 1.097 finestre non sovrapposte; copertura 100%.
- AAPL, MSFT, JPM, BTC-USD, ETH-USD: 443 finestre; copertura 100%.

Il rapporto riproducibile è `bench/data/research-universe/evaluation.json`,
escluso da Git. Non contiene posizioni personali. Non è un benchmark
di accuratezza predittiva né una simulazione di esecuzione sul mercato.

## Stato dell'integrazione

Motore implementato, sei test mirati e collegamento al benchmark reale.
NON ancora collegato alla card dell'app: le posizioni esistenti non hanno
sempre una valuta verificata e gli storici di ricerca non sono distribuiti.
Il prossimo passo richiede valorizzazione base per posizione e un contratto
di storico disponibile nell'app, poi presentazione multilingua distinta dalla
simulazione settoriale. Nessun archivio utente o schema Vault modificato.
