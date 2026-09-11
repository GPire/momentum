# Continuità dei dati, apprendimento e mesh — 12 settembre 2026

Base: `main` `adc8a6697859c3225b0e78c7639e2f20fc05a2e8`, già rilasciata.
Sviluppo: `codex/data-learning-continuity`. Questa revisione non cambia i
calcoli fiscali, le condizioni Free/Pro o il protocollo di autorizzazione
alla condivisione dei dati. Non dichiara una maggiore accuratezza senza benchmark.

## Quali vecchi dati sono stati verificati

I test precedenti coprivano forme sintetiche dei due branch recenti. La nuova
verifica aggiunge i default reali di Vault dei tag `v7.0`
(`c6b6c0cf8088ed893b1a3667a412f53a4d94ddf4`) e `v7.1`
(`3dd922f80deaf7fee72eb8b40c359e7df1eb7162`), popolati con dati sintetici.
Per ciascuno: avvio da main locale, shadow oppure IndexedDB, salvataggio,
riavvio ed esportazione; confronto dei valori originali campo per campo.

Il backup cifrato della fixture è stato prodotto eseguendo l'esportatore
originale `57a70d733ca04775dbf30329626d715a86839978`, poi decifrato dal codice
attuale. Provenienza e dati di prova: `src/core/fixtures/historical-backups.json`;
generatore ripetibile: `scripts/generate-historical-backup-fixtures.mjs`.
Non sono backup di clienti e non rappresentano ogni versione mai distribuita.

Il vecchio DNA conteneva transazioni, budget e livello del freno spese.
**Non conteneva tutti i pesi, obiettivi, fatture o gruppi.** Il ripristino
parziale conserva questi dati se già presenti nel dispositivo; non può
ricostruirli quando non esistono né nel dispositivo né in un'altra copia.
Nel DNA privo di `lastHash`, il puntatore è ora ricavato dalle transazioni
ripristinate usando la funzione già impiegata dalla sincronizzazione.
I valori e gli hash delle singole transazioni non vengono riscritti.

Schema attivo ancora 50, database e chiavi attive invariati. Il sottodominio
di anteprima, il sito principale, localhost e il contenitore Capacitor sono
origini/archivi distinti: una pubblicazione non trasferisce dati fra loro.

## Correzioni sviluppate e collegate

| Area | Problema verificato nel codice | Comportamento introdotto |
|---|---|---|
| Ripristino | Mancava una copia dedicata prima della sostituzione; `save()` non attendeva IndexedDB | Checkpoint completo verificato con rilettura; fallback locale; blocco se non salvabile; verifica delle copie attive e rollback di miglior sforzo in caso di errore |
| Copie vecchie o danneggiate | Contenitori incoerenti potevano arrivare allo stato applicativo | Validazione strutturale prima della conferma; rifiuto dei backup con schema futuro; conservazione dei campi aggiuntivi |
| UX ripristino | Conferma generica senza conteggio del contenuto | Modale condivisa da backup normale e kit di recupero, conteggio attuale/copia, avviso DNA parziale, stato accessibile, azione disabilitata durante il salvataggio; testi in sette lingue |
| Recupero dopo ripristino | Nessuna copia dedicata accessibile | Pulsante in Vault → Dati al sicuro → Proteggi o recupera i tuoi dati; download della copia precedente, chiaramente non cifrata |
| Rete neurale locale | `initPriorWeights` rimpiazzava parole già apprese ad ogni riapertura | I valori appresi prevalgono sui valori iniziali del profilo; migrazione delle otto categorie storiche senza azzerare i pesi |
| Ri-apprendimento | La firma veniva marcata completata prima del lavoro asincrono | Firma aggiornata alla fine; avanzamento salvato ogni 40 esempi insieme ai pesi; ripresa per stessa firma e stesso storico; lavoro cancellato se cambia l'archivio/orchestratore |
| Apprendimento ricevuto | Adozione diretta di matrici incomplete o conteggi non validi, soprattutto su un dispositivo vuoto | Controllo di dimensioni, valori finiti, categorie, conteggi e grafo; copia indipendente dei dati adottati; vecchia rete a otto uscite accettata; i cancelli di qualità restano attivi |
| Risorse dei peer | Richieste di calcolo non limitate prima dell'esecuzione | Solo l'esecutore pubblico realmente implementato; massimo 256 unità, indici distinti, semi validi, niente campi arbitrari; massimo due richieste attive e un intervallo minimo per peer |
| Reattività | Calcolo remoto sincrono sul thread UI | Lavoro in gruppi di 16 unità con pausa; interruzione se la pagina non è più visibile; nessun risultato parziale inviato come completo |
| Verifica distribuita | Una replica mancante era considerata affidabile; NaN poteva coincidere con null nel JSON | Stato in attesa per replica mancante; valori non finiti/null richiedono ricalcolo, senza accusare automaticamente il peer |

Un checkpoint locale non è una copia su un altro dispositivo. Ne conserviamo
uno precedente all'ultimo ripristino, separato dal checkpoint dell'aggiornamento.
Se il browser elimina l'intero archivio o il dispositivo si perde, serve
comunque un backup esportato. I test non garantiscono scritture atomiche tra
localStorage e IndexedDB in caso di spegnimento a metà operazione.

La ripresa dell'apprendimento è per blocchi salvati, non una promessa
"esattamente una volta" in ogni crash possibile. Se lo storico cambia, la
firma dello storico invalida il cursore. Nessun peso viene mediato in modo
arbitrario con i pesi di un backup diverso.

## Risultati e limiti del collaudo

- Commit applicativo verificato: `758f90c3673cba904450183aadd6faa8ff1cf3b1`.
- CI GitHub, comandi standard `npm test` e `npm run build`: **4.889 test
  passati, zero fallimenti e zero skip**, build completata in 11,66 secondi.
  [Log della verifica](https://github.com/GPire/momentum/actions/runs/34652449826/job/103437455908).
- Android: `cap sync android`, `assembleDebug` e `lintDebug` passati.
  iOS: `cap sync ios`, controllo della presenza dell'SDK 27 e compilazione
  per iOS Simulator passati. Sono compilazioni, non prove su dispositivi fisici
  né approvazione degli store.
  [Verifiche native](https://github.com/GPire/momentum/actions/runs/34652449711).
- Cloudflare Pages ha pubblicato il commit applicativo verificato:
  [anteprima](https://c39c810f.momentum-finance.pages.dev/?lang=it).
  Codice e documentazione sono nella [PR #2](https://github.com/GPire/momentum/pull/2),
  in bozza; `main` e produzione restano sulla release precedente.
- Suite locale seriale completa: 4.888 test, 321 file, zero fallimenti o skip.
- Successiva correzione della testa della catena del DNA: tutti i 16 test del
  ripristino passati, incluso il nuovo caso; coperto poi dalla suite CI completa.
- Build web portabile completata; rimane l'avviso sui bundle grandi.
- Primo avvio nel browser su origine di prova separata, profilo senza
  investimenti, obiettivo facoltativo, reddito saltato, accesso a Dashboard e
  Vault verificati. Nessun archivio reale è stato ripristinato o eliminato.
- Upload della fixture bloccato dal browser (`fileChooser.setFiles: Not allowed`):
  l'estensione Chrome non ha accesso ai file URL. La modale di ripristino non
  è ancora stata collaudata visivamente tramite upload. Non confondere i test
  delle funzioni con un collaudo browser completo.
- Un successivo tentativo di verifica del layout mobile è stato bloccato da
  una UI dell'estensione Chrome aperta. Il layout della nuova modale e il
  ripristino tramite selettore file restano da verificare prima del merge.

## Cosa manca davvero, in ordine di impatto

### 1. Continuità più forte tra dispositivi e versioni

La scelta della copia locale più ricca di transazioni resta una regola di
recupero, non un risolutore completo di conflitti. Copie con lo stesso numero
di movimenti ma apprendimento diverso, cancellazioni recenti e vecchie copie
richiedono revisioni/lineage esplicite, un giornale di ripristino resistente al
crash e test con due schede/dispositivi reali. Il checkpoint preserva una copia,
non dimostra che ogni conflitto sia già risolto.

### 2. Partita IVA: disponibilità comprensibile e verificabile

Priorità prodotto: distinguere denaro incassato, denaro impegnato e stima fiscale;
mostrare cosa manca per calcolarla. Classificazione redditi, fatture e previsioni
sono già presenti. Restano limiti di copertura delle casse professionali IT,
scala AVS/cantoni CH e reddito netto RETA ES. In particolare, `retaIrpfPeriodo`
usa ancora il lordo: aggiungere spese deducibili confermate e rendimenti netti
di tutte le attività, con provenienza/periodo e senza trasformare automaticamente
una spesa privata in una deduzione.

La fonte ufficiale spagnola distingue rendimenti netti e trattamento fiscale:
[AEAT](https://sede.agenciatributaria.gob.es/Sede/empresarios-individuales-profesionales/nuevo-sistema-cotizacion-autonomos/informacion-determinar-rendimiento-neto.html),
[simulatore Seguridad Social 2026](https://portal.seg-social.gob.es/wps/portal/importass/importass/tramites/simuladorRETAPublico/inicio/).
Non è stata applicata una formula fiscale nuova in questa revisione.

Invio SdI, conservazione a norma, dichiarazioni e collegamento bancario non
diventano servizi operativi aggiungendo una card: servono connettori, contratti,
responsabilità e collaudi. Fiscozen offre già commercialista, fatturazione,
previsione e documenti F24 nella stessa esperienza
([fonte ufficiale](https://www.fiscozen.it/faq)). L'opportunità per Momentum è
collegare questa situazione alla disponibilità personale quotidiana, con una
spiegazione delle voci e un dossier esportabile al professionista.

### 3. Modelli: miglioramento misurabile per persona e lingua

Servono set di valutazione persistenti e separati dall'addestramento, benchmark
per lingua/categoria rara, cronologia del modello e rollback dopo regressioni.
Non basta una percentuale media. Misurare correzioni richieste, astensioni,
latenza e consumo; distinguere etichette confermate dall'utente dalle categorie
generate dal modello. La nuova protezione conserva i pesi e valida la struttura,
ma non dimostra una crescita dell'accuratezza.

### 4. Mesh: completare il percorso utile

Il trasporto `sendComputeUnits` / `onComputeResult` esiste, l'esecutore è collegato
a `main.js`. Non c'è ancora un flusso UI che richieda il lavoro, raccolga tutti
i risultati e restituisca una simulazione distribuita verificata. Servono ID
di job, deduplicazione delle risposte, budget energetico, cancellazione,
scadenza/riassegnazione e fallback locale. Poi misurare su due dispositivi
reali se tempo/energia migliorano rispetto al solo dispositivo locale.

Pesi privati fra dispositivi autorizzati, contributi condivisi fra persone e
calcolo su dati pubblici hanno finalità e confini diversi. I gradienti non sono
automaticamente anonimi: la ricerca ha mostrato la ricostruzione di esempi
privati a partire da gradienti condivisi
([Deep Leakage from Gradients, NeurIPS 2019](https://papers.neurips.cc/paper_files/paper/2019/hash/60a6c4002cc7b29142def8871531281a-Abstract.html)).
Ampliare la federazione richiede valutazione della
privacy, protezione dall'avvelenamento, contributi verificabili e consenso
coerente; questa revisione non allarga le autorizzazioni esistenti.

Per continuare un lavoro iniziato dall'utente su iOS servono bridge Capacitor e
API native; il sistema può comunque limitarlo. Apple documenta i task continui
e le risorse GPU supportate, non un'esecuzione illimitata della PWA chiusa:
[Background Tasks](https://developer.apple.com/documentation/backgroundtasks),
[GPU richiesta dal task](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtaskrequest/resources/gpu).
Android richiede una strategia compatibile con tipo e durata del lavoro,
usando le API previste per i task in background: WorkManager, API specifiche
o servizi in primo piano quando appropriati
([documentazione Android](https://developer.android.com/develop/background-work/background-tasks)).

### 5. Differenziazione dello split e delle scadenze

Revolut consente già gruppi con persone senza conto Revolut: non presentare
l'invito esterno come una novità esclusiva di Momentum
([fonte ufficiale](https://help.revolut.com/help/transfers/group-bills/question-group-bills/)).
La direzione utile è quota personale + rimborso atteso + impatto sul budget,
con stato chiaro e riconciliazione dell'accredito; riconoscere una scadenza non
deve creare un addebito fittizio. Unire prove gratuite, rate e abbonamenti con
date modificabili e motivi della previsione. Il blocco di un pagamento non va
confuso con la cancellazione del contratto
([Revolut](https://help.revolut.com/help/card-payments-withdrawals/subscriptions/)).

Queste sono opportunità da validare, non prove di superiorità su ogni concorrente.
Conversione e semplicità vanno misurate su compiti reali (primo movimento,
prima importazione, rimborso, ritorno a 7/30 giorni), senza promettere il 97%
o usare meccanismi che compromettano le scelte dell'utente.
