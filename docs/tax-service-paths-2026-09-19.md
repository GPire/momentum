# Percorsi fiscali per attività

Estensione locale della guida ufficiale: menu per attività e Paese, senza nuovi motori fiscali o trasmissioni.

- Italia: fatture/documenti e F24 Web; accesso al riepilogo per commercialista nei formati esistenti.
- Spagna, territorio comune: fatturazione, Modelo 130 e Modelo 303 separati; accesso al riepilogo esistente. Non viene affermato che ogni autonomo debba presentare entrambi.
- Svizzera: rendiconto IVA; il pulsante del riepilogo passa dal simulatore esistente, che richiede il reddito prima dell'esportazione. Non viene inventato un valore per aggirare il controllo.
- Territori forali spagnoli o valori non riconosciuti: nessun percorso AEAT comune o esportazione comune proposta automaticamente. Indicazione di verificare l'amministrazione competente; possibilità di rivedere il territorio. Non è ancora una guida forale completa.

La vecchia guida SdI usa ora lo stesso componente a quattro passi, preservando il nome del file e l'accesso alla conferma manuale preesistente. Rimossa la prescrizione universale di scegliere «Me stesso», inappropriata per chi opera con delega. La conferma non dice più che tutto è «a posto»: distingue dichiarazione dell'utente ed esito ufficiale. Nessun cambiamento dei record invoices o dei calcoli in questo passaggio.

## Fonti primarie verificate

- https://telematici.agenziaentrate.gov.it/Main/F24web.jsp
- https://sede.agenciatributaria.gob.es/Sede/tramitacion/G601.shtml
- https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/modelo-130.html
- https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303.html
- https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/modelo-303.html

Nessuna scadenza, aliquota, compensazione o debito ricavato da questi link e scritto nel Vault. Nessun accesso autenticato o pagamento effettuato.

## Verifiche

63 test mirati superati (servizi, guide, workspace, fatture, versamenti e scadenze spagnole); build portable superata con l'avviso preesistente sui chunk grandi. Browser Chrome reale: menu Italia, F24, passaggio al selettore export; menu Spagna con 130/303, percorso 303, viewport 390×844. Nessun invio o esportazione reale effettuato in questa verifica. Le altre lingue e l'instradamento dei territori sono verificati con test di dati, non con un collaudo visivo completo di tutte le combinazioni.

## Non ancora completo

Restano procedure specifiche per apertura/cessazione attività, dichiarazioni annuali e rettifiche, previdenza, cantoni svizzeri e amministrazioni forali; consegna versionata e collaborazione autorizzata col professionista; esiti ufficiali collegati alle fatture e conservazione; verifica autenticata dei portali e dispositivi fisici. Il menu guidato non equivale a un servizio fiscale completo vendibile come sostituto del professionista.

Tutto rimane locale: nessun commit, push o deploy di questo passaggio.
