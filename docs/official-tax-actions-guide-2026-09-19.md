# Passaggi esterni: guida operativa IT, CH, ES

Le guide sono disponibili nel selettore dei servizi fiscali di Momentum in tutte le sette lingue. Avanzare o terminare una guida non cambia lo stato di una fattura, non attiva un servizio e non conferma un invio.

## Italia: conservazione

1. Preparare XML originali, elenco delle fatture e credenziali personali del titolare o delegato.
2. Aprire [Fatture e Corrispettivi](https://ivaservizi.agenziaentrate.gov.it/), selezionare il soggetto corretto e cercare il servizio di conservazione. Leggere l’accordo proposto prima di aderire. Non confondere la consultazione con la conservazione.
3. Verificare decorrenza, copertura delle fatture pregresse e modalità di conferimento. Controllare i riscontri di presa in carico dei documenti: l’adesione non prova da sola che ogni originale sia incluso.
4. Conservare accordo, riscontri e originali; verificare anche il recupero dei documenti. Collegare le copie ai documenti in Momentum. L’archivio locale resta una copia verificabile, non una certificazione di conservazione.

Fonte: [Garante, FAQ sulla fatturazione elettronica, servizio di conservazione](https://www.garanteprivacy.it/home/faq/fatturazione-elettronica). Il precedente collegamento diretto al PDF Adesione.pdf ha risposto 404 durante la verifica: la guida apre il portale invece di distribuire quell’indirizzo non funzionante. I nomi dei comandi dopo l’accesso vanno confermati con una sessione autorizzata; non sono stati collaudati in questa attività.

## Svizzera: presentazione e conferma AFC

1. Preparare impresa, periodo e rendiconto. eCH-0217 è un formato di caricamento dei dati, non una specifica delle ricevute.
2. Aprire [portale AFC](https://estvportal.estv.admin.ch/) e IVA pro. Se manca l’autorizzazione, seguire la [registrazione ufficiale](https://www.estv.admin.ch/it/rendiconto-iva-online). L’abilitazione iniziale può richiedere il codice inviato all’indirizzo della sede.
3. Distinguere chi prepara da chi presenta: il fiduciario può preparare, la persona autorizzata verifica e completa la presentazione. Controllare il risultato nel portale; pagamento e presentazione sono distinti.
4. Scaricare il riscontro effettivamente disponibile, mantenere l’originale e collegarlo al periodo/documento. Richiedere all’AFC la specifica del formato o un campione privo di dati personali autorizzato prima di implementare l’interpretazione automatica. Il lettore AFC resta non disponibile: nessuna analisi di parole in un PDF viene trattata come accettazione.

La pagina ufficiale riporta anche l’assistenza tecnica (+41 58 461 61 11). Non sono stati contattati terzi né effettuate presentazioni per il titolare.

## Spagna: verifica del documento

1. Preparare documento originale e CSV senza condividere il codice in chat o nei log.
2. Aprire [cotejo AEAT](https://sede.agenciatributaria.gob.es/Sede/procedimientoini/ZZ05.shtml). Inserire il CSV direttamente nel servizio e usare l’identificazione eventualmente richiesta.
3. Confrontare titolare, periodo e contenuto del documento restituito con l’originale. Un file assente, annullato o diverso richiede approfondimento, non conferma automatica.
4. Conservare l’originale e il riscontro. Il cotejo verifica il documento nel relativo servizio; non dimostra da solo correttezza fiscale, pagamento o conservazione conforme. Le istruzioni non sostituiscono gli adempimenti delle amministrazioni forali.

## Incarico professionale: consegna pronta

Usare il fascicolo e la matrice già presenti in `fiscal-external-validation-pack-2026-09-19.md` e `fiscal-professional-review-matrix.csv`.

Richiesta da consegnare al professionista scelto: «Verificare i casi del fascicolo per Paese, regime e periodo indicati. Per ciascun caso riportare risultato atteso, risultato osservato, fonte applicabile, errori e correzioni richieste; indicare data, identità del revisore e versione dei documenti esaminati. Verificare separatamente gli obblighi di conservazione e i riscontri di presa in carico. Non estendere l’esito ad altri regimi o periodi senza esame.»

Per l’Italia è disponibile la [ricerca dell’albo nazionale](https://commercialisti.it/albo-nazionale/ricerca-iscritti/). Per Svizzera e Spagna la guida in-app porta rispettivamente al contatto AFC e alla sede AEAT: il titolare sceglie poi il professionista abilitato e ne definisce incarico e autorizzazioni. L’iscrizione o il contatto non costituiscono incarico né revisione del software. Nessun incarico, adesione o costo è stato attivato da questa guida.

## Checklist per chiudere le prove esterne

Questa checklist non permette di auto-certificare un risultato. Ogni riga è chiusa soltanto quando il documento indicato è disponibile, riferito al caso esatto e collegato nell’archivio della fattura.

| Prova | Azione del titolare o delegato | Documento da raccogliere | Stato che Momentum può mostrare |
| --- | --- | --- | --- |
| Conservazione italiana | Accedere a Fatture e Corrispettivi, leggere e accettare l’accordo di conservazione, verificare decorrenza e presa in carico | accordo, riscontro di presa in carico, XML originale | documento collegato — da verificare |
| Rendiconto AFC | Ruolo autorizzato: importare eCH-0217 v2.0.0 se previsto, verificare dati e completare l’inoltro in IVA pro | conferma disponibile nel Portale AFC, rendiconto e originali | documento collegato — da verificare |
| Specifica/ricevuta AFC | Usare solo una ricevuta della propria impresa o un campione formalmente autorizzato; chiedere all’assistenza AFC la fonte tecnica prima di sviluppare un lettore | campione autorizzato o riferimento alla specifica, senza dati di terzi | campione acquisito — interpretazione non certificata |
| Revisione professionale | Incaricare un professionista e consegnare la matrice dei casi | parere datato, autore identificato, fonti, versione esaminata e correzioni | parere collegato — da verificare |
| Collaudo autentico | Operare solo su documenti e portali per cui il titolare ha autorizzazione | documento originale, riferimento dell’operazione, ricevuta/esito | esito collegato — da verificare |

Per l’AFC, la pagina ufficiale conferma che il formato XML supportato è **eCH-0217, specifica e-IVA 2.0.0** e che dopo l’importazione i dati vanno verificati e il rendiconto inoltrato normalmente. L’azienda e il periodo sono riconosciuti nel flusso di importazione; questo non costituisce una ricevuta né una prova di accettazione. Fonte: [FAQ AFC](https://www.estv.admin.ch/it/domande-e-risposte).

### Testo pronto per richiedere la revisione

> Chiedo la revisione dei casi allegati per Paese, regime e periodo indicati. Per ogni caso, indicare fonte applicabile, risultato atteso indipendente, risultato osservato, eventuali correzioni e limiti. Il parere deve riportare nome del revisore, data e versione dei documenti esaminati. Chiedo inoltre di distinguere gli obblighi di conservazione dai controlli di correttezza fiscale.

### Testo pronto per chiedere chiarimenti tecnici all’AFC

> Per il rendiconto IVA pro della nostra impresa, chiediamo il riferimento ufficiale applicabile al riscontro prodotto dopo l’inoltro e la modalità corretta per conservarlo e verificarlo. Utilizziamo eCH-0217 v2.0.0 esclusivamente per l’importazione del rendiconto. Non chiediamo né inviamo dati di altre imprese.
