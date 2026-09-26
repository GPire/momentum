# Innovare dentro il GDPR, non contro — 26 settembre 2026

Richiesta dell'utente: il GDPR non deve frenare crescita, apprendimento e
innovazione di Momentum (reti neurali, mesh, telemetria, voce, investimenti)
rispetto a concorrenti americani e cinesi.

Principio: non si aggira la legge, si costruisce in modo che la legge non
abbia nulla da vietare. Per Momentum è possibile perché i dati personali non
arrivano mai da noi. È anche un vantaggio commerciale: un'app finanziaria
americana o cinese che vuole vendere in Europa deve rifare l'architettura;
Momentum nasce già conforme.

## Le leve legittime, area per area

### 1. Intelligenza sul dispositivo (già il cuore di Momentum)
Categorie, previsioni, voce appresa e modelli si addestrano sul telefono.
Momentum non riceve quei dati, quindi non li "tratta": nessun consenso da
chiedere, nessun limite di conservazione da rispettare lato server, nessun
trasferimento extra-UE. Più il modello migliora in locale, più cresce senza
toccare il GDPR. **Direzione**: spingere sempre più calcolo sul dispositivo
(WebGPU, modelli piccoli quantizzati, NPU nelle app native).

### 2. Apprendimento collettivo con dati anonimi (federato)
Il Considerando 26 del GDPR esclude i dati davvero anonimi. Aggiornamenti di
modello con **privacy differenziale** (rumore calibrato, ε dichiarato) e
**aggregazione sicura** (il server vede solo la somma di molti dispositivi)
sono il modo standard per imparare da milioni di utenti senza dati personali.
- Oggi: il peer mesh aggiunge già rumore di Laplace (ε = 2) agli aggiornamenti.
- Fatto (26/09): l'SDK di federazione applica privacy differenziale gaussiana
  sul dispositivo quando il round la dichiara (ε calcolato e dichiarato, prova
  formale solo per ε ≤ 1) e `src/sdk/private-aggregation.js` offre
  l'aggregazione sicura a maschere accoppiate (somma esatta mod 2^32,
  l'aggregatore vede solo il totale). Limite: nessun recupero dei partecipanti
  caduti; il round si scarta.

### 3. Telemetria per capire e migliorare l'app
Le Linee guida cookie del Garante (10 giugno 2021) equiparano agli strumenti
tecnici, quindi **senza consenso**, gli analytics usati solo per statistiche
aggregate, dal titolare stesso e senza incroci con altri dati. Momentum ora
soddisfa i punti chiave: servizio di prima parte, eventi da elenco chiuso,
nessun contenuto, identificativo casuale con scadenza a 13 mesi, opposizione
con un tocco. Da mantenere: mai incrociare la telemetria con licenze o
pagamenti, mai aggiungere eventi a testo libero.
Per segnali più ricchi (percorsi, tempi, abbandoni) la via corretta è un
**invito esplicito "Aiuta Momentum a imparare"** con un beneficio visibile:
con neurodesign onesto (valore chiaro, un tocco, reversibile) i tassi di
adesione sono alti, e il dato è pienamente utilizzabile.

### 4. Voce
Fatto oggi: trascrizione **sul dispositivo** quando il browser la offre
(Chrome 139+, pacchetto lingua scaricato al primo uso). Solo se non esiste,
un avviso chiaro una volta sola e la scelta di continuare o scrivere. La
funzione non si blocca mai.

### 5. AI Act (in vigore per gradi fino al 2027)
- Assistenti conversazionali: dal 2 agosto 2026 va detto all'utente che sta
  parlando con un'IA (art. 50). Verificare che "Chiedi a Momentum" lo dica.
- Alto rischio (Allegato III): **valutare l'affidabilità creditizia di una
  persona** per conto di chi presta denaro. Momentum analizza le finanze
  dell'utente per l'utente stesso: resta fuori. Non costruire funzioni di
  scoring da vendere a banche o finanziarie senza passare dagli obblighi.
- Sandbox regolamentari (art. 57): ogni Stato membro deve averne una; utile
  per sperimentare funzioni nuove con l'autorità invece di aspettare.

### 6. Lancio globale
- USA (CCPA/CPRA e leggi statali): nessuna vendita o condivisione di dati per
  pubblicità → obblighi minimi; la stessa informativa regge.
- Paesi con localizzazione dei dati (es. Cina, PIPL): non si pongono, perché
  i dati restano sul dispositivo dell'utente.
- Store: le risposte privacy di Apple e Google restano corte e pulite, un
  vantaggio di conversione nella pagina dell'app.

## Cosa non fare (costerebbe più di quanto rende)
Telemetria con testo libero o dati finanziari, incroci fra identificativi,
"dark pattern" nel consenso, scoring creditizio per terzi, dati reali di
utenti per addestrare modelli centrali senza anonimizzazione dimostrabile.

## Prossimi lavori proposti, in ordine di impatto
1. ~~Privacy differenziale + aggregazione sicura nell'SDK di federazione~~ fatto.
2. Invito "Aiuta Momentum a imparare" con segnali d'uso più ricchi e aggregati.
3. ~~Verifica art. 50 AI Act nell'assistente~~ fatto: etichetta "risposta di un'IA esterna" in 7 lingue.
4. ~~Controllo in Vault per revocare la scelta sulla voce online~~ fatto.
