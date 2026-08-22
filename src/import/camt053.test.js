'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCamt053, parseCamt053 } from './camt053.js';

// Estratto realistico e minimo (ISO 20022 camt.053.001.02): due movimenti,
// un'entrata e un'uscita, con i campi che una banca vera popola davvero.
const CAMT_ESEMPIO = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>STMT-2026-08</Id>
      <Acct><Id><IBAN>IT60X0542811101000000123456</IBAN></Id></Acct>
      <Ntry>
        <NtryRef>REF001</NtryRef>
        <Amt Ccy="EUR">1500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-08-05</Dt></BookgDt>
        <ValDt><Dt>2026-08-05</Dt></ValDt>
        <AcctSvcrRef>BANKREF12345</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RmtInf><Ustrd>Stipendio agosto</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <NtryRef>REF002</NtryRef>
        <Amt Ccy="EUR">42.30</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-08-06</Dt></BookgDt>
        <AcctSvcrRef>BANKREF12346</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RmtInf><Ustrd>SUPERMERCATO ESSELUNGA</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

test('isCamt053: riconosce il tag radice reale, non l\'estensione del file', () => {
  assert.ok(isCamt053(CAMT_ESEMPIO));
  assert.ok(!isCamt053('<html><body>non è un estratto conto</body></html>'));
  assert.ok(!isCamt053(''));
  assert.ok(!isCamt053(null));
});

test('parseCamt053: legge entrambi i movimenti con importo, direzione e descrizione corretti', () => {
  const txs = parseCamt053(CAMT_ESEMPIO);
  assert.equal(txs.length, 2);

  const entrata = txs.find((t) => t.type === 'entrata');
  assert.equal(entrata.amount, 1500);
  assert.equal(entrata.description, 'Stipendio agosto');
  assert.equal(entrata.date.toISOString().slice(0, 10), '2026-08-05');
  assert.equal(entrata.externalId, 'camt:BANKREF12345');

  const uscita = txs.find((t) => t.type === 'uscita');
  assert.equal(uscita.amount, 42.30);
  assert.equal(uscita.description, 'SUPERMERCATO ESSELUNGA');
  assert.equal(uscita.date.toISOString().slice(0, 10), '2026-08-06');
});

test('parseCamt053: un importo sempre POSITIVO, la direzione la dice solo `type`', () => {
  const txs = parseCamt053(CAMT_ESEMPIO);
  for (const t of txs) assert.ok(t.amount > 0);
});

test('parseCamt053: file che non è un CAMT.053 -> array vuoto, mai un crash', () => {
  assert.deepEqual(parseCamt053('<html>non è un estratto</html>'), []);
  assert.deepEqual(parseCamt053(''), []);
  assert.deepEqual(parseCamt053(null), []);
});

test('parseCamt053: un movimento PENDING (non registrato) viene scartato', () => {
  const xml = CAMT_ESEMPIO.replace('<Sts>BOOK</Sts>\n        <BookgDt><Dt>2026-08-05</Dt></BookgDt>', '<Sts>PDNG</Sts>\n        <BookgDt><Dt>2026-08-05</Dt></BookgDt>');
  const txs = parseCamt053(xml);
  assert.equal(txs.length, 1, 'solo il movimento registrato deve restare');
  assert.equal(txs[0].type, 'uscita');
});

test('parseCamt053: senza <Sts> il movimento non viene scartato (non tutte le banche lo popolano)', () => {
  const xml = CAMT_ESEMPIO.replace('<Sts>BOOK</Sts>\n        <BookgDt><Dt>2026-08-05</Dt></BookgDt>', '<BookgDt><Dt>2026-08-05</Dt></BookgDt>');
  const txs = parseCamt053(xml);
  assert.equal(txs.length, 2);
});

test('parseCamt053: senza RmtInf usa AddtlNtryInf, poi il nome della controparte, mai un vuoto', () => {
  const xmlSenzaRmtInf = CAMT_ESEMPIO.replace('<RmtInf><Ustrd>SUPERMERCATO ESSELUNGA</Ustrd></RmtInf>', '');
  const conAddtl = xmlSenzaRmtInf.replace('<AcctSvcrRef>BANKREF12346</AcctSvcrRef>', '<AcctSvcrRef>BANKREF12346</AcctSvcrRef><AddtlNtryInf>Pagamento POS</AddtlNtryInf>');
  const txs = parseCamt053(conAddtl);
  const uscita = txs.find((t) => t.type === 'uscita');
  assert.equal(uscita.description, 'Pagamento POS');
});

test('parseCamt053: senza NtryRef/AcctSvcrRef, externalId resta vuoto (mai un id inventato)', () => {
  const xml = CAMT_ESEMPIO.replace('<AcctSvcrRef>BANKREF12345</AcctSvcrRef>', '').replace('<NtryRef>REF001</NtryRef>', '');
  const txs = parseCamt053(xml);
  const entrata = txs.find((t) => t.type === 'entrata');
  assert.equal(entrata.externalId, '');
});

test('parseCamt053: un <Ntry> senza CdtDbtInd (campo obbligatorio mancante) viene scartato, non indovinato', () => {
  const xml = CAMT_ESEMPIO.replace('<CdtDbtInd>CRDT</CdtDbtInd>', '');
  const txs = parseCamt053(xml);
  assert.equal(txs.length, 1);
});
