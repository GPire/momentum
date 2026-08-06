import test from 'node:test';
import assert from 'node:assert/strict';
const {
  buildFatturaPaXML, validateFatturaPa, recommendInvoiceType, missingForFatturaPa,
  progressivoInvio, fatturaPaFilename, REGIME_FISCALE_CODE, NATURA_FORFETTARIO,
} = await import('./fatturapa-xml.js');
const { computeInvoice } = await import('./invoice-engine.js');

// Dati anagrafici completi e realistici (nessun dato di persona reale).
const EMITTER = {
  partitaIva: '01234567890', denominazione: 'Mario Bianchi', regime: 'forfettario',
  indirizzo: 'Via Roma 1', cap: '09100', comune: 'Cagliari', provincia: 'CA', nazione: 'IT',
  iban: 'IT60X0542811101000000123456',
};
const CLIENT = {
  denominazione: 'Acme SRL', partitaIva: '09876543210',
  indirizzo: 'Corso Italia 22', cap: '20100', comune: 'Milano', provincia: 'MI', nazione: 'IT',
  codiceDestinatario: 'ABCDEFG',
};

// --- GUIDA ALLA SCELTA -----------------------------------------------------
test('recommendInvoiceType: P.IVA italiana + cliente italiano → FatturaPA', () => {
  const r = recommendInvoiceType({ emitterCountry: 'IT', emitterHasVat: true, clientCountry: 'IT' });
  assert.equal(r.type, 'fatturapa');
  assert.equal(r.needsFatturaPa, true);
  assert.ok(r.steps.length >= 3);
});

test('recommendInvoiceType: cliente estero → documento di cortesia (con verifica)', () => {
  const r = recommendInvoiceType({ emitterCountry: 'IT', emitterHasVat: true, clientCountry: 'DE' });
  assert.equal(r.type, 'cortesia');
  assert.equal(r.needsFatturaPa, false);
  assert.equal(r.verify, true);
});

test('recommendInvoiceType: emittente non italiano → cortesia, niente SdI', () => {
  const r = recommendInvoiceType({ emitterCountry: 'ES', emitterHasVat: true });
  assert.equal(r.type, 'cortesia');
  assert.equal(r.needsFatturaPa, false);
});

test('recommendInvoiceType: senza Partita IVA → ricevuta/cortesia, verifica', () => {
  const r = recommendInvoiceType({ emitterCountry: 'IT', emitterHasVat: false });
  assert.equal(r.type, 'cortesia');
  assert.equal(r.verify, true);
});

// --- COSA MANCA ------------------------------------------------------------
test('missingForFatturaPa: dati vuoti → elenca i campi mancanti in chiaro', () => {
  const m = missingForFatturaPa({ emitter: {}, client: {} });
  const fields = m.map(x => x.field);
  assert.ok(fields.includes('emitter.partitaIva'));
  assert.ok(fields.includes('client.idFiscale'));
  assert.ok(m.every(x => x.label && x.help)); // ogni voce ha etichetta + aiuto amichevole
});

test('missingForFatturaPa: dati completi → niente mancante', () => {
  assert.equal(missingForFatturaPa({ emitter: EMITTER, client: CLIENT }).length, 0);
});

// --- VALIDAZIONE (predizione scarti SdI) -----------------------------------
test('validateFatturaPa: cliente senza P.IVA né CF → errore 00417', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: EMITTER, client: { denominazione: 'X', indirizzo: 'a', cap: '00100', comune: 'Roma' }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  const e = c.find(x => x.code === '00417');
  assert.ok(e && e.level === 'error');
});

test('validateFatturaPa: codice destinatario di lunghezza errata → errore 00415', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: EMITTER, client: { ...CLIENT, codiceDestinatario: 'ABC' }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  assert.ok(c.some(x => x.code === '00415' && x.level === 'error'));
});

test('validateFatturaPa: senza codice destinatario né PEC → warn 00427 (non blocca)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: EMITTER, client: { ...CLIENT, codiceDestinatario: '' }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  const w = c.find(x => x.code === '00427');
  assert.ok(w && w.level === 'warn');
});

test('validateFatturaPa: dati completi e coerenti → nessun errore bloccante', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'IT' });
  const c = validateFatturaPa({ emitter: { ...EMITTER, regime: 'ordinario' }, client: CLIENT, invoice: inv, meta: { number: 5, year: 2026, date: '2026-07-21', regime: 'ordinario' } });
  assert.equal(c.filter(x => x.level === 'error').length, 0);
});

test('validateFatturaPa: emittente e cliente stessa P.IVA → errore 00471 (no autofattura TD01)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'IT' });
  const c = validateFatturaPa({ emitter: { ...EMITTER, regime: 'ordinario' }, client: { ...CLIENT, partitaIva: EMITTER.partitaIva }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'ordinario' } });
  assert.ok(c.some(x => x.code === '00471' && x.level === 'error'));
});

test('validateFatturaPa: Codice Destinatario con caratteri non validi → errore 00305', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: EMITTER, client: { ...CLIENT, codiceDestinatario: 'ABC-123' }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  // 'ABC-123' ha 7 char ma con trattino → 00305 (non 00415)
  assert.ok(c.some(x => x.code === '00305' && x.level === 'error'));
});

test('validateFatturaPa: CAP/Provincia/PEC malformati → warn (non bloccano)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: { ...EMITTER, cap: '9100', provincia: 'CAG' }, client: { ...CLIENT, codiceDestinatario: '', pec: 'non-una-pec' }, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  assert.ok(c.some(x => x.code === '00404' && x.field === 'emitter.cap' && x.level === 'warn'));
  assert.ok(c.some(x => x.code === '00404' && x.field === 'emitter.provincia' && x.level === 'warn'));
  assert.ok(c.some(x => x.code === '00426' && x.level === 'warn'));
  assert.equal(c.filter(x => x.level === 'error').length, 0); // nessuno di questi blocca
});

test('validateFatturaPa: importo zero → errore 00423', () => {
  const inv = computeInvoice({ imponibile: 0, regime: 'forfettario', country: 'IT' });
  const c = validateFatturaPa({ emitter: EMITTER, client: CLIENT, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  assert.ok(c.some(x => x.code === '00423' && x.level === 'error'));
});

// --- GENERAZIONE XML -------------------------------------------------------
test('buildFatturaPaXML: forfettario → XML valido con RF19, Natura N2.2, bollo, niente IVA', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const { xml, filename, blocking, controls } = buildFatturaPaXML({
    emitter: EMITTER, client: CLIENT, invoice: inv,
    meta: { number: 3, year: 2026, date: '2026-07-21', regime: 'forfettario', description: 'Consulenza' },
  });
  assert.ok(/versione="FPR12"/.test(xml));
  assert.ok(/<RegimeFiscale>RF19<\/RegimeFiscale>/.test(xml));
  assert.ok(new RegExp(`<Natura>${NATURA_FORFETTARIO}</Natura>`).test(xml));
  assert.ok(/<AliquotaIVA>0.00<\/AliquotaIVA>/.test(xml));
  assert.ok(/<DatiBollo><BolloVirtuale>SI<\/BolloVirtuale><ImportoBollo>2.00<\/ImportoBollo><\/DatiBollo>/.test(xml));
  assert.ok(/<ImponibileImporto>1000.00<\/ImponibileImporto>/.test(xml));
  assert.ok(/<Imposta>0.00<\/Imposta>/.test(xml));
  assert.ok(/RiferimentoNormativo/.test(xml));
  assert.equal(blocking, false);
  assert.equal(filename, `IT01234567890_${progressivoInvio(3, 2026)}.xml`);
  // nessun errore bloccante coi dati completi
  assert.equal(controls.filter(c => c.level === 'error').length, 0);
});

test('buildFatturaPaXML: ordinario → cassa 4%, IVA 22% su 1040, ritenuta 20%, RF01', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: { ...EMITTER, regime: 'ordinario' }, client: CLIENT, invoice: inv,
    meta: { number: 7, year: 2026, date: '2026-07-21', regime: 'ordinario', description: 'Progetto' },
  });
  assert.ok(/<RegimeFiscale>RF01<\/RegimeFiscale>/.test(xml));
  assert.ok(/<DatiCassaPrevidenziale><TipoCassa>TC22<\/TipoCassa><AlCassa>4.00<\/AlCassa><ImportoContributoCassa>40.00<\/ImportoContributoCassa><ImponibileCassa>1000.00<\/ImponibileCassa><AliquotaIVA>22.00<\/AliquotaIVA><\/DatiCassaPrevidenziale>/.test(xml));
  assert.ok(/<DatiRitenuta><TipoRitenuta>RT01<\/TipoRitenuta><ImportoRitenuta>200.00<\/ImportoRitenuta><AliquotaRitenuta>20.00<\/AliquotaRitenuta><CausalePagamento>A<\/CausalePagamento><\/DatiRitenuta>/.test(xml));
  assert.ok(/<ImponibileImporto>1040.00<\/ImponibileImporto>/.test(xml));
  assert.ok(/<Imposta>228.80<\/Imposta>/.test(xml));
  assert.ok(/<ImportoTotaleDocumento>1268.80<\/ImportoTotaleDocumento>/.test(xml));
  // pagamento netto = totale − ritenuta
  assert.ok(/<ImportoPagamento>1068.80<\/ImportoPagamento>/.test(xml));
  assert.ok(/<IBAN>IT60X0542811101000000123456<\/IBAN>/.test(xml));
});

test('buildFatturaPaXML: ordine schema DatiGeneraliDocumento (Ritenuta→Bollo→Cassa)', () => {
  // caso costruito con ritenuta E bollo E cassa non è tipico, ma l'ordine dei tag
  // deve rispettare lo schema comunque: verifichiamo l'ordine relativo Ritenuta<Cassa.
  const inv = computeInvoice({ imponibile: 1000, regime: 'ordinario', country: 'IT' });
  const { xml } = buildFatturaPaXML({ emitter: { ...EMITTER, regime: 'ordinario' }, client: CLIENT, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'ordinario' } });
  assert.ok(xml.indexOf('<DatiRitenuta>') < xml.indexOf('<DatiCassaPrevidenziale>'));
  assert.ok(xml.indexOf('<TipoDocumento>') < xml.indexOf('<DatiRitenuta>'));
});

test('buildFatturaPaXML: senza codice destinatario → 0000000, con PEC la include', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: EMITTER, client: { ...CLIENT, codiceDestinatario: '', pec: 'acme@pec.it' }, invoice: inv,
    meta: { number: 2, year: 2026, date: '2026-07-21', regime: 'forfettario' },
  });
  assert.ok(/<CodiceDestinatario>0000000<\/CodiceDestinatario>/.test(xml));
  assert.ok(/<PECDestinatario>acme@pec.it<\/PECDestinatario>/.test(xml));
});

// --- VOCI MULTIPLE (righe scomposte) ---------------------------------------
// Un utente che scrive "4000 di sviluppo, 399 di hosting" invece di un unico
// importo indistinto: ogni voce diventa una riga XML vera (NumeroLinea
// progressivo), non solo un dettaglio nel PDF. La somma delle voci deve
// combaciare con l'imponibile totale — qui verificato esplicitamente.
test('buildFatturaPaXML: più voci → una <DettaglioLinee> per voce, numerate in ordine', () => {
  const inv = computeInvoice({ imponibile: 4399, regime: 'forfettario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: EMITTER, client: CLIENT, invoice: inv,
    meta: {
      number: 5, year: 2026, date: '2026-07-21', regime: 'forfettario',
      voci: [{ descrizione: 'Sviluppo sito', importo: 4000 }, { descrizione: 'Hosting annuale', importo: 399 }],
    },
  });
  const linee = xml.match(/<DettaglioLinee>.*?<\/DettaglioLinee>/gs);
  assert.equal(linee.length, 2);
  assert.ok(/<NumeroLinea>1<\/NumeroLinea>/.test(linee[0]));
  assert.ok(/<Descrizione>Sviluppo sito<\/Descrizione>/.test(linee[0]));
  assert.ok(/<PrezzoTotale>4000.00<\/PrezzoTotale>/.test(linee[0]));
  assert.ok(/<NumeroLinea>2<\/NumeroLinea>/.test(linee[1]));
  assert.ok(/<Descrizione>Hosting annuale<\/Descrizione>/.test(linee[1]));
  assert.ok(/<PrezzoTotale>399.00<\/PrezzoTotale>/.test(linee[1]));
  // il totale documento resta quello calcolato sull'imponibile SOMMATO (4399 + bollo)
  assert.ok(/<ImportoTotaleDocumento>4401.00<\/ImportoTotaleDocumento>/.test(xml));
});

test('buildFatturaPaXML: senza voci → resta la riga unica di sempre (retrocompatibilità)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: EMITTER, client: CLIENT, invoice: inv,
    meta: { number: 6, year: 2026, date: '2026-07-21', regime: 'forfettario', description: 'Consulenza' },
  });
  const linee = xml.match(/<DettaglioLinee>.*?<\/DettaglioLinee>/gs);
  assert.equal(linee.length, 1);
  assert.ok(/<Descrizione>Consulenza<\/Descrizione>/.test(linee[0]));
});

test('buildFatturaPaXML: dati incompleti → blocking true, ma XML comunque prodotto (onestà)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const r = buildFatturaPaXML({ emitter: {}, client: {}, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
  assert.equal(r.blocking, true);
  assert.ok(r.xml.includes('FatturaElettronica')); // il file esiste comunque
  assert.ok(r.controls.some(c => c.level === 'error'));
});

test('buildFatturaPaXML: escape XML dei caratteri speciali (no rottura/injection)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const { xml } = buildFatturaPaXML({
    emitter: EMITTER, client: { ...CLIENT, denominazione: 'Rossi & <Figli> "SRL"' }, invoice: inv,
    meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario', description: 'A & B < C' },
  });
  assert.ok(/Rossi &amp; &lt;Figli&gt; &quot;SRL&quot;/.test(xml));
  assert.ok(!/<Figli>/.test(xml)); // nessun tag iniettato
});

test('progressivoInvio: deterministico e diverso per fatture diverse', () => {
  assert.equal(progressivoInvio(3, 2026), progressivoInvio(3, 2026));
  assert.notEqual(progressivoInvio(3, 2026), progressivoInvio(4, 2026));
  assert.notEqual(progressivoInvio(3, 2026), progressivoInvio(3, 2025));
});

test('fatturaPaFilename: usa la P.IVA, formato IT{id}_{prog}.xml', () => {
  assert.equal(fatturaPaFilename({ partitaIva: '01234567890' }, '00ABC'), 'IT01234567890_00ABC.xml');
  // senza identificativo → placeholder, mai crash
  assert.ok(/^IT.*_X\.xml$/.test(fatturaPaFilename({}, 'X')));
});

test('REGIME_FISCALE_CODE: mappa i due regimi correttamente', () => {
  assert.equal(REGIME_FISCALE_CODE.forfettario, 'RF19');
  assert.equal(REGIME_FISCALE_CODE.ordinario, 'RF01');
});
