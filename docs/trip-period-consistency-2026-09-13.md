# Periodo e spese esistenti

Riprodotto: una spesa salvata alle 00:15 locali veniva assegnata al giorno
UTC precedente dai controlli giorniScoperti/speseFuoriPeriodo. La lista usa
invece il giorno locale. Corretto il controllo, senza riscrivere transazioni.
Le dichiarazioni con sola data rimangono date civili senza conversione UTC.

20 test del periodo passati in Europe/Rome e America/New_York. Un test
verifica esplicitamente che aggiungere/cambiare il periodo mantenga tutte
le spese collegate, anche quelle fuori intervallo. Non è stata riprodotta
una cancellazione effettiva dalla lista; non dichiarare risolto qualsiasi
scenario di sparizione sulla sola base di questa correzione.

Indicazioni UI nelle sette lingue: periodo invertito; giornate senza spese
che non implicano un errore; spese fuori periodo conservate nella trasferta.
Build portable passata. Il nuovo testo UI resta da collaudare visivamente
insieme al percorso di creazione completa sul dispositivo dell'utente.
