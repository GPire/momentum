# Controlli Momentum e riferimenti F24

## Implementato

- Date nelle modali comuni: riuso del calendario orbitale esistente, selezione con tastiera, vincoli min/max, valori e listener originali conservati; protezione dalle doppie inizializzazioni.
- Select singoli nelle modali: riuso di tl1Select mantenendo il select originale nascosto per le logiche esistenti. Opzioni disabilitate, navigazione tastiera, Escape, stato espanso e pannello chiuso escluso dalla navigazione/accessibilità. Select multipli non trasformati automaticamente.
- Colori nelle modali: palette e codice esadecimale, controllo formato e aggiornamento degli eventi originali. Nessun popup colore del browser. Questa versione non riusa ancora il piano cromatico continuo del Command Center.
- Versamenti: dati opzionali di una riga F24 Erario (codice, anno, credito e riferimento documentale), con importi in centesimi e stato esplicitamente dichiarato dall'utente. Accetta una compensazione totale con cassa zero; il credito non è automaticamente sottratto dagli accantonamenti. Una correzione dell'anno segna i dettagli preesistenti da rivedere. Report IT HTML/CSV/JSON includono i riferimenti.

## Verifiche

51 test mirati passati, build di produzione portabile riuscita. Browser locale 4181: calendario aperto e data modificata dal 19 al 18 settembre; salvata riga di prova 1792/2025 con credito 25,50 e cassa zero. Profilo fattura: selettore cambiato a Internazionale e riportato a Italia; palette impostata a #8b5cf6, valore e selezione visibili nella schermata.

## Perimetro non completato

L'inventario in `../audit-tools/native-control-audit.txt` include controlli esterni alle modali: data Command Center, promemoria Vault, lingua Q&A. Vanno ancora convertiti/verificati con i rispettivi listener. La revisione di tutte le checkbox, slider e viste dinamiche non è completata. I selettori file del sistema operativo non sono popup colore/data e restano necessari per scegliere un file locale.

Il riferimento F24 è testo, non un allegato acquisito o una ricevuta autenticata. Il controllo del codice è formale (quattro cifre), non certifica che il codice esista o sia corretto per quel contribuente. Solo Erario, non INPS/enti locali. Mancano più righe nello stesso documento, validazione nazionale, controllo disponibilità/riutilizzo del credito e riscontro ufficiale dell'esito. Nessuna equivalenza con un F24 trasmesso. Nessun push/deploy.

## Fonti ufficiali consultate

- [Codice 1792](https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/SezioneErario.php?CT=1792&Ord=0844&Q1=Tutte&Q2=&Q3=&Q4=Tutte)
- [Compensazioni](https://infoprecompilata.agenziaentrate.gov.it/portale/semplificata-mod-imposte-da-compensare-con-f24)
- [Versamenti F24 e programmi di controllo](https://telematici.agenziaentrate.gov.it/Main/Versamenti.jsp)
- [Cassetto fiscale](https://telematici.agenziaentrate.gov.it/Main/Cassetto.jsp)
