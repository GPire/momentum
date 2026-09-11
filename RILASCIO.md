# Rilascio al pubblico

Stato verificato il **2026-09-10**. Ogni affermazione qui è stata controllata
contro il repo reale, non scritta a memoria (stessa regola di `AGENTS.md`).

**Preparazione in corso:** configurare la firma non rende l'app pronta per gli store.
Per correzioni, verifiche e impedimenti ancora aperti, leggere
[lo stato del rilascio](docs/public-release-status.md). Il target Android è ora 36;
la configurazione è aggiornata, ma build native e prove su dispositivi restano da eseguire.
Restano inoltre acquisti nativi, dichiarazioni privacy e verifica dei moduli fiscali.

## Dove siamo già pubblici

Il **web/PWA è già live**: hosting su **Cloudflare Pages**, con un indirizzo
**Netlify** che fa da proxy trasparente (`public/_redirects`) per chi aveva
installato la PWA da lì prima della migrazione — così l'icona e l'origine di
quelle installazioni non si rompono.

`public/_headers` forza `no-store` **sia** per il browser **sia** per l'edge di
Netlify (`Netlify-CDN-Cache-Control`): senza il secondo, l'edge continuava a
servire una versione vecchia per ore, e chi aveva la PWA installata non
riceveva mai gli aggiornamenti. Verificato con `curl -I` il 2026-08-30.

Requisiti PWA già a posto (verificati): `manifest.json` completo con icone
192/512 e maskable, `sw.js`, `version.json` per l'auto-update, `privacy.html`
e `termini.html`.

## Cosa manca per il Play Store

Il piano nel repo (`PIANO_MOMENTUM.md`) mette Android prima di iOS, anche
perché su Android la lettura delle notifiche bancarie è possibile e su iOS no.

### 1. Chiave di firma — la devi creare tu (contiene segreti)

```bash
keytool -genkey -v -keystore ~/momentum-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias momentum
```

Poi crea `android/keystore.properties` (già git-ignored, **non finirà mai nel
repo**):

```properties
storeFile=/percorso/assoluto/momentum-release.jks
storePassword=...
keyAlias=momentum
keyPassword=...
```

`android/app/build.gradle` legge da lì. Se il file non c'è, la build continua
a funzionare e la variante release resta non firmata — nessun errore oscuro
per chi clona il progetto senza segreti.

> **Conserva quel file .jks e le password fuori dal repo, in più di una copia.**
> Se li perdi non puoi più pubblicare aggiornamenti sotto la stessa app: il
> Play Store li rifiuterebbe come firmati da un altro. (Con Play App Signing
> attivo il recupero è possibile ma passa dal supporto Google.)

### 2. Build e caricamento

```bash
npm run build          # PWA in dist/
npx cap sync android   # copia dist/ dentro il guscio Android
cd android && ./gradlew bundleRelease   # genera .aab per il Play Store
```

`versionCode` va aumentato di 1 a **ogni** caricamento (oggi è `1`);
`versionName` è allineato alla versione vera del prodotto (`50.1.0`).

### 3. Scheda del Play Store — cose che servono e che nessuno può generarti

- Account Google Play Developer (25 $ una tantum).
- **Data safety form**: compilare sulla build effettiva, includendo telemetria
  opzionale, provider e SDK. Disattivare la telemetria di default non permette
  automaticamente di dichiarare "nessun dato raccolto". Google richiede di
  considerare anche dati pseudonimi e raccolta opzionale:
  [guida ufficiale](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- Privacy policy raggiungibile da URL pubblico: `privacy.html` è già
  pubblicata sul sito, basta linkarla.
- Screenshot (telefono, minimo 2), icona 512×512 (c'è già in
  `public/icons/icon-512.png`), grafica di intestazione 1024×500.
- Descrizione breve e lunga. Usa il linguaggio del README/manifest, non il
  gergo interno.

### 4. iOS — progetto creato, build e distribuzione da verificare

`capacitor.config.json` è pronto (appId `com.momentum.vault`) e la cartella
`ios/` contiene lo scaffold Capacitor SPM. Il workflow GitHub verifica la build
simulator senza firma; archivio App Store, firma e TestFlight richiedono un Mac,
Xcode e un account Apple Developer. Su iOS la lettura automatica delle notifiche
resta impossibile: il valore lì è distribuzione e notifiche push, non l'import
automatico.

## Correzioni fatte il 2026-09-06, prima di rilasciare

- **`.gitignore` Android**: le righe che escludono i keystore erano
  **commentate** (default dello scaffold). Con quelle spente, la prima chiave
  di firma creata sarebbe finita pubblicata su GitHub, e chiunque avrebbe
  potuto firmare aggiornamenti accettati come tuoi. Ora attive, insieme a
  `keystore.properties`. Verificato che nessun keystore fosse mai stato
  committato: non lo era.
- **Versione Android**: era ferma a `versionName "1.0"` (default dello
  scaffold) mentre il prodotto è alla `50.1.0`.
- **Descrizione nel `manifest.json`**: era "Quantum Financial Ledger &
  Neuro-Friction Engine" — gergo interno, ed è il testo che l'utente legge
  quando installa la PWA. Sostituita con una frase che si capisce.

## Prima di ogni rilascio

```bash
npm test          # dev'essere tutto verde
npm run build     # dev'essere pulita
```

E una passata dal vivo in Chrome sulle schermate toccate: `npm test` non vede
la UI, e in questo progetto i bug visivi veri sono sempre stati trovati così.
