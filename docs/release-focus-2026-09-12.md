# Chiusura infrastruttura e priorità rilascio — 2026-09-12

## Punto di arresto
Il blocco dataset/SDK è concluso come sviluppo sperimentale per questa fase. Nessun altro connettore o architettura prima di stabilizzare il prodotto. Restano documentate la riconciliazione SEC e le limitazioni dei dataset: non sono requisiti già soddisfatti per un’offerta bancaria.

## Correzione concreta nell’app
Controllo dal browser locale: il Command Center gestisce l’inserimento di 6556655 senza sovrapposizione nel viewport disponibile; non è una prova su tastiera iPhone nativa. Nessun movimento salvato.

In Analisi osservato fondo emergenza 0/1 euro. Il codice usava una soglia artificiale per la barra e trattava le transazioni di investimento come riserva liquida. Corretti card, motore bridge, chat e Q&A: riserva esplicita, astensione per informazioni mancanti, nessun trasferimento concettuale automatico dagli investimenti alla liquidità. La somma destinata al fondo non viene più mostrata come investibile. Messaggio di dati insufficienti disponibile in sette lingue; nessuna dichiarazione di localizzazione completa dei vecchi percorsi.

Verifica UI locale: adesso compare un trattino con spiegazione dei dati mancanti; barra artificiale eliminata. Nessun nuovo campo compilato, nessuna migrazione Vault. La UI non ha ancora un percorso dedicato per confermare il fondo di emergenza: completarlo riusando la gestione liquidità esistente prima di considerare completa la card.

## Coda limitata, per impatto
1. Command Center e transazioni: tastiera reale iPhone, importi, categorie, modifica evidente e scadenze accessibili dal movimento.
2. Split e ricorrenze: casi con molti partecipanti/omonimi, arrotondamenti, modifica date e rimborso; non duplicare motori già presenti.
3. Analisi e Vault: ridurre informazioni senza dati e collegare ogni invito all’azione al punto giusto; completare gestione esplicita della liquidità.
4. Primo avvio/importazione: dati preesistenti, budget opzionale, errori recuperabili, ripristino e versioni precedenti.
5. Verifica rilascio: lingue, viewport, accessibilità, performance, Safari e wrapper Capacitor; CI remota, commit/push/deploy con stato verificato.

Obiettivo: chiudere blocchi verificabili, senza aprire continuamente nuove feature. Le verifiche locali non certificano iPhone, App Store, Play Store o produzione.

## Verifiche eseguite
- Suite completa: 333/333 file superati con esecuzione seriale.
- Dopo l'ultimo passaggio della lingua al motore: Q&A 72/72 test superati.
- Build di produzione portable completata in 17,62 secondi; restano gli avvisi sulle dimensioni dei bundle.
- git diff --check superato; verifica DOM dell'anteprima locale completata.
- Nessuna verifica su iPhone fisico o Safari nativo in questo blocco. Nessun push o deploy incluso.

