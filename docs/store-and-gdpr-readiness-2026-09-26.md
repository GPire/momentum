# App Store, Play Store e GDPR — cosa è pronto e cosa manca, 26 settembre 2026

Ogni risposta sotto è ricavata dal codice attuale, non da un modello generico.
Se il codice cambia (nuovi SDK, nuovi dati inviati), queste risposte vanno
riviste nello stesso commit.

## Fatto in questo lavoro

- **Informativa privacy** riscritta in 7 lingue (IT, EN, DE, FR, ES, NL, PT): basi giuridiche per ogni
  trattamento, conservazione, destinatari e trasferimenti, minori, decisioni
  automatizzate, sicurezza, diritti e reclamo al Garante. `public/privacy.html`,
  `public/privacy-en.html`.
- **Termini** riscritti in 7 lingue: piani e prezzi IVA inclusa, rinnovo,
  disdetta, recesso di 14 giorni con rimborso completo, licenza per
  dispositivo, regali, acquisti negli store, foro del consumatore.
- **Conservazione limitata** (GDPR art. 5.1.e): gli identificativi della
  telemetria ora scadono dopo 13 mesi (prima mai); i collegamenti
  abbonamento-dispositivo 13 mesi dopo l'ultimo periodo pagato.
- **Disdetta semplice**: "Gestisci abbonamento" apre il portale clienti Stripe
  (disdetta, carta, fatture). Nota sotto il pagamento su rinnovo, disdetta e
  recesso, nelle 7 lingue.
- **iOS**: `PrivacyInfo.xcprivacy` dell'app (nessun tracciamento, dati
  raccolti dichiarati) registrato nel progetto Xcode; `NSFaceIDUsageDescription`.
- **Android**: permesso `USE_BIOMETRIC`.

## App Store Connect — "App Privacy" (risposte coerenti col codice)

Tracking: **No**. Dati raccolti, tutti **non collegati all'identità**:

| Tipo Apple | Perché | Scopo |
|---|---|---|
| Device ID (identificativo casuale d'installazione) | telemetria | Analytics |
| Product Interaction (funzioni usate, elenco chiuso) | telemetria | Analytics |
| Other Diagnostic Data (diagnostica senza contenuti) | affidabilità | App Functionality |
| Other User Content (testo del feedback, solo se inviato) | feedback | App Functionality |

Dati finanziari, contatti, posizione, foto delle ricevute: restano sul
dispositivo, quindi per Apple **non sono "raccolti"**. Quando si aggiungono
gli acquisti in-app: aggiungere Purchases (App Functionality).

## Google Play — "Data safety"

- Dati raccolti: App activity → App interactions; App info and performance →
  Diagnostics; Device or other IDs (identificativo casuale); Messages/Other
  user-generated content solo per il feedback. Nessuno condiviso con terze
  parti per scopi propri; tutti trattati in modo effimero o con conservazione
  limitata come nell'informativa.
- Dati cifrati in transito: **Sì**. Richiesta di eliminazione: i dati sul
  dispositivo si cancellano dall'app; per telemetria e licenze via email.
- La telemetria è opzionale per l'utente (disattivabile).

## Cosa manca e richiede te

1. **Identità del venditore**: prima di incassare servono Partita IVA e sede
   nelle pagine legali e nel profilo Stripe (D.lgs. 70/2003 art. 7, Codice
   del consumo). Non le ho inserite: non le conosco e non si inventano.
2. **Telemetria attiva di default**: scelta tua del 7 settembre. In Italia e
   UE l'uso di un identificativo salvato sul dispositivo per statistiche può
   richiedere il consenso (art. 122 Codice privacy / ePrivacy) salvo che le
   statistiche siano minimizzate come quelle "tecniche". Da confermare con un
   consulente privacy; se serve, basta invertire il default (codice già
   pronto per l'opt-out).
3. **Prezzi IVA inclusa su Stripe**: configurare i 4 prezzi con
   `tax_behavior: inclusive`, e decidere con il commercialista IVA italiana
   sotto €10.000 di vendite UE o OSS sopra.
4. **Registro dei trattamenti** (art. 30) e **nomine dei responsabili**
   (DPA di Cloudflare, Stripe, Formspree): da firmare/accettare nei rispettivi
   pannelli; i DPA sono standard.
5. **Account sviluppatore Apple (99 $/anno) e Google (25 $)**, chiave di firma
   Android, firma iOS e prove su telefoni reali (Face ID e impronta non si
   possono provare senza un dispositivo).
6. **Export compliance Apple**: l'app usa cifratura standard (XChaCha20,
   AES-GCM, PBKDF2) per proteggere i dati dell'utente; rispondere al
   questionario di App Store Connect con la documentazione Apple
   (https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).
7. **Localizzazione della frase di Face ID**: oggi solo in inglese
   (`Info.plist`); tradurla con `InfoPlist.strings` nelle 7 lingue in Xcode.
8. **Acquisti in-app** (StoreKit 2 e Play Billing): da costruire quando
   esistono gli account; sulle app native il pagamento web è già nascosto.
