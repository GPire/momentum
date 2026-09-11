# Verifica locale — 11 settembre 2026

Branch di lavoro: `codex/public-release-foundation`. Modifiche di questa sessione non pubblicate.

## Modifiche

- Analisi: budget e distribuzione delle spese in apertura; obiettivi, approfondimenti e investimenti raggruppati. Notizie e classifiche del patrimonio restano nel gruppo investimenti.
- Debiti e trasferte raggiungibili senza una seconda apertura annidata.
- Vault: importazione in apertura, quattro gruppi tematici, collegamento diretto alle preferenze che apre anche il gruppo contenitore.
- I nodi delle card vengono spostati, mantenendo ID, listener e condizioni di visibilità. Non vengono cambiate licenze o autorizzazioni Free/Pro.
- Budget non scelto: testo esplicito, nessun confronto con un limite inventato di zero. Card attivabile anche da tastiera.
- Proposta fiscale subordinata a risposta esplicita nell'onboarding e condizioni del profilo.
- Categorie: 18 icone SVG con etichette in sette lingue; aggiunte alcolici, tabacco, snack, trasporto pubblico, caffè, carburante, sport e cura personale.
- Suggerimento locale dell'icona dal nome, senza inviare il testo. La scelta manuale prevale. Il suggerimento riguarda solo l'icona, non una nuova capacità del modello finanziario.
- Editor categorie focalizzato su nome, icona e colore. Feedback di selezione accessibile, nome obbligatorio, griglia adattabile, microanimazioni che rispettano la riduzione del movimento.
- Pulsante aggiunta mobile convertito da div a button, con etichetta localizzata anche su tablet.

## Verifiche eseguite

- Chrome reale, server già attivo su `http://127.0.0.1:5173/` e aggiornamento live.
- Analisi/Vault: controlli a 320, 390, 768 e 1440 CSS pixel; nessun overflow orizzontale rilevato nei percorsi provati.
- Apertura budget con Invio, accesso diretto alle preferenze, accesso ai debiti dal gruppo obiettivi.
- Categorie: prova mobile 320/390 e tablet 768; suggerimento Mezzi pubblici; scelta manuale mantenuta dopo modifica del nome; annullamento restituisce il modulo precedente.
- A 320 pixel corretta un'uscita dei colori dal pannello; misurati bersagli del selettore almeno 44 × 44 CSS pixel. Su tablet 768 la griglia mostra tutte le 18 icone senza scorrimento interno.
- Nessuna transazione o categoria di prova salvata nel Vault dell'utente.
- `node --check src/main.js` e `git diff --check` superati.
- Suite eseguita per file con Node 24, isolamento del processo fornito da PowerShell: 4702 test passati, quattro controlli dei fusi orari in `date-utils.test.js` bloccati da `spawn EPERM`; 298 file su 299 completati senza errori. Questa esecuzione precede l'ultima estensione delle icone.
- Dopo l'estensione: 80 test su icone e traduzioni passati, con `--no-experimental-global-navigator --test --test-isolation=none`.

## Limiti prima del rilascio

- Il runner ordinario e la build Vite non completano in questo ambiente: Windows impedisce l'avvio dei processi secondari (`spawn EPERM`, esbuild per la build). Non sono esiti positivi e non vengono aggirati disattivando protezioni.
- Node predefinito è 16; i controlli sopra usano il runtime Node 24 disponibile nel computer.
- Restano build di produzione, suite ordinaria in ambiente funzionante, Safari/WKWebView e Android WebView, tastiera software, safe area e prove native su dispositivi/SDK Apple e Android.
- I controlli delle larghezze Chrome non certificano iPhone Duo, iOS 27, WCAG completo o ammissione agli store. Nessun tasso di conversione è stato misurato o garantito.

## Fonti consultate

## Secondo passaggio: desktop e tastiera

- Layout desktop ristretto a larghezze da 1280 CSS pixel con puntatore fine e hover. Navigazione compatta a 208 px; da 1440 tre colonne, sotto questa soglia Command Center su richiesta. Le regole strutturali preesistenti sotto 1280 restano in vigore: il tablet non viene trasformato nel nuovo desktop.
- Confermato a 768 px il layout precedente: navigazione 256 px, FAB, nessun Command Center permanente e nessun overflow. A 1366 e 1440 verificate rispettivamente due e tre aree, senza overflow.
- Categorie con griglia e scrollbar visibile per puntatori fini; Nuova all'inizio, frecce/Home/End per spostare il focus, selezione con azione esplicita.
- Corretti intercettazione dei tasti nei campi, focus ritardato nel nome categoria, focus dell'importo sul campo desktop nascosto e focus differito verso il tastierino chiuso.
- Il gestore della rotella lascia prima scorrere le griglie interne. Prova reale: categorie da 0 a 195 px, Dashboard e modulo esterno fermi.
- Prove tastiera: Test 123 seguito da Backspace produce Test 12 senza cambiare importo; Ctrl+A e sostituzione 45 seguita da Backspace produce 4; nel modulo laptop il campo visibile riceve 17 e quello desktop nascosto resta a 0. Nessun movimento salvato.
- 76 test mirati passati su Command Center, memoria importi, quick-add e suggerimenti icone. Controllo sintassi e diff superati. Il blocco build segnalato sopra resta aperto.
- Le prove con viewport Chrome non sostituiscono quelle su tablet fisici con trackpad o dispositivi ibridi.

### Riferimenti

- [Apple: iPhone Duo](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/): schermi e adattamento dell'interfaccia; richiede validazione con SDK e dispositivo.
- [Apple: buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): dimensioni dei bersagli di interazione e chiarezza dei controlli.
- [YNAB: novità](https://www.ynab.com/whats-new): personalizzazione e suggerimenti delle categorie. Riferimento qualitativo, non benchmark di conversione.

## Controlli aggiuntivi: moduli e finestre adattive

- Calendario Momentum riutilizzato nei campi data di pagamenti e creazione obiettivi: selezione, cancellazione, frecce da tastiera, Escape e testi nelle sette lingue. Gli input conservano i valori ISO richiesti dalle validazioni esistenti.
- Obiettivo senza importo: campo vuoto e esempio numerico localizzato, anziché una frase tagliata nella tipografia grande.
- Placeholder di domanda e descrizione movimento abbreviati in tutte le lingue. Dimensione massima dei placeholder separata dalla tipografia dei valori; non è ancora una verifica esaustiva di ogni campo dell'app.
- Distinzione fra zoom della pagina e riduzione del viewport da tastiera. Aggiornamento anche al resize della finestra.
- Rimosso un delimitatore CSS isolato dopo le regole delle aree sicure.
- Verifica Chrome: scadenza aperta a 390 px e ridimensionata a 768 px; calendario a 320 px, selezione 25 settembre 2026 e cancellazione senza salvare; obiettivo a 320 px; Analisi a 320 px e Vault a 768 px senza overflow orizzontale della pagina.
- Ultimo gruppo: 99 test passati (date-picker 8, ui-strings 77, viewport-inset 3, payment-agenda 11). Ulteriori 16 test di profilo e suggerimento fiscale passati. Controllo sintassi main.js e git diff --check superati.
- Nessuna certificazione di iOS 27/iPhone Duo, Safari, Capacitor o rilascio sugli store: i controlli browser non sostituiscono le prove native. Build di produzione ancora bloccata dall'errore spawn EPERM già documentato. Nessun push delle modifiche di questa sessione.

## Revisione campi del passaggio successivo

Inventario sorgente riproducibile: 164 controlli candidati, inclusi template e falsi positivi nei commenti. Dopo le correzioni rimangono 38 candidati senza etichetta rilevabile nel sorgente, 21 senza name e 59 placeholder letterali da valutare per lingua; non sono tutti difetti confermati e non sono tutti risolti. Sono stati aggiunti 79 nomi accessibili derivati dai testi esistenti, più etichette esplicite ai controlli di Vault. Le etichette derivate dai placeholder richiedono ancora revisione semantica per i moduli specialistici.

Modifiche mirate: etichette visibili e griglia a colonna singola sotto 480 px negli impegni mensili; calendario Momentum anche per la data iniziale del piano; azzeramento dei valori data/rate del record precedente quando si modifica un impegno senza durata; esempio bici nelle sette lingue nella creazione obiettivo e importo vuoto con esempio numerico. Creazione obiettivo verificata visivamente a 320 px senza scrivere dati; modulo impegni non raggiunto nel profilo corrente e quindi non dichiarato verificato dal vivo.

Suite completa eseguita con Node 24 e file isolati: 300 file, 299 senza errori; 4689 test passati e 4 falliti in core/date-utils.test.js per spawnSync EPERM. Il log è ../test-fields-review.log, fuori dal repository. Sintassi main.js e diff whitespace verificati. Build produzione ancora EPERM.

Workflow nativo aggiornato per conservare versione Xcode, SDK, runtime/dispositivi disponibili e result bundle della build. Non eseguito su questo stato locale. Piano e limiti: ios-release-verification.md. Nessun push o invio App Store.

## Importazione, budget e accredito — passaggio grafico successivo

- Scena importazione: profondità CSS 3D, orbite con trasformazioni animate e pianeta ombreggiato. Dopo feedback la scena è stata ridotta a 88 px di altezza e il pianeta a 42 px, subordinati all'orb principale. Pulsanti con gerarchia distinta.
- Budget e accredito ridisegnati con componenti condivisi, etichette permanenti, esempi numerici brevi e conferma nel footer. Budget zero non precompilato; eliminato il messaggio che descriveva come stimato un numero assente. Nessuna modifica automatica dei valori finanziari.
- Testi dei due editor (incluse conferme/errori) aggiunti nelle sette lingue. Il resto dell'app conserva debito di traduzione già documentato.
- Validazione accredito separata e testata: rifiuta giorno decimale e importi con suffissi, non interpreta più 2.5 come giorno 25; supporta virgola/punto decimale.
- 101 test mirati passati: editor 3, traduzioni 77, budget advisor 6, budget onboarding 2, modello entrate 13. Screenshot e interazioni Chrome a 390 px: budget vuoto, errore budget senza salvataggio, editor accredito e scena orbitale compatta.
- Animazioni verificate con due trasformazioni 3D diverse a distanza di tempo in modalità Animazioni complete. La preferenza originale Come il dispositivo è stata poi ripristinata: il browser segnala riduzione del movimento attiva. Non è un guasto delle animazioni.
- Mac utente: Intel 2020 con due porte e macOS 15, fuori dalla compatibilità ufficiale Tahoe necessaria a Xcode 27. Alternativa preparata: runner GitHub xcode-27 con verifica esplicita della presenza SDK simulatore 27. Workflow non ancora eseguito o pubblicato da questo turno. iPhone disponibili: 11 Pro Max e 15 Pro; versioni iOS installate non comunicate.

## Inizia senza importare — dati già conosciuti

- Eliminato il vicolo cieco del solo toast: se non mancano informazioni, il pulsante apre direttamente il Command Center. Se le chiede, il completamento esplicito degli editor porta all'inserimento; chiudere un editor interrompe il percorso.
- Il riconoscimento dell'accredito riusa income-model solo sullo storico reale, con confidenza almeno 0,75 e importo valido. Non scrive salaryProfile, non imposta budget e non usa dati demo. Conferme manuali e rifiuto del budget restano rispettati.
- 97 test mirati passati: onboarding-priors 41, Command Center 43, income-model 13. Verifica Chrome a 390 px: il pulsante apre il dialog Momentum con importo attivo e conferma disabilitata. Nessun movimento salvato durante la prova.
- Open banking: verificati i punti di riuso e documentati costi da quotare, gateway, consenso, riconciliazione e prove necessarie in open-banking-readiness.md. Nessun connettore bancario attivato, nessuna chiamata bancaria reale, nessun push in questo passaggio.

## Command Center — priorità al pollice

### Ultima revisione: una fila, voce contestuale, margini colorati

Supera la variante a due righe descritta sotto. Mobile: una fila orizzontale da 74 px, pulsante Nuova categoria permanente nell'intestazione, fuori dallo scorrimento. La creazione usa lo stesso editor e non perde la categoria alla chiusura. Esempio vocale spostato dentro il gruppo microfono, a fianco dell'orb sotto Prova a dire; il residuo resta associato all'importo.

Residui dopo la bozza: mese, stima giornaliera, settimana. Il settimanale riusa weekRemaining dell'advisor e include lo sforamento già accumulato; non introduce un budget settimanale indipendente. Verde per margine disponibile e rosso per sforamento, accompagnati da testo/importo. 146 test mirati passati: Command Center 47, advisor 22, i18n 77. Chrome a 390 px: una riga effettiva, Nuova categoria apre l'editor, annullamento e frecce funzionanti, esempio nel gruppo voice. Nessuna transazione salvata, nessun budget modificato, nessun push. Tastiera software reale e casi budget nella UI ancora da verificare su dispositivo dedicato.

### Versione corrente: categorie scorrevoli e voice integrato

Il feedback più recente sostituisce la categoria chiusa e la griglia fissa: su mobile categorie sempre presenti in due righe a scorrimento orizzontale, icone luminose con profondità, creazione in fondo. Su desktop resta la griglia. Frecce della tastiera adattate al flusso per colonne mobile. Voice orbitale da 80 px dentro l'area importo, palette viola/azzurra a riposo, stato di ascolto distinto; categorie con feedback al tocco. Input/importo/valuta, esempio vocale e margine condividono la stessa area.

Corretto il riepilogo nascosto: opacity-0 veniva lasciata anche quando il renderer mostrava un messaggio e il CSS lo escludeva dal layout. Aggiunto residuo mensile dopo la bozza (o sforamento) e ripristinata la stima del margine giornaliero solo per oggi. Calcolo puro budgetAfterExpense, non scrive dati, rifiuta budget assente/importi invalidi e valute non EUR senza conversione. Il budget rifiutato non produce un residuo. Gli avvisi del freno spese rimangono.

145 test mirati passati (Command Center 46, i18n 77, advisor 22), inclusi tre nuovi scenari budget. Chrome: pannello 0–390 px e 0–320 px, nessun overflow della pagina, footer nel viewport; fascia categorie 640 px dentro 346 px, creazione raggiungibile tramite scorrimento. Nel profilo della prova il riepilogo era vuoto: nessun budget è stato cambiato per forzarne la comparsa. I casi con budget e sforamento sono verificati dai test del calcolo, non da una prova bancaria reale. Nessuna transazione salvata e nessun push.

### Revisione successiva: prima vista essenziale

Il feedback successivo ha respinto anche la griglia iniziale a sei categorie. La versione corrente sostituisce quel passaggio: categoria in una riga, lista completa aperta solo su richiesta e richiusa dopo selezione. La riga mostra anche la categoria riconosciuta dal modello esistente. Data, divisione, scadenze e tastierino sono raccolti in una sezione esplicita; eventuale data precompilata diversa da oggi continua ad aprire i dettagli. Nessuna nuova categoria assegnata arbitrariamente.

Verifiche di questa revisione: 120 test passati (43 Command Center, 77 i18n); sintassi e whitespace corretti. Chrome a 390 px: importo 12,50, scelta Salute, lista richiusa e Conferma abilitato; apertura opzioni/data conserva importo. A 320×640 categoria alta 52 px, footer entro il viewport, nessun overflow orizzontale. Nessun salvataggio di transazioni. Test con tastiera software e dispositivi fisici ancora da eseguire. Nessun push.

### Passaggio precedente, superato dalla revisione sopra

- Un ordine DOM/visivo condiviso: tipo, importo, descrizione facoltativa, categorie, azioni. La descrizione precede le categorie per rendere accessibile il suggerimento esistente mentre si scrive. Nuova etichetta e controlli categorie tradotti nelle sette lingue.
- Dopo il feedback sul modulo troppo lungo, prima vista ridotta a sei categorie; selezione e suggerimento contestuale restano visibili anche fuori dalle prime sei. Espansione esplicita, creazione categoria sempre raggiungibile. Nessuno scorrimento annidato nella griglia.
- Data e divisione affiancate, scadenze nello stesso percorso; Conferma e Annulla nel footer mobile. Importo leggibile corretto contro una regola globale che lo portava a 16 px. Microfono laterale compatto su mobile, feedback di pressione e apertura con rispetto della preferenza movimento.
- Dettagli/tastierino chiusi resi inert: non trattengono il focus su controlli invisibili. Navigazione a frecce delle categorie ignora quelle nascoste; tipo selezionato con aria-pressed; stato iniziale del pulsante indica cosa manca.
- Chrome: prove a 390×844 e 320×640, importo 12,50 e categoria rendono Conferma attivo; categorie aggiuntive e Salute selezionata restano accessibili richiudendo la griglia; apertura/annullamento nuova categoria e annullamento dal footer. Nessuna transazione salvata. A 320 px nessun overflow orizzontale, tipi alti 44 px e conferma 54 px.
- 120 test mirati passati (Command Center 43, i18n 77), sintassi main.js e diff whitespace verificati. Queste prove browser non verificano la tastiera software di un iPhone reale né certificano iOS/Android. Nessun push in questo passaggio.

## Controlli categoria, Split, Trasferte e What if — 11 settembre

- Categoria: etichette visibili per nome/icona/colore, anteprima con nomi lunghi, selezione colore distinguibile anche per forma, griglia adattiva senza scorrimento interno, un solo invito a confermare. Annullamento interno restituisce il focus al comando Nuova; il secondo annullamento esterno è nascosto durante l'editor. Messaggio inline per nome vuoto, riconoscimento duplicati anche dal nome tradotto e normalizzazione degli spazi. Nuovi messaggi in sette lingue.
- Split: campi da almeno 48 px, scelta quote con stato aria-pressed, nomi accessibili distinti per importo pagato/dovuto, azioni e selettori da almeno 44 px. A 320 px le scelte e le azioni finali si impilano.
- Trasferte/gruppi: campi e azioni più grandi, focus visibile, importo e descrizione a tutta larghezza sotto 480 px.
- What if: categoria selezionabile con pulsanti al posto del dropdown visibile; range separato, stato di risultato annunciabile, nomi delle categorie localizzati, messaggio anche in assenza di storico.
- Grafico categorie: legenda con importi e nomi leggibili senza hover, nomi tradotti ed escaped, due colonne quando lo spazio lo permette.

Verifica: 206 test mirati passati (i18n, icone, what-if, split-engine, trip-engine), controllo sintattico main.js passato. Browser locale: categoria a 320 px senza overflow (250/250 px), icone almeno 69x72 px, errore vuoto e cancellazione errore durante digitazione; duplicato Mobilità selezionato su viewport 834 px. Split a 390 px: body 378/378 px, campi 48 px, quote 56 px. Trasferta Lugano aperta in sola lettura a 390 px: body 378/378 px, campi 48 px, pulsanti almeno 44 px. What if: stato senza storico osservato; prova successiva delle frecce non conclusa perché la UI era nuovamente sul Command Center. Nessuna nuova spesa/gruppo/trasferta salvata nei test. Viewport ripristinato. Non equivale a verifica su dispositivo iOS/Android né a certificazione di rilascio.

## Revisione successiva: colori, scadenze, previsione e accesso a Split

- Colori spostati prima delle icone, sotto nome/anteprima: su viewport 320 px il gruppo colori inizia a circa 397 px, prima delle icone a 559 px; editor senza overflow (250/250 px).
- Dividi è un comando direttamente visibile sotto le categorie, fuori dall'accordion. Rimane nascosto per entrate (verificato nel browser). Il riepilogo delle opzioni ora si chiama Data e scadenze in tutte le lingue. Restano disponibili gli accessi preesistenti di Analisi a gruppi e divisione veloce.
- Scadenze: pulsante aggiunta separato dagli stili degli obiettivi, layout flessibile, descrizione leggibile, azioni da 48 px.
- Previsione: importo e prossimo accredito in primo piano; curva in un dettaglio dedicato, con nota visibile che dichiara la stima. Il dettaglio è omesso senza curva e mantiene lo stato aperto nei render. Contenitore grafico esplicitamente relativo e alto 140 px per evitare etichette sovrapposte.
- Simulatore: range con maniglia custom, campo/risultato separati, etichetta accessibile; ArrowRight passa da -20% a -10% nel browser.
- Calendari mensili condivisi: rimosso aspect-ratio che forzava celle troppo larghe. Dashboard a 320 px: griglia 236/236 px, celle alte 52 px. Rifiniti anche titoli e contenimento del calendario Analisi.
- 229 test mirati passati (cash forecast, calendario, what-if, command center, impegni, i18n); 79 test i18n ripassati dopo la modifica del titolo opzioni. Sintassi main.js verificata. Nessun salvataggio finanziario o push. Verifiche browser responsive, non test su telefoni nativi.

## Split, simulatore e strumenti finanziari — ulteriore revisione

- Split: esempi brevi (IT: 60 cena Alex; Es. cena), etichette visibili, placeholder responsive senza ridurre il testo digitato sotto 16px. Sei nuove stringhe in tutte le sette lingue; esempi verificati dal parser (60, persona Alex).
- Simulatore: risultato evidenziato, confronto strategie in un dettaglio dedicato nascosto quando vuoto, scelta categorie in fascia scorrevole, stato percentuale distinto. Microtransizioni rispettano prefers-reduced-motion. Browser 390px: +50 euro/mese aggiorna il risultato, card 323/323px senza overflow.
- Importazione Vault: gerarchia visiva, bordi e pulsanti coerenti, testi a capo. Browser 320px: card 276/276px, pulsanti almeno 44px, nessun file importato.
- Pagamenti/lavoro e mercati: ritmo e tipografia delle card più leggibili, azioni touch più grandi senza alterare il gating di profilo/licenza.
- Gestore impegni: scelte con aria-pressed, layout adattivo e campi da 50px; titolo e descrizione semplificati e tradotti. Browser 320px: scelta Mutuo verificata, body 308/308px, campi visibili larghi 226px. Nessun impegno salvato.
- Patrimonio/confronti: intervallo prudente/tipico/favorevole visibile sotto le barre, non solo nel tooltip; nomi a capo, gruppi separati, controlli di confronto ingranditi.
- News: componente condiviso con titoli, fonte e riassunto più leggibili, bordi e feedback hover/focus/pressione coerenti. Non verificato in questa passata con feed popolati o portafoglio completo.

164 test mirati passati (i18n, net-worth, what-if, fixed-commitments, split-predictor); 80 i18n ripassati dopo l'ultimo intervento sui testi degli impegni. Sintassi e diff --check passati. Viewport ripristinato. Modifiche locali; nessun push. Questa passata non certifica l'intera UI, tutte le combinazioni di profilo, o l'app nativa.

## Navigazione e ulteriori controlli Vault / Analisi

- Click sul menu della vista già attiva: no-op prima di rendering, haptic e telemetria. La guardia considera anche la visibilità reale, perché currentView può essere salvato dalla sessione precedente mentre il boot mostra Dashboard. Le chiamate interne navigate restano disponibili per aggiornamenti espliciti.
- Cambio vista: reset del documento e degli antenati del contenuto immediato e al frame successivo, con controllo della vista attuale prima del reset differito. Test browser: Analisi con scrollY=1419 e simulazione=50; nuovo click Analisi mantiene scrollY=1419, valore=50 e sezione aperta. Cambio Vault porta scrollY=0.
- Promemoria: etichette visibili, esempi brevi in sette lingue, nomi accessibili separati dagli esempi, campi a 50px. Browser 320px: card 254/254px; titolo/nota/importo larghi 222px; data 170px accanto al pulsante.
- Ricerca asset: campo e azione su griglia, esempio breve e nome accessibile dal titolo. Browser 320px: card 254/254px, campo 152x50px, placeholder Es. Apple.
- Ritmo e controlli di sezioni Vault (Dati al sicuro, Come piace a te, Scopri di più), installazione e Tempismo migliorati con stili condivisi. Pianeti di sezione con deriva 2D e orbita CSS in prospettiva; transizioni di apertura e pressione, condizionate alla preferenza di movimento. Nessuna modifica a dati/profilazione/licenze o procedure di installazione/sync.
- 113 test mirati passati (i18n, profilo-feature, install-guide); main.js sintatticamente valido. Nessun salvataggio finanziario o push. Viewport ripristinato. Non verificata ogni variante di dati né tutti i browser/dispositivi nativi.

## Studio simulazioni e gerarchia condivisa — revisione strutturale

- Nuovo src/ui/financial-workspace.css importato dopo dashboard-clarity.css: componenti finanziari riuniti in un foglio dedicato, senza dipendenze aggiuntive.
- Simulatore ricostruito intorno a due tab accessibili (Risparmiare di più / Cambiare una spesa), un pannello alla volta, frecce/Home/End da tastiera e valori conservati tra i pannelli. Preset 0/50/100/200 euro collegati allo stesso evento input del motore esistente.
- Importo dominante; output a tre scenari etichettati invece di tre cifre concatenate. A zero si mostra un invito a scegliere l'importo e si nascondono i confronti. Nota esplicita sulle stime. Nessuna modifica ai calcoli Monte Carlo.
- What if senza storico: collegamento diretto all'importazione Vault. Nel browser porta al Vault con scroll=0.
- Importazione: Importa tutto primario, formati specifici in dettaglio dedicato, esportazione secondaria. Tipografia, input, card e animazioni condivise applicati agli strumenti finanziari già raggruppati, mantenendo gating e funzioni.
- Tutti i nuovi testi in sette lingue. Decorazione SVG con prospettiva CSS e transizioni limitate alle interazioni; rispetto della preferenza di movimento.
- Browser: preset 100 produce tre scenari; freccia destra cambia tab e tabindex corretti; preset 0 elimina scenari precedenti. A 320px simulatore 254/254px, tab alti 56px, tre scenari in righe separate; importazione 276/276px, formati 118x44px. Ripristinato viewport normale. Nessun file importato o transazione salvata.
- 119 test mirati passati (i18n, net-worth, what-if, split-predictor), main.js syntax check e diff --check passati. Non è una verifica esaustiva di tutte le card, feed popolati e combinazioni native. Nessun push.

## Card finanziarie, mercati e Vault — dettagli e interazioni

- Grafico spese: totale centrale, segmenti separati, profondità tramite ombra, orbita decorativa CSS in prospettiva; legenda con nome, importo, percentuale e barra. Il canvas resta piano per non distorcere le proporzioni. Motion condizionato alla preferenza; dati presenti anche in DOM.
- Budget: pulsante esplicito Modifica budget (sette lingue) al posto dell'intera card cliccabile. Rimossa la vecchia semantica role=button del contenitore, evitando pulsanti annidati. Apertura browser verificata, budget vuoto e facoltativo, nessun salvataggio.
- Ricerca asset: campo search, azione evidente, suggerimenti in fascia touch, spazi vuoti dei contenitori risultati rimossi. Campo compilato e svuotato senza lanciare ricerche esterne.
- Quadro mercato, investimenti attivi, investimenti, patrimonio e crescita: gerarchia tipografica, superfici e risultati rivisti, dettagli e azioni coerenti. Motori e gating invariati. Stato mercato senza posizioni e trader con dati esistenti ispezionati; proiezioni complete non verificate con portafogli popolati.
- Vault: tasse e accrediti rivisti; corretti pulsanti Paesi fuori card a 320px. Scadenze con data etichettata e pulsante Aggiungi testuale da 48px; nessun evento creato. Modulo accredito verificato a viewport desktop stabile, campi alti 64px (62px area interna), chiuso senza salvare.
- Preferenze: selezione Essenziale/Completa visibile con target 56px, opzioni movimento responsive. Corretto overflow a 320px: card 254/254px dopo la correzione. Preferenze persistenti non modificate.
- Browser Chrome, controlli 390px e 320px e desktop. Cattura mobile dei dialoghi instabile dopo resize dell'emulazione: non equivale a test su telefono reale. Orbita contenuta per evitare overflow decorativo. Viewport ripristinato.
- Sintassi main.js e diff --check verificati. Risultati test mirati in ../detail-cards-tests.log. Nessun push, nessuna modifica a importi o dati dell'utente. Non è certificazione App Store/Play Store né audit completo di ogni variante.

## Vault: promemoria progressivi e manutenzione app

- Questa app: nuova intestazione orbitale, pulsante aggiornamenti ampio con stato persistente e aria-busy/disabilitazione durante controllo. In locale/assenza SW il comando risponde esplicitamente invece del precedente no-op. Rimozione dati sotto dettaglio separato, procedura nukeVault invariata e non eseguita.
- Promemoria: eventi e previsioni esistenti prima del modulo; composer apribile con nome/data, scorciatoie oggi/domani/+7 giorni calcolate in calendario locale; importo/nota facoltativi in dettaglio. Nessun appuntamento o addebito creato automaticamente. Export rinominato correttamente, non sincronizzazione continua.
- Validazione pura parseReminderDraft: date realmente esistenti, importo facoltativo, decimali virgola/punto, rifiuto negativi/valori parziali. Errore inline e focus sul campo, dettagli importo aperti in caso di errore. Successo chiude composer e restituisce focus. Salvataggio effettivo non esercitato sul Vault personale.
- Accredito: riepilogo solo da salaryProfile confermato, aggiornato dopo modifica/reset; nessun valore inventato. Tasse: Paesi in selettore espandibile, stato fiscale personalizzato e motori invariati.
- Nuovi testi tradotti nelle sette lingue, incluso feedback aggiornamenti. Test aggiunto per sostituzione valori nel riepilogo stipendio (bug di interpolazione trovato e risolto durante verifica browser).
- 109 test mirati passati: i18n, input monetari/promemoria, calendar-format, profilo-feature. Sintassi main.js e diff --check passati.
- Browser: invio vuoto mostra errore e focus; Domani seleziona 2026-09-12 e aria-pressed corretto. Controllo aggiornamenti locale produce messaggio visibile. A 320px app/tasse/accredito 254/254px, composer 220/220px; campi principali 188px x50/52px; data rapida target circa59x52px. Nessuna cancellazione, esportazione o scrittura dati effettuata. Viewport ripristinato; nessun push. Test produzione SW e store nativi non effettuati.

## Esplorazione grafico, navigazione e trasferimento dispositivi

- Grafico: legenda a pulsanti accessibili; selezione aggiorna importo/etichetta centrali, quota delle spese e conteggio movimenti dal mese visualizzato (inclusa fonte demo coerente). Reset Tutte le categorie. Stessa selezione collegata al canvas, nessuna scrittura finanziaria. Eliminato titolo duplicato. Dopo destroy il riferimento Chart viene azzerato per non aggiornare istanze distrutte nello stato vuoto.
- Browser: click su Mobilità mostra 100%, 1 movimento e 32 euro; Space su pulsante focalizzato torna al totale. Press Enter iniziale senza focus non ha attivato il controllo nel runner; click e Space verificati. Non testati molti segmenti con dati aggiuntivi nel Vault personale.
- Transizioni: ingresso 260ms al vero cambio pagina; rerender interno non riavvia la classe view-in. Preferenza reduced motion rispettata. Preferenze collassate con titolo e stato su righe separate e icona in colonna dedicata.
- Nav mobile: righe icona/etichetta comuni. A 320px quattro target 56.5x60px, etichette tutte y=700.5 senza troncamento o andare a capo (Dashboard 48/48px). Preferenze aperte 254/254px. Viewport ripristinato.
- Bug legacy confermato: QR-Sync era btoa(localStorage), senza QR/cifratura; PeerID decodificava quel token e sostituiva la copia locale. Rimossi controlli fuorvianti e sostituiti alias con export cifrato / import verificato già esistenti. Nessun token generato o importato.
- I tuoi dispositivi: due azioni per creare/aprire copia protetta, nota esplicita che non è sync continuo. Recovery separato da trasferimento e mesh sperimentale con limite privacy visibile. Nessuna riattivazione della sincronizzazione privata sospesa.
- Export cifrato: prompt browser sostituito con form Momentum, password/conferma, errore inline, busy state; stesso encryptBackup e formato .momentum. Download non eseguito sui dati personali. Apertura e rifiuto password vuota verificati nel browser. Ripristino backend invariato.
- 117 test mirati passati (i18n, backup cifrato e profilo-feature), sintassi main.js e diff --check passati. Nessun push e nessuna condivisione/trasmissione dati durante le prove. Collegamento fra due dispositivi e build nativa non testati.

## Focus categorie, strumenti e osservatorio patrimonio

- Patrimonio ricostruito: orizzonti uno/cinque anni, pianeta decorativo con anello CSS animato, intervallo probabilistico sempre visibile, ipotesi e rendita in due dettagli separati. Rimossi barattolo decorativo e relativo aggiornamento DOM; numeri, worker e calcoli invariati. Etichetta Capitale necessario e orizzonti semplificati in sette lingue.
- Debiti, trasferte e Insieme con hook specifici, indicatori geometrici, superfici e azioni coerenti; pulsanti principali distinti dalla divisione veloce. Accessi esistenti preservati e pannelli debiti/trasferte aperti e richiusi senza salvare nulla.
- Focus grafico prima della legenda; riga selezionata usa il colore della categoria e rivela quota/conteggio con microtransizione. Prime cinque categorie ordinate per spesa, pulsante per espandere le altre. Selezione da canvas rivela automaticamente una categoria oltre le prime cinque. Il Vault personale disponibile ha una categoria: comportamento visuale con molte categorie non esercitato su dati personali.
- Browser: orizzonti, ipotesi e rendita disponibili; dettaglio FIRE aperto dopo apertura del gruppo contenitore. Un tentativo di click nel gruppo chiuso non era riuscito: non era un blocco dello scroll. Controlli a320px: card patrimonio/debiti/trasferte/Insieme 254/254px; pulsanti larghi206px e alti51–72px. Viewport ripristinato.
- 130 test mirati passati (i18n, net-worth, debt-payoff, split-predictor), sintassi e diff --check passati. Nessun push, importazione o modifica dati finanziari. Non verificati tutti i dataset/profili né piattaforme native.

## Preferenze contestuali, durata simulazioni e moduli degli strumenti

- Personalizza Analisi apre un dialogo nella vista corrente, non naviga a settings e non cerca un pannello a fondo pagina. Due scelte descritte, stato aria-pressed e nota esplicita che Free/Pro non cambia. Mantiene setUiComplexity e visibilità dei profili esistenti.
- Card patrimonio resta confronto fisso uno/cinque anni; simulatore riceve scelta 1/3/5/10 anni collegata sia a projectStrategy sia al confronto projectNetWorthByStrategy. Label orizzonte coerente, selezione da tastiera con focus conservato. Nessuna nuova formula di rendimento.
- Icone semantiche con titoli: documento per debiti, valigia per trasferte, persone per Insieme. Tolti i precedenti segni geometrici astratti.
- Modali debito/trasferte/split: hook dedicati, superfici, controlli e microtransizioni. Debito: quattro etichette permanenti e placeholder brevi; saldo/tasso in colonna a320px. Trasferta: nome etichettato, esempio breve, heading h3 per nome dialogo accessibile. Split: input e persone con target più grandi.
- Browser: dialogo preferenze sopra Analisi (analysisHidden=false, vaultHidden=true); chiuso senza cambiare preferenze. Simulatore100/mese e10anni aggiorna risultato (p50 18.209,34 euro nel test); successivo HMR ha ripristinato default senza scritture finanziarie. Debito320px: campi226x50, contenitore284/284; dialogo debito/split aperti e chiusi senza salvataggi. Viewport normale ripristinato.
- 145 test mirati passati (i18n, proiezioni, debiti, split e profilo-feature). Sintassi main.js e diff --check passati. Nessun push. Flussi complessi con debiti/gruppi multipli, export e test nativi non esercitati in questa passata.

### Accredito, ricezione rimborsi e controlli del mese
- Modulo ricezione rimborsi riutilizza money-editor: selezione a pulsanti con aria-pressed, etichette persistenti, errore inline, conferma nel footer; nuovi testi in sette lingue.
- Corretto il riferimento mutabile al profilo salvato: bozze indipendenti per metodo, nessun aggiornamento dello stato prima di Salva. Cambio metodo conserva anche l'intestatario in bozza.
- Card accredito: azioni più grandi; moduli accredito/rimborsi con spaziatura compatta su schermi stretti.
- Riepilogo mese: confronto settimanale nei dettagli della previsione, disponibilità e prossimo accredito in primo piano; nessuna modifica alle formule.
- Personalizza Analisi: icona di regolazione. Chiedi: icona SVG, focus visibile, feedback pressione/attesa, blocco richieste concorrenti e gestione Enter durante composizione.
- Verifica: 101 test mirati superati (i18n, payout, money-editor-values); syntax main e git diff --check superati.
- Browser locale: cambio PayPal/IBAN e recupero bozza, campo vuoto con aria-invalid, chiusura/riapertura senza salvataggio; moduli 284px senza overflow a viewport320, pulsanti metodo48px; riepilogo276px senza overflow e dettaglio settimanale leggibile. Nessun dato finanziario salvato durante le prove.
- Nessun push, build di produzione o test nativo effettuato in questo intervento. Mancano prove del nuovo controllo Chiedi con richieste lente/rete e dei flussi di pagamento su dispositivi reali.

### Navigazione persistente e card compatte
- Causa confermata nel browser: appEntra con transform e fill-mode both lasciava #app-core trasformato, trasformando il riferimento della sidebar fixed nell'intera pagina. Ingresso ora solo opacity; sidebar vincolata a 100dvh.
- Tablet 768–1279: rail168px, etichette con icone, navigazione raccolta al centro; touch largo mantiene controlli64px. Nessuna sostituzione della nav mobile.
- Salvadanaio: due valori compatti; spiegazione e azione di accantonamento in details, ID e handler conservati.
- Mese: cifra e anello affiancati; percentuali e confronto settimanale nei dettagli, stato breve sempre visibile. Percentuali da dati esistenti, senza nuove inferenze di salute.
- Trasferte: sostituita icona scatola del pulsante con valigetta, coerente al titolo.
- Insieme: ingresso facoltativo Come farmi pagare, copy dipendente da resolvePayout; fallback esistente di openRequestPayment mantenuto.
- Test101 mirati passati; syntax e diff check passati. Browser: ingresso Insieme -> payout, nessun salvataggio; navtop0 a scroll1301 con altezza pari al viewport; Salvadanaio209px desktop senza overflow; percentuali2%/58% coerenti ai dati del caso locale. Test tablet via viewport, non dispositivo reale.
- HealthKit non implementato: i dati finanziari dell'anello non sono campioni sanitari. Un futuro servizio salute richiede tipi supportati e consenso HealthKit specifico (documentazione Apple).

### Grafico prioritario e Salvadanaio orbitale
- Previsione esposta prima dei dettagli: un controllo giorno per giorno aggiorna data, valore, intervallo e marcatore senza scrivere nel Vault.
- SVG con proporzioni preservate e percorso lineare tra campioni: rimossa interpolazione che poteva creare oscillazioni non presenti nel modello. Gradienti e marcatori restano decorativi, i valori sono quelli di cashForecast.
- Salvadanaio: pianeta decorativo a orbite CSS3D con movimento ridotto rispettato, gerarchia tipografica e azione espandibile; mesi coperti limitati a zero in presenza di riserva negativa (il saldo negativo resta visibile).
- 131 test mirati cash-forecast/i18n passati. Browser: End porta a11ott/1500EUR e marcatore640, Home ritorna al primo giorno; controllo44px e assenza overflow nelle tre card misurate con viewport mobile. Nessun dato salvato.
- Proposta HealthKit in financial-wellbeing-healthkit.md, non ancora integrazione nativa. Nessun push in questo intervento.

### Tema, posizione dei controlli e nascondi/mostra
- Scelta progettuale: Chiaro/Scuro espliciti con anteprima in Vault > Come piace a te > Aspetto e lettura; accesso rapido nella barra mobile mantenuto e aggiunto al fondo della barra laterale desktop/tablet. Posizioni stabili per età, profilo e piano. Nessun nuovo popup. Non si rivendica una superiorità di conversione senza test utenti comparativi.
- Tema: stato e icone sincronizzati tra tutti gli accessi; selezionare il tema già attivo non ripete la transizione. Etichette dinamiche tradotte in7lingue, rimosso attributo di traduzione statica che le sovrascriveva.
- Mascheratura: rimosse temporizzazioni a onda sui dati. I controlli mantengono il feedback, i nuovi numeri/grafici di mese e categorie vengono mascherati subito anche dopo render/cambio pagina. È una protezione visiva, non cifratura o rimozione dei dati dal DOM.
- Mese: testata, dettagli, percentuali e focus dei controlli armonizzati; adattamenti di colori/anello per tema chiaro.
- Browser: desktop scuro->chiaro, sincronizzazione accessi; hide su valore/grafico/readout (blur9px); passaggio Analisi conserva hide; unhide ripristina il filtro precedente. Vault Chiaro/Scuro aria-pressed corretto, selezione Scuro ripristina tema iniziale. Mobile controllo tema60px, più cicli hide/unhide restituiscono privacyfalse e filternone.
- 131 test i18n/cash-forecast passati, syntax e diff check passati. Nessuna prova nativa iOS/Android o audit WCAG completo; nessun push. Stato finale ripristinato: tema scuro e numeri visibili.

### Tema automatico e riconoscibilità del marchio
- Tre scelte direttamente nella barra laterale: Chiaro, Scuro, Auto; nessuna apertura di Vault richiesta. Anche Vault espone Come il dispositivo.
- Preferenza persistente separata dal tema effettivo: system/light/dark; nuovi profili system, preferenze legacy booleane rispettate durante il caricamento. matchMedia segue OS/browser, con controllo anche a focus/rientro da background. color-scheme e theme-color coerenti.
- Marchio56px con meno padding; tablet logo+occhio44px, desktop logo+Momentum+occhio con rail224px. Etichette tradotte, stato aria-pressed, microinterazioni con movimento ridotto rispettato.
- Test:88 i18n/preferenze superati;44 vault e6 vault-bulk superati in processi separati. Esecuzione iniziale con isolamento disattivato e file combinati ha prodotto interferenze di mock; i due file rieseguiti indipendentemente passano.
- Browser: Auto attivato via tastiera, aria-pressedtrue e tema effettivo uguale al sistema. Dispatch mouse del runner due volte in timeout: non certificato il test click su Auto in questa sessione. Logo immagine circa46px dentro superficie56px. Scelta finale lasciata Auto.
- Nessun vincolo di aspetto forzato trovato nell'Info.plist; Android NoActionBar usa DayNight. Nessuna prova nativa fisica o di status bar nativa eseguita, non dichiarare pronto App Store.
- Fonte: https://webkit.org/blog/8840/dark-mode-support-in-webkit/

## Dashboard: hierarchy and direct actions (11 September, follow-up)
- Weekly calendar remains directly visible and compact; day entry and full-month control retained. Monthly totals, savings/goals and contextual extras reuse their existing DOM nodes in separate disclosures.
- Daily allowance stays visible. Extended cash projection is behind “Plan the month”; a computed absolute cash-risk flag opens it. Existing open state is preserved on rendering.
- Direct split and agenda actions; goals, actual trips and explicit investment interest determine other shortcuts (max four). Existing underlying feature/plan checks unchanged. No claim that every onboarding response requires a distinct layout.
- Stable DOM order replaces repeated CSS relevance ordering. No financial amounts or records changed.
- Seven-language labels. Two columns for narrow/intermediate screens; expanded row only on wide fine-pointer/hover surfaces. SVG icons, focus outlines, 56px minimum quick-action height, reduced-motion-aware transitions.
- Validation: 149 focused tests passed (dashboard actions, translations, profile visibility, cash forecast); main.js syntax check passed. Browser: split opens without intermediate screen; agenda opens and focuses its summary; goal action opens and focuses savings section; no duplicate Dashboard IDs.
- Browser measured widths 360 / 853 / 1600 CSS px: document width did not overflow viewport. Narrow action buttons 159px wide, 56–60px high, no clipped content; calendar directly parented by Dashboard. This is browser viewport testing, not physical tablet/iPhone, native store, or accessibility certification.
- Not pushed or committed in this follow-up. Conversion changes require real, consent-respecting usage measurement; no guaranteed percentage.

## Unified daily/weekly/monthly surface (follow-up)
Supersedes the previous separate daily-card / weekly-card placement above.
- One `home-money-calendar` region reuses the existing forecast, calendar and month-navigation nodes. Direct shortcuts stay outside and above it. Today's estimate is dated explicitly; no payday-cycle number is relabelled as a monthly budget.
- Week and Month are mutually exclusive views with labelled, keyboard-operable buttons and hidden inactive content. Day-to-transaction entry remains connected; browser test opened 7 September with that date prefilled, without saving a transaction.
- The orbital spending visual belongs to the selected calendar period. Weekly values reuse `getIsoWeekStatus`; monthly spending reuses `displayTxForMonth`. Without a positive user budget, it shows spending and “No budget set”, with no budget progress percentage. Forecast information remains accessible in its disclosure.
- Month shifting now starts at day 1, avoiding month skipping from dates such as March 31. Historical month browsing aligns the weekly view to a week touching that month. Tests cover year changes, leap February, all months and current/future-week bounds. Existing day/week budget formulas unchanged.
- Responsive layout uses the actual component width: stacked in narrow/tablet portrait space, two columns when its container has at least 760px. Touch controls remain at least 44px before press animation. SVG orbital depth, subtle star glow and view-entry motion respect motion preferences. Numeric privacy covers the new ring and captions. All added copy has seven translations.
- 167 focused tests passed: calendar periods, Dashboard actions, translations, profile visibility, cash forecast and weekly budget. Syntax check passed. Browser checks: week/month exclusivity, month-to-week alignment, no duplicate calendar IDs, no page overflow at measured widths 360px, 853px and the wide layout. No budget percentage shown for the local no-budget case.
- Browser automation intermittently timed out on CDP mouse dispatch (also observed before this change); equivalent keyboard actions completed. Physical touch devices, native iOS/Android and production bundle are not certified by these checks. No financial records saved and no push performed.

## Calendar interaction and multilingual coverage refinement
- Replaced the two generic buttons with a labelled tablist: equal touch targets, custom SVG week/month icons and a sliding selection surface. Selected state uses aria-selected; only the selected tab is in the Tab sequence. Associated hidden tabpanels have labels and keyboard focus targets.
- Left/Right cycle views; Home/End select first/last; vertical keys remain available for scrolling. Clicking the active view remains a no-op. Directional view transition uses the existing motion preference and a guarded Web Animations API call; no timers delay usability.
- Unified surface highlights, spacing and orbital depth. Decorative light movement and star glow pause offscreen. The budget progress arc does not rotate as decoration. No additional libraries or financial computations.
- Browser: mouse switching, keyboard arrows/Home/End, focus and hidden-panel states verified. At measured 360px, tabs are about 48px high and 136px wide with no clipped labels. Tablet and wide layouts showed no page overflow. Light theme selection remained readable. Explicit reduced motion produced 0s thumb transition and no planet/star animations; restored prior full-motion preference and automatic theme after checks.
- Full dictionary audit found 243 missing translations (Spanish-tax and Swiss-invoice interfaces). Added direct translations in DE/FR/ES/NL/PT where missing, preserving dynamic values and existing calculation behavior. All 1,574 keys now exist directly in each of IT/EN/DE/FR/ES/NL/PT. Added strict coverage tests that inspect source dictionaries rather than relying on t() fallback. Updated an old test that deliberately required English fallback for German/French Spanish-tax screens.
- Added the missing Dutch option to the QA language selector (already supported by the language detector). This audit certifies dictionary-key coverage, not that every hard-coded string or generated response elsewhere in the application has been visually reviewed.
- 177 focused tests pass; main.js syntax check passes; git diff --check passes. Production build attempted and blocked at Vite config bundling: esbuild child-process spawn EPERM. No production/native release certification and no push in this follow-up.


## Verifica conclusiva: ingresso e saldi condivisi

La revisione cumulativa, i casi di prova, i risultati e i blocchi di rilascio sono raccolti in [release-review-2026-09-11.md](release-review-2026-09-11.md). Questa sezione aggiorna le precedenti note intermedie: primo suggerimento + corretto per la mappa mensile del Vault; card split e dettagli verificati con gruppo USD sintetico, contestazione, credito e risoluzione; nuovo riepilogo onboarding a 320×568 senza scroll interno.

Questa nota intermedia è superata dalla verifica successiva: **4.767 test passati, 310/310 file, zero skip**, inclusi i quattro test di fuso con subprocess reali. **Build di produzione portabile completata** con esbuild-wasm della stessa versione. Il percorso nativo con pipe rimane limitato dall’ambiente Windows. Nessuna certificazione nativa o di pubblicazione negli store.

## Split e avvio: verifica finale aggiuntiva

- Dati sintetici su `split-ten-qa.localhost` e `split-receiver-qa.localhost`: dieci persone, due Marco, anticipi 120 + 45,50 + 34,50 = 200 euro. Quota personale 20 euro; saldi 100 / 25,50 / 14,50 euro per i tre pagatori. Otto rimborsi invece di ventisette rapporti originari.
- Quote personalizzate: dieci valori da 20 euro, somma validata e salvataggio abilitato. Il controllo puro verifica anche differenze di un centesimo e importi non validi. Il browser ha verificato che “parole” non sostituisce il precedente 120: input ripristinato, errore visibile, `inputmode=decimal` e pattern decimale presenti.
- Corretto un difetto emerso nella prova: aggiungere il nome su blur poteva spostare i controlli durante il clic. Aggiunta ora esplicita con pulsante o Invio; dieci nomi confermati dopo il fix.
- Richiesta di rimborso: anteprima modificabile, corrispondenza del testo con il parametro WhatsApp e conferma dopo copia riuscita. Nessun messaggio inviato e nessun pagamento reale. La condivisione di sistema richiede ancora prove native.
- Link compresso aperto su un’origine distinta: scelta Giulia, ingresso senza onboarding finanziario e saldo corretto di 20 euro. Omonimi e dieci membri conservati. Test automatico equivalente in USD conserva valuta, centesimi e identità.
- Riepilogo gruppo: saldo personale e azione prima dei dettagli; altri rimborsi, persone e spese espandibili. Apertura/chiusura dettagli e preparazione messaggio verificate. Screenshot mobile a 390 px; nessun overflow misurato a 320, 390 e 768 px nei percorsi provati. Questo non certifica ogni combinazione fisica di touch/tastiera.
- Scorciatoia Scadenze: apre il pannello in modale; Aggiungi scadenza apre l’editor; il nodo originale torna in Dashboard e resta una sola copia dell’ID. Obiettivi apre il pannello vivo in modale con un solo ID.
- Reload: rimosso il compilatore Tailwind via CDN, utility statiche e fogli UI caricati nell’head. Il contenuto provvisorio della Dashboard resta nascosto fino al primo render. Verificato lo stato finale `app-ready`, schermata di avvio nascosta e app visibile. Non è una misura strumentale del tempo di avvio a ogni velocità di rete.
- Tablet: `#tablet-fab` era reso relativo da `.pulsa-anello`. Ora è esplicitamente fixed. A 768×1024: top 936, bottom 1000, dimensione 64 px; a 1024×768: top 680, bottom 744. Posizione invariata dopo scroll verticale a 2826 px. Apertura dell’inserimento da tastiera verificata.
- Chrome/CDP ha avuto alcuni timeout di dispatch mouse; le prove annotate come tastiera hanno usato Invio. Non sono prove di touch fisico iOS/Android.

Ricerca e opportunità: [confronto split](split-market-and-ux-2026-09-11.md). Main aggiornato e punti d’innesto: [handoff](integration-handoff-2026-09-11.md).

## Final split and tablet follow-up
- Browser: nine additions in sequence produced ten distinct participants, including two Marcos; focus remained on the new-person field after every addition.
- 200 EUR, paid 120 / 45.50 / 34.50, custom shares 20 each: save enabled; changing one share to 20.01 disabled save. Returning from the repayment composer preserved all ten values. Saving showed a 20 EUR personal expense and 100 EUR receivable on the isolated QA Dashboard.
- Mode redesign: 10 EUR / three people displayed 3.33–3.34 per person. First custom selection preserved the engine's exact 3.33 / 3.34 / 3.33 allocation. Edited 2 / 3 / 5 shares survived equal/custom switching.
- The new choice controls and modal had no horizontal overflow at 320, 390, 768, 1024 and 1366 CSS px. Portrait tablet FAB measured fixed at top 936 / bottom 1000 in a 768×1024 viewport. Prior landscape/scroll checks remain recorded above.
- Numeric keyboard request and decimal validation are web controls; this does not attest a physical iOS/Android keyboard test. No external message or payment was sent.
- All new choice/help/back copy supplied in seven languages. QA synthetic data remains separate from the user's main localhost origin.
