# Collegamento policy e trasferte

Lo spazio aziendale propone la creazione di una trasferta dopo aver caricato
la policy. Il link verso la PWA conserva il company ID; questo non conferisce
autorizzazione: il salvataggio richiede una risposta valida dal servizio sullo
stesso origin, senza redirect e senza fallback a regole locali.

La trasferta conserva companyPolicy (azienda, nome e versione) e una copia
indipendente delle regole. L'impronta del resoconto include il collegamento
aziendale. I campi dei limiti diventano non modificabili nella UI; rimane
modificabile il motivo dell'eccezione. Un file locale alterato può comunque
cambiare i dati: questo non sostituisce la rivalidazione server all'invio.

15 test del servizio/collegamento e 4 test dell'impronta superati. Build
portable riuscita. Chrome con endpoint sintetico ha creato la trasferta da
un nome precompilato dalla fixture; nessuna spesa personale caricata o inviata.
Trovato e corretto anche l'accesso al suggerimento policy assente quando la
trasferta non contiene ancora spese.

Restano: distribuzione del servizio, login reale, percorso completo del primo
onboarding, revoca/rivalidazione alla presentazione del resoconto, approvazione
server e test fisici. Non dichiarare il flusso aziendale completamente operativo.
