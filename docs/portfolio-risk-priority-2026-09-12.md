# Priorità di sviluppo e correzioni del rischio

Decisione: partire dalla correttezza del rischio personale, poi ampliare la
copertura con storici autorizzati di ETF, azioni e cripto. Fondamentali
societari point-in-time seguono per il percorso investitori. Per autonomi,
Partita IVA e trasferte devono collegare obblighi, incassi e rimborsi: non
aggiungere flussi separati che duplicano gli stessi dati. Intraday e book
restano successivi a copertura, licenze e verifica dei modelli.

## Correzioni implementate

- Attribuzione della perdita coerente con il ribilanciamento mensile del
  portafoglio simulato. Ogni contributo è calcolato sul capitale a inizio
  mese; la somma coincide con il rendimento dello scenario.
- Selezione degli stessi scenari di coda usati dall'Expected Shortfall,
  senza soglia VaR arrotondata che poteva includere/escludere casi diversi.
- Contributi positivi non più mostrati come fonte di perdita tramite valore
  assoluto. Le quote descrivono solo i contributi negativi lordi.
- Parametri di simulazione limitati e verificati prima di generare percorsi:
  da 100 a 10.000 percorsi, orizzonte 1–120 mesi, almeno due casi in coda.
- Cache rischio e track record invalidata anche da costo, classe, valuta,
  prezzi e settore, oltre a ticker e quantità.
- Corretto in sette lingue «12 mesi peggiori su 100»: la configurazione UI
  attuale usa il 2,5% peggiore degli scenari a 12 mesi. Il testo del motore
  usa invece i parametri effettivi, anche se viene chiamato diversamente.

## Evidenza

Test di regressione prima della correzione: portafoglio 60% XLK / 40% XLE,
400 scenari con seme 5; somma contributi -0,41873 vs ES -0,42230. Il test ora
richiede riconciliazione entro l'arrotondamento (0,00003). I test mirati del
rischio, track record e diagnosi istituzionale passano: 44/44.
Build portable completata. Il log completo della suite è locale in
`bench/data/research-universe/portfolio-tests.log`.

## Limiti rimasti

Questo incremento corregge il motore esistente: NON aggiunge ancora cripto
e obbligazioni al pannello settoriale. SPY e altri indici ampi continuano a
essere proxy equipesati dei nove settori, non composizioni ETF verificate.
Non viene risolto il cambio fra valute né il look-through delle partecipazioni.
La formula bootstrap non è una certificazione regolamentare. Non è stato
eseguito un nuovo collaudo visuale/nativo dei dispositivi.

Prossimo incremento: contratto di storico per singolo strumento con fonte,
valuta, rettifiche, calendario e periodo disponibili; calcolo multi-asset
sulla parte realmente coperta, senza attribuire a titoli giovani crisi
precedenti alla loro esistenza. Distribuzione dei dati di ricerca e
integrazione UI richiedono verifiche distinte.
