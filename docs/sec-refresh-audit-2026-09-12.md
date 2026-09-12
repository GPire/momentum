# Acquisizione e audit SEC — 2026-09-12

Scaricati da SEC companyfacts 82 emittenti: 45.488 osservazioni annuali con provenienza, revisioni incluse. Il candidato completo occupa 18.874.885 byte. Le revisioni sono osservazioni contabili, non 45.488 bilanci distinti.

L’archivio avanzato già presente nell’app resta la base. Nessuna modifica a `fondamentali-storici.js`, `panel-settoriale.js`, storici prezzi o macro. Nessuna sostituzione numerica né perdita di dati utenti.

## Risultati verificati
- Primo candidato: 2.924 valori prima disponibili diventavano mancanti.
- Correzione: fotografie trimestrali dentro i 10-K escluse dai valori annuali usando le date di fine degli esercizi annuali; priorità esplicita dei concetti XBRL, senza scambiare un alias diverso per una rettifica.
- Secondo candidato: nessuna azienda o anno precedente perso, 2 anni aggiunti; ancora 96 valori mancanti e 901 differenze oltre la tolleranza del confronto.
- Le differenze riguardano soprattutto patrimonio netto (446) e ROE (407). Non sono automaticamente miglioramenti: la base contabile (inclusione di interessenze di terzi, concetto prioritario) va verificata.
- Gate copertura FALLITO: il candidato non è promosso nell’app. Anche un gate copertura passato non certificherebbe la correttezza dei valori cambiati.

## Riproduzione
`node bench/fetch-fondamentali-sec.mjs` ora scrive un candidato in `bench/data/research-universe/sec-candidate.mjs`; `SEC_OUTPUT` consente un percorso esplicito. Download incompleti non vengono scritti. Il recapito User-Agent può essere configurato con SEC_CONTATTO.

`node bench/sec-fundamentals-audit.mjs bench/data/research-universe/sec-candidate.mjs bench/data/research-universe/sec-audit.json` confronta sei misure con il vecchio archivio e restituisce codice 2 se perde copertura. Confrontare anche misure aggiuntive prima della promozione finale.

Il download verificato è `bench/data/research-universe/sec-candidate-reviewed.mjs`; il report completo è `sec-audit-reviewed.json` nella stessa directory. Sono artefatti locali ignorati da Git. Il riepilogo versionato è `docs/sec-refresh-audit-2026-09-12.json`. Nessun dato nuovo distribuito né addestramento eseguito. Nessun nuovo dato SEC definito point-in-time in UI: il selettore è preparato e testato, resta da promuovere un archivio verificato.

Validazione: 332/332 file di test passati; build portable passata (22,57 s); sintassi generatore verificata. Ricontrollati 15.912 valori selezionati contro i record scaricati dello stesso concetto e periodo (coerenza interna, non revisione indipendente dei documenti). Audit sul candidato esce correttamente con codice 2.
