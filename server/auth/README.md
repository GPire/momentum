# Momentum Auth — integrazione locale, non distribuita

Better Auth 1.7.4 e @better-auth/passkey 1.7.4, versioni bloccate nel lockfile.
Modulo separato: non incluso nella PWA, non modifica l'accesso Access/OIDC.
`npm ci --prefix server/auth --ignore-scripts` installa le dipendenze.
Test con Node 24: `node --test --test-isolation=none server/auth/auth.test.js`.
Non eseguire migrazioni su un database Vault, telemetria o aziendale esistente.
Il test usa esclusivamente SQLite in memoria e le migrazioni ufficiali.

createMomentumAuth richiede database, origin, segreto ad alta entropia (almeno
32 caratteri) e due callback di consegna email. Nessuna mail inviata in automatico
durante importazione. HTTPS obbligatorio; HTTP solo localhost/127.0.0.1 con opt-in
esplicito per i test. Nessun segreto predefinito o generato nel repository.
Registrazione email/password verificata; passkey richiede una sessione esistente.
Nessuna assegnazione automatica di aziende o permessi tramite email.
Sessioni server-side; niente cookie cache che ritardi la revoca. Recupero password
revoca le sessioni esistenti. Limiti richieste persistiti sul database.

## Verificato
Handler reale della libreria e SQLite reale: registrazione, verifica email,
rifiuto accesso prima della verifica, sessione valida, origine esterna rifiutata,
generazione challenge passkey, recupero password, sessione precedente revocata,
password precedente rifiutata, rate limit 429, nuovo accesso e logout.
Nel test i link email vengono intercettati in memoria, non spediti.
Il bucket rateLimit sintetico viene svuotato soltanto nel test dopo aver provato
il 429, per verificare il successivo accesso senza attendere il timeout.
Due test passati. Audit npm: zero vulnerabilità note al 14 settembre 2026.
Il messaggio schema mancante iniziale viene dalla libreria prima della migrazione
del database vuoto di test; la migrazione viene poi applicata esplicitamente.

## Da completare prima di attivare
- Interfaccia login/registrazione/recupero multilingue con ritorno alla bozza.
- Cerimonia passkey completa su dispositivi reali, seconda chiave e recupero.
- Binding D1/adattatore di produzione, migrazioni controllate e bundle Worker.
- Ponte sessioni verso i subject aziendali; nessuna fusione implicita degli utenti.
- Consegna email reale e protezioni contro abusi, senza scegliere un provider
  a pagamento automaticamente.
- Configurazione IP/proxy fidati: in assenza usa un bucket condiviso per percorso;
  non distribuire così, provocherebbe blocchi tra utenti. Non fidarsi di header
  IP controllabili dal client.
- Test di revoca/rotazione/segreti, backup e ripristino, metriche e carico reale.

## Costi
Libreria open source senza canone per utente. Nessun servizio a pagamento attivato.
Restano calcolo, database, consegna email e manutenzione. Le callback non sono
un servizio email gratuito già funzionante. Free tier non significa uso illimitato.
Le dipendenze hanno occupato spazio locale; non sono copiate nel bundle della PWA.
