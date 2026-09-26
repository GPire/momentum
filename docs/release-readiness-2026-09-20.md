# Momentum — stato reale e lavoro restante

## Copertura temporale dei grafici asset — 25 settembre 2026

La ricerca mostra ora l'intera serie **effettivamente ottenuta dalla fonte**,
non un numero prefissato di mesi: i pulsanti uno/cinque anni selezionano per
data, l'asse orizzontale usa le date reali e le interruzioni restano vuote.
La scheda espone prima e ultima osservazione, fonte, valuta, eventuali buchi
e data finale non recente. I prezzi piccoli delle cripto non diventano `0,00`
per arrotondamento. Per azioni ed ETF con chiavi configurate viene scelta la
serie più lunga fra quelle ancora recenti; le chiusure non rettificate per
split e dividendi sono marcate come tali, mai presentate come rendimento totale.
Binance EUR e USDT restano serie separate e la valuta non viene convertita
silenziosamente. Le chiusure mensili Binance sono datate a fine mese, non
al primo giorno; la candela ancora aperta porta la data della richiesta ed è
marcata come provvisoria. Un token che segue un'azione resta distinto dal titolo.
Per azioni/ETF il grafico TradingView della quotazione può essere aperto anche
quando esiste una serie interna: è una visualizzazione esterna con controlli
temporali, non un dato che alimenta calcoli o modelli, e può avere a sua volta
una copertura limitata. È caricato solo quando l'utente chiede l'anteprima.
Nel browser incorporato di collaudo l'iframe TradingView è rimasto bianco,
benché aperto; il collegamento diretto resta visibile sopra l'anteprima e
funziona come uscita. La resa del widget non è certificata su tutti i browser.

**Vincolo di licenza scoperto durante il collaudo:** l'API Bitstamp ha fornito
in browser candele BTC dal 2011, ma la [documentazione ufficiale](https://www.bitstamp.net/api/)
richiede un Data License Agreement per l'uso commerciale dei dati. L'adattatore
e i test sono pronti, ma la versione pubblica **non lo interroga** senza tale
accordo. Perciò la vista BTC pubblica può iniziare solo dal primo dato
Binance disponibile (nel collaudo dal 2017), che non è la nascita di Bitcoin.
La copertura “dal debutto a oggi” per ogni cripto/azione/ETF non è raggiunta:
servono fonti con profondità, identità, continuità e diritti commerciali
verificati per ciascun mercato. Le chiavi personali Alpha Vantage, Twelve
Data e FMP non dimostrano da sole un diritto di redistribuzione commerciale.
Nessun dato mancante viene fabbricato o unito fra mercati diversi per colmare
questa lacuna. Prima di vendere dati di mercato o usare tali serie per
addestramento occorre una revisione delle licenze fonte per fonte.

**Prove eseguite:** test di calcolo su date, lacune, prezzi minimi, scelta
fonte e blocco dell'endpoint Bitstamp per la versione pubblica; suite completa
408/408 file dopo la correzione della candela mensile e build portabile su
472 moduli; ricerche locali Bitcoin, Ethereum, Solana, Apple e SPY
nel browser e cambio periodo. Resta aperto il
collaudo su telefoni fisici e la misura sistematica della copertura di titoli,
fondi e cripto. La prova Bitstamp nel browser era esplorativa, non autorizzazione
alla pubblicazione.

## Ricerca con attesa visibile e lettura delle spese — 25 settembre 2026

La ricerca degli asset segnala subito che sta cercando e dove appariranno i
risultati. Un risultato locale si può aprire mentre vengono interrogate le
altre fonti; se queste falliscono, quello già trovato resta disponibile. Una
ricerca vuota spiega cosa inserire, senza lasciare visibili risultati ormai
superati. La scheda indica sempre quando un grafico proviene da un token che
segue un'azione, distinto dalla quotazione ufficiale.

Ogni scheda apre con «Che cos'è»: per le azioni spiega la quota societaria e,
se disponibile, traduce in parole semplici la classificazione di attività SEC
senza nascondere la dicitura originale e l'anno. Per gli ETF noti mostra
l'obiettivo verificato presso l'emittente con link ufficiale; per gli altri
non indovina l'indice. IBIT è distinto dal possesso diretto di Bitcoin. Per le
cripto la descrizione opzionale CoinGecko è attribuita e non trattata come
verifica indipendente. Queste informazioni sono separate da prezzo, notizie
e opinioni d'investimento. Il profilo facoltativo viene caricato dopo la
scheda principale e ha un limite di attesa, per non bloccare la lettura.
Nel test live Ethereum una ricerca Wikidata omonima descriveva erroneamente
il forum «Ethereum Stack Exchange»: la selezione ora scarta pagine *sulla*
cripto e mostra la descrizione specifica CoinGecko. Verificati 10/10 test
mirati e nuova build portabile; la suite 408/408 era stata eseguita prima
di questa correzione localizzata.

**Descrizioni specifiche, 25 settembre:** ASML ha una spiegazione breve
controllata sulla pagina ufficiale dell'azienda. Per gli altri strumenti la
scheda prova prima le informazioni dell'emittente o di CoinGecko già
disponibili, poi una voce Wikidata identificata con nome e tipo di strumento.
Se quella voce collega un articolo Wikipedia nella lingua selezionata (o in
inglese), ne mostra un estratto breve, la pagina e la licenza CC BY-SA. La
classificazione SEC resta distinta: non viene usata come prova che l'azienda
venda un prodotto preciso. Omonimi e strumenti tokenizzati non ereditano la
descrizione dell'azione sottostante. Durante la richiesta la UI indica che
sta cercando la descrizione, senza anticipare un'assenza definitiva.
Per nomi aziendali abbreviati, la ricerca può usare la sigla di borsa
presente nella voce Wikidata; una somiglianza nel nome da sola non basta.
Queste descrizioni pubbliche servono a comprendere l'identità, **non** sono
prezzi, esiti osservati o etichette automaticamente ammissibili al training.
Il gate già presente `trainingEligible` continua a riguardare soltanto serie
datate e plausibili; per allenare nuovi modelli sulle descrizioni occorrono
licenze, corpus validato, obiettivi e benchmark separati. Il browser locale
ha mostrato la descrizione ufficiale ASML e una descrizione italiana di AMD
con attribuzione Wikipedia; questo non dimostra copertura di ogni società,
ETF o cripto né disponibilità permanente delle fonti pubbliche.

**Verifica finale locale, 25 settembre:** 406/406 file di test dell'app e
11/11 del servizio aziendale passati con isolamento per file, più il test del
confine dei bundle; build portabile riuscita. Nel browser locale sono state
aperte ASML, AMD, JPMorgan, Bitcoin e SPY. JPMorgan ha mostrato la descrizione
specifica solo dopo verifica del ticker nella voce pubblica; il testo è stato
limitato alla frase di identità perché il seguito conteneva una cifra di
capitalizzazione potenzialmente vecchia. A 390 px la scheda non ha overflow
orizzontale. Restano da provare dispositivi fisici, copertura sistematica degli
strumenti e affidabilità delle fonti nel tempo. Il dato enciclopedico non
alimenta da solo l'apprendimento dei modelli; i confini sono descritti in
[learning-source-boundary-2026-09-12.md](learning-source-boundary-2026-09-12.md).

In Analisi il budget mette in evidenza spesa, limite e passo successivo; la
torta delle categorie e il calendario hanno gerarchie più leggibili anche su
schermi stretti. Il calendario mostra giorni con spese e giorno più alto. Il
grafico di un asset riporta massimo, minimo e ultimo dato della **serie
visibile**, con date, senza chiamarli massimi storici di mercato. Con movimento
ridotto i giorni del calendario restano visibili: prima un'animazione disattivata
li lasciava trasparenti.

**Prove nel browser locale:** ricerca e apertura di Microsoft, Nvidia,
JPMorgan e ASML; su ciascuna l'eventuale storico tokenizzato è dichiarato
come tale. L'attesa è stata osservata durante la richiesta e il risultato è
comparso successivamente. A 390 px l'attesa e i risultati sono leggibili senza
scorrimento orizzontale. Questi controlli non provano completezza delle fonti,
quotazioni azionarie in tempo reale o funzionamento su dispositivi fisici.
I test automatici coprono cinque società di settori diversi, quattro fondi,
una società senza classificazione SEC locale e la distinzione fra cripto e
azioni tokenizzate.

## Analisi senza numeri inventati e grafici raggiungibili — 25 settembre 2026

Nelle card investimenti e spese, i dati di esempio sono etichettati anche in
Analisi. Il patrimonio netto, la mappa delle spese e la crescita futura
distinguono dati propri assenti da uno zero reale; ogni stato vuoto spiega il
passo successivo e apre l'inserimento. La crescita personale viene mostrata
solo dopo spese osservate in almeno tre mesi distinti. Un calcolo asincrono
avviato prima di una modifica non può rimettere numeri in una card ormai vuota.
I movimenti demo non sbloccano la proiezione. Questo è un requisito minimo di
presentazione, non una validazione predittiva del modello.

Il grafico di un asset, quando esiste una serie datata, è visibile nella scheda
senza aprire altri pannelli. Prezzo e storico cripto sono recuperati in modo
indipendente: il fallimento di una fonte facoltativa non elimina la serie
riuscita. Se lo storico manca, la scheda offre un tentativo nuovo e la fonte;
per le azioni c'è una visualizzazione TradingView facoltativa, isolata e solo
da consultare. Essa non alimenta patrimonio, modelli né avvisi. I piccoli
motivi grafici aggiunti sono costruiti con il linguaggio di orbite dell'app,
non con emoji o icone di sistema.

**Prove locali:** build portabile riuscita; test mirati di recupero indipendente,
stato della previsione, widget e testi in sette lingue riusciti. Nel browser
locale il grafico Bitcoin è apparso con fonte e data, Apple ha separato il
titolo dal token e ha mostrato il limite della quotazione esterna. Verificati
320, 390, 768 e 1280 px senza scorrimento orizzontale. Il collaudo su telefoni
fisici, disponibilità del provider esterno e accuratezza futura restano aperti.

## Ricerca e lettura degli investimenti — 25 settembre 2026

In Analisi Tensor il percorso inizia dalla stima personale e dalla ricerca.
La ricerca mette il titolo azionario prima degli omonimi tokenizzati e mostra
subito fonte del prezzo, stato dei conti, notizie e ultimo trimestre SEC,
quando disponibili. Bilanci completi, documenti, notizie, andamento e avvisi
restano in sezioni apribili, mentre il grafico datato disponibile è visibile
subito; i dati ufficiali di mercato sono separati dal
patrimonio personale e raccolti nel gruppo investimenti. Il confronto dei
settori mostra tre righe prima degli altri risultati, con una spiegazione
leggibile anche su schermi stretti. La nota sui limiti degli avvisi compare
quando si apre quel controllo. L'importo della riserva per gli imprevisti si può indicare e
correggere dalla stima; se mancano le spese reali, la card continua ad astenersi
dal suggerire un importo da investire. Nessun calcolo o dato Vault preesistente
è stato migrato o rimosso.

**Prove:** suite completa 413/413 file, 109 test mirati su testi nelle sette
lingue, novità e validazione degli importi; build portabile riuscita. Nel
browser locale sono stati provati ricerca Apple, scelta del risultato,
apertura dei bilanci SEC, validazione e salvataggio della riserva. Controllati
viewport simulati 320, 390, 768 e 1280 px: nessuno scroll orizzontale e
card affiancate solo dove c'è spazio sufficiente.

**Limiti:** non è un collaudo su dispositivi fisici. Prezzi azionari recenti
leggibili dall'app e avvisi su azioni/ETF richiedono ancora una fonte
collegata; una quotazione esterna, anche se visibile, non li alimenta. Il
nuovo layout non prova accuratezza di previsioni né validità di una decisione
d'investimento. Questa build locale va ancora distribuita e verificata sul
dominio pubblico prima di dichiararla rilasciata.

## Ricerca asset con trimestre SEC e controllo delle prove — 25 settembre 2026

Per le società dell'indice SEC incorporato, una nuova route Pages legge
`companyfacts` ufficiali senza una chiave dell'utente e restituisce solo il
più recente periodo trimestrale autonomo di 60–120 giorni. Mostra ricavi e
utile, data del deposito, 10-Q o correzione 10-Q/A e collegamento all'originale;
non sostituisce il bilancio annuale incorporato e non confronta tre mesi con
un anno intero. In caso di CIK errato, fatto futuro, periodo cumulativo,
valori contraddittori o rete indisponibile il numero viene omesso. Se una
rettifica aggiorna un solo indicatore, gli altri indicatori del vecchio
deposito non vengono attribuiti a quello nuovo.
La scheda «Prima di decidere» separa conti, prezzo con ora di mercato e
notizie recenti, indica il prossimo controllo e non emette un segnale di
compravendita. Le discussioni comunitarie restano visibili come tali ma non
alimentano più il gate del sentiment finanziario come notizie correnti.

**Prove:** 52/52 test mirati su route SEC, client, ricerca e notizie; suite
completa 413/413 file; build portabile app e sette route Pages riuscite.
La route locale ha letto Apple CIK 320193 dal servizio SEC reale: trimestre
29 marzo–27 giugno 2026, deposito 31 luglio 2026, ricavi e utile presenti.
In browser locale, partendo dal primo avvio, la ricerca Apple ha mostrato
periodo, valori, documento SEC originale e la separazione dal bilancio 2025.
Il controllo visivo ha trovato e corretto tre colonne troppo strette nel
modale e importi spezzati nei telefoni stretti. Verificati viewport simulati
da 320, 390 e 768 px: nessuno scroll orizzontale a 320 px; etichette e
valori SEC leggibili. Questo non sostituisce un test su dispositivi fisici.

**Limiti:** la nuova route non è ancora verificata su Cloudflare distribuito
né su telefoni fisici; la prova locale non certifica uptime, quote SEC o
completezza globale. Le cifre pubblicate dalla società non sono state
revisionate da Momentum. Nessun nuovo peso AI è stato addestrato; non sono
arrivati prezzi azionari WebSocket o licenze per opzioni/futures/alternative
data. Audit dei concorrenti, capacità già presenti e prossimo ordine di
lavoro: [investment-platform-gap-2026-09-25.md](investment-platform-gap-2026-09-25.md).

## Notizie aziendali nei modelli — 24 settembre 2026

La cascata condivisa da ricerca asset, portafoglio e risposte Momentum prova
ora anche GDELT DOC 2.0 come fonte pubblica senza chiave, prima delle
discussioni Hacker News. Mantiene i provider personali già configurati.
Conserva solo titolo, link, dominio e ora di prima indicizzazione: quest'ultima
non viene presentata come data certa di pubblicazione. La UI indica fonte e
data, collega l'articolo originale e attribuisce GDELT. Filtri su URL, titolo,
marchi ambigui, finestra di sette giorni, cache breve e timeout evitano
risultati manifestamente fuori tema o blocchi indefiniti. La copertura non è
esaustiva e il filtro per titoli può scartare notizie pertinenti in altre
scritture o lingue.

Il modello locale di sentiment già presente può classificare, con consenso,
i titoli nuovi della fonte; non sono stati modificati i suoi pesi né avviato
addestramento automatico. Il layer di ragionamento sugli investimenti usa
solo segnali datati negli ultimi 14 giorni: esclude notizie senza data,
future, vecchie o recuperate offline. Aggrega prima i punteggi di ciascun
dominio, poi pesa i domini: nove titoli dello stesso sito non contano come nove
conferme indipendenti. Il dominio è solo un'indicazione di diversità, non
dimostra indipendenza editoriale. La confidenza restituita è una **euristica**,
non una probabilità calibrata. I punteggi ricevuti dalla mesh entrano nel
ragionamento finanziario solo con due peer distinti, data e valore validi;
questo non prova che i peer siano indipendenti o affidabili.

La divergenza fra notizie e prezzo richiede quotazioni positive e recenti e
articoli con **data di pubblicazione** nella stessa finestra. La data di prima
indicizzazione GDELT non basta; un token azionario non viene spacciato per la
quotazione del titolo. La divergenza descrive due segnali, **non identifica
una causa né prevede quale avrà ragione**. Nessun titolo diventa da solo una
raccomandazione d'investimento. Per addestrare o calibrare in modo credibile
servono esiti successivi, licenze dei contenuti e una valutazione fuori campione.

Prove: parser GDELT con risposte controllate, filtro pertinenza e sicurezza,
cache/offline, freschezza nel modello, diversità dei siti, finestra comune
notizie/prezzi, due peer per il relay finanziario e build portabile.
**L'endpoint GDELT
non è stato collaudato dal vivo su questa rete**: prima di dichiarare la
fonte operativa in produzione servono richiesta reale in browser, verifica
della forma JSON, della disponibilità CORS e delle quote nel tempo. La
ricerca e le altre fonti degradano senza inventare notizie se GDELT fallisce.

## Ricerca investimenti senza chiavi — 24 settembre 2026

La ricerca titoli in Analisi riusa ora il pannello SEC già presente nel
repository per trovare società oltre al piccolo elenco di nomi noti. Un indice
generato di circa 17 KB permette la ricerca senza caricare il pannello SEC
completo; il bilancio e il percentile settoriale si caricano solo quando si
apre una società. I risultati locali compaiono prima che finiscano le
ricerche di rete. La scheda separa ricavi, utile, margine e anno del
bilancio dalla quotazione recente, mostra la data dell'archivio e collega i
documenti ufficiali. Il confronto dei ricavi usa solo anni fiscali
consecutivi; flusso di cassa, ROE e posizione settoriale si aprono su
richiesta. Anche ticker di una o due lettere si trovano per corrispondenza
esatta, senza mostrare centinaia di nomi irrilevanti. Prezzo, notizie e
storico non tengono in attesa i conti SEC. Una notizia assente non viene
scambiata per assenza di eventi. La ricerca cripto e la cascata delle fonti configurate
restano attive; non sono stati migrati né cancellati dati o chiavi personali.
La ricerca mostra direttamente dove collegare una fonte facoltativa, in tutte
le sette lingue. Senza chiavi non viene inventato un prezzo azionario.

Prove: test mirati del catalogo, della ricerca e della precedenza sui token
cripto; suite completa di 408 file, build portabile di 461 moduli e ispezione
browser locale. La ricerca "Costco" apre il bilancio 2025, mostra la data
dell'archivio e, con le fonti attualmente non disponibili, dichiara
esplicitamente che nessuna notizia è stata verificata. Restano da collaudare su
dispositivi fisici l'uso e la velocità del pannello, e con account reali le
quote/licenze delle fonti facoltative. Lo snapshot SEC non è un flusso in
tempo reale e la sua copertura è limitata alle società presenti nell'archivio.
Il workflow mensile attualmente propone una PR per il pannello SEC. L'allineamento
automatico del nuovo indice nella stessa PR richiede ancora la modifica al
workflow, rimasta locale perché GitHub richiede il permesso `workflow` nel token.
Il dato pubblicato si aggiorna soltanto dopo revisione e distribuzione.

## Vault investimenti e chiavi personali — 24 settembre 2026

Il Vault ora separa le analisi disponibili con i dati già presenti nel
dispositivo dalle quotazioni esterne facoltative. La guida resta accessibile
in un tocco, mentre i campi delle varie chiavi sono raccolti nei dettagli.
La scheda resta raggiungibile anche in vista Essenziale se l'utente sceglie
gli investimenti, senza esporre subito i campi tecnici.
La ricerca titoli dell'interfaccia usa la cascata già implementata Alpha
Vantage → Twelve Data → FMP; prima passava solo Alpha Vantage. Il prezzo
azionario prova Alpha Vantage e poi Twelve Data se entrambe le chiavi sono
state fornite. FMP non è presentato come fonte di prezzi in tempo reale.
L'ora di ricezione della risposta non viene più chiamata ora del mercato e
il prezzo azionario non è formattato automaticamente in euro nella scheda,
nella lista dei titoli seguiti o negli avvisi. Si può esplorare la ricerca
senza alcuna chiave: titoli noti dalla tabella locale, cripto da CoinGecko.
Le stringhe visibili aggiunte sono tradotte nelle sette lingue supportate.

Prove automatiche mirate: `live-price.test.js` 17/17,
`asset-search.test.js` 36/36, `whats-new.test.js` 10/10; suite completa
408/408 file. Build portabile: 459 moduli. Anteprima browser isolata:
Vault → preferenza investimenti →
guida Alpha Vantage → ricerca Apple senza chiave → scheda AAPL senza prezzo
inventato. Le chiavi personali
non sono state collaudate con account reali: salvarle non certifica accesso,
copertura, licenza commerciale o freschezza della fonte. I prezzi nel resto
del portafoglio e gli avvisi preesistenti richiedono ancora un audit completo
della valuta del listino prima di considerarli affidabili in ogni mercato.
Nessuna chiave esistente viene rimossa o migrata da questo cambiamento.

L'assistente generico ora riconosce tutti e dodici i provider già offerti
nel Vault; una domanda generica evita l'estrazione esterna di un nome titolo
che prima aggiungeva una richiesta e attesa. Rimangono da misurare su utenti
consenzienti i tempi di risposta e gli errori dei provider reali.

## Percorso d'ingresso e velocità web — 24 settembre 2026

È stata aggiunta una pagina statica italiana dedicata a dividere una spesa,
con esempio verificabile (72 € fra tre persone), spiegazione delle quote,
contestazioni, condivisione e limiti dei link. Ha HTML leggibile senza
JavaScript, CSS dedicato e leggero, canonical, collegamento dalla landing e
voce nella sitemap. Il pulsante porta all'intento `split`: un utente già
attivato apre la divisione; al primo avvio l'intento resta nell'URL fino alla
fine dell'onboarding, poi viene consumato una volta. Non sostituisce il link
di invito di un gruppo. Tre nuove pietre miliari anonime distinguono ingresso,
salvataggio della divisione e preparazione dell'invito, sempre soggette
all'opt-out della telemetria e senza importi o nomi. Non formano ancora un
funnel di sessione completo: il collector pubblicato deve ricevere la nuova
versione prima che quei contatori siano operativi.

La landing generale ora mostra subito il testo principale anche durante
l'entrata animata. I sei URL di peso Plus Jakarta Sans per ciascun subset
erano byte per byte identici: il CSS dichiara una sola faccia variabile per
subset. Le risorse statiche versionate sul dominio Pages hanno regole di
cache mirate; il vecchio mirror Netlify resta no-store per non lasciare PWA
ferme. Le intestazioni pubbliche dopo il deploy devono essere lette e
confrontate con quelle attese prima di attribuire un beneficio reale alla
cache.

La landing e la pagina split sono indipendenti dal bundle dell'app: caricano
solo risorse statiche dedicate; il chunk da 3,33 MB arriva dopo il passaggio
volontario all'app. La prima pubblicazione della pagina split è stata
verificata online (HTTP 200); il CSS della landing ha il TTL atteso e gli HTML
non ereditano `no-store`. Una regola sovrapposta per `/assets/*` ha invece
prodotto online `no-store, public, immutable`, che equivale a non usare la
cache del browser. La regola è stata separata per JS/CSS: dopo il deploy del
24 settembre la pagina pubblica, il suo script e il CSS rispondono HTTP 200;
script e CSS hanno `public, max-age=604800` e il chunk JS dell'app ha
`public, max-age=31536000, immutable`, senza `no-store` sovrapposto. La pagina split ora racconta con un esempio
interattivo verificabile come una contestazione modifica il saldo (48 € ↔
60 €), espone gli altri comportamenti effettivi del motore e anima lo scroll
con solo ~2 KB di JavaScript dedicato, senza scaricare Three.js o l'app.
Il contenuto resta leggibile senza script e con movimento ridotto; i test
browser hanno verificato il cambio di saldo e layout a 320 e 1440 px.
Sul server locale unificato `127.0.0.1:4179` il CTA è stato cliccato nel
browser da un primo avvio pulito: dopo il caricamento si è aperta la modale
"Dividi una spesa" senza passare dall'onboarding o chiedere un budget. Il
percorso è stato riprovato in Chrome; nello stesso controllo è stata corretta
la dicitura iniziale "1 persone" in tutte le sette lingue. Il
vecchio server `4178` serviva soltanto `public` e non poteva risolvere la
route dell'app: non è un difetto della pagina pubblicata, ma non va più usato
per collaudare l'intero percorso. Test mirati rieseguiti singolarmente con
Node 24: 60/60; build portabile 454 moduli riuscita. Il runner parallelo
continua a restituire `spawn EPERM`, quindi il collaudo non è una suite
completa. Le animazioni sono disattivate sul browser di prova che dichiara
`prefers-reduced-motion: reduce`; resta da verificare l'effetto con movimento
normale su un dispositivo reale. La pagina split è per ora solo in italiano.
Su dispositivi che dichiarano movimento ridotto, la pagina split espone ora
un comando esplicito per attivare i reveal e le orbite; la scelta viene
condivisa con la landing nella sessione. Il contenuto resta visibile anche
quando il movimento è spento. In Chrome locale con preferenza di movimento
ridotto, il comando è stato provato in entrambi i versi: l'orb torna ad animarsi
su richiesta e il progresso della scena cambia durante lo scroll; disattivando
il comando, i testi restano visibili. Resta da verificare il ritmo visivo su un
dispositivo fisico con movimento normale.
Il bundle dell'app resta 3,33 MB minificati (1,13 MB gzip) e richiede un
lavoro separato di suddivisione e una misura sul primo risultato mobile.

Verifiche locali: 59 test mirati superati (marketing, intento, telemetria
client e worker), sintassi del modulo app verificata e build portabile di
produzione riuscita su 454 moduli. La pagina dedicata è stata letta nel
browser locale a 320, 390, 588, 768 e 1440 px senza scorrimento orizzontale;
la testata a 320 px è stata corretta dopo l'ispezione visiva. Il chunk iniziale
dell'app rimane circa 3,33 MB minificati / 1,13 MB gzip: questa modifica
non chiude il blocco di velocità dell'app. PageSpeed Insights ha risposto
con quota esaurita (HTTP 429), quindi LCP/INP/CLS non sono stati misurati
su utenti reali. Mancano prove fisiche del percorso split, inviti e recupero
con rete intermittente; la verifica visiva dell'app locale in una sessione
con movimenti privati è stata fermata dal controllo automatico.

## Verifica archivio prima del prossimo push — 23 settembre 2026

Il controllo di upgrade usa un checkout separato del commit pubblicato
`60efcab` e lo script `scripts/vault-upgrade-gate.mjs`. Ha generato e salvato
con il vecchio codice **514 archivi sintetici** con numeri di movimenti da
zero a 10.000, valute EUR/CHF/USD, lingue e caratteri diversi, ricevute,
fatture, incassi, trasferte, obiettivi, debiti, investimenti, split e dati di
apprendimento. Ogni archivio è stato aperto e risalvato con il codice nuovo;
tutti i campi precedenti sono rimasti uguali. Non sono stati letti archivi di
utenti reali.

La prova ha rivelato e fatto correggere tre rischi di migrazione: quando
`localStorage` era pieno la copia migliore in IndexedDB poteva essere ignorata;
una spesa cancellata poteva ricomparire scegliendo per numero di movimenti;
due copie con spese diverse potevano perdere una delle due serie. Ora gli
snapshot della stessa installazione vengono riconciliati per ID e lapidi di
cancellazione. Se non c'è spazio per il checkpoint, le copie originali non
vengono sovrascritte. Se falliscono sia il salvataggio locale sia quello
durevole, l'app segnala il mancato salvataggio e propone un backup cifrato.

Verifiche: 393 file e 5.529 test superati, test mirati Vault 49/49,
selezione copie 10/10, cronologia novità 10/10, traduzioni 9/9 e gate da
514 casi superati. Build portabile di produzione riuscita. Nessun test
sintetico certifica tutti gli archivi reali
né l'assenza di cancellazioni esterne dei dati del browser. Restano obbligatori
backup recuperabile e collaudo su iPhone/Android reali per un rilascio nativo.

Verifica iniziale del **20 settembre 2026** sul commit `e99884f`, aggiornata
con il controllo archivio del **23 settembre 2026**. Questo è il
documento operativo canonico per decidere cosa può essere rilasciato e cosa
deve ancora essere completato. Una funzione presente nel codice non viene
considerata operativa finché non supera anche la prova indicata nella relativa
sezione.

## Decisione di rilascio

| Perimetro | Stato | Decisione |
| --- | --- | --- |
| Web/PWA personale | Pubblicata e funzionante sul dominio di produzione | Candidata a beta pubblica controllata |
| Landing marketing `/landing/` | Revisione del 24 settembre: HTML in sette lingue, orb WebGL con fallback, scene guidate e miniature delle funzioni. Navigazione responsive, anteprima con quattro scene (inclusa fattura con incasso parziale), controllo dei dati, storia AI, FAQ, chiusura e footer ridisegnati. 405/405 file di test, build portabile (453 moduli), browser e viewport simulati 320/390/768/1024/1440 px senza scorrimento orizzontale del documento | Collaudare touch, Safari iOS e movimento su dispositivi fisici; misurare l'uso reale prima di attribuirle un effetto sulla conversione |
| Android e iOS con Capacitor | Scaffold e configurazione presenti | Non pronti per gli store: mancano firma, build native e prove fisiche |
| Trasferte personali | Acquisizione, allegati, controlli, stampa, export e riconciliazione locale presenti | Utilizzabile; non equivale a un servizio aziendale condiviso |
| Servizio aziende e HR/Finance | Gateway pubblico e logica applicativa presenti | Non operativo finché identità, D1, storage e primo tenant non sono configurati |
| Affiancamento ai gestionali | Mapping, anteprima, export e guide presenti | Non chiamarlo connettore finché non esiste un invio autenticato con ricevuta reale |
| Sostituzione completa dei gestionali | Policy, ruoli, revisioni e approvazioni sviluppati | Pilota non ancora autorizzato; non dichiarare sostituzione globale |
| Fisco IT/CH/ES | Motori, controlli e guide ufficiali presenti con copertura diversa per Paese | Non vendere come servizio fiscale completo senza revisione professionale e prove nazionali |
| Investimenti e modelli Momentum | Analisi, dataset e benchmark interni presenti | Non dichiarare accuratezza o leadership senza valutazione prospettica su dati separati |

Momentum non è ancora dimostrato come punto di riferimento globale per ogni
funzione. L'obiettivo resta valido, ma va sostenuto da risultati ripetibili,
clienti pilota e confronti misurati, non dal numero di funzionalità presenti.

## Quattro percorsi delle trasferte

### 1. Archivio personale

**Presente:** creazione della trasferta, spese e allegati, controlli prima
dell'export, modifica, riepilogo stampabile, valute, spese personali, voci
offerte, rimborsi parziali e riconciliazione con accrediti collegati.

**Da chiudere:** prove fisiche ripetibili su iPhone, Android, tablet e desktop;
misura di tempo, errori e abbandoni con persone estranee al progetto.

**Prova di uscita:** una matrice firmata di dispositivi e scenari nella quale
ogni percorso conserva dati e allegati dopo riavvio, aggiornamento e perdita
temporanea della rete.

### 2. Momentum come piattaforma aziendale unica

**Presente nel codice:** aziende e membership, ruoli, policy versionate,
inviti, inbox condivisa, correzioni, revisioni immutabili, approvazione a uno o
due stadi, verifica dell'impronta esatta, allegati separati, quote, recupero
delle cancellazioni incerte e audit dello storage.

**Pubblicato:** le Pages Functions instradano soltanto `/v1/*` e `/company/*`.
La rotta `/v1/company/readiness` raggiunge il worker in produzione e rifiuta
correttamente una richiesta priva di identità.

**Da chiudere:** configurare identità Access/OIDC, database D1, storage R2 o D1,
origine autorizzata, prima azienda e membership. Eseguire poi il ciclo reale
dipendente → responsabile → Finance, compresa revoca dell'accesso, richiesta di
correzione, nuova revisione, allegato grande e interruzione di rete.

**Prova di uscita:** `GET /v1/company/readiness` autenticato restituisce
`operational: true` e nessun blocker; due identità reali completano il ciclo su
almeno tre famiglie di dispositivi senza accessi incrociati fra tenant.

### 3. Momentum davanti a un gestionale già imposto dall'azienda

**Presente:** normalizzazione, mapping personalizzabile, anteprima, CSV sicuro,
controlli sui campi mancanti, deduplicazione, guide e percorsi manuali per i
gestionali documentati.

**Da chiudere:** OAuth o credenziali di integrazione conservate solo nel
servizio aziendale, idempotenza per ogni invio, ricezione dell'identificativo
remoto, recupero degli invii incerti, aggiornamento di stato e riconciliazione
dei rimborsi. Ogni piattaforma richiede un account autorizzato del cliente.

**Prova di uscita:** un resoconto di prova viene ricevuto in un ambiente
autorizzato del gestionale, restituisce una ricevuta verificabile e un secondo
invio con la stessa chiave non crea duplicati.

### 4. HR/Finance

**Presente:** elenco richieste, filtri, conteggio delle approvazioni pendenti,
ruoli separati, allegati verificati prima dell'approvazione, richiesta di
modifiche motivata, secondo approvatore indipendente, policy per valuta,
diaria, chilometraggio e limiti, più riconciliazione con carta e rimborsi.

**Da chiudere:** tenant cloud reale, onboarding amministratore, notifiche,
stato operativo del rimborso successivo all'approvazione, esportazione verso
contabilità/paghe, assistenza e recupero account. Il codice non deve eseguire o
simulare un pagamento senza un sistema autorizzato.

**Prova di uscita:** un responsabile e Finance lavorano sullo stesso resoconto,
la decisione resta legata alla revisione corretta, una modifica invalida
l'esito precedente e il rimborso viene riconciliato con un accredito reale
autorizzato senza duplicati.

## Lavoro ordinato per impatto

### P0 — necessario per il pilota aziendale

1. Creare D1 e applicare gli script SQL nell'ordine documentato in
   [company-cloud-activation-2026-09-20.md](company-cloud-activation-2026-09-20.md).
2. Configurare un solo driver degli allegati e le relative quote.
3. Configurare Access/OIDC con persone o domini esplicitamente autorizzati;
   non usare regole aperte a qualunque email valida.
4. Creare il primo tenant e associare il `sub` firmato del proprietario.
5. Eseguire il collaudo a due identità e conservare gli esiti della prova.
6. Completare stato del rimborso, notifiche e percorso di recupero account.

### P1 — necessario prima di vendere l'integrazione

1. Scegliere un gestionale pilota con account e ambiente autorizzati.
2. Implementare il connettore sul servizio aziendale, mai dentro la PWA.
3. Salvare identificativo remoto, ricevuta, stato e chiave di idempotenza.
4. Collaudare timeout, ritentativi, rifiuti, rimborso parziale e valuta estera.
5. Ripetere lo stesso contratto di prova prima di dichiarare un altro
   gestionale supportato.

### P1 — necessario per App Store e Play Store

1. Build e firma native del commit destinato al rilascio.
2. Prove fisiche su iPhone e Android, incluse installazione, aggiornamento,
   tastiera, fotocamera, allegati, background e perdita di rete.
3. Dichiarazioni Apple App Privacy e Google Play Data Safety sulla build reale.
4. Assistenza, recupero dati, acquisto e annullamento dell'abbonamento.

### P2 — prova di leadership, non requisito tecnico isolato

1. Confrontare gli stessi compiti con alternative di mercato usando utenti con
   ruoli equivalenti.
2. Misurare tempo al primo invio valido, errori, abbandoni, richieste di
   assistenza e correzioni.
3. Valutare suggerimenti e previsioni su dati futuri separati dai dati usati
   per costruirli.
4. Pubblicare soltanto vantaggi confermati dalle misure.

## Evidenze tecniche disponibili

- Commit pubblicato su `main`: `e99884f` (`feat: prepare same-origin company cloud service`).
- Repository locale e `origin/main` allineati al momento della verifica.
- Suite eseguita file per file: 395 file superati.
- Ultima verifica mirata: 30 test superati su readiness, invio aziendale e worker.
- Build PWA portabile completata.
- Build portabile Pages Functions: due route su due compilate.
- Produzione: home PWA caricata; endpoint aziendale raggiunto e protetto.

`spawn EPERM` nell'ambiente Codex impedisce ai runner che creano sottoprocessi
di avviare Node/esbuild. Non è stato trasformato in un falso esito positivo:
test file per file e builder WebAssembly portabile permettono di verificare il
codice senza disattivare protezioni del computer.

## Regola di aggiornamento

Aggiornare questo documento quando una prova cambia lo stato di una riga.
Registrare data, commit, ambiente e risultato. Non trasformare una build verde,
una fixture, un export o una schermata in prova di un servizio esterno realmente
ricevuto, di una conformità fiscale o di una compatibilità con dispositivi non
collaudati.

## Esperienza aggiornamenti — 20 settembre 2026
Rinnovati pannello delle novità e avviso aggiornamento: orbita animata,
layout mobile con azione sempre disponibile, focus tastiera e movimento ridotto.
Le novità dal 13 al 20 settembre sono raggruppate in quattro temi e tradotte
nelle sette lingue. Tutte le release successive a whatsNewSeen vengono incluse:
al ritorno le precedenti non lette sono espanse; solo la consultazione manuale
comprime lo storico. Il cursore si aggiorna alla chiusura, non all'accesso.
Accesso manuale aggiunto al Vault. Nessuna migrazione dei dati finanziari.
Verifiche: 10/10 test cronologia (tutte le versioni reali), 90/90 test i18n,
controllo sintattico e build portabile. Il ciclo aggiornamento PWA in produzione
e i dispositivi fisici non sono stati collaudati in questa modifica.
Verifica browser locale: apertura automatica delle novità, rendering desktop e viewport 390x844, nessun overflow orizzontale nel contenuto (368/368 px), pulsante entro il viewport e chiusura Escape verificati. La viewport simulata non sostituisce un dispositivo fisico.

Revisione visiva richiesta dall'utente: recuperati starfield originale, nebulosa,
card traslucide e intestazione centrata con orbita più presente. Ingresso a
scaglione, respiro lento del pianeta e risposta hover solo con puntatore fine.
Restano invariati recupero di tutte le novità non lette, traduzioni e cursore.
Build portabile riuscita; verifica visiva browser e viewport 390x844: contenuto
348/348 px senza overflow e pulsante con bordo inferiore 819 px, entro schermo.
Non è una prova fisica. Modifica locale, non ancora distribuita.

Accenti delle novità differenziati secondo il colore già dichiarato in ogni
voce: azzurro, verde acqua, oro e lilla. Icone, bordi e fondo sfumato condividono
l'accento; titoli e descrizioni restano leggibili senza dipendere dal colore.
Verifica browser locale della palette, 10/10 test cronologia e build portabile
riusciti. Logica delle novità non lette invariata; modifica non distribuita.

## Accesso ai dati e sincronizzazione — verifica 20 settembre
Aggiunte scorciatoie visibili nel Vault per dispositivi e cancellazione. Il
secondo comando apre spiegazione e controlli esistenti, non cancella al tocco.
Verificato nel browser senza eseguire cancellazioni. Sui controlli touch e
sulle card novità impedita la selezione accidentale; input, textarea e codici
restano selezionabili. Corretto il testo obsoleto del pairing usando il testo
multilingua del confine di condivisione già presente.
Build portabile riuscita. Test confine dati privati 4/4; test sync da eseguire
con --no-experimental-global-navigator su Node 24 (il fixture ridefinisce navigator).
La sincronizzazione universale live NON è completata: esistono delta dei
movimenti e tombstone fra peer autorizzati, ma servono copertura verificata
per modifiche concorrenti, impostazioni, allegati e apprendimento, riconnessione
semplice, coda durevole e collaudo fra due dispositivi reali. Non presentare
export/import come sync e non promettere aggiornamenti ad app chiusa.

Gestione dati e consenso dispositivi: scorciatoia Gestisci i dati apre il
percorso di cancellazione senza eseguirlo. Aggiunto elenco dispositivi autorizzati
con revoca locale, salvataggio del registro e chiusura dei canali corrispondenti.
La revoca non elimina copie remote. Test identità e revoca 14/14 superati.
BLOCCO concreto individuato: authorizePrivatePeer resta sul default false nel
collegamento main.js. Non abilitare usando solo un peerId o device_hello:
serve una sfida firmata legata al canale corrente e consenso prima dei dati.
Sincronizzazione privata end-to-end ancora da collegare e collaudare; nessuna
promessa di sincronizzazione universale live o ad app chiusa.

## Sincronizzazione personale serverless — base di sicurezza
Implementato private-sync-sessions.js: challenge casuale con scadenza, firma
ECDSA con dominio di protocollo, binding ai due fingerprint DTLS, consenso
esplicito separato dalla fiducia storica, verifica della sessione corrente e
revoca ricontrollata a ogni autorizzazione. Non usa server, account esterni o
identificatori pubblici come prova d'identità. Test negativi per replay, sessione
sostituita, revoca, scadenza, assenza di DTLS e inoltro su canali diversi.
NON ancora collegato al trasporto nell'app: il default resta deny. Da completare:
- consenso bilaterale e scelta dell'archivio personale, con anteprima prima di
  unire due Vault già popolati; niente identificazione della persona dal Wi-Fi;
- messaggi di autenticazione e conferma reciproca prima del primo delta;
- riconciliazione delle modifiche, allegati e stato del Vault con conflitti;
- consegna differita cifrata, indicatore dell'ultima ricezione confermata,
  riconnessione e prove reali tra dispositivi su reti diverse.
Una connessione P2P aperta non garantisce raggiungibilità universale. Nessun
relay terzo va autorizzato a leggere dati privati; app sospese non sono nodi
sempre disponibili. Non dichiarare sincronizzazione completa o pubblicata.

### Riutilizzo del sync split — audit 20 settembre
CONFERMATO: shareSplitGroups, mergeIntoGroups, refresh UI live e invio al
collegamento esistono già. Suite group-membership 21/21 e garanzia-rilascio
24/24 superate, inclusi merge offline, idempotenza e convergenza multi-device.
Limite di integrazione: split_share è soggetto ad authorizePrivatePeer, ancora
non collegato in main; i test di merge non provano trasporto reale operativo.
In ricezione main verifica l'esistenza del gruppo ma non una membership
crittograficamente autenticata per quello specifico gruppo. Non abilitare un
permesso privato globale per risolvere lo split: distinguere autorizzazione al
gruppo da autorizzazione al Vault personale. Riutilizzare merge, invio e refresh
esistenti; completare i permessi per ambito prima di collegare sessioni private.

### Separazione degli ambiti e ricerca tecnica
Il trasporto split ora richiede authorizeSharedGroup per ogni gruppo in entrambe
le direzioni, oltre alla sessione privata. Default deny anche per callback async
o in errore. La sessione privata firma anche lo scope dell'archivio; scope assente,
diverso o cambiato invalida il permesso. Lo scope non prova da solo l'identità:
restano obbligatori consenso e firma legata a DTLS. Nessuno scope viene assegnato
automaticamente a due Vault popolati. Il pairing dell'app resta da integrare.
Prove: private-sync-sessions 9/9, private-data-boundary 7/7, mesh-signaling
51/51, garanzia-trasporto 11/11; build portabile riuscita. Le fixture del
protocollo dichiarano sessioni e gruppi già autorizzati; non sono prove cloud.
Fonti primarie consultate: https://www.w3.org/TR/webrtc/ e
https://www.ietf.org/rfc/rfc8827.pdf per identità/DTLS;
https://automerge.org/docs/reference/concepts/ e
https://automerge.org/docs/keyhive/ark-api-guide/ per separazione fra sincronizzazione
dei documenti e gestione delle membership. Nessuna nuova dipendenza o server
pubblico collegato; dati utente non trasmessi durante i test.

### Collegamento sperimentale dei movimenti — aggiornamento successivo
Supera il precedente blocco di wiring, NON il blocco di rilascio del Vault completo:
bindPrivateSync è collegato in main.js. I dispositivi riconosciuti hanno un'azione
Collega i miei movimenti con codice archivio comune e consenso esplicito separato
su ciascun lato, testi nelle sette lingue. Il codice non è una password e non
sostituisce firma e consenso. Lo scope già configurato non è modificabile dal
form, evitando cambi di archivio silenziosi. Revoca elimina consenso e chiude canale.
Il trasporto gestisce challenge/proof/ready con limite 4 KB, verifica il canale
corrente e consente soltanto sync_digest/sketch/need_digest/txs. Split, pesi,
trasferte e altri domini NON ereditano questa autorizzazione. Corretto onclose:
la chiusura di un canale vecchio non elimina il suo sostituto.
Test controller 4/4 (consenso bilaterale anche ritardato, revoca, ambiti esclusi),
confine dati 7/7, protocollo 51/51, i18n 90/90; build portabile riuscita.
Limiti ancora aperti: schermata consenso non collaudata con due dispositivi fisici;
riconciliazione completa di modifiche ordinarie, allegati, impostazioni e modelli;
anteprima dei conflitti fra archivi popolati; retry dopo timeout di autenticazione;
feedback dell'ultima ricezione e trasporto offline. Non dichiarare archivio intero
sempre sincronizzato né conservazione remota. Accesso resta sperimentale.

### Recupero autenticazione privata — 20 settembre, controllo successivo
Il controller ritenta la challenge dopo 10 e 20 secondi, interrompe il tentativo
a 30 secondi e permette un nuovo avvio esplicito. Autenticazione riuscita,
revoca, chiusura del canale o rimozione della fiducia fermano i retry. Ogni timer
è associato al tentativo corrente: un callback già accodato di una sessione
precedente non può revocare la nuova. Dispose cancella timer e sessioni.
Verifica: controller 9/9, sessioni 9/9, confine privato 7/7, trasporto 51/51
(76 test locali). Le fixture non sono due dispositivi fisici né reti reali.
Build portabile riuscita su 447 moduli; restano gli avvisi sui chunk grandi.
Modifica tecnica coperta dalla voce sperimentale 2026-09-20b già presente nelle
novità: nessuna nuova promessa di copertura e nessuna migrazione dei dati.
Resta da completare il feedback visibile dei timeout, la conferma persistente
della ricezione, la riconciliazione delle modifiche ordinarie e dell'intero
archivio, l'anteprima dei conflitti e il collaudo fra dispositivi fisici.
Non inviare l'intero oggetto Vault: include chiavi e autorizzazioni locali.

### Riconciliazione dell'archivio personale — 20 settembre, terzo controllo

Supera i limiti precedenti per i dati personali supportati senza spedire alla
cieca l'intero oggetto Vault. Una lista esplicita di 51 campi portabili copre
budget e profilo, piani e scadenze, obiettivi, patrimonio, trasferte, fatture e
fisco IT/CH/ES, categorie, preferenze d'investimento e apprendimento locale.
Nel testo per l'utente questi campi sono raggruppati in cinque aree leggibili;
non sono domini internet. Movimenti e cancellazioni continuano sul protocollo
CRDT dedicato; gruppi split continuano ad avere autorizzazioni di membership
separate.

Ogni campo portabile ha hash di confronto e vector clock per dispositivo. Una
modifica causalmente successiva viene applicata; modifiche concorrenti diverse
non vengono sovrascritte: entrambe restano salvate e compaiono in una schermata
di scelta. La risoluzione genera una nuova versione causale e riparte al
collegamento successivo. Le ricevute applicative di campi e transazioni sono
persistite con limiti di quantità e contenuto; l'interfaccia distingue attesa,
verifica, collegamento, ricezione confermata, timeout, disconnessione e revoca.

Il trasporto spezza payload superiori a 12.000 caratteri, li ricompone entro un
limite di 8 MiB, elimina assemblaggi incompleti dopo 60 secondi e mantiene al
massimo quattro trasferimenti concorrenti per peer. Anche le foto ricevuta
incorporate nei movimenti usano questo percorso: non dipendono più da un unico
messaggio WebRTC sovradimensionato. Gli allegati dell'archivio documentale
IndexedDB rimangono un dominio separato e non vengono dichiarati sincronizzati.
Chiavi API, identità del dispositivo, autorizzazioni, consenso, telemetria,
materiale di recupero e stato UI sono esclusi esplicitamente.

Verifiche locali: tutti i 388 file di test in `src` superati in sequenza,
5.469 test complessivi senza errori;
fra quelli mirati private-archive-sync 9/9, mesh-signaling 51/51,
private-sync-controller 9/9, private-sync-sessions 9/9, private-data-boundary
7/7, translation-coverage 9/9 e ui-strings 91/91. Il runner parallelo di Node
resta bloccato da `spawn EPERM`; gli stessi file vengono eseguiti nel processo
Node 20, uno alla volta. Build portabile riuscita su 448 moduli con esbuild
WebAssembly. Collaudo browser locale riuscito: novità, accesso dal Vault,
stato archivio e schermata conflitti; viewport 390×844 verificata senza tagli
del foglio. Questa verifica non equivale a una prova fra iPhone,
Mac e reti fisiche diverse: tale prova resta aperta e non va presentata come
superata. La sincronizzazione richiede entrambe le app raggiungibili; non è un
backup cloud né una garanzia di lavoro a PWA completamente chiusa.

### Persistenza locale efficiente — 20 settembre, quarto controllo

Il Vault conserva ora in `localStorage` un solo snapshot immediatamente
leggibile e un manifest piccolo con revisione, dimensione, hash e numero di
movimenti. La precedente shadow Base64 rimane leggibile durante la migrazione,
ma viene eliminata soltanto dopo una scrittura verificata. Per un archivio di
dimensione N, l’occupazione scende quindi da circa 2,33 N a N più il manifest,
senza comprimere o rendere opaco il dato principale.

IndexedDB resta il livello durevole con quota più ampia. Le modifiche rapide
aggiornano subito lo snapshot locale, mentre una coda latest-wins accorpa la
raffica e conserva in IndexedDB soltanto l’ultima versione. Uno stato identico
non aumenta la revisione e non viene riscritto. All’avvio, copie con lo stesso
numero di movimenti vengono ordinate anche tramite la revisione; la sicurezza
dei movimenti resta la priorità e una copia con più transazioni prevale.

La cancellazione invalida e attende la coda prima di rimuovere gli store, così
una scrittura tardiva non può ricreare dati cancellati. Il ripristino verifica
prima la copia durevole e poi pubblica snapshot e manifest locali; in caso di
errore ripristina anche i formati precedenti. Backup cifrati, passaggio iOS,
archivi storici e shadow Base64 già esistenti restano leggibili. La
sincronizzazione fra dispositivi continua a usare delta per campo e pacchetti
con limite esplicito: questa modifica riduce spazio e amplificazione delle
scritture locali, ma non trasforma il Vault in una conservazione cloud.

Verifica di questo controllo: 389 file di test eseguiti singolarmente con Node
20, 5.476 test superati e nessun errore; `vault.test.js` 45/45,
`vault-storage.test.js` 5/5, `restore-safety.test.js` 16/16,
`ui-strings.test.js` 92/92 e copertura traduzioni 9/9. Build portabile di
produzione riuscita su 449 moduli. Restano gli avvisi preesistenti sui chunk
grandi; non indicano un errore della persistenza.

### Consegna differita cifrata — prerequisito chiuso, 21 settembre 2026

Verificato leggendo il codice (non ipotizzato): `store-forward.js` esiste già
completo (ECDH P-256 + AES-GCM via WebCrypto, TTL, limite dimensione, sacco
di trasporto con igiene automatica) e `exchange-identity.js` mantiene una
chiave di scambio persistente non esportabile — ma **nessun punto del codice
chiamava mai `sealFor()`**: l'infrastruttura di consegna differita esisteva ma
non trasportava nulla, perché mancava il prerequisito — i dispositivi fidati
non si scambiavano mai la propria chiave di SCAMBIO (solo quella di FIRMA,
usata per l'identità). Senza sapere a quale chiave sigillare un pacchetto,
nessuna staffetta poteva partire.

Chiuso questo prerequisito: `device_hello` porta ora anche la chiave di
scambio (mai per uno sconosciuto — solo dopo che le tre parole sono già state
confermate), `setTrustedExchangeKey` (device-trust.js) la registra/aggiorna
sul dispositivo fidato corrispondente, segue le rotazioni della chiave senza
richiedere una nuova conferma umana (non è una nuova decisione di fiducia,
solo l'aggiornamento di una destinazione). Verificato: `device-trust.test.js`
18/18, `mesh-signaling.test.js` 52/52 (nuovo test end-to-end sendDeviceHello→
onDeviceHello con e senza chiave di scambio), suite app 5.488/5.488 su Node 20.

**Non ancora fatto, resta il prossimo passo reale**: nessun codice sigilla
ancora `privateArchivePatch(VaultDAO.state, {})` per i dispositivi fidati
NON connessi in questo momento e lo consegna con `window.inviaAlDispositivo`
— il prerequisito (sapere a chi sigillare) è pronto, il collegamento vero e
proprio no. Da fare con attenzione al limite di 64 KB per pacchetto
(`MAX_BUNDLE_BYTES`) e a non ri-sigillare l'intero archivio a ogni
salvataggio (chiacchiericcio inutile): serve un throttle e, se il payload
supera il limite, una strategia dichiarata (es. solo i campi cambiati dopo
l'ultima consegna nota), non un troncamento silenzioso.

### Guida SdI: link diretto al servizio di trasmissione — 21 settembre 2026

Feedback utente: la guida di caricamento mandava a un portale generico
(`ivaservizi.agenziaentrate.gov.it/portale/`), lasciando l'utente a
"cercare ogni cosa dentro quel sito" — attrito reale segnalato come causa
di abbandono. Aggiunto `SDI_WIZARD_URL`/`portals.it.wizardUrl`
(`.../ser/fatturewizard/#/home`, verificato raggiungibile con `curl -I`
prima di scriverlo), usato SOLO dopo il passo di accesso — mai come primo
link, perché prima dell'autenticazione rimanderebbe comunque al login,
riproducendo la stessa confusione segnalata. Collegato sia nella guida
statica (`showUploadHelp`) sia nel walkthrough passo-passo
(`src/ui/tax-handoff.js`), tradotto in 7 lingue.
Verificato: `tax-handoff.test.js` 4/4 (nuovo test dedicato), suite
5490/5490. Non verificato dal vivo in Chrome (stesso limite ambientale
già segnalato in questa sessione).

**Segnalazione utente non ancora risolta, in attesa di dettaglio**:
"quando crei l'XML mancano dei controlli" — verificato `fatturapa-xml.js`
(`missingForFatturaPa`/`validateFatturaPa`): la validazione copre già
campi obbligatori, formato P.IVA/CF e checksum ufficiale (codici SdI
00417/00401/00404/00306). Nessun controllo specifico mancante identificato
senza un esempio concreto dell'utente (quale campo/scenario ha superato la
validazione ma è stato scartato dallo SdI) — non inventare una regola di
validazione senza una fonte verificata, stessa disciplina del resto del
progetto.

### Checksum P.IVA/CF: da warning a errore bloccante — 21 settembre 2026

Risolta la segnalazione sopra ("mancano dei controlli"), rimasta in sospeso
senza un esempio concreto: il controllo esisteva già ma era `warn`, non
`err` — un checksum ufficialmente sbagliato è uno scarto CERTO dallo SdI
(non probabile come gli altri warning di `validateFatturaPa`), quindi l'XML
si scaricava comunque e l'utente scopriva lo scarto solo dopo il
caricamento reale sul portale. Promosso a errore bloccante in
`fatturapa-xml.js` (`buildFatturaPaXML().blocking` ora `true`), con test
dedicato. Suite 5491/5491 su Node 20. Non verificato dal vivo in Chrome
(estensione non connessa in questa sessione).

### Gate PRO: verifica riga per riga dei 9 punti collegati — 21 settembre 2026

Nessuna verifica dal vivo in Chrome era stata fatta per gli 8 gate PRO
collegati nella sessione precedente (rischio dichiarato: bloccare per
errore un'azione che doveva restare libera). Estensione Chrome non
connessa anche in questa sessione — fatta una verifica statica completa,
riga per riga, di ogni punto d'ingresso di ciascuna feature gated
(`fisco_italia`, `fisco_svizzera`, `fisco_spagna`, `fatturazione_elettronica`,
`sentiment_on_device`, `sync_multi_dispositivo`, `comps_multipli`,
`posizionamento_derivati_crypto`).

**Trovato e corretto un bypass reale**: `window.setTaxRegime` (la funzione
che attiva davvero `fisco_italia`) era gated solo quando raggiunta tramite
`openTaxRegimePicker`, ma due pulsanti "scegli regime" separati
(`renderTax`/`renderTaxSettings`, mostrati quando c'è una fattura ma manca
ancora il regime) la chiamavano DIRETTAMENTE — un utente FREE poteva
impostare/cambiare il regime gratis da lì, aggirando del tutto il piano a
pagamento. Il gate è stato spostato dentro `setTaxRegime` stesso, l'unico
vero punto di attivazione, non su una sola delle sue porte d'ingresso.

Gli altri 7 gate sono risultati corretti: bloccano solo l'attivazione, mai
la disattivazione (`setEsActive(false)`, `setSentimentLocalOptIn(false)`)
né azioni gratuite collaterali (PDF fattura `#inv-generate`, simulatori
funnel `openSpainSimulator`). Suite 5491/5491 su Node 20.

**Ancora da fare, dichiarato esplicitamente**: nessuna prova dal vivo in
browser reale per nessuno dei 9 punti — priorità non appena l'estensione
Chrome torna disponibile, prima di considerare il sistema di piani pronto
per il rilascio pubblico.

### Decimo gate: analisi_causale_titolo — 21 settembre 2026

Collegato `analisi_causale_titolo` (`titolo-causale.js`/`confronto-titoli.js`,
PRO_INVESTOR) nel punto unico in cui il QA di mercato consegna la risposta
(callback `mercato:` in `askMomentum`, main.js), gated solo quando la
risposta porta davvero l'analisi (`result.data` presente) — le domande di
chiarimento restano libere. Nessun modale sopra la chat: la risposta
testuale stessa spiega il prezzo (stesso testo `featureGateBody` già in 7
lingue). Suite 5491/5491, build verificata. Non verificato dal vivo.

**Deliberatamente NON toccati in questa sessione** (rischio concreto di
rompere contenuto FREE senza poterlo verificare in browser):
`pannello_sec_base`/`beneish_piotroski` (annidati in rendering condiviso,
~850 righe — serve una limitazione dei dati mostrati, non un gate
booleano), `pannello_sec_completo` (stesso rendering), `proiezioni_monte_carlo`
(motore Monte Carlo di `net-worth.js` embedded nel What-if simulator di
Analisi Tensor insieme a contenuto gratuito — slider, tabella strategia),
`regime_di_mercato` (`detectLiveRegimeFor`, 3 punti di chiamata diversi che
alimentano Dashboard e altre card). Restano gate PRO_INVESTOR dichiarati
nell'infrastruttura (`subscription.js`) ma non collegati: liberi per
chiunque, non un errore nascosto — coerente con l'onestà del resto del
progetto (`FEATURES_PER_PIANO` dichiara nel commento cosa è vero e cosa no).

### Trasporto mesh e durabilità locale — 23 settembre 2026

Il controllo dopo i 22 commit arrivati su `origin/main` ha mantenuto il nuovo
scambio della chiave per la consegna differita. L'archivio personale ora usa
una coda WebRTC con limite di memoria e backpressure: un campo grande viene
spezzato e non riempie senza limite il buffer del canale. I campi vengono
inviati uno per volta; il successivo parte dopo una ricevuta applicativa con
hash corrispondente. Una ricevuta mancante provoca fino a tre tentativi,
mentre un errore di consegna viene segnalato. Alla riconnessione resta la
riconciliazione tramite manifest, che serve anche dopo una sospensione. I
movimenti nuovi hanno un invio live separato; le modifiche alle altre aree
personali non partono ancora automaticamente a ogni salvataggio e attendono
il successivo collegamento o ritorno dell'app in primo piano.

Il Vault ora tenta la richiesta di storage persistente soltanto dopo un gesto
dell'utente e soltanto quando esistono dati personali; se il browser la nega,
il salvataggio continua. Alla sospensione della pagina si attende la scrittura
IndexedDB già in corso, senza garanzia che il sistema operativo lasci il tempo
di completarla; alla ripresa i peer ancora connessi chiedono una
nuova riconciliazione. Una serializzazione iterativa di ripiego conserva un
archivio non circolare molto annidato quando `JSON.stringify` esaurisce lo
stack. Anche l'impronta dell'archivio usa un ripiego iterativo solo quando la
profondità esaurisce lo stack, mantenendo identiche le impronte normali.
Il percorso comune è Web/PWA e webview Capacitor, senza nuova dipendenza
nativa né copia in chiaro in un filesystem aggiuntivo.

**Limiti ancora aperti:** una conferma applicativa non è una copia di backup;
la perdita contemporanea di tutti i dispositivi senza backup resta possibile.
Solo i campi nella allowlist dell'archivio, le transazioni e i protocolli
specifici già collegati partecipano al sync; allegati separati in IndexedDB,
segreti del dispositivo e dati aziendali non vengono trasferiti da questo
percorso. Non esiste una prova fisica iOS/Android né la garanzia che una PWA o
un'app sospesa resti attiva per sincronizzare. Mancano test su reti mobili
vere, NAT ostili, quota piena e aggiornamenti nativi firmati. Il plugin
Capacitor App non è stato aggiunto: l'installazione della dipendenza non si è
completata in questo ambiente; non dichiarare agganci nativi `pause/resume`.
La leadership di mercato richiede confronti esterni e misure di perdita,
latenza, consumo e completamento del recupero, non segue da questi test.

**Prove eseguite sul checkout del 23 settembre:** integrazione dei 22 commit
remoti senza conflitti; 404/404 file di test eseguiti separatamente con Node
24 (il runner parallelo resta bloccato da `spawn EPERM`); ripetuti dopo gli
ultimi ritocchi i test mirati di mesh, archivio, persistenza e Vault, tutti
superati. Gli stati storici sintetici v7.0 e v7.1 sono stati aperti e
risalvati controllando ogni campo originario; i byte JSON normali rimangono
identici al serializzatore precedente. Questi campioni non sostituiscono gli
archivi reali di tutti gli utenti. Build portabile di produzione riuscita su
452 moduli. Avvio della
build su `127.0.0.1:4177` verificato in browser con Dashboard e novità
visibili, senza errori JavaScript registrati. Non è una prova di trasferimento
fra due dispositivi fisici né di conservazione dopo disinstallazione.

**Decisione di rilascio per il nuovo trasporto/Vault:** mantenere la versione
già pubblicata finché un collaudo con backup preventivo non copre almeno
aggiornamento di un archivio reale preesistente, scrittura interrotta/quota
piena, revoca e riassociazione del dispositivo, conflitti, trasferimento di
archivio grande e recupero su iOS/Android fisici. Test e build locali da soli
non dimostrano assenza assoluta di perdita dati sul parco dispositivi.

### Split verificabile e percorsi pubblici — 24 settembre 2026

Il salvataggio di una divisione ora richiede importo finito e quote valide,
espresse al centesimo e con somma esatta. Gli importi nella valuta del gruppo
con frazioni di centesimo vengono rifiutati; un importo convertito viene
arrotondato una sola volta nella valuta base. Le quote suggerite dallo storico
distribuiscono i centesimi residui prima della conferma; se l'utente modifica
una quota senza riequilibrare le altre, la schermata mostra lo scarto e
disabilita salvataggio e invito. L'ipotesi di spesa ricorrente usa soltanto
storia coerente per pagatore e ripartizione, e resta un'ipotesi: non crea una
spesa o un debito. La curva di cassa include solo saldi di gruppi con un unico
slot personale rivendicato, valuta omogenea, spese non contestate e registro
aritmeticamente valido; se un gruppo non soddisfa questi requisiti, la cifra
split viene sospesa e il motivo segnalato. La compensazione fra gruppi non
accoppia più persone solo perché hanno lo stesso nome: richiede identità
collegate e un rapporto a due persone. Gli archivi esistenti non vengono
riscritti da queste verifiche.

Tre percorsi pubblici statici (split, trasferte, Partita IVA) sono generati in
sette lingue, con intenzione di apertura della relativa funzione consumata una
sola volta nell'app. La comunicazione su trasferte e fisco distingue
preparazione/export da invio ricevuto e adempimento ufficiale; nessun
connettore o invio nazionale viene dichiarato attivo sulla base delle pagine.

**Prove locali:** test mirati di calcolo, validazione, lingue e pagine
282/282; una divisione da 10,01 € fra due persone ha mostrato 5,01 € e
5,00 € nel browser locale, mentre un aumento non compensato ha mostrato lo
scarto e bloccato le azioni. Generazione delle pagine e build portabile di
produzione riuscite (459 moduli). La suite completa separata per file è
passata: **408/408 file**, senza fallimenti; dopo l'ultimo controllo di
identità, della quota lasciata vuota e degli importi sub-centesimo,
altri **142/142 test Split** superati.
Pagina Trasferte verificata nel
browser locale: l'esempio cambia stato senza presentare la preparazione come
ricezione. Queste prove non sostituiscono il collaudo su dispositivi fisici.

**Limiti di rilascio:** l'uguaglianza aritmetica al centesimo è verificabile
per dati validi, ma una previsione non può essere garantita come debito reale;
identità, importi e cambi inseriti dall'utente richiedono conferma. Il bundle
iniziale dell'app resta grande (circa 3,35 MB minificati, 1,14 MB gzip) e non
è stata fatta una prova su rete mobile e telefoni fisici. Le nuove pagine non
sono ancora state verificate nella distribuzione Cloudflare. Restano i blocchi
di Vault/sync, connettori aziendali, verifiche fiscali e pagamenti dichiarati
nelle sezioni precedenti: questa revisione non abilita un rilascio globale o
una promessa di superiorità verso i concorrenti.

**Revisione Split del 24 settembre:** rimosso un motore non collegato alla UI
che sommava debiti di gruppi diversi per nome: due omonimi potevano essere
confusi. La nuova vista nell'elenco dei gruppi mostra una compensazione solo
per coppie con slot rivendicati dagli stessi dispositivi, valuta uguale,
registro valido, nessuna contestazione e saldi opposti. Se un gruppo della
stessa coppia è ambiguo o incompleto, la proposta si astiene. La vista è
solo un calcolo sui saldi registrati: non crea rimborsi, non sa se una persona
ha già pagato fuori dall'app e invita a controllarlo. La bozza Split non
consiglia più di rimandare un rimborso perché una futura spesa *potrebbe*
compensarlo: la cadenza storica non è una garanzia. Il comportamento è
tradotto nelle sette lingue; i dati Vault esistenti restano invariati.

**Prove della revisione:** i test mirati coprono centesimi, dieci persone
con omonimi, gruppi contestati, valute diverse, duplicati e registri rotti.
La suite seriale ha superato 408/408 file; la build portabile ha trasformato
459 moduli. Nel browser locale una divisione da 10,01 € ha assegnato 5,01 €
e 5,00 € senza perdere il centesimo. La prima guida del pulsante + non copre
più il risultato della modale.

**Chiarezza del primo avvio, dei movimenti e del Vault — 24 settembre:**
la schermata subito dopo l'onboarding applica titolo e invito nella lingua
effettiva della sessione prima di mostrarsi. Le singole transazioni hanno
gerarchia più leggibile, accento della categoria e aree di tocco di almeno
44 px per categoria, pianificazione ed eliminazione. Il Vault mostra prima
gli effetti comprensibili dei motori; nomi e specifiche sono apribili a
richiesta. Le fonti di mercato aggiuntive e gli assistenti alternativi sono
progressivi; la procedura per una chiave è in tre passi tradotti nelle sette
lingue. Salvare una chiave non viene più presentato come verifica della
connessione. La chat esterna resta opzionale, con invio del riepilogo
finanziario disattivato di default. Nessun archivio utente è stato migrato
o riscritto da queste modifiche di interfaccia.

Nel browser locale l'inglese ha mostrato titolo e messaggio di privacy in
inglese. A 390 px la guida alla chiave non aveva scorrimento orizzontale;
la riga di movimento misurava 346 px e tutti i suoi pulsanti almeno 44 px
di altezza. La verifica è su viewport simulata, non su iPhone fisico.
Rimangono da provare l'onboarding completo in ciascuna lingua su telefoni
reali, la validità delle chiavi presso i fornitori scelti dall'utente e il
caricamento della nuova build pubblica dopo un push. Il bundle principale
resta circa 3,38 MB minificati / 1,15 MB gzip: il riordino del Vault non ha
risolto il tempo al primo avvio su rete mobile.

Questa sezione registrava il lavoro del 24 settembre su un branch locale.
Al 25 settembre il checkout corrente è `main`; lo stato del push e della
distribuzione di ciascun nuovo intervento va verificato sul commit remoto e
su Cloudflare, non dedotto dal nome del branch o dalla build locale. Nessun
token incollato in chat è stato usato per la verifica.

### Ricerca investimenti e fonti senza chiave — 25 settembre 2026

La ricerca asset riconosce ora ETF comuni con tipo dichiarato. Per società
statunitensi note nell'archivio SEC prova un endpoint same-origin limitato ai
depositi recenti e collega il documento ufficiale. Per articoli indicizzati
prova GDELT tramite un relay limitato ai titoli e ai link; per cripto prova
un feed editoriale CoinDesk, mostrando solo titolo, link e data. I feed
restano separati dalle discussioni Hacker News e dalle serie storiche.
TradingView offre una fonte esterna per visualizzare una quotazione di azioni
ed ETF senza chiave: il link è sempre visibile, l'anteprima è facoltativa,
e i dati dell'iframe non entrano nei calcoli né negli avvisi di Momentum.
La disponibilità, la tempestività e la licenza dei listini dipendono dalla
borsa e dalla fonte: nessuna quotazione universale in tempo reale è garantita.
Le categorie CoinGecko manifestamente fuorvianti per Bitcoin vengono filtrate.
Queste modifiche non migrano né riscrivono il Vault.
Per azioni ed ETF senza una fonte numerica configurata, la scheda offre la
visualizzazione esterna ma non promette più avvisi che Momentum non potrebbe
verificare; guida invece a collegare una fonte. Il confronto fra società non
viene proposto per un ETF come se fosse un'azienda operativa.

**Prove:** test dei parser, input limitati, URL sicuri, date, cache e fallback;
build portabile dell'app e bundle delle sei route Pages riusciti. Nel
browser locale al 25 settembre: ricerca SPY senza chiave riuscita e fonte
TradingView visibile anche quando l'anteprima di terzi è indisponibile;
Apple mostra il bilancio SEC annuale con anno dell'archivio distinto dalle
notizie; Bitcoin mostra prezzo CoinGecko con timestamp sorgente e non espone
più etichette chiaramente improprie come «FTX Holdings». La prova su
viewport mobile simulato non equivale a un test su telefono fisico.

**Limiti aperti:** i relay SEC/GDELT/CoinDesk/Fed/BCE non sono ancora
verificati in una distribuzione Cloudflare reale. Un server statico generico
non esegue le Pages Functions; l'anteprima portabile del progetto inoltra ora
solo queste quattro route agli stessi handler per consentire il collaudo
end-to-end locale. Se una fonte non risponde, le discussioni Hacker News
restano un ripiego chiaramente etichettato.
Nel test browser la scorciatoia «S&P 500» cercava la frase e non trovava
risultati: ora apre SPY, etichettato come ETF. Per gli ETF si evitano le
ricerche lente per nome dell'emittente su GDELT/Hacker News, che potevano
confondere notizie della società con notizie del fondo; resta la fonte
esterna del fondo e il contesto macro ufficiale. Notizie e storico partono
in parallelo per ridurre l'attesa, senza usare un token come prezzo ufficiale.
La scheda ora appare prima che tutti i feed opzionali siano terminati e
aggiunge notizie, contesto e storico quando arrivano; una nuova selezione
impedisce ai risultati della ricerca precedente di sovrascrivere la scheda.
Se lo storico deriva da un token che segue un'azione, la scheda lo dichiara
accanto al grafico in tutte le sette lingue: non è una quotazione ufficiale.
Il 25 settembre la route SEC è stata eseguita con la fonte reale dalla rete
locale: Apple CIK 320193, HTTP 200, sei depositi recenti (primo 10-Q), in
circa 0,3 secondi. La route CoinDesk ha restituito HTTP 200 e sei titoli
Bitcoin datati in circa 0,25 secondi. I feed ufficiali Fed e BCE hanno
risposto HTTP 200 con 15 voci ciascuno; il riepilogo con entrambi ha
selezionato un comunicato per fonte in circa 0,3 secondi. Si tratta di
prove di rete e dei route handler locali, NON di prova della distribuzione
Cloudflare né di un dispositivo fisico.
La stessa prova GDELT su Apple è fallita con `source_unavailable` dopo circa
10,6 secondi per un errore di rete, mentre una richiesta precedente aveva
restituito dati dopo circa 14 secondi. Il tempo massimo del relay è ora
18 secondi e il client non ripete un errore 503 con una seconda richiesta
lenta. GDELT resta opportunistico; l'app mostra cache scaduta come tale o
discende alle discussioni comunitarie, mai presentate come notizie verificate.
Il pannello asset usa il motore macro Fed/BCE già esistente per offrire il
contesto ufficiale separato dalle notizie societarie. La vista breve limita
una fonte a tre voci, così la BCE non scompare dietro cinque voci Fed; i
link, le date e gli argomenti economici sono filtrati prima della
presentazione. Il relay Momentum per Fed e BCE usa due URL ufficiali fissi,
limita le risposte ai titoli e ai link originali ed evita il relay RSS di
terzi quando l'app è distribuita con le Pages Functions. Nella prova diretta
del 25 settembre ha restituito HTTP 200 e 12 voci per fonte in circa 0,25 s
(Fed) e 0,07 s (BCE). Un comunicato BCE sulle nomine non viene trattato come
notizia di mercato nel dettaglio asset. Il fallback storico resta nel
server statico generico, dove le Functions rispondono 404. I codici SEC 8-K,
10-Q e 10-K hanno una spiegazione breve in tutte le sette lingue.
Suite completa dopo l'intervento: 411/411 file; build portabile dell'app
riuscita (464 moduli, bundle principale circa 3,47 MB minificati / 1,17 MB
gzip); bundle delle sei route Pages riuscito. Nel browser locale a 390 px
la scheda Apple ha mostrato un articolo indicizzato da GDELT e la sezione
Fed/BCE apribile senza overflow. Il controllo tablet/desktop e i dispositivi
fisici restano da effettuare: il viewport del browser di prova non ha
applicato l'override richiesto.
CoinDesk/GDELT possono essere indisponibili o non coprire un titolo; i loro
articoli non sono prove della correttezza dei fatti. Le notizie indicizzate
riportano la data di osservazione, non una data di pubblicazione inventata.
L'anteprima portabile locale esegue ora gli stessi quattro lettori di mercato
usati dalle Pages Functions: SEC, GDELT, CoinDesk, Fed/BCE. Il 25 settembre,
dal browser a 390 px, Bitcoin ha mostrato quattro titoli CoinDesk con data e
link originali dopo la selezione; senza il relay locale comparivano soltanto
le discussioni Hacker News. Apple ha mostrato sei depositi SEC recenti e un
comunicato Fed e uno BCE nella sezione espandibile. La prova della route
GDELT nello stesso giro ha restituito 503: l'interfaccia ha mostrato un
articolo salvato con l'avviso di fonte non disponibile, senza trattarlo come
evidenza corrente. La provenienza di un titolo GDELT viene ora letta dal
dominio del collegamento HTTPS, non dal campo `domain` del feed che potrebbe
essere diverso. La ricerca SPY ha mostrato il fondo come ETF e ha evitato
di attribuirgli bilanci di un'azienda. Questo è un collaudo locale end-to-end,
non un collaudo del deploy Cloudflare.
Una seconda prova in Chrome ha trovato un errore di percorso: CoinGecko Search
non ha risposto e «Bitcoin» finiva in «nessun risultato». La ricerca ora ha
identità locali per cinque cripto note (BTC, ETH, SOL, USDC, XRP), senza
prezzi incorporati: un problema temporaneo del provider non nasconde la
scheda, ma prezzo, storico e notizie richiedono ancora fonti effettive.
Il fallback è verificato con il provider simulato offline e poi in Chrome:
«Bitcoin» compare subito anche quando la ricerca CoinGecko non risponde; la
scheda apre quattro titoli CoinDesk dal relay locale, ma dichiara che il
prezzo live non è disponibile. La verifica a 390 px non è un collaudo
su telefono fisico; l'override a 320 px richiesto al browser non è stato
applicato dal runtime, quindi non viene dichiarato testato.
Resta da misurare il tempo al primo risultato su rete mobile reale; il
bundle iniziale resta circa 3,47 MB minificati / 1,17 MB gzip. Nessun dato
di prezzo esterno non licenziato alimenta portafoglio, modelli o segnali.
### Gate PRO: prima prova dal vivo + prezzo sbagliato sui gate Investor — 26 settembre 2026

Prima verifica in Chrome reale (dev server locale, utente nuovo dopo
onboarding, piano FREE). `openRiskParityGate` e `openSwissSimulator`
aprono l'avviso e ritornano false: il blocco funziona.

**Bug reale trovato solo dal vivo**: `requireProFeature` mostrava lo stesso
avviso "piano PRO — €3,99/mese" anche per le funzioni solo PRO_INVESTOR
(`risk_parity_rebalancing`, `comps_multipli`,
`posizionamento_derivati_crypto`, `analisi_causale_titolo`). Chi avesse
pagato PRO le avrebbe trovate ancora bloccate. PRO Investor non ha un prezzo
deciso (`pricing-decision-2026-09-21.md` fissa solo PRO): l'avviso Investor
ora nomina il piano giusto SENZA un prezzo inventato. Nuova funzione pura
`requiredTier` (subscription.js, 2 test, incluso uno di coerenza con
`hasFeature` su ogni chiave). Nota del 21/09 non riscritta (regola delle
novità): aggiunta la release di correzione `2026-09-26`.

Stessa sessione: etichetta onboarding "Domanda 4 di 4 — l'ultima" seguita da
altre domande (entrate, poi Partita IVA/Paese) → ora "Domanda 4 di 4";
`riskParityLockedBody` mostrava l'identificativo interno "PRO_INVESTOR".

Verifica: suite 5508/5508 su Node 20, build riuscita, due gate verificati
dal vivo. **Decisione aperta per l'utente**: prezzo di PRO Investor — senza,
le 4 funzioni Investor sono bloccate per tutti e non acquistabili.
Gli altri gate restano verificati solo staticamente.

### Licenze legate al dispositivo + prezzo PRO Investor — 26 settembre 2026

Prezzo PRO Investor deciso (€6,99/mese, €59,99/anno) e mostrato in card e
avviso. Licenze legate al dispositivo: dettagli e limiti in
[pricing-decision-2026-09-21.md](pricing-decision-2026-09-21.md). Corretto
anche un problema preesistente: `currentTier` si fidava di `state.license.tier`
senza riverificare la firma. "PRO aggiunge" elencava funzioni solo Investor
(pannello SEC completo, analisi avanzata): ora ogni piano elenca ciò che
sblocca davvero; card tradotta nelle 7 lingue.

Verifica dal vivo in Chrome (localhost), con licenze reali emesse da
`bench/issue-license.mjs` per 1 giorno: licenza di un altro dispositivo
rifiutata con messaggio chiaro; licenza corretta attivata, gate risk-parity
sbloccato, PRO Investor ancora attivo dopo il ricaricamento; eliminata solo
la chiave del dispositivo (dati e licenza intatti) → nuovo codice, licenza
non più valida. Bug trovato così e corretto: la verifica d'avvio girava prima
del caricamento del Vault. Nessuna prova su dispositivi fisici o store.

### Pagamenti web e ciclo di vita delle licenze — 26 settembre 2026

Ricerca costi, architettura, prove e passi di attivazione in
[payments-2026-09-26.md](payments-2026-09-26.md). Servizio `/api/license/*`
costruito e verificato dal vivo col runtime Cloudflare locale; **non
operativo in produzione** finché non esistono account Stripe, KV `LICENSES` e
segreti (`GET /api/license/readiness` lo dice). Corretto un blocco reale di
produzione: `_routes.json` escludeva `/api/*`, quindi le funzioni di mercato
(SEC, notizie, trimestrali) non rispondevano. Acquisti negli store nativi non
ancora costruiti.

### Cifratura a riposo e blocco con PIN — 26 settembre 2026

Dati personali cifrati nello storage del browser (Vault, log, copie di
sicurezza, originali fatture), PIN facoltativo. Dettagli, prove e limiti in
[encryption-at-rest-2026-09-26.md](encryption-at-rest-2026-09-26.md).
Verificato dal vivo con la migrazione di dati reali in chiaro. Restano da
fare biometria nativa, blocco dopo inattività e avvisi di prezzo in background.

### Face ID, blocco dopo inattività, GDPR e requisiti store — 26 settembre 2026

Biometria nelle app native (Keychain/Keystore protetti dalla biometria, PIN
come riserva), blocco dopo 1/5/15 minuti verificato dal vivo in Chrome,
informativa e termini riscritti (IT+EN), conservazione della telemetria
limitata a 13 mesi, portale Stripe per disdire, manifesto privacy iOS. Stato
e lavoro residuo in [store-and-gdpr-readiness-2026-09-26.md](store-and-gdpr-readiness-2026-09-26.md).
Face ID e impronta non provati su dispositivi reali.
