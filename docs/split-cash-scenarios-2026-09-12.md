# Confronto rimborso e liquidità

Il motore `bestLevers` confronta il pagamento immediato di un debito split con un pagamento ipotetico alla prima data di accredito futura nell'orizzonte. Usa lo stesso registro degli impegni e lo stesso profilo di spesa nei due casi. Propone il rinvio solo se elimina i giorni sotto il cuscinetto nello scenario prudente. Il saldo finale è identico: rimandare non crea risparmio.

Senza saldo esplicito `cashForecast` non propone questa leva. Un accredito insufficiente, non confermato o fuori orizzonte non giustifica una promessa di copertura. Nessuna data di rimborso, transazione, modello appreso o debito viene modificato: è una simulazione, non un pagamento né un accordo col creditore. L'ordine intragiornaliero degli addebiti resta fuori dal modello giornaliero.

Il vecchio messaggio che affermava automaticamente la copertura dello stipendio è rimosso. La UI attuale filtra le leve anche sul rischio della linea base: il confronto numerico restituito in `comparison` non ha ancora una presentazione dedicata. Non annunciare una nuova schermata o un nuovo modello neurale addestrato.

Regressioni: stipendio insufficiente; rinvio sostenibile senza risparmio inventato; bolletta successiva allo stipendio; liquidità già sufficiente. I tre test nuovi fallivano prima della correzione, poi 48/48 test del modulo sono passati.
