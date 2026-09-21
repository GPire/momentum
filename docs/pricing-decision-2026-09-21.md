# Decisione di prezzo — 21 settembre 2026

Decisione esplicita dell'utente: Momentum entra sotto il prezzo di ogni
concorrente verificato, su ogni fascia (personale e aziendale), perché è un
marchio sconosciuto e deve guadagnarsi fiducia entrando basso — mai un numero
inventato, ogni cifra sotto è verificata con ricerca web reale (fonte e data
citate), coerente con la disciplina del resto del progetto.

## Prezzi dei concorrenti, verificati il 21/09/2026

| Prodotto | Fascia | Prezzo verificato | Fonte |
|---|---|---|---|
| YNAB | Personale | $9.08–14.99/mese | costbench.com |
| Copilot Money | Personale | $7.92–13/mese | costbench.com |
| Monarch Money | Personale | $8.33/mese (Core, annuale) · $199/anno (Plus) | checkthat.ai |
| Zoho Expense | Aziendale | Gratis fino a 3 utenti, poi $4–7/utente/mese | zoho.com |
| Expensify | Aziendale | $5–9/utente/mese | g2.com |
| Rydoo | Aziendale | $9–11/utente/mese | curatesuite.com |
| SAP Concur | Aziendale | $7–24/utente/mese, spesso su richiesta | costbench.com |

Pavimento verificato: **$8.33/mese** personale (nessun concorrente ha un
piano gratis completo); **aziendale** — Zoho ha un vero gratis fino a 3
utenti, Expensify a $5/utente è il più economico a pagamento.

## Prezzi Momentum decisi

- **Personale FREE**: resta come oggi (budget, categorizzazione,
  proiezione, patrimonio, import, calendario, obiettivi, split, export —
  vedi `FREE_FEATURES` in `src/core/subscription.js`). Nessun concorrente
  della tabella offre questo livello gratis.
- **Personale PRO**: **€3,99/mese o €34,99/anno** (~€2,92/mese) — sotto il
  pavimento di $8.33/mese. Sbloccca fisco IT/CH/ES, fatturazione, pannello
  SEC, sentiment on-device, sync multi-dispositivo (`PRO_FEATURES`).
- **Aziendale**: **gratis fino a 5 dipendenti** (oltre il pavimento Zoho di
  3), poi **€2,99/utente/mese** — sotto i $5/utente di Expensify.

**Perché è sostenibile, non solo aggressivo**: il lato personale gira
100% on-device (nessun Plaid, nessun server che processa transazioni) —
costo marginale per utente quasi zero, un vantaggio strutturale reale che
nessun concorrente della tabella ha. Il lato aziendale ha costi reali
(D1/R2/Workers) ma ridotti dal lavoro di efficienza già fatto (rate limit
per soggetto, query atomiche, storage a snapshot singolo — vedi
`company-cloud-activation-2026-09-20.md`).

## Onestà sui gap che il prezzo da solo non chiude (vs SAP Concur)

Verificato nel codice, non per ottimismo:

- **Feature già a livello Concur**: approvazione a uno o due stadi
  indipendenti, policy versionate e immutabili, diaria e rimborso
  chilometrico per Paese, riconciliazione con estratto conto carta,
  audit trail immutabile — tutto in `server/company/` e `src/trips/`.
- **Gap reali, dichiarati in `release-readiness-2026-09-20.md`**: nessun
  connettore ERP/contabile VIVO (solo mapping/anteprima — SdI, Concur,
  Zoho richiedono un account autorizzato del cliente per un invio reale);
  nessun tenant cloud configurato in produzione; nessuna prova su
  dispositivi fisici. Il prezzo basso non sostituisce questi collaudi:
  vendere "sostituzione di Concur" prima che siano chiusi violerebbe la
  stessa disciplina di onestà che governa il resto del progetto.

## Partite IVA

Copertura fiscale italiana già ampia (`src/predict/tax.js`: forfettario,
ordinario, F24, ravvedimento operoso, 41 riferimenti nel solo motore
italiano) più Svizzera (AVS/IPG, QR-bill) e Spagna (RETA, IRPF autonomo) —
tutto dietro il piano PRO a €3,99/mese, comunque sotto ogni concorrente
generalista della tabella (nessuno di YNAB/Copilot/Monarch ha fisco
italiano/svizzero/spagnolo).

## Non ancora fatto

Nessun sistema di fatturazione (Stripe o equivalente) è collegato: questi
sono prezzi decisi, non ancora applicati a un flusso di pagamento reale.
Serve un account del sistema di pagamento scelto — decisione/azione
dell'utente, non di codice.
