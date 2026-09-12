# Effetti trasversali e validazione

## Correzioni nel motore attivo

- Percorsi ramificati: test esplicito C→B→A→Z e C→D→E→Z,
  con effetti positivi e negativi che si combinano sullo stesso obiettivo.
- `maxDepth` ora conta esattamente il numero massimo di archi. Prima
  poteva includere un passaggio in più.
- `simulateScenario` distingue interventi congiunti (`joint`, default) e
  shock additivi (`additive`). Se lo scenario fissa B, A non modifica B
  una seconda volta attraverso A→B. Esempio: A→B vale 2 e B→Z vale 3;
  con delta A=1 e delta B=4, Z cambia di 12, non 18. In modalità additiva
  i 18 rimangono corretti per la diversa ipotesi esplicita.
- L'incertezza del totale somma prima le derivate dei percorsi rispetto
  a ciascun coefficiente condiviso. Nel test a diamante, lo stesso arco
  contribuisce a entrambi i percorsi: SE=7, non il precedente 5. Effetti
  opposti possono cancellare la dipendenza dallo stesso coefficiente.
- L'orchestratore non emette scenari di intervento se la diagnostica ha
  avvisi gravi. Espone `scenarioStatus` e `scenarioBlockReasons`; mantiene
  i legami descrittivi e non annuncia più scenari utilizzabili nel riassunto.

Il Q&A e il percorso degli scenari esistenti usano questi moduli: non è un
secondo motore dimostrativo. Nessuna migrazione Vault, nessun nuovo peso neurale,
nessun cambiamento alle regole fiscali o al layout in questo incremento.

## Benchmark riproducibile

`npm run bench:causal-calibration` esegue 200 repliche per ciascuna delle
dieci configurazioni: 2.000 regressioni sintetiche, semi 1–200 fissati.
Con argomento percorso salva il JSON. Misura la copertura del coefficiente
vero usando l'intervallo normale ±1,96 SE. Non misura la scoperta del grafo.

| Osservazioni | Scenario | Copertura classica | Copertura max(classico,HAC) |
|---|---|---|---|
| 52 | Nessun effetto | 95,5% | 96% |
| 52 | Effetto diretto | 95,5% | 96% |
| 52 | Rumore seriale | 92,5% | 93,5% |
| 52 | Causa comune osservata e controllata | 94,5% | 95% |
| 52 | Causa comune nascosta | 1% | 1% |
| 260 | Nessun effetto | 94% | 94,5% |
| 260 | Effetto diretto | 94% | 94,5% |
| 260 | Rumore seriale | 95% | 96% |
| 260 | Causa comune osservata e controllata | 94% | 94% |
| 260 | Causa comune nascosta | 0% | 0% |

Il caso nascosto ha effetto causale vero zero, ma bias medio circa +0,5.
È un risultato negativo importante: HAC non risolve l'identificazione.
Le piccole differenze nelle altre righe sono soggette a errore Monte Carlo;
non dimostrano superiorità statistica. Il massimo dei due SE non può dare
intervalli più stretti per costruzione: questo non è un benchmark competitivo.

## Limiti e sviluppo macroeconomico

I coefficienti di archi distinti sono ancora trattati come indipendenti.
Non viene stimata la loro matrice di covarianza congiunta. I cicli non sono
risolti come sistemi dinamici: i percorsi non visitano due volte lo stesso nodo.
I ritardi vengono sommati nei percorsi, ma il totale non è una previsione
calendario per calendario. Gli intervalli sono condizionati al grafo e alle
ipotesi lineari; non incorporano l'incertezza della selezione del grafo.
Il blocco diagnostico non garantisce di scoprire ogni confondente nascosto.

Per economia mondiale/investment banking, il prossimo livello richiede serie
macroeconomiche con unità, frequenza, fonte, data di pubblicazione e revisioni
storiche; rendimenti e bilanci con date di effettiva disponibilità; separazione
dei regimi e validazione temporale fuori campione. Non sostituire dati rivisti
oggi ai dati conoscibili quarant'anni fa. L'archivio attuale di 43 strumenti
non rappresenta quarant'anni di dati completi per tutto il mercato.
Le relazioni concettuali in `market-knowledge.js` non sono coefficienti causali
stimati e non vanno convertite automaticamente in previsioni quantitative.

## Validazione del codice

Suite generale: 330/330 file passati. Dopo l'ultimo affinamento sui percorsi
condivisi, rieseguiti 34 test causali (tutti passati) e build portable finale
riuscita. Avvisi preesistenti sulle dimensioni dei bundle. I nuovi test sono
stati eseguiti prima delle correzioni per riprodurre i casi difettosi.
Nessuna nuova interfaccia o verifica nativa iOS/Android in questo incremento.
