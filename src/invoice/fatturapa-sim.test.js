// ============================================================
// SIMULAZIONE INCROCIATA FatturaPA — garanzia di validità (v10)
// ============================================================
// Genera una MATRICE di scenari reali (regimi × importi × tipi cliente × casi
// limite), produce l'XML e verifica in modo INCROCIATO che:
//  1. gli importi dentro l'XML combacino ESATTAMENTE col motore computeInvoice;
//  2. valga la coerenza SdI 00422 (Imposta = Imponibile × Aliquota);
//  3. il totale documento = imponibile + IVA + bollo, e il pagamento = totale − ritenuta;
//  4. i dati completi NON producano scarti bloccanti; i dati incompleti SÌ.
// È la prova che l'XML non "sembra" valido: è coerente col calcolo, per ogni caso.
import test from 'node:test';
import assert from 'node:assert/strict';
const { buildFatturaPaXML } = await import('./fatturapa-xml.js');
const { computeInvoice } = await import('./invoice-engine.js');

const EMITTER = { partitaIva: '01234567890', denominazione: 'Studio X', indirizzo: 'Via A 1', cap: '09100', comune: 'Cagliari', provincia: 'CA', iban: 'IT60X0542811101000000123456' };
const CLIENT = { denominazione: 'Cliente Y', partitaIva: '09876543210', indirizzo: 'Via B 2', cap: '20100', comune: 'Milano', provincia: 'MI', codiceDestinatario: 'ABCDEFG' };

// Estrae il valore numerico di un tag (primo match) dall'XML.
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? m[1] : null; };
const numTag = (xml, name) => { const v = tag(xml, name); return v == null ? null : parseFloat(v); };
const eur2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

test('SIM incrociata: 4 regimi/casi × 6 importi → XML coerente col calcolo', () => {
  const regimi = ['forfettario', 'ordinario'];
  const importi = [50, 77.47, 100, 1000, 3333.33, 25000];
  let scenari = 0;
  for (const regime of regimi) {
    for (const imponibile of importi) {
      const inv = computeInvoice({ imponibile, regime, country: 'IT' });
      const { xml, blocking, controls } = buildFatturaPaXML({
        emitter: { ...EMITTER, regime }, client: CLIENT, invoice: inv,
        meta: { number: 1, year: 2026, date: '2026-07-21', regime, description: 'Prestazione' },
      });
      scenari++;

      // (1) Importi XML == motore
      const imponXml = numTag(xml, 'ImponibileImporto');
      const impostaXml = numTag(xml, 'Imposta');
      const totXml = numTag(xml, 'ImportoTotaleDocumento');
      const attesoImpon = eur2(inv.imponibile + inv.cassaImporto);
      assert.equal(imponXml, attesoImpon, `imponibile XML ${regime}/${imponibile}`);
      assert.equal(impostaXml, eur2(inv.ivaImporto), `imposta XML ${regime}/${imponibile}`);
      const attesoTot = eur2(inv.imponibile + inv.cassaImporto + inv.ivaImporto + inv.bolloImporto);
      assert.equal(totXml, attesoTot, `totale documento ${regime}/${imponibile}`);

      // (2) Coerenza SdI 00422: Imposta = Imponibile × Aliquota (±1 cent)
      const aliqXml = numTag(xml, 'AliquotaIVA'); // percentuale
      const impostaAttesa = eur2(imponXml * aliqXml / 100);
      assert.ok(Math.abs(impostaAttesa - impostaXml) <= 0.01, `00422 coerenza ${regime}/${imponibile}`);

      // (3) Ritenuta e pagamento
      const ritXml = numTag(xml, 'ImportoRitenuta') || 0;
      assert.equal(ritXml, eur2(inv.ritenutaImporto), `ritenuta ${regime}/${imponibile}`);
      const pagXml = numTag(xml, 'ImportoPagamento');
      assert.equal(pagXml, eur2(attesoTot - inv.ritenutaImporto), `pagamento netto ${regime}/${imponibile}`);

      // (4) bollo solo forfettario sopra soglia
      const bolloXml = numTag(xml, 'ImportoBollo');
      if (regime === 'forfettario' && imponibile > 77.47) assert.equal(bolloXml, 2, `bollo dovuto ${imponibile}`);
      else assert.equal(bolloXml, null, `bollo NON dovuto ${regime}/${imponibile}`);

      // dati completi → nessuno scarto bloccante
      assert.equal(blocking, false, `no scarti ${regime}/${imponibile}: ${JSON.stringify(controls.filter(c => c.level === 'error'))}`);

      // struttura minima presente
      assert.ok(/<RegimeFiscale>RF(19|01)<\/RegimeFiscale>/.test(xml));
      assert.ok(/<Numero>1\/2026<\/Numero>/.test(xml));
    }
  }
  assert.equal(scenari, regimi.length * importi.length);
});

test('SIM incrociata: matrice recapito cliente (SdI 7 / PEC / nessuno) → esito atteso', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const casi = [
    { client: { ...CLIENT, codiceDestinatario: 'ABCDEFG' }, cod: 'ABCDEFG', warn427: false },
    { client: { ...CLIENT, codiceDestinatario: '', pec: 'a@pec.it' }, cod: '0000000', warn427: false },
    { client: { ...CLIENT, codiceDestinatario: '' }, cod: '0000000', warn427: true },
  ];
  for (const c of casi) {
    const { xml, controls, blocking } = buildFatturaPaXML({ emitter: EMITTER, client: c.client, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
    assert.equal(tag(xml, 'CodiceDestinatario'), c.cod);
    assert.equal(controls.some(x => x.code === '00427'), c.warn427);
    assert.equal(blocking, false); // il recapito mancante è warn, non blocco
  }
});

test('SIM incrociata: dati incompleti → SEMPRE bloccante (mai un XML che finge validità)', () => {
  const inv = computeInvoice({ imponibile: 1000, regime: 'forfettario', country: 'IT' });
  const incompleti = [
    { emitter: {}, client: CLIENT },                                   // manca emittente
    { emitter: EMITTER, client: { denominazione: 'Solo nome' } },      // cliente senza id fiscale
    { emitter: { ...EMITTER, partitaIva: '' }, client: CLIENT },       // emittente senza P.IVA
  ];
  for (const d of incompleti) {
    const { blocking } = buildFatturaPaXML({ ...d, invoice: inv, meta: { number: 1, year: 2026, date: '2026-07-21', regime: 'forfettario' } });
    assert.equal(blocking, true);
  }
});
