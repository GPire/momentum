# Rilascio fiscale: decisione e prove

Stato: NON verificato per la vendita come servizio fiscale completo IT/CH/ES o sostituzione universale del professionista. Non promettere una data o la leadership di mercato sulla base dei test unitari.

## Integrità del registro incassi — ultimo intervento

Il workspace trattava `entries` malformato come un registro vuoto; altre forme corrotte potevano causare eccezioni. Ora distingue un registro legacy assente da un registro presente ma danneggiato: restituisce un errore controllato e impedisce nuovi abbinamenti. Nessun dato sorgente viene cancellato, normalizzato o riscritto. I chiamanti ricevono `ok: false`, come per gli altri casi da riconciliare.

Due regressioni riprodotte prima della correzione. Dopo: 181 test nell'area fatture e 52 su report/ripristino superati. Questa verifica non chiude i criteri commerciali sotto elencati; il push condizionato alla prontezza del prodotto non è stato eseguito.

## Ultimo controllo: arretrati e report CH/ES

- Rimosso dal percorso UI l'avviso di omesso versamento ricavato retroattivamente dalla proiezione corrente. Non viene più generato il relativo ravvedimento né la notifica automatica. Il modulo di simulazione resta disponibile nel codice; non certifica un debito. Per riattivare veri avvisi servono obblighi confermati, periodo e pagamenti attribuiti alla singola scadenza. I promemoria manuali e le stime prospettiche rimangono disponibili.
- Report CH/ES: appendice degli abbinamenti confermati con documento, movimento UUID, data, importo, valuta e residuo attuale. Filtro per Paese e anno dell'incasso, comprese fatture di anni precedenti. Conferme invalidated dalle modifiche escluse e segnalate. HTML/CSV/JSON collegati ai pulsanti esistenti. Etichette e nota dell'appendice seguono le sette lingue; non significa che ogni nota fiscale legacy sia tradotta.
- La Svizzera mantiene il reddito manuale del simulatore; la Spagna mantiene il calcolo preesistente. L'appendice NON sostituisce imponibile o reddito fiscale con il netto incassato. I generatori nazionali che non salvano nello storico comune restano esclusi dall'abbinamento: questo collegamento non aggiunge retroattivamente fatture mancanti.
- 178 test mirati passati, produzione build portabile riuscita (21,91 s). Browser Chrome locale: sullo stesso profilo di prova la scadenza 2025 e la sanzione non compaiono più, il residuo della fattura resta 52 euro. Report CH/ES verificati mediante test dei dati e dei renderer; non è stato simulato un invio a un portale fiscale né collaudato un dispositivo fisico.

Fonte di controllo del principio: [Agenzia delle Entrate, correttivo/integrativo](https://infoprecompilata.agenziaentrate.gov.it/portale/redditi-aggiuntivo-e-correttivo/integrativo). Il ravvedimento riguarda imposte dovute e violazioni, non la sola estrapolazione del fatturato. Nessuna aliquota o formula normativa modificata in questo intervento.

Priorità ancora aperte: attribuzione dei versamenti all'anno/obbligo; storni, commissioni e FX; storico comune dei generatori nazionali; collaudo degli esiti ufficiali e conservazione; revisione professionale dei regimi venduti, condizioni commerciali e test fisici. Nessun nuovo push o deploy in questo passaggio.

## Errori corretti in questa revisione

- Export italiano: il totale non riceveva tutte le opzioni previdenziali che invece potevano raggiungere il dettaglio. Ora totale e dettaglio provengono dallo stesso taxSetAsideForPeriod, con anno richiesto e opzioni. I tre export della UI trasmettono cassa propria e altra copertura salvate. Eliminato il secondo ciclo di calcolo duplicato.
- Export spagnolo: il totale annuale veniva passato a retaIrpfPeriodo come reddito mensile e poi annualizzato. Ora lo scenario RETA usa media annua / 12, dichiarata come ipotesi; l'IRPF statale usa irpfEstatal sul totale annuale. Incassi e numero movimenti conservano i valori effettivi, inclusi importi numerici serializzati come stringhe. Importi invalidi esclusi con nota esplicita.
- Nessuna nuova aliquota, scadenza, deduzione o invio introdotto. Non è una dichiarazione spagnola completa: restano deduzioni, mesi reali, regolarizzazione, ritenute e componente regionale.

Nuovi test prima della correzione, poi 182 test mirati superati: export IT, ES/CH, CSV/JSON, tax.js e tax-es.js. Il caso 24000 euro in dodici mesi verifica separatamente incassato, IRPF e RETA. Le prove non certificano tutte le combinazioni fiscali.

## Criteri di autorizzazione al rilascio

Aggiornamento successivo: corretto il report IT che abbinava soltanto fatture emesse nell'anno selezionato. Ora l'abbinamento avviene sull'archivio completo una sola volta, poi gli incassi vengono filtrati per anno; fatturato e lista fatture emesse conservano il loro perimetro annuale. HTML, CSV e JSON espongono gli incassi abbinati con anno fattura e confidenza, compresi quelli di fatture precedenti. L'abbinamento resta euristico, non una conferma bancaria. L'età delle fatture aperte usa la data di generazione del report. 70 test mirati superati (export, cassa e versamenti) e build portable completata. Nessuna modifica o migrazione ai dati salvati; nessun nuovo test su dispositivo fisico. Il registro dei versamenti non ha un anno fiscale di riferimento: non dedurlo dalla data del pagamento.

1. Perimetro commerciale esplicito: destinatari, Paesi, regimi, esclusioni e funzioni vendute. Fatturazione, simulazione e dichiarazione sono capacità distinte.
2. Revisione professionale dei casi fiscali coperti con dataset di confronto e fonti versionate: risultati, arrotondamenti, periodi, rettifiche e cambi di regime.
3. Ricevute ufficiali collegate al documento/versione corretti; invii incerti, scarti e ripetizioni gestiti senza duplicati. Conservazione verificata separatamente dal backup.
4. Incassi parziali, pagamenti cumulativi, storni, valute, crediti e versamenti di anni precedenti: nessun abbinamento silenzioso o doppio conteggio. Verificare in particolare l'attribuzione per anno dei versamenti nel report italiano, che oggi riceve il registro completo.
5. Consegna al professionista controllata: periodo, documenti mancanti, importi esclusi, export leggibile e concordante tra formati, richieste di correzione e storico. Non attribuire a un export una dichiarazione già trasmessa.
6. Aggiornamento dai vecchi Vault, backup/ripristino e integrità allegati; test con archivi grandi. Nessuna perdita di dati.
7. Collaudo dei percorsi venduti su browser e dispositivi effettivi, tastiera mobile, accessibilità, sette lingue; accessi ufficiali autorizzati quando necessari.
8. Per la vendita: prezzi/diritti Free-Pro, gestione abbonamenti e annullamento, supporto e documentazione coerenti con le funzioni realmente disponibili. Questi aspetti non sono stati certificati in questo audit.

Ogni criterio richiede prove registrate e un esito. Fino ad allora è possibile valutare solo un'offerta delimitata di strumenti di preparazione/simulazione, non annunciare un servizio fiscale completo. Nessun push o deploy in questo passaggio.
