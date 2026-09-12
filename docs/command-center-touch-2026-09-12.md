# Command Center e movimenti — 12 settembre 2026

Questa integrazione risponde ai feedback su tastiera mobile, importi sovrapposti,
lista troppo lunga e modifica delle categorie. Si aggiunge alla PR #2 senza
promuovere automaticamente il branch in produzione.

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
  Toccando un'icona con il nome vuoto si propone il suo nome nella lingua attiva.
  Nessuna aggiunta automatica alla lista dell'utente. Controlli su nomi vuoti,
  duplicati, lunghezza e caratteri di markup; selezione accessibile delle icone.
- Tutte le nuove etichette sono in IT, EN, DE, FR, ES, NL e PT.

Le aree proposte rispondono a spese comuni presenti anche nei
[modelli pubblici YNAB](https://www.ynab.com/templates/non-monthly-expenses),
non a una classifica misurata delle richieste degli utenti Momentum.
La gestione della tastiera segue la distinzione documentata fra viewport
visivo e di layout: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Verifica locale: 4.893 test / 322 file passati, zero fallimenti o skip; build
portabile completata. Il runner standard con sottoprocessi resta bloccato da
EPERM su questo Windows; il runner seriale mantiene processi separati per file.
Chrome headless locale non parte per Access denied; CUA non inizializza i suoi
file runtime. Nessuna sicurezza del browser è stata disattivata.

`scripts/command-touch-smoke.mjs` e la CI dedicata eseguono i percorsi con
archivi sintetici isolati a 393, 430, 768, 1024 e 1366 pixel, producendo screenshot.
I risultati della CI vanno letti nella PR; la simulazione dell'area della tastiera
non certifica la tastiera fisica iOS, il focus Safari o tutti gli iPhone.
