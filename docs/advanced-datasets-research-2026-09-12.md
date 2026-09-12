# Dataset avanzati e scenari Momentum — ricerca del 12 settembre 2026

## Decisione
Conservare gli archivi avanzati esistenti (SEC, macro, materie prime e mercati) e aggiungere dimensioni complementari. Una maggiore quantità di righe non prova una maggiore capacità predittiva. Nessun dataset copre ogni crisi futura: la copertura va misurata per famiglia di scenario, paese, epoca, asset e disponibilità dei dati.

## Fonti selezionate e integrazione proposta

| Fonte | Informazioni aggiuntive | Problema concreto | Integrazione Momentum | Accesso e limite |
|---|---|---|---|---|
| [OFR Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/) | Indice giornaliero costruito su 33 variabili; contributi credito, valutazioni, funding, rifugi, volatilità e tre regioni | Distinguere tipi di tensione dietro un movimento di mercato | Affiancamento a `global-stress`, `market-stress`, `eventi-lunghi` | Acquisito per ricerca; ritardo dichiarato di due giorni lavorativi, revisioni possibili, riuso commerciale da verificare |
| [OECD ICIO](https://www.oecd.org/en/data/datasets/inter-country-input-output-tables.html) | Flussi tra attività economiche e paesi; edizione regolare con 80 economie e resto del mondo, 1995–2022 | Trasmissione indiretta di uno shock: energia → industria → clienti → paesi | Esposizioni per settore/paese per il grafo di scenari, non coefficienti causali assunti | File pubblicamente accessibili; termini, edizione e revisione da fissare prima della distribuzione |
| [NY Fed GSCPI](https://www.newyorkfed.org/research/policy/gscpi) | Pressione sulle catene di fornitura; serie dal 1997, trasporti e indagini manifatturiere | Distinguere shock di offerta da cambiamenti della domanda | Contesto per margini, scorte, inflazione e scenari settoriali | Verificare vintage e termini; l’indice aggregato non identifica il fornitore di una singola azienda |
| [BIS](https://www.bis.org/statistics) e [bulk download](https://data.bis.org/bulkdownload) | Credito, servizio del debito, liquidità globale, immobili, titoli di debito e derivati | Fragilità finanziarie per paese e contagio creditizio | Variabili macro/paese e scenari di rifinanziamento | API SDMX; [termini specifici](https://www.bis.org/about/legal/permitted-use-statistics); dati anche stimati, frequenze e coperture diverse |
| [Jordà–Schularick–Taylor Macrohistory](https://www.nber.org/research/data/jorda-schularick-taylor-macrohistory) | Storia annuale di 17 economie avanzate dal 1870 secondo NBER | Ampliare le epoche e i regimi oltre i mercati recenti | Validazione di lungo periodo, crisi e cambiamenti strutturali | Verificare release e licenza; dati annuali non trasformabili in osservazioni intraday |
| [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | Bilanci, documenti, rettifiche e cronologia dei depositi | Ragionamento documentabile su aziende e contabilità | Arricchire il generatore e i comparabili già esistenti | 82 aziende già acquisite nel candidato: 96 valori mancanti e 901 differenze impediscono la promozione indiscriminata |
| [Coin Metrics](https://docs.coinmetrics.io/getting-started) | Metriche di rete e mercato crypto | Separare prezzo, attività di rete e condizioni di mercato | Input crypto distinti per significato e fonte | [Community API senza chiave](https://docs.coinmetrics.io/api); community e prodotti commerciali hanno coperture differenti; termini da verificare |
| [Databento](https://databento.com/docs/api-reference-historical?historical=http) | Trades, top-of-book, book e snapshot secondo dataset/schema | Slippage, liquidità, esecuzione e scenari intraday | Ricerca di esecuzione separata dalla PWA e dalle serie giornaliere | Commerciale, diritti degli exchange e redistribuzione; nessun acquisto autorizzato/eseguito, costo non stimato |
| [S&P Global Compustat](https://www.spglobal.com/market-intelligence/en/solutions/products/fundamental-data) | Fondamentali standardizzati e snapshot point-in-time; pagina ufficiale riporta oltre 3.000 campi e snapshot dal 1987 | Comparabilità professionale e backtest storici | Riferimento commerciale per valutare copertura e qualità della pipeline proprietaria | Contratto e preventivo; non acquisito, non presentato come dataset gratuito |
| [FinBen](https://github.com/The-FinAI/FinBen) | Benchmark di compiti finanziari per modelli | Misurare estrazione, ragionamento, rischio e altre capacità | Valutazione esterna separata dai dati di training | Licenze dei singoli dataset da controllare; evitare contaminazione train/test |

La [ricerca BloombergGPT](https://arxiv.org/abs/2303.17564) descrive un corpus finanziario di 363 miliardi di token. È un riferimento di ricerca, non la prova che quel corpus sia liberamente scaricabile o riutilizzabile da Momentum. Il vantaggio proprietario da costruire è nella normalizzazione, nei collegamenti, nei controlli e nei risultati validati; non cambia la proprietà dei dati esterni.

## Acquisizione effettuata
`npm run bench:ofr-stress` scarica l’endpoint usato dalla pagina OFR e salva dati e manifest in `bench/data/research-universe/` (ricerca locale, ignorata da Git). Controlla 9 serie, valori finiti, date giornaliere ordinate e uniche, assenza di date future e calendari uguali.

Risultato verificato: 6.755 date, 60.795 valori, dal 2000-01-03 al 2026-09-09. Non sono 60.795 campioni indipendenti: le nove serie sono legate. Conservati URL, istante di acquisizione e hash SHA-256. La fotografia è revisionata: non diventa point-in-time attribuendo a tutte le righe la data del download.

Il benchmark riusa `finestraLunga` e quindi le serie giornaliere di Momentum. Per quattro finestre esplicite salva stress, contributi al picco e movimenti storici contemporanei:
- 2008–2009: picco FSI 29,32 il 2008-10-10.
- Febbraio–giugno 2020: 10,266 il 2020-03-19.
- 2022: 3,47 il 2022-09-29.
- Marzo–maggio 2023: 2,426 il 2023-03-15.

Le finestre sono scelte per esplorazione retrospettiva. Non sono un campione imparziale né una validazione di previsione o causalità. La fonte OFR segnala anche correzioni di osservazioni nel maggio 2026: questo rende necessario versionare gli snapshot.

## Copertura multi-scenario da costruire
1. Famiglie: inflazione/disinflazione, domanda/offerta, tassi, liquidità/funding, credito/default, commodity, valute, filiere, utili e crypto.
2. Intensità e tempi: shock piccoli/grandi, veloci/persistenti, simultanei/sequenziali; ritardi specifici per variabile.
3. Collegamenti: effetti diretti e indiretti, percorsi condivisi senza doppio conteggio; esposizioni osservate distinte da ipotesi economiche.
4. Verifiche: separazione cronologica, esclusione di intere crisi dal training, paesi/settori non visti, revisioni e dati mancanti, costi/liquidità, shock mai osservati dichiarati come ipotesi.
5. Confronti: benchmark semplici, calibrazione dell’incertezza, errore per regime e frequenza di astensione. Promuovere un modello solo dopo miglioramenti fuori campione; nessuna promessa di copertura totale.

## Ordine di esecuzione
Primo: completare la riconciliazione SEC senza perdere l’archivio. Secondo: OFR + GSCPI per scenari di stress/offerta. Terzo: ICIO + BIS per propagazione tra paesi/settori. Quarto: crypto e feed di esecuzione professionali secondo diritti e budget. FinBen resta un percorso di verifica parallelo, non un sostituto dei dati finanziari.

Nessun archivio app modificato, nessun nuovo peso neurale, nessun deploy. Il nuovo dataset OFR è disponibile localmente per ricerca; le altre fonti sono selezionate e documentate, non già scaricate o integrate nella UI.
