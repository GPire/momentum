# Copertura assistente e verifiche commerciali

La vista «Le tue fatture», i controlli e l'assistente per gli incassi sono ora accessibili per Italia, Svizzera e Spagna. Operano sulle fatture presenti nello storico comune (`state.invoices`). Non recuperano automaticamente i documenti dei generatori nazionali separati. Il Paese dello spazio filtra la lista, mentre valuta e versioni dei documenti controllano gli abbinamenti. Gli esempi confermati vengono recuperati solo per lo stesso cliente e Paese.

44 test superati, inclusi tre percorsi completi di logica (IT/EUR, CH/CHF, ES/EUR): suggerimento, conferma parziale, saldo, richiesta di controllo, esportazione/importazione senza duplicati, risoluzione e invalidazione dopo modifica. Non sono prove su dispositivi fisici né invii a portali ufficiali.

Build produzione riuscita. Chrome locale: apertura della vista per Svizzera e Spagna senza esporre la fattura italiana, ritorno all'Italia con fattura e residuo di 52 euro conservati. Gli stati vuoti CH/ES sono stati verificati in browser; i percorsi popolati CH/ES sono verificati nei test automatici, non in browser.

## Addestramento

Il componente è un motore di ranking spiegabile con recupero di esempi confermati; non è una rete neurale. Non è necessario addestrare una rete per usarlo. Prima di scegliere un modello addestrabile occorrono esempi etichettati e autorizzati, separazione train/test per cliente e tempo, confronto con questa baseline, misure di falsi abbinamenti, astensione e recupero dei corretti candidati. Non usare gli stessi casi sintetici per addestrare e dichiarare efficacia commerciale. Le conferme possono alimentare esempi locali, senza invio a terzi; una conferma errata resta un possibile errore umano.

## Cosa impedisce di dichiarare il servizio completo vendibile

1. Collegare e verificare lo storico di tutti i generatori nazionali; controllare valute, rettifiche, pagamenti cumulativi, anticipi e documenti ufficiali.
2. Revisione esterna delle regole dei regimi effettivamente venduti, distinta dai test del software; conservare risultati e fonti versionate.
3. Campione realistico indipendente per precisione dei suggerimenti e riduzione del lavoro. Nessun risultato reale ancora misurato.
4. Prova UI completa dell'importazione: l'estensione Chrome ha rifiutato setFiles senza accesso agli URL file. Nessun permesso ampliato automaticamente.
5. Collaudo su dispositivi fisici, backup/ripristino e allegati; verifica di acquisto, annullamento, supporto e informativa per il servizio scelto.

Non sono stati attivati pagamenti, provider fiscali, invii ufficiali, push o deploy in questo intervento. L'estensione del percorso condiviso non dichiara equivalenza delle funzionalità fiscali nazionali.
