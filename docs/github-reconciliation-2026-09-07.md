# Confronto GitHub e lavoro locale — 7 settembre 2026

Fetch completato da https://github.com/GPire/momentum. HEAD e origin/main coincidono
in `7fd5051`: nessun commit locale esclusivo e nessun commit remoto da importare.
Le differenze rimaste sono modifiche non committate. Nessun push eseguito.

## Aggiornamenti già presenti nella base GitHub

| Commit | Aggiornamento |
|---|---|
| 80e703b | Dipendenze CDN interiorizzate, boot e correzione della data delle spese |
| 37e991d | Rimozione completa del demo alla prima transazione reale |
| 71d3889 | RETA, ATECO, soglie forfettario e separazione lingua/Paese fiscale |
| 5c8e108 | Documentazione e novità aggiornate |
| 85f5f5b | Fiscalità svizzera: separazione stipendio/reddito autonomo |
| 11a9355 | Guida F24 in sette lingue |
| c49453e | Costo del passaggio dal forfettario all'ordinario |
| 4077a29 | Icone SVG al posto delle emoji introdotte |
| 7c3d4cf | Nuove card degli avvisi fiscali |
| 5cac420 | Scomposizione visiva Tax Vault |
| 7fd5051 | Ulteriori cause di esclusione dal forfettario |
| a62ceea | Territorio foral spagnolo: País Vasco e Navarra |

Questi commit rimangono la base. Non sono stati sovrascritti, annullati o riapplicati.
Le descrizioni sintetizzano commit e confronto dei file; non costituiscono una
certificazione fiscale o un audit completo di ogni funzione del prodotto.

## Decisioni sulle modifiche locali

### Rettifica del riepilogo: anche onboarding, Command Center e transazioni

Il riepilogo iniziale dava troppo spazio ai commit fiscali. La verifica puntuale
successiva conferma anche questi interventi nella base corrente:

- `80e703b`: `core/onboarding-state.js` e boot coerente distinguono un vault semplicemente
  salvato dall'onboarding completato; ripresa del primo avvio senza salto involontario.
- `80e703b`: `resetForm` in `attachFormListeners` ripristina il Command Center dopo il
  salvataggio, compresi data, tipo e importo. Questo blocco non ha differenze locali.
- `80e703b` e `37e991d`: banner "Parti dai miei dati" e uscita completa dal demo alla
  prima transazione reale, invece della sua progressiva mescolanza con i dati personali.
- `80e703b`: date locali in movimenti, calendario, trasferte ed export CSV.
- `71d3889`: separazione fra lingua e Paese fiscale nel percorso onboarding.

Il confronto con origin/main non mostra differenze locali in `core/onboarding-state.js`,
`core/date-utils.js`, `core/vault.js`, `ui/demo-dataset.js` e `predict/command-center.js`
al momento del confronto iniziale. Successivamente `core/vault.js` è stato modificato
per ricontrollare i candidati al recupero al momento della conferma, come descritto sotto.
Questo non significa che l'interfaccia sia identica: in `main.js` e `index.html` rimangono
le nostre varianti del riepilogo finale, budget, accessibilità e modali. Vanno valutate
separatamente rispetto alla preferenza dell'utente per la versione GitHub.

Nuova verifica dell'8 settembre con fetch e ls-remote: main termina in `a62ceea`; v3 termina
in `64faa5a` (luglio 2026, versione 7.1), quindi non è un aggiornamento più recente.
Il nuovo commit main è stato integrato selettivamente nel lavoro locale, senza merge,
commit o push e senza sovrascrivere le modifiche negli stessi file.

| Gruppo | Decisione e limite |
|---|---|
| Dashboard, Analisi Tensor, Tax Vault | Conservare l'implementazione GitHub. Non avviare il ridisegno globale precedentemente richiesto. |
| RETA | Eliminata la differenza locale della formula: stessa somma già corretta da GitHub. Conservati i test aggiuntivi. |
| Telemetria | Ripristinato il default attivo richiesto il 7 settembre, mantenendo gestione errori HTTP e opt-out. |
| Onboarding | Conservate le correzioni locali del budget scelto dall'utente e della navigazione; non confonderle con un rifacimento della Dashboard. |
| Modelli | Conservate le correzioni isolate del conteggio holdout e dei controlli sulle metriche. Non equivalgono a validazione completa dei modelli. |
| Installazione/accessibilità | Conservati gli interventi locali già verificati; la conformità WCAG completa resta aperta. |
| Android/iOS | Scaffold e configurazioni restano locali. Mancano build native e prove su dispositivi. |
| SDK, gradienti, mesh | Lavoro sperimentale conservato, non dichiarato pronto per banche o rilascio. Il blocco locale della sincronizzazione privata senza autorizzazione è una differenza funzionale da risolvere prima del rilascio. |
| Free/Pro | Catalogo locale e suggerimenti conservati per valutazione; pagamenti e gating completo non sono pronti. Nessuna migrazione commerciale pubblicata. |

La copia integrale precedente alla revisione è in `outputs/local-review-2026-09-07.zip`
nella workspace superiore: file modificati e nuovi, patch binaria e identificatori Git.
Non è stato eseguito alcun reset, cancellazione di dati dell'app o rimozione indiscriminata.

## Telemetria effettiva

- Attiva quando non esiste una scelta salvata; il valore disattivato esistente rimane rispettato.
- Controlli sincronizzati in onboarding e impostazioni; testi aggiornati in sette lingue.
- Catalogo chiuso di eventi: installazione, attività, funzioni utilizzate e metadati previsti.
- Nessun ampliamento della raccolta a importi, transazioni, documenti o testo libero.
- I fallimenti HTTP non consumano la deduplicazione; una disattivazione durante la
  sequenza interrompe le successive richieste. Una richiesta già partita non è annullata retroattivamente.
- Contesto finanziario della chat esterna separato dalla telemetria e ancora opt-in.

## Verifiche

- Suite completa locale: **4.689 test superati**, zero fallimenti.
- Build di produzione riuscita. Resta l'avviso relativo al bundle principale molto grande.
- Il server locale è stato riavviato su http://127.0.0.1:5173/?lang=it.
- Nessuna esecuzione delle pipeline native su GitHub e nessuna pubblicazione negli store.

Il rilascio finale richiede ancora selezione/validazione del comportamento mesh,
build native, prove dei flussi principali su dispositivi e revisione delle dichiarazioni
privacy/store. Il superamento della suite non autorizza a chiamare questo stato "pronto".

## Avviso di recupero e selezione per il merge

Il controllo iniziale del registro IndexedDB apriva automaticamente la finestra di
recupero quando trovava transazioni assenti dallo stato corrente. Il rifiuto chiudeva
la finestra senza ricordare la scelta: gli stessi candidati la riaprivano all'avvio.
Non è una previsione di spese dimenticate e il controllo non prova che tutti gli
utenti abbiano perso dati.

Ora la finestra si apre automaticamente una sola volta, soltanto dopo l'onboarding.
La visualizzazione viene salvata prima dell'apertura: X, backdrop, Escape, chiusura
dell'app o rifiuto non fanno ricomparire la richiesta. Un rifiuto sopprime anche
eventuali richieste automatiche future; una conferma rimuove la soppressione. Il
registro non viene cancellato e il recupero richiede sempre una conferma esplicita.
Al momento della conferma si ricontrollano duplicati e transazioni cancellate,
anche se lo stato è cambiato dopo la preparazione dell'anteprima.

Verifiche: suite completa 4.689/4.689; prova Chrome con IndexedDB isolato a
390×844 e 320×568, rifiuto persistente, recupero esplicito, nessun prompt sopra
l'onboarding, nessun overflow orizzontale. La verifica visiva ha anche corretto
l'ancoraggio dei modali: bottom sheet su mobile, centrati da desktop.

Ordine proposto di integrazione, mantenendo la versione GitHub come base:

1. Correzione dell'avviso di recupero e ricontrollo dei candidati.
2. Telemetria attiva di default con opt-out persistente e gestione errori HTTP;
   correzioni isolate di integrità dati, importazione e validazione delle metriche.
3. Correzioni puntuali di budget esplicito, accessibilità e installazione PWA,
   selezionate senza sostituire i nuovi flussi GitHub di onboarding e Command Center.

Tenere separati il ridisegno esteso, le scelte commerciali Free/Pro, il prototipo
SDK/gradienti/mesh e le configurazioni native non ancora compilate. In particolare
il default locale che blocca la sincronizzazione privata senza autorizzazione
cambia il comportamento del prodotto: servono identità/abbinamento verificati
prima di includerlo nel rilascio. Non è un semplice ritocco grafico da unire in blocco.

Nessun merge remoto, commit o push eseguito; tutte le modifiche restano locali.
