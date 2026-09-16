# Archivio aziendale: confronto aggiornato

Non è dimostrato che Cloudflare sia il meno costoso dell'intero mercato.
Questo confronto riguarda cinque opzioni rilevanti; prezzi pubblici in USD,
senza imposte, sconti negoziati o costi di sviluppo. Verifica: 14 settembre 2026.

| Servizio | Quota iniziale rilevante | Vincolo per Momentum | Valutazione |
|---|---|---|---|
| Cloudflare D1 Free | 500 MB/database, 5 GB/account, 50 query/invocazione | Database, non object storage; CPU, query, dimensione dei risultati e backup vanno collaudati | Pilota nell'account esistente, non archivio documentale definitivo |
| Backblaze B2 | Primi 10 GB gratuiti; partenza senza metodo di pagamento documentata | Serve un account e un connettore privato autenticato; quote API/uscita da considerare | Candidato prioritario per file e conservazione |
| Supabase Free | 1 GB file, 500 MB database, 5 GB uscita più 5 GB cached | Pausa dopo una settimana inattiva; limiti di progetto; implementazione auth/isolamento da adattare | Interessante se vogliamo anche Postgres e autenticazione integrata |
| Appwrite Free | 2 GB storage, 5 GB API bandwidth/mese | Risorse condivise e limiti di organizzazione/funzionalità; requisito carta non collaudato in un account | Alternativa integrata da approfondire, non vincitore verificato |
| Cloudflare R2 Standard | 10 GB/mese gratuiti, quote operazioni | Nell'account corrente attivazione con sottoscrizione e possibili addebiti: escluso dal requisito attuale | Rivalutare solo con autorizzazione ai costi |

Per il solo storage a pagamento, B2 pubblica $6,95/TB/mese contro
$0,015/GB/mese R2 Standard: non sono preventivi complessivi. B2 include uscita
fino a 3 volte lo storage medio, poi $0,01/GB salvo partner qualificati; R2
non applica costi di egress diretto. Molti download possono cambiare il confronto.
Supabase e Appwrite includono servizi diversi: confrontare solo GB nasconde
i costi di autenticazione, gestione, notifiche e operatività.

## Decisione

Continuare il pilota D1 già autorizzato, mantenere il driver di storage separato,
valutare B2 per la crescita dei documenti senza scegliere o attivare in silenzio
un nuovo provider. Non duplicare account per aggirare quote. Nessun servizio
gratuito qui esaminato prova capacità, SLA e supporto illimitati per multinazionali.
Hosting autonomo può ridurre alcuni canoni ma richiede server, backup e gestione:
non equivale a costo zero.

## Fonti primarie

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://www.backblaze.com/cloud-storage/pricing
- https://help.backblaze.com/hc/en-us (guida Cloudflare/B2: avvio senza metodo di pagamento)
- https://supabase.com/pricing
- https://appwrite.io/pricing

## Implementazione e prove

Acquisizione/rilascio blocchi per 64 allegati: tre statement complessivi,
inserimento atomico con trigger di esclusione della pulizia. D1 legge i file in
gruppi di otto, controlla prima le dimensioni effettive e poi hash e contenuto.
Invio locale con 64 allegati distinti: 15 statement SQL, dati ricostruiti uguali
all'originale. Il test usa file sintetici piccoli: non prova CPU/memoria cloud
con 32 MiB di dati o prestazioni sotto carico. Suite: 40 test passati.

Cloud reale: creato `momentum-company-pilot`, giurisdizione UE,
database `3fc15a8d-3676-4510-ac27-8cf46c5651b0`, account già disponibile.
Nessuna carta inserita o R2 attivato. Tabella `momentum_pilot_probe` per dati
sintetici. Scrittura e lettura del valore binario 01020304 verificate in console.
Verificata anche la scrittura di `zeroblob(1000000)` e la successiva lettura
della lunghezza: 1.000.000 byte. È un test SQL sintetico, non un upload via app.
Questo NON è ancora il collaudo end-to-end Worker/Access/D1 dell'app.
