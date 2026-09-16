# Risposte gateway e recupero invii — 2026-09-14

I gateway di autenticazione possono rispondere in HTML. Il client interpretava
il corpo come JSON prima di controllare lo stato e segnalava un problema di
rete anche per 401/403, 413 e 404 nella lettura dello stato.

Ora invio e recupero distinguono accesso negato/scaduto; l'invio riconosce 413
senza effettuare una richiesta di recupero inutile. La lettura esito controlla
401/403/404 prima del JSON. Le risposte positive malformate restano errori:
non diventano ricevute valide. Recuperare una ricevuta non significa approvare.
Messaggi esistenti in sette lingue; nessuna modifica a UI, archivio o permessi.

Due regressioni riprodotte prima della correzione. Dopo: 189 test passati tra
trasferte, servizio aziendale e confine bundle. Non è un collaudo cloud reale
né un test della tastiera nativa. Nessun nuovo provider attivato.

Restano prioritari accesso aziendale effettivo con ritorno alla bozza, recupero
passkey, consegna email, collaudo cloud e dispositivi fisici; i connettori esterni
richiedono account autorizzati per verificarne invio e ricezione reali.
