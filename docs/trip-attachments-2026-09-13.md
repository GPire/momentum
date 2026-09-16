# Allegati delle trasferte: controllo e rimozione

Il controllo prima della richiesta di approvazione e l'importazione del
responsabile usano ora lo stesso validatore degli allegati. Sono accettati
data URL base64 di JPEG, PNG, WebP, GIF e PDF. Formati non supportati e base64
malformato sono segnalati senza cancellare il contenuto originale.

Questo controllo riguarda formato dichiarato e struttura base64: non decodifica
il documento e non garantisce che un'immagine o PDF sia leggibile. HEIC non
viene convertito. Non dichiarare collaudata la selezione foto su iPhone fisico.

Nella modifica della spesa, “Rimuovi dalla spesa” agisce sulla bozza. Annullare
mantiene l'allegato; salvare passa esplicitamente `receiptImage: null` al motore
delle revisioni, mantenendo UUID e originale nello storico. Non è una
cancellazione definitiva dei dati. Il flusso esistente invalida l'approvazione
quando cambia il resoconto.

Un errore di lettura o formato non sostituisce la ricevuta precedente. Durante
l'OCR salvataggio e rimozione sono disabilitati. Questo intervento non risolve
ogni possibile concorrenza fra OCR asincrono e cambio del form.

## Verifiche

- 20 test mirati passati: allegati, archivi, importazione e revisioni.
- Build portable completata; resta l'avviso sulle dimensioni dei chunk.
- Chrome locale su origine isolata 4187, solo dati sintetici: rimozione e
  annullamento conservano la ricevuta; rimozione e salvataggio lasciano una
  sola spesa da 15 EUR e zero allegati correnti.
- Messaggi nuovi disponibili in it, en, de, fr, es, nl, pt.

Restano separati casella aziendale condivisa, identità e ruoli verificati,
connettori autenticati e collaudo su dispositivi fisici. I test locali non
certificano una consegna a un gestionale esterno.
