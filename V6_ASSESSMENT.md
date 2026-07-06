# Momentum V6 — valutazione onesta del blueprint (2026-07-06)

Hai incollato un blueprint "V6" ambizioso (probabilmente rifinito da un'altra AI). Come da regola #1 del progetto — **onestà tecnica assoluta, mai facciate** — lo valuto riga per riga: cosa è reale e costruito/costruibile, cosa è oversold, cosa va rifiutato. Questo documento serve a te e a chi svilupperà, per non inseguire promesse impossibili.

## ✅ COSTRUIBILE E GIÀ IN CORSO (fatto oggi, verificato)

| Idea del blueprint | Realtà nel codice |
|---|---|
| "Ragionatore Causale / Graph of Thoughts" | **Esiste**: `src/predict/causal-graph.js` — grafo di co-variazione tra categorie, lag 0/1, propagazione a catena. Non è un transformer, è statistica onesta e testata (7 test). Fa esattamente "se X sale, Y e Z si muovono". |
| "Hardware-Aware, adattivo a CPU/GPU/NPU" | **Costruito oggi**: `src/device/compute-planner.js` (8 test) sopra il profiler reale. Sceglie backend (WebGPU→WebNN→SIMD→JS), precisione, profondità Monte Carlo, worker, tier modello — dalle capacità MISURATE. Metal/Vulkan li gestisce il browser sotto WebGPU: noi non dobbiamo (né possiamo) nominarli. |
| "Federated Learning, ogni device studente e insegnante" | **Esiste e verificato su 2 nodi**: `src/mesh/` + `nexus-adapter.js`. FedAvg pesato, anti-poisoning, adozione per nodi nuovi. |
| "Apprendimento continuo, capisce a priori gli errori" | **Orchestrator v3**: impara dalle correzioni reali quale modello ascoltare per categoria (`modelStats`). |
| "Ultra-leggero sull'edge" | Nano 400KB, tier hardware, dispatcher novelty: il pesante si attiva solo quando serve. |

## ⚠️ OVERSOLD — la fisica e i dati non lo permettono in una sessione (o mai)

- **"Costruire da zero un'architettura transformer proprietaria (ITNet/DGoT/DBN) che rende ogni altro modello obsoleto"**: addestrare un vero modello linguistico/causale richiede un cluster GPU per settimane e un dataset da centinaia di milioni di esempi. NON è riproducibile qui, e "obsoleto ogni altro modello" non è dimostrabile. La via reale e già scelta: modelli scikit-learn addestrati sul dispositivo/CPU + ensemble + il grafo causale. Un vero piccolo transformer di embedding (decine di milioni di parametri) diventerebbe realistico solo su un Mac M3 Max con MPS — è nella roadmap, non è "V6 domani".
- **"Ottimizzazione hardware come se il dispositivo ne avesse 25x"**: fisicamente impossibile. Un piano adattivo usa BENE le risorse reali; non le moltiplica. Il compute-planner è onesto su questo.
- **"Memoria Spettrale / Nautile-370M / EmbBERT / SeqCond Attention"**: sono nomi di paper/modelli citati come se fossero moduli pronti. Integrarli davvero = mesi di R&S con GPU, non un import. Non li spaccio per fatti.
- **"Valutazione 2 miliardi"**: una valutazione non si decide, si guadagna con utenti, retention misurata e ricavi. Il codice è un asset reale; il numero lo fanno traction e team. Vedi gap list in PIANO_MOMENTUM.md.
- **"Rilevamento fake news navigando su fonti certe (Fed/Yahoo/Bloomberg)"**: già respinto due volte in questo progetto. (1) Il rilevamento affidabile di disinformazione è un problema di ricerca IRRISOLTO. (2) Una PWA non può "navigare autonomamente" siti terzi: la Same-Origin Policy e i CORS lo bloccano; servirebbe un proxy server (contro il vincolo "no server"). (3) Bloomberg è a pagamento. Cosa È fattibile: se l'utente è online, mostrare quotazioni da UN'API pubblica gratuita che lui autorizza — dato di mercato, non "verità verificata".

## 🛑 RIFIUTATO — non lo costruisco, ed è giusto così

**"La rete mesh deve comportarsi come un VIRUS ed entrare nei dispositivi"**: questo descrive malware — accesso non autorizzato a dispositivi altrui. Non lo costruirò in nessuna forma. Sarebbe illegale (reato informatico), farebbe bannare l'app da ogni store all'istante, e distruggerebbe esattamente l'unico vero asset del progetto: **la fiducia sulla privacy**. Un acquirente come Apple o Revolut scapperebbe alla parola "virus".

La cosa POTENTE e legale che vuoi davvero è già lì e va solo estesa: **mesh a consenso esplicito** — l'utente collega i propri dispositivi (e quelli di persone fidate) con un tocco, e l'intelligenza cresce con la rete. Cresce perché le persone la SCELGONO, non perché si intrufola. Questo è ciò che rende un'azienda desiderabile, non temibile-nel-senso-sbagliato.

## Come leggere le "versioni V6"

Rinominare tutto "V6" non aggiunge potenza. In questo progetto una versione si guadagna con un benchmark superato (vedi `VERSIONI.md`). Oggi l'ensemble fa 51.5% sul bench held-out di esercenti mai visti: la strada vera verso il salto è **alzare quel numero con dati veri**, non l'etichetta. Quando `npm run bench` dirà ≥75%, quella sarà una v2 reale del categorizzatore — misurata, difendibile davanti a un investitore tecnico, impossibile da smontare.

## Sintesi per un acquirente/investitore

Ciò che rende Momentum appetibile NON è un blueprint di transformer mai addestrato. È: **codice reale e testato (186 test), un'architettura on-device che nessuno che monetizzi i dati può copiare, federazione P2P a consenso verificata, categorizzazione con benchmark riproducibile, e onestà tecnica totale** — che è precisamente ciò che un due diligence tecnico premia e le facciate distruggono.

---

# Aggiornamento: valutazione blueprint "V7.5" (stesso giorno)

L'utente ha incollato un secondo blueprint ancora più elaborato (V7.5) con decine di sigle di paper 2026 (TGFL, TCGformer, FinInvest-GTCN, AXL/Yggdrasil, ecc.). Verdetto, con la stessa disciplina:

## ✅ Preso e COSTRUITO (la parte reale e nuova del V7.5)
- **"Blockchain audit trail + Byzantine Fault Tolerance + reputation-weighted FedAvg"** → costruito in versione onesta e funzionante: `src/mesh/update-ledger.js` (6 test). Catena hash a prova di manomissione su ogni aggiornamento federato + reputazione per peer: un nodo che prova ad avvelenare il modello **perde peso da solo**, senza autorità centrale. È la vera "tolleranza bizantina", emergente e testata — senza far girare una blockchain (che in una mesh a consenso esplicito sarebbe overhead inutile). Cablato nel percorso mesh reale (onGradientReceived).

## ⚠️ Oversold (di nuovo) — invariato rispetto al V6
- TCGformer / TGFL / decoder-only causale / homomorphic encryption end-to-end / SLM < 2MB addestrato da zero: tutte richiedono cluster GPU + dataset + mesi di R&S. Sono nomi di paper, non moduli importabili. La crittografia omomorfica completa su un budget edge è oggi impraticabile per l'inferenza in tempo reale.
- **"25x la potenza hardware"**: ripetuto, sempre fisicamente impossibile. Il compute-planner (già costruito) usa BENE le risorse; non le moltiplica. I numeri "13.5% latenza / 30.1% NPU" sono di paper su hardware/scenari specifici, non trasferibili come garanzia.
- **Navigazione autonoma Fed/Yahoo/Bloomberg + fake-news**: respinto per la terza volta (CORS/no-server, ricerca irrisolta, Bloomberg a pagamento).
- **Valutazione 2 miliardi**: si guadagna, non si dichiara.

## 🛑 Confermato rifiutato
Qualsiasi comportamento "virale/intrusivo" della mesh. La crescita è per consenso esplicito.

## Cosa è cambiato di concreto oggi
`update-ledger.js` è esattamente il tipo di feature che un due diligence tecnico ama: prende un'idea altisonante del blueprint ("blockchain BFT") e la consegna come **codice piccolo, testato e realmente utile** (integrità + reputazione anti-poisoning) invece che come slide. Questo, moltiplicato, è ciò che vale — non le sigle.
