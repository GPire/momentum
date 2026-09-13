# Approvazione legata al resoconto

La richiesta porta un fingerprint SHA-256 dei fatti della trasferta. La risposta
lo restituisce e l'app lo confronta con il resoconto corrente prima di applicarla.
Il confronto copre anche allegati, valuta, periodo, policy e voci offerte; ignora
metadati di invio e ordine degli oggetti. Funziona anche nel riepilogo compresso.

Se il resoconto cambia durante il calcolo asincrono, la conferma viene fermata.
Anche la conferma manuale dell'invio controlla che il link preparato sia attuale.
L'apertura della trasferta rivaluta un'approvazione versionata e la segnala da
rivedere se i dati sono cambiati. I vecchi esiti senza versione vengono rifiutati
nel flusso UI: occorre generare una nuova richiesta. Non cancella dati storici.

Questo lega il contenuto, NON autentica il responsabile: il codice rimane
autocontenuto e non firmato da un'identità aziendale verificata.

Infrastruttura trovata: server/wrangler.toml configura il worker di telemetria.
Non è una casella aziendale né un servizio di identità; non riutilizzarne il KV
per note spese. Nessun tenant aziendale o account API disponibile nel contesto.
Casella condivisa e adapter autenticati richiedono ancora implementazione,
configurazione e collaudo reale. Nessun invio ad aziende è stato effettuato.

Test: round trip, rifiuto versione precedente/assente, cambiamento dei fatti,
invarianza ai metadati di invio e fingerprint nel riepilogo ridotto. Build
portable verificata separatamente. Nessun collaudo su telefoni fisici.
