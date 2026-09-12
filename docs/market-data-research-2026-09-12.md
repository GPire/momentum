# Dataset e apprendimento: verifica del 12 settembre 2026

## Risultato effettivo

Il dataset di ricerca locale contiene 230.626 righe giornaliere: 16 azioni,
20 ETF e 7 cripto, dal 2000 dove lo strumento esisteva, fino all'11 settembre
2026. Sono 43 strumenti accettati su 44 richiesti; AVAX-USD è escluso per
troppi record non validi. Il payload totale dei 43 file è 39.902.600 byte.
Non confondere questo archivio con il pannello quotidiano incluso nell'app:
quest'ultimo mantiene le 11 serie e ora 1.283 rendimenti reali, dopo aver
eliminato la prima riga che prima conteneva rendimenti artificialmente zero.

`npm run bench:research-universe` genera `bench/data/research-universe/`:
file per strumento con OHLCV, adjustedClose quando disponibile, eventi della
fonte, exchange, timezone, valuta e provenienza. Il manifest include quantità,
date, checksum SHA-256 e strumenti respinti. Sono controllati prezzi positivi,
coerenza OHLC, duplicati, copertura minima e freschezza. Le date cripto non
vengono ridotte al calendario della borsa. Nessun valore è riempito a zero.
Lo SHA verifica l'integrità locale del file, NON l'autenticità della fonte.
L'ultimo giorno UTC in corso è escluso; manca una verifica universale della
chiusura secondo ogni calendario di borsa.

L'archivio è escluso da Git tramite `bench/data/`, non viene incluso in Vite,
né inviato ai telefoni o alla mesh. È rigenerabile da un altro computer con
lo script. Non sono state verificate licenze di redistribuzione Yahoo:
la disponibilità dell'endpoint non equivale ad autorizzazione commerciale.
Il selettore di simboli è intenzionalmente limitato e soffre di survivorship
bias: non rappresenta l'universo dei titoli quotati in ogni data storica.
I dati rettificati non sono versioni point-in-time delle rettifiche.

## Collegamenti reali all'app

- `stock-history.js` usa `cleanPriceSeries`: rigetta date impossibili, prezzi
  non positivi e duplicati in conflitto; un provider con serie non valida
  permette di provare il successivo già configurato. Non aggiunge chiamate.
- `fetch-daily-panel.mjs` usa lo stesso controllo prima dell'allineamento:
  ogni rendimento ha un precedente reale. La variazione cripto fra venerdì
  e lunedì comprende l'intero intervallo, ma gli orari di chiusura fra
  mercati NON sono simultanei e restano un limite per correlazioni giornaliere.
- `strategy-evolution.js` ignora esiti non booleani e score fuori intervallo.
  I contatori malformati danno affidabilità neutra. Prior Beta(10,10) al posto
  di Beta(1,1): dopo un esito corretto affidabilità 11/21 invece di 2/3.
  È una scelta conservativa da validare, non un aumento misurato di accuracy.
  I contatori salvati restano intatti; nessuna migrazione o cancellazione.

## Esperimento riproducibile

`npm run bench:research-eval` verifica i checksum e passa al validatore
esistente 129 strategie fisse (43 strumenti × trend 20/60/120 sessioni).
Periodo di valutazione dal 2022; segnali alla chiusura precedente, esecuzione
all'apertura successiva, costo ipotizzato 10 bps per unità negoziata e costo
di uscita finale. Prezzi rettificati coerenti fra apertura e chiusura.
Il risultato è **0/129** oltre il filtro statistico esistente che corregge
i tentativi multipli. Nessuna strategia viene promossa o installata come
nuovo modello. La selezione attuale dei simboli, revisioni storiche, costi
fissi e assenza del book impediscono di chiamarlo benchmark istituzionale.
Non sono stati riaddestrati Nano, Meso o altri pesi neurali.

## Priorità successive

1. **Provenienza e licenze**: fonti autorizzate, snapshot immutabili,
   rettifiche versionate, timestamp di pubblicazione e disponibilità effettiva.
   SEC Company Facts/Submissions consentono acquisizioni bulk ma i dati vanno
   selezionati secondo la data del filing; non usare rettifiche future nei test.
2. **Universo storico**: titoli delistati, variazioni dei ticker, ISIN/MIC,
   split e dividendi, composizione storica ETF, costi e valute. I principali
   ETF selezionati oggi non rappresentano da soli il mercato mondiale.
3. **Trader e cripto**: dati intraday, spread, profondità, liquidità, funding,
   open interest, fee e slippage per venue, outage e token delistati. Archivi
   Binance sono una fonte candidata, non ancora integrata qui.
4. **Investment banking**: fondamentali SEC point-in-time, restatement,
   comparabili tracciabili, debito e capitale, operazioni societarie e scenari.
   Un pannello prezzi non sostituisce questi dati.
5. **Modelli**: benchmark fuori campione per regime/Paese/classe, purging
   e embargo dove le etichette si sovrappongono, calibration e drift,
   confronto con baseline, versioni e rollback. Una nuova rete non va
   promossa solo perché più grande: deve migliorare qualità, latenza o costo.
6. **Distribuzione**: archivio professionale a blocchi caricati a richiesta,
   cache e budget hardware, contratto dati stabile per SDK, controlli sulle
   fonti nella mesh. Poi test indipendenti con utenti e partner reali.

## Fonti primarie consultate

- SEC EDGAR APIs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- SEC developer resources: https://www.sec.gov/about/developer-resources
- Binance public data: https://github.com/binance/binance-public-data
- Nasdaq Data Link terms: https://data.nasdaq.com/terms

## Verifiche

Suite seriale completa: 325/325 file passati (log locale nell'archivio).
Il test aggiuntivo sul fallback dei provider è stato poi verificato insieme
agli altri test mirati: 30/30 passati. Build di produzione portable eseguita.
Non è stato modificato il DOM; nessun collaudo nuovo dei dispositivi nativi
è implicato da questi controlli. Consultare il log di build per l'esito.
