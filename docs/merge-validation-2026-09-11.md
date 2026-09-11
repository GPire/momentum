# Integrazione verificata di UI e motori — 11 settembre 2026

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

Non sono certificazioni App Store/Play Store, test fisici Safari/iOS/Android o una revisione WCAG completa. Restano testi legacy fuori dai dizionari, dipendenze esterne e limiti fiscali esplicitati nel Centro Fiducia. Open banking e HealthKit non diventano operativi con questo merge. Nessun tasso di conversione è garantito dai test.

Per la pubblicazione: push del branch integrato, verifica della build standard su Cloudflare Pages (`momentum-finance`), collaudo dell'URL effettivamente restituito e PR con questo documento. L'esito remoto va registrato solo dopo averlo osservato; le prove locali non attestano da sole un deploy.
