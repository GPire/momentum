# Command Center e movimenti — 12 settembre 2026

Questa integrazione risponde ai feedback su tastiera mobile, importi sovrapposti,
lista troppo lunga e modifica delle categorie. I commit fino a `06f778f` sono
stati pubblicati nella PR #2 e nell'anteprima Cloudflare
https://ee54e391.momentum-finance.pages.dev. Test/build, Android e iOS Simulator
sono passati in CI. La pubblicazione di un'anteprima non implica il merge:
lo stato aggiornato è in https://github.com/GPire/momentum/pull/2.

- Dashboard: 8 movimenti iniziali, altri 8 per tocco, contatore e Mostra meno.
  Il cambio mese riparte da 8; totali del mese e del giorno usano tutti i dati,
  anche quando le righe successive non sono ancora visualizzate.
- Touch: il Command Center apre prima il foglio; la tastiera numerica si apre
  toccando l'importo. Su mouse/tastiera resta il focus immediato.
- Foglio e pulsanti condividono altezza e spostamento del VisualViewport.
  Rimossa la selezione CSS generica `div.flex` che collocava il riepilogo budget
  nella stessa riga dell'importo. Importi lunghi riducono il font; i messaggi
  vanno a capo senza spingere le cifre fuori dal contenitore.
- Scegli una categoria, poi Modifica categoria: nome, icona e colore si
  modificano nel Command Center, mantenendo la bozza della transazione.
  Gli override usano `customCategories` e il merge esistente, conservando ID,
  tipo e hash delle transazioni. Le categorie standard mantengono le traduzioni
  finché non si assegna un nome personale, mostrato poi così come scelto.
- Dieci icone SVG aggiunte: parcheggio, assicurazioni, scuola, bambini,
  spesa alimentare, consegne, donazioni, manutenzione, abbigliamento, tecnologia.
  Il selettore mostra solo le icone: il nome resta una scelta dell'utente e non
  viene compilato dall'icona. Le etichette tradotte restano disponibili a screen
  reader e tooltip. Nessuna aggiunta automatica alla lista dell'utente. Controlli
  su nomi vuoti, duplicati, lunghezza e caratteri di markup.
- Ogni riga della lista mostra ora un controllo esplicito “Cambia categoria”,
  oltre all'icona interattiva. La correzione mantiene importo, descrizione, data,
  ID e hash, e alimenta il motore di apprendimento già esistente.
- Tutte le nuove etichette sono in IT, EN, DE, FR, ES, NL e PT.

Per investitori e trader, il flusso condiviso delle notizie consolida lo stesso
articolo ripetuto con URL di tracciamento o titolo equivalente. Una notizia viene
quindi contata una sola volta nel sentiment; fonti distinte sono conservate e
mostrate come corroborazione. Il confronto è conservativo: eventi soltanto simili
non vengono fusi. I link sono limitati ai protocolli HTTP/HTTPS.

Le aree proposte rispondono a spese comuni presenti anche nei
[modelli pubblici YNAB](https://www.ynab.com/templates/non-monthly-expenses),
non a una classifica misurata delle richieste degli utenti Momentum.
La gestione della tastiera segue la distinzione documentata fra viewport
visivo e di layout: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Verifica locale: tutti i test in 323 file passati, zero fallimenti o skip; build
portabile completata. Il runner standard con sottoprocessi resta bloccato da
EPERM su questo Windows; il runner seriale mantiene processi separati per file.
Chrome headless locale non parte per Access denied; CUA non inizializza i suoi
file runtime. Nessuna sicurezza del browser è stata disattivata.

`scripts/command-touch-smoke.mjs` e la CI dedicata eseguono i percorsi con
archivi sintetici isolati a 393, 430, 768, 1024 e 1366 pixel, producendo screenshot.
Lo smoke verifica anche che l'azione di modifica sia visibile e che il selettore
icone non mostri nomi. Può usare Playwright, un Chrome/Edge locale o una sessione
CDP; su questo host l'avvio del browser è fermato da `spawn EPERM`. La prima CI
si è fermata prima delle interazioni: il test cercava `window.openTransactionModal`,
che è una funzione interna al modulo. `3f92f1a` usa il pulsante reale e un archivio
di utente già informato sulle novità, senza disabilitare controlli di layout o dati.
La simulazione dell'area della tastiera
non certifica la tastiera fisica iOS, il focus Safari o tutti gli iPhone.
