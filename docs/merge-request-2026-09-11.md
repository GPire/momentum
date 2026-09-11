# Integra UI semplificata, Split e motori aggiornati con protezioni sui dati

Dashboard, Analisi e Vault distribuivano le azioni in troppe superfici; lo Split rendeva difficile distinguere anticipi, quote e rimborsi. Questo aggiornamento raggruppa le sezioni, apre gli editor direttamente e conserva la nuova UI insieme ai motori fiscali e previsionali di main `d92a5dc`.

## Interfaccia e flussi

- Dashboard: calendario, periodo e disponibilità nella stessa superficie; riepiloghi raggruppati e azioni rapide direttamente sugli editor. Pulsante di aggiunta tablet in basso a destra.
- Analisi/Vault: gerarchie per argomento, moduli coerenti, complessità contestuale, tema automatico o esplicito e gestione della navigazione. Si riutilizzano gli editor e i nodi vivi.
- Primo avvio: profilo più leggibile, budget facoltativo, preferenze nello stesso flusso, suggerimento del pulsante + e accesso da inviti Split.
- Split: identità per ID anche con nomi uguali; validazione degli importi e tastiera decimale; arrotondamenti esatti con più pagatori; quote personalizzate conservate; riepilogo personale distinto dagli altri rimborsi. Un conto da 60 euro in tre mostra 20 euro ciascuno, con possibilità di cambiare le singole quote.
- Rimborso: messaggio modificabile, valuta coerente, link compresso e ritorno alla bozza senza perdere i campi. Copia/condivisione restano azioni esplicite dell'utente; non registrano un pagamento.
- Grafica: controlli coerenti con Momentum, microtransizioni, profondità CSS, placeholder brevi, target touch e rispetto del movimento ridotto. CSS compilato prima dell'avvio per evitare icone temporaneamente enormi.

## Motori e compatibilità

I 13 conflitti con main sono risolti per funzione: conservati calibrazione Cassa Unica, storico mercati, attività CH/AVS, previdenza professionale IT, scadenze ES, export strutturato e Centro Fiducia. Conservati opt-out telemetria, controlli locali di importazione, modelli, mesh e licenze. La scoperta fiscale segue il Paese dichiarato; l'onboarding non assegna una licenza Pro.

Correzioni aggiuntive: finestra temporale della calibrazione coerente con la previsione, scadenze di oggi visibili, protezione formule/metadati CSV, parametri invalidi dello storico respinti e scritture IndexedDB confermate al commit. Nuove stringhe completate nelle sette lingue. I testi legacy fuori dai dizionari e il riconoscimento linguistico del motore storico restano limiti distinti.

Nessun cambio delle chiavi attive o reset dello schema. Prima della riconciliazione viene salvato un checkpoint locale delle copie leggibili, incluso apprendimento divergente, esportabile dal Vault. Fixture sintetiche di entrambi i branch verificano transazioni/hash, profilo, modelli, campi sconosciuti, licenze, riavvio e backup cifrato/in chiaro. Questo non garantisce protezione dalla cancellazione dei dati del browser o da guasti fisici. Un sottodominio usa un archivio separato e richiede un trasferimento esplicito via backup.

## Validazione

- **4.839 test, 316/316 file passati, zero skip**, Node 24 e processi isolati, inclusi i test di fuso con sottoprocessi reali.
- Build di produzione portabile riuscita (21,15 secondi); warning sui chunk grandi ancora presente. La build standard remota va verificata nel deploy.
- Browser isolato: onboarding CH senza reddito/budget obbligatori, Dashboard, riavvio, Vault/Centro Fiducia e Split diretto; modale contenuta a 390 × 844, nessun errore console osservato. Prove precedenti: dieci partecipanti, omonimi, più anticipi, quote, ritorno dal rimborso e inviti.
- `git diff --check` superato. Nessuna attestazione di test fisici iOS/Android o certificazione degli store.

## Documentazione per la revisione

- [Integrazione finale, correzioni e protezione dati](merge-validation-2026-09-11.md)
- [Manifesto cumulativo file per file](push-file-manifest-2026-09-11.md)
- [Revisione funzionale delle schermate](release-review-2026-09-11.md)
- [Contratti UI e motori](integration-handoff-2026-09-11.md)
- [Audit dei motori prima delle correzioni](engine-integration-audit-2026-09-11.md)

La proposta commerciale nuova di main non viene attivata implicitamente. Open banking e HealthKit restano preparazione, non funzioni operative. I controlli non promettono percentuali di conversione né compatibilità nativa non provata.
