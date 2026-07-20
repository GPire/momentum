# MOMENTUM CONSTELLATION v10 — Manifesto offensivo

> Non "un modello AI". Una **costellazione federata di modelli specializzati** che gira
> interamente sul device. Il moat non e' un singolo algoritmo: e' l'architettura che i
> cloud non possono replicare senza rinnegare se' stessi.
>
> Regola n.1 (non negoziabile): niente moduli decorativi, niente numeri non misurati.
> Ogni voce e' etichettata [Costruibile ora] / [Research-grade] / [Rifiutato: oversold].

## Perche' vinciamo: le 4 debolezze strutturali di TUTTI i concorrenti

Cleo, Copilot Money, Monarch, YNAB, Rocket Money, Emma, Origin; infra Plaid/Yodlee;
nuova ondata di "AI finance" che sono wrapper su LLM cloud. Debolezze architetturali
(non copiabili senza rifare l'azienda):

1. Sono cloud: i dati bancari escono dal device e vivono sui loro server. E' il loro
   modello di business, non possono spegnerlo.
2. Dipendono da aggregatori (Plaid/Yodlee): legati a USA/UK, fragili, a pagamento,
   comunque data-in-transit.
3. Usano LLM cloud generici: allucinano l'aritmetica, costano per-token, richiedono rete.
4. SaaS a canone: offline = morti.

Oceano blu: nessuno puo' dire "il tuo dato non lascia mai il telefono, funziona offline,
non allucina i numeri". Momentum si'. E' una categoria nuova, non un concorrente migliore.

## La tesi tecnica (vera e misurata)

Una costellazione di piccoli modelli specializzati on-device, orchestrati e federati,
batte un LLM cloud gigante sul dominio finanziario: a 0,1 ms, a costo zero, con privacy
assoluta. Evidenza gia' in casa: bench:reasoning 12/12 dove i frontier LLM sbagliano
l'aritmetica; Banking77 91,6% on-device in 0,09 ms.

## Il consiglio scientifico: 9 laboratori

### Lab 1 — Federated Learning & Privacy differenziale  [moat n.1]
FedAvg + Local Differential Privacy (rumore calibrato sui delta prima della condivisione)
+ reputazione hash-chained anti-poisoning (gia' in casa).
- DP-noise locale in JS: [Costruibile ora]
- Secure Aggregation crittografica (Bonawitz): [Research-grade]

### Lab 2 — TinyML: quantizzazione e distillazione
INT4/INT8 post-training + knowledge distillation (Momentum Core teacher -> studente
minuscolo) + pruning magnitude-based. [Costruibile ora] Arma sui device economici.

### Lab 3 — Inferenza causale (non correlazione)
DCGN -> causal discovery ristretta (PC-algorithm / NOTEARS-lite) sul grafo delle proprie
transazioni + controfattuali do-calculus.
- DCGN correlazionale-causale: [Costruibile ora]
- Scoperta causale piena: [Research-grade]

### Lab 4 — Financial Digital Twin (Bayesiano)
State-space + particle filter per il cashflow, aggiornamento bayesiano online delle
distribuzioni di spesa con intervalli di credibilita', Monte Carlo per strategia.
[Costruibile ora] — e' il batch net-worth da chiudere.

### Lab 5 — Reinforcement Learning per l'advisor
Contextual bandit / Thompson sampling on-device: ogni nudge e' un braccio, la ricompensa
e' il risparmio reale osservato. Personalizzazione che nessun advisor statico ha.
[Costruibile ora]

### Lab 6 — Forecasting probabilistico calibrato
State-space / N-BEATS-lite con intervalli calibrati (ECE, temperature-scaling) e
walk-forward validation. [Costruibile ora] in forma ristretta.

### Lab 7 — Small Language Model grounded (anti-allucinazione by design)
Chatbot deterministico sui numeri (gli engine calcolano); SLM distillato+quantizzato cura
solo la formulazione; i valori sono sempre iniettati dagli engine (grounded generation).
- Intent/slot on-device: [Costruibile ora]
- SLM per phrasing: [Research-grade]

### Lab 8 — Privacy verificabile (prova, non promessa)
Attestazione runtime egress-dati = 0, vault AES-GCM hash-chained, cross-check delle sole
fonti strutturate whitelist (sources W17, gia' scritto). [Costruibile ora]

### Lab 9 — Mechanism design della rete
Mesh federato come effetto-rete difendibile: incentivi alla contribuzione (reputazione),
anti-poisoning validato sui dati locali. Migliora da solo con la scala, costo marginale
zero, privacy intatta. [Costruibile ora] — mesh-signaling gia' nel batch appeso.

## Rifiutato fermamente (regola n.1)
[Rifiutato] LLM/transformer proprietario da zero (serve GPU cluster + dataset + team),
crittografia omomorfica end-to-end, "25x hardware", navigazione web autonoma
anti-fake-news. La versione reale e potente di ognuno e' gia' uno dei 9 lab sopra.

## Sintesi
I cloud-app hanno UN LLM generico che vede i tuoi dati. Momentum ha NOVE specialisti che
non li fanno mai uscire, girano offline a 0,1 ms, non allucinano i numeri, e diventano
piu' intelligenti collettivamente senza tradire la privacy.

Tre pilastri (Lab 4 Twin, Lab 8 sources, Lab 9 mesh) sono gia' scritti e appesi nel batch
non committato: renderli reali e' a un commit di distanza.

## Verita' di mercato: la retention e' il vero campo di battaglia (analisi 30 free + 34 paid)

Le app di budgeting hanno retention disastroso: la maggioranza abbandonata in 3-4
settimane, retention a 90gg sotto il 10%. Le cause sono STRUTTURALI, non personali. Chi le
risolve vince il settore. Mappa killer -> risposta Momentum (buildable):

| Killer del settore (evidenza) | Risposta Momentum |
|---|---|
| Frizione inserimento manuale (a fine mese solo ~40% delle spese e' registrata) | Voice-first, OCR notifiche, quick-add contestuale, import PDF/CSV con dedup — gia' in casa, da spingere a ZERO tap |
| Onboarding lungo + paywall duro (30 domande poi paga) | Apri e usi: un solo numero dominante "oggi puoi spendere X" (verde/rosso), nessun account |
| Update rotti che distruggono la fiducia (Revolut 4.68->3.69, Money Pro crash) | Testing sacro: node --test verde + build + verifica browser reale prima di ogni release |
| Supporto inesistente (Trade Republic, buddybank 1.4/5) | Canali chiari in-app + trasparenza dati "100% on-device, mai condivisi" |
| Sync fragile (HomeBudget, Money Pro, AndroMoney) | Sync CRDT cifrata gia' costruita -> renderla bulletproof, mai riscrive amount/hash |
| Abbonamento forzato (killer #1 di churn) | Zero abbonamento come MoneyStats/Streaks: modello di valore diverso |
| Advisor passivo che si esaurisce (mostra numeri, non guida) | Lab 5 bandit: impara QUALE nudge fa agire QUESTO utente e lo promuove |
| Limiti alle funzioni base (Splitwise 3 tx/giorno) | Nessun limite artificiale: la privacy on-device e' il fossato, non il paywall |

Punti di forza dei leader da ASSORBIRE: semplicita' che dura (Streaks/AndroMoney),
gamification a dopamina onesta (Streaks: streak+ricompensa), NLU (Todoist: "ho speso 50 al
ristorante" -> transazione), personalizzazione (MoneyStats), integrazione multi-funzione
(TickTick). Momentum ha gia' 5 lingue di chatbot NL deterministico: e' avanti sull'NLU
perche' NON allucina i numeri.

Frizione PSICOLOGICA (il livello che i competitor ignorano): l'abbandono non e'
disinteresse, e' che l'app "smette di essere utile" quando svanisce la novita'. Il Lab 5
(bandit) + Lab 4 (Twin che proietta il TUO futuro) combattono esattamente questo: valore
che aumenta con l'uso invece di degradare a manutenzione manuale.

## Valutazione: onesta' (regola n.1)
Obiettivo dichiarato dall'utente: ~2 mld. NON si promette come fatto: il codice non e' cio'
che sblocca la valutazione. La sbloccano utenti reali + retention MISURATA + audit di
sicurezza terzo + IP + team. La catena onesta e' questa: la costellazione (differenziatore
tecnico difendibile) -> retention alta (perche' risolviamo i killer strutturali sopra) ->
network effect del mesh (valore che cresce con la scala) -> metriche che giustificano la
valutazione. L'ordine e': prima le metriche, poi il numero. Mai il contrario ("SLLMv2").

## Sequenziamento operativo
1. Chiudere il batch appeso (Twin + sources + mesh) con verifica browser + commit.
2. Lab 5 bandit advisor — FATTO (src/predict/advisor-bandit.js, 8 test verdi). Resta:
   cablarlo in getAdvisorInsights (ranking) + osservare reward reale dai tap.
3. Zero-frizione onboarding: un numero dominante al primo avvio (killer #1 retention).
3. Lab 1 DP-noise sui delta federati (rende il moat "privacy-proof").
4. Lab 2 INT4 (mercati device economici) + Lab 3 controfattuali causali.
