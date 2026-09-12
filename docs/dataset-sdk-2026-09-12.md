# Dataset SDK e matrice scenari — 2026-09-12

Implementato `src/sdk/datasets.js` e collegato al download OFR esistente. Il contratto comune valida fonte, unità, frequenza, tipo di storico e uso previsto sulla base di una policy dell’applicazione chiamante. Le autorizzazioni non vengono prese dal payload scaricato.

Riutilizza `macroVintageSnapshot`: selezione per data di conoscibilità, conflitti esclusi e nessuna anticipazione delle revisioni. Per snapshot revisionati ammette soltanto ricerca, non backtest o training storico. L’indicazione point-in-time deve corrispondere alla policy: un dataset non può cambiare da solo la classificazione concordata. Questo è un controllo di coerenza, non una firma crittografica o una verifica della licenza.

La matrice multi-serie interseca date effettive, espone copertura per colonna e rifiuta frequenze miste. Non concatena mesi e giorni, non riempie buchi, non trasforma coincidenze in cause. Supporta valori negativi/zero come quelli di spread e stress. Primo collegamento verificato su archivio OFR: 6.755 date comuni, 9 serie. Gli archivi SEC, di mercato e macro dell’app restano invariati.

Esempio d’integrazione e limiti nel README SDK. Nessun endpoint pubblico o SDK bancario certificato, nessun nuovo modello addestrato, nessun deploy; dati OFR ancora locali per ricerca. Per applicazioni istituzionali servono anche autenticazione, isolamento tenant, policy di accesso, audit persistente e gestione delle revisioni/ritiri. L’SDK non sostituisce tali servizi.

Validazione: 7 test dedicati; suite completa 333/333 file passata; build portable passata in 21,76 secondi. Ingestione OFR rieseguita con contratto SDK: 6.755 date comuni, 9 colonne.
