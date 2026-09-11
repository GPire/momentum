# Split: confronto verificato e direzione di prodotto

Ricerca dell’11 settembre 2026. Fonti ufficiali; disponibilità e condizioni possono cambiare per paese. Non è un test delle app concorrenti su dispositivi fisici e non attribuisce date di rilascio a pagine prive di data.

## Cosa offrono già gli altri

| Prodotto | Funzioni documentate | Conseguenza per Momentum |
|---|---|---|
| Revolut Group Bills | Gruppi, aggiunta di spese, divisione e invito anche di persone senza conto Revolut. | Il solo invito via link non è una differenza esclusiva. Serve un percorso più chiaro dal conto alla propria quota. |
| Tricount | Quote diverse, più valute, richieste di pagamento, foto, offline, statistiche e importazione da Splitwise. | Non basta aggiungere queste voci a un elenco di funzioni: conta quanto facilmente si arriva a una divisione corretta. |

Fonti: [Revolut: Group Bills](https://help.revolut.com/help/transfers/group-bills/question-group-bills/), [Tricount: funzioni](https://tricount.com/en-us/expense-tracker-features).

PayPal.Me permette di includere importo e codice valuta nell’URL. Non significa che Momentum esegua il pagamento, che ogni valuta sia disponibile in ogni paese, o che un clic attesti un rimborso ricevuto. [Documentazione PayPal.Me](https://securepayments.paypal.com/uk/cshelp/article/what-is-paypalme-help432).

## Cosa è stato implementato in questo branch

- **Una quota verificabile:** il form con più pagatori conserva sia gli anticipi sia le quote scelte, lavorando in centesimi. Test con dieci persone, più pagatori e 220 combinazioni di piccoli importi.
- **Omonimi distinti:** ID stabili e il disambiguatore già esistente; Marco #1 e Marco #2 non si fondono. I suggerimenti basati sui nomi si astengono nei casi ambigui. Nessuna foto obbligatoria.
- **Due momenti su mobile:** persone/importi, poi divisione. Su desktop con puntatore le due parti sono affiancate. La digitazione aggiorna i risultati senza ricreare gli input.
- **Conti personali in primo piano:** nel gruppo si vedono prima il saldo e i rimborsi che coinvolgono chi sta usando il dispositivo. Altri rimborsi, persone e spese restano apribili con controlli disegnati per Momentum.
- **Richiesta e messaggio da rivedere:** anteprima modificabile, WhatsApp, condivisione di sistema dove disponibile e copia con gestione dell’esito. Il testo conserva la valuta del gruppo.
- **Un motivo utile per aprire Momentum:** firma discreta e link alla divisione. Il link completo del rimborso è compresso; conserva le spese necessarie a spiegare i saldi e funziona senza una successiva connessione fra i dispositivi. Il contenuto sta nel fragment dell’URL. Compressione non significa cifratura.
- **Controllo dell’utente:** il suggerimento di aspettare un prossimo accredito non rimuove il pulsante per preparare una richiesta. Nessun messaggio o pagamento viene inviato automaticamente.

Il link compresso del caso browser con dieci persone e tre anticipi misurava 984 caratteri. È più corto del vecchio payload, ma non è un link breve a lunghezza fissa. Nell’anteprima si mostra un collegamento leggibile con il dominio reale; nel testo condiviso resta l’URL completo. Il dominio localhost delle prove non va distribuito a persone su altri computer.

## Prossime differenze da costruire, senza duplicare il motore

1. **Dal movimento importato alla quota personale:** collegare ID della transazione, gruppo e quota, evitando di conteggiare sia l’anticipo intero sia la propria parte. Richiede un contratto dati e test di riconciliazione; il restyling non certifica questo ciclo completo.
2. **Identità comprensibili:** permettere un nome preferito e un avatar facoltativo associati all’ID del partecipante. Non collegare persone fra gruppi soltanto perché hanno lo stesso nome. Il segnaposto storico “Io” non deve essere interpretato come nome del destinatario.
3. **Scontrino assegnato per voci:** rendere più immediato il motore `item-split` già presente, con anteprima, esclusioni, mancia e correzione prima del salvataggio. Gli importi e la mancia ora usano il controllo decimale condiviso.
4. **Rimborso effettivamente confermato:** distinguere messaggio preparato, richiesta condivisa e pagamento registrato/verificato. Aprire PayPal o WhatsApp non conferma un pagamento.
5. **Condivisione ancora più breve:** valutare un servizio opzionale di snapshot cifrati con identificatore casuale, scadenza e cancellazione. Non introdotto qui: comporterebbe costi, infrastruttura e nuovi impegni sulla gestione dei dati.
6. **Comprensione misurata:** osservare completamento, errori, ritorni al form e abbandoni per dispositivo. Valutare con persone reali se capiscono quota, anticipo e rimborso. Non confondere visite, installazioni e completamenti di una divisione; nessun obiettivo di conversione è un risultato già raggiunto.

La direzione proposta è ridurre errori e incertezza, rendendo la funzione piacevole da usare. Non affermiamo leadership dimostrata, esclusività non verificata o percentuali garantite.
