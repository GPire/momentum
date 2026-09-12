# Fondamentali SEC con revisioni — 2026-09-12

## Problema
Il generatore sceglieva i valori usando filed, poi salvava soltanto anno e valore. I bilanci successivamente rettificati potevano quindi essere descritti come informazioni note all’acquisto. L’archivio attuale rimane una fotografia retrospettiva.

## Implementazione
- `annualSecFacts`: estrae annuali 10-K/10-K-A (form SEC `10-K/A`), con concetto XBRL, unità esplicita, inizio/fine periodo, data filed, accession number, valore e fonte. Accetta solo documenti con provenienza e date valide. Annuali separati dai trimestri; stock separati dai flussi.
- `secFactsAt`: seleziona per periodo e unità l’ultima versione depositata entro la data richiesta. Rettifiche future escluse, conflitti nello stesso giorno resi mancanti. La conoscibilità è a fine giornata: non certifica l’ora di disponibilità intraday.
- `bench:sec` usa queste funzioni e conserverà CIK, revisioni per misura e provenienza per anno nel prossimo archivio generato. Due periodi differenti nello stesso anno non vengono fusi silenziosamente. Rapporti con utile mancante non diventano zero.
- Il testo della tesi storica dichiara la ricostruzione retrospettiva. L’assenza di criteri contabili sopra soglia non viene più descritta come prova dell’assenza di motivi per investire.

## Limiti e prossimo passo
Nessun download o rigenerazione dell’archivio incorporato in questa modifica; i vecchi file non acquisiscono magicamente metadati persi. Nessun modello addestrato. Il selettore per data è integrato nel generatore; non esiste ancora un selettore storico nella UI. Servono rigenerazione controllata, confronto dei valori con i documenti originali, controllo dimensioni bundle e collegamento dei dati point-in-time ai confronti professionali. Aliases XBRL devono rappresentare la stessa misura economica: non unire concetti diversi per aumentare copertura. Le date fiscali delle componenti di un rapporto richiedono ulteriore controllo.

Non modificati schema Vault, dati utente, onboarding o layout. Il percorso testuale storico preesistente rimane italiano; nessuna certificazione di copertura in sette lingue.

Validazione: 332/332 file di test passati; build portable passata in 21,45 secondi; sintassi del generatore verificata. Nessun push o deploy eseguito.
