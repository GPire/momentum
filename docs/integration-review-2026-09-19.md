# Integrazione selettiva: GitHub come base

Confronto fra `origin/main` a `007883f`, base comune `a5923a5` e quattro
commit locali da `f06dcdb` a `40026fa`. Prima dell'integrazione il working
tree era pulito: 4 commit locali e 39 remoti, non lavoro non salvato.

## Decisioni

| Area | Scelta | Motivo |
| --- | --- | --- |
| Interfaccia, traduzioni, CSS, onboarding | Versione GitHub | Nessuna evidenza sufficiente per sostituirla con i tre rifacimenti locali. |
| Casse professionali, FatturaPA, report CH/ES | Versione GitHub | Copertura più recente; mantenuti tutti gli aggiornamenti remoti. |
| Trasferte, OCR, approvazioni, debiti, modelli, mesh | Versione GitHub | Conservate le implementazioni remote senza applicare vecchi stash. |
| Importi fiscali serializzati come stringhe | Correzione locale selezionata | Evita concatenazioni nelle somme e valori non finiti; nessuna migrazione. |
| Anno/regole/cassa nelle proiezioni | Integrazione selezionata e adattata | Propaga anche `eta` richiesta dal nuovo ENPAM. |
| Posizione fiscale unificata locale | Esclusa | Con archivio fatture incompleto sostituiva tutti gli incassi classificati con i soli abbinati. |
| Rate fatture ed export locali | Rinviati | Dipendenze e casi misti da validare; nessuna importazione indiscriminata. |
| Dettaglio contributi | Correzione nuova | ENPAM espone quota A/B, non soggettivo/integrativo. Esposti anche contributi fissi già inclusi nel totale. |
| Riconciliazione carta | Correzione nuova | Non abbinare valute diverse, date invalide o importi non finiti. |

## Caso che ha bloccato il riepilogo locale

Una fattura Alfa di 1.000 euro presente nell'archivio; due incassi già
classificati come fatture: Alfa 1.000 e Beta 2.000. A fine anno il modulo
locale `buildItalianTaxPosition` usava 1.000 euro per la proiezione, invece
dei 3.000 riconosciuti dal percorso remoto. Il modulo e i suoi collegamenti
non sono stati mantenuti. Recuperarli richiede prima un trattamento esplicito
di archivi parziali, abbinamenti incerti, quote e duplicati, con test end-to-end.
I vecchi commit restano recuperabili nella storia Git; gli stash sono intatti.

## Correzioni, non nuove promesse

La selezione finale modifica due moduli produttivi: `tax.js` e
`trips/card-reconciliation.js`, con i rispettivi test. Nessun cambio a
schema Vault, ID, hash, allegati, memoria appresa o persistenza. I test su
input congelati controllano anche che le correzioni non riscrivano lo storico.

Per la riconciliazione, due record legacy entrambi privi di valuta mantengono
il comportamento precedente. Se solo uno dichiara la valuta, non si assume
che coincidano. Le voci restano non abbinate e disponibili alla verifica.

Non sono state aggiunte aliquote fiscali né modificati dataset/pesi dei modelli.
Il miglioramento dimostrato è l'affidabilità dei calcoli e dei collegamenti,
non una superiorità su tutti i concorrenti o una conversione garantita.

## Verifica

La prima suite estesa ha eseguito 365 file sul candidato più ampio e ha
segnalato il nuovo test sull'export ENPAM: il dettaglio aveva valori non
finiti. La correzione del motore è mantenuta; il candidato più ampio è stato
escluso per il caso dell'archivio incompleto sopra descritto.

La suite completa finale e la build vengono eseguite sul sottoinsieme
selezionato; i risultati conclusivi sono riportati in fondo a questo documento.
Smoke test Chrome: ingresso Vault > Pagamenti e lavoro > Partita IVA >
simulatore, 60.000 euro/anno, medico ENPAM, età 45; risultato con quota A/B
e totale, apertura e chiusura del percorso. La UI finale coincide con GitHub.
Questo non costituisce un collaudo su iPhone/Android fisici né una verifica
di tutti i percorsi fiscali o della normativa.

## Lavoro ancora necessario

- Integrare eventuali rate locali solo dopo prove con archivi incompleti e
  più fatture dello stesso cliente; mantenere distinta conferma e stima.
- Verificare raccolta/persistenza dell'età nel profilo fiscale, oltre al
  simulatore dove è già richiesta per ENPAM. Non inferirla dall'onboarding.
- Valutare i minimi annuali delle casse nelle stime per singolo incasso:
  è un limite preesistente che questa integrazione non certifica risolto.
- Verificare responsive e dispositivi fisici prima di dichiarare una release
  mobile collaudata; nessun nuovo redesign è stato pubblicato.

Nessun push o deploy viene eseguito in questa revisione.

## Esito conclusivo

- Fetch finale riuscito: `origin/main` ancora `007883f`.
- Suite completa sul candidato finale: **364/364 file superati**, con il
  runner seriale del repository e Node del runtime locale.
- Verifica mirata conclusiva: **229 test superati, 0 falliti, 0 saltati**
  su fisco, regole, engine, incassi, export e riconciliazione. Include il
  test aggiunto sull'aggiornamento regole/anno di proiezione e simulatore.
- Build di produzione portabile Vite/esbuild-WASM riuscita (46,35 secondi).
  Rimangono gli avvisi di dimensione dei bundle e quello sul riferimento
  CSS risolto a runtime; non sono presentati come ottimizzazioni risolte.
- Confronto con upstream: nessuna modifica finale a `index.html`, `main.js`,
  `src/ui` o `src/i18n`. Nessuna nuova traduzione necessaria per le stringhe
  normative italiane del dettaglio cassa, nello stesso percorso preesistente.
- Il risultato è un merge locale su `main`, non una release pubblicata.
