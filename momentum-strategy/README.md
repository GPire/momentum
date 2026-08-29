# Momentum — documenti di strategia e architettura AI

Tre documenti scritti il 2026-08-30, ciascuno con fonti verificabili citate in fondo — nessuna cifra di mercato o "interesse di acquisizione" è mai stata inventata. Apri direttamente i file `.html` in un browser per leggerli con la formattazione completa.

1. **`01-posizionamento.html`** — inventario onesto delle capacità reali nel codice + dati di mercato reali (partite IVA Italia, indipendenti Svizzera, costi di compliance fintech, mercato Edge AI) + categorie di partner plausibili (mai nomi con un'offerta pronta) + roadmap a 3 orizzonti condizionata a segnali verificabili.
2. **`02-architettura-ai.html`** — blueprint tecnico per 4 modelli AI proprietari on-device (Momentum-Tax-LM, Momentum-Categorizer, Momentum-Macro-Signal, Momentum-QA), ancorato a cosa esiste già nel repo (quantizzazione INT8, slot heavy-expert, motori fiscali per paese) + tecniche con fonti reali (DistilBERT, LoRA, GGUF, EdgeMoE) + framework fiscale modulare proposto + roadmap tecnico a 3 stadi.
3. **`03-espansione-ip.html`** — inferenza causale, modelli crypto, fattori quantitativi dai filing SEC + una verifica REALE (non assunta) dei problemi di business di Robinhood/Trade Republic/Revolut, inclusa una correzione: la premessa originale su Robinhood ("problema di retention") era smentita dalla sua stessa earnings call Q4 2025.

Copie live (con tema chiaro/scuro automatico) pubblicate come Artifact in questa conversazione — chiedi il link se ti serve condividerle.

## Cosa è stato effettivamente costruito, non solo scritto

In parallelo al terzo documento, la quantizzazione INT8 già in produzione per il Meso (`src/ai/trained-meso.js`) è stata estesa al Nano (`src/ai/trained-categorizer.js`) — il modello sempre attivo anche sul tier hardware più debole, dove prima girava solo in float. Vedi il commit corrispondente nel repository per il dettaglio.
