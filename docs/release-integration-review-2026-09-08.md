# Momentum — revisione GitHub e integrazioni per il rilascio

Data verifica: 2026-09-08. Nessun commit o push eseguito.

## Base verificata

- `origin/main`: `a62ceeaf67fdbaed2785af80b88ca0134b1b810b`.
- Il checkout locale parte da `7fd505113429025f872a45bda52e05b96257ed1a`
  e contiene modifiche non committate. La differenza upstream è stata letta e
  integrata selettivamente, senza sovrascrivere il lavoro locale.
- L'ultimo commit GitHub aggiunge la distinzione fra territorio comune,
  País Vasco e Navarra nel modulo fiscale spagnolo. L'IRPF foral non viene
  inventato: è `null`, mentre la RETA continua a essere calcolata.

## Correzioni integrate in questa revisione

### Recupero movimenti

Il controllo del registro protetto apre automaticamente la finestra una sola
volta quando esistono movimenti recuperabili e l'onboarding è già concluso.
La visualizzazione viene registrata prima dell'apertura: X, backdrop, Escape,
chiusura dell'app o rifiuto non provocano una nuova richiesta. Dopo un rifiuto
la richiesta automatica rimane disattivata anche se compaiono nuovi candidati.
Se l'utente conferma il recupero, il blocco permanente viene rimosso.

La finestra usa una gerarchia compatta e allineata a sinistra, anteprima delle
righe, periodo, entrate e uscite separate, messaggio di trattamento locale e
azioni da 48 px. Non viene più inserita una card persistente nella Dashboard.
Il ripristino resta esplicito e ricontrolla duplicati e cancellazioni al momento
della conferma.

La prova visiva ha inoltre trovato una regressione condivisa: una regola CSS
annullava l'ancoraggio inferiore dei modali su mobile. Il contenuto è ora
`absolute` e ancorato in basso sui telefoni, `relative` nel contenitore flex da
desktop. Le azioni brevi del recupero vivono nel suo corpo, senza un footer
separato che generava spazio vuoto.

### Primo avvio

Corretto un caso non coperto dal test precedente: lo stato iniziale del Vault
contiene già `onboardingProfile`, quindi la sua semplice presenza faceva
sembrare completato l'onboarding anche con `isFirstLaunch: true`. Ora il flag
esplicito ha priorità; profilo e transazioni sono fallback soltanto per stati
storici privi del flag. La copia inline pre-paint in `index.html` segue la
stessa regola.

### Fiscalità spagnola dall'ultimo GitHub

Integrati il selettore del territorio, il passaggio del territorio a card,
radar ed export commercialista, l'omissione esplicita dell'IRPF nei territori
forali e le nuove stringhe in 7 lingue. Il selettore valida i valori ammessi,
usa pulsanti semantici da 48 px e comunica la selezione con `aria-pressed`.

## Stato funzionale verificato

| Area | Stato | Decisione di rilascio |
|---|---|---|
| Dashboard, transazioni, Command Center | Flussi reali e aggiornati su GitHub; varianti locali mirate | Conservare la struttura GitHub, integrare solo fix misurabili |
| Importazione e Vault | CSV/PDF/OCR, copie ridondanti, tx log e deduplicazione | Integrare i fix di integrità; testare file reali prima del pubblico |
| Onboarding | Profilazione, fasce d'età e budget esplicito locali | Conservare budget non inventato e correzione primo avvio |
| Telemetria | Attiva di default, opt-out persistente, catalogo chiuso di eventi | Integrabile; completare informativa e verifica endpoint |
| Modelli on-device | Ensemble, personalizzazione e gate metriche | Integrare i fix isolati; non dichiarare accuratezza universale |
| Mercati e Analisi Tensor | Portafoglio, rischio, macro, SEC, scenari | Conservare UI corrente; ridurre peso e chiarire freschezza/copertura |
| Fisco | Italia, Svizzera e Spagna con limiti dichiarati | Integrare territorio foral; completare traduzioni del modulo Spagna |
| Split e mesh | Gruppi spesa, WebRTC e moduli federati | Non rilasciare sync privato senza identità e pairing verificati |
| Free/Pro | Catalogo e raccomandazione locale, gating incompleto | Tenere separato finché entitlement, acquisto e ripristino non sono completi |
| PWA e native | PWA installabile; scaffold Android/iOS locale | Richiede build CI, dispositivi reali e procedure store |

## Priorità successive per impatto

1. **Runtime e caricamento.** `index.html` dipende ancora da Tailwind, Three,
   Chart.js, Lightweight Charts, PDF.js e Tesseract via CDN. Il service worker
   li mette in cache, ma la prima apertura richiede terze parti e può fallire
   offline. Il bundle principale prodotto è circa 4,64 MB non compresso
   (1,56 MB gzip); il runtime ONNX WASM supera 23 MB. Prima del pubblico vanno
   auto-ospitate le dipendenze e separati i percorsi importazione, mercati e AI.
2. **Flussi critici su dispositivi.** Matrice minima: Safari iPhone/iPad,
   Chrome Android, modalità installata, tastiera, safe area, importazione,
   backup/ripristino, aggiornamento e storage quasi pieno.
3. **Accessibilità.** Il recupero nuovo rispetta focus, semantica, target touch,
   escape, riduzione movimento e contenuto lungo. La conformità WCAG dell'intera
   applicazione richiede ancora audit automatizzato più tastiera e screen reader.
4. **Complessità del frontend.** `src/main.js` supera 20.000 righe. Estrarre
   controller per onboarding, recupero, fisco e modali riduce il rischio di
   sovrapposizioni senza cambiare il design scelto.
5. **Lingue.** Le nuove stringhe sono in 7 lingue, ma il modulo Spagna contiene
   ancora chiavi preesistenti complete solo in IT/EN/ES.
6. **Mesh privata e SDK.** Completare identità del dispositivo, pairing con
   consenso, revoca, limiti delle risorse, relay e test anti-replay prima di
   collegare gradienti o dati privati al prodotto pubblico.
7. **Free/Pro.** Definire entitlement e valore: sicurezza, export essenziale,
   budget, calendario e funzioni di base restano Free; automazioni professionali,
   analisi avanzate e capacità multi-portafoglio possono essere Pro. Nessuna
   funzione deve attivarsi soltanto perché un profilo “sembra pagante”.

## Criterio di integrazione

Integrare subito correzioni piccole, reversibili e coperte da test: recupero,
primo avvio, territorio foral, telemetria e integrità. Tenere in cambi separati
la pipeline CSS/CDN, la divisione del bundle, il native, Free/Pro e la mesh:
sono lavori ad alto impatto che richiedono una validazione e un rollback propri.

## Verifiche eseguite

- Suite completa Node: 4.689 test superati, zero fallimenti.
- Browser Chromium isolato a 390×844: apertura automatica, rifiuto persistente,
  nessun nuovo prompt dopo reload o nuovi candidati, recupero soltanto con
  conferma, nessun duplicato dopo reload.
- Browser Chromium isolato a 320×568: nessun overflow orizzontale; modale e
  azioni contenuti nel bottom sheet.
- Primo avvio con onboarding incompleto: nessuna finestra di recupero sopra le
  domande iniziali.
- Build di produzione completata; resta l'avviso sui chunk oltre 500 kB.
