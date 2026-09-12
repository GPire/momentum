# Open banking: costo minimo e tecnologia Momentum

Ricerca del 12 settembre 2026. Ipotesi iniziale: lancio Italia/UE, sola lettura di conti, saldi e movimenti. Nessun preventivo ricevuto o contratto sottoscritto. Completa `open-banking-readiness.md` e `uuid-schedule-and-open-banking-2026-09-12.md`; non attiva un provider.

## Risultati verificati

| Provider | Evidenza primaria | Implicazione |
| --- | --- | --- |
| finAPI | [Listino](https://www.finapi.io/en/prices/): Access B2C 60 €/mese fino a 200 utenti, B2X 100 €. AIS aggiuntivo 200 € per soggetti senza propria licenza. [Copertura](https://www.finapi.io/en/products/country-coverage/) include Italia. | Scenario aritmetico iniziale: 260 €/mese B2C o 300 € B2X, prima di extra/imposte/condizioni da confermare. Non usare 60 € come costo completo. |
| Enable Banking | [FAQ](https://enablebanking.com/docs/faq/): prezzo a volume con minimo mensile non pubblicato, prove sandbox/propri conti; pubblico dopo contratto e KYB. | Richiedere preventivo completo; non è dimostrato essere il meno caro. L'uso dei propri conti non è un piano gratuito per tutti gli utenti Momentum. |
| Tink | [Prezzi](https://tink.com/pricing/): nuovi clienti devono contattare vendite; Business Transactions è Enterprise. | Separare richiesta conti personali e aziendali. Non usare vecchi prezzi di clienti già contrattualizzati. |
| Yapily | [Prezzi](https://www.yapily.com/pricing/): offerta personalizzata; distingue prodotto Data e Yapily Connect. | Includere nell'offerta la modalità autorizzativa necessaria a Momentum. |
| Salt Edge | [Documentazione](https://docs.saltedge.com/general/v5/): condizioni commerciali da concordare. | Comparatori e commenti online non sostituiscono una quotazione. |
| Powens | [Bank](https://docs.powens.com/documentation/integration-guides/bank/introduction-to-bank): separa Bank, Wealth, categorizzazione e altri prodotti. | Quotare solo Bank nel primo perimetro, confrontare saldi/carte/storico per banca. Nessun prezzo totale verificato. |
| Teller | [Listino](https://teller.io/): transazioni 0,30 USD/enrollment/mese, saldi 0,10 USD/chiamata. [Ambienti](https://teller.io/docs/guides/environments): 100 enrollment reali gratuiti per sviluppo, produzione a pagamento. | Candidato per mercato USA; non un sostituto verificato per banche italiane. Il piano developer non va presentato come produzione gratuita. |
| GoCardless Bank Account Data | [API](https://docs.gocardless.com/docs/bank-account-data/endpoints) ancora documentata. Nessuna offerta gratuita commerciale per nuovi clienti confermata in questa ricerca. | Non basare il lancio sui vecchi articoli Nordigen. Disponibilità e ammissibilità vanno confermate. I prezzi degli incassi GoCardless sono un prodotto diverso. |

Non esiste una graduatoria assoluta verificabile con queste informazioni: diversi prezzi sono riservati e le unità di fatturazione differiscono. Shortlist UE proposta: finAPI come riferimento pubblico, Enable Banking e Yapily come offerte alternative; Tink/Powens se copertura e condizioni sono migliori sul pubblico reale.

## Come minimizzare il costo reale

Preventivo identico per tutti: 100, 1.000 e 10.000 utenti attivi; scenario uno e tre conti per utente; Italia prima, poi paesi aggiuntivi; conti personali e business distinti; un aggiornamento giornaliero più richieste esplicite. Chiedere minimo, attivazione, durata vincolo, copertura AIS, paginazione, retry, rinnovi, account inattivi, supporto ed extra. Confrontare valuta e imposte separatamente.

Costo effettivo = canone + consumo + componenti autorizzative + extra + infrastruttura + supporto, rapportato agli utenti sincronizzati con successo. Una tariffa per utente non equivale a una per conto o per chiamata.

Ridurre richieste duplicate con un solo aggiornamento in corso per conto, cache con data visibile, aggiornamenti incrementali, backoff e tetto di spesa. Ridurre chiamate non riduce automaticamente un canone per account: l'ottimizzazione deve seguire il contratto. Evitare due provider per lo stesso conto per default: può raddoppiare costo e consenso; introdurre fallback solo dopo aver misurato necessità e compatibilità.

## Parte proprietaria da costruire

Il codice scritto da Momentum può essere proprietario nei limiti delle licenze delle dipendenze. Dati bancari, API e infrastrutture del provider non diventano proprietà Momentum. Non dichiarare esclusività, brevetti o superiorità senza riscontri.

Priorità di prodotto: identità stabile del movimento, riconciliazione CSV/banca/manuale, pending→booked senza doppia spesa, storni collegati all'originale, correzioni personali conservate al cambio provider; saldi datati con significato esplicito; spiegazione dell'effetto su budget e scadenze. Collegare i segnali verificati ai motori esistenti, senza trasformare ogni importazione in training automatico o consenso implicito alla condivisione.

L'accesso diretto alle API bancarie è una possibile fase futura da valutare economicamente includendo autorizzazioni, integrazioni e manutenzione; non è una scorciatoia gratuita ottenuta eliminando l'aggregatore.

Prossima consegna tecnica: contratto dati indipendente dal provider e test di riconciliazione. Prossima decisione commerciale: confrontare offerte scritte sulle stesse banche. Nessuna email commerciale inviata o account creato con questa ricerca.
