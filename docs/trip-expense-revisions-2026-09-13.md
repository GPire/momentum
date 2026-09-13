# Modifica delle spese di trasferta

L'editor riusa il modulo della trasferta: importo, descrizione, data, categoria
di rimborso, pasto e sostituzione dell'allegato. Annullare non modifica la spesa.
Una transazione già pagata non si converte in voce offerta tramite il toggle.

Ogni correzione conserva UUID, metadati sconosciuti, hash/prevHash di origine,
valori originali e revisioni. Gli hash preesistenti sono provenienza, non una
firma dei valori modificati. Il cambio di data sposta la voce nel nuovo mese.

Il digest include gli ID delle revisioni; il merge unisce le revisioni e non
resuscita cancellazioni. Lo sketch basato solo su ID viene escluso quando ci
sono revisioni. L'editor manda inoltre la correzione al percorso live dei propri
dispositivi. Le versioni precedenti dell'app non applicano questo protocollo:
aggiornare entrambi i dispositivi per sincronizzare correzioni.

Correzioni concorrenti sono conservate e segnalate. La vista usa una selezione
deterministica provvisoria; nell'editor sono elencate le alternative. Salvare
una nuova revisione dopo il confronto chiude il conflitto senza cancellare la
storia. Un editor aperto prima di una revisione remota non può sovrascriverla
con un salvataggio obsoleto. Non è una firma del responsabile aziendale.

Verifiche: 23 test mirati passati; Chrome, dati sintetici, cambio categoria
salvato mantenendo una sola voce e un allegato. Suite completa: 338/339 file;
l'unico errore era lo shim navigator nel nuovo test isolato, corretto e
rieseguito da solo con tutti i 5 test passati. Non testato su due telefoni
fisici o contro API di terze parti.

Resta da verificare il ciclo approvazione completo sulle revisioni: la modifica
locale invalida visivamente l'approvazione precedente; i codici di risposta
storici non sono ancora legati a un fingerprint della revisione esatta.
