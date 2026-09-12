# Aggiornamento pronto localmente

## Comportamento nell'app
- Il cambio categoria e il relativo salvataggio gestiscono gli identificativi testuali dei movimenti importati; anche il comando di eliminazione serializza l'ID conservandone il tipo.
- Gli attributi HTML degli ID nella lista sono escapati.
- Novità `2026-09-12.1`: correzione movimenti importati, comando Rinomina più riconoscibile e date locali nelle scadenze. Due voci tradotte in tutte le sette lingue, senza modificare le release già viste.
- Non vengono annunciate integrazioni open banking, nuovi pesi neurali o dataset sperimentali come servizi disponibili.

## Verifiche
Suite completa: 333/333 file passati. Build portable: completata in 21,75 secondi, con gli avvisi preesistenti sulla dimensione dei bundle. `git diff --check` superato.

Prova nel browser sull'origine isolata 4182: importazione del backup con UUID, apertura del cambio categoria, scelta Abbonamenti, ricaricamento e conferma di una sola transazione con categoria aggiornata e importo/data invariati. Nessun dato personale modificato. Eliminazione non confermata nel browser; non dichiarare prova completa di quel percorso. La precedente origine di test conservava una versione in cache: usata una nuova origine per verificare la build appena prodotta.

Il server di fixture accetta MOMENTUM_TEST_PORT per separare gli archivi e le cache delle prove. Non è incluso nel prodotto distribuito.

## Pubblicazione
Il controllo remoto iniziale `git fetch origin` è fallito perché la rete dell'ambiente passa da un proxy irraggiungibile su 127.0.0.1:9. Nessun token richiesto o modificato. Eseguire un push normale, mai forzato; se il remoto è avanzato, recuperare e verificare prima di integrare. Il riferimento origin/main locale non certifica lo stato attuale di GitHub.
