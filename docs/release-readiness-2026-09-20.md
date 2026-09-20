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
