# Invio aziendale e feedback

Le trasferte legate a companyPolicy aprono una conferma esplicita prima
dell'upload al servizio sullo stesso origin. Le trasferte personali mantengono
il flusso precedente. Nessun upload avviene aprendo la schermata.

Il client controlla dimensione, versione e fingerprint della ricevuta del
server. In caso di errore distingue accesso, policy cambiata, revisione,
limite allegati e rete con testi nelle sette lingue. Il pulsante è disabilitato
durante l'invio; una ricevuta nota per lo stesso snapshot evita il reinvio.

Un retry della stessa revisione e fingerprint sul server restituisce il
record esistente solo se è ancora l'ultima revisione e l'accesso è attivo.
Un nuovo contenuto non viene confuso con il retry. La ricevuta locale conserva
reportId, revision e fingerprint; non imposta uno stato di approvazione.
Le modifiche locali successive rimangono distinte dal contenuto già inviato.

Test mirati client/server e build portable passati. Chrome su origine isolata
4196: invio con risposta sintetica 503 mostra mancata conferma, riabilita il
pulsante e non mostra ricezione riuscita. Nessuna azienda o spesa reale usata.

Restano distribuzione, account reali, inbox e lettura degli esiti nella UI,
riconciliazione completa delle revisioni fra dispositivi e allegati oltre
256 KiB. Il limite include tutto l'archivio. Non dichiarare completato il
percorso operativo aziendale o la sostituzione di un gestionale enterprise.
