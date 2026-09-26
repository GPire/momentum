# Cifratura a riposo dei dati personali — 26 settembre 2026

Richiesta dell'utente: i dati non devono essere leggibili in chiaro da altri,
senza creare conflitti con sync mesh, reti neurali e condivisione risorse.

## Cosa è cifrato

Tutto ciò che contiene dati personali e sta nello storage del browser:
- Vault principale in localStorage (`omega_core_db`) e in IndexedDB (`state/main`);
- log dei movimenti `tx_log` (ogni voce);
- copie di sicurezza `upgrade-2026-09-11` e `before-restore-v1` (IndexedDB e localStorage);
- originali delle fatture (`invoice-documents:*`): in chiaro resta solo
  `manifestSha256`, necessario al confronto atomico fra schede.

Il ponte iOS Safari → PWA (una copia intera del Vault in Cache Storage)
viene cancellato e non più scritto: l'altra istanza non ha la chiave. Resta
il backup file cifrato, già il percorso garantito.

## Come

- `src/core/vault-cipher.js`: XChaCha20-Poly1305 (`@noble/ciphers` 2.4.0,
  audit Cure53), nonce casuale da 24 byte, autenticazione che rifiuta ogni
  manomissione. **Sincrona** di proposito: si applica al confine con lo
  storage e lascia invariate salvataggio, riconciliazione delle tre copie,
  recupero da `tx_log` e sync.
- `src/core/vault-key.js`: chiave casuale di 32 byte conservata solo avvolta,
  da una chiave del dispositivo WebCrypto **non esportabile** (modo
  predefinito, nessuna frizione) oppure da una chiave derivata dal PIN
  (PBKDF2-SHA256, 600.000 iterazioni, OWASP). Cambiare modo riavvolge la
  stessa chiave: nessuna ricifratura dei dati.
- Avvio: la chiave si prepara in `initDurable`, prima di leggere qualunque
  copia. Aggiornamento da una versione in chiaro: prima lettura normale, poi
  riscrittura immediata cifrata di tutte le copie.

## Protezioni contro la perdita dati

- Dati cifrati ma chiave assente o illeggibile: **sola lettura**, `save()`
  non scrive, avviso all'utente. Mai uno stato vuoto salvato sopra l'archivio.
- Una chiave che il deposito non ha confermato non cifra mai nulla.
- "Cancella tutti i dati" distrugge anche la chiave: eventuali residui (per
  esempio IndexedDB bloccato da un'altra scheda) restano illeggibili e un
  segnale in localStorage evita che blocchino il nuovo inizio.

## Nessun conflitto con mesh, reti neurali e condivisione

Sync mesh, archivio privato fra dispositivi, divisione spese e modelli
lavorano sullo stato in memoria (`VaultDAO.state`), già in chiaro dopo lo
sblocco: il trasporto è cifrato da DTLS come prima e ogni dispositivo cifra
con la propria chiave. I pesi della rete neurale (`momentum_real_ai`) sono
solo numeri e restano dove sono. La chiave non viaggia mai.

## Prove

- Test: `vault-cipher` 8, `vault-key` 8, `vault-encryption` 6 (migrazione,
  riavvio, blocco senza chiave, nessuna riscrittura inutile, PIN, primo
  avvio); suite completa verde.
- Dal vivo in Chrome su dati reali in chiaro di sessioni precedenti:
  migrazione con licenza e onboarding conservati, localStorage e IndexedDB
  cifrati (`mv1:`), movimento nuovo cifrato anche nel log, riletto dopo il
  ricaricamento; PIN attivato (0,7 s), schermata di sblocco, PIN sbagliato
  rifiutato, PIN giusto apre; PIN tolto con verifica del PIN attuale; chiave
  rimossa → sola lettura, avviso, dati byte per byte invariati; chiave
  rimessa → tutto intatto.

## Limiti dichiarati

- Modo dispositivo: protegge da chi legge i file del browser, copie del
  profilo e strumenti esterni; non da codice malevolo eseguito dentro l'app
  né da chi usa l'app già aperta. Per questo esiste il PIN.
- PIN: un PIN di sole 6 cifre è indovinabile offline con molta potenza di
  calcolo; lettere o una frase lunga sono molto più sicure.
- Il blocco scatta all'avvio dell'app, non ancora dopo un periodo in
  background.
- Biometria (Face ID, impronta) nell'app Capacitor: da fare con Keychain e
  Keystore nativi.
- Avvisi di prezzo in background del service worker: già non funzionanti
  prima (leggevano il Vault come oggetto mentre è una stringa), ora anche
  cifrato. Da rifare con un archivio dedicato.
- Prova fra due dispositivi fisici non eseguita.
