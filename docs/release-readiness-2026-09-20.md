# Momentum — stato reale e lavoro restante

## Percorso d'ingresso e velocità web — 24 settembre 2026

È stata aggiunta una pagina statica italiana dedicata a dividere una spesa,
con esempio verificabile (72 € fra tre persone), spiegazione delle quote,
contestazioni, condivisione e limiti dei link. Ha HTML leggibile senza
JavaScript, CSS dedicato e leggero, canonical, collegamento dalla landing e
voce nella sitemap. Il pulsante porta all'intento `split`: un utente già
attivato apre la divisione; al primo avvio l'intento resta nell'URL fino alla
fine dell'onboarding, poi viene consumato una volta. Non sostituisce il link
di invito di un gruppo. Tre nuove pietre miliari anonime distinguono ingresso,
salvataggio della divisione e preparazione dell'invito, sempre soggette
all'opt-out della telemetria e senza importi o nomi. Non formano ancora un
funnel di sessione completo: il collector pubblicato deve ricevere la nuova
versione prima che quei contatori siano operativi.

La landing generale ora mostra subito il testo principale anche durante
l'entrata animata. I sei URL di peso Plus Jakarta Sans per ciascun subset
erano byte per byte identici: il CSS dichiara una sola faccia variabile per
subset. Le risorse statiche versionate sul dominio Pages hanno regole di
cache mirate; il vecchio mirror Netlify resta no-store per non lasciare PWA
ferme. Le intestazioni pubbliche dopo il deploy devono essere lette e
confrontate con quelle attese prima di attribuire un beneficio reale alla
cache.

La landing e la pagina split sono indipendenti dal bundle dell'app: caricano
solo risorse statiche dedicate; il chunk da 3,33 MB arriva dopo il passaggio
volontario all'app. La prima pubblicazione della pagina split è stata
verificata online (HTTP 200); il CSS della landing ha il TTL atteso e gli HTML
non ereditano `no-store`. Una regola sovrapposta per `/assets/*` ha invece
prodotto online `no-store, public, immutable`, che equivale a non usare la
cache del browser. La regola è stata separata per JS/CSS: dopo il deploy del
24 settembre la pagina pubblica, il suo script e il CSS rispondono HTTP 200;
script e CSS hanno `public, max-age=604800` e il chunk JS dell'app ha
`public, max-age=31536000, immutable`, senza `no-store` sovrapposto. La pagina split ora racconta con un esempio
interattivo verificabile come una contestazione modifica il saldo (48 € ↔
60 €), espone gli altri comportamenti effettivi del motore e anima lo scroll
con solo ~2 KB di JavaScript dedicato, senza scaricare Three.js o l'app.
Il contenuto resta leggibile senza script e con movimento ridotto; i test
browser hanno verificato il cambio di saldo e layout a 320 e 1440 px.
Sul server locale unificato `127.0.0.1:4179` il CTA è stato cliccato nel
browser da un primo avvio pulito: dopo il caricamento si è aperta la modale
"Dividi una spesa" senza passare dall'onboarding o chiedere un budget. Il
percorso è stato riprovato in Chrome; nello stesso controllo è stata corretta
la dicitura iniziale "1 persone" in tutte le sette lingue. Il
vecchio server `4178` serviva soltanto `public` e non poteva risolvere la
route dell'app: non è un difetto della pagina pubblicata, ma non va più usato
per collaudare l'intero percorso. Test mirati rieseguiti singolarmente con
Node 24: 60/60; build portabile 454 moduli riuscita. Il runner parallelo
continua a restituire `spawn EPERM`, quindi il collaudo non è una suite
completa. Le animazioni sono disattivate sul browser di prova che dichiara
`prefers-reduced-motion: reduce`; resta da verificare l'effetto con movimento
normale su un dispositivo reale. La pagina split è per ora solo in italiano.
Su dispositivi che dichiarano movimento ridotto, la pagina split espone ora
un comando esplicito per attivare i reveal e le orbite; la scelta viene
condivisa con la landing nella sessione. Il contenuto resta visibile anche
quando il movimento è spento. In Chrome locale con preferenza di movimento
ridotto, il comando è stato provato in entrambi i versi: l'orb torna ad animarsi
su richiesta e il progresso della scena cambia durante lo scroll; disattivando
il comando, i testi restano visibili. Resta da verificare il ritmo visivo su un
dispositivo fisico con movimento normale.
Il bundle dell'app resta 3,33 MB minificati (1,13 MB gzip) e richiede un
lavoro separato di suddivisione e una misura sul primo risultato mobile.

Verifiche locali: 59 test mirati superati (marketing, intento, telemetria
client e worker), sintassi del modulo app verificata e build portabile di
produzione riuscita su 454 moduli. La pagina dedicata è stata letta nel
browser locale a 320, 390, 588, 768 e 1440 px senza scorrimento orizzontale;
la testata a 320 px è stata corretta dopo l'ispezione visiva. Il chunk iniziale
dell'app rimane circa 3,33 MB minificati / 1,13 MB gzip: questa modifica
non chiude il blocco di velocità dell'app. PageSpeed Insights ha risposto
con quota esaurita (HTTP 429), quindi LCP/INP/CLS non sono stati misurati
su utenti reali. Mancano prove fisiche del percorso split, inviti e recupero
con rete intermittente; la verifica visiva dell'app locale in una sessione
con movimenti privati è stata fermata dal controllo automatico.

## Verifica archivio prima del prossimo push — 23 settembre 2026

Il controllo di upgrade usa un checkout separato del commit pubblicato
`60efcab` e lo script `scripts/vault-upgrade-gate.mjs`. Ha generato e salvato
con il vecchio codice **514 archivi sintetici** con numeri di movimenti da
zero a 10.000, valute EUR/CHF/USD, lingue e caratteri diversi, ricevute,
fatture, incassi, trasferte, obiettivi, debiti, investimenti, split e dati di
apprendimento. Ogni archivio è stato aperto e risalvato con il codice nuovo;
tutti i campi precedenti sono rimasti uguali. Non sono stati letti archivi di
utenti reali.

La prova ha rivelato e fatto correggere tre rischi di migrazione: quando
`localStorage` era pieno la copia migliore in IndexedDB poteva essere ignorata;
una spesa cancellata poteva ricomparire scegliendo per numero di movimenti;
due copie con spese diverse potevano perdere una delle due serie. Ora gli
snapshot della stessa installazione vengono riconciliati per ID e lapidi di
cancellazione. Se non c'è spazio per il checkpoint, le copie originali non
vengono sovrascritte. Se falliscono sia il salvataggio locale sia quello
durevole, l'app segnala il mancato salvataggio e propone un backup cifrato.

Verifiche: 393 file e 5.529 test superati, test mirati Vault 49/49,
selezione copie 10/10, cronologia novità 10/10, traduzioni 9/9 e gate da
514 casi superati. Build portabile di produzione riuscita. Nessun test
sintetico certifica tutti gli archivi reali
né l'assenza di cancellazioni esterne dei dati del browser. Restano obbligatori
backup recuperabile e collaudo su iPhone/Android reali per un rilascio nativo.

Verifica iniziale del **20 settembre 2026** sul commit `e99884f`, aggiornata
con il controllo archivio del **23 settembre 2026**. Questo è il
documento operativo canonico per decidere cosa può essere rilasciato e cosa
deve ancora essere completato. Una funzione presente nel codice non viene
considerata operativa finché non supera anche la prova indicata nella relativa
sezione.

## Decisione di rilascio

| Perimetro | Stato | Decisione |
| --- | --- | --- |
| Web/PWA personale | Pubblicata e funzionante sul dominio di produzione | Candidata a beta pubblica controllata |
| Landing marketing `/landing/` | Revisione del 24 settembre: HTML in sette lingue, orb WebGL con fallback, scene guidate e miniature delle funzioni. Navigazione responsive, anteprima con quattro scene (inclusa fattura con incasso parziale), controllo dei dati, storia AI, FAQ, chiusura e footer ridisegnati. 405/405 file di test, build portabile (453 moduli), browser e viewport simulati 320/390/768/1024/1440 px senza scorrimento orizzontale del documento | Collaudare touch, Safari iOS e movimento su dispositivi fisici; misurare l'uso reale prima di attribuirle un effetto sulla conversione |
| Android e iOS con Capacitor | Scaffold e configurazione presenti | Non pronti per gli store: mancano firma, build native e prove fisiche |
| Trasferte personali | Acquisizione, allegati, controlli, stampa, export e riconciliazione locale presenti | Utilizzabile; non equivale a un servizio aziendale condiviso |
| Servizio aziende e HR/Finance | Gateway pubblico e logica applicativa presenti | Non operativo finché identità, D1, storage e primo tenant non sono configurati |
| Affiancamento ai gestionali | Mapping, anteprima, export e guide presenti | Non chiamarlo connettore finché non esiste un invio autenticato con ricevuta reale |
| Sostituzione completa dei gestionali | Policy, ruoli, revisioni e approvazioni sviluppati | Pilota non ancora autorizzato; non dichiarare sostituzione globale |
| Fisco IT/CH/ES | Motori, controlli e guide ufficiali presenti con copertura diversa per Paese | Non vendere come servizio fiscale completo senza revisione professionale e prove nazionali |
| Investimenti e modelli Momentum | Analisi, dataset e benchmark interni presenti | Non dichiarare accuratezza o leadership senza valutazione prospettica su dati separati |

Momentum non è ancora dimostrato come punto di riferimento globale per ogni
funzione. L'obiettivo resta valido, ma va sostenuto da risultati ripetibili,
clienti pilota e confronti misurati, non dal numero di funzionalità presenti.

## Quattro percorsi delle trasferte

### 1. Archivio personale

**Presente:** creazione della trasferta, spese e allegati, controlli prima
dell'export, modifica, riepilogo stampabile, valute, spese personali, voci
offerte, rimborsi parziali e riconciliazione con accrediti collegati.

**Da chiudere:** prove fisiche ripetibili su iPhone, Android, tablet e desktop;
misura di tempo, errori e abbandoni con persone estranee al progetto.

**Prova di uscita:** una matrice firmata di dispositivi e scenari nella quale
ogni percorso conserva dati e allegati dopo riavvio, aggiornamento e perdita
temporanea della rete.

### 2. Momentum come piattaforma aziendale unica

**Presente nel codice:** aziende e membership, ruoli, policy versionate,
inviti, inbox condivisa, correzioni, revisioni immutabili, approvazione a uno o
due stadi, verifica dell'impronta esatta, allegati separati, quote, recupero
delle cancellazioni incerte e audit dello storage.

**Pubblicato:** le Pages Functions instradano soltanto `/v1/*` e `/company/*`.
La rotta `/v1/company/readiness` raggiunge il worker in produzione e rifiuta
correttamente una richiesta priva di identità.

**Da chiudere:** configurare identità Access/OIDC, database D1, storage R2 o D1,
origine autorizzata, prima azienda e membership. Eseguire poi il ciclo reale
dipendente → responsabile → Finance, compresa revoca dell'accesso, richiesta di
correzione, nuova revisione, allegato grande e interruzione di rete.

**Prova di uscita:** `GET /v1/company/readiness` autenticato restituisce
`operational: true` e nessun blocker; due identità reali completano il ciclo su
almeno tre famiglie di dispositivi senza accessi incrociati fra tenant.

### 3. Momentum davanti a un gestionale già imposto dall'azienda

**Presente:** normalizzazione, mapping personalizzabile, anteprima, CSV sicuro,
controlli sui campi mancanti, deduplicazione, guide e percorsi manuali per i
gestionali documentati.

**Da chiudere:** OAuth o credenziali di integrazione conservate solo nel
servizio aziendale, idempotenza per ogni invio, ricezione dell'identificativo
remoto, recupero degli invii incerti, aggiornamento di stato e riconciliazione
dei rimborsi. Ogni piattaforma richiede un account autorizzato del cliente.

**Prova di uscita:** un resoconto di prova viene ricevuto in un ambiente
autorizzato del gestionale, restituisce una ricevuta verificabile e un secondo
invio con la stessa chiave non crea duplicati.

### 4. HR/Finance

**Presente:** elenco richieste, filtri, conteggio delle approvazioni pendenti,
ruoli separati, allegati verificati prima dell'approvazione, richiesta di
modifiche motivata, secondo approvatore indipendente, policy per valuta,
diaria, chilometraggio e limiti, più riconciliazione con carta e rimborsi.

**Da chiudere:** tenant cloud reale, onboarding amministratore, notifiche,
stato operativo del rimborso successivo all'approvazione, esportazione verso
contabilità/paghe, assistenza e recupero account. Il codice non deve eseguire o
simulare un pagamento senza un sistema autorizzato.

**Prova di uscita:** un responsabile e Finance lavorano sullo stesso resoconto,
la decisione resta legata alla revisione corretta, una modifica invalida
l'esito precedente e il rimborso viene riconciliato con un accredito reale
autorizzato senza duplicati.

## Lavoro ordinato per impatto

### P0 — necessario per il pilota aziendale

1. Creare D1 e applicare gli script SQL nell'ordine documentato in
   [company-cloud-activation-2026-09-20.md](company-cloud-activation-2026-09-20.md).
2. Configurare un solo driver degli allegati e le relative quote.
3. Configurare Access/OIDC con persone o domini esplicitamente autorizzati;
   non usare regole aperte a qualunque email valida.
4. Creare il primo tenant e associare il `sub` firmato del proprietario.
5. Eseguire il collaudo a due identità e conservare gli esiti della prova.
6. Completare stato del rimborso, notifiche e percorso di recupero account.

### P1 — necessario prima di vendere l'integrazione

1. Scegliere un gestionale pilota con account e ambiente autorizzati.
2. Implementare il connettore sul servizio aziendale, mai dentro la PWA.
3. Salvare identificativo remoto, ricevuta, stato e chiave di idempotenza.
4. Collaudare timeout, ritentativi, rifiuti, rimborso parziale e valuta estera.
5. Ripetere lo stesso contratto di prova prima di dichiarare un altro
   gestionale supportato.

### P1 — necessario per App Store e Play Store

1. Build e firma native del commit destinato al rilascio.
2. Prove fisiche su iPhone e Android, incluse installazione, aggiornamento,
   tastiera, fotocamera, allegati, background e perdita di rete.
3. Dichiarazioni Apple App Privacy e Google Play Data Safety sulla build reale.
4. Assistenza, recupero dati, acquisto e annullamento dell'abbonamento.

### P2 — prova di leadership, non requisito tecnico isolato

1. Confrontare gli stessi compiti con alternative di mercato usando utenti con
   ruoli equivalenti.
2. Misurare tempo al primo invio valido, errori, abbandoni, richieste di
   assistenza e correzioni.
3. Valutare suggerimenti e previsioni su dati futuri separati dai dati usati
   per costruirli.
4. Pubblicare soltanto vantaggi confermati dalle misure.

## Evidenze tecniche disponibili

- Commit pubblicato su `main`: `e99884f` (`feat: prepare same-origin company cloud service`).
- Repository locale e `origin/main` allineati al momento della verifica.
- Suite eseguita file per file: 395 file superati.
- Ultima verifica mirata: 30 test superati su readiness, invio aziendale e worker.
- Build PWA portabile completata.
- Build portabile Pages Functions: due route su due compilate.
- Produzione: home PWA caricata; endpoint aziendale raggiunto e protetto.

`spawn EPERM` nell'ambiente Codex impedisce ai runner che creano sottoprocessi
di avviare Node/esbuild. Non è stato trasformato in un falso esito positivo:
test file per file e builder WebAssembly portabile permettono di verificare il
codice senza disattivare protezioni del computer.

## Regola di aggiornamento

Aggiornare questo documento quando una prova cambia lo stato di una riga.
Registrare data, commit, ambiente e risultato. Non trasformare una build verde,
una fixture, un export o una schermata in prova di un servizio esterno realmente
ricevuto, di una conformità fiscale o di una compatibilità con dispositivi non
collaudati.

## Esperienza aggiornamenti — 20 settembre 2026
Rinnovati pannello delle novità e avviso aggiornamento: orbita animata,
layout mobile con azione sempre disponibile, focus tastiera e movimento ridotto.
Le novità dal 13 al 20 settembre sono raggruppate in quattro temi e tradotte
nelle sette lingue. Tutte le release successive a whatsNewSeen vengono incluse:
al ritorno le precedenti non lette sono espanse; solo la consultazione manuale
comprime lo storico. Il cursore si aggiorna alla chiusura, non all'accesso.
Accesso manuale aggiunto al Vault. Nessuna migrazione dei dati finanziari.
Verifiche: 10/10 test cronologia (tutte le versioni reali), 90/90 test i18n,
controllo sintattico e build portabile. Il ciclo aggiornamento PWA in produzione
e i dispositivi fisici non sono stati collaudati in questa modifica.
Verifica browser locale: apertura automatica delle novità, rendering desktop e viewport 390x844, nessun overflow orizzontale nel contenuto (368/368 px), pulsante entro il viewport e chiusura Escape verificati. La viewport simulata non sostituisce un dispositivo fisico.

Revisione visiva richiesta dall'utente: recuperati starfield originale, nebulosa,
card traslucide e intestazione centrata con orbita più presente. Ingresso a
scaglione, respiro lento del pianeta e risposta hover solo con puntatore fine.
Restano invariati recupero di tutte le novità non lette, traduzioni e cursore.
Build portabile riuscita; verifica visiva browser e viewport 390x844: contenuto
348/348 px senza overflow e pulsante con bordo inferiore 819 px, entro schermo.
Non è una prova fisica. Modifica locale, non ancora distribuita.

Accenti delle novità differenziati secondo il colore già dichiarato in ogni
voce: azzurro, verde acqua, oro e lilla. Icone, bordi e fondo sfumato condividono
l'accento; titoli e descrizioni restano leggibili senza dipendere dal colore.
Verifica browser locale della palette, 10/10 test cronologia e build portabile
riusciti. Logica delle novità non lette invariata; modifica non distribuita.

## Accesso ai dati e sincronizzazione — verifica 20 settembre
Aggiunte scorciatoie visibili nel Vault per dispositivi e cancellazione. Il
secondo comando apre spiegazione e controlli esistenti, non cancella al tocco.
Verificato nel browser senza eseguire cancellazioni. Sui controlli touch e
sulle card novità impedita la selezione accidentale; input, textarea e codici
restano selezionabili. Corretto il testo obsoleto del pairing usando il testo
multilingua del confine di condivisione già presente.
Build portabile riuscita. Test confine dati privati 4/4; test sync da eseguire
con --no-experimental-global-navigator su Node 24 (il fixture ridefinisce navigator).
La sincronizzazione universale live NON è completata: esistono delta dei
movimenti e tombstone fra peer autorizzati, ma servono copertura verificata
per modifiche concorrenti, impostazioni, allegati e apprendimento, riconnessione
semplice, coda durevole e collaudo fra due dispositivi reali. Non presentare
export/import come sync e non promettere aggiornamenti ad app chiusa.

Gestione dati e consenso dispositivi: scorciatoia Gestisci i dati apre il
percorso di cancellazione senza eseguirlo. Aggiunto elenco dispositivi autorizzati
con revoca locale, salvataggio del registro e chiusura dei canali corrispondenti.
La revoca non elimina copie remote. Test identità e revoca 14/14 superati.
BLOCCO concreto individuato: authorizePrivatePeer resta sul default false nel
collegamento main.js. Non abilitare usando solo un peerId o device_hello:
serve una sfida firmata legata al canale corrente e consenso prima dei dati.
Sincronizzazione privata end-to-end ancora da collegare e collaudare; nessuna
promessa di sincronizzazione universale live o ad app chiusa.

## Sincronizzazione personale serverless — base di sicurezza
Implementato private-sync-sessions.js: challenge casuale con scadenza, firma
ECDSA con dominio di protocollo, binding ai due fingerprint DTLS, consenso
esplicito separato dalla fiducia storica, verifica della sessione corrente e
revoca ricontrollata a ogni autorizzazione. Non usa server, account esterni o
identificatori pubblici come prova d'identità. Test negativi per replay, sessione
sostituita, revoca, scadenza, assenza di DTLS e inoltro su canali diversi.
NON ancora collegato al trasporto nell'app: il default resta deny. Da completare:
- consenso bilaterale e scelta dell'archivio personale, con anteprima prima di
  unire due Vault già popolati; niente identificazione della persona dal Wi-Fi;
- messaggi di autenticazione e conferma reciproca prima del primo delta;
- riconciliazione delle modifiche, allegati e stato del Vault con conflitti;
- consegna differita cifrata, indicatore dell'ultima ricezione confermata,
  riconnessione e prove reali tra dispositivi su reti diverse.
Una connessione P2P aperta non garantisce raggiungibilità universale. Nessun
relay terzo va autorizzato a leggere dati privati; app sospese non sono nodi
sempre disponibili. Non dichiarare sincronizzazione completa o pubblicata.

### Riutilizzo del sync split — audit 20 settembre
CONFERMATO: shareSplitGroups, mergeIntoGroups, refresh UI live e invio al
collegamento esistono già. Suite group-membership 21/21 e garanzia-rilascio
24/24 superate, inclusi merge offline, idempotenza e convergenza multi-device.
Limite di integrazione: split_share è soggetto ad authorizePrivatePeer, ancora
non collegato in main; i test di merge non provano trasporto reale operativo.
In ricezione main verifica l'esistenza del gruppo ma non una membership
crittograficamente autenticata per quello specifico gruppo. Non abilitare un
permesso privato globale per risolvere lo split: distinguere autorizzazione al
gruppo da autorizzazione al Vault personale. Riutilizzare merge, invio e refresh
esistenti; completare i permessi per ambito prima di collegare sessioni private.

### Separazione degli ambiti e ricerca tecnica
Il trasporto split ora richiede authorizeSharedGroup per ogni gruppo in entrambe
le direzioni, oltre alla sessione privata. Default deny anche per callback async
o in errore. La sessione privata firma anche lo scope dell'archivio; scope assente,
diverso o cambiato invalida il permesso. Lo scope non prova da solo l'identità:
restano obbligatori consenso e firma legata a DTLS. Nessuno scope viene assegnato
automaticamente a due Vault popolati. Il pairing dell'app resta da integrare.
Prove: private-sync-sessions 9/9, private-data-boundary 7/7, mesh-signaling
51/51, garanzia-trasporto 11/11; build portabile riuscita. Le fixture del
protocollo dichiarano sessioni e gruppi già autorizzati; non sono prove cloud.
Fonti primarie consultate: https://www.w3.org/TR/webrtc/ e
https://www.ietf.org/rfc/rfc8827.pdf per identità/DTLS;
https://automerge.org/docs/reference/concepts/ e
https://automerge.org/docs/keyhive/ark-api-guide/ per separazione fra sincronizzazione
dei documenti e gestione delle membership. Nessuna nuova dipendenza o server
pubblico collegato; dati utente non trasmessi durante i test.

### Collegamento sperimentale dei movimenti — aggiornamento successivo
Supera il precedente blocco di wiring, NON il blocco di rilascio del Vault completo:
bindPrivateSync è collegato in main.js. I dispositivi riconosciuti hanno un'azione
Collega i miei movimenti con codice archivio comune e consenso esplicito separato
su ciascun lato, testi nelle sette lingue. Il codice non è una password e non
sostituisce firma e consenso. Lo scope già configurato non è modificabile dal
form, evitando cambi di archivio silenziosi. Revoca elimina consenso e chiude canale.
Il trasporto gestisce challenge/proof/ready con limite 4 KB, verifica il canale
corrente e consente soltanto sync_digest/sketch/need_digest/txs. Split, pesi,
trasferte e altri domini NON ereditano questa autorizzazione. Corretto onclose:
la chiusura di un canale vecchio non elimina il suo sostituto.
Test controller 4/4 (consenso bilaterale anche ritardato, revoca, ambiti esclusi),
confine dati 7/7, protocollo 51/51, i18n 90/90; build portabile riuscita.
Limiti ancora aperti: schermata consenso non collaudata con due dispositivi fisici;
riconciliazione completa di modifiche ordinarie, allegati, impostazioni e modelli;
anteprima dei conflitti fra archivi popolati; retry dopo timeout di autenticazione;
feedback dell'ultima ricezione e trasporto offline. Non dichiarare archivio intero
sempre sincronizzato né conservazione remota. Accesso resta sperimentale.

### Recupero autenticazione privata — 20 settembre, controllo successivo
Il controller ritenta la challenge dopo 10 e 20 secondi, interrompe il tentativo
a 30 secondi e permette un nuovo avvio esplicito. Autenticazione riuscita,
revoca, chiusura del canale o rimozione della fiducia fermano i retry. Ogni timer
è associato al tentativo corrente: un callback già accodato di una sessione
precedente non può revocare la nuova. Dispose cancella timer e sessioni.
Verifica: controller 9/9, sessioni 9/9, confine privato 7/7, trasporto 51/51
(76 test locali). Le fixture non sono due dispositivi fisici né reti reali.
Build portabile riuscita su 447 moduli; restano gli avvisi sui chunk grandi.
Modifica tecnica coperta dalla voce sperimentale 2026-09-20b già presente nelle
novità: nessuna nuova promessa di copertura e nessuna migrazione dei dati.
Resta da completare il feedback visibile dei timeout, la conferma persistente
della ricezione, la riconciliazione delle modifiche ordinarie e dell'intero
archivio, l'anteprima dei conflitti e il collaudo fra dispositivi fisici.
Non inviare l'intero oggetto Vault: include chiavi e autorizzazioni locali.

### Riconciliazione dell'archivio personale — 20 settembre, terzo controllo

Supera i limiti precedenti per i dati personali supportati senza spedire alla
cieca l'intero oggetto Vault. Una lista esplicita di 51 campi portabili copre
budget e profilo, piani e scadenze, obiettivi, patrimonio, trasferte, fatture e
fisco IT/CH/ES, categorie, preferenze d'investimento e apprendimento locale.
Nel testo per l'utente questi campi sono raggruppati in cinque aree leggibili;
non sono domini internet. Movimenti e cancellazioni continuano sul protocollo
CRDT dedicato; gruppi split continuano ad avere autorizzazioni di membership
separate.

Ogni campo portabile ha hash di confronto e vector clock per dispositivo. Una
modifica causalmente successiva viene applicata; modifiche concorrenti diverse
non vengono sovrascritte: entrambe restano salvate e compaiono in una schermata
di scelta. La risoluzione genera una nuova versione causale e riparte al
collegamento successivo. Le ricevute applicative di campi e transazioni sono
persistite con limiti di quantità e contenuto; l'interfaccia distingue attesa,
verifica, collegamento, ricezione confermata, timeout, disconnessione e revoca.

Il trasporto spezza payload superiori a 12.000 caratteri, li ricompone entro un
limite di 8 MiB, elimina assemblaggi incompleti dopo 60 secondi e mantiene al
massimo quattro trasferimenti concorrenti per peer. Anche le foto ricevuta
incorporate nei movimenti usano questo percorso: non dipendono più da un unico
messaggio WebRTC sovradimensionato. Gli allegati dell'archivio documentale
IndexedDB rimangono un dominio separato e non vengono dichiarati sincronizzati.
Chiavi API, identità del dispositivo, autorizzazioni, consenso, telemetria,
materiale di recupero e stato UI sono esclusi esplicitamente.

Verifiche locali: tutti i 388 file di test in `src` superati in sequenza,
5.469 test complessivi senza errori;
fra quelli mirati private-archive-sync 9/9, mesh-signaling 51/51,
private-sync-controller 9/9, private-sync-sessions 9/9, private-data-boundary
7/7, translation-coverage 9/9 e ui-strings 91/91. Il runner parallelo di Node
resta bloccato da `spawn EPERM`; gli stessi file vengono eseguiti nel processo
Node 20, uno alla volta. Build portabile riuscita su 448 moduli con esbuild
WebAssembly. Collaudo browser locale riuscito: novità, accesso dal Vault,
stato archivio e schermata conflitti; viewport 390×844 verificata senza tagli
del foglio. Questa verifica non equivale a una prova fra iPhone,
Mac e reti fisiche diverse: tale prova resta aperta e non va presentata come
superata. La sincronizzazione richiede entrambe le app raggiungibili; non è un
backup cloud né una garanzia di lavoro a PWA completamente chiusa.

### Persistenza locale efficiente — 20 settembre, quarto controllo

Il Vault conserva ora in `localStorage` un solo snapshot immediatamente
leggibile e un manifest piccolo con revisione, dimensione, hash e numero di
movimenti. La precedente shadow Base64 rimane leggibile durante la migrazione,
ma viene eliminata soltanto dopo una scrittura verificata. Per un archivio di
dimensione N, l’occupazione scende quindi da circa 2,33 N a N più il manifest,
senza comprimere o rendere opaco il dato principale.

IndexedDB resta il livello durevole con quota più ampia. Le modifiche rapide
aggiornano subito lo snapshot locale, mentre una coda latest-wins accorpa la
raffica e conserva in IndexedDB soltanto l’ultima versione. Uno stato identico
non aumenta la revisione e non viene riscritto. All’avvio, copie con lo stesso
numero di movimenti vengono ordinate anche tramite la revisione; la sicurezza
dei movimenti resta la priorità e una copia con più transazioni prevale.

La cancellazione invalida e attende la coda prima di rimuovere gli store, così
una scrittura tardiva non può ricreare dati cancellati. Il ripristino verifica
prima la copia durevole e poi pubblica snapshot e manifest locali; in caso di
errore ripristina anche i formati precedenti. Backup cifrati, passaggio iOS,
archivi storici e shadow Base64 già esistenti restano leggibili. La
sincronizzazione fra dispositivi continua a usare delta per campo e pacchetti
con limite esplicito: questa modifica riduce spazio e amplificazione delle
scritture locali, ma non trasforma il Vault in una conservazione cloud.

Verifica di questo controllo: 389 file di test eseguiti singolarmente con Node
20, 5.476 test superati e nessun errore; `vault.test.js` 45/45,
`vault-storage.test.js` 5/5, `restore-safety.test.js` 16/16,
`ui-strings.test.js` 92/92 e copertura traduzioni 9/9. Build portabile di
produzione riuscita su 449 moduli. Restano gli avvisi preesistenti sui chunk
grandi; non indicano un errore della persistenza.

### Consegna differita cifrata — prerequisito chiuso, 21 settembre 2026

Verificato leggendo il codice (non ipotizzato): `store-forward.js` esiste già
completo (ECDH P-256 + AES-GCM via WebCrypto, TTL, limite dimensione, sacco
di trasporto con igiene automatica) e `exchange-identity.js` mantiene una
chiave di scambio persistente non esportabile — ma **nessun punto del codice
chiamava mai `sealFor()`**: l'infrastruttura di consegna differita esisteva ma
non trasportava nulla, perché mancava il prerequisito — i dispositivi fidati
non si scambiavano mai la propria chiave di SCAMBIO (solo quella di FIRMA,
usata per l'identità). Senza sapere a quale chiave sigillare un pacchetto,
nessuna staffetta poteva partire.

Chiuso questo prerequisito: `device_hello` porta ora anche la chiave di
scambio (mai per uno sconosciuto — solo dopo che le tre parole sono già state
confermate), `setTrustedExchangeKey` (device-trust.js) la registra/aggiorna
sul dispositivo fidato corrispondente, segue le rotazioni della chiave senza
richiedere una nuova conferma umana (non è una nuova decisione di fiducia,
solo l'aggiornamento di una destinazione). Verificato: `device-trust.test.js`
18/18, `mesh-signaling.test.js` 52/52 (nuovo test end-to-end sendDeviceHello→
onDeviceHello con e senza chiave di scambio), suite app 5.488/5.488 su Node 20.

**Non ancora fatto, resta il prossimo passo reale**: nessun codice sigilla
ancora `privateArchivePatch(VaultDAO.state, {})` per i dispositivi fidati
NON connessi in questo momento e lo consegna con `window.inviaAlDispositivo`
— il prerequisito (sapere a chi sigillare) è pronto, il collegamento vero e
proprio no. Da fare con attenzione al limite di 64 KB per pacchetto
(`MAX_BUNDLE_BYTES`) e a non ri-sigillare l'intero archivio a ogni
salvataggio (chiacchiericcio inutile): serve un throttle e, se il payload
supera il limite, una strategia dichiarata (es. solo i campi cambiati dopo
l'ultima consegna nota), non un troncamento silenzioso.

### Guida SdI: link diretto al servizio di trasmissione — 21 settembre 2026

Feedback utente: la guida di caricamento mandava a un portale generico
(`ivaservizi.agenziaentrate.gov.it/portale/`), lasciando l'utente a
"cercare ogni cosa dentro quel sito" — attrito reale segnalato come causa
di abbandono. Aggiunto `SDI_WIZARD_URL`/`portals.it.wizardUrl`
(`.../ser/fatturewizard/#/home`, verificato raggiungibile con `curl -I`
prima di scriverlo), usato SOLO dopo il passo di accesso — mai come primo
link, perché prima dell'autenticazione rimanderebbe comunque al login,
riproducendo la stessa confusione segnalata. Collegato sia nella guida
statica (`showUploadHelp`) sia nel walkthrough passo-passo
(`src/ui/tax-handoff.js`), tradotto in 7 lingue.
Verificato: `tax-handoff.test.js` 4/4 (nuovo test dedicato), suite
5490/5490. Non verificato dal vivo in Chrome (stesso limite ambientale
già segnalato in questa sessione).

**Segnalazione utente non ancora risolta, in attesa di dettaglio**:
"quando crei l'XML mancano dei controlli" — verificato `fatturapa-xml.js`
(`missingForFatturaPa`/`validateFatturaPa`): la validazione copre già
campi obbligatori, formato P.IVA/CF e checksum ufficiale (codici SdI
00417/00401/00404/00306). Nessun controllo specifico mancante identificato
senza un esempio concreto dell'utente (quale campo/scenario ha superato la
validazione ma è stato scartato dallo SdI) — non inventare una regola di
validazione senza una fonte verificata, stessa disciplina del resto del
progetto.

### Checksum P.IVA/CF: da warning a errore bloccante — 21 settembre 2026

Risolta la segnalazione sopra ("mancano dei controlli"), rimasta in sospeso
senza un esempio concreto: il controllo esisteva già ma era `warn`, non
`err` — un checksum ufficialmente sbagliato è uno scarto CERTO dallo SdI
(non probabile come gli altri warning di `validateFatturaPa`), quindi l'XML
si scaricava comunque e l'utente scopriva lo scarto solo dopo il
caricamento reale sul portale. Promosso a errore bloccante in
`fatturapa-xml.js` (`buildFatturaPaXML().blocking` ora `true`), con test
dedicato. Suite 5491/5491 su Node 20. Non verificato dal vivo in Chrome
(estensione non connessa in questa sessione).

### Gate PRO: verifica riga per riga dei 9 punti collegati — 21 settembre 2026

Nessuna verifica dal vivo in Chrome era stata fatta per gli 8 gate PRO
collegati nella sessione precedente (rischio dichiarato: bloccare per
errore un'azione che doveva restare libera). Estensione Chrome non
connessa anche in questa sessione — fatta una verifica statica completa,
riga per riga, di ogni punto d'ingresso di ciascuna feature gated
(`fisco_italia`, `fisco_svizzera`, `fisco_spagna`, `fatturazione_elettronica`,
`sentiment_on_device`, `sync_multi_dispositivo`, `comps_multipli`,
`posizionamento_derivati_crypto`).

**Trovato e corretto un bypass reale**: `window.setTaxRegime` (la funzione
che attiva davvero `fisco_italia`) era gated solo quando raggiunta tramite
`openTaxRegimePicker`, ma due pulsanti "scegli regime" separati
(`renderTax`/`renderTaxSettings`, mostrati quando c'è una fattura ma manca
ancora il regime) la chiamavano DIRETTAMENTE — un utente FREE poteva
impostare/cambiare il regime gratis da lì, aggirando del tutto il piano a
pagamento. Il gate è stato spostato dentro `setTaxRegime` stesso, l'unico
vero punto di attivazione, non su una sola delle sue porte d'ingresso.

Gli altri 7 gate sono risultati corretti: bloccano solo l'attivazione, mai
la disattivazione (`setEsActive(false)`, `setSentimentLocalOptIn(false)`)
né azioni gratuite collaterali (PDF fattura `#inv-generate`, simulatori
funnel `openSpainSimulator`). Suite 5491/5491 su Node 20.

**Ancora da fare, dichiarato esplicitamente**: nessuna prova dal vivo in
browser reale per nessuno dei 9 punti — priorità non appena l'estensione
Chrome torna disponibile, prima di considerare il sistema di piani pronto
per il rilascio pubblico.

### Decimo gate: analisi_causale_titolo — 21 settembre 2026

Collegato `analisi_causale_titolo` (`titolo-causale.js`/`confronto-titoli.js`,
PRO_INVESTOR) nel punto unico in cui il QA di mercato consegna la risposta
(callback `mercato:` in `askMomentum`, main.js), gated solo quando la
risposta porta davvero l'analisi (`result.data` presente) — le domande di
chiarimento restano libere. Nessun modale sopra la chat: la risposta
testuale stessa spiega il prezzo (stesso testo `featureGateBody` già in 7
lingue). Suite 5491/5491, build verificata. Non verificato dal vivo.

**Deliberatamente NON toccati in questa sessione** (rischio concreto di
rompere contenuto FREE senza poterlo verificare in browser):
`pannello_sec_base`/`beneish_piotroski` (annidati in rendering condiviso,
~850 righe — serve una limitazione dei dati mostrati, non un gate
booleano), `pannello_sec_completo` (stesso rendering), `proiezioni_monte_carlo`
(motore Monte Carlo di `net-worth.js` embedded nel What-if simulator di
Analisi Tensor insieme a contenuto gratuito — slider, tabella strategia),
`regime_di_mercato` (`detectLiveRegimeFor`, 3 punti di chiamata diversi che
alimentano Dashboard e altre card). Restano gate PRO_INVESTOR dichiarati
nell'infrastruttura (`subscription.js`) ma non collegati: liberi per
chiunque, non un errore nascosto — coerente con l'onestà del resto del
progetto (`FEATURES_PER_PIANO` dichiara nel commento cosa è vero e cosa no).

### Trasporto mesh e durabilità locale — 23 settembre 2026

Il controllo dopo i 22 commit arrivati su `origin/main` ha mantenuto il nuovo
scambio della chiave per la consegna differita. L'archivio personale ora usa
una coda WebRTC con limite di memoria e backpressure: un campo grande viene
spezzato e non riempie senza limite il buffer del canale. I campi vengono
inviati uno per volta; il successivo parte dopo una ricevuta applicativa con
hash corrispondente. Una ricevuta mancante provoca fino a tre tentativi,
mentre un errore di consegna viene segnalato. Alla riconnessione resta la
riconciliazione tramite manifest, che serve anche dopo una sospensione. I
movimenti nuovi hanno un invio live separato; le modifiche alle altre aree
personali non partono ancora automaticamente a ogni salvataggio e attendono
il successivo collegamento o ritorno dell'app in primo piano.

Il Vault ora tenta la richiesta di storage persistente soltanto dopo un gesto
dell'utente e soltanto quando esistono dati personali; se il browser la nega,
il salvataggio continua. Alla sospensione della pagina si attende la scrittura
IndexedDB già in corso, senza garanzia che il sistema operativo lasci il tempo
di completarla; alla ripresa i peer ancora connessi chiedono una
nuova riconciliazione. Una serializzazione iterativa di ripiego conserva un
archivio non circolare molto annidato quando `JSON.stringify` esaurisce lo
stack. Anche l'impronta dell'archivio usa un ripiego iterativo solo quando la
profondità esaurisce lo stack, mantenendo identiche le impronte normali.
Il percorso comune è Web/PWA e webview Capacitor, senza nuova dipendenza
nativa né copia in chiaro in un filesystem aggiuntivo.

**Limiti ancora aperti:** una conferma applicativa non è una copia di backup;
la perdita contemporanea di tutti i dispositivi senza backup resta possibile.
Solo i campi nella allowlist dell'archivio, le transazioni e i protocolli
specifici già collegati partecipano al sync; allegati separati in IndexedDB,
segreti del dispositivo e dati aziendali non vengono trasferiti da questo
percorso. Non esiste una prova fisica iOS/Android né la garanzia che una PWA o
un'app sospesa resti attiva per sincronizzare. Mancano test su reti mobili
vere, NAT ostili, quota piena e aggiornamenti nativi firmati. Il plugin
Capacitor App non è stato aggiunto: l'installazione della dipendenza non si è
completata in questo ambiente; non dichiarare agganci nativi `pause/resume`.
La leadership di mercato richiede confronti esterni e misure di perdita,
latenza, consumo e completamento del recupero, non segue da questi test.

**Prove eseguite sul checkout del 23 settembre:** integrazione dei 22 commit
remoti senza conflitti; 404/404 file di test eseguiti separatamente con Node
24 (il runner parallelo resta bloccato da `spawn EPERM`); ripetuti dopo gli
ultimi ritocchi i test mirati di mesh, archivio, persistenza e Vault, tutti
superati. Gli stati storici sintetici v7.0 e v7.1 sono stati aperti e
risalvati controllando ogni campo originario; i byte JSON normali rimangono
identici al serializzatore precedente. Questi campioni non sostituiscono gli
archivi reali di tutti gli utenti. Build portabile di produzione riuscita su
452 moduli. Avvio della
build su `127.0.0.1:4177` verificato in browser con Dashboard e novità
visibili, senza errori JavaScript registrati. Non è una prova di trasferimento
fra due dispositivi fisici né di conservazione dopo disinstallazione.

**Decisione di rilascio per il nuovo trasporto/Vault:** mantenere la versione
già pubblicata finché un collaudo con backup preventivo non copre almeno
aggiornamento di un archivio reale preesistente, scrittura interrotta/quota
piena, revoca e riassociazione del dispositivo, conflitti, trasferimento di
archivio grande e recupero su iOS/Android fisici. Test e build locali da soli
non dimostrano assenza assoluta di perdita dati sul parco dispositivi.

### Split verificabile e percorsi pubblici — 24 settembre 2026

Il salvataggio di una divisione ora richiede importo finito e quote valide,
espresse al centesimo e con somma esatta. Gli importi nella valuta del gruppo
con frazioni di centesimo vengono rifiutati; un importo convertito viene
arrotondato una sola volta nella valuta base. Le quote suggerite dallo storico
distribuiscono i centesimi residui prima della conferma; se l'utente modifica
una quota senza riequilibrare le altre, la schermata mostra lo scarto e
disabilita salvataggio e invito. L'ipotesi di spesa ricorrente usa soltanto
storia coerente per pagatore e ripartizione, e resta un'ipotesi: non crea una
spesa o un debito. La curva di cassa include solo saldi di gruppi con un unico
slot personale rivendicato, valuta omogenea, spese non contestate e registro
aritmeticamente valido; se un gruppo non soddisfa questi requisiti, la cifra
split viene sospesa e il motivo segnalato. La compensazione fra gruppi non
accoppia più persone solo perché hanno lo stesso nome: richiede identità
collegate e un rapporto a due persone. Gli archivi esistenti non vengono
riscritti da queste verifiche.

Tre percorsi pubblici statici (split, trasferte, Partita IVA) sono generati in
sette lingue, con intenzione di apertura della relativa funzione consumata una
sola volta nell'app. La comunicazione su trasferte e fisco distingue
preparazione/export da invio ricevuto e adempimento ufficiale; nessun
connettore o invio nazionale viene dichiarato attivo sulla base delle pagine.

**Prove locali:** test mirati di calcolo, validazione, lingue e pagine
282/282; una divisione da 10,01 € fra due persone ha mostrato 5,01 € e
5,00 € nel browser locale, mentre un aumento non compensato ha mostrato lo
scarto e bloccato le azioni. Generazione delle pagine e build portabile di
produzione riuscite (459 moduli). La suite completa separata per file è
passata: **408/408 file**, senza fallimenti; dopo l'ultimo controllo di
identità, della quota lasciata vuota e degli importi sub-centesimo,
altri **142/142 test Split** superati.
Pagina Trasferte verificata nel
browser locale: l'esempio cambia stato senza presentare la preparazione come
ricezione. Queste prove non sostituiscono il collaudo su dispositivi fisici.

**Limiti di rilascio:** l'uguaglianza aritmetica al centesimo è verificabile
per dati validi, ma una previsione non può essere garantita come debito reale;
identità, importi e cambi inseriti dall'utente richiedono conferma. Il bundle
iniziale dell'app resta grande (circa 3,35 MB minificati, 1,14 MB gzip) e non
è stata fatta una prova su rete mobile e telefoni fisici. Le nuove pagine non
sono ancora state verificate nella distribuzione Cloudflare. Restano i blocchi
di Vault/sync, connettori aziendali, verifiche fiscali e pagamenti dichiarati
nelle sezioni precedenti: questa revisione non abilita un rilascio globale o
una promessa di superiorità verso i concorrenti.

**Revisione Split del 24 settembre:** rimosso un motore non collegato alla UI
che sommava debiti di gruppi diversi per nome: due omonimi potevano essere
confusi. La nuova vista nell'elenco dei gruppi mostra una compensazione solo
per coppie con slot rivendicati dagli stessi dispositivi, valuta uguale,
registro valido, nessuna contestazione e saldi opposti. Se un gruppo della
stessa coppia è ambiguo o incompleto, la proposta si astiene. La vista è
solo un calcolo sui saldi registrati: non crea rimborsi, non sa se una persona
ha già pagato fuori dall'app e invita a controllarlo. La bozza Split non
consiglia più di rimandare un rimborso perché una futura spesa *potrebbe*
compensarlo: la cadenza storica non è una garanzia. Il comportamento è
tradotto nelle sette lingue; i dati Vault esistenti restano invariati.

**Prove della revisione:** i test mirati coprono centesimi, dieci persone
con omonimi, gruppi contestati, valute diverse, duplicati e registri rotti.
La suite seriale ha superato 408/408 file; la build portabile ha trasformato
459 moduli. Nel browser locale una divisione da 10,01 € ha assegnato 5,01 €
e 5,00 € senza perdere il centesimo. La prima guida del pulsante + non copre
più il risultato della modale.

**Chiarezza del primo avvio, dei movimenti e del Vault — 24 settembre:**
la schermata subito dopo l'onboarding applica titolo e invito nella lingua
effettiva della sessione prima di mostrarsi. Le singole transazioni hanno
gerarchia più leggibile, accento della categoria e aree di tocco di almeno
44 px per categoria, pianificazione ed eliminazione. Il Vault mostra prima
gli effetti comprensibili dei motori; nomi e specifiche sono apribili a
richiesta. Le fonti di mercato aggiuntive e gli assistenti alternativi sono
progressivi; la procedura per una chiave è in tre passi tradotti nelle sette
lingue. Salvare una chiave non viene più presentato come verifica della
connessione. La chat esterna resta opzionale, con invio del riepilogo
finanziario disattivato di default. Nessun archivio utente è stato migrato
o riscritto da queste modifiche di interfaccia.

Nel browser locale l'inglese ha mostrato titolo e messaggio di privacy in
inglese. A 390 px la guida alla chiave non aveva scorrimento orizzontale;
la riga di movimento misurava 346 px e tutti i suoi pulsanti almeno 44 px
di altezza. La verifica è su viewport simulata, non su iPhone fisico.
Rimangono da provare l'onboarding completo in ciascuna lingua su telefoni
reali, la validità delle chiavi presso i fornitori scelti dall'utente e il
caricamento della nuova build pubblica dopo un push. Il bundle principale
resta circa 3,38 MB minificati / 1,15 MB gzip: il riordino del Vault non ha
risolto il tempo al primo avvio su rete mobile.

Il lavoro è registrato nel branch locale
`codex/split-calculation-safety-and-journeys`; non è su `main` né nella
distribuzione pubblica. Il push del branch di anteprima è stato tentato il
24 settembre con Git di sistema e runtime, ma il gestore delle credenziali
non dispone di un accesso funzionante in questo ambiente. Nessun token
incollato in chat è stato usato. La verifica Cloudflare attende quindi un
push autenticato; i risultati locali non valgono come collaudo cloud.
