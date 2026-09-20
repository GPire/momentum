# Fatture: prossimo passo e assistente locale

Percorso italiano unificato in «Le tue fatture»: ricerca, quindici elementi iniziali, priorità ai dati incoerenti e controlli aperti, importo da confermare, incasso da collegare, incassi registrati. Il saldo registrato non è una certificazione fiscale o di invio. CH/ES conservano l'accesso agli incassi preesistente.

L'assistente riusa il riconoscimento lessicale del cliente del motore tax-cash-basis e recupera esempi dagli abbinamenti confermati dello stesso cliente. Gli esempi derivano dal registro attuale: se le fonti cambiano e invalidano il registro, nessun suggerimento viene mostrato. Nessun addestramento neurale, nuovo dataset remoto o chiamata a provider è introdotto.

Filtri: valuta esplicita uguale, importi ancora disponibili, data valida successiva all'emissione entro 400 giorni. L'importo uguale da solo non basta. Si mostrano al massimo tre candidati con motivi; un click apre la conferma dell'importo nel percorso esistente, senza registrazione automatica. Pesi euristici di ordinamento, non probabilità. Nessuna decisione fiscale delegata al motore.

Test: incasso parziale/saldo, richieste aperte, dati corrotti, apprendimento da conferme, invalidazione degli esempi, valuta diversa, data antecedente, importo uguale senza cliente. Suite iniziale: 39 test passati. Questi casi non dimostrano un miglioramento quantitativo su dati reali né leadership di mercato.

Restano benchmark su esempi rappresentativi, gestione strutturata dei rifiuti, identificazione robusta dei clienti omonimi e ragioni sociali variabili, pagamenti cumulativi/anticipi/FX, collaudo fisico e revisione fiscale esterna. Non modificare dati contabili per migliorare il punteggio del motore.

Verifica finale: 40 test superati, build produzione completata in 22,57 s. Browser Chrome sul profilo locale sintetico: ingresso «Le tue fatture», residuo 52 euro e controllo aperto correttamente prioritizzato, apertura diretta dei controlli della fattura. Il percorso visuale di conferma di un suggerimento non è stato collaudato in questo passaggio. Nessun push/deploy effettuato.
