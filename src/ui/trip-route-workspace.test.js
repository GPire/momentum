import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripRouteAction, tripRouteWorkspaceHtml } from './trip-route-workspace.js';
test('all four routes guide an empty trip to first expense', () => {
 for (let mode=0;mode<4;mode++) assert.equal(tripRouteAction(mode,{transactionCount:0,blockingCount:0}),'add');
});
test('all four routes surface blocking problems before handoff', () => {
 for (let mode=0;mode<4;mode++) assert.equal(tripRouteAction(mode,{transactionCount:3,blockingCount:1}),'check');
});
test('each ready route leads to its actual existing action', () => {
 assert.deepEqual([0,1,2,3].map(mode=>tripRouteAction(mode,{transactionCount:3,blockingCount:0})),['print','review','export','reconcile']);
});
test('HR route follows real linked credits without treating prepared export as payment', () => {
 const ready={transactionCount:3,blockingCount:0};
 for (const status of ['waiting','partial','review','excess']) assert.equal(tripRouteAction(3,ready,{status}),'credits');
 assert.equal(tripRouteAction(3,ready,{status:'balanced'}),'reconcile');
 assert.equal(tripRouteAction(1,ready,{status:'partial'}),'review');
 assert.equal(tripRouteAction(3,{transactionCount:3,blockingCount:1},{status:'partial'}),'check');
 assert.equal(tripRouteAction(3,{transactionCount:0,blockingCount:0},{status:'partial'}),'add');
});
test('seven languages expose four named choices and live feedback', () => {
 for (const lang of ['it','en','de','fr','es','nl','pt']) {
  const html=tripRouteWorkspaceHtml(lang);
  assert.equal((html.match(/data-trip-route=/g)||[]).length,4);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.ok(html.includes('aria-live="polite"')); assert.ok(!html.includes('undefined'));
 }
});
