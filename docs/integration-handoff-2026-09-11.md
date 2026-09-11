> Aggiornamento successivo: main d92a5dc è stato integrato e i casi limite corretti. Esito corrente, preservazione dei dati e 4.839 test / 316 file sono in [merge-validation-2026-09-11.md](merge-validation-2026-09-11.md). I riferimenti e i blocchi di autenticazione descritti sotto documentano la fase precedente.

# Integrazione UI con il main aggiornato

Branch UI: `codex/public-release-foundation`. Codice revisionato: `eb86338`, incluso `52b8edd`. Main remoto aggiornato verificato: `d92a5dc` (successivo a `3c9b3c3`). Base comune: `a62ceeaf67fdbaed2785af80b88ca0134b1b810b` (verificare con `git merge-base` prima dell’integrazione; non usare questo testo come ref operativo).

Il branch contiene il lavoro cumulativo richiesto, non soltanto l’ultimo restyling dello split. Il push del branch non costituisce merge su main né deploy. Leggere anche [revisione del rilascio](release-review-2026-09-11.md).

Punto di ingresso del revisore: [descrizione pronta per la PR](merge-request-2026-09-11.md), [manifesto file per file](push-file-manifest-2026-09-11.md), [risultati dei test](release-validation-2026-09-11.json).

## Simulazione del merge con main d92a5dc

**Aggiornamento motori:** leggere la [matrice completa di integrazione](engine-integration-audit-2026-09-11.md). Comprende gli avanzamenti fiscali e di mercato, i controlli locali da preservare e i difetti riprodotti nel main isolato. I 246 test mirati superati non coprivano quei casi limite. Non usare “main conserva autorità” come istruzione per sovrascrivere tutte le logiche locali.

`git merge-tree --write-tree --name-only eb86338 d92a5dc` ha rilevato **13 file in conflitto**, senza modificare il checkout né avviare un merge su main. Questo risultato è riferito a quei due SHA, non a futuri aggiornamenti.

| File | Cosa preservare e verificare |
|---|---|
| `AGENTS.md` | Unire il contesto operativo e le nuove correzioni documentate da main; conservare l'indice dei documenti di questa consegna. |
| `index.html` | Nuovo layout e CSS statico della UI; preservare `safe center` e leggibilità dei titoli sopra le stelle di f126526. Verificare l'ordine degli stili e il risultato su viewport corto. |
| `src/core/date-utils.test.js` | Conservare controlli di main sulle date e trasporto stdout/URL Windows del branch, senza saltare sottoprocessi. |
| `src/core/onboarding-state.js` | I corpi attuali differiscono per commenti: flag esplicito `isFirstLaunch` prioritario, profilo storico come fallback solo in assenza del flag. |
| `src/core/recovery-notice.js` | Le implementazioni corrispondono, differiscono commenti/direttiva. Tenere una sola definizione e la memoria del rifiuto. |
| `src/core/recovery-notice.test.js` | Test equivalenti con nomi/variabili diversi: evitare duplicazioni, mantenere i quattro scenari. |
| `src/core/telemetry.js` | Preservare whitelist, controllo HTTP, verifica opt-out dopo gli await e diagnostica separata. Descrivere l'ID casuale come pseudonimo, senza confonderlo con anonimato garantito. Non ampliare la raccolta durante il merge. |
| `src/core/telemetry.test.js` | Unire i controlli: il branch include test espliciti per opt-out senza creazione ID e disattivazione durante l'invio. |
| `src/i18n/ui-strings.test.js` | Conservare nuovi test ES/CH di main e copertura multilingue del branch; il Paese fiscale non determina la lingua della UI. |
| `src/import/multi-import.js` | La differenza osservata è documentale: mantenere `isEvalSupported: false` nel caricamento PDF. |
| `src/main.js` | Integrare per editor/render: main conserva autorità fiscale/modelli; UI conserva accessi diretti, controlli, split, focus e contratti dei nodi. Verificare anche funzioni che non producono conflitti testuali. |
| `src/pwa/install-guide.js` | Mantenere il riconoscimento iPad con UA Macintosh e `maxTouchPoints > 1`; la differenza osservata è nei commenti. |
| `src/pwa/install-guide.test.js` | Conservare copertura iPad con sito desktop, dispositivo già installato e istruzioni corrette per browser; evitare test duplicati per sola traduzione del nome. |

### Nuove correzioni di main da non perdere

- `f126526`: allineamento `safe center` dell'onboarding corto e sfondo sfocato dietro al testo, per evitare che stelle e scie riducano la leggibilità. Contiene anche aggiornamenti alla strategia dei piani in `ANALISI_COMPETITOR.md`.
- `d92a5dc`: `openTaxDiscover` instrada verso IT/ES/CH usando il Paese dichiarato; le azioni fiscali aggiornano Dashboard e la card sparisce dopo la risposta. Il segnale svizzero reale è `chAttivitaTipo`, non presumere che `chActive` lo sostituisca.
- La proposta fiscale UI usa una pertinenza più restrittiva (risposta esplicita). Riconciliare questa regola con l'instradamento di main; non rimettere una chiamata diretta sempre al simulatore italiano.

## Priorità nella risoluzione dei conflitti

- Conservare le nuove logiche di main: calibrazione Cassa Unica, storico/prezzi degli asset, CH AVS, Trust Center, export strutturato per il commercialista, scadenze ES e previdenza professionale. Non sostituire il suo `main.js` con quello del branch UI.
- Conservare la correzione di main sulle date retrodatate e i suoi test strutturali. Le modifiche qui a `date-utils.test.js` riguardano URL Windows e trasporto stdout dei processi di fuso: integrare entrambe le serie di test.
- Unire le chiavi i18n per nome, senza eliminare le nuove chiavi di main. La copertura delle sette lingue deve restare verificata; le frasi italiane preesistenti fuori dai dizionari richiedono ancora revisione.
- Mantenere hash delle transazioni, opt-out salvato della telemetria, consenso alle condivisioni, budget facoltativo e separazione fra preferenze di vista e diritti Free/Pro.

## Punti d’innesto

| Area | Contratto |
|---|---|
| Azioni Dashboard | `dashboardActions(state)` sceglie le azioni. `renderHomeQuickActions` le collega agli editor. `openWorkspacePanel` sposta e restituisce il nodo vivo: non clonare ID o listener. |
| Obiettivi/scadenze/asset | Usare gli editor e i nodi già esistenti. Quando un editor annidato sostituisce il pannello, il nodo torna nella pagina originaria prima di svuotare la modale. |
| Split rapido | `buildSplitDraft` accetta membri con ID, anticipi, quote e modalità. Restituisce il gruppo del motore esistente. Non tornare a usare i nomi come chiavi. |
| Arrotondamenti | La somma delle quote di ogni anticipo e la somma complessiva delle quote personalizzate coincidono in centesimi. Il seed del gruppo resta stabile fra anteprima e salvataggio. |
| Importi | `splitAmount` e `splitInputEdit` gestiscono virgola/punto, rifiuto di parole/negativi e massimo due decimali. `bindSplitMoneyInput` conserva il nodo e richiede la tastiera decimale. |
| Rimborso | `openRequestPayment` accetta anche `currency`, `direction` e `onBack`. Quest’ultimo restituisce la bozza al form rapido senza perdere quote/persone. Il messaggio è modificabile; copia e condivisione non attestano un pagamento. SEPA QR disponibile solo per EUR. |
| Link | `buildRepaymentCode` conserva la whitelist del motore e comprime le spese del gruppo. L’invito leggero resta distinto dallo snapshot che spiega un rimborso. |
| Identità | `displayNames`, `myMemberId`, `claimMember` restano autorità del modello. Nel nuovo form “Io” è un ID riservato locale; nei dettagli del destinatario il suo segnaposto appare come organizzatore. |
| Avvio | Le utility CSS sono compilate, non generate da CDN. Il ritorno nell’app mostra Momentum finché Dashboard e privacy sono inizializzate; `app-ready` viene impostato dopo il render iniziale. |

## Tooling riproducibile

Usare Node 24. Il Node 16 del PATH locale non è adatto a questo Vite.

```sh
npm ci
npm run build:portable:setup
npm run styles:build
npm test
npm run build
```

Negli ambienti Windows dove la creazione delle pipe dei processi genera `spawn EPERM`:

```sh
npm run test:serial
npm run build:portable
```

Il runner seriale esegue ogni file in un processo separato con handle ereditati: non mescola i mock e non salta test. I quattro test di fuso usano ancora veri processi con `TZ` diversi. La build portabile usa esbuild WebAssembly 0.21.5, la stessa versione del compilatore di Vite, con target e minificazione invariati. Rifiuta alberi con symlink e usa `preserveSymlinks` per evitare il subprocess Windows di risoluzione percorsi. Non modifica le impostazioni di sicurezza del computer.

`public/ui-utilities.css` è un artefatto versionato. Dopo modifiche alle classi in HTML/main/UI rigenerarlo con `styles:build` e includerlo nel commit. I tool separati sono fissati da `scripts/portable-tools/package-lock.json`; non aggiungere `node_modules` al repository. Evitare nuove classi Tailwind costruite per concatenazione; se indispensabili, aggiungerle alla safelist.

## Verifiche prima del merge finale

1. Leggere il diff cumulativo; integrare per funzione, senza `ours/theirs` sull’intero `main.js`.
2. Eseguire la suite completa, build standard in CI e build Capacitor sul commit risultante.
3. Provare: primo accesso, ritorno, invito ricevuto, split con dieci persone/omonimi, quote non coincidenti, richieste in valuta estera, copia negata, modali annidate, form con tastiera, tablet ruotato e scroll.
4. Provare su dispositivi reali con VoiceOver/TalkBack, caratteri ingranditi, movimento ridotto e condivisione di sistema. Le simulazioni Chrome non certificano iOS/Android o gli store.
5. Verificare dominio pubblico dei link e funzionamento su un altro dispositivo. La build è ancora dipendente da alcuni CDN e conserva bundle grandi: misurare l’avvio con rete lenta prima del rilascio pubblico.

Nessuna nuova integrazione bancaria o HealthKit è dichiarata operativa. Le note dedicate sono documenti di preparazione.
