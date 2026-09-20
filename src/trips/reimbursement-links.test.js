import { test } from 'node:test';
import assert from 'node:assert/strict';
import { associateReimbursement, reimbursementLinkDigest, reimbursementLinkState, mergeReimbursementLinks, reimbursementCandidates } from './reimbursement-links.js';
import { reimbursementBalance } from './reimbursement-balance.js';
import { computeSyncDigest, transactionsMissingFromPeer, mergeTransactions } from '../mesh/sync.js';
const tx = { id: 'uuid-income', type: 'entrata', amount: 40, currency: 'EUR', date: '2026-09-20', hash: 'original' };
const trip = { id: 'trip', receiptPolicy: { currency: 'EUR' } };
test('link and unlink preserve source, amount and hash with explicit history', () => {
 const linked = associateReimbursement(tx, trip.id, 'a', '');
 assert.equal(reimbursementLinkState(linked).tripId, trip.id);
 assert.equal(tx.reimbursementLinks, undefined); assert.equal(linked.hash, tx.hash);
 assert.equal(reimbursementBalance(trip, [linked]).received, 40);
 const removed = associateReimbursement(linked, null, 'b', reimbursementLinkDigest(linked));
 assert.equal(reimbursementLinkState(removed).tripId, null);
 assert.equal(reimbursementBalance(trip, [removed]).received, 0);
 assert.throws(() => associateReimbursement(linked, null, 'b', ''));
});
test('concurrent destinations are unresolved, sync converges and keeps unlink history', () => {
 const a = associateReimbursement(tx, 'trip', 'a', ''), b = associateReimbursement(tx, 'other', 'b', '');
 const merged = mergeReimbursementLinks(a, b);
 assert.deepEqual(merged, mergeReimbursementLinks(b, a));
 assert.equal(reimbursementLinkState(merged).conflict, true);
 assert.equal(reimbursementBalance(trip, [merged]).status, 'review');
 const unlinked = associateReimbursement(a, null, 'c', 'a');
 assert.equal(reimbursementLinkState(mergeReimbursementLinks(a, unlinked)).tripId, null);
});
test('sync sends changed association on existing movement and respects deletion', () => {
 const linked = associateReimbursement(tx, trip.id, 'a', '');
 const original = { '2026-09': [tx] }, updated = { '2026-09': [linked] };
 const delta = transactionsMissingFromPeer(updated, computeSyncDigest(original));
 assert.equal(delta['2026-09'].length, 1);
 const merged = mergeTransactions(original, delta);
 assert.equal(merged.updated, 1); assert.equal(reimbursementLinkState(merged.merged['2026-09'][0]).tripId, trip.id);
 assert.equal(mergeTransactions(original, delta, { [tx.id]: 1 }).merged['2026-09'].length, 0);
 assert.deepEqual(transactionsMissingFromPeer(updated, computeSyncDigest(updated)), {});
});
test('candidates exclude duplicates, another trip and foreign currency; rank not auto-link', () => {
 const exact = { ...tx, id: 'exact', amount: 100 };
 const other = associateReimbursement({ ...tx, id: 'other' }, 'other', 'event', '');
 const rows = reimbursementCandidates(trip, [tx, exact, other, { ...tx, id: 'usd', currency: 'USD' }], 100);
 assert.deepEqual(rows.map(row => row.id), ['exact', tx.id]);
 assert.equal(reimbursementCandidates(trip, [tx, { ...tx }], 100).length, 0);
 assert.equal(reimbursementLinkState(exact).tripId, null);
});
test('different source or modified amount cannot overwrite association', () => {
 const linked = associateReimbursement(tx, trip.id, 'a', '');
 assert.equal(mergeReimbursementLinks(tx, { ...linked, hash: 'changed' }), tx);
 assert.equal(mergeReimbursementLinks(tx, { ...linked, amount: 900 }), tx);
});
test('Vault links UUID once, rejects other trips and allows reversible unlink', async () => {
 globalThis.window ||= {};
 globalThis.navigator ||= { language: 'it', maxTouchPoints: 0 };
 globalThis.localStorage ||= { getItem: () => null, setItem: () => {} };
 const { VaultDAO } = await import('../core/vault.js');
 const state = VaultDAO.state, save = VaultDAO.save;
 try {
   VaultDAO.state = { businessTrips: [trip, { ...trip, id: 'other' }], transactions: { '2026-09': [{ ...tx }] } };
   VaultDAO.save = () => {};
   assert.ok(VaultDAO.associateTripCredit(tx.id, trip.id, false, 'a', ''));
   assert.equal(VaultDAO.associateTripCredit(tx.id, 'other', false, 'b', 'a'), null);
   assert.ok(VaultDAO.associateTripCredit(tx.id, trip.id, true, 'c', 'a'));
   const stored = VaultDAO.state.transactions['2026-09'][0];
   assert.equal(stored.hash, tx.hash); assert.equal(stored.amount, tx.amount);
   assert.equal(reimbursementLinkState(stored).tripId, null);
   VaultDAO.state.deletedTx = { [tx.id]: 1 };
   assert.equal(VaultDAO.associateTripCredit(tx.id, trip.id, false, 'd', 'a|c'), null);
 } finally { VaultDAO.state = state; VaultDAO.save = save; }
});
