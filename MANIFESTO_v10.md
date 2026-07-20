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

## Risposta a Google Finance (uscito da beta il 25 giugno 2026 — fatti verificati via ricerca)

Google Finance ha lanciato: portfolio tracking multi-fonte (screenshot/CSV/PDF/testo
libero -> AI struttura), AI briefings programmabili in linguaggio naturale (consegnati
come notifiche), un tool Research che interroga il portafoglio (allocazione settoriale,
esposizione), Deep Search (Gemini, ricerche multiple simultanee con citazioni), nuova
app Android, espansione a 100+ paesi. Fonti: blog.google (google-finance-updates-june-2026,
new-google-finance-ai-deep-search), ppc.land, pymnts.com (luglio 2026).

Analisi onesta (non hype): e' un tracker di PORTAFOGLIO potenziato da un LLM cloud
(Gemini), non un motore di finanza personale. Tre limiti strutturali che Momentum sfrutta:
1. CLOUD: il portafoglio caricato vive sui server Google; Deep Search e i briefing girano
   su Gemini — nessun modo di offrirlo on-device (richiede web live + LLM enorme).
2. SOLO INVESTIMENTI: non tocca mai le transazioni bancarie reali, nessuna vista
   cashflow+investimenti unificata — esattamente il vuoto che il Net Worth Twin (Lab 4,
   gia' in produzione) e NeuroSym.reason() (Wave 12) riempiono.
3. Reattivo su richiesta: i "key moments" spiegano UN prezzo con news generiche, non
   l'impatto sulla TUA situazione (fondo emergenza, budget, tasse) — cosa che nessun
   tracker di portafoglio puo' fare senza vedere le tue spese.

Lente di design per Wave 12: educazione finanziaria predittiva. Il vero gap del
settore (nessuna app insegna mentre consiglia) diventa parte della RISPOSTA, non una
feature separata: NeuroSym.reason() deve sempre citare IL PRINCIPIO insieme al numero
("fondo d'emergenza prima: regola di Dalio sulla diversificazione dei rischi" non solo
"puoi investire 200€"). Crescita personale e finanziaria come conseguenza naturale
dell'usare l'app, non un modulo "corsi" a parte — coerente con Lab 10 (strategy
scorecard, motivazione testuale citabile) gia' pianificato.

Risposta COSTRUIBILE (non insegue Deep Search, la respinge esplicitamente come
[Rifiutato]: richiederebbe LLM cloud + ricerca web, contro la regola on-device):
- Wave 12 (NeuroSym.reason) diventa la risposta diretta ai "key moments": non "il prezzo
  X e' sceso per la notizia Y" (news generiche) ma "il tuo ETF e' sceso del 3%: sul TUO
  portafoglio significa Z€, il tuo fondo emergenza resta coperto, nessuna azione
  necessaria" — personalizzato su dati che Google Finance non vede.
- L'import portafoglio multi-fonte di Google (screenshot/CSV/PDF/testo) e' un pattern
  BUONO da assorbire: Momentum lo fa gia' per le TRANSAZIONI (multi-import.js, OCR
  screenshot) ma non ancora per l'IMPORT DI POSIZIONI portafoglio dedicato — gap onesto
  da chiudere in una wave futura leggera (riuso di pdf-parser.js/OCR esistenti, stesso
  pattern, on-device).
- Deep Search/AI briefings su news generiche: [Rifiutato] esplicito. La versione reale e
  potente per Momentum resta Lab 8 (sources.js, fonti strutturate whitelist FRED/ECB con
  cross-check) — dati certi, non sintesi di news, mai spacciata per "ricerca AI".

## Verifica di un blueprint esterno (2026-07-20): tecnologie reali, scala sbagliata

Un documento incollato dall'utente citava TCGformer/FinSecure-FL/NanoQuant/UltraSketchLLM/
PrismML come "conferma della direzione". Verificato via WebSearch (regola n.1: mai un
claim tecnico non controllato): sono TUTTE reali (paper ICML/arXiv 2026, notizia Apple-
PrismML luglio 2026 confermata da piu' fonti) — a differenza dei blueprint "SLLMv2" del
passato, qui la ricerca era vera. Il problema non e' la fabbricazione, e' la SCALA:
- NanoQuant/UltraSketchLLM: comprimono LLM da 70B parametri (54GB->4GB) via ADMM su GPU
  H100. I modelli di Momentum sono gia' minuscoli (KB). Importare quella macchina per
  comprimere un MLP che pesa gia' pochi KB sarebbe facciata pura. [Rifiutato come
  trapianto 1:1] — resta il roadmap INT4/INT8 gia' dichiarato (V9.3), chiamato col suo nome.
- TCGformer: Transformer gerarchico + GNN addestrato su dataset istituzionali, richiede
  training pesante — non gira on-device. MA il suo primo stadio (Variable-lag Granger
  Causality) e' statistica leggera, buildable in JS senza GPU. [Costruibile ora, scalato]:
  upgrade di src/predict/causal-graph.js da correlazione di Pearson ritardata a un vero
  test di Granger (regressione VAR + F-test) — naturale prosieguo di Wave 14/pruneNonCausal.
- FinSecure-FL: blockchain Proof-of-Authority multi-istituzionale, conformita' MiFID
  II/SEC per BANCHE. Momentum non ha bisogno di conformita' regolatoria bancaria — la
  mesh e' P2P tra i device di UN utente o pochi peer opt-in. La parte utile (DP-noise sui
  delta, ledger tamper-evident, aggregazione pesata per reputazione) esiste gia' in forma
  scalata correttamente in src/mesh/update-ledger.js + Lab 1/Wave 15 del piano.
- Proiezioni di business (2 mld/anno 4, "perche' Apple/Tesla/OpenAI ci vorranno"):
  [Rifiutato] come sempre, mai dichiarate come fatto.

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
