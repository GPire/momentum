# Descrizione pronta per la PR di Momentum

**Titolo proposto:** Semplifica Dashboard, Analisi, Vault e split con controlli adattivi e verifiche riproducibili

## Problema e risultato

Le schermate mostravano troppi elementi insieme, alcune scorciatoie portavano a un'altra pagina invece dell'editor e lo split rendeva difficile distinguere anticipi, quote e rimborsi. Il branch raggruppa i contenuti, apre direttamente i controlli pertinenti e rende esplicito il risultato delle scelte, mantenendo il tema grafico di Momentum e le preferenze di accessibilità.

Esempio: un conto da 60 € per tre persone mostra subito 20 € a persona. Scegliendo di personalizzare le quote, i campi partono da 20/20/20: si modificano solo le differenze. Il conto di chi ha anticipato resta separato; il motore calcola i rimborsi, non effettua pagamenti.

## Cosa comprende

1. **Dashboard:** calendario, disponibilità giornaliera e periodo settimanale/mensile nella stessa superficie; riepiloghi raggruppati, azioni rapide pertinenti, editor raggiungibili senza navigazioni intermedie. Corretto il pulsante + tablet, fisso in basso a destra.
2. **Analisi e Vault:** gerarchie per argomento, moduli e controlli coerenti, preferenze di complessità contestuali, tema automatico o esplicito, navigazione e scroll. Si riutilizzano i nodi vivi e gli editor esistenti.
3. **Primo avvio:** riepilogo profilo più semplice, preferenze modificabili nello stesso flusso, budget facoltativo non stimato automaticamente, suggerimento iniziale del +, percorso diretto per gli inviti split.
4. **Split:** partecipanti identificati per ID anche con nomi uguali, validazione degli importi, tastiera decimale richiesta sui dispositivi touch, centesimi esatti con più pagatori, riepilogo personale distinto dagli altri rimborsi. Le quote personalizzate sopravvivono al cambio modalità.
5. **Richieste di rimborso:** messaggio modificabile, firma Momentum, link al contenuto del gruppo compresso e valuta coerente. Copia, WhatsApp e condivisione di sistema restano azioni dell'utente. È possibile tornare alla bozza rapida senza reinserire le quote.
6. **Design e interazione:** controlli illustrati, gerarchia dei numeri, placeholder più brevi, microtransizioni e profondità CSS, target touch e rispetto del movimento ridotto. Corretto il focus differito che interferiva con i campi aggiornati.
7. **Avvio e strumenti:** utility CSS precompilate al posto della generazione Tailwind da CDN, protezione dall'interfaccia parzialmente inizializzata, test seriali isolati e build portabile per il blocco Windows delle pipe.
8. **Lingue e consegna:** nuove stringhe in IT/EN/DE/FR/ES/NL/PT, nove argomenti nelle novità, controlli dei dizionari, documentazione dei contratti, fonti di mercato e verifiche.

L'elenco completo dei file e delle responsabilità è nel [manifesto del push](push-file-manifest-2026-09-11.md). La [revisione funzionale](release-review-2026-09-11.md) e la [cronologia QA](qa-clarity-2026-09-11.md) dettagliano le singole schermate e prove.

## Stato Git verificato e integrazione

- Branch da pubblicare: `codex/public-release-foundation`.
- Ultimo remoto osservato: `91f2cd806d6c0c8bdcf821693994982929418ded`.
- Codice locale pronto per revisione: `eb863386efecb9cf11d5021933a79fb7fc148879`, che include `52b8edd`.
- Main osservato: `d92a5dcd9a5a9dae7649ce4c74fd6e836adb124f`.
- La successiva revisione di sola documentazione accompagna questi riferimenti; usare sempre la punta effettiva del branch per il merge.
- **La simulazione rileva 13 file in conflitto. Questo pacchetto è pronto per l'integrazione guidata, non è un merge automatico già collaudato.** Nessun merge su main o deploy è stato eseguito.

Seguire la [mappa dei conflitti e dei contratti](integration-handoff-2026-09-11.md). Conservare le correzioni recenti di main per onboarding, scoperta fiscale per Paese, Cassa Unica, mercati, fatture e scadenze. Evitare `ours`/`theirs` sull'intero `main.js`. I file che si uniscono automaticamente richiedono comunque una verifica funzionale: assenza di conflitti testuali non significa compatibilità completa.

Ordine consigliato:

1. Partire da main aggiornato in un branch di integrazione; registrare entrambi gli SHA.
2. Riconciliare moduli già condivisi e relativi test (recupero, onboarding, telemetria, importazione, installazione).
3. Integrare helper e stili della UI; collegare i nuovi controlli ai modelli di main, preservando ID e contratti.
4. Risolvere `index.html`, `main.js` e dizionari per sezione, quindi rigenerare le utility CSS.
5. Eseguire test, build e prove utente sul commit risultante prima di approvare il merge.

## Verifiche eseguite

- Suite completa: **4.767 test, 310 file, zero fallimenti o skip**, con un processo isolato per file. Inclusi i quattro test di fuso con sottoprocessi reali.
- Dopo le ultime modifiche UI: **40 test mirati passati**, controllo sintattico e build di produzione portabile completata. La suite completa precede gli ultimi ritocchi UI; non è una suite eseguita sul futuro merge.
- Browser: dieci partecipanti con omonimi, più anticipi, errore di un centesimo bloccato, conservazione quote, richiesta e ritorno, invito ricevuto, scenari di contestazione, finestre annidate e dimensioni responsive. Le prove usano dati sintetici separati dai dati dell'utente.
- [Risultati per file e provenienza dei log](release-validation-2026-09-11.json).

Comandi e prerequisiti Node 24 sono nell'handoff. La build portabile usa esbuild-wasm della stessa versione del compilatore Vite; non attesta che il comando nativo funzioni nell'ambiente Windows limitato.

## Controlli richiesti prima del rilascio

- Test e build standard in CI sul commit integrato; compilazione Capacitor e prove fisiche iOS/Android, safe area, tastiere, ripresa, importazione e condivisione.
- Revisione accessibilità con lettori di schermo, zoom/contrasto; completamento dei testi legacy ancora fuori dai dizionari.
- Verifica del dominio pubblico dei link, prestazioni su rete lenta, dipendenze CDN e bundle grandi. Il link compresso conserva dati del gruppo: non è un URL breve a lunghezza fissa né una cifratura.
- Nei percorsi che dividono una transazione già importata, verificare la riconciliazione per evitare doppio conteggio della quota personale; la revisione rapida non certifica tutti i collegamenti con l'importazione.
- Confermare regole Free/Pro aggiornate in main e coerenza delle descrizioni. Open banking e HealthKit restano documenti di preparazione, non funzioni operative introdotte qui.

## Pubblicazione

I tentativi di push del codice hanno incontrato un blocco di autenticazione in scrittura (shell del gestore credenziali Windows e connettore GitHub senza autenticazione valida). La verifica remota precedente a questo documento è ancora a `91f2cd8`. Quando l'accesso sarà disponibile, pubblicare l'intero branch e verificare che lo SHA remoto coincida con quello locale:

```sh
git push origin codex/public-release-foundation
git rev-parse codex/public-release-foundation
git ls-remote origin refs/heads/codex/public-release-foundation
```

Il documento è utilizzabile come corpo della PR; questa revisione non dichiara che la PR sia già stata aperta o che il branch sia già pubblicato.
