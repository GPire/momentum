# Momentum — stato reale e lavoro restante

Verifica aggiornata al **20 settembre 2026** sul commit `e99884f`. Questo è il
documento operativo canonico per decidere cosa può essere rilasciato e cosa
deve ancora essere completato. Una funzione presente nel codice non viene
considerata operativa finché non supera anche la prova indicata nella relativa
sezione.

## Decisione di rilascio

| Perimetro | Stato | Decisione |
| --- | --- | --- |
| Web/PWA personale | Pubblicata e funzionante sul dominio di produzione | Candidata a beta pubblica controllata |
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
