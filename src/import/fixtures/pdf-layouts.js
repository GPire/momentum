// Layout sintetici di estratti conto reali, come item {text, x, y} nello
// spazio coordinate PDF (y cresce verso l'ALTO: header in alto = y più
// grande). Servono a testare extractTransactionsFromItems senza PDF binari:
// pdf.js produce esattamente questa forma dopo il mapping in pdf-parser.js.
// Ogni layout replica le intestazioni VERE della banca corrispondente.

// Stile Intesa Sanpaolo: doppia colonna Addebiti/Accrediti (plurale!),
// con una descrizione su due righe (riga di continuazione senza data).
export function intesaLayout() {
  return [
    { text: 'Data', x: 40, y: 750 }, { text: 'Operazione', x: 120, y: 750 },
    { text: 'Addebiti', x: 420, y: 750 }, { text: 'Accrediti', x: 500, y: 750 },

    { text: '02/06/2026', x: 40, y: 720 }, { text: 'PAGAMENTO POS', x: 120, y: 720 }, { text: '45,80', x: 420, y: 720 },
    // continuazione: solo descrizione, nessuna data/importo — appartiene alla riga sopra
    { text: 'ESSELUNGA MILANO', x: 120, y: 700 },
    { text: '05/06/2026', x: 40, y: 680 }, { text: 'Accredito Stipendio', x: 120, y: 680 }, { text: '1.850,00', x: 500, y: 680 },
    { text: '10/06/2026', x: 40, y: 660 }, { text: 'ADDEBITO SDD Enel Energia', x: 120, y: 660 }, { text: '78,50', x: 420, y: 660 },
  ];
}

// Stile UniCredit: colonna unica "Importo" con importi firmati.
export function unicreditLayout() {
  return [
    { text: 'Data Reg.', x: 40, y: 750 }, { text: 'Descrizione', x: 180, y: 750 }, { text: 'Importo', x: 450, y: 750 },

    { text: '03/06/2026', x: 40, y: 720 }, { text: 'PAGAMENTO CARTA AMAZON', x: 180, y: 720 }, { text: '-32,90', x: 450, y: 720 },
    { text: '27/06/2026', x: 40, y: 700 }, { text: 'BONIFICO A VOSTRO FAVORE', x: 180, y: 700 }, { text: '1.500,00', x: 450, y: 700 },
  ];
}

// Stile N26: header in inglese, date ISO, colonna unica "Amount" firmata.
export function n26Layout() {
  return [
    { text: 'Booking Date', x: 40, y: 750 }, { text: 'Description', x: 200, y: 750 }, { text: 'Amount', x: 480, y: 750 },

    { text: '2026-06-03', x: 40, y: 720 }, { text: 'Spotify AB', x: 200, y: 720 }, { text: '-10.99', x: 480, y: 720 },
    { text: '2026-06-15', x: 40, y: 700 }, { text: 'SALARY ACME GMBH', x: 200, y: 700 }, { text: '2100.00', x: 480, y: 700 },
  ];
}

// Stile Revolut: Money out / Money in + colonna Balance (saldo progressivo,
// da IGNORARE: non è mai una transazione).
export function revolutLayout() {
  return [
    { text: 'Date', x: 40, y: 750 }, { text: 'Description', x: 160, y: 750 },
    { text: 'Money out', x: 380, y: 750 }, { text: 'Money in', x: 460, y: 750 }, { text: 'Balance', x: 540, y: 750 },

    { text: '3 Jun 2026', x: 40, y: 720 }, { text: 'Tesco London', x: 160, y: 720 }, { text: '12.40', x: 380, y: 720 }, { text: '987.60', x: 540, y: 720 },
    { text: '5 Jun 2026', x: 40, y: 700 }, { text: 'Top-Up', x: 160, y: 700 }, { text: '200.00', x: 460, y: 700 }, { text: '1187.60', x: 540, y: 700 },
  ];
}

// Estratto italiano con colonna Saldo: il caso in cui il vecchio parser
// importava il saldo progressivo come spesa aggiuntiva a ogni riga.
export function saldoColumnLayout() {
  return [
    { text: 'Data', x: 40, y: 750 }, { text: 'Causale', x: 140, y: 750 },
    { text: 'Uscite', x: 380, y: 750 }, { text: 'Entrate', x: 460, y: 750 }, { text: 'Saldo', x: 540, y: 750 },

    { text: '02/06/2026', x: 40, y: 720 }, { text: 'POS Carrefour', x: 140, y: 720 }, { text: '25,00', x: 380, y: 720 }, { text: '975,00', x: 540, y: 720 },
    { text: '08/06/2026', x: 40, y: 700 }, { text: 'Bonifico ricevuto', x: 140, y: 700 }, { text: '300,00', x: 460, y: 700 }, { text: '1.275,00', x: 540, y: 700 },
  ];
}

// Estratto conto SPAGNOLO (BBVA/Santander-style): Fecha | Concepto | Cargo | Abono
export function spanishLayout() {
  return [
    { text: 'Fecha', x: 40, y: 750 }, { text: 'Concepto', x: 140, y: 750 },
    { text: 'Cargo', x: 400, y: 750 }, { text: 'Abono', x: 480, y: 750 },

    { text: '02/06/2026', x: 40, y: 720 }, { text: 'COMPRA MERCADONA', x: 140, y: 720 }, { text: '45,80', x: 400, y: 720 },
    { text: '05/06/2026', x: 40, y: 700 }, { text: 'NOMINA EMPRESA SL', x: 140, y: 700 }, { text: '1.850,00', x: 480, y: 700 },
  ];
}

// Estratto conto TEDESCO (Sparkasse-style): Datum | Verwendungszweck | Soll | Haben
export function germanLayout() {
  return [
    { text: 'Datum', x: 40, y: 750 }, { text: 'Verwendungszweck', x: 140, y: 750 },
    { text: 'Soll', x: 400, y: 750 }, { text: 'Haben', x: 480, y: 750 },

    { text: '02.06.2026', x: 40, y: 720 }, { text: 'EDEKA MARKT', x: 140, y: 720 }, { text: '32,50', x: 400, y: 720 },
    { text: '05.06.2026', x: 40, y: 700 }, { text: 'GEHALT FIRMA GMBH', x: 140, y: 700 }, { text: '2.100,00', x: 480, y: 700 },
  ];
}

// Estratto conto BRASILIANO/PORTOGHESE: Data | Descrição | Débito | Crédito
export function brazilLayout() {
  return [
    { text: 'Data', x: 40, y: 750 }, { text: 'Descrição', x: 140, y: 750 },
    { text: 'Débito', x: 400, y: 750 }, { text: 'Crédito', x: 480, y: 750 },

    { text: '02/06/2026', x: 40, y: 720 }, { text: 'COMPRA PAO DE ACUCAR', x: 140, y: 720 }, { text: '85,40', x: 400, y: 720 },
    { text: '05/06/2026', x: 40, y: 700 }, { text: 'SALARIO EMPRESA LTDA', x: 140, y: 700 }, { text: '3.200,00', x: 480, y: 700 },
  ];
}
