// ============================================================
// GARANZIA RILEVANZA — il riordino non può fare danni
// ============================================================
// Un algoritmo che riordina l'interfaccia sotto le mani di chi la sta usando
// è potenzialmente la cosa più dannosa di tutto il progetto: sbagliare un
// numero si vede e si corregge, spostare le card ogni volta rende l'app
// inutilizzabile e nessuno sa dire perché. Questi test sono i paletti.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rilevanzaDashboard, ordineCss, motivoPromozione,
  ORDINE_BASE, SOGLIA_SPOSTAMENTO, ZONA_FISSA,
} from './rilevanza-card.js';

const ids = Object.keys(ORDINE_BASE);

// ── 1. Senza segnali, l'app resta esattamente com'è ──
test('RILEVANZA: stato vuoto → ordine identico a quello disegnato in index.html', () => {
  const r = rilevanzaDashboard({}, {});
  assert.deepEqual(r.map(v => v.id), ids, 'senza segnali il riordino deve essere invisibile');
  assert.ok(r.every(v => !v.promossa), 'nessuna promozione senza motivo');
});

test('RILEVANZA: uno stato realistico ma tranquillo non muove niente', () => {
  const stato = {
    investmentPrefs: { invests: true, incomeRegularity: 'regolare', cashflowStress: 'ok' },
    savingsGoals: [{ id: 'g1', target: 1000 }],
    positions: [{ id: 'p1' }],
  };
  const r = rilevanzaDashboard(stato, { mesiCuscinetto: 6, giorniAlPayday: 12, sospesoSplit: 0, variazionePortafoglioPct: 0.4 });
  assert.deepEqual(r.map(v => v.id), ids);
});

// ── 2. La zona fissa è intoccabile ──
test('RILEVANZA: "quanto posso spendere" non si sposta mai, per nessun segnale', () => {
  // Tutti i segnali al massimo contemporaneamente: lo scenario peggiore.
  const stato = {
    investmentPrefs: { invests: true, incomeRegularity: 'irregolare', cashflowStress: 'corto' },
    savingsGoals: [{ id: 'g1' }],
    positions: [{ id: 'p1' }],
  };
  const ctx = {
    mesiCuscinetto: 0, giorniAlPayday: 20, sospesoSplit: 900, giorniSospeso: 60,
    obiettivoARischio: true, variazionePortafoglioPct: -9, haInsight: true, haNudge: true,
  };
  const r = rilevanzaDashboard(stato, ctx);
  for (const id of ZONA_FISSA) {
    const v = r.find(x => x.id === id);
    assert.equal(v.punti, 0, `${id} non deve poter guadagnare punti`);
    assert.equal(v.promossa, false, `${id} non deve mai essere promossa`);
  }
  // E restano davanti a tutto ciò che non è stato promosso.
  const posFissa = Math.max(...[...ZONA_FISSA].map(id => r.find(x => x.id === id).posizione));
  const nonPromosse = r.filter(v => !v.promossa && !ZONA_FISSA.has(v.id));
  for (const v of nonPromosse) {
    assert.ok(v.posizione > posFissa, `${v.id} non promossa non può superare la zona fissa`);
  }
});

// ── 3. Niente balletto: determinismo e stabilità ──
test('RILEVANZA: stesso input → stesso ordine, mille volte', () => {
  const stato = { investmentPrefs: { cashflowStress: 'corto' }, savingsGoals: [{ id: 'g' }] };
  const ctx = { mesiCuscinetto: 1.2, sospesoSplit: 40, giorniSospeso: 5, haInsight: true };
  const atteso = rilevanzaDashboard(stato, ctx).map(v => v.id);
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(rilevanzaDashboard(stato, ctx).map(v => v.id), atteso);
  }
});

test('RILEVANZA: un segnale debole non sposta niente (soglia)', () => {
  // Cuscinetto a 2,9 mesi: tecnicamente sotto i 3, ma di pochissimo.
  const r = rilevanzaDashboard({}, { mesiCuscinetto: 2.9 });
  const jar = r.find(v => v.id === 'jar-card');
  assert.ok(jar.punti > 0, 'il segnale esiste');
  assert.ok(jar.punti < SOGLIA_SPOSTAMENTO, 'ma è debole');
  assert.equal(jar.promossa, false);
  assert.deepEqual(r.map(v => v.id), ids, 'e quindi non muove l’interfaccia');
});

test('RILEVANZA: una variazione minima del dato non fa saltare la card avanti e indietro', () => {
  // Il caso che rende un’app inguardabile: un valore che oscilla attorno alla
  // soglia. Con l’annullamento sotto soglia, l’ordine cambia una volta sola.
  const ordini = [2.99, 3.01, 2.98, 3.02, 2.995].map(m =>
    rilevanzaDashboard({}, { mesiCuscinetto: m }).map(v => v.id).join(','));
  assert.equal(new Set(ordini).size, 1, 'oscillare attorno a 3 mesi non deve riordinare la Dashboard');
});

// ── 4. I fatti battono le dichiarazioni ──
test('RILEVANZA: il cuscinetto vero ha la meglio sulla risposta data in onboarding', () => {
  // Aveva dichiarato "liquidità corta", ma nel frattempo il cuscinetto se l’è
  // costruito. È esattamente il caso che il flag booleano sbagliava per sempre.
  const stato = { investmentPrefs: { cashflowStress: 'corto' } };
  const r = rilevanzaDashboard(stato, { mesiCuscinetto: 8 });
  const jar = r.find(v => v.id === 'jar-card');
  assert.equal(jar.punti, 0, 'con 8 mesi di cuscinetto la card non deve essere promossa');
  assert.deepEqual(r.map(v => v.id), ids);
});

test('RILEVANZA: senza dato reale vale la dichiarazione, ma meno', () => {
  const dichiarato = rilevanzaDashboard({ investmentPrefs: { cashflowStress: 'corto' } }, {});
  const reale = rilevanzaDashboard({}, { mesiCuscinetto: 0 });
  const pDich = dichiarato.find(v => v.id === 'jar-card').punti;
  const pReale = reale.find(v => v.id === 'jar-card').punti;
  assert.ok(pDich > SOGLIA_SPOSTAMENTO, 'la dichiarazione conta');
  assert.ok(pReale > pDich, 'ma il fatto conta di più');
});

// ── 5. Ogni promozione ha un motivo dicibile ──
test('RILEVANZA: nessuna card sale senza una spiegazione in parole', () => {
  const stato = { investmentPrefs: { incomeRegularity: 'irregolare' }, savingsGoals: [{ id: 'g' }] };
  const ctx = { mesiCuscinetto: 0.5, giorniAlPayday: 3, sospesoSplit: 120, giorniSospeso: 30, obiettivoARischio: true };
  for (const v of rilevanzaDashboard(stato, ctx)) {
    if (!v.promossa) continue;
    assert.equal(typeof v.motivo, 'string');
    assert.ok(v.motivo.length > 5, `motivo troppo vago per ${v.id}: "${v.motivo}"`);
    assert.notEqual(v.motivo, 'ordine predefinito', `${v.id} promossa senza motivo specifico`);
  }
  const m = motivoPromozione(stato, ctx);
  assert.ok(m && m.id && m.motivo, 'la card in cima deve saper dire perché ci sta');
});

test('RILEVANZA: senza promozioni non si inventa una spiegazione', () => {
  assert.equal(motivoPromozione({}, {}), null);
});

// ── 6. I tre flag che erano rimasti scollegati, ora collegati qui ──
// Questo test è nato aspettandosi che le entrate irregolari alzassero
// #ghost-forecast, ed è FALLITO: quella card sta in zona fissa, cioè è già la
// seconda cosa che si vede, per tutti. `previsioneCassaInPrimoPiano` chiedeva
// di promuovere qualcosa di già promosso. Il bisogno vero è finito dove conta.
test('RILEVANZA: la previsione di cassa non si promuove, è già in cima per tutti', () => {
  const irr = rilevanzaDashboard({ investmentPrefs: { incomeRegularity: 'irregolare' } }, { giorniAlPayday: 3 });
  assert.equal(irr.find(v => v.id === 'ghost-forecast').punti, 0);
  assert.ok(ZONA_FISSA.has('ghost-forecast'), 'se un giorno esce dalla zona fissa, questo ragionamento va rifatto');
});

test('RILEVANZA: con entrate irregolari lo stesso cuscinetto pesa di più', () => {
  // Tre mesi da dipendente sono tranquillità, tre mesi da freelance sono tre
  // mesi e forse basta: il prossimo incasso non è una certezza.
  const p = (reg, mesi) => rilevanzaDashboard({ investmentPrefs: { incomeRegularity: reg } }, { mesiCuscinetto: mesi })
    .find(v => v.id === 'jar-card').punti;
  assert.ok(p('irregolare', 1.5) > p('regolare', 1.5), 'a parità di mesi, l’irregolarità pesa');
  assert.equal(p('irregolare', 6), 0, 'ma con un cuscinetto solido non promuove comunque niente');
  // Senza nessun dato reale, l’irregolarità da sola basta a farlo notare.
  const soloIrr = rilevanzaDashboard({ investmentPrefs: { incomeRegularity: 'irregolare' } }, {})
    .find(v => v.id === 'jar-card');
  assert.ok(soloIrr.punti >= SOGLIA_SPOSTAMENTO, 'chi ha entrate irregolari deve almeno vedere il cuscinetto');
});

test('RILEVANZA: i soldi fermi in un gruppo salgono con l’importo E con l’attesa (riepilogoGruppi)', () => {
  const p = (sospeso, giorni) => rilevanzaDashboard({}, { sospesoSplit: sospeso, giorniSospeso: giorni })
    .find(v => v.id === 'split-reminder').punti;
  assert.equal(p(0, 0), 0, 'niente in sospeso, niente promemoria');
  assert.ok(p(200, 1) > p(10, 1), 'più soldi, più urgenza');
  assert.ok(p(50, 30) > p(50, 1), 'più tempo, più urgenza');
  assert.ok(p(1e9, 9999) <= 85, 'ma con un tetto: nessun segnale può monopolizzare la schermata');
});

test('RILEVANZA: il mercato sale solo quando si muove il TUO portafoglio', () => {
  const conPos = { positions: [{ id: 'p' }] };
  assert.equal(rilevanzaDashboard(conPos, { variazionePortafoglioPct: 0.5 }).find(v => v.id === 'veglia-mercato').punti, 0);
  assert.ok(rilevanzaDashboard(conPos, { variazionePortafoglioPct: -6 }).find(v => v.id === 'veglia-mercato').punti > 0);
  // Chi non investe non vede mai il mercato salire, qualunque cosa succeda.
  const nonInveste = { investmentPrefs: { invests: false }, positions: [{ id: 'p' }] };
  assert.equal(rilevanzaDashboard(nonInveste, { variazionePortafoglioPct: -20 }).find(v => v.id === 'veglia-mercato').punti, 0);
  // E chi non ha posizioni nemmeno.
  assert.equal(rilevanzaDashboard({}, { variazionePortafoglioPct: -20 }).find(v => v.id === 'veglia-mercato').punti, 0);
});

// ── 7. Robustezza: niente NaN, niente id inventati, niente esplosioni ──
test('RILEVANZA: input sporchi non producono mai NaN o ordini rotti', () => {
  const sporchi = [
    {}, null, undefined,
    { mesiCuscinetto: NaN, giorniAlPayday: NaN, sospesoSplit: NaN, giorniSospeso: NaN },
    { mesiCuscinetto: Infinity, sospesoSplit: -Infinity, variazionePortafoglioPct: NaN },
    { mesiCuscinetto: -5, sospesoSplit: -100, giorniSospeso: -30 },
    { giorniAllaScadenzaObiettivo: NaN },
  ];
  for (const ctx of sporchi) {
    const r = rilevanzaDashboard({ savingsGoals: [{ id: 'g' }], positions: [{ id: 'p' }] }, ctx || {});
    assert.equal(r.length, ids.length, `contesto ${JSON.stringify(ctx)}`);
    assert.deepEqual([...r.map(v => v.id)].sort(), [...ids].sort(), 'nessun id perso o inventato');
    for (const v of r) {
      assert.ok(Number.isFinite(v.punti), `punti non finiti su ${v.id} con ${JSON.stringify(ctx)}`);
      assert.ok(v.punti >= 0, `punti negativi su ${v.id}`);
      assert.ok(Number.isInteger(v.posizione) && v.posizione >= 1);
    }
  }
});

test('RILEVANZA: stato completamente assente non fa esplodere niente', () => {
  assert.equal(rilevanzaDashboard().length, ids.length);
  assert.equal(Object.keys(ordineCss()).length, ids.length);
});

test('RILEVANZA: le posizioni sono un permutazione esatta, mai due card allo stesso posto', () => {
  const stato = { investmentPrefs: { incomeRegularity: 'irregolare', cashflowStress: 'corto' }, savingsGoals: [{ id: 'g' }], positions: [{ id: 'p' }] };
  const ctx = { mesiCuscinetto: 0, sospesoSplit: 300, giorniSospeso: 40, obiettivoARischio: true, haInsight: true, haNudge: true, variazionePortafoglioPct: -8 };
  const pos = rilevanzaDashboard(stato, ctx).map(v => v.posizione).sort((a, b) => a - b);
  assert.deepEqual(pos, ids.map((_, i) => i + 1));
  const css = ordineCss(stato, ctx);
  assert.equal(new Set(Object.values(css)).size, ids.length, 'due card non possono avere lo stesso order');
});

// ── 8. Scenari da persona vera ──
test('RILEVANZA scenario: freelance a fine ciclo, senza rete → cassa e cuscinetto in cima', () => {
  const stato = { investmentPrefs: { incomeRegularity: 'irregolare', cashflowStress: 'corto', invests: true } };
  const r = rilevanzaDashboard(stato, { mesiCuscinetto: 0.3, giorniAlPayday: 2, sospesoSplit: 0 });
  const primi = r.slice(0, 4).map(v => v.id);
  assert.ok(primi.includes('jar-card'), `cuscinetto non in cima: ${primi}`);
  assert.ok(primi.includes('ghost-forecast'), `previsione di cassa non in cima: ${primi}`);
});

test('RILEVANZA scenario: minorenne con un obiettivo → niente mercato, niente fisco davanti', () => {
  const stato = {
    onboardingProfile: { isMinor: true, ageBracket: 'under18' },
    investmentPrefs: { invests: false },
    savingsGoals: [{ id: 'bici', target: 300 }],
  };
  const r = rilevanzaDashboard(stato, { obiettivoARischio: true, mesiCuscinetto: null });
  assert.equal(r.find(v => v.id === 'veglia-mercato').punti, 0);
  assert.equal(r.find(v => v.id === 'tax-discover-card').punti, 0);
  assert.ok(r.find(v => v.id === 'savings-goals-card-dash').promossa, 'l’obiettivo a rischio deve salire');
});

test('RILEVANZA scenario: chi ha tutto a posto vede la Dashboard di sempre', () => {
  const stato = {
    investmentPrefs: { invests: true, incomeRegularity: 'regolare', cashflowStress: 'ok' },
    savingsGoals: [{ id: 'g' }], positions: [{ id: 'p' }],
  };
  const r = rilevanzaDashboard(stato, {
    mesiCuscinetto: 9, giorniAlPayday: 15, sospesoSplit: 0, giorniSospeso: 0,
    obiettivoARischio: false, giorniAllaScadenzaObiettivo: 200,
    variazionePortafoglioPct: 0.8, haInsight: false, haNudge: false,
  });
  assert.deepEqual(r.map(v => v.id), ids, 'nessun problema, nessun riordino: la stabilità è il default');
});
