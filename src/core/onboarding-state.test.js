// Copre OGNI scenario d'avvio possibile, perché questa funzione decide la
// prima schermata che una persona vede: sbagliarla significa o far rivedere
// l'onboarding a chi usa l'app da mesi, o chiudere fuori chi non l'ha mai
// finito. Scritta prima di un rilascio al pubblico, dove un errore qui non si
// corregge con una patch veloce: gli utenti se lo trovano addosso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { haCompletatoOnboarding } from './onboarding-state.js';

test('utente nuovo assoluto (nessuno stato) → onboarding', () => {
  assert.equal(haCompletatoOnboarding(null), false);
  assert.equal(haCompletatoOnboarding(undefined), false);
  assert.equal(haCompletatoOnboarding({}), false);
});

test('IL BUG: ha aperto l\'app ma NON ha finito le domande → deve rivedere l\'onboarding', () => {
  // È lo stato che VaultDAO salva da solo al primissimo avvio: la chiave
  // esiste, ma non è stato completato niente. Col vecchio controllo
  // ("esiste omega_core_db?") questa persona restava chiusa fuori per sempre.
  const appenaAperta = { isFirstLaunch: true, transactions: {}, monthlyBudget: 1500 };
  assert.equal(haCompletatoOnboarding(appenaAperta), false);
});

test('ha completato l\'onboarding → dashboard, mai più la hero', () => {
  assert.equal(haCompletatoOnboarding({ isFirstLaunch: false, transactions: {} }), true);
});

test('attivazione "lampo" da invito → conta come completato', () => {
  // activateLite() passa da seedProfileState, che scrive isFirstLaunch:false
  // e onboardingProfile: chi entra da un link di divisione spese non deve
  // ritrovarsi l'onboarding al riavvio.
  const lite = { isFirstLaunch: false, activatedLite: true, onboardingProfile: { riskProfile: 'bilanciato' } };
  assert.equal(haCompletatoOnboarding(lite), true);
});

test('USO SOLO-SPLIT: chi è entrato da un link di gruppo spesa non rivede l\'onboarding al riavvio', () => {
  // Scenario reale e frequente: qualcuno condivide il link di un gruppo
  // spesa, chi lo riceve non ha mai visto Momentum e lo usa SOLO per dividere
  // il conto. activateLite() lo attiva con default sensati saltando le
  // domande — ma passa comunque da seedProfileState, quindi il flag c'è.
  // Al secondo avvio deve trovarsi i suoi gruppi, non la schermata di
  // benvenuto di un'app che ormai sta già usando.
  const soloSplit = {
    isFirstLaunch: false,
    activatedLite: true,
    onboardingProfile: { riskProfile: 'bilanciato', horizon: 'medio' },
    transactions: {},
    splitGroups: [{ id: 'g1', name: 'Cena', members: [], expenses: [] }],
  };
  assert.equal(haCompletatoOnboarding(soloSplit), true);
});

test('percorso minorenne → conta come completato', () => {
  const minore = { isFirstLaunch: false, onboardingProfile: { isMinor: true, ageBracket: 'under18' } };
  assert.equal(haCompletatoOnboarding(minore), true);
});

// ── Stati storici: chi usa l'app da prima che il campo esistesse ──

test('stato vecchio SENZA isFirstLaunch ma con transazioni → dashboard (mai rimandarlo all\'onboarding)', () => {
  const vecchio = { transactions: { '2026-05': [{ id: 1, amount: 10 }] }, monthlyBudget: 1200 };
  assert.equal(haCompletatoOnboarding(vecchio), true);
});

test('stato vecchio SENZA isFirstLaunch ma con onboardingProfile → dashboard', () => {
  assert.equal(haCompletatoOnboarding({ onboardingProfile: { riskProfile: 'conservativo' } }), true);
});

test('isFirstLaunch:true ma con transazioni reali → dashboard (i dati veri battono il flag)', () => {
  // Caso possibile dopo un ripristino parziale o una migrazione andata a
  // metà: se ci sono soldi registrati, quella persona non è nuova.
  const incoerente = { isFirstLaunch: true, transactions: { '2026-07': [{ id: 9, amount: 30 }] } };
  assert.equal(haCompletatoOnboarding(incoerente), true);
});

// ── Robustezza: mai un'eccezione al boot, qualunque cosa ci sia in memoria ──

test('stato corrotto o di tipo inatteso → onboarding, mai un\'eccezione', () => {
  for (const sporco of ['stringa', 42, [], true, { transactions: 'non-un-oggetto' }, { transactions: null }]) {
    assert.doesNotThrow(() => haCompletatoOnboarding(sporco));
  }
  assert.equal(haCompletatoOnboarding({ transactions: 'non-un-oggetto' }), false);
  assert.equal(haCompletatoOnboarding({ transactions: null }), false);
});

// ── La copia inline in index.html non deve divergere ──

test('lo script inline di index.html controlla gli STESSI tre segnali di questo modulo', () => {
  // La hero non deve essere dipinta nemmeno per un istante a chi è già
  // dentro, e per farlo serve una decisione PRIMA che il bundle sia
  // scaricato: quella logica vive per forza inline in index.html. Due copie
  // della stessa regola divergono sempre, prima o poi — questo test le tiene
  // legate: se qualcuno cambia il modulo e dimentica l'inline (o viceversa),
  // qui si accorge subito.
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const inizio = html.indexOf('gia-onboardato');
  assert.ok(inizio > -1, 'lo script inline che marca "gia-onboardato" è sparito da index.html');
  const blocco = html.slice(Math.max(0, inizio - 1500), inizio + 500);
  assert.match(blocco, /isFirstLaunch\s*===\s*false/, 'l\'inline non controlla più isFirstLaunch === false');
  assert.match(blocco, /onboardingProfile/, 'l\'inline non controlla più onboardingProfile');
  assert.match(blocco, /transactions/, 'l\'inline non controlla più le transazioni');
});
