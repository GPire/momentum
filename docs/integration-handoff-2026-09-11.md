# Integrazione UI con il main aggiornato

Branch UI: `codex/public-release-foundation`. Base locale prima di questa revisione: `52b8edd`. Main remoto verificato: `3c9b3c3`. Base comune: `a62ceeaf67fdbaed2785af80b88ca0134b1b810b` (verificare con `git merge-base` prima dell’integrazione; non usare questo testo come ref operativo).

Il branch contiene il lavoro cumulativo richiesto, non soltanto l’ultimo restyling dello split. Il push del branch non costituisce merge su main né deploy. Leggere anche [revisione del rilascio](release-review-2026-09-11.md).

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
