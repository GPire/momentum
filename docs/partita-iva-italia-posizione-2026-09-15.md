# Posizione P.IVA italiana — revisione 2026-09-15

## Cosa cambia

La parte P.IVA ora ha una composizione unica in
`src/predict/tax-position.js`. Il modulo non contiene una nuova formula
fiscale: coordina `tax.js`, `tax-cash-basis.js`, `tax-payments.js`,
`tax-deadlines.js` e `tax-rules.js`, così ogni numero conserva la sua origine.

La posizione distingue sempre:

- **fatturato per competenza**: fatture emesse nell'anno;
- **incassato per cassa**: pagamenti abbinati alle fatture, anche quando la
  fattura è dell'anno precedente;
- **stima del periodo e proiezione annuale**: calcolate dal motore già testato,
  con anno d'imposta, ATECO, cassa professionale, copertura previdenziale e
  regole aggiornate propagati fino in fondo;
- **versamenti dichiarati**: solo quelli che l'utente ha registrato, filtrati
  per anno;
- **scadenze future e scadute**: generate dalle regole versionate e collegate
  alla previsione di cassa quando la UI fornisce un forecast;
- **entrate ambigue e dati non validi**: conteggiati come lacune da confermare,
  mai trasformati in reddito imponibile in silenzio.

La funzione restituisce anche `status`, `confidence`, `missingInputs`,
`actionKeys`, `eligibility`, `matching` e `rules.freshness`. Sono codici e
metadati adatti alla UI multilingue: le frasi possono essere tradotte nel
percorso attivo senza mettere testo italiano dentro il contratto dati.

## Collegamento nell'app

`main.js` usa `buildItalianTaxPosition` per la proiezione della card fiscale e
per le impostazioni. Se un archivio storico ha una forma inattesa, il percorso
ricade sul proiettore precedente invece di bloccare l'interfaccia. Le fatture
create o importate sono ora sufficienti per rendere visibile la sezione P.IVA,
anche prima che arrivi il relativo bonifico.

Anche `buildAccountantReport` usa la stessa posizione: abbina gli incassi a
tutta la storia delle fatture (compreso dicembre → gennaio), mantiene il
riepilogo delle fatture filtrato per anno e inserisce nel JSON/HTML la base
della stima, lo stato dei dati, la proiezione e le regole applicate. Il CSV
aggiunge la stessa traccia nella sezione `Controllo posizione`, così il
contesto non si perde importandolo in un foglio o in un gestionale. Il report
non cambia i numeri osservati del periodo e non nasconde quando la proiezione
annuale è solo una stima.

Non vengono scritti nuovi campi nel Vault e non viene modificato alcun
movimento: l'abbinamento fattura-incasso è una vista calcolata. Il modulo
accetta sia l'oggetto Vault per mese sia un array, per facilitare l'integrazione
con import, export e futuri connettori. Gli importi serializzati come stringhe
vengono normalizzati prima delle somme; record non numerici o negativi restano
conteggiati come `invalidCount`/`clean_invalid_data` e non diventano reddito in
silenzio.

## Correzioni del percorso esistente

- `projectAnnualTax` ora rispetta `year`, `rulesOverride`, `cassaPropria`,
  `altraCoperturaPrevidenziale` e `overrides` anche nel calcolo finale;
- `suggestRegime` legge il tetto dalle regole dell'anno richiesto, mantenendo
  la firma precedente compatibile;
- il simulatore di apertura passa anno e regole aggiornate allo stesso motore;
- una proiezione basata su incassi dichiara la base come `cash` e usa una nota
  coerente, senza chiamare fatturato ciò che è stato realmente incassato;
- il registro fiscale espone `buildTaxPosition('IT', input)` come vista ricca,
  mentre `computeLiability('IT')` resta invariato per i consumatori semplici.

## Regole e limiti dichiarati

Le aliquote e le date non vengono inventate dal nuovo modulo. Restano quelle
del set versionato e degli aggiornamenti già validati nel progetto. Per il
2026 l'INPS pubblica le aliquote della Gestione Separata nella circolare n. 8
del 3 febbraio 2026; le scadenze operative vanno confrontate con lo
scadenzario ufficiale dell'Agenzia delle Entrate prima di un versamento.

Il risultato è una stima e un dossier di lavoro: non è una dichiarazione,
non invia F24, non attiva SdI, non decide deducibilità e non sostituisce il
commercialista. Una cassa professionale senza regole verificate resta indicata
come non calcolata. Nessun provider open banking o connettore esterno viene
attivato da questa revisione.

## Verifica

`src/predict/tax-position.test.js` copre fatturato/incassato, incasso di una
fattura dell'anno precedente, tetto misurato sugli incassi, fatture aperte,
input malformati e propagazione delle regole. La suite mirata fiscale e il
registro comune passano senza modificare i test esistenti.
