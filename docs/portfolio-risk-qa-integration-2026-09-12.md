# Rischio multiasset nel Q&A attivo

## Percorso implementato

`idleFetchPrices` conserva in memoria i risultati ammessi dal gate delle fonti.
`askMomentum` passa questi risultati al Q&A locale. La domanda sul rischio del
portafoglio attiva `portfolioProviderRisk`, quindi `portfolioRiskSnapshot` e
il motore storico multiasset. Nessuna richiesta cloud aggiuntiva e nessuna
modifica agli archivi o ai pesi appresi. La memoria delle fonti è di sessione.

Il bridge accetta solo risultati con simbolo, classe, valuta e fonte espliciti.
Le vecchie mappe di soli prezzi, i risultati peer e le stime non completano
automaticamente questi metadati. Non si deducono valute mancanti. La base del
percorso attuale è EUR, coerente con l'app; senza i cambi necessari il risultato
multivaluta resta indisponibile. Cinque osservazioni comuni per finestra, coda
al 2,5% e almeno cinque finestre di coda: lo storico breve non basta.

Risposta nelle sette lingue, distinta per portafoglio vuoto, dati insufficienti
e rischio calcolabile. Il risultato disponibile espone variazione con segno,
orizzonte, copertura e data; non è presentato come previsione o perdita massima.
I test numerici usano fixture esplicite, non quotazioni reali raccolte dal browser.

## Apprendimento effettivamente collegato

L'intento `portfolioRisk` è aggiunto ai suggerimenti di correzione della chat.
Dopo due conferme esplicite, il motore di apprendimento Q&A esistente riconosce
la formulazione insegnata dall'utente e contrassegna la risposta come appresa.
Si apprende il significato della domanda, non una promessa di rendimento.
La risposta e i dati del calcolo non vengono usati come etichette finanziarie
per allenare i modelli. Nessun nuovo addestramento neurale in questa modifica.

## Verifiche

- Sei test di integrazione: ingresso Q&A, sette lingue, input incoerenti,
  storico insufficiente, apprendimento esplicito e intenti precedenti.
- Suite completa iniziale: 328/329 file passati. Il nuovo test mancava del
  mock `navigator` richiesto dal runner; aggiunto, i sei test passano anche
  con `--no-experimental-global-navigator`, la stessa opzione della suite.
- Build portable riuscita; avvisi preesistenti sui bundle grandi.
- Browser locale: onboarding adulto di prova completato, Dashboard raggiunta,
  domanda inviata dal campo reale, risposta per portafoglio vuoto verificata
  nel DOM e visivamente. Anteprima `http://127.0.0.1:4177/?lang=it`.
- Nessun collaudo nativo iOS/Android o prova browser con prezzi live sufficienti.

## Cosa resta

La card settoriale in Analisi resta invariata: questo incremento integra la
funzione nelle risposte della Dashboard/Command Center che usano `askMomentum`.
Servono ancora provider con storico sufficiente, valuta esplicita per azioni,
cambi storici e presentazione nella card. La disponibilità del Q&A non significa
che tutti i portafogli abbiano già una misura calcolabile. Le versioni dei
modelli e gli esiti osservati per calibrare il rischio restano lavoro successivo.
