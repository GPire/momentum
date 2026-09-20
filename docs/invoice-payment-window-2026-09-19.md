# Finestra indicativa degli incassi

In «Le tue fatture», quando l'azione è collegare un incasso, il motore mostra una finestra indicativa se ci sono almeno tre fatture completamente saldate dello stesso cliente, Paese e valuta. Usa la durata dalla data di emissione all'ultimo incasso confermato necessario al saldo. Le rate non aumentano il numero di esempi.

Seleziona esempi saldati negli ultimi 730 giorni con durata non negativa e non superiore a 400 giorni, senza date future rispetto ad asOf. Ordina le durate e usa gli estremi interni corrispondenti agli indici 25%/75% arrotondati verso l'esterno. È un intervallo empirico, NON un intervallo di confidenza calibrato, né una scadenza concordata o promessa. Tre esempi sono un minimo tecnico, non una prova di affidabilità commerciale. Nessun sollecito automatico.

Nessuna previsione se fattura corrente futura o saldata, cliente assente, date impossibili, meno di tre esempi, o registro degli incassi invalidato. Nessuna modifica ai dati originali, né uso di documenti esteri come esempi locali. La normalizzazione del nome non distingue tutti gli omonimi: non è un'identità fiscale verificata.

18 test superati: casi IT/EUR, CH/CHF, ES/EUR; versioni invalidate, futuro, campioni insufficienti, cliente diverso, rate, sette lingue. Interfaccia collegata alla lista esistente. Restano confronto con casi reali etichettati e collaudo visivo con storico sufficiente. Nessuna rete neurale addestrata né efficacia predittiva reale misurata in questo intervento.
