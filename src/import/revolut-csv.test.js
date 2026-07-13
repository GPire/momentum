import test from 'node:test';
import assert from 'node:assert/strict';
const { parseRevolutExport, isRevolutExport, parseCsvRow } = await import('./revolut-csv.js');

const HEADER = '"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","original_currency","fx_rate","description","transaction_id","counterparty_name","counterparty_iban","payment_reference","mcc_code"';
const row = (o) => {
  const f = { datetime:'', date:'2024-09-03', account_type:'DEFAULT', category:'', type:'', asset_class:'', name:'', symbol:'', shares:'', price:'', amount:'', fee:'', tax:'', currency:'EUR', original_amount:'', original_currency:'', fx_rate:'', description:'', transaction_id:'x', counterparty_name:'', counterparty_iban:'', payment_reference:'', mcc_code:'', ...o };
  return ['datetime','date','account_type','category','type','asset_class','name','symbol','shares','price','amount','fee','tax','currency','original_amount','original_currency','fx_rate','description','transaction_id','counterparty_name','counterparty_iban','payment_reference','mcc_code'].map(k => `"${f[k]}"`).join(',');
};

test('parseCsvRow: rispetta le virgolette con virgole interne', () => {
  const r = parseCsvRow('"a","SNOWFLAKE INC. A DL-,0001, quantity: 1","b"');
  assert.equal(r.length, 3);
  assert.equal(r[1], 'SNOWFLAKE INC. A DL-,0001, quantity: 1');
});

test('isRevolutExport riconosce lo schema', () => {
  assert.ok(isRevolutExport(HEADER));
  assert.ok(!isRevolutExport('data,descrizione,importo'));
});

test('BUY STOCK → invest/etf con descrizione', () => {
  const csv = HEADER + '\n' + row({ category:'TRADING', type:'BUY', asset_class:'STOCK', name:'Snowflake (A)', symbol:'US8334451098', shares:'1', price:'99.73', amount:'-99.73', description:'Buy trade, quantity: 1' });
  const [t] = parseRevolutExport(csv);
  assert.equal(t.type, 'invest'); assert.equal(t.category, 'etf');
  assert.equal(t.amount, 99.73); assert.ok(/Snowflake/.test(t.description));
});

test('BUY CRYPTO → invest/crypto', () => {
  const csv = HEADER + '\n' + row({ category:'TRADING', type:'BUY', asset_class:'CRYPTO', name:'Ethereum', symbol:'ETH', amount:'-5.08' });
  const [t] = parseRevolutExport(csv);
  assert.equal(t.type, 'invest'); assert.equal(t.category, 'crypto');
});

test('DIVIDEND → entrata/etf', () => {
  const csv = HEADER + '\n' + row({ type:'DIVIDEND', asset_class:'STOCK', name:'Apple', amount:'0.45' });
  const [t] = parseRevolutExport(csv);
  assert.equal(t.type, 'entrata'); assert.equal(t.category, 'etf');
  assert.ok(/Dividendo Apple/.test(t.description));
});

test('CARD_TRANSACTION + MCC 5812 → uscita/ristoranti', () => {
  const csv = HEADER + '\n' + row({ type:'CARD_TRANSACTION', name:'MC DONALD S', amount:'-7.50', mcc_code:'5812' });
  const [t] = parseRevolutExport(csv);
  assert.equal(t.type, 'uscita'); assert.equal(t.category, 'ristoranti');
  assert.equal(t.amount, 7.5); assert.equal(t.description, 'MC DONALD S');
});

test('CUSTOMER_INPAYMENT → entrata; corporate action a 0 → saltata', () => {
  const csv = HEADER + '\n'
    + row({ type:'CUSTOMER_INPAYMENT', amount:'20', description:'Deposit' }) + '\n'
    + row({ category:'CORPORATE_ACTION', type:'SPLIT', asset_class:'STOCK', name:'Tesla', amount:'' });
  const txs = parseRevolutExport(csv);
  assert.equal(txs.length, 1); // lo split a 0 è saltato
  assert.equal(txs[0].type, 'entrata');
});

test('GARANZIA aggancio data→mese→giorno: ogni importo mantiene la sua data esatta', () => {
  const csv = HEADER + '\n'
    + row({ date:'2024-09-03', category:'TRADING', type:'BUY', asset_class:'STOCK', name:'Snowflake (A)', amount:'-99.73' }) + '\n'
    + row({ date:'2025-01-06', category:'TRADING', type:'BUY', asset_class:'STOCK', name:'Tesla', amount:'-2.00' }) + '\n'
    + row({ date:'2026-07-11', type:'CARD_TRANSACTION', name:'MC DONALD S', amount:'-7.50', mcc_code:'5812' }) + '\n'
    + row({ date:'2024-08-15', type:'DIVIDEND', asset_class:'STOCK', name:'Apple', amount:'0.45' });
  const txs = parseRevolutExport(csv);
  assert.equal(txs.length, 4);
  const byDate = Object.fromEntries(txs.map(t => [t.date.toISOString().slice(0,10), t]));
  // ogni transazione è agganciata al SUO giorno/mese/anno esatti
  assert.ok(byDate['2024-09-03'] && byDate['2024-09-03'].description.match(/Snowflake/));
  assert.equal(byDate['2025-01-06'].date.getMonth(), 0);   // gennaio
  assert.equal(byDate['2025-01-06'].date.getDate(), 6);
  assert.equal(byDate['2026-07-11'].date.getMonth(), 6);   // luglio
  assert.equal(byDate['2026-07-11'].date.getDate(), 11);
  assert.equal(byDate['2024-08-15'].date.getFullYear(), 2024);
});
