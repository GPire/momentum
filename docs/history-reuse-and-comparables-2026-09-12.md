# Riutilizzo degli archivi e comparabili — 2026-09-12

## Inventario verificato sugli export del codice
- daily-long: 10.487 date di borsa, 1985-01-03–2026-08-19, 11 serie con inizi differenti (non 41 anni per ogni asset).
- materie-prime-panel: calendario di 792 mesi, 1960-01–2025-12, 14 serie con coperture differenti; terre rare tramite proxy ETF.
- macro-panel: 533 mesi dichiarati, inizio dichiarato 1982-01 e fine 2026-06. Questi estremi inclusivi implicano 534 mesi: verificare allineamento e generatore prima di estendere backtest causali.
- global-panel: SPY, EFA (MSCI EAFE), EEM (emergenti), NFCI e ANFCI. Non chiamare questo pannello MSCI World.
- fondamentali-storici: 82 ticker, SEC, download dichiarato 2026-08-22.
- panel-settoriale: 600 aziende, 554 ticker disponibili, download dichiarato 2026-08-27.

I nuovi download di ricerca non sostituiscono questi archivi. Non è corretto descrivere tutti i dati come fermi al 7 agosto.

## Cambiamenti nel percorso esistente
Comparabili: stesso gruppo SIC e stesso anno del bilancio target; nessun ricavo mancante sostituito con 1. Ricavi non positivi esclusi; target non disponibile provoca astensione. Rapporto ricavi, distanza logaritmica e differenza di margine sono restituiti come evidenze verificabili. Il Q&A esistente espone anno e rapporto dimensionale, senza promettere somiglianza dei rendimenti o convenienza d’investimento.

Eventi lunghi: copertura restituita per serie; serie incomplete escluse dal confronto migliore/peggiore. Tasso decennale escluso dalla classifica investimenti e descritto come variazione relativa del tasso. Assenza nell’archivio non equivale a inesistenza dell’asset. Nessuna causa dedotta dal solo rendimento.

## Lavoro successivo ad alto impatto
1. Audit dell’allineamento macro prima di usare storia lunga nei percorsi causali.
2. Bilanci con data effettiva di pubblicazione/revisione, non solo anno fiscale, per confronti point-in-time. Stesso anno non garantisce stessa data di disponibilità né identico periodo fiscale.
3. Collegare esposizioni settoriali, geografica e ricavi delle aziende a scenari macro, mantenendo separati meccanismi ipotizzati, stime e diagnostica.
4. Per trader: corporate actions, delisting, bid/ask, liquidità e costi reali. Gli archivi attuali non equivalgono a un feed intraday professionale.
5. Il percorso mercato-qa esistente è prevalentemente italiano: queste modifiche non certificano la localizzazione completa in sette lingue.

Nessun dato utente, schema Vault o peso neurale modificato. Nessun nuovo dataset scaricato né modello addestrato in questa integrazione. Nessun deploy eseguito.

## Validazione
44 test mirati passati; suite completa 331/331 file passata; build portable di produzione passata (22,72 secondi). Restano gli avvisi sulle dimensioni dei bundle. Nessuna verifica visuale/native aggiuntiva in questa integrazione di logica.
