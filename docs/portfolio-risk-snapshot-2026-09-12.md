# Valutazione verificabile prima del rischio

## Implementazione

`src/alpha/portfolio-risk-snapshot.js` collega quantità detenute, prezzi datati,
valute e cambi al motore storico multiasset. Non usa il prezzo di acquisto
come prezzo corrente. Ogni valutazione registra fonte, data e conversione.
Una posizione non valorizzabile blocca il risultato: non viene nascosta dal
denominatore della copertura. Gli storici mancanti restano invece gestiti
dal quality gate del motore, dopo aver stabilito il valore del portafoglio.

Prezzi futuri, valute incoerenti, quantità non positive, valori non numerici
e overflow sono rifiutati. La finestra predefinita di freschezza è sette giorni
di calendario, configurabile da zero a trenta: è una regola tecnica, non una
garanzia di prezzo in tempo reale. Il cambio per la valutazione deve avere
la stessa data del prezzo; per i rendimenti servono i cambi storici.
Se lo storico comune è troppo vecchio, le misure di rischio sono soppresse.

L'importatore CSV conserva la colonna opzionale `currency`/`valuta` senza
inventarla per i vecchi file. Anche codici non riconosciuti sono conservati
per impedire che un errore venga scambiato per assenza di valuta.

`analyzePortfolio(positions, { riskContext })` espone `historicalRisk`;
senza contesto restituisce `missing-risk-context`. Il wrapper NeuroSym espone
già questa API, ma **non è chiamato dalla scheda attuale dell'app**.
Il benchmark di ricerca usa ora questo adattatore con prezzi di chiusura
non rettificati per le quantità ipotetiche e storici rettificati per i rendimenti.
La data di valutazione è quella del manifesto, per riproducibilità.

## Compatibilità e limiti

Nessuna migrazione, reset o scrittura nel Vault, nessun invio dati, nessun
nuovo peso neurale. I vecchi campi dell'analisi mantengono il comportamento
precedente: i loro totali non diventano multicurrency grazie a questo campo.
Il nuovo risultato è separato e richiede un contesto completo e verificato.
La UI esistente del rischio settoriale resta invariata; non dichiarare questo
motore già visibile o alimentato automaticamente dai provider.

Il lavoro successivo è collegare i provider dell'app al contratto di quote e
storici, poi presentare copertura e risultato nelle sette lingue. Seguono i
fondamentali societari storicizzati per data di disponibilità. Le formule
statistiche note e le fonti mantengono attribuzione: l'integrazione del prodotto
non attribuisce a Momentum proprietà sui dati di terzi.

## Verifica

23 test mirati passati: importazione preesistente, motore storico e nuovo
adattatore; inclusi valuta, cambi, freschezza, date future, overflow,
posizioni sconosciute e assenza di mutazioni degli input.
Suite completa: 327/327 file passati. Build portable riuscita, con avviso
preesistente sulle dimensioni dei bundle. Benchmark reale: 129 strategie,
zero promosse; portafogli con 1.097 e 443 finestre, copertura completa.
Nessuna modifica grafica e nessun nuovo collaudo iOS/Android in questo incremento.
