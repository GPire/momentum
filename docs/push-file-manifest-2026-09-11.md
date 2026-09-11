> Aggiornamento successivo: main d92a5dc è stato integrato e i casi limite corretti. Esito corrente, preservazione dei dati e 4.839 test / 316 file sono in [merge-validation-2026-09-11.md](merge-validation-2026-09-11.md). I riferimenti e i blocchi di autenticazione descritti sotto documentano la fase precedente.

# Contenuto del push: file per file

Diff verificato da `91f2cd8` (ultimo branch remoto osservato) a `eb86338` (codice locale revisionato): **64 file**. Include il commit precedente `52b8edd`, non ancora remoto. Non comprende dipendenze installate, dati personali o prove sintetiche del browser.

Le aggiunte di documentazione successive a eb86338 sono elencate in fondo. Il punto di ingresso per il revisore è [la descrizione del merge](merge-request-2026-09-11.md).

| File | Motivo / responsabilità |
|---|---|
| [.github/workflows/native-checks.yml](../.github/workflows/native-checks.yml) | Workflow Capacitor con raccolta delle evidenze iOS; configurazione predisposta, esecuzione nativa non attestata. |
| [AGENTS.md](../AGENTS.md) | Contesto condiviso, regole da preservare e indice del passaggio di consegne. |
| [docs/financial-wellbeing-healthkit.md](../docs/financial-wellbeing-healthkit.md) | Fattibilità HealthKit: preparazione, non integrazione operativa. |
| [docs/form-fields-audit.md](../docs/form-fields-audit.md) | Inventario statico dei campi; risultati storici da ricontrollare sul merge. |
| [docs/integration-handoff-2026-09-11.md](../docs/integration-handoff-2026-09-11.md) | Contratti e risoluzione guidata dei conflitti con main. |
| [docs/ios-release-verification.md](../docs/ios-release-verification.md) | Strada di verifica nativa e limiti delle prove locali. |
| [docs/open-banking-readiness.md](../docs/open-banking-readiness.md) | Preparazione open banking: costi/architettura, non collegamento bancario rilasciato. |
| [docs/qa-clarity-2026-09-11.md](../docs/qa-clarity-2026-09-11.md) | Cronologia dei controlli, scenari, dispositivi simulati e limiti. |
| [docs/release-review-2026-09-11.md](../docs/release-review-2026-09-11.md) | Descrizione funzionale completa e condizioni prima del rilascio. |
| [docs/split-market-and-ux-2026-09-11.md](../docs/split-market-and-ux-2026-09-11.md) | Confronto con fonti ufficiali e opportunità separate dalle funzioni implementate. |
| [index.html](../index.html) | Struttura Dashboard/calendario, Analisi, Vault, onboarding, moduli, navigazione e caricamento CSS iniziale. |
| [package.json](../package.json) | Comandi riproducibili per test seriali, build portabile e generazione utility CSS. |
| [public/sw.js](../public/sw.js) | Nuova versione della cache e risorse CSS locali; eliminata dipendenza runtime da Tailwind CDN. |
| [public/ui-utilities.css](../public/ui-utilities.css) | Utility CSS generate e versionate: devono corrispondere alle classi usate dal codice integrato. |
| [scripts/audit-form-fields.mjs](../scripts/audit-form-fields.mjs) | Inventario statico dei campi da affiancare alle prove browser. |
| [scripts/build-portable.mjs](../scripts/build-portable.mjs) | Build Vite con compilatore WASM della stessa versione per ambienti Windows con pipe bloccate. |
| [scripts/compiler-wasm.mjs](../scripts/compiler-wasm.mjs) | Adattatore del compilatore per il percorso portabile. |
| [scripts/portable-tools/package-lock.json](../scripts/portable-tools/package-lock.json) | Versioni e integrità delle dipendenze del tooling portabile. |
| [scripts/portable-tools/package.json](../scripts/portable-tools/package.json) | Dipendenze separate esbuild-wasm/Tailwind, senza node_modules versionati. |
| [scripts/run-tests.mjs](../scripts/run-tests.mjs) | Modalità seriale con processo separato per ciascun file, senza saltare test. |
| [scripts/utility-input.css](../scripts/utility-input.css) | Ingresso per generare le utility CSS. |
| [src/core/date-utils.test.js](../src/core/date-utils.test.js) | Test di fuso con veri sottoprocessi, URL Windows e stdout su file temporaneo. |
| [src/core/vault.js](../src/core/vault.js) | Persistenza/migrazione della preferenza tema automatico o esplicito. |
| [src/core/whats-new.js](../src/core/whats-new.js) | Novità del rilascio in nove argomenti; gestione del primo ingresso. |
| [src/i18n/payout.js](../src/i18n/payout.js) | Messaggi, azioni e ritorno dal rimborso in sette lingue. |
| [src/i18n/split-workspace.js](../src/i18n/split-workspace.js) | Testi dei gruppi, quote, omonimi, richieste e controlli in sette lingue. |
| [src/i18n/translation-coverage.test.js](../src/i18n/translation-coverage.test.js) | Verifica delle chiavi effettive dei dizionari, senza affidarsi al fallback. |
| [src/i18n/ui-strings.js](../src/i18n/ui-strings.js) | Nuove stringhe e completamento delle traduzioni dei flussi fiscali/fatturazione; unire per chiave con main. |
| [src/i18n/ui-strings.test.js](../src/i18n/ui-strings.test.js) | Test di regressione per `src/i18n/ui-strings.js`. Nuove stringhe e completamento delle traduzioni dei flussi fiscali/fatturazione; unire per chiave con main. |
| [src/main.js](../src/main.js) | Integrazione DOM: editor diretti, moduli adattivi, gruppi e split, riepiloghi, messaggi, avvio, focus e navigazione. Integrare per funzione, mai sostituire il file di main. |
| [src/predict/command-center.js](../src/predict/command-center.js) | Segnali di budget e inserimento collegati ai dati dichiarati. |
| [src/predict/command-center.test.js](../src/predict/command-center.test.js) | Test di regressione per `src/predict/command-center.js`. Segnali di budget e inserimento collegati ai dati dichiarati. |
| [src/predict/onboarding-priors.js](../src/predict/onboarding-priors.js) | Budget solo se dichiarato esplicitamente; onboarding distinto da abbonamento. |
| [src/predict/onboarding-priors.test.js](../src/predict/onboarding-priors.test.js) | Test di regressione per `src/predict/onboarding-priors.js`. Budget solo se dichiarato esplicitamente; onboarding distinto da abbonamento. |
| [src/predict/profilo-feature.js](../src/predict/profilo-feature.js) | Visibilità contestuale e suggerimento fiscale subordinato a pertinenza esplicita. |
| [src/predict/tax-suggestion.test.js](../src/predict/tax-suggestion.test.js) | Casi della proposta fiscale. Va conciliato con il nuovo instradamento IT/ES/CH di main. |
| [src/split/payout.js](../src/split/payout.js) | Validazione URL dei servizi di pagamento, valuta e messaggi di rimborso. |
| [src/split/payout.test.js](../src/split/payout.test.js) | Test di regressione per `src/split/payout.js`. Validazione URL dei servizi di pagamento, valuta e messaggi di rimborso. |
| [src/split/repayment-share.js](../src/split/repayment-share.js) | Snapshot compresso del gruppo con i dati necessari a spiegare il rimborso. |
| [src/split/repayment-share.test.js](../src/split/repayment-share.test.js) | Test di regressione per `src/split/repayment-share.js`. Snapshot compresso del gruppo con i dati necessari a spiegare il rimborso. |
| [src/ui/calendar-period.js](../src/ui/calendar-period.js) | Calcolo dei periodi/settimane e cambio mese senza salto dovuto al giorno 31. |
| [src/ui/calendar-period.test.js](../src/ui/calendar-period.test.js) | Test di regressione per `src/ui/calendar-period.js`. Calcolo dei periodi/settimane e cambio mese senza salto dovuto al giorno 31. |
| [src/ui/category-icon-hints.js](../src/ui/category-icon-hints.js) | Associazione semantica dei nomi di categoria alle icone. |
| [src/ui/category-icon-hints.test.js](../src/ui/category-icon-hints.test.js) | Test di regressione per `src/ui/category-icon-hints.js`. Associazione semantica dei nomi di categoria alle icone. |
| [src/ui/dashboard-actions.js](../src/ui/dashboard-actions.js) | Scelta delle azioni rapide pertinenti a profilo e dati esistenti. |
| [src/ui/dashboard-actions.test.js](../src/ui/dashboard-actions.test.js) | Test di regressione per `src/ui/dashboard-actions.js`. Scelta delle azioni rapide pertinenti a profilo e dati esistenti. |
| [src/ui/dashboard-clarity.css](../src/ui/dashboard-clarity.css) | Superficie calendario/disponibilità, gerarchie, temi, navigazione, orbite e pulsante tablet fisso. |
| [src/ui/financial-workspace.css](../src/ui/financial-workspace.css) | Stile adattivo di Analisi, Vault, controlli, modali finanziarie e microinterazioni. |
| [src/ui/first-use-hint.js](../src/ui/first-use-hint.js) | Condizioni per il suggerimento iniziale del pulsante +, senza ripetizioni inutili. |
| [src/ui/first-use-hint.test.js](../src/ui/first-use-hint.test.js) | Test di regressione per `src/ui/first-use-hint.js`. Condizioni per il suggerimento iniziale del pulsante +, senza ripetizioni inutili. |
| [src/ui/garanzia-dom.test.js](../src/ui/garanzia-dom.test.js) | Controlli su handler, nodi e collegamenti esistenti; non sostituiscono il test browser. |
| [src/ui/money-editor-values.js](../src/ui/money-editor-values.js) | Normalizzazione dei valori degli editor finanziari senza budget impliciti. |
| [src/ui/money-editor-values.test.js](../src/ui/money-editor-values.test.js) | Test di regressione per `src/ui/money-editor-values.js`. Normalizzazione dei valori degli editor finanziari senza budget impliciti. |
| [src/ui/onboarding-ready.css](../src/ui/onboarding-ready.css) | Riepilogo profilo e preferenze leggibili su schermi piccoli. |
| [src/ui/split-draft.js](../src/ui/split-draft.js) | ID stabili, importi validati e ripartizione multi-pagatore in centesimi esatti. |
| [src/ui/split-draft.test.js](../src/ui/split-draft.test.js) | Test di regressione per `src/ui/split-draft.js`. ID stabili, importi validati e ripartizione multi-pagatore in centesimi esatti. |
| [src/ui/split-money.js](../src/ui/split-money.js) | Formattazione coerente con valuta del gruppo e lingua, senza conversioni implicite. |
| [src/ui/split-money.test.js](../src/ui/split-money.test.js) | Test di regressione per `src/ui/split-money.js`. Formattazione coerente con valuta del gruppo e lingua, senza conversioni implicite. |
| [src/ui/split-workspace.css](../src/ui/split-workspace.css) | Moduli split, scelte delle quote, gruppi e messaggi con gerarchia adattiva e animazioni mirate. |
| [src/ui/theme-preference.js](../src/ui/theme-preference.js) | Risoluzione del tema di sistema e preferenza salvata. |
| [src/ui/theme-preference.test.js](../src/ui/theme-preference.test.js) | Test di regressione per `src/ui/theme-preference.js`. Risoluzione del tema di sistema e preferenza salvata. |
| [src/ui/viewport-inset.js](../src/ui/viewport-inset.js) | Calcolo degli spazi del viewport nei layout con tastiera. |
| [src/ui/viewport-inset.test.js](../src/ui/viewport-inset.test.js) | Test di regressione per `src/ui/viewport-inset.js`. Calcolo degli spazi del viewport nei layout con tastiera. |
| [tailwind.config.cjs](../tailwind.config.cjs) | Scansione e safelist delle classi usate per le utility precompilate. |

## Documentazione aggiunta per il merge

- `docs/merge-request-2026-09-11.md`: descrizione pronta per la PR, ordine di integrazione e stato reale.
- Questo manifesto: responsabilità di tutti i file del push.
- `docs/release-validation-2026-09-11.json`: conteggi estratti dal log della suite, file per file, con provenienza e hash del log.
- Aggiornati handoff, revisione e AGENTS.md al main d92a5dc, comprese le 13 collisioni rilevate.

## Revisione successiva dei motori

- [engine-integration-audit-2026-09-11.md](engine-integration-audit-2026-09-11.md): confronto completo del delta di main, vantaggi di entrambi i branch, contratti e rischi prima dell'integrazione.
- [audit-main-engines-repro.mjs](audit-main-engines-repro.mjs): riproduzioni sintetiche di difetti del main isolato; non è una suite che certifica il rilascio.
- [engine-audit-observations-2026-09-11.json](engine-audit-observations-2026-09-11.json): risultati delle riproduzioni con SHA analizzato.
- `AGENTS.md`, handoff e descrizione PR: collegamento alla revisione e avvertenza di preservare i controlli locali dei modelli/mesh, senza sostituzioni globali.
- Questo manifesto aggiunge il perimetro dell'audit; i 64 file di codice/release elencati sopra non cambiano per questa revisione documentale.
