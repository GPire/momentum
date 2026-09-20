# Autonomi e professionisti: priorità ricercate

Ricerca mirata del 19 settembre 2026; non un'indagine rappresentativa tra utenti Momentum né una verifica completa di tutti i concorrenti.

## Evidenze

- UE, quindi anche IT/ES: l'EU Payment Observatory descrive l'impatto dei ritardi sulla liquidità e il tempo dedicato ai solleciti. Fonte: https://single-market-economy.ec.europa.eu/document/download/8aabc383-52ce-49a9-a197-b4c49dc79a64_en?filename=Summary+2025.pdf
- Svizzera: il portale PME del SECO collega incassi tardivi, fatturazione tardiva e pianificazione della liquidità; invita a una gestione attiva anche quando si utilizzano software contabili. https://www.kmu.admin.ch/kmu/fr/home/actuel/theme-du-mois/2024/comment-bien-planifier-ses-liquidites.html
- Italia, Fattura24: esistono già rate, anticipi e stati di saldo. Non presentare queste capacità come invenzioni Momentum. https://www.fattura24.com/manuale/primi-passi/rate-pagamento/
- Spagna, Holded: riconciliazione di pagamenti totali, parziali e anticipati, senza duplicare incassi già registrati. https://help.holded.com/es/articles/10026460-conciliacion-de-facturas-pago-total-parcial-o-anticipado
- Svizzera, bexio: collegamenti bancari con riconciliazione automatica. https://www.bexio.com/en-CH/all-banks

## Decisione di prodotto

Prima ridurre il lavoro di ricostruzione: documento, movimento, residuo, motivo dell'abbinamento e correzione devono restare collegati. Questa è una direzione di differenziazione, non una superiorità dimostrata sui prodotti citati. Il percorso del commercialista deve permettere di verificare i totali senza ricopiare dati.

Ordine proposto:
1. Abbinamenti spiegabili e controllati; escludere entrate personali, importi invalidi e valute incompatibili.
2. Allocazioni esplicite per acconti, pagamenti parziali e cumulativi, con residui in centesimi, annullamento e nessuna doppia transazione. Cercare e riusare i motori già presenti prima di implementarli.
3. Registro dei versamenti con anno fiscale esplicito, separato dalla data del pagamento; vecchie voci da confermare, mai riassegnate a intuito.
4. Pacchetto professionista con documenti e controlli mancanti, e flussi nazionali distinti. Non confondere importi incassati, imponibile e reddito fiscale.

## Implementato in questo passaggio

Rafforzato `matchInvoicePayments`, già usato dal report italiano: esclude `taxable:false`, importi non finiti e valute esplicitamente diverse; i nomi generici e le sottostringhe non alzano la confidenza ad alta. Test scritti prima delle correzioni. 74 test mirati passati. Nessuna modifica al Vault, nessuna nuova trasmissione o collegamento bancario.

La ricerca riguarda IT/CH/ES; questi cambiamenti non aggiungono automaticamente la riconciliazione alle interfacce CH/ES. Le valute assenti conservano il comportamento legacy, non rappresentano una conversione verificata. La confidenza media rimane una proposta euristica. Nessuna nuova gestione di pagamenti parziali/cumulativi completata in questo passaggio. Nessuna attestazione di conformità o leadership di mercato; restano i criteri di `fiscal-release-gates-2026-09-19.md`.
