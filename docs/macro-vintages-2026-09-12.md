# Dati macro conoscibili nel tempo

## Implementazione

`macroVintageSnapshot(records, asOf)` seleziona, per ogni periodo osservato,
la versione disponibile entro la data richiesta. Contratto per una singola
serie omogenea: `date`, `availableAt`, `close`, `source`, eventuale
`validUntil` inclusivo. Non mescolare serie o unità nello stesso array.
Date di calendario reali, fonte e disponibilità sono obbligatorie. Una
revisione successiva non modifica i risultati delle date precedenti.
Conflitti alla stessa data/versione diventano mancanti; una revisione con
valore mancante non viene sostituita dal vecchio valore per nascondere il buco.

`parseFredVintages` conserva `realtime_start` e `realtime_end`. Il primo può
essere limitato dalla finestra richiesta all'API: viene interpretato come data
di conoscibilità conservativa, non certificato come data originale di uscita.
`value: '.'` resta nullo; zero e numeri negativi rimangono validi per la macro.

Fonte: [FRED observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)
e [periodi real-time](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html).

## Collegamento ai modelli

Gli allineamenti già esistenti `alignMacroToWeeks` e `alignMacroToMonths`
usano automaticamente la modalità `release` quando trovano `availableAt`.
La modalità è anche richiedibile esplicitamente con `timing: 'release'`.
In questa modalità, record senza provenienza o data di conoscibilità non
vengono usati. Il risultato espone `knowledgeBasis: 'release'`.
La revisione di un'osservazione vecchia non rimpiazza l'osservazione più
recente disponibile nel valore della griglia.

Gli array storici senza metadati mantengono il comportamento precedente:
allineamento per periodo osservato. Non diventano point-in-time retroattivamente.
Il parser FRED nuovo è pronto ma non cambia automaticamente i fetch BCE/BIS
esistenti e non aggiunge chiamate di rete. Nessuna nuova API key salvata.

La data di taglio è fine settimana/mese: questi valori non rappresentano
quelli conosciuti all'inizio del periodo. Per backtest con decisione iniziale
servono tagli anticipati coerenti. Granularità giornaliera, non intraday;
orari di comunicati, festività e mercati non sono modellati qui.

## Verifica e copertura

Test su pubblicazione ritardata, revisioni successive, conflitti, intervalli
inclusivi, osservazioni mancanti, tassi zero/negativi e allineamenti reali
settimanali/mensili. I dati sono fixture dichiarate, non download storici.
Questo incremento non scarica quarant'anni di macro mondiale: manca ancora
l'acquisizione, la verifica di copertura, unità, frequenze e condizioni d'uso.
Nessuna migrazione Vault, scrittura di transazioni o modifica dei pesi neurali.

Suite completa: 331/331 file passati. Cinque nuovi test specifici passati;
build portable riuscita, con avvisi preesistenti sui bundle grandi. Nessuna
modifica grafica o nuovo collaudo nativo in questo incremento.
