# Investimenti: confronto verificato e prossime capacità

Stato del 25 settembre 2026. Questo documento distingue prodotto funzionante,
prototipo e lavoro necessario. Non è una promessa di prezzi di borsa in tempo
reale gratis né una dichiarazione di superiorità su piattaforme istituzionali.

## Dove i concorrenti sono già forti

| Piattaforma | Capacità documentate dalla fonte primaria | Conseguenza per Momentum |
| --- | --- | --- |
| Bloomberg Terminal / Intelligence | Ricerca societaria, notizie, dati multiasset, portafogli, rischio, scenari e assistente ASKB con documenti collegati ([research](https://professional.bloomberg.com/products/bloomberg-terminal/research/), [PORT](https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/), [AI](https://professional.bloomberg.com/products/bloomberg-terminal/ai)) | Non presentare un semplice riassunto AI o una dashboard come novità esclusiva. Servono copertura, licenze, verifiche point-in-time e prove con professionisti. |
| Bloomberg trading | Opzioni, futures, accesso a broker e workflow pre/post trade ([listed trading](https://professional.bloomberg.com/products/trading/electronic-markets/listed/)) | Momentum oggi non è un terminale di esecuzione; simulare un book o chiamare «live» una serie ritardata sarebbe fuorviante. |
| Coinbase Advanced | Book, storico trade, grafici TradingView, API e derivati cripto ([Advanced Trade](https://www.coinbase.com/advanced-trade)) | Differenziare analisi di rischio, provenienza e contesto personale; non replicare l'esecuzione senza autorizzazioni e integrazioni. |
| Crypto.com | Staking e prestito DeFi per utenti idonei ([guida DeFi Yield](https://help.crypto.com/en/articles/9789857-crypto-com-defi-yield-faq)) | Un elenco di protocolli non basta. Servono esposizione reale, rischio smart contract e limiti per giurisdizione. |
| Trade Republic | Piani di risparmio e investimento in azioni, ETF, obbligazioni, derivati e cripto ([comunicato](https://assets.traderepublic.com/assets/files/251114_TradeRepublic_First_Crypto_PressRelease_INT_EN.pdf)) | Momentum può aiutare a capire decisioni e impatto finanziario; non è un broker. |

[ESMA](https://www.esma.europa.eu/press-news/esma-news/esma-sets-out-actions-simplify-retail-investor-journey-and-make-investing-more)
ha rilevato sovraccarico informativo, costi poco comparabili e bisogno di
informazioni progressive sui telefoni. Per Momentum il vantaggio da misurare
è una ricerca che porta a un prossimo controllo chiaro, mantenendo il dettaglio
e la fonte originale a portata di mano. È un'ipotesi di prodotto da provare
con utenti, non una conversione garantita.

## Audit della lista di richieste

- Già presenti: archivio SEC annuale, depositi SEC recenti, CoinGecko,
  posizionamento Binance per alcuni perpetui, CFTC storico limitato,
  risk-parity e altri calcoli di portafoglio; parser FRED, BCE, Eurostat e
  DefiLlama in parti distinte del codice. «Manca risk-parity» e «solo Hacker
  News» non descrivono più lo stato del repository.
- Collegato in questo intervento: una route senza chiave legge i companyfacts
  ufficiali SEC e porta nella scheda il più recente trimestre di circa tre
  mesi, con data di deposito, accession e documento originale. Il bilancio
  annuale incorporato rimane distinto. Il riquadro «Prima di decidere» mostra
  separatamente conti, prezzo e notizie; esclude le discussioni comunitarie
  dal gate del sentiment finanziario.
- Parziali: FX BCE e macro sono letti in moduli specifici, ma non esiste una
  linea multiasset unica, aggiornata e riconciliata che copra tutte le
  valute, i listini e le revisioni storiche. DefiLlama nel registro delle
  fonti non equivale a un monitor DeFi completo. I prezzi cripto e i
  derivati coprono solo i provider/mercati dichiarati.
- Non operativi come prodotto verificato: quotazioni azionarie universali
  via WebSocket, opzioni CBOE, futures CME, alternative data satellitari o
  delle carte, transcript con diritti d'uso, analytics on-chain completi,
  staking e imposte cripto per giurisdizione. Non esiste un benchmark che
  dimostri Momentum superiore a Bloomberg, Coinbase o altri.

## Ordine di sviluppo con controlli

1. **Identità e provenienza:** collegare titolo, emittente, CIK, ISIN e
   corporate action; registrare per ogni osservazione ora del mercato,
   ora di disponibilità, valuta, provider, licenza e revisione. Bloccare
   confronti fra token rappresentativi, ETF e azione sottostante quando non
   sono equivalenti.
2. **Ricerca societaria verificabile:** estendere i trimestri SEC a un
   confronto annuale/trimestrale di periodi omogenei, restatement, margini
   e cash flow; mostrare cosa è cambiato, il deposito e ciò che manca.
   Evitare look-ahead in backtest: una metrica può entrare in una decisione
   storica solo dopo la data del deposito.
3. **Rischio personale e professionale:** scenari espliciti su liquidità,
   concentrazione, costi, FX, drawdown e shock congiunti. Per ogni scenario
   documentare ipotesi, intervallo, dati esclusi e comportamento quando le
   serie non sono confrontabili. Verificare gli errori fuori campione.
4. **Notizie come eventi, non oracoli:** deduplicare fatti e publisher,
   distinguere pubblicazione/indicizzazione e ricostruire una linea eventi
   collegata ai documenti ufficiali. Misurare falsi abbinamenti e latenze;
   non trasformare sentiment in causalità o consiglio.
5. **Mercati specializzati:** usare tassi di riferimento BCE datati e serie
   macro ufficiali con vintage; valutare poi on-chain per specifiche reti,
   con eventi e indirizzi verificabili, rischi di custodia e audit dei
   protocolli. Opzioni/futures e feed live soltanto dopo verifica dei diritti
   di redistribuzione e dei costi per mercato e destinazione.

I dati SEC companyfacts sono pubblici e senza chiave ma il servizio ha limiti
di accesso e non offre CORS diretto per l'app: la route same-origin usa cache
e restituisce solo il trimestre compatto ([API SEC](https://www.sec.gov/search-filings/edgar-application-programming-interfaces),
[fair access](https://www.sec.gov/about/webmaster-frequently-asked-questions)).
I tassi BCE sono riferimenti pubblicati giornalmente, non cambi eseguibili
in tempo reale ([BCE](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.sl.html)).
FRED richiede una chiave API e alcune serie di terzi hanno diritti separati
([termini FRED](https://fred.stlouisfed.org/docs/api/terms_of_use.html)).
I dati pre/post-trade gratuiti ritardati previsti da MiFIR non autorizzano
automaticamente un feed live universale redistribuibile
([ESMA, art. 13](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifir/article-13-obligation-make-pre-trade-and)).

## Prova richiesta prima di dichiarare un vantaggio

Su compiti identici, misurare tempo al primo risultato verificato, errori di
identità/valuta, dati stantii scambiati per live, completezza delle fonti,
correzioni dell'utente e comprensione del rischio. Servono prove con
investitori alle prime armi e professionisti autorizzati, oltre a test su
mercati chiusi, provider offline, revisioni dei bilanci e dispositivi fisici.
I test locali e una risposta SEC reale non certificano un servizio globale.
