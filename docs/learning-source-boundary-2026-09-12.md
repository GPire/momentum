# Collegamento delle fonti al percorso attivo

## Correzione

`main.js → idleFetchPrices → fetchVerified → trainingEligible` ora passa
esplicitamente la classe dello strumento. CoinGecko viene interrogato per
crypto, Alpha Vantage per azioni/ETF; la cache distingue le classi. Le vecchie
cache ambigue non vengono cancellate, ma questo percorso non le riutilizza.
Nessun dato personale o peso appreso viene migrato o azzerato.

Il registro dichiara la valuta EUR della richiesta CoinGecko già esistente;
non deduce una valuta per Alpha Vantage. I chiamanti preesistenti senza
`assetKind` mantengono il comportamento precedente: la separazione è verificata
nel percorso prezzi del portafoglio, non dichiarata universale per ogni API.

Una voce duplicata del registro non vale come due fonti. Valute dichiarate
diverse impediscono la conferma incrociata. Entrambe le serie devono superare
il controllo di plausibilità, non solo la prima. Questo non prova da solo
l'indipendenza commerciale dei fornitori o la correttezza di ogni quotazione.

`trainingEligible` rivalida la serie prima di ammetterla: date reali,
ordine temporale, numeri finiti, duplicati conflittuali e plausibilità.
Se presente, `asOf` impedisce osservazioni future rispetto alla rilevazione.
Gli indicatori macro mantengono la possibilità di essere zero o negativi.
I flag `synthetic` e `estimated` escludono i dati dal training; cache di
fallback e dati non confermati restano esclusi come prima. Il controllo
non costituisce autenticazione crittografica della provenienza.

## Apprendimento e integrazione residua

Questa modifica protegge gli input del percorso attivo; non addestra nuovi
pesi neurali e non trasforma una misura storica di rischio in un esito osservato.
Il nuovo adattatore multiasset resta pronto nell'API di analisi e nel benchmark;
il collegamento provider completo e la presentazione nella card sono ancora
da implementare. Gli storici attualmente scaricati possono essere troppo corti
per il minimo di osservazioni richiesto: non abbassare il gate per mostrare numeri.

Per chiudere il ciclo di apprendimento del rischio serviranno previsioni
registrate con la loro versione e data, esiti successivi osservati e confronti
fuori campione. Niente addestramento sulle proprie risposte generate. I motori
fiscali, di categorizzazione e di rischio non condividono etichette intercambiabili.

## Test

49 test mirati delle fonti e del confine di apprendimento passati; il caso
aggiuntivo di elemento nullo è stato eseguito dopo l'ultima correzione.
Le risposte provider sono fixture deterministiche: non è una verifica live
delle quote API o delle condizioni commerciali. Nessuna modifica UI.
Suite completa: 328/328 file passati. Build portable finale passata, con
avvisi preesistenti sulle dimensioni dei bundle. Nessun collaudo nativo nuovo.
