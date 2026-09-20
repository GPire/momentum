# Fisco: condizioni per un'offerta a pagamento

Revisione mirata del codice locale del 19 settembre 2026, non certificazione normativa né confronto completo con tutti i concorrenti. Le modifiche UI precedenti sono ancora locali. Non è stato verificato un nuovo stato remoto in questo passaggio.

## Copertura osservata

| Paese | Moduli esistenti da riutilizzare | Distinzione da mantenere |
| --- | --- | --- |
| Italia | tax.js, tax-deadlines.js, tax-payments.js, invoice-engine.js, fatturapa-xml.js, fatturapa-import.js, it-fiscal-id.js | Preparazione XML e promemoria non sono trasmissione, ricevuta o conservazione fiscale. main.js marca oggi manualmente sdiTransmitted. |
| Svizzera | tax-ch.js, swiss-qr-bill.js, swiss-qr-reference.js | QR di pagamento e stime fiscali non costituiscono un sistema contabile e dichiarativo completo. |
| Spagna | tax-es.js, tax-deadlines-es.js | Stime/scadenze non costituiscono un sistema SIF verificato. Nessun percorso VERI*FACTU trovato nella ricerca del codice src/server. |

country-invoicing.js offre IT e DEFAULT: CH/ES non hanno in questo generatore un profilo nazionale dedicato. Il percorso QR svizzero è separato. Non trasformare DEFAULT in una dichiarazione di copertura nazionale, né aggiungere un Paese cambiando soltanto aliquota e valuta.

## Ordine di sviluppo proposto

1. **Registro fatture e incassi verificabile.** Riutilizzare invoices e importatori, distinguendo bozza, documento esportato, emissione confermata, incasso parziale/completo, storno e contestazione. Una conferma manuale va distinta da una ricevuta ufficiale. Collegare movimenti tramite ID, non soltanto importo: evitare doppi incassi e doppio accantonamento. Prima verificare i percorsi esistenti e le migrazioni.
2. **Prossima azione unica.** Sul documento mostrare cosa manca, come risolverlo e cosa avverrà dopo; mantenere in evidenza importo, cliente e stato. Dettagli nazionali solo quando pertinenti. Nessun altro pannello affollato.
3. **Chiusura nazionale.** Italia: canale SdI, ricevute, scarti, rettifiche e conservazione verificati. Spagna: requisiti SIF applicabili, registri e modalità di trasmissione verificati secondo ambito del contribuente. Svizzera: requisiti documentali, tracciabilità e rendicontazione pertinenti. Non promettere queste funzioni come già realizzate.
4. **Collaborazione professionale.** Consegna versionata a chi segue la contabilità, richieste di correzione, allegati e storico delle risposte. Nessuna credenziale fiscale in frontend; ruoli e accessi vanno collaudati.
5. **Intelligenza misurata.** Suggerimenti di riconciliazione con motivi e livello di fiducia; astensione nei casi ambigui. Le correzioni confermate possono migliorare i suggerimenti, non riscrivere le norme o i movimenti automaticamente. Valutare precisione dei suggerimenti, falsi abbinamenti e tempo di completamento su casi separati dai dati di sviluppo.

## Prove necessarie prima della vendita del percorso completo

- Incassi parziali, un pagamento per più fatture, due fatture di pari importo, commissioni, cambio valuta, storni, reimportazioni e UUID.
- Ricevuta tardiva o negativa dopo un tentativo d'invio; ripetizione senza duplicati; modifica di un documento già emesso.
- Aggiornamento da archivi precedenti, ripristino backup e nessuna perdita di allegati o riferimenti.
- Percorso completo mobile con tastiera, desktop, accessibilità e lingue; esportazioni realmente aperte e controllate.
- Collaudo autorizzato dei canali fiscali. Un test locale o un XML ben formato non sostituisce questa prova.

## Correzioni di questo passaggio

- Codici Paese normalizzati anche quando contengono spazi: ` IT ` prima perdeva il profilo italiano e usava DEFAULT.
- Tolte dai documenti le affermazioni di validità fiscale non verificata. Il PDF italiano non attesta trasmissione/esito; il profilo generico esplicita i requisiti nazionali non verificati. Lingue documentali esistenti conservate: italiano ed inglese.
- Nessuna modifica a importi, aliquote, Vault o stato delle fatture; nessun nuovo modello addestrato, connettore o invio fiscale attivato.
- Test mirati: 94 superati (profili, motore fatture, PDF, FatturaPA, QR svizzero). Non equivalgono a certificazione fiscale.

## Fonti primarie consultate

- AEAT, [SIF e VERI*FACTU](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html) e [ambito e requisiti](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/cuestiones-generales.html): integrità, conservazione, tracciabilità e inalterabilità dei registri.
- AFC, [domande e risposte IVA](https://www.estv.admin.ch/it/domande-e-risposte): prova della provenienza e dell'inalterabilità dei dati rilevanti.
- Agenzia delle Entrate, [bollo sulle fatture elettroniche](https://www1.agenziaentrate.gov.it/web_app_entrate/bollo_fatture.html): elaborazioni, esiti e fatture scartate; non ridurre il ciclo alla creazione del file.

Non sono stati fissati prezzi, date di lancio o una promessa di sostituzione universale del commercialista. Il primo prodotto vendibile va delimitato alle funzioni effettivamente collaudate.
