# Accesso Momentum per azione — proposta, 14 settembre 2026

Decisione proposta: l'identità centrale serve alla collaborazione, non all'uso
personale. Nessun nuovo provider attivato e nessun nuovo flusso distribuito.

| Situazione | Accesso previsto | Confine |
|---|---|---|
| Dashboard, budget, OCR e bozza trasferta locali | Nessun account cloud | Protezione del dispositivo/Vault separata |
| Esportare il proprio resoconto dal dispositivo | Nessun nuovo account | Esportazione volontaria, non invio/approvazione aziendale |
| Entrare nello spazio aziendale | Passkey o SSO aziendale | Invito valido e membership attiva, non dominio email sufficiente |
| Leggere resoconti o allegati aziendali | Sessione verificata + ruolo | Nessun link pubblico come sostituto dei permessi |
| Approvare o cambiare policy/ruoli | Sessione e conferma recente secondo policy | Step-up da progettare; approvazione legata alla versione esatta |
| Integrazione gestionale automatica | Identità tecnica separata | Scope minimi, revoca, audit; mai account dipendente condiviso |
| Aprire un link split | Anteprima limitata se prevista dal prodotto | Il possesso del link non deve autorizzare dati aziendali o modifiche finanziarie |

## Esperienza proposta
La bozza resta sul dispositivo. Solo quando l'utente sceglie di inviarla
all'azienda compare l'accesso. Al ritorno riprende la stessa bozza senza
ricompilarla; un errore non deve dichiarare l'invio riuscito. Inviti monouso,
recupero sessione e ricevuta server devono restare distinguibili.
Una verifica aggiuntiva si chiede per azioni sensibili secondo una policy
esplicita, non per ogni schermata. Non usare un modello AI per concedere ruoli,
riconoscere un'identità o saltare verifiche.

## Software
Better Auth è il primo candidato da collaudare per un servizio gestito da
Momentum; confrontarlo con autentik/ZITADEL/Keycloak rispetto ai requisiti
operativi e alle licenze effettive delle funzioni. Non sono interscambiabili
con l'adapter JWT attuale. Non serve installare cinque sistemi insieme.
SSO esistente è preferibile per un'azienda che già lo usa. Un'istanza per ogni
cliente non è il default: aumenta gestione e aggiornamenti. Isolamento dedicato
solo per requisiti concreti e risorse disponibili.

## Stato verificato nel repository
PWA locale e preparazione archivio separate dal Worker. Il Worker verifica
identità prima delle rotte; inviti richiedono email e membership, le decisioni
hanno controlli di ruolo/versione. Adapter OIDC opzionale e cache chiavi già
presenti. Non ancora login open source, passkey, BFF/sessioni, step-up o recupero
account collaudati sul cloud. Non togliere Access per una promessa di compatibilità.

## Verifica richiesta prima dell'attivazione
Accesso e ritorno alla bozza; annullamento login; invito inoltrato/scaduto;
revoca durante la sessione; account di aziende diverse con stessa email;
telefono perso/seconda passkey; logout su dispositivo condiviso; doppio invio;
SDK/API che tentano operazioni oltre scope. Test browser e dispositivi reali
separati dai test delle firme. Misurare completamento, richieste e CPU senza
raccogliere importi, documenti o token nella telemetria.

Fonti primarie consultate:
- https://better-auth.com/docs/introduction
- https://better-auth.com/docs/plugins/passkey
- https://www.keycloak.org/docs/latest/server_admin/ (step-up)

Open source elimina eventuali canoni del software nei termini della licenza;
non elimina hosting, backup, manutenzione, email o limiti del cloud gratuito.
