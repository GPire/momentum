# Inventory of form controls

Generated from source; labels attached by JavaScript, dynamic templates and duplicate IDs require browser verification. A missing source label is a review candidate, not a certified WCAG failure.

164 controls; 37 without a source label; 21 without name; 59 literal placeholders to review for localization.

| Source | Field | Type | Label found | Name | Placeholder |
|---|---|---|---|---|---|
| index.html:1604 | (dynamic) | select | REVIEW | REVIEW |  |
| index.html:2672 | (dynamic) | checkbox | REVIEW | REVIEW |  |
| index.html:4427 | genesis-income-input | number | yes | yes | genesisIncomePlaceholder |
| index.html:4888 | qa-input | text | yes | yes | Chiedi: "quanto posso spendere oggi?" |
| index.html:5141 | scenario-slider | range | REVIEW | yes |  |
| index.html:5161 | whatif-cat | select | REVIEW | yes |  |
| index.html:5162 | whatif-slider | range | REVIEW | yes |  |
| index.html:5373 | asset-search-input | text | yes | yes | Es. bitcoin, Apple, XLK... |
| index.html:5494 | pro-license-input | text | yes | yes | Incolla il codice di attivazione |
| index.html:5571 | csv-upload | file | REVIEW | yes |  |
| index.html:5572 | pdf-upload | file | REVIEW | yes |  |
| index.html:5573 | screenshot-upload | file | REVIEW | yes |  |
| index.html:5577 | multi-upload | file | REVIEW | yes |  |
| index.html:5758 | backup-restore-input | file | yes | yes |  |
| index.html:5783 | webrtc-peer-input | text | yes | yes | Inserisci Peer ID... |
| index.html:5814 | alphavantage-key-input | password | yes | yes | La tua chiave Alpha Vantage... |
| index.html:5826 | twelvedata-key-input | password | yes | yes | La tua chiave Twelve Data... |
| index.html:5835 | fmp-key-input | password | yes | yes | La tua chiave Financial Modeling Prep... |
| index.html:5847 | finnhub-key-input | password | yes | yes | La tua chiave Finnhub... |
| index.html:5858 | newsapi-key-input | password | yes | yes | La tua chiave NewsAPI.org... |
| index.html:5885 | telemetry-opt-in | checkbox | yes | yes |  |
| index.html:5919 | chat-context-optin | checkbox | yes | yes |  |
| index.html:5929 | force-anim-optin | checkbox | yes | yes |  |
| index.html:5938 | qa-language-select | select | yes | yes |  |
| index.html:5994 | settings-ghost-radar | checkbox | yes | yes |  |
| index.html:6018 | settings-sound | checkbox | yes | yes |  |
| index.html:6026 | notify-pref-fiscale | checkbox | yes | yes |  |
| index.html:6030 | notify-pref-normativa | checkbox | yes | yes |  |
| index.html:6034 | notify-pref-prezzi | checkbox | yes | yes |  |
| index.html:6058 | semantic-qa-optin | checkbox | yes | yes |  |
| index.html:6066 | sentiment-local-optin | checkbox | yes | yes |  |
| index.html:6084 | ev-title | text | yes | yes | Cosa? (es. Dentista, Bolletta luce) |
| index.html:6085 | ev-note | text | yes | yes | Nota (facoltativa, es. portare la tessera) |
| index.html:6087 | ev-amount | number | yes | yes | Importo € (facoltativo) |
| index.html:6089 | ev-date | date | yes | yes |  |
| index.html:6135 | high-contrast-toggle | checkbox | yes | yes |  |
| src/main.js:618 | new-cat-nome | text | yes | yes | ${tCh('catComeChiami', __uiLang)} |
| src/main.js:695 | tx-amount-display | text | yes | yes |  |
| src/main.js:845 | tx-desc | text | yes | yes | ${tCh('txDescPlaceholder', __uiLang)} |
| src/main.js:869 | tx-date-input | date | REVIEW | yes |  |
| src/main.js:966 | (dynamic) | input | REVIEW | REVIEW |  |
| src/main.js:3153 | payment-name | input | yes | yes |  |
| src/main.js:3155 | payment-months | number | yes | yes |  |
| src/main.js:3156 | payment-date | date | yes | yes |  |
| src/main.js:3157 | payment-start | date | yes | yes |  |
| src/main.js:3157 | payment-end | date | yes | yes |  |
| src/main.js:3159 | payment-amount | number | yes | yes |  |
| src/main.js:5152 | acq-desc | text | yes | yes | Cosa hai comprato (es. Laptop, hosting) |
| src/main.js:5154 | acq-imponibile | number | yes | yes | Imponibile € |
| src/main.js:5155 | acq-data | date | REVIEW | yes |  |
| src/main.js:5171 | acq-xml-input | file | REVIEW | yes |  |
| src/main.js:5284 | vers-importo | number | yes | yes | Quanto hai versato (€) |
| src/main.js:5285 | vers-nota | text | yes | yes | Nota (facoltativa): es. F24 giugno |
| src/main.js:5946 | (dynamic) | select | REVIEW | REVIEW |  |
| src/main.js:6005 | (dynamic) | select | REVIEW | REVIEW |  |
| src/main.js:6007 | (dynamic) | select | REVIEW | REVIEW |  |
| src/main.js:6063 | (dynamic) | checkbox | yes | REVIEW |  |
| src/main.js:6134 | ch-amount | number | yes | yes | ${tCh('chSimPlaceholder', __chLang)} |
| src/main.js:6223 | es-amount | number | yes | yes | ${tCh('esSimPlaceholder', __esLang)} |
| src/main.js:6313 | ch-inv-iban | text | yes | yes | ${tCh('chInvIban', __chLang)} |
| src/main.js:6314 | ch-inv-name | text | yes | yes | ${tCh('chInvName', __chLang)} |
| src/main.js:6316 | ch-inv-street | text | yes | yes | ${tCh('chInvStreet', __chLang)} |
| src/main.js:6317 | ch-inv-bld | text | yes | yes | ${tCh('chInvBuilding', __chLang)} |
| src/main.js:6320 | ch-inv-cap | text | yes | yes | ${tCh('chInvCap', __chLang)} |
| src/main.js:6321 | ch-inv-city | text | yes | yes | ${tCh('chInvCity', __chLang)} |
| src/main.js:6324 | ch-inv-client | text | yes | yes | ${tCh('chInvClientName', __chLang)} |
| src/main.js:6326 | ch-inv-amount | number | yes | yes | ${tCh('chInvAmount', __chLang)} |
| src/main.js:6327 | ch-inv-desc | text | yes | yes | ${tCh('chInvDesc', __chLang)} |
| src/main.js:6429 | tl1-amount | number | REVIEW | yes | Es. 30000 |
| src/main.js:6444 | tl1-ateco-search | text | REVIEW | yes | Es. faccio consulenza informatica… |
| src/main.js:6464 | tl1-dipendente | checkbox | yes | yes |  |
| src/main.js:6811 | escl-${chiave} | checkbox | yes | REVIEW |  |
| src/main.js:7065 | sp-oneline | input | yes | yes | Prova: 60 cena io Marco Luca |
| src/main.js:7069 | sp-desc | input | yes | yes | Per cosa? (es. Cena, Casa al mare) |
| src/main.js:7084 | (dynamic) | text | REVIEW | REVIEW | 0 |
| src/main.js:7091 | sp-newname | input | yes | yes | + altra persona |
| src/main.js:7116 | (dynamic) | text | REVIEW | REVIEW | 0 |
| src/main.js:7645 | fc-name | input | yes | yes | ${tCh('fcNamePlaceholder', __uiLang)} |
| src/main.js:7647 | fc-amt | input | yes | yes | ${new Intl.NumberFormat(__uiLang,{minimumFractionDigits:2}).format(0)} |
| src/main.js:7648 | fc-day | input | yes | yes | 15 |
| src/main.js:7651 | fc-start | date | yes | yes |  |
| src/main.js:7652 | fc-months | input | yes | yes | 12 |
| src/main.js:7917 | guide-key-input | password | yes | yes | Incolla qui la chiave copiata... |
| src/main.js:8317 | alert-direction | select | REVIEW | yes |  |
| src/main.js:8318 | alert-threshold | number | yes | yes | Soglia € |
| src/main.js:8878 | sal-day | text | yes | yes | 27 |
| src/main.js:8879 | sal-amt | text | yes | yes | 1500 |
| src/main.js:8931 | po-value | input | yes | yes | ${esc(placeholders[method])} |
| src/main.js:8932 | po-holder | input | yes | yes | Intestatario (facoltativo) |
| src/main.js:9034 | sc-code | textarea | REVIEW | yes |  |
| src/main.js:9035 | sc-p2p-in | textarea | yes | yes | ${tCh('shareP2pPlaceholder', __uiLang)} |
| src/main.js:9118 | rg-code | textarea | yes | yes | ${tCh('receivePlaceholder', __uiLang)} |
| src/main.js:9168 | join-who-name | text | yes | yes | ${tCh('joinNamePlaceholder', __uiLang)} |
| src/main.js:9695 | sg-name | input | REVIEW | yes |  |
| src/main.js:9705 | sg-newmember | input | yes | yes | + aggiungi persona |
| src/main.js:9715 | sg-amt | number | yes | yes | Quanto ${esc(form.currency \|\| baseCurrency)} |
| src/main.js:9716 | sg-desc | input | yes | yes | Per cosa |
| src/main.js:9727 | sg-currency | select | REVIEW | yes |  |
| src/main.js:9906 | ec-text | input | REVIEW | yes | es. "il conto era 120 non 100" |
| src/main.js:10020 | (dynamic) | input | yes | REVIEW | ${esc(tCh('itemSplitDescPlaceholder', __uiLang))} |
| src/main.js:10021 | (dynamic) | number | yes | REVIEW | ${esc(tCh('itemSplitAmountPlaceholder', __uiLang))} |
| src/main.js:10044 | is-desc | input | yes | yes | ${esc(tCh('itemSplitDescGeneralPlaceholder', __uiLang))} |
| src/main.js:10049 | is-tip | number | yes | yes | ${esc(tCh('itemSplitTipLabel', __uiLang))} |
| src/main.js:10050 | is-tipmode | select | REVIEW | yes |  |
| src/main.js:10157 | dt-nome | input | REVIEW | yes | Es. Carta di credito |
| src/main.js:10159 | dt-saldo | number | yes | yes | Saldo € |
| src/main.js:10160 | dt-tasso | number | yes | yes | Tasso % |
| src/main.js:10162 | dt-min | number | yes | yes | Pagamento minimo mensile € |
| src/main.js:10169 | dt-extra | number | yes | yes | Oltre i pagamenti minimi, € al mese |
| src/main.js:10356 | (dynamic) | input | REVIEW | REVIEW |  |
| src/main.js:10434 | bridge-address | email | yes | yes | ${esc(tCh('bridgeAddressPlaceholder', __uiLang))} |
| src/main.js:10485 | trip-newname | input | yes | yes | ${esc(tCh('tripNamePlaceholder', __uiLang))} |
| src/main.js:10648 | (dynamic) | input | REVIEW | REVIEW |  |
| src/main.js:10649 | (dynamic) | input | REVIEW | REVIEW |  |
| src/main.js:10712 | trip-receipt | file | yes | yes |  |
| src/main.js:10716 | trip-amt | number | yes | yes | ${esc(tCh('itemSplitAmountPlaceholder', __uiLang))} |
| src/main.js:10717 | trip-desc | input | yes | yes | ${esc(tCh('tripDescPlaceholder', __uiLang))} |
| src/main.js:11398 | trv-code | textarea | yes | yes | MTRIPV1:... |
| src/main.js:11476 | trv-reviewer | input | yes | yes | ${esc(tCh('tripReviewerNamePlaceholder', __uiLang))} |
| src/main.js:11477 | trv-note | textarea | yes | yes | ${esc(tCh('tripReviewNotePlaceholder', __uiLang))} |
| src/main.js:11561 | (dynamic) | input | yes | REVIEW | Ticker |
| src/main.js:11562 | (dynamic) | number | yes | REVIEW | Quante ne hai comprate |
| src/main.js:11779 | inv-piva | input | yes | yes | Partita IVA (11 cifre) |
| src/main.js:11780 | inv-cf | input | yes | yes | Codice Fiscale (se diverso) |
| src/main.js:11781 | inv-indirizzo | input | yes | yes | Indirizzo (via e numero) |
| src/main.js:11782 | inv-cap | input | REVIEW | yes | CAP |
| src/main.js:11783 | inv-comune | input | yes | yes | Comune |
| src/main.js:11784 | inv-prov | input | yes | yes | Prov. (es. MI) |
| src/main.js:11785 | inv-iban | input | yes | yes | IBAN (per il pagamento) |
| src/main.js:11802 | inv-emitter | input | yes | yes | Il tuo nome / ragione sociale |
| src/main.js:11805 | inv-logo | file | yes | yes |  |
| src/main.js:11807 | inv-country | select | REVIEW | yes |  |
| src/main.js:11810 | inv-accent | color | REVIEW | yes |  |
| src/main.js:11847 | inv-brand-credit | checkbox | yes | yes |  |
| src/main.js:11874 | inv-oneline | input | yes | yes | Scrivila a parole: "a Rossi Srl 500 per consulenza" |
| src/main.js:11877 | inv-client | input | yes | yes | Cliente (es. Studio Rossi) |
| src/main.js:11884 | inv-cli-piva | input | yes | yes | P.IVA cliente |
| src/main.js:11885 | inv-cli-cf | input | yes | yes | Codice Fiscale cliente |
| src/main.js:11886 | inv-cli-indirizzo | input | yes | yes | Indirizzo cliente |
| src/main.js:11887 | inv-cli-cap | input | REVIEW | yes | CAP |
| src/main.js:11888 | inv-cli-comune | input | yes | yes | Comune |
| src/main.js:11889 | inv-cli-prov | input | yes | yes | Prov. |
| src/main.js:11890 | inv-cli-sdi | input | yes | yes | Codice SdI (7) — se ce l'ha |
| src/main.js:11891 | inv-cli-pec | email | yes | yes | oppure PEC del cliente |
| src/main.js:11897 | inv-amount | number | yes | yes | Quanto (imponibile €) |
| src/main.js:11898 | inv-desc | input | yes | yes | Per cosa (es. Consulenza marzo) |
| src/main.js:11908 | inv-email | email | yes | yes | Email cliente (per inviarla) |
| src/main.js:11910 | inv-recurring | checkbox | yes | yes |  |
| src/main.js:12014 | (dynamic) | text | yes | REVIEW | Descrizione voce |
| src/main.js:12015 | (dynamic) | number | REVIEW | REVIEW | € |
| src/main.js:14256 | dsu-tax | url | yes | yes | URL regole fiscali (opzionale) |
| src/main.js:14257 | dsu-format | url | yes | yes | URL tracciato fattura (opzionale) |
| src/main.js:14624 | rr-file | file | yes | yes |  |
| src/main.js:14626 | rr-shares | textarea | yes | yes | Incolla qui il primo foglio, vai a capo, incolla il secondo. |
| src/main.js:14789 | (dynamic) | textarea | REVIEW | REVIEW |  |
| src/main.js:16992 | goal-target-only-input | number | yes | yes | ${new Intl.NumberFormat(__uiLang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0)} |
| src/main.js:17074 | (dynamic) | textarea | REVIEW | REVIEW |  |
| src/main.js:17472 | mesh-code-out | textarea | yes | yes | Il codice da copiare sull'altro dispositivo apparirà qui... |
| src/main.js:17475 | mesh-code-in | textarea | yes | yes | Codice dall'altro dispositivo... |
| src/main.js:17600 | goal-name-input | text | yes | yes | ${escapeHtml(tCh('goalNameExample', __uiLang))} |
| src/main.js:17601 | goal-target-input | number | yes | yes | ${new Intl.NumberFormat(__uiLang,{minimumFractionDigits:2}).format(0)} |
| src/main.js:17602 | goal-deadline-input | date | yes | yes |  |
| src/main.js:17642 | budget-edit-input | number | yes | yes | ${new Intl.NumberFormat(__uiLang,{minimumFractionDigits:2}).format(0)} |
| src/main.js:17958 | fb-text | textarea | yes | yes | Cosa funziona, cosa no, cosa vorresti diverso… (facoltativo) |
