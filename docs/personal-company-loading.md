# Uso personale e moduli aziendali

La scelta iniziale non deve bloccare successive modifiche degli interessi.
Budgeting, split e investimenti personali non richiedono l'attivazione del
servizio aziendale o di Better Auth.

## Separazione verificata

- `server/auth` ha dipendenze proprie e non entra nel bundle Vite della PWA.
- `server/company` resta un servizio separato.
- `main.js` importa dinamicamente `company-policy` solo per creare una trasferta
  collegata a un'azienda, e `company-submit` solo per invio o verifica dello stato.
- Errori di caricamento passano nei gestori esistenti, senza confermare invii
  falliti e ripristinando i pulsanti. Nessuna migrazione dei dati personali.
- Il service worker non precachea questi chunk durante l'installazione.

Build production portable completata; 7 test policy/invio passati. I due chunk
dedicati pesano rispettivamente 1.262 e 5.336 byte minificati in questa build.
Non è una misura del risparmio complessivo, perché dipendenze condivise restano
nel bundle principale. Non è stato eseguito un nuovo collaudo browser o fisico.

## Trasferte personali: mantenere disponibili

L'interfaccia trasferte, spese, allegati, riepiloghi ed esportazione rimane
disponibile anche senza servizio aziendale. Non è prevista la sua rimozione
dall'app personale. Non nascondere
funzioni permanentemente in base all'onboarding, né cancellare dati quando una
funzione viene disattivata.

La build Vite verifica il grafo dei chunk: impedisce import statici, anche
transitivi, dei client policy/invio/allegati aziendali e qualsiasi inclusione
del server aziendale o Better Auth nel client. Le traduzioni e le utility
condivise rimangono disponibili senza ulteriori richieste di rete.

Nel pacchetto Capacitor standard tutti i chunk di `dist` vengono inclusi: il
caricamento differito riduce esecuzione iniziale, non la dimensione installata.
Anche la build singlefile incorpora i moduli. La separazione del download qui
descritta riguarda la normale build web/PWA.
