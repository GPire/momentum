# Incertezza degli effetti e integrazione rischio in Analisi

## Metodo scientifico implementato

`olsWithSE` aggiunge la diagonale della covarianza HAC Newey–West con kernel
Bartlett, correzione n/(n-k) e ritardo esplicito oppure euristica
floor(4*(n/100)^(2/9)). Restituisce `seHac` e `hacLag`, mantenendo `se`
classico per compatibilità. Dati non finiti e colonne non allineate sono
rifiutati: nessun troncamento silenzioso nella regressione.

Gli effetti diretti e le interazioni usano il maggiore errore standard tra
classico e HAC. È una scelta prudenziale di Momentum, non un nuovo teorema
o una garanzia di copertura al 95%. I risultati espongono
`uncertainty: max-classical-hac`. Il percorso già attivo di orchestrazione
causale e scenari riceve quindi gli intervalli aggiornati, senza un motore
parallelo. Nessun nuovo peso neurale addestrato.

Fonte del metodo: [Newey e West, NBER t0055](https://www.nber.org/papers/t0055).
Limiti da mantenere espliciti: HAC è asintotico, non identifica cause,
non risolve confondenti omessi, selezione del grafo sullo stesso campione,
molteplicità dei test o dipendenze fra coefficienti dei percorsi indiretti.
L'approssimazione normale preesistente dei p-value rimane. Per limiti nelle
serie temporali e piccoli campioni vedere anche
[On Robust Inference in Time Series Regression, NBER w32554](https://www.nber.org/papers/w32554).
Non dichiarare superiore al mercato senza benchmark comparativi.

## Card del rischio

La card esistente in Analisi usa il rischio storico sui singoli strumenti
quando è calcolabile. Il testo è condiviso con il Q&A nelle sette lingue.
Mostra importo con segno e fonti. Se i dati non bastano lo dichiara e, quando
disponibile, etichetta separatamente il precedente metodo settoriale. Nessuna
nuova card, nessun dato inventato, nessuna modifica a Vault o transazioni.
Il titolo evita la promessa precedente di misurare quanto si rischia davvero.

Rimangono i limiti dei provider: valute mancanti, assenza dei cambi e storici
troppo corti impediscono il nuovo risultato. Nessun allentamento dei gate.

## Verifiche e prossimi passi

29 test causali mirati passati, inclusi tre nuovi test scritti prima della
modifica: esempio HAC calcolato a mano, input invalidi/disallineati e
intervalli non più stretti dei due stimatori. 31 test rischio/Q&A passati.
Il prossimo lavoro scientifico richiede benchmark fuori campione, simulazioni
con confondenti nascosti, verifica della copertura degli intervalli e
validazione prospettica delle modifiche confermate dagli utenti. La prudenza
di un intervallo non equivale a un miglioramento misurato dell'accuratezza.

Build finale riuscita, con avvisi preesistenti sulle dimensioni dei bundle.
Suite completa finale: 330/330 file passati, dopo le modifiche causali.
Browser locale: reload della build e apertura Analisi/Investimenti riusciti.
Il profilo di prova non ha posizioni: card nascosta correttamente; il ramo
numerico della card non è stato collaudato visivamente con un portafoglio.
Nessun test nativo iOS/Android in questo incremento.
