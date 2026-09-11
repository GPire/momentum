> Aggiornamento successivo: main d92a5dc è stato integrato e i casi limite corretti. Esito corrente, preservazione dei dati e 4.839 test / 316 file sono in [merge-validation-2026-09-11.md](merge-validation-2026-09-11.md). I riferimenti e i blocchi di autenticazione descritti sotto documentano la fase precedente.

# Revisione locale Momentum — 11 settembre 2026

Revisione cumulativa sul branch `codex/public-release-foundation`, a partire da `52b8edd`, consolidata nel codice `eb86338`. Questo documento accompagna il codice destinato all’integrazione; non attesta un deploy o un merge su main. Le revisioni e la pubblicazione del branch sono verificabili dalla cronologia Git. Main è avanzato a `d92a5dc`: [handoff di integrazione con i 13 conflitti rilevati](integration-handoff-2026-09-11.md). Per il passaggio completo leggere la [descrizione pronta per la PR](merge-request-2026-09-11.md), il [manifesto dei file](push-file-manifest-2026-09-11.md) e i [risultati della suite](release-validation-2026-09-11.json).

## Dashboard e calendario

- Disponibilità giornaliera, settimana e mese sono raccolti nella superficie «Giorno per giorno». Sono riutilizzati i nodi del calendario e della previsione, senza una seconda copia dei dati finanziari.
- Calendario e azioni rapide restano visibili. Riepilogo mensile, risparmi e obiettivi hanno gruppi espandibili. Le scorciatoie seguono interessi espliciti e lavoro già presente: divisione spese, scadenze, obiettivi, trasferte e investimenti dove pertinenti.
- Settimana/Mese è un selettore con stato visibile, pannelli esclusivi, navigazione da tastiera e microtransizione. Il cambio mese parte dal giorno 1, per non saltare mesi quando la data precedente era il 31.
- Gli anelli hanno un significato numerico: budget utilizzato e posizione nel periodo. Il centro mostra il giorno, senza l'icona del calendario rifiutata nel feedback. Il progresso finanziario non ruota come decorazione. Il 100% del budget è un limite di spesa, non un traguardo da festeggiare. Senza un budget positivo non viene inventata una percentuale.
- Previsioni e intervalli restano stime. Il grafico usa i campioni del modello, senza interpolazioni decorative che possano creare oscillazioni inesistenti. Esplorazione giorno per giorno con valore, data e marcatore collegati.

## Primo avvio

- La hero resta al primo accesso ordinario. Un profilo già configurato entra nell'app; un invito valido apre il percorso della divisione senza le domande finanziarie complete.
- «Il tuo Momentum» sostituisce il precedente riepilogo finale con dropdown. Due righe sintetiche riassumono l'adattamento; «Le tue preferenze» apre una vista dedicata nello stesso passo, con ritorno e gestione del focus.
- «Semplice» e «Approfondita» hanno anteprime visive e stato selezionato. Cambiano la complessità dell'interfaccia, non attivano un abbonamento Pro.
- «Apri Momentum» resta nel footer. Budget facoltativo, nessun budget inventato dalla profilazione e nessuna seconda richiesta sul riepilogo finale. Anche un obiettivo può esistere senza cifra.
- Un solo suggerimento iniziale indica il pulsante «+»: aggiunta di spese o entrate, a mano o a voce. Chiusura esplicita da 44 px; non si ripete dopo la visualizzazione, non compare nel percorso da invito o in presenza di movimenti propri. Non compete con il suggerimento del calendario nella stessa prima apertura.
- Corretto un errore emerso dal browser: il controllo del suggerimento legge ora la mappa mensile del Vault, non presume una lista piatta di transazioni.

## Divisioni, saldi e contestazioni

- «Come dividiamo?» ora usa due scelte illustrate: «Stessa quota per tutti», con cifra per persona, e «Decidi la quota di ciascuno». Le quote modificabili partono dall’allocazione uguale effettiva del motore, compresi i centesimi residui. Tornare alla modalità uguale non cancella le quote personalizzate. Anticipi e contributo personale sono spiegati separatamente.
- Dal messaggio di rimborso del form rapido si può tornare alla divisione senza reinserire i dati. Corretto il focus differito della modale che poteva sottrarre il cursore al nuovo campo persona.
- Ripristinato il posizionamento fisso del «+» tablet in basso a destra: la regola delle animazioni non può più riportarlo nel flusso della pagina.
- La card Dashboard distingue «Da ricevere», «Da pagare», «Da chiarire» e messaggi. Importo principale, nome del gruppo, icona semantica e un'unica azione su tutta la card aprono il gruppo corretto.
- Il totale contestato riguarda le spese del gruppo: la card lo dichiara e non lo presenta come quota personale dovuta. Se esiste anche un saldo non contestato, mostra quel saldo con una nota sulle esclusioni.
- Il promemoria si aggiorna quando si entra nel gruppo, si modifica una spesa o si contesta/risolve una discussione. Il dettaglio non mostra più «nessuno deve niente» quando restano contestazioni aperte.
- Corretta la valuta visualizzata in card, anteprima invito, elenco/dettaglio dei gruppi e conversazione della spesa. La formattazione segue lingua e valuta base del gruppo; non converte importi e non somma valute differenti nella card.
- Il motore di ripartizione e di settlement resta quello esistente. Il promemoria seleziona un gruppo rilevante: non è un aggregatore universale di crediti, prestiti e fatture.
- Corretto il primo ingresso tramite codici compressi `MSPLIT2`: il boot usa lo stesso lettore condiviso dei codici tradizionali.
- Scelta del partecipante con pulsanti da 48 px, selezione accessibile e conferma da 52 px. Dopo la conferma si vede il gruppo. La presentazione delle altre funzioni è un'azione facoltativa.
- La presentazione Free/Pro usa tre righe con icone: spese senza limite giornaliero, scansione scontrino inclusa, più valute nello stesso gruppo. Le analisi avanzate degli investimenti sono distinte. Tolte promesse temporali non misurate dal pulsante di personalizzazione e rese più precise le descrizioni di stime e condivisione.

## Analisi, Vault, moduli e interazione

Il checkout comprende anche le precedenti integrazioni documentate in `qa-clarity-2026-09-11.md`:

- Analisi raggruppata per progetti, comprensione delle spese e mercati. Vault raggruppato per dati, pagamenti, dispositivi, preferenze e approfondimenti. I nodi e le azioni preesistenti sono riutilizzati.
- Preferenze di complessità contestuali in Analisi; nessun salto obbligato in fondo al Vault. Profili e limiti Free/Pro restano applicati dalle logiche esistenti.
- Moduli di importi, categorie, obiettivi, accredito, ricezione rimborsi, scadenze, debiti, trasferte e divisioni con controlli più leggibili, etichette persistenti, placeholder più brevi e adattamento alle larghezze ridotte.
- Il calendario apre l'inserimento con la data selezionata. Le scadenze dichiarate restano distinte dalle ricorrenze stimate; aggiungere una scadenza non registra un addebito.
- Simulazioni con selezione dell'orizzonte e ipotesi più leggibili; dettaglio delle categorie e patrimonio con gerarchia più chiara. Nessuna nuova promessa di rendimento.
- Command Center con comportamento distinto per touch e puntatore; categorie scorrevoli e gestione dei contenitori di scroll. Correzioni per gli ingombri della tastiera e per non ereditare lo scroll della pagina precedente.
- Tema chiaro/scuro/di sistema accessibile anche dalla barra laterale. Preferenze salvate rispettate, vecchio booleano migrato, aggiornamento quando cambia il tema del dispositivo. Numeri nascosti/mostrati senza ritardi decorativi.
- Animazioni di ingresso e pressione, profondità CSS e orbite decorative. Preferenze di movimento ridotto rispettate. Non si aggiungono librerie 3D o animazioni permanenti ai numeri finanziari.

## Lingue e novità

Le nuove stringhe sono presenti in IT, EN, DE, FR, ES, NL e PT. Il controllo dei dizionari verifica le chiavi direttamente, senza confondere il fallback inglese con una traduzione. Sono state completate 243 traduzioni mancanti dei gruppi fiscali e di fatturazione.

La voce novità del **2026-09-11** contiene nove argomenti tradotti, incluso il nuovo percorso split/rimborso. Non prova che la versione sia stata distribuita al pubblico. Il nuovo utente la considera già vista, evitando un secondo tour subito dopo l'onboarding.

Limite ancora aperto: esistono testi italiani preesistenti costruiti direttamente in alcune finestre dei gruppi e in altri flussi. La copertura dei dizionari non equivale alla localizzazione completa di ogni schermata o risposta generata.

## Prove effettuate

| Verifica | Risultato e limite |
|---|---|
| Suite completa Node 24 | **4.767 test passati in 310/310 file**, nessun fallimento, esclusione o skip; `test:serial` mantiene un processo separato per ogni file |
| Isolamento | Vault, Vault bulk e pianificatore inclusi nella suite completa, senza mescolare i mock globali |
| Controlli di fuso con sottoprocesso | **Tutti e quattro passati** con processi reali e variabili TZ; output su file temporaneo e URL Windows corretti |
| Sintassi e whitespace | `node --check src/main.js` e `git diff --check` superati |
| Produzione | **Build portabile completata**, esbuild-wasm 0.21.5, stesso target/minificazione Vite. Il comando nativo resta soggetto alla restrizione delle pipe in questo ambiente. Restano avvisi per bundle oltre 500 kB |
| Primo avvio ordinario | Percorso adulto IT senza investimenti e senza reddito dichiarato; percorso minorenne IT e DE; riepilogo, preferenze, ritorno, ingresso in Dashboard |
| Riepilogo responsive | 320×568, 360×640, 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1366×768, 1920×1080; pulsante finale raggiungibile. Ultima correzione a 320×568: contenuto 403/403 px, nessuno scroll interno |
| Suggerimento + | Comparsa dopo l'onboarding, pulsante chiudi 44×44, scomparsa e mancata ripetizione al reload; hero assente al ritorno |
| Invito compresso | Apertura diretta della scelta partecipante su origine pulita; ingresso nel gruppo senza presentazione promozionale automatica |
| Saldi di prova | 28 USD divisi fra Arianna e Luca: Luca deve 14 USD. Contestazione: 28 USD di spese del gruppo da chiarire. Seconda spesa da 56 USD pagata da Luca: 28 USD da ricevere esclusa la contestazione. Risoluzione: 14 USD da ricevere |
| Card responsive | Larghezze effettive 320, 360, 430, 768, 1024, 1366, 1920 px; nessun overflow di pagina o contenuto della card |
| Analisi e Vault | Nessun overflow orizzontale a 320, 768 e 1366 px; cambio sezione riporta lo scroll all'inizio |

I dati delle prove sono sintetici su origini locali separate. Non sono stati inseriti pagamenti o contestazioni nei dati personali dell'utente e non sono stati inviati messaggi ad altre persone. La pagina temporanea del generatore di inviti viene rimossa dopo le prove.

## Cosa manca prima del rilascio

1. Eseguire anche il percorso standard `npm test` / `npm run build` in CI sul commit integrato con main. Suite completa e build portabile locali sono già passate; nessun test di fuso resta escluso.
2. Eseguire il workflow nativo sul commit destinato al rilascio. Il runner `xcode-27` è documentato da GitHub in anteprima pubblica; predisporre il workflow non equivale ad averlo eseguito. [Documentazione runner GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
3. Provare Capacitor su simulatori e dispositivi reali iOS/Android: tastiera, safe area, rotazioni, sospensione, ripresa, importazione e condivisione. Nessuna certificazione per iOS 27, iPhone Duo o App Store/Play Store viene dichiarata da questi test Chrome.
4. Completare la revisione dei testi non ancora nei dizionari e un audit di accessibilità con screen reader/contrasto/zoom. I controlli mirati non sono una certificazione WCAG dell'intera app.
5. Rivedere il diff cumulativo sul branch separato e seguire il contratto di integrazione. La pubblicazione del branch rende il codice recuperabile da un altro computer, ma non sostituisce il merge, il deploy e le prove native.

Open banking e HealthKit hanno documenti di fattibilità/preparazione, non nuove integrazioni operative in questa revisione. Miglioramento della conversione e della comprensione richiede misurazioni e test con persone reali; nessuna percentuale è garantita.
