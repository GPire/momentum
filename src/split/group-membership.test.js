'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leaveGroup, removeMember, closeGroup, hideLocally, markCreator, isCreator,
  hasLeft, isClosed, activeMembers, visibleGroups,
} from './group-membership.js';
import { createGroup, mergeGroups, mergeIntoGroups, claimMember, addSharedExpense, computeBalances } from './split-engine.js';

const gruppo = () => {
  let g = createGroup({ name: 'Cena', members: ['Io', 'Marco', 'Sara'] });
  g = claimMember(g, 'm0', 'dev-io');
  g = claimMember(g, 'm1', 'dev-marco');
  return markCreator(g, 'dev-io');
};

test('chiunque puo\' uscire da se\' stesso, senza chiedere il permesso', () => {
  const g = leaveGroup(gruppo(), 'dev-marco');
  const marco = g.members.find((m) => m.id === 'm1');
  assert.ok(hasLeft(marco));
  assert.equal(marco.claimedBy, null);
  assert.deepEqual(activeMembers(g).map((m) => m.id), ['m0', 'm2']);
});

test('IL PUNTO CHE RENDE TUTTO REALE: l\'uscita SOPRAVVIVE al sync', () => {
  const originale = gruppo();
  const dopoUscita = leaveGroup(originale, 'dev-marco');
  // Un altro dispositivo ha ancora la lista VECCHIA, con Marco dentro.
  const fuso = mergeGroups(dopoUscita, originale);
  assert.ok(hasLeft(fuso.members.find((m) => m.id === 'm1')),
    'senza lapide Marco tornerebbe al primo sync: un\'assenza perde sempre contro una presenza');
  // E anche nell'ordine opposto: non deve dipendere da chi fonde per primo.
  assert.ok(hasLeft(mergeGroups(originale, dopoUscita).members.find((m) => m.id === 'm1')));
});

test('l\'uscita non riapre lo slot a chiunque', () => {
  const g = leaveGroup(gruppo(), 'dev-marco');
  const riprovo = claimMember(g, 'm1', 'estraneo');
  assert.equal(hasLeft(riprovo.members.find((m) => m.id === 'm1')), true,
    'lo slot si libera, ma resta marcato: nessuno ci rientra pensando di essere quella persona');
});

test('uscire NON cancella la propria storia: i conti degli altri devono tornare', () => {
  let g = addSharedExpense(gruppo(), { payer: 'm1', amount: 90, description: 'Pizza' });
  const saldiPrima = computeBalances(g);
  g = leaveGroup(g, 'dev-marco');
  const saldiDopo = computeBalances(g);
  assert.deepEqual(saldiDopo, saldiPrima,
    'sparire portandosi via i propri debiti non e\' una funzionalita\'');
});

// ── Chi puo' chiudere per tutti ──

test('SOLO il creatore puo\' chiudere il gruppo per tutti', () => {
  const g = gruppo();
  const tentativo = closeGroup(g, 'dev-marco');
  assert.equal(tentativo.ok, false);
  assert.match(tentativo.motivo, /solo chi ha creato/);
  assert.equal(isClosed(tentativo.group), false);

  const vero = closeGroup(g, 'dev-io');
  assert.equal(vero.ok, true);
  assert.equal(isClosed(vero.group), true);
});

test('chiudere un gruppo altrui sarebbe un modo per far sparire i conti a chi ti deve dei soldi', () => {
  let g = addSharedExpense(gruppo(), { payer: 'm0', amount: 100 });
  const r = closeGroup(g, 'dev-marco'); // Marco deve dei soldi e prova a chiudere
  assert.equal(r.ok, false);
  assert.equal(isClosed(r.group), false);
});

test('un gruppo senza creatore registrato (nato prima) non puo\' essere chiuso da nessuno', () => {
  const vecchio = createGroup({ name: 'Vecchio', members: ['A', 'B'] }); // niente createdBy
  const r = closeGroup(vecchio, 'chiunque');
  assert.equal(r.ok, false);
  assert.match(r.motivo, /prima che si registrasse chi lo ha creato/);
  assert.match(r.motivo, /puoi solo uscirne/, 'va sempre offerta la via d\'uscita');
});

test('il creatore non si puo\' rivendicare a posteriori nel merge', () => {
  const mio = markCreator(createGroup({ id: 'g', name: 'X', members: ['A'] }), 'dev-io');
  const impostore = { ...mio, createdBy: 'dev-cattivo' };
  assert.equal(mergeGroups(mio, impostore).createdBy, 'dev-io');
});

test('anche la CHIUSURA sopravvive al sync', () => {
  const g = gruppo();
  const chiuso = closeGroup(g, 'dev-io').group;
  assert.equal(isClosed(mergeGroups(chiuso, g)), true);
  assert.equal(isClosed(mergeGroups(g, chiuso)), true);
});

// ── Rimozione di un altro membro ──

test('il creatore puo\' togliere qualcun altro, e la rimozione regge al sync', () => {
  const g = gruppo();
  const r = removeMember(g, 'm1', 'dev-io');
  assert.equal(r.ok, true);
  assert.ok(hasLeft(mergeGroups(r.group, g).members.find((m) => m.id === 'm1')));
});

test('chi non e\' creatore non puo\' togliere gli altri', () => {
  const r = removeMember(gruppo(), 'm0', 'dev-marco');
  assert.equal(r.ok, false);
  assert.match(r.motivo, /solo chi ha creato/);
});

test('togliere una persona che non c\'e\' non inventa niente', () => {
  const r = removeMember(gruppo(), 'inesistente', 'dev-io');
  assert.equal(r.ok, false);
  assert.match(r.motivo, /non trovata/);
});

// ── Uscita locale, per chi non e' il creatore ──

test('nascondere un gruppo tocca solo QUESTO dispositivo', () => {
  const g = hideLocally(gruppo());
  assert.deepEqual(visibleGroups([g]), []);
  // Il gruppo in se' non e' chiuso: gli altri non se ne accorgono, ed e' giusto.
  assert.equal(isClosed(g), false);
});

test('l\'elenco mostra solo i gruppi vivi e non nascosti', () => {
  const attivo = gruppo();
  const chiuso = closeGroup(gruppo(), 'dev-io').group;
  const nascosto = hideLocally(gruppo());
  assert.deepEqual(visibleGroups([attivo, chiuso, nascosto]).length, 1);
});

test('input mancanti non rompono niente', () => {
  assert.equal(leaveGroup(null, 'x'), null);
  assert.deepEqual(leaveGroup(gruppo(), null).members.filter(hasLeft), []);
  assert.equal(isCreator(null, 'x'), false);
  assert.equal(isCreator(gruppo(), null), false);
  assert.deepEqual(activeMembers(null), []);
  assert.deepEqual(visibleGroups(), []);
});

test('SCENARIO COMPLETO: esco, mi sincronizzo con due dispositivi, resto fuori', () => {
  const originale = gruppo();
  const altroDispositivo = { ...originale };
  const terzoDispositivo = { ...originale };
  let mio = leaveGroup(originale, 'dev-marco');
  // Giro completo di sincronizzazioni, in ordini diversi.
  mio = mergeIntoGroups([mio], altroDispositivo)[0];
  mio = mergeIntoGroups([mio], terzoDispositivo)[0];
  mio = mergeIntoGroups([terzoDispositivo], mio)[0];
  assert.ok(hasLeft(mio.members.find((m) => m.id === 'm1')),
    'dopo tre sync con dispositivi che non sanno dell\'uscita, deve restare uscito');
});

// ── RIAPERTURA DI UN GRUPPO CHIUSO ──
// Prima la chiusura era una porta a senso unico: `closed` vinceva sempre nel
// merge e in tutta l'app non esisteva un modo per riaprire. Il caso vero è
// banalissimo — si chiude dopo aver saldato, il giorno dopo salta fuori una
// spesa dimenticata — e l'unica via era rifare il gruppo da zero.

test('riapertura: un gruppo chiuso torna aperto, e la riapertura vince nel merge', async () => {
  const { closeGroup, reopenGroup, isClosed, mergeClosure } = await import('./group-membership.js');
  const g = { id: 'g1', name: 'Cena', createdBy: 'dev-1', members: [] };
  const chiuso = closeGroup(g, 'dev-1', { now: 1000 }).group;
  assert.equal(isClosed(chiuso), true);

  const riaperto = reopenGroup(chiuso, 'dev-1', { now: 2000 }).group;
  assert.equal(isClosed(riaperto), false);

  // L'altro dispositivo ha ancora la copia chiusa e continua a rimandarla:
  // non deve poter richiudere ciò che è stato riaperto dopo.
  assert.equal(isClosed({ ...riaperto, ...mergeClosure(riaperto, chiuso) }), false);
  assert.equal(isClosed({ ...chiuso, ...mergeClosure(chiuso, riaperto) }), false);
});

test('riapertura: una chiusura SUCCESSIVA alla riapertura richiude davvero', async () => {
  const { closeGroup, reopenGroup, isClosed, mergeClosure } = await import('./group-membership.js');
  const g = { id: 'g1', name: 'Cena', createdBy: 'dev-1', members: [] };
  const riaperto = reopenGroup(closeGroup(g, 'dev-1', { now: 1000 }).group, 'dev-1', { now: 2000 }).group;
  const richiuso = closeGroup(riaperto, 'dev-1', { now: 3000 }).group;
  assert.equal(isClosed(richiuso), true);
  assert.equal(isClosed({ ...richiuso, ...mergeClosure(richiuso, riaperto) }), true);
});

test('riapertura: solo chi ha creato il gruppo può riaprirlo, e mai uno già aperto', async () => {
  const { closeGroup, reopenGroup } = await import('./group-membership.js');
  const g = { id: 'g1', name: 'Cena', createdBy: 'dev-1', members: [] };
  const chiuso = closeGroup(g, 'dev-1', { now: 1000 }).group;

  const daAltro = reopenGroup(chiuso, 'dev-2', { now: 2000 });
  assert.equal(daAltro.ok, false);
  assert.match(daAltro.motivo, /creato/i);

  const giaAperto = reopenGroup(g, 'dev-1', { now: 2000 });
  assert.equal(giaAperto.ok, false);
  assert.match(giaAperto.motivo, /aperto/i);
});

test('riapertura: un gruppo mai chiuso resta com era, mergeClosure non inventa campi', async () => {
  const { mergeClosure } = await import('./group-membership.js');
  assert.deepEqual(mergeClosure({ id: 'g1' }, { id: 'g1' }), {});
});
