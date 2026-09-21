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

## Sblocco reale collegato, 21 settembre 2026 (pomeriggio)

Scoperta verificando il codice: `hasFeature()` (src/core/subscription.js)
esisteva da tempo ma **non veniva mai chiamata da nessuna schermata** —
ogni funzione PRO/PRO_INVESTOR era di fatto già sbloccata per chiunque,
licenza o no. Costruito `requireProFeature(featureKey)` (main.js): mostra
un avviso onesto col prezzo vero (mai un blocco silenzioso) e riporta
`false` se la persona non ha il piano.

**Prezzo ora scritto in un solo posto** (`PRICE_PRO_MONTHLY_EUR`/
`PRICE_PRO_YEARLY_EUR` in subscription.js) e mostrato nella card PRO
esistente (`pro-license-price` in index.html) — mai più un numero
ricopiato a mano che può disallinearsi. Tradotto nelle 7 lingue.

**Collegato a UN solo punto reale come prova del meccanismo**:
`window.openTaxRegimePicker` (tenere traccia di un regime fiscale attivo —
la vera feature `fisco_italia`, la parte partita IVA). Il simulatore
"sto valutando" (`openTaxLevel1Simulate`) resta volutamente libero: è il
funnel di scoperta, non la feature a pagamento.

**Verificato**: `node --check` su tutti i file toccati, suite completa
5489/5489, `translation-coverage.test.js` 9/9. **Non verificato dal vivo in
Chrome** (estensione non connessa in questo ambiente in questa sessione) —
resta da fare prima di dichiararlo definitivamente pronto, per la stessa
regola (AGENTS.md: "npm test non vede la UI") che governa ogni altra
modifica al DOM in questo progetto.

**Non ancora fatto, elenco onesto**:
- Gli altri 7 punti d'ingresso PRO/PRO_INVESTOR restano SBLOCCATI per
  chiunque (mai gated): `fisco_svizzera` (`openSwissSimulator`),
  `fisco_spagna` (`openSpainSimulator`), `fatturazione_elettronica`
  (`openInvoiceWorkspace` e famiglia), `pannello_sec_base`,
  `beneish_piotroski`, `sentiment_on_device`, `sync_multi_dispositivo`.
  Stesso pattern di `requireProFeature('chiave')` da ripetere in ognuno,
  con la STESSA cautela usata per fisco_italia: capire prima quale
  funzione è davvero il funnel gratuito e quale la feature a pagamento,
  non gated alla cieca.
- Nessun sistema di fatturazione (Stripe o equivalente) è collegato:
  prezzi decisi, non ancora applicati a un flusso di pagamento reale.
  Serve un account del sistema di pagamento scelto — decisione/azione
  dell'utente, non di codice.
