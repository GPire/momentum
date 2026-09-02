import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergePair, mergeList, visible, isDeleted, touch, markDeleted, markRestored,
  chiaveAbbonamento, mergeScalar,
} from './user-data-merge.js';

// ── LISTE CON ID ──

test('unione per id: le voci nuove si aggiungono, quelle esistenti si fondono', () => {
  const locali = [touch({ id: 'a', nome: 'Uno' }, 1000)];
  const inArrivo = [touch({ id: 'a', nome: 'Uno corretto' }, 2000), touch({ id: 'b', nome: 'Due' }, 1500)];
  const fuse = mergeList(locali, inArrivo);
  assert.equal(fuse.length, 2);
  assert.equal(fuse.find(v => v.id === 'a').nome, 'Uno corretto');
});

test('ordine indifferente e fusione idempotente: due dispositivi non litigano all infinito', () => {
  const a = touch({ id: 'x', nome: 'A' }, 1000);
  const b = touch({ id: 'x', nome: 'B' }, 2000);
  assert.equal(mergePair(a, b).nome, mergePair(b, a).nome);
  const ab = mergePair(a, b);
  assert.deepEqual(mergePair(ab, ab), ab);
  assert.deepEqual(mergePair(ab, a), ab);
});

test('cancellazione: non torna in vita da un dispositivo che non lo sapeva', () => {
  const voce = touch({ id: 'x', nome: 'A' }, 1000);
  const cancellata = markDeleted(voce, 2000);
  const copiaViva = { ...voce, updatedAt: 9000 };
  assert.equal(isDeleted(mergePair(cancellata, copiaViva)), true);
  assert.equal(isDeleted(mergePair(copiaViva, cancellata)), true);
  assert.equal(visible(mergeList([copiaViva], [cancellata])).length, 0);
});

test('ripristino: vince se è più recente della cancellazione, anche dopo la sincronizzazione', () => {
  const cancellata = markDeleted({ id: 'x' }, 1000);
  const ripristinata = markRestored(cancellata, 2000);
  assert.equal(isDeleted(mergePair(cancellata, ripristinata)), false);
  assert.equal(isDeleted(mergePair(ripristinata, markDeleted(ripristinata, 3000))), true);
});

test('voci senza chiave o sporche vengono ignorate senza rompere niente', () => {
  const buona = touch({ id: 'ok' }, 1);
  assert.deepEqual(mergeList([buona], [null, undefined, {}, { id: '' }]), [buona]);
  assert.deepEqual(mergeList(), []);
  assert.equal(mergePair(buona, null), buona);
  assert.equal(mergePair(null, buona), buona);
});

// ── ABBONAMENTI (nessun id: chiave naturale) ──

test('abbonamenti: lo stesso Netflix rilevato da due dispositivi resta UNO', () => {
  const suTelefono = [{ name: 'Netflix', amount: 12.99, addedAt: '2026-08-01' }];
  const suPortatile = [{ name: 'netflix', amount: 12.99, addedAt: '2026-08-02' }]; // maiuscole diverse
  const fuse = mergeList(suTelefono, suPortatile, chiaveAbbonamento);
  assert.equal(fuse.length, 1);
});

test('abbonamenti: lo stesso nome a un PREZZO diverso resta due voci, e deve restarlo', () => {
  // Piano cambiato: chi guarda deve poter vedere entrambe le righe e decidere.
  // Fonderle sceglierebbe al posto suo quale prezzo è quello giusto.
  const fuse = mergeList(
    [{ name: 'Netflix', amount: 12.99 }],
    [{ name: 'Netflix', amount: 17.99 }],
    chiaveAbbonamento,
  );
  assert.equal(fuse.length, 2);
});

test('abbonamenti: uno senza nome non entra (una chiave instabile creerebbe doppioni infiniti)', () => {
  assert.equal(chiaveAbbonamento({ amount: 10 }), null);
  assert.equal(mergeList([], [{ amount: 10 }], chiaveAbbonamento).length, 0);
});

test('abbonamenti: cancellarne uno su un dispositivo lo toglie anche dall altro', () => {
  const netflix = touch({ name: 'Netflix', amount: 12.99 }, 1000);
  const disdetto = markDeleted(netflix, 2000);
  const fuse = mergeList([netflix], [disdetto], chiaveAbbonamento);
  assert.equal(visible(fuse).length, 0);
});

// ── VALORE SINGOLO (budget mensile) ──

test('budget: vince chi lo ha cambiato per ultimo, non chi si collega per ultimo', () => {
  assert.equal(mergeScalar(1500, 1000, 1800, 2000).valore, 1800);
  assert.equal(mergeScalar(1800, 2000, 1500, 1000).valore, 1800);
});

test('budget: se l altro dispositivo non ne ha uno, il proprio resta intatto', () => {
  assert.equal(mergeScalar(1500, 1000, undefined, 9999).valore, 1500);
  assert.equal(mergeScalar(1500, 1000, null, 9999).valore, 1500);
});

test('budget: se il proprio non esiste ancora, si prende quello che arriva', () => {
  assert.equal(mergeScalar(undefined, 0, 1800, 2000).valore, 1800);
});

test('budget: senza date non si cambia niente a caso (a parità, resta il locale)', () => {
  assert.equal(mergeScalar(1500, undefined, 1800, undefined).valore, 1500);
});

test('a scala: 300 voci da due dispositivi, nessuna persa né duplicata', () => {
  const a = Array.from({ length: 150 }, (_, i) => touch({ id: `a${i}` }, i));
  const b = Array.from({ length: 150 }, (_, i) => touch({ id: `b${i}` }, i));
  const fuse = mergeList(a, b);
  assert.equal(fuse.length, 300);
  assert.equal(new Set(fuse.map(v => v.id)).size, 300);
});
