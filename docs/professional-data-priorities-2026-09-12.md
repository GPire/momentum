# Priorità dati professionali — 2026-09-12

## Correzione consegnata
`aggiornaConRicaduta(['curva'])` ora richiede T10Y3M (spread decennale meno tre mesi), non DGS10 (livello del tasso decennale). Fonte dedicata nel registro esistente. Test con spread negativo e zero. Nessuna fonte alternativa semanticamente diversa.

## Priorità di ampliamento
1. Fondamentali point-in-time: riutilizzare SEC companyfacts/submissions con data deposito, periodo fiscale, unità, accession number e revisioni. Evitare anticipazione di informazioni nei backtest; integrare cash flow, debito e diluizione quando disponibili e comparabili.
2. Macro vintage: FRED/ALFRED con data osservazione e data conoscibilità. Risolvere prima l’ambiguità 533/534 mesi del pannello legacy: non spostare le date senza riscontro.
3. Esposizioni e comparabili: paesi, settori, segmenti di ricavo, concentrazione clienti e costi; distinguere dati dichiarati dalle inferenze. Similarità contabile, correlazione dei rendimenti e meccanismi causali sono evidenze diverse.
4. Trading/crypto: liquidità, spread, volumi, corporate actions/delisting; per derivati crypto funding e open interest separati per exchange e contratto. Non simulare order book o profondità inesistenti.
5. Eventi datati: documento originale, data pubblicazione, società/settori coinvolti, ipotesi di trasmissione e contro-evidenze. Collegare ai moduli storici esistenti senza etichettare automaticamente una correlazione come causa.

Ogni ingresso deve dichiarare fonte, unità/valuta, periodo, frequenza, copertura, aggiornamento, revisioni e diritti d’uso. L’assenza di questi campi non può diventare uno zero o una prova positiva. Una nuova fonte non costituisce automaticamente apprendimento né un miglioramento validato del modello.

Fonti primarie consultate:
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://alfred.stlouisfed.org/help/downloaddata
- https://fred.stlouisfed.org/docs/api/fred/series_vintagedates.html

Stato: roadmap, non dataset nuovi già acquisiti. Non effettuati acquisti, nuovi download, training, push o deploy. 34 test fonti/freschezza passati.
Build portable passata in 16,93 secondi; suite completa non ripetuta per questa correzione isolata.
