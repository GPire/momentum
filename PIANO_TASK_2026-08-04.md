# Piano task aggiornato — 2026-08-04

Ripresa dei task aperti della sessione del 03/08 (parte 22), con ogni task **riscritto per essere
più predittivo, più intelligente e realmente innovativo**, e agganciato a un problema concreto:
o un problema che i competitor non possono risolvere per come sono fatti, o un problema che fa
abbandonare l'app agli utenti veri.

Regole del progetto che valgono anche qui (non negoziabili):
1. 100% on-device, nessun server.
2. Mai un numero non misurato, mai un modulo decorativo. Ogni claim ha un file e un test dietro.
3. Funzioni pure + `node --test src/`, DOM solo in `main.js`, campi di stato additivi.
4. Comprensibile a un bambino di 8 anni.

Stato di partenza verificato: `HEAD a407d84`, **23 commit locali mai pushati**, 1473 test verdi.

---

## T1 — Claim falsi nei documenti del 31/07 ✅ FATTO (04/08)

**Problema**: `00_CRITICAL_PATH_WEEK_BY_WEEK.md` conteneva un commit message pronto da eseguire che
dichiarava "ECDH + AES-256-GCM + HMAC-SHA256" e "GDPR Article 32 (encryption)" per l'invito di
gruppo. Nel codice reale l'invito è **base64 in chiaro** (`split-engine.js:630`). Se quel commit
fosse partito, su GitHub sarebbe finito un claim di sicurezza falso **e firmato**.

**Fatto ora**:
- Commit message corretto con lo stato reale (invito in chiaro, DTLS del canale WebRTC, AES-GCM
  solo in `core/backup.js`, ECDSA/HMAC solo in `core/update-locator.js`, cifratura applicativa
  assente).
- Nota di onestà in testa al documento: i 10 documenti del 31/07 sono **strategia e intenzione**,
  non inventario. `src/mesh/crypto.js`, citato in più documenti, **non esiste**.
- `AI_MODELS_PROBLEMS_SOLUTIONS.md`: segnalata la proposta come non implementata **e corretto un
  errore logico** — nello schema proposto il peer *decifra* per estrarre la categoria, quindi la
  frase "peer never sees €200 unencrypted" sarebbe falsa comunque. Per essere vera il peer deve
  ricevere **solo aggregati già calcolati all'origine**, mai un dato cifrato da aprire.
- Le altre menzioni di ECDH/GCM nei documenti sono caselle di lavoro futuro non spuntate: corrette
  così come sono. Diventano un problema solo se copiate in un testo al passato.

---

## T2 — Crittografia reale + invito vincolato allo slot

**Problema utente reale**: il link di invito finisce in una chat di gruppo da 40 persone. Oggi
chiunque lo apra vede **i nomi di tutti i membri** e può entrare. Non c'è modo di revocarlo.

**Problema dei competitor**: Splitwise/Settle Up revocano l'invito **dal server**. Momentum non ha
un server — quindi non può copiare la loro soluzione. Serve una soluzione migliore, non una scusa.

**Upgrade (da "cifra il payload" a un modello di capability offline)**:
- **Un link per persona, non un link per gruppo.** Ogni invito porta un token di capability legato
  a **uno slot**: il link di Marco può reclamare solo lo slot "Marco". Girato a 40 persone, resta
  lo slot di Marco.
- **Payload cifrato** con AES-256-GCM, chiave derivata via HKDF dal segreto che vive **solo nel
  fragment dell'URL** (mai inviato a nessun server, comportamento già garantito da `invite-codec.js`).
  Fuori restano solo id opachi: **i nomi dei membri smettono di essere leggibili nel link**.
- **Claim firmato**: chi entra firma il proprio claim con la chiave del dispositivo (ECDSA,
  WebCrypto — stessa primitiva già usata in `update-locator.js`). Regola CRDT: un claim **firmato**
  batte sempre uno non firmato; tra due firmati vince il primo nel tempo. Nessun server, merge
  ancora commutativo e idempotente.
- **Revoca senza server**: lapide di revoca firmata dal creatore, propagata via gossip — stesso
  meccanismo già validato per le spese cancellate (T22/bug #3). *Limite onesto da scrivere in UI:
  la revoca arriva solo ai dispositivi che sincronizzano, non è istantanea come un server.*
- **Intelligenza aggiunta (predittiva, non decorativa)**: se uno slot già attivo viene reclamato da
  un `deviceId` mai visto, l'app non fallisce in silenzio — chiede in linguaggio umano
  *"Marco è entrato da un secondo telefono. Sei tu?"*. Il segnale (deviceId + timestamp) esiste già.

**Verifica**: test di sicurezza reali, non teorici — un link rubato prova a reclamare uno slot
diverso e deve fallire; due claim concorrenti sullo stesso slot devono convergere allo stesso
vincitore su tutti i dispositivi; il link deve restare **sotto 900 caratteri** (soglia QR misurata
il 03/08) — il costo di nonce+tag (~38 caratteri) va compensato dalla rimozione dei nomi in chiaro.
**Limite onesto**: chi possiede il link legittimo di Marco *è* Marco per l'app. Senza server non
esiste un'identità verificata; questo va detto, non nascosto.

---

## T3 — Audit mesh: dire la verità sulla rete **prima** che fallisca

**Problema utente reale (il più grave del P2P)**: su rete mobile 4G/5G molti operatori usano NAT
simmetrico/CGNAT. Il collegamento diretto WebRTC **non si stabilisce**, e senza un server TURN non
è aggirabile. Oggi l'utente vede una rotella che gira e poi niente: sembra un'app rotta.

**Problema dei competitor**: chi risolve questo problema lo risolve con un server TURN (cioè con
infrastruttura, cioè con dati che passano da qualcuno). Momentum deve vincere **senza**.

**Upgrade (da "audit" a rete che si autodiagnostica e ha sempre un piano B)**:
- **Sonda NAT on-device** usando solo STUN pubblici gratuiti (nessun dato personale in uscita):
  classifica il tipo di NAT e **predice** l'esito del collegamento diretto. L'app lo dice *prima*:
  *"Su questa rete il collegamento diretto probabilmente non funziona — usiamo il link, è
  altrettanto sicuro."* Un'app che sa dire "qui non funzionerà" è più affidabile di una che ci prova.
- **Piano B che funziona sempre — delta incollabile**: se il P2P non parte, l'app genera **solo le
  modifiche che l'altro dispositivo non ha ancora visto** (vector clock già presente nel merge CRDT),
  compresse con `invite-codec` (deflate + base64url). Un codice corto da incollare in chat. Funziona
  con qualsiasi rete, qualsiasi operatore, anche offline via AirDrop/Bluetooth. Nessun competitor
  cloud ha questo, perché non ne ha mai avuto bisogno — ed è esattamente ciò che li rende inutili
  senza connessione.
- **Riconnessione senza ripartire da zero**: backoff esponenziale + ripresa dal vector clock.
- **Condivisione risorse ridimensionata all'onesto e resa misurabile**: non "calcolo distribuito",
  ma *quale dispositivo fa il lavoro pesante* (training, ricalcolo Monte Carlo). Regola con segnali
  veri: batteria in carica + schermo acceso + `hardwareConcurrency` più alto → quel dispositivo
  calcola e passa **il risultato**, mai i dati. *Limite onesto: la Battery Status API non esiste su
  Safari/iOS — lì si ripiega su schermo acceso + core, dichiarato nel codice.*

**Verifica**: simulazione con 2–12 peer che include **partizioni di rete e riconnessioni** (oggi i
test coprono solo aggiunta/cancellazione offline), più prova dal vivo della sonda NAT su Wi-Fi e su
hotspot 4G reale — due reti diverse, risultati diversi, entrambi riportati.

---

## T4 — Backup e recupero: la risposta all'obiezione numero uno

**Problema utente reale**: telefono perso o rotto = tutto perso. È **la** ragione per cui la gente
non si fida di un'app senza cloud, ed è l'unico punto in cui i competitor cloud sono oggettivamente
superiori: loro ripristinano da soli.

**Upgrade (da "un file di backup" a un recupero a tre gambe che non richiede memoria umana)**:
- **Il tuo secondo dispositivo è già un backup.** Se la mesh è attiva, il telefono nuovo si
  ripristina dal tablet via link/QR. Zero file, zero passphrase.
- **Recupero a soglia (Shamir secret sharing su GF(256))**: la chiave si divide in 3 pezzi, ne
  bastano 2 per tornare. Un pezzo a te via mail, uno su una chiavetta, uno sul telefono di chi ti
  fidi. Nessun server, nessun singolo punto da rubare, nessuna password da ricordare.
  **Non è codice esotico**: l'aritmetica GF(256) esiste già in `src/pay/qr-encode.js:13-21`
  (EXP/LOG/gfMul, polinomio 0x11D) — si riusa quella, ~100 righe di funzioni pure testabili.
- **Promemoria predittivo, non a calendario**: il backup non si chiede "ogni domenica" (rumore che
  si impara a ignorare), si chiede quando il **valore non protetto** supera una soglia reale —
  *"hai 34 spese che non esistono in nessun altro posto"*.
- **Verifica del RIPRISTINO, non del salvataggio**: ogni backup viene riaperto e confrontato con la
  hash chain dello stato vivo prima di scrivere "fatto". I backup silenziosamente corrotti sono un
  problema reale di settore; qui il messaggio "salvato" significa "riaperto e verificato".

**Verifica**: prova end-to-end di distruzione — vault svuotato, ripristino da 2 pezzi su 3, hash
chain identica; ripristino da dispositivo appaiato; backup deliberatamente corrotto → deve essere
**rifiutato**, non importato a metà.
**Limite onesto da dichiarare in UI**: se perdi passphrase *e* i pezzi, non esiste recupero. È il
prezzo del fatto che nessuno può leggere i tuoi dati — va scritto prima, non dopo il disastro.

---

## T5 — Conteggio onesto: installazioni ≠ persone

**Problema reale**: gli investitori chiedono numeri di adozione. Un'app che promette privacy non
può tracciare le persone. La via facile (gonfiare gli install) distrugge esattamente la cosa che
rende Momentum credibile.

**Upgrade (da "conta gli install" a un numero difendibile con l'incertezza dichiarata)**:
- **Tre grandezze distinte, mai confuse**: installazioni attive (misurabile), dispositivi per
  persona (**stimabile solo** da chi usa la mesh: i dispositivi appaiati sanno di essere lo stesso
  vault e possono contribuire un "1 persona, k dispositivi" anonimo), persone (una **stima con
  banda**, mai un numero secco).
- **Conteggio che non identifica nessuno**: HyperLogLog sull'anonId lato worker → unici stimati
  **senza conservare gli id**; risposta rumorosa (privacy differenziale locale) per gli attributi
  aggregati. Standard consolidato, ~150 righe, e diventa un argomento di vendita: *"contiamo senza
  poter sapere chi sei"*.
- **Retention con il tasso di opt-in accanto**: chi disattiva la telemetria non è contato → ogni
  numero pubblicato porta la sua sottostima dichiarata. Nessun competitor lo fa; è precisamente il
  motivo per cui i loro numeri sono contestabili e i nostri no.

**Verifica**: simulazione con popolazione nota (es. 10.000 dispositivi simulati) → l'errore dello
stimatore va misurato, non assunto. Se lo stimatore sbaglia del 12%, si scrive 12%.

---

## T6 — Motore causa-effetto: da "A precede B" a "provalo e te lo dimostro"

**Problema reale**: ogni app di budget mostra medie e grafici. Nessuna dice **cosa succede se
cambi qualcosa**, e nessuna verifica dopo se il cambiamento ha funzionato. Il codice per il primo
passo esiste già (`causal-graph.js`: Granger bivariato **e condizionale**, lag variabile, pruning) —
è sottoutilizzato.

**Upgrade**:
- **Effetto con intervallo, non moltiplicatore inventato**: stima controfattuale sui propri dati
  (confronto pre/post sui periodi in cui la categoria è già cambiata da sola), riportata come
  intervallo. Mai "risparmi 87€": *"tra 40€ e 120€, 7 volte su 10"*.
- **Controllo dei falsi positivi**: con decine di categorie, testare tutte le coppie **produce
  legami finti per statistica pura**. Correzione per test multipli (Benjamini–Hochberg) prima di
  mostrare un arco. È la differenza tra un motore causale e un generatore di superstizioni.
- **Il grafo si vede** (chiesto in una sessione passata, mai costruito): nodi e archi, spessore =
  forza, colore = segno, e **una frase per arco leggibile da un bambino** — *"quando esci a cena il
  venerdì, il sabato dopo spendi di più al supermercato: succede 7 volte su 10"*.
- **L'esperimento (la parte che nessuno ha)**: dall'arco più forte l'app propone una prova reale —
  *"per due settimane fai X; poi ti dico io se è cambiato davvero"* — e dopo **misura l'esito con
  un test statistico**, incluso il verdetto scomodo *"non è cambiato niente"*. Un'app che può
  dirti che il suo stesso consiglio non ha funzionato è un'app di cui ti puoi fidare.

**Verifica**: dati sintetici con causa **nota** iniettata → il motore deve trovarla; dati senza
alcuna causa → deve trovarne zero (il test più importante, ed è quello che le app di settore non
passerebbero).

---

## T7 — Benchmark vs LLM, sul terreno che conta

**Problema del confronto ingenuo**: misurare "accuratezza contro GPT" su categorizzazione dice
poco e costa molto. Il campionamento sbagliato falsa tutto — lezione già pagata il 03/08 (i primi
test del settlement con saldi casuali uniformi non dimostravano nulla).

**Upgrade**:
- **Tre categorie di domande, non una**: (a) domande che un LLM **non può** risolvere perché non ha
  la cassa reale; (b) domande dove un LLM **sbaglia in modo pericoloso** — aritmetica su decine di
  transazioni, importi allucinati; (c) domande dove l'LLM **è migliore** (linguaggio libero, fuori
  dominio) — e questa colonna va pubblicata, altrimenti il benchmark è marketing.
- **Oracolo deterministico**: i dati veri sono noti, quindi la risposta giusta è calcolabile.
  Nessun "LLM come giudice", nessuna valutazione soggettiva.
- **Metriche che l'utente sente davvero**: correttezza aritmetica esatta, latenza, costo per
  risposta, e **funziona in aereo senza rete** (il confronto che chiude il discorso).
- **Tasso di allucinazione misurato**, con esempi reali riportati per intero.

---

## T8 — Audit UX: i tre punti dove si perde la gente

- **"Come cresce il tuo patrimonio"**: le due card 1/5 anni sono ancora numeri statici. Diventano
  una proiezione con banda che **si muove quando cambi un'abitudine** — collegata a T6, così la
  causa e l'effetto si vedono nello stesso posto.
- **"Sincronizza dispositivi"**: è il punto di abbandono numero uno. Stato visibile in ogni istante
  (cosa sta succedendo adesso), esito **predetto** dalla sonda NAT di T3, e piano B proposto
  *prima* del fallimento, non dopo trenta secondi di rotella.
- **tax-card**: passata in rassegna con la stessa disciplina (mai un numero su un'assunzione).
- **Aggiunto — la prima schermata vuota**: nessuna app finanziaria ti fa vedere com'è *piena* prima
  che tu ci metta i tuoi dati; lo schermo vuoto al primo avvio è una delle prime cause di abbandono
  del settore. Un dataset dimostrativo realistico + un tasto **"Cancella tutto e parti da me"**
  senza ambiguità. Costa poco, e agisce sul punto di caduta più alto dell'imbuto.

---

## T10 — Apprendimento collettivo: far crescere il modello BASE senza tradire il dispositivo

**La domanda dell'utente (04/08)**: *"forse qualche dato deve passare e lasciare il dispositivo per
far crescere Momentum in modo esponenziale — Momentum Core usa i dati personalizzati della persona,
ma deve crescere anche quello generale, quello base, per comprendere le abitudini di tutti,
categorie di spesa e altro"*.

**Risposta da ricercatore, non da venditore**: la domanda è giusta e il bisogno è reale — il modello
base oggi cresce **solo con una release**. Ma "condividere i pesi invece dei dati" **non è di per sé
una garanzia di privacy**: i gradienti di un modello possono far ricostruire i dati di addestramento
(gradient inversion, membership inference). È il punto esatto in cui quasi tutto il settore bara.
Quindi la risposta non è "sì" né "no": è **stratificare per sensibilità** e far uscire solo il
livello che serve davvero al modello generale e che non è ricostruibile.

### I quattro livelli (la regola diventa più precisa, non più debole)

| Livello | Contenuto | Esce? |
|---|---|---|
| **L0** | Importi, date, saldi, descrizioni complete, IBAN, hash chain | **MAI**, nessuna eccezione, nessuna opzione per attivarlo |
| **L1** | Layer **lessicale**: token esercente → categoria (`"esselunga" → Alimentari`). Nessun importo, nessuna data, nessuna frequenza | Solo aggregato, mascherato, rumoroso, sopra soglia di corroborazione — **opt-in** |
| **L2** | Affidabilità degli esperti per contesto (medie a posteriori arrotondate) | Già oggi via `meta-federation.js` |
| **L3** | Dati pubblici di mercato (prezzi, notizie) | Già in chiaro, nessun dato personale coinvolto |

**Perché L1 è la scelta giusta e non un compromesso**: il modello base sbaglia proprio dove il
lessico è locale — la panetteria sotto casa, il bar del paese, l'idraulico. Lì non servono gli
importi di nessuno: serve sapere che quel nome è cibo. È esattamente il segnale che si può
condividere senza rivelare una vita finanziaria, ed è il 100% del beneficio.

### Le quattro protezioni (tutte implementabili, nessuna decorativa)

1. **Soglia di corroborazione k-anonima nel gossip**: un'entrata lessicale non viene **mai**
   propagata finché non è stata osservata da almeno *k* dispositivi indipendenti (id di origine
   hashati, così lo stesso peer non conta due volte). Sotto soglia resta locale. Un esercente unico
   al mondo — che identificherebbe una persona — non esce per costruzione.
2. **Mascheratura a coppie a somma zero** tra peer appaiati: due contributi portano maschere
   opposte, la somma è esatta e il singolo contributo è indecifrabile. Serve ≥3 peer.
3. **Aggregazione robusta ai bizantini**: mediana per coordinata invece della media. Un peer
   malevolo che spinge `"farmacia" → Intrattenimento` non sposta la mediana. Più il ledger di
   reputazione già esistente (`update-ledger.js`), dove un peer con storico di rifiuti pesa ~0.
4. **Budget di privacy contabilizzato (ε)**: ogni rilascio ne consuma; esaurito, il dispositivo
   smette di contribuire fino al periodo successivo. **Mostrato all'utente in chiaro**, non sepolto.

### Il consenso, fatto in modo che nessuno fa

Opt-in esplicito **per livello**, default NO, e prima di attivarlo l'app mostra **le righe vere che
uscirebbero** — il payload reale, non una descrizione rassicurante. *"Sta per uscire questo:
esselunga → Alimentari, farmacia comunale → Salute. Nient'altro."* Nessun competitor lo fa perché
nessuno potrebbe mostrarlo senza spaventare l'utente.

### Il punto duro, dichiarato: senza un punto di raccolta il modello base cresce solo tra vicini

Il gossip fa arrivare la conoscenza ai dispositivi **connessi**. Perché il modello base migliori
*per tutti*, i contributi devono raggiungere chi costruisce la release. Senza alcun punto di
raccolta questo non accade — e va detto, non aggirato con una parola. **Osservazione che ribalta il
problema**: il valore del lessico collettivo è **locale** (gli esercenti della tua città), e la mesh
sociale — le persone con cui dividi le spese — è già esattamente la topologia dove quel valore si
concentra. Il gossip puro copre gran parte del beneficio reale.

**DECISIONE RICHIESTA (è dell'utente, non mia — cambia la promessa del prodotto):**
- **A. Solo gossip**, nessun punto di raccolta. "Nessun dato lascia il dispositivo se non verso i
  dispositivi che scegli tu" resta letteralmente vero. Crescita concentrata dove serve, lenta altrove.
- **B. Punto di raccolta a bassa fiducia**: un endpoint (il Worker già esistente) che accetta solo
  pacchetti L1 già mascherati, rumorosi e sopra soglia, senza id e senza conservare l'IP. La promessa
  diventa "nessun **dato personale** lascia il dispositivo" — vera, ma **diversa** da quella di oggi,
  e va riscritta ovunque con la stessa onestà del resto.
- **C. A come default + B come opt-in esplicito** — la scelta che consiglio: chi non tocca niente
  resta nel mondo A, chi vuole contribuire lo fa sapendo esattamente cosa esce.

**Verifica non negoziabile prima di spedire qualunque cosa**: un **attacco di ricostruzione fatto da
noi** sui pacchetti L1 — provare a risalire a un utente dai contributi, e riportare il risultato
anche se è scomodo. Se un lessico ricostruisce un profilo, la soglia *k* sale finché non lo fa più.

---

## T3-bis — Lungo raggio e risorse collettive (dalla richiesta del 04/08)

- **Lungo raggio senza infrastruttura — introduzione transitiva**: WebRTC ha bisogno di un canale di
  segnalazione, e senza server sembra un vicolo cieco. Non lo è: **una volta che hai una
  connessione, i tuoi peer diventano il tuo canale di segnalazione**. Un peer connesso sia ad A che
  a C può inoltrare offer/answer tra loro — A e C si collegano direttamente pur non essendosi mai
  scambiati un link. La rete si allarga da sola a ogni salto, con zero infrastruttura. È il pezzo
  che trasforma "coppie di dispositivi" in una mesh vera.
- **Risorse collettive, ma solo dove è onesto**: far calcolare a un altro dispositivo qualcosa sui
  *tuoi* dati significa che i tuoi dati escono — vietato. Ma il Monte Carlo delle 8 strategie
  (`net-worth.js`, 2000 percorsi) gira su **rendimenti di mercato pubblici**: nessun input personale.
  Quello sì può essere spezzato tra peer e il risultato condiviso e riusato — calcolo collettivo
  reale, a costo zero di privacy. Stessa cosa per il settlement di gruppo, che opera su dati **già
  condivisi** dentro il gruppo.
- **Chi fa il lavoro pesante**: batteria in carica + schermo acceso + `hardwareConcurrency`, con
  fallback dichiarato dove la Battery API non esiste (Safari/iOS).

---

## T11 — Partita IVA: fare quello che fanno i portali dei commercialisti, senza il loro cloud

**Cosa hanno già i portali** (Fatture in Cloud, Aruba, TeamSystem, Fattura24): creazione fattura,
invio allo SdI, ricezione delle fatture passive, registri IVA, F24, scadenzario, accesso del
commercialista. Tutti in abbonamento, tutti cloud, tutti con i tuoi dati fiscali sui loro server.

**Cosa Momentum ha già costruito** (verificato nel repo, non un annuncio): generatore XML FatturaPA
v1.2.2 vero (`src/invoice/fatturapa-xml.js`), validatore che **predice i codici di scarto SdI
offline** (00400/00415/00417/00422/00423/00427/00305/00471/00426), checksum reali di P.IVA e Codice
Fiscale (`it-fiscal-id.js`), tracciato versionato auto-aggiornabile (`fatturapa-format.js`), regole
fiscali per anno, modello AI che classifica fattura/stipendio/personale (F1 22/22 su set curato),
guida al caricamento sul portale Fatture e Corrispettivi, ciclo `pendingSdiTransmission`.

**Il buco vero, dichiarato da sempre**: un'app on-device non può trasmettere allo SdI (serve un
canale accreditato). Oggi carica l'utente a mano.

### La cosa nuova da costruire — tre livelli

1. **Il vantaggio che nessun portale può avere**: loro vedono le fatture, **non vedono la cassa**.
   Momentum vede tutte e due. Da qui esce una cosa che nessun commercialista digitale fa oggi:
   *"accantona 340 € adesso, perché a novembre ti servono e in base al tuo ritmo di spesa a ottobre
   non ce li avresti"* — non un calcolo fiscale, un calcolo fiscale **innestato nella Cassa Unica**
   (`cash-forecast.js`, p10/p50/p90 misurati). È il ponte tra i due mondi, ed è il nostro terreno.
2. **Scadenzario predittivo, non un calendario**: acconti, saldo, IVA, contributi calcolati sui
   **tuoi** dati e proiettati sulla tua liquidità reale, con l'avviso che arriva quando c'è ancora
   tempo per rimediare, non il giorno prima.
3. **Ricezione delle fatture passive**: è metà del lavoro di un portale e oggi ci manca. Va valutata
   come importazione dei file che l'utente scarica dal suo cassetto fiscale — leggibili on-device,
   nessuna credenziale in mano nostra.

### La trasmissione: una via da VERIFICARE prima di prometterla

Esiste una via di invio allo SdI via **PEC** (l'indirizzo dedicato dell'Agenzia), pensata per volumi
bassi, che non richiede accreditamento tecnico di chi sviluppa l'app: l'utente allega l'XML e invia
**dalla sua PEC**. Se confermata, Momentum preparerebbe il messaggio completo e l'utente premerebbe
invio — nessun server, nessuna credenziale fiscale in mano nostra, e il canale del portale resta
come alternativa.
**Stato: NON verificato.** Va controllato sulla documentazione ufficiale corrente dell'Agenzia
(indirizzo, limiti di volume e dimensione, condizioni) **prima** di scrivere una riga o di dirlo a
un utente. Regola del progetto: nessuna funzione fiscale annunciata su una fonte ricordata a memoria.

### "Rilasciarlo all'Agenzia delle Entrate"

Va distinto in due cose diverse, perché richiedono lavori opposti:
- **Conformità del file** (l'XML passa lo SdI): è già quasi tutta lì, si completa con test su casi
  reali e con il validatore che continua a predire gli scarti.
- **Accreditamento come intermediario/canale**: è un rapporto istituzionale con requisiti societari
  e tecnici, non una funzione da scrivere. Se è l'obiettivo, il lavoro tecnico che lo prepara è
  esattamente il punto sopra più una tracciabilità completa; il resto è una pratica, non codice.

### Fuori dall'Italia: dove e come (valutazione richiesta)

La fatturazione elettronica obbligatoria si sta diffondendo in Europa con formati diversi ma con una
**base comune** (lo standard europeo EN 16931, da cui derivano i tracciati nazionali). Questo dice
già la strategia giusta: **non costruire un generatore per Paese, ma tenere il tracciato come DATO**
— è esattamente quello che `fatturapa-format.js` e `country-invoicing.js` fanno già. Aggiungere un
Paese deve costare una entry, non un modulo.
Ordine ragionevole per valore su sforzo: prima i Paesi dove il formato deriva dallo standard europeo
e il canale è pubblico; per ultimi quelli con canali proprietari che richiedono accreditamento
locale. **Ogni Paese va confermato su fonte ufficiale corrente prima di essere aggiunto** — le date
di obbligo cambiano spesso, ed è il tipo di dettaglio che non si cita a memoria.

### E la stessa idea applicata ai consigli (correzione del 04/08)

Non è un tema europeo: la consulenza personalizzata su strumenti finanziari è attività riservata
negli USA (SEC), nel Regno Unito (FCA), in Svizzera (FINMA), a Singapore (MAS) e altrove. Quindi
**"il quadro, mai l'ordine" è l'unico disegno portabile ovunque** — un vantaggio per l'espansione,
non un limite. Va costruito un registro per Paese di **cosa si può dire** (stessa forma di
`country-invoicing.js`), così l'espansione resta una entry di dati e i testi si adattano da soli.

---

## T12 — Collegare due dispositivi: QR che cambia, ma mai SOLO il QR

**La domanda dell'utente (04/08)**: *"se mettessi Momentum nel computer, come lo collego ai dati del
mio telefono?"* — è la domanda giusta, e smonta da sola l'idea del QR come unica strada.

**Il problema di settore**: quasi tutti risolvono il collegamento con un account cloud (accedi da
entrambi e il server fa il resto). Chi non ha un server usa un QR, e chi non ha una fotocamera resta
fuori. Nessuno tratta il collegamento come un problema di **canale disponibile**.

### L'idea centrale: la direzione la sceglie l'app, non l'utente

Il computer spesso non ha una fotocamera utile, ma **il telefono ce l'ha sempre**. Quindi la regola
è: **mostra il QR chi non può inquadrare, inquadra chi può**. `navigator.mediaDevices.enumerateDevices()`
dice quali dispositivi hanno una videocamera — l'app decide da sola chi fa cosa e non chiede niente.
*Verificato dal vivo il 04/08: il rilevamento funziona, e `BarcodeDetector` esiste in Chrome (quindi
la lettura è nativa su Chrome/Edge/Android). **Non** su Safari/iOS e Firefox: lì serve un decoder
scritto da noi, oppure il canale alternativo. Da dichiarare, non da nascondere.*

### Il QR che cambia: due motivi veri, non estetica

1. **Sicurezza**: un QR fermo sullo schermo resta valido finché è lì, e una foto scattata da lontano
   vale quanto l'originale. Un codice che ruota ogni pochi secondi riduce la finestra a quei secondi.
2. **Capacità** — la parte davvero innovativa: un QR singolo tiene poche centinaia di caratteri, e
   un'offerta WebRTC completa a volte non ci sta (limite già misurato: sopra ~900 caratteri il QR non
   si genera più). Un QR **animato** trasmette un payload di qualunque dimensione a fotogrammi, e con
   una codifica a fontana il ricevitore ricostruisce appena ne ha abbastanza — **senza dover leggere
   i fotogrammi in ordine e senza dover ripartire se ne perde qualcuno**. Diventa un canale dati
   ottico, non un'immagine. Riusa il nostro encoder QR scritto da zero (`src/pay/qr-encode.js`),
   quindi è tecnologia già nostra.

### La catena di canali (l'app prova da sola, in ordine, e non fa mai fallire l'utente)

| Situazione | Canale |
|---|---|
| Un dispositivo ha la fotocamera | QR animato, direzione scelta automaticamente |
| Nessuna fotocamera (computer ↔ computer) | **Codice a parole**: poche parole comuni da digitare, nessun carattere ambiguo — funziona con la sola tastiera |
| Dispositivi lontani | Link/incolla, già costruito |
| Niente rete diretta | Delta incollabile dal vector clock (T3) |
| Nessun canale digitale | File del kit + fogli (T4, già fatto) |

Il codice a parole è il pezzo che chiude il buco del computer senza fotocamera, ed è anche il più
facile da capire: *"scrivi sull'altro schermo: tavolo — mare — quattro"*. Nessun QR, nessuna app
esterna, nessun account.

### iOS: il decoder QR ce lo scriviamo noi (e ne possediamo già metà)

Safari/iOS non ha `BarcodeDetector`, ma **ha la fotocamera** (`getUserMedia` funziona). Quindi il
pezzo mancante non è l'accesso alle immagini: è la decodifica. Va scritta, ed è alla nostra portata
perché metà del lavoro è già in casa:

- **Già nostro**: aritmetica GF(256) (`src/core/gf256.js`), struttura dei codeword, generatore
  Reed-Solomon, maschere e tabelle di formato/versione (`src/pay/qr-encode.js`, verificato contro
  riferimenti indipendenti).
- **Da scrivere**: binarizzazione adattiva dell'immagine, individuazione dei tre quadrati d'angolo,
  correzione prospettica, campionamento della griglia, e la **correzione d'errore** Reed-Solomon in
  lettura (Berlekamp–Massey → Chien → Forney). È la parte seria, ma è matematica chiusa e testabile
  con un oracolo perfetto: **cifriamo noi i QR, quindi la risposta giusta è sempre nota**.

Ne esce una capacità proprietaria vera — encoder **e** decoder QR scritti da zero, senza dipendenze,
che funzionano identici su ogni browser — invece di una funzione che su iPhone non c'è. E la
correzione d'errore in lettura rende il QR animato molto più robusto: fotogrammi sfocati o parziali
vengono recuperati invece di essere buttati.

### Sicurezza del collegamento (non basta che il QR cambi)

Un QR che ruota riduce la finestra, ma da solo non protegge da due attacchi reali:

1. **Ripetizione**: qualcuno filma lo schermo e riusa un fotogramma. → Ogni fotogramma porta un
   contatore e un istante; fuori dalla finestra viene rifiutato, e ogni fotogramma è autenticato con
   un MAC legato alla sessione (un fotogramma di un'altra sessione non entra).
2. **Intromissione nel mezzo**: qualcuno si mette tra i due dispositivi e si spaccia per entrambi. →
   Scambio di chiavi ECDH e poi **tre parole uguali mostrate sui due schermi**, derivate dalla chiave
   condivisa. Se le parole coincidono, non c'è nessuno in mezzo — è matematicamente questo, ma per
   la persona è solo *"vedi le stesse tre parole? Sì → sei collegato"*. Comprensibile a un bambino,
   e chiude un attacco che nessuna app di questo settore chiude senza un server di identità.

Lo stesso meccanismo alimenta il **codice a parole** per i dispositivi senza fotocamera: le tre
parole non sono un contorno, sono la verifica. Un solo concetto, due usi.

### Perché non basta il QR, detto in una riga

Un metodo che funziona solo con la fotocamera esclude i computer, i telefoni con la fotocamera rotta,
chi ha negato il permesso, e Safari/iOS finché non scriviamo un decoder. Un metodo che funziona
sempre — anche a costo di tre parole da digitare — è più innovativo di uno più elegante che a volte
lascia a piedi. **Il criterio del progetto resta quello: mai una funzione che fallisce in silenzio.**

---

## T9 — I 23 commit locali

Da pushare su `github.com/GPire/momentum` (privato). **Serve l'ok esplicito dell'utente**, come da
prassi del progetto. Nessun push automatico.

---

## Ordine consigliato (per impatto reale, non per difficoltà)

1. **T4 backup/recupero** — toglie l'obiezione che blocca l'adozione, e riusa codice già scritto.
2. **T2 crittografia + slot** — chiude un buco di privacy reale e rende vero un claim già scritto.
3. **T3 mesh** — trasforma il fallimento di rete da bug percepito a comportamento previsto.
4. **T6 causa-effetto** — la funzione che nessun competitor ha, sul codice che esiste già.
5. **T8 UX** — anti-abbandono, basso costo.
6. **T5 conteggio** e **T7 benchmark** — servono quando si parla con l'esterno.
