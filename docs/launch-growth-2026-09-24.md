# Momentum — piano di lancio, crescita e ricerca (24 settembre 2026)

Questo documento distingue ciò che si può pubblicare, ciò che può portare
persone nuove e ciò che richiede ancora prove. Non presume una quota di mercato,
un tasso di conversione o un posizionamento nei risultati di ricerca.

## Decisione

Lanciare prima un **percorso personale verificato**, non una promessa unica per
budgeting, investimenti, fisco e grandi aziende. Il caso iniziale da confrontare
con alternative reali è: «dividere una spesa fra più persone, vedere quote e
rimborsi comprensibili, risolvere un disaccordo e ritrovare il risultato».
Momentum può poi collegare quel risultato al quadro personale, se la persona
sceglie di usarlo. L'assenza di account non è un'esclusiva: [Revolut Group
Bills](https://help.revolut.com/help/transfers/group-bills/question-group-bills/)
accoglie già partecipanti senza account e [tricount](https://www.tricount.com/)
ha inviti, quote personalizzate e richieste di pagamento. La differenza va
dimostrata sul **compito completo**, non dichiarata con un aggettivo.

Il percorso aziende, i connettori autenticati, il fisco nazionale completo e
l'affidabilità di previsioni d'investimento non vanno venduti come già
collaudati: gli stati e le prove mancanti sono in
[`release-readiness-2026-09-20.md`](./release-readiness-2026-09-20.md).

## Le priorità che possono cambiare il lancio

| Priorità | Blocco osservato | Intervento | Prova prima di dichiarare successo |
| --- | --- | --- | --- |
| P0 — primo valore | La landing mostra sei percorsi, ma non misura visita → prova → prima azione utile; gli eventi mensili dell'app non sono un funnel di sessione. | Tracciare con preferenza rispettata e senza importi o testo libero: visita, CTA, apertura, prima divisione completata, ritorno. Denominatori distinti per canale e dispositivo. | Report con definizioni, esclusione del traffico interno e verifica contro una sequenza di prova. |
| P0 — affidabilità | Un link condiviso e un archivio locale sono promesse fragili se il destinatario si blocca o i dati non si recuperano. | Provare invito, rientro, conflitto, aggiornamento, backup e ripristino su telefoni reali e rete intermittente. | Dieci gruppi realistici, inclusi nomi uguali, più valute e contestazioni; nessuna quota o modifica persa. |
| P0 — velocità percepita | La build attuale contiene un chunk iniziale di circa 3,3 MB minificati (1,13 MB gzip), oltre ad altri chunk grandi: su una rete mobile lenta il primo risultato può arrivare tardi. | Misurare trasferimento, esecuzione JavaScript e tempo al primo compito su telefoni reali; poi caricare i moduli non necessari solo quando la persona apre la relativa funzione. | P75 di avvio e completamento del primo compito, con rete mobile limitata, prima e dopo la modifica; nessuna regressione nel ripristino. |
| P0 — messaggio | «Gratis» e «senza account» da soli sono facili da imitare. | Mostrare un caso concreto con quota, anticipo, contestazione e rimborso; CTA verso quel compito, con esito raggiungibile prima delle funzioni avanzate. | Test con persone nuove: completamento, errori, tempo alla prima quota chiara, invito accettato. |
| P1 — ricerca | Sette versioni della stessa pagina coprono troppi intenti. | Pubblicare poche pagine originali per problemi distinti: dividere spese, trasferte personali, fattura/incasso parziale. Tradurre e revisionare solo dove il percorso prodotto è davvero supportato. | Indicizzazione e query per pagina/Paese in Search Console; prova del percorso dalla pagina al risultato. |
| P1 — fiducia | La finanza è materia sensibile; il design non sostituisce fonti e responsabilità. | Rendere visibili metodo, limiti, fonti datate, autore/revisore quando verificato, contatto e correzioni. Non inventare testimonianze né certificazioni. | Revisione editoriale/fiscale e controllo dei link alle fonti. |
| P1 — condivisione | L'anteprima condivisa era l'icona quadrata dell'app. | Card visiva dedicata, titolo/descrizione localizzati e nessun dato finanziario personale nei metadati. | Anteprima reale nei canali usati dai gruppi; link sicuro e comprensibile. |

## Tempi: partire prima, imparare prima

**Prima dell'annuncio (0–14 giorni):** chiudere P0, verificare ripristino e
inviti su almeno i dispositivi effettivamente disponibili, aprire Search
Console, testare la preview social e pubblicare una pagina per il problema
principale. Lanciare una beta con perimetro e limiti espliciti se questi test
passano; non aspettare la suite B2B o fiscale globale per ottenere feedback
sul percorso personale.

**Prime quattro settimane:** osservare i compiti completati, non il tempo
trascorso nella landing. Ogni settimana scegliere un solo attrito dominante,
correggerlo, ripetere il test e annotare la differenza. Intervistare sia chi
completa sia chi abbandona; non usare l'attività degli sviluppatori come dati
di conversione. Pubblicare pagine utili solo dopo verifica dei contenuti e del
prodotto cui conducono.

**Dopo 30–90 giorni:** estendere i contenuti che portano persone capaci di
completare il compito; sospendere quelli che attirano visite senza risultato.
Aprire un pilota aziendale solo quando identità, tenant, ricevuta e ciclo
responsabile/Finance funzionano davvero. Per il fisco, un segmento e un Paese
per volta con revisione professionale; per gli investimenti, benchmark
prospettici separati dai dati usati per sviluppare il modello.

## Misure e limiti

- **Acquisizione:** visite uniche per pagina e canale, con le preferenze di
  misurazione rispettate; impression e query in Search Console.
- **Attivazione:** percentuale di visitatori che apre l'app, di chi apre che
  completa un primo compito, tempo e tentativi necessari. Una prima apertura
  non è un'installazione PWA.
- **Condivisione utile:** inviti creati, accettati, gruppi con un secondo
  partecipante attivo, spese chiarite e rimborsi segnati. La quota di aperture
  «da invito» non è da sola un coefficiente virale.
- **Fiducia e qualità:** errori, abbandoni, ripristini riusciti, richieste di
  aiuto, correzioni dei suggerimenti, ritorno a 7 e 30 giorni. Nessuna metrica
  deve contenere importi, nomi o descrizioni delle spese.
- **Criterio di confronto:** stesse attività, stessi profili e stessi
  dispositivi per Momentum e alternative; tempo, correttezza, comprensione e
  fiducia osservati. Nessun «migliore del mercato» senza questo confronto.

## SEO e GEO senza scorciatoie

La landing ha già HTML statico in sette lingue, canonical, hreflang, sitemap,
robots e dati strutturati. Mancano pagine originali per gli intenti principali,
misurazione in Search Console, prove di autorevolezza verificabili e un audit
di prestazioni reali. La nuova immagine social è solo un supporto alla
condivisione; non è una prova che più persone condivideranno.

[Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)
indica che per AI Overviews/AI Mode valgono i fondamentali SEO: pagina
indicizzabile, testo utile, link interni, esperienza buona e dati strutturati
coerenti con ciò che si vede. Il file `llms.txt` già presente può aiutare
altri sistemi a orientarsi, ma [Google chiarisce che non lo usa come leva di
ranking](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
Per ChatGPT Search va verificato che `OAI-SearchBot` possa leggere le pagine
pubbliche e che il firewall non lo blocchi: [guida OpenAI](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq).
Non creare centinaia di pagine quasi identiche o falsi confronti con
concorrenti: prima servono esperienza originale e risposte verificabili.

## Cosa non si può accelerare con solo codice

Indicizzazione, reputazione, citazioni autentiche, testimonianze autorizzate,
revisione fiscale, connettori di clienti reali e compatibilità nativa richiedono
tempo e persone esterne. Il modo più rapido per distinguersi il giorno del
lancio è ridurre il perimetro promesso, dare un primo risultato utile in pochi
passaggi, misurare il percorso e correggere i punti in cui le persone si fermano.
