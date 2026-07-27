# Momentum vs il settore — analisi competitor e roadmap proprietaria

Documento di lavoro (non marketing): confronto onesto, con riferimento al codice reale che lo sostiene, per parlare con investitori/partner senza inventare nulla. Ogni claim "Momentum fa X" è verificabile in questo repo (file citato). Ogni limite è dichiarato, non nascosto — è la stessa disciplina con cui il progetto è stato costruito finora.

## 1. Il posizionamento reale (non uno slogan)

Bloomberg Terminal/Intelligence, Revolut, Trade Republic e gli altri player del settore hanno un vincolo strutturale che Momentum non ha: **non vedono la cassa personale reale dell'utente insieme al mercato**, perché sono servizi cloud che o (a) aggregano dati di mercato per professionisti senza sapere nulla della vita finanziaria personale di chi guarda lo schermo, o (b) gestiscono conti/investimenti ma non hanno un modello comportamentale della spesa quotidiana della persona.

Momentum è on-device: **le uniche due categorie di dati che tocca sono i movimenti finanziari personali dell'utente (mai lasciano il dispositivo) e dati pubblici di mercato letti in chiaro (prezzi/notizie, con la chiave gratuita dell'utente, mai un dato personale in uscita)**. Questo permette risposte che nessuno dei due mondi può dare da solo, perché nessuno dei due ha accesso all'altro.

**Limite dichiarato, non aggirabile**: Momentum non ha dati di mercato istituzionali (order book, dark pool, notizie a microsecondo), non esegue ordini, non è un consulente finanziario abilitato. Non compete su quel terreno e non deve — compete su un terreno diverso, descritto sotto.

## 2. Dove il settore fallisce per l'utente retail (fatti, non opinioni)

| Player | Cosa fa bene | Dove strutturalmente non può arrivare |
|---|---|---|
| **Bloomberg Terminal** | Dati di mercato istituzionali in tempo reale, esecuzione, messaggistica tra professionisti | ~24.000$/anno per postazione, pensato per trader/analisti professionali; zero nozione della cassa personale; nessun caso d'uso per un utente retail |
| **Bloomberg Intelligence** | Ricerca e analisi settoriale/aziendale prodotta da analisti umani + dati | Prodotto per istituzionali (asset manager, banche), non un'app consumer; nessun collegamento con la vita finanziaria di una persona |
| **Revolut** | Conto+investimenti in un'app, UX moderna | È un conto: vede i movimenti sul SUO conto, non l'intero quadro (impegni fissi, altri conti, abitudini reali); nessun ragionamento causale su "se cambio questa abitudine, cosa succede alla mia cassa E al mio patrimonio"; il modello di business (spread su cambio/investimenti) disallinea l'incentivo dal "spendere meno" |
| **Trade Republic** | Broker a basso costo, semplice | Puro broker: zero legame con la cassa quotidiana, zero previsione di spesa, l'utente decide "posso permettermi di investire" a occhio |
| **App di budget generiche (YNAB, Money Manager, ecc.)** | Tracciano la spesa | Non hanno NESSUN segnale di mercato: "quanto risparmi" e "dove investirlo" restano due mondi separati, mai nella stessa risposta |
| **Copilot Money / Monarch Money** | UX curata, categorizzazione automatica, patrimonio aggregato via Plaid | Richiedono di collegare le credenziali bancarie a un servizio cloud terzo (Plaid) — esattamente la dipendenza che Momentum rifiuta; nessun ragionamento causale statistico reale sulla spesa, nessuna fusione con regime di mercato |
| **Wealthfront / Betterment (robo-advisor USA)** | Investimento automatizzato low-cost, ribilanciamento, tax-loss harvesting | Sono broker/gestori: gestiscono i SOLDI investiti, non la cassa quotidiana; nessuna nozione di impegni fissi/BNPL/abitudini di spesa; consulenza automatizzata reale (sono abilitati) — un ruolo che Momentum sceglie di non avere |
| **Personal Capital / Empower** | Dashboard patrimoniale aggregata (conti+investimenti), da consulenti veri | Servizio cloud con dati bancari centralizzati; il "gratis" è un funnel verso la loro consulenza a pagamento (conflitto d'interesse dichiarato dal loro stesso modello di business) |
| **Robinhood** | Trading azioni/ETF/cripto a commissione zero, UX semplicissima, dati di mercato in app | Guadagna vendendo il flusso ordini ai market maker (payment for order flow) — l'incentivo è farti tradare di più, non farti spendere/investire meglio (criticato pubblicamente per questo, incluse indagini regolatorie note); zero legame con cassa personale, zero impegni fissi, zero previsione di spesa; nessun ragionamento causale, solo esecuzione e grafici |
| **Banche tradizionali (app di home banking generiche)** | Estratto conto, bonifici, a volte categorizzazione base della spesa | Vedono SOLO i movimenti sul loro conto (mai gli altri conti/carte dell'utente); nessuna previsione, nessun impegno fisso riconosciuto come tale, nessun segnale di mercato; spesso il "consiglio" che danno è vendere un LORO prodotto (fondi/polizze a provvigione) — stesso conflitto d'interesse di Personal Capital, strutturale al modello di business bancario |

**Nota sul perimetro di questa tabella**: elenca competitor reali, verificabili, sui quali posso descrivere accuratamente cosa fanno. Non includo un elenco esaustivo di "ogni modello AI o architettura uscita fino a oggi" — sarebbe centinaia di prodotti citati a memoria, non verificabili uno per uno, ed è esattamente il tipo di affermazione non controllabile che questo documento rifiuta per principio (stessa regola che governa tutto il resto del codice: mai un numero o un fatto che non si può controllare). Se serve confrontarsi con un prodotto specifico non elencato qui, va aggiunto con la stessa verifica puntuale.

## 3. Cosa Momentum ha già costruito, e che nessuno dei sopra ha (verificabile nel codice)

Ogni riga qui sotto è una funzione reale, testata, presente in questo repo — non un annuncio.

- **"Posso permettermi di investire ora?"** (`src/ai/reasoning-fusion.js:investmentReadiness`): combina il regime di mercato reale (misurato o live) con il minimo di cassa prudente calcolato sulla Cassa Unica personale (`src/predict/cash-forecast.js`). Nessun broker vede la cassa personale; nessuna app di budget vede il mercato. Mai un consiglio compra/vendi — solo il quadro.
- **Cassa Unica** (`src/predict/cash-forecast.js`): simulazione giorno-per-giorno che fonde impegni fissi, stipendio, abbonamenti, rate BNPL in un'unica proiezione con banda di confidenza (p10/p50/p90), misurata (MAE −29,5% vs run-rate ingenuo, backtest walk-forward reale).
- **Rilevamento BNPL cross-provider** (`src/predict/bnpl.js`): nessuna app del settore incrocia automaticamente Klarna/PayPal/Scalapay/+20 altri marchi E provider mai visti prima (rilevamento generico via cadenza) per calcolare l'esposizione REALE a rate aperte in parallelo — un problema di settore riconosciuto ("BNPL stacking") che nessun singolo provider può vedere per definizione (non vede gli altri).
- **Ragionamento causale sulla spesa personale** (`src/predict/causal-graph.js`): Granger causality reale (non un'euristica di correlazione) — inclusa la versione **condizionale** che controlla per variabili terze prima di dichiarare un legame A→B, con lag variabile. "Se taglio ristoranti del 20%, cosa succede davvero, non solo per magia della media" — nessuna app di budget fa un test statistico reale sui propri dati.
- **Classificazione automatica delle spese**: ensemble a 3 livelli (Nano/Meso/LogReg con TF-IDF, 94,6% misurato su held-out) + esperto morfologico che generalizza per TIPO di esercente (`src/ai/merchant-morphology.js`) — copre i piccoli esercenti locali dove un dizionario statico fallisce.
- **Mesh P2P senza server** (`src/mesh/`): sincronizzazione tra device e federazione di conoscenza (quale esperto fidarsi in quale contesto, mai dati grezzi) senza alcun cloud — architettura che nessun competitor cloud-based può replicare per definizione (loro SONO il cloud).
- **Settori S&P 500 su dati reali misurati** (`src/alpha/sector-rotation.js`): classifica per Sharpe ratio reale, non rendimento nudo, ~27 anni di storia vera (limite dei fondi, dichiarato).
- **Notizie + sentiment reali con avvisi che arrivano anche in background** (`src/alpha/news.js`, Periodic Background Sync) — con il limite di "app senza server" dichiarato esplicitamente in UI, non nascosto.

### 3b. Confronto diretto: quale capacità batte quale competitor, e perché è strutturale (non temporaneo)

| Capacità Momentum | Chi non può replicarla, e perché è un limite STRUTTURALE (non "non ci hanno ancora pensato") |
|---|---|
| `investmentReadiness` (cassa+mercato insieme) | Robinhood/Trade Republic/Wealthfront/Betterment: sono broker, il loro modello di business è l'esecuzione di ordini, non vedono un centesimo dei conti/carte fuori dalla loro piattaforma. Revolut/banche: vedono solo il LORO conto. |
| Cassa Unica (impegni+stipendio+BNPL in una proiezione) | App di budget (YNAB, Copilot, Monarch): tracciano la spesa passata, nessuna fonde impegni futuri+rate in corso in una sola proiezione probabilistica con banda di confidenza misurata. |
| Rilevamento BNPL cross-provider | Klarna/PayPal/Scalapay stessi: ognuno vede SOLO i propri piani, mai quelli degli altri — il problema "stacking" è per definizione invisibile a un singolo provider. |
| Granger causale condizionale sulla spesa personale | Nessuno nella tabella lo fa: le app di budget mostrano medie/grafici, non un test statistico di precedenza che scarta le correlazioni spurie. |
| Mesh P2P senza server | Ogni player cloud-based (tutti quelli sopra): la loro architettura STESSA richiede un server centrale — non è una scelta di prodotto, è il modello di business (dati centralizzati = valore per loro). |
| Zero dati finanziari personali in uscita | Copilot/Monarch (via Plaid): la loro UX dipende dal collegare le credenziali bancarie a un aggregatore terzo — il dato personale esce per costruzione del prodotto. |

### 3c. Le cinque domande di settore, e dove Momentum risponde già (non in teoria — nel codice)

- **Investitori** (numeri di adozione da mostrare): `server/telemetry-worker.js` + `src/core/telemetry.js` — installazioni totali, utenti attivi/mese, tasso di retention mese-su-mese. Pronto, manca solo il deploy (roadmap §5.1).
- **Sentiment** (cosa dicono le notizie su un titolo/cripto, in tempo reale): `src/alpha/news.js` (Alpha Vantage NEWS_SENTIMENT, punteggio reale per articolo) + `aggregateNewsSentiment` in `src/ai/reasoning-fusion.js` (media aggregata, mai un titolo isolato spacciato per il sentiment generale).
- **Investimenti** (posso permettermelo? in quali settori guardare?): `investmentReadiness` (cassa+regime) + `src/alpha/sector-rotation.js` (classifica settori S&P 500 per Sharpe reale misurato, ~27 anni di storia). Mai un consiglio d'acquisto — il quadro, non l'ordine.
- **Modelli AI** (il "cervello" che categorizza/ragiona): ensemble Nano→Meso→LogReg (94,6% misurato, TF-IDF), esperto morfologico per esercenti mai visti, orchestrator con bandit per la selezione esperti, Granger causale (bivariato + condizionale) per il ragionamento su causa-effetto nella spesa personale — tutto addestrato e verificabile in locale (`npm run train:eval`, `npm run train:gate`), mai un modello di terzi (nessuna dipendenza da pesi cloud altrui).
- **Voice** (input vocale): `src/voice/voice.js` + `src/voice/intent-segmenter.js` — segmentazione ad ancoraggio multi-intento (più spese/appuntamenti in un'unica frase, in qualsiasi ordine), categorizzazione via lo stesso orchestrator sopra, recupero predittivo dell'importo mancante mai inventato (stima dichiarata, non un numero a caso). Già costruito e testato in una sessione precedente (2026-07-24/25).

## 4. Cosa NON promettere (per restare credibili con chi verifica)

- Non "battiamo Bloomberg sui dati di mercato" — è falso, e chiunque nel settore lo verifica in 30 secondi.
- Non "AI che predice il mercato" — nessun modello qui fa previsioni di prezzo; ogni numero è una misura storica o un fatto dichiarato (regime, sentiment aggregato), mai un prezzo futuro.
- Non "sostituiamo un consulente finanziario" — Momentum non è abilitato e non lo sarà per scelta architetturale (mai un consiglio compra/vendi).

## 5. Roadmap proprietaria (onesta, in ordine di impatto)

1. **Deploy del conteggio utenti** (`server/telemetry-worker.js`, già pronto).
   - Esecuzione: `wrangler kv namespace create`, `wrangler secret put STATS_TOKEN`, `wrangler deploy` (5 minuti, istruzioni nel file). Poi incollare l'URL in `TELEMETRY_ENDPOINT` (main.js).
   - Perché prima di tutto: senza questo, ogni conversazione con investitori parte da zero dati di adozione — è il blocco più urgente, non il più complesso.
2. **Mesh-discovery potenziata** (task aperto, prossimo in coda).
   - Limite reale da affrontare PRIMA di scrivere codice: WebRTC richiede comunque un primo aggancio (signaling) — due device che non si sono mai scambiati un codice non hanno modo di trovarsi senza un punto di incontro. Le opzioni oneste sono: (a) un signaling server minimo (stesso principio del telemetry-worker: eccezione dichiarata a "zero server"), o (b) restare nel perimetro locale (Bluetooth/mDNS su stessa rete Wi-Fi, se il target è "device nella stessa stanza/casa").
   - Prima azione concreta: decidere QUALE dei due scenari serve davvero (device di famiglia sulla stessa rete? o sconosciuti su reti diverse?) — la risposta cambia l'intera architettura.
3. **Estendere il Granger condizionale ai dati di mercato**.
   - Prima azione concreta: verificare CON DATI REALI di un utente (non sintetici) se c'è potenza statistica sufficiente (di solito servono più mesi di storia personale + serie di mercato allineate) prima di costruire l'integrazione — se i dati non bastano, dichiararlo è meglio che forzare un numero.
4. **Overview azienda/cripto arricchito** (`src/alpha/asset-overview.js`).
   - Prima azione concreta: Alpha Vantage OVERVIEW già restituisce P/E, market cap, EPS, dividend yield — estendere `fetchStockOverview` per esporli è un cambio piccolo e già scritto per metà (la funzione esiste, va solo arricchito l'oggetto normalizzato).
5. **Documento legale/brevettuale**.
   - Non è un compito che posso eseguire io: richiede un consulente in proprietà intellettuale che valuti la combinazione (Cassa Unica + regime di mercato + Granger condizionale + mesh federata, tutto on-device) — il mio ruolo qui si ferma alla descrizione tecnica accurata di cosa esiste, non alla valutazione di brevettabilità.

## 6. Come si tiene aggiornato questo documento

Ogni claim qui sopra è verificabile con `grep`/lettura diretta del file citato o `node --test`. Se una funzione citata viene rimossa o cambia comportamento, questo documento va aggiornato nella stessa sessione — mai lasciato a raccontare qualcosa che il codice non fa più.
