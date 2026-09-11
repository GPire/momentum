# Integrazione verificata di UI e motori — 11 settembre 2026

## Esito finale sul codice 66602c7

- **4.846 test / 317 file passati**, zero skip, dopo le correzioni descritte sotto.
- [Release checks Linux: test e build standard riusciti](https://github.com/GPire/momentum/actions/runs/34647755373).
- [Android assembleDebug/lintDebug e iOS Simulator SDK 27: riusciti](https://github.com/GPire/momentum/actions/runs/34647755356).
- Build portabile finale locale: riuscita in 36,90 secondi.
- [Anteprima verificata](https://a73b1373.momentum-finance.pages.dev/?lang=it): primo avvio completo con profilo semplice, nessun budget/reddito obbligatorio, Dashboard e apertura diretta dello Split; nessun ciclo di reload. Il browser ha registrato messaggi di canale asincrono senza stack applicativo, senza interrompere questi flussi; non si dichiara una console completamente priva di segnalazioni.
- Primo deploy `88bb0dd` e relativa suite sono storici: i difetti trovati lì sono corretti da `66602c7`. Questa revisione successiva aggiorna solo la documentazione.
- [PR #1 con stato effettivo del merge](https://github.com/GPire/momentum/pull/1). La compilazione del simulatore non attesta test fisici, firma, TestFlight o pubblicazione negli store.

## Riferimenti e metodo

Integrazione di `origin/main` **d92a5dcd9a5a9dae7649ce4c74fd6e836adb124f** nel branch `codex/public-release-foundation`, partito da **dfdd6462f48b8228c81b895be185b3218ba4662b**. I 13 conflitti sono stati risolti per funzione e sezione; nessuna sostituzione integrale di `main.js` o `index.html`. Il commit di merge contiene questo documento: per il suo SHA usare Git, non un riferimento circolare nel file.

## Cosa è stato conservato e collegato

- UI del branch: calendario e disponibilità raggruppati, azioni Dashboard direttamente sugli editor, Split con ID per gli omonimi, importi e arrotondamenti controllati, modali responsive, gerarchie Analisi/Vault, tema e movimento ridotto. Dettagli cumulativi in `release-review-2026-09-11.md` e `push-file-manifest-2026-09-11.md`.
- Motori di main: calibrazione delle previsioni, storico mercati e relativo aggiornamento, attività svizzera e AVS, previdenza professionale italiana, scadenze spagnole, CSV strutturato per il commercialista, Centro Fiducia. La scoperta fiscale usa `openTaxDiscover`; non apre sempre il simulatore italiano. Un'attività CH già dichiarata non provoca un nuovo suggerimento IT.
- Protezioni locali: preferenze telemetria salvate, controllo opt-out dopo operazioni asincrone, budget facoltativo, ripristino non riproposto dopo rifiuto, PDF senza valutazione di script, riconoscimento installazione iPad e shell native. Non sono ampliati gli eventi raccolti.
- Free/Pro: non viene applicata automaticamente la nuova proposta commerciale descritta nei documenti strategici di main. Restano i diritti implementati e la separazione fra profilazione, vista semplice/completa e licenza. `chAttivitaTipo` contribuisce al suggerimento del piano, non attiva una licenza.

## Correzioni emerse nell'audit dei motori

| Area | Correzione e controllo |
|---|---|
| Calibrazione | Confronto dal giorno successivo alla previsione fino all'intero giorno obiettivo, inclusi timestamp; nessuna valutazione prima della chiusura del giorno. Nuova chiave `v2` per non confondere i vecchi confronti. |
| CSV | Escape di CR/LF e metadati; testi che possono diventare formule protetti, numeri negativi conservati come numeri. |
| Scadenze IT/ES | Una scadenza di oggi resta visibile con zero giorni; per IT non diventa già arretrata durante la giornata. |
| Storico mercati | Parametri invalidi, orizzonte zero e direzioni sconosciute respinti; evitato il ciclo senza avanzamento. |
| Persistenza | Una scrittura IndexedDB è considerata completata solo al commit della transazione, non al successo della singola richiesta. |
| Lingue | Nuove notifiche ES e campi CH completati in tutti i sette dizionari. Test uniti senza rimuovere copertura; risultati di calibrazione, recupero e storico localizzati. Il riconoscimento delle domande storiche resta quello del motore esistente, prevalentemente italiano. |
| Test Windows | Percorso URL convertito con `fileURLToPath`; nessun controllo escluso per aggirare un errore di percorso. |

## Dati degli utenti: prove e limiti

Le chiavi attive localStorage, il database IndexedDB e la versione dello schema restano invariati. Nessun reset di transazioni, profilo, apprendimento o licenze è introdotto dal merge.

Prima della riconciliazione, il Vault conserva una sola volta le copie leggibili main/shadow/IndexedDB nella chiave separata `upgrade-2026-09-11`. Il checkpoint comprende anche le informazioni di apprendimento delle copie divergenti. Non viene riscritto agli avvii successivi. Nel Vault, **Dati al sicuro → Altre opzioni → Copia prima dell’aggiornamento** esporta la copia selezionata e tutte le sorgenti nel campo aggiuntivo `upgradeRecoveryCopies`. Il file è in chiaro, come indicato accanto all'azione e nel feedback: conservarlo in un luogo sicuro.

`release-compatibility.test.js` verifica con fixture sintetiche entrambe le forme persistite dei branch: main, shadow, IndexedDB, copie divergenti, riavvio/salvataggio, catene hash, campi sconosciuti, transazioni, modelli, licenze, split con omonimi, esportazione in chiaro e cifrata. Verifica anche commit e abort di IndexedDB. Le copie divergenti sono preservate; i pesi di apprendimento non vengono fusi arbitrariamente.

Questo non è una garanzia contro cancellazione manuale, guasti del dispositivo, quota esaurita o eliminazione dei dati da parte del browser. Se IndexedDB non è disponibile non può esistere il checkpoint in quel database. Il backup esportato resta la protezione indipendente dal browser.

**Un sottodominio di anteprima ha un archivio separato.** I dati del dominio di produzione restano intatti lì, ma non appaiono automaticamente nell'anteprima; il trasferimento esplicito avviene con il backup. Aggiornare sullo stesso dominio mantiene invece l'accesso allo stesso archivio. Non confondere archivio vuoto sull'anteprima con perdita dei dati originali.

## Validazione sul codice integrato

- Suite completa Node 24: **4.839 test, 316/316 file, zero fallimenti, zero skip** (`scripts/run-tests.mjs --serial-files`). Ogni file usa un processo isolato; i test dei fusi eseguono sottoprocessi reali.
- Build finale `scripts/build-portable.mjs`: riuscita in **21,15 secondi**, esbuild WebAssembly della stessa versione del compilatore Vite. Rimane il warning sui chunk superiori a 500 kB.
- `git diff --check` superato; nessun marcatore di conflitto residuo.
- Browser, origine isolata `127.0.0.1:4174`: primo avvio completo con profilo adulto e Paese fiscale CH, reddito saltato, budget non impostato, arrivo Dashboard, riavvio con stato conservato, Vault e apertura Centro Fiducia, azione diretta Split. A 390 × 844 la modale Split occupa x=0, larghezza=390 e il documento non eccede il viewport. Nessun errore console osservato in questo flusso. Le prove precedenti con dieci partecipanti sono documentate nella revisione UI e restano distinte da questo smoke test del merge.

## Cosa non attestano questi controlli

### Difetti trovati nel primo deploy e nella CI

Il push `88bb0dd` ha attivato la [PR #1](https://github.com/GPire/momentum/pull/1).
Cloudflare ha completato la build standard, Android `assembleDebug lintDebug` e
iOS Simulator con SDK 27 hanno compilato con successo nel run
[34646966138](https://github.com/GPire/momentum/actions/runs/34646966138).
Queste sono compilazioni, non prove d'uso su telefoni fisici.

Il collaudo dell'anteprima ha però riprodotto un ciclo di reload: il controllo
canonico trattava ogni sottodominio come un mirror della produzione. La
correzione limita quel confronto ai mirror Netlify, conserva in sessionStorage
il tentativo di reload del bundle e non ricarica il primo accesso quando il service
worker prende il controllo. Cinque test dedicati coprono preview, mirror, versioni
invalide, reload ripetuti e storage indisponibile. La regola proxy Netlify in
`public/_redirects` resta per le installazioni storiche: Cloudflare la ignora con
un warning perché non supporta proxy 200 verso URL esterni; non redirige la preview.

La prima suite Linux ha trovato un difetto reale nel grafo: gli archi della
stessa settimana erano memorizzati in ordine alfabetico ma percorsi in una sola
direzione. Ora sono attraversabili da entrambi i lati; gli archi ritardati restano
direzionali. Due test coprono simmetria/assenza di cicli e divieto di invertire
il tempo. Le fixture QA usano date UTC deterministiche; le asserzioni sulla
risposta non sono state rimosse. 107 test mirati passano dopo queste correzioni;
la suite completa e il deploy vengono rieseguiti sul nuovo commit.

Non sono certificazioni App Store/Play Store, test fisici Safari/iOS/Android o una revisione WCAG completa. Restano testi legacy fuori dai dizionari, dipendenze esterne e limiti fiscali esplicitati nel Centro Fiducia. Open banking e HealthKit non diventano operativi con questo merge. Nessun tasso di conversione è garantito dai test.

Per la pubblicazione: push del branch integrato, verifica della build standard su Cloudflare Pages (`momentum-finance`), collaudo dell'URL effettivamente restituito e PR con questo documento. L'esito remoto va registrato solo dopo averlo osservato; le prove locali non attestano da sole un deploy.
