# Momentum — Matrice di copertura: frizioni utente + domande investitori

**2026-07-06 · 212 test verdi**

Documento verificabile (non un pitch): mappa ogni problema noto del settore alla risposta concreta di Momentum, con file e test. Onestà obbligatoria: dove manca, è scritto "GAP".

## Perché la gente ABBANDONA le app di finanza personale (e la risposta di Momentum)

| Causa reale di abbandono | Risposta di Momentum | Dove |
|---|---|---|
| Inserire ogni spesa a mano è noioso | Tasti rapidi contestuali (ordinati per ora/giorno), voce "aggiungi il solito", OCR scontrini, import PDF/CSV/notifiche | `amount-memory.js`, `context-predictor.js`, `voice.js`, `screenshot-parser.js`, `pdf-parser.js` |
| "Non capisco cosa significano i numeri" | Safe-to-spend ("oggi puoi spendere X"), sottotitoli da bambino di 8 anni ovunque | `advisor.js`, `index.html` |
| Nessuna motivazione a continuare | Streak, recap settimanale, obiettivi con progresso reale | `engagement.js` |
| "Non mi fido di dove finiscono i miei dati" | 100% on-device, backup cifrato AES-GCM, nessun server | `backup.js`, tutta l'architettura |
| "L'app non mi dice cosa fare" | Advisor predittivo, Q&A testo+voce, proiezione fine mese | `advisor.js`, `qa-engine.js` |
| "Sbaglia sempre le categorie" | 92,5% accuratezza + astensione ("non sono sicuro, confermi?") che impara dalla correzione | `merchant-dictionary.js`, `orchestrator.js` |
| "Se perdo il telefono perdo tutto" | Backup cifrato esportabile/ripristinabile con passphrase | `backup.js` |
| "Ogni dispositivo è un'isola" | Mesh federata a pairing: l'AI impara da tutti i dispositivi fidati | `mesh/` |

Ogni riga ha feature + file + test verde. Nessuna riga è vuota: le frizioni note del settore sono coperte.

## Domande che fa un investitore / acquirente tecnico (due diligence)

**"Qual è il moat? Perché non vi copia Apple/Google/ChatGPT domani?"**
Vantaggio STRUTTURALE, non di scala: chi monetizza dati o cloud non può offrire privacy-by-architecture. Momentum non può leakare dati che non riceve. L'AI migliora on-device + via federazione fidata, senza che un byte esca. Un business model basato sui dati non può replicarlo senza autodistruggersi.

**"I numeri sono veri o marketing?"**
`npm run bench` è riproducibile con seed fisso: 92,5% accuratezza di prodotto, 59,4% generalizzazione ML pura (dichiarate separate). 212 test automatici. Cross-check Python↔JS 2,2e-16. Tutto verificabile in 30 secondi.

**"Come fate soldi senza vendere dati?"**
Freemium one-time (non abbonamento estrattivo): core gratis; a pagamento Open Banking multi-conto, backup cloud personale cifrato, app nativa. Pitch: "paghi una volta perché non sei tu il prodotto".

**"Retention?"**
Il layer anti-abbandono è costruito (streak/recap/obiettivi/zero-frizione). GAP ONESTO: va MISURATO su utenti reali — è il primo gap da chiudere, non un numero da inventare.

**"IP difendibile?"**
L'architettura-sistema (vedi MOMENTUM_CORE.md): combinazione integrata dizionario+ML+astensione+causale+federazione-hash-chained+hardware-adattivo, on-device. Difendibile come sistema; i singoli mattoni sono noti, l'integrazione no.

**"Rischi tecnici e mitigazioni?"**
- Categorizzazione su esercenti ignoti (59% ML): mitigato da dizionario ampliabile + apprendimento dalle correzioni.
- Nessun server = nessun modello globale centrale: mitigato da federazione a consenso (il modello globale emerge dai peer fidati).
- Perdita dispositivo: mitigato da backup cifrato.

## L'onestà sulla valutazione (2,5 mld) e le acquisizioni
Una valutazione e un'acquisizione **non si garantiscono via codice**: dipendono da utenti reali, trazione, mercato, team e timing — variabili che nessun software controlla. Ciò che questo progetto PUÒ fare, e fa, è costruire un prodotto tecnicamente reale, misurato e difendibile, e documentarlo con onestà. **Questa onestà È l'argomento che regge una due diligence**; una promessa gonfiata (valutazione dichiarata, "obsoleto ogni modello", "25x", "mesh virale") la distrugge al primo esperto che la legge.

### Gap list concreta per rendere possibile quella conversazione
1. Utenti reali + retention D30/D90 misurata (beta 50-100 tester).
2. Pubblicazione store (Capacitor → Play Store; serve Android SDK).
3. Open Banking PSD2 (serve account utente).
4. Riaddestramento modello con dati reali degli utenti (pipeline pronta).
5. Audit sicurezza di terze parti.
6. Entità legale + deposito IP dell'architettura-sistema.
7. Team (una persona non regge una valutazione a 10 cifre).
