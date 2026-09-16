# Limiti giornalieri e motivi delle eccezioni

I limiti giornalieri per categoria sommano gli importi in centesimi per data
registrata della spesa (prefisso YYYY-MM-DD). Le valute differenti producono
un avviso e non vengono convertite. Superamenti segnalati su tutte le spese
del gruppo; nessuna riduzione automatica del rimborso.

Il motivo facoltativo dell'eccezione, massimo 500 caratteri, è per resoconto,
non per singola violazione. È incluso nella policy della trasferta e quindi
nell'impronta da approvare. Attraversa archivio completo e link di revisione,
ed è mostrato al responsabile come dichiarazione del dipendente, non assenso.

La casella delle regole predefinite salva tripPolicyTemplate nel Vault locale.
Le nuove trasferte ricevono una copia indipendente con identificativo della
versione; le esistenti restano invariate. I motivi delle eccezioni non vengono
copiati. La normale persistenza del Vault conserva il nuovo campo senza
migrazione. Non è stata aggiunta una distribuzione centralizzata tra dipendenti.

41 test mirati passati e build portable completata. Il tentativo di aprire
la fixture locale in Chrome è stato bloccato da ERR_BLOCKED_BY_CLIENT:
non dichiarare completato il collaudo visivo di questi nuovi controlli.

Restano policy aziendali centralizzate con identità e ruoli verificati,
assegnazione per azienda/dipendente, revoca, eccezioni per violazione e
controllo autorizzazioni. Il modello locale non sostituisce tale servizio.
