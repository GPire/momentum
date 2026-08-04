// Simulazioni degli scenari VERI di perdita e recupero.
//
// I test unitari dicono che le funzioni sono corrette. Questi dicono che la
// giornata storta della persona finisce bene: telefono perso, un foglio buttato
// via, un carattere copiato male, il file di un altro backup, il telefono
// nuovo appena uscito dalla scatola. Ogni scenario parte da uno stato realistico
// (transazioni con catena hash, obiettivi, abbonamenti, correzioni apprese) e
// arriva fino al confronto byte per byte.
//
// Il DISPOSITIVO NUOVO è simulato per davvero: un oggetto stato vergine, senza
// nessuna memoria del precedente — l'unica cosa che passa da un mondo all'altro
// è ciò che la persona ha in mano (il file e i fogli).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryKit, restoreFromShares } from './backup.js';
import { splitSecret, encodeShare, decodeShare, combineShares } from './recovery-shares.js';
import { backupRisk, placementQuality, recordPlacement } from './backup-health.js';

// Uno stato realistico: mesi diversi, catena hash, dati appresi, non un giocattolo.
function vaultRealistico(seed = 1) {
  let h = `GENESI-${seed}`;
  const mese = (chiave, n, base) => Array.from({ length: n }, (_, i) => {
    const tx = {
      id: `${chiave}-${i}`,
      date: `${chiave}-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
      amount: Number((base + i * 3.37).toFixed(2)),
      category: ['Alimentari', 'Trasporti', 'Casa', 'Salute'][i % 4],
      description: `Esercente ${chiave}-${i}`,
      prevHash: h,
    };
    h = `${tx.id}|${tx.amount}|${tx.category}|${tx.prevHash}`;
    tx.hash = h;
    return tx;
  });
  return {
    schemaVersion: 12,
    transactions: { '2026-05': mese('2026-05', 31, 12.5), '2026-06': mese('2026-06', 44, 8.2), '2026-07': mese('2026-07', 29, 21.9) },
    lastHash: h,
    monthlyBudget: 1480,
    subscriptions: [{ id: 's1', name: 'Streaming', amount: 12.99 }],
    achievements: { primoMese: '2026-05-31' },
    mlData: { vocab: { esselunga: { Alimentari: 4 } }, catCounts: { Alimentari: 22 }, totalWords: 26 },
    invoiceProfile: { fiscale: { regime: 'forfettario', ateco: '62.01.00' } },
  };
}

// Il telefono nuovo: nessuna eredità, solo ciò che la persona porta con sé.
function dispositivoNuovo() {
  return { schemaVersion: 12, transactions: {}, lastHash: 'GENESIS', isFirstLaunch: true, monthlyBudget: 1500 };
}

test('SCENARIO — telefono perso: sul dispositivo nuovo torna tutto, catena hash inclusa', async () => {
  const vecchio = vaultRealistico(7);
  const kit = await createRecoveryKit(vecchio, { threshold: 2, total: 3 });

  // Il telefono vecchio smette di esistere: restano solo il file e i fogli.
  const fileSalvatoAltrove = JSON.parse(JSON.stringify(kit.envelope));
  const foglioNellaMail = kit.shares[0].text;
  const foglioDallAmico = kit.shares[1].text;

  const nuovo = dispositivoNuovo();
  assert.equal(Object.keys(nuovo.transactions).length, 0, 'il dispositivo nuovo deve partire vuoto');

  const recuperato = await restoreFromShares(fileSalvatoAltrove, [foglioNellaMail, foglioDallAmico]);
  const statoFinale = { ...nuovo, ...recuperato };

  assert.deepEqual(statoFinale.transactions, vecchio.transactions);
  assert.equal(statoFinale.lastHash, vecchio.lastHash, 'la catena hash deve arrivare identica');
  assert.equal(Object.values(statoFinale.transactions).flat().length, 104);
  assert.deepEqual(statoFinale.invoiceProfile, vecchio.invoiceProfile, 'anche i dati fiscali tornano');
  assert.deepEqual(statoFinale.mlData, vecchio.mlData, 'anche ciò che l\'AI aveva imparato torna');
  assert.equal(statoFinale.isFirstLaunch, true, 'i campi non presenti nel backup restano quelli del dispositivo nuovo');
});

test('SCENARIO — un foglio è andato perso: gli altri due bastano davvero', async () => {
  const vecchio = vaultRealistico(3);
  const kit = await createRecoveryKit(vecchio, { threshold: 2, total: 3 });
  // Ogni possibile foglio perso, uno alla volta: nessuna combinazione fortunata.
  for (let perso = 0; perso < 3; perso++) {
    const rimasti = kit.shares.filter((_, i) => i !== perso).map((s) => s.text);
    const r = await restoreFromShares(kit.envelope, rimasti);
    assert.deepEqual(r.transactions, vecchio.transactions, `perdendo il foglio ${perso + 1} il recupero deve riuscire`);
  }
});

test('SCENARIO — due fogli su tre persi: non si recupera, e lo dice senza girarci intorno', async () => {
  const kit = await createRecoveryKit(vaultRealistico(5), { threshold: 2, total: 3 });
  await assert.rejects(() => restoreFromShares(kit.envelope, [kit.shares[2].text]), /Servono 2 pezzi/);
});

test('SCENARIO — un carattere copiato male: errore che dice quale foglio, poi si corregge e funziona', async () => {
  const vecchio = vaultRealistico(11);
  const kit = await createRecoveryKit(vecchio, { threshold: 2, total: 3 });
  const buono = kit.shares[0].text;
  const daCorreggere = kit.shares[1].text;
  const i = daCorreggere.length - 5;
  const storto = daCorreggere.slice(0, i) + (daCorreggere[i] === 'Z' ? 'Y' : 'Z') + daCorreggere.slice(i + 1);

  await assert.rejects(() => restoreFromShares(kit.envelope, [buono, storto]), /pezzo numero 2|non è valido/);
  // La persona ricontrolla e ricopia bene: deve andare, senza aver perso niente.
  const r = await restoreFromShares(kit.envelope, [buono, daCorreggere]);
  assert.deepEqual(r.transactions, vecchio.transactions);
});

test('SCENARIO — fogli copiati a mano storti (minuscole, spazi, testo intorno): funzionano lo stesso', async () => {
  const vecchio = vaultRealistico(13);
  const kit = await createRecoveryKit(vecchio, { threshold: 2, total: 3 });
  const sporca = (t, n) => `Foglio ${n} — Momentum\n  ${t.toLowerCase().replace(/-/g, ' ')}  \ngrazie!`;
  const r = await restoreFromShares(kit.envelope, [sporca(kit.shares[0].text, 1), sporca(kit.shares[2].text, 3)]);
  assert.deepEqual(r.transactions, vecchio.transactions);
});

test('SCENARIO — file di un backup vecchio con i fogli di quello nuovo: rifiutato, mai un mezzo ripristino', async () => {
  const kitVecchio = await createRecoveryKit(vaultRealistico(1), { threshold: 2, total: 3 });
  const kitNuovo = await createRecoveryKit(vaultRealistico(2), { threshold: 2, total: 3 });
  await assert.rejects(
    () => restoreFromShares(kitVecchio.envelope, [kitNuovo.shares[0].text, kitNuovo.shares[1].text]),
    /backup diversi|non aprono questo backup/
  );
});

test('SCENARIO — il file è stato danneggiato (mail che tronca, disco che sbaglia): rifiutato, non importato a metà', async () => {
  const kit = await createRecoveryKit(vaultRealistico(17), { threshold: 2, total: 3 });
  const rovinato = { ...kit.envelope, data: kit.envelope.data.slice(0, -8) + 'BBBBBBBB' };
  await assert.rejects(
    () => restoreFromShares(rovinato, [kit.shares[0].text, kit.shares[1].text]),
    /non aprono questo backup/
  );
});

test('SCENARIO — foglio unico per scelta: funziona da solo, e chi lo perde perde tutto', async () => {
  const vecchio = vaultRealistico(19);
  const kit = await createRecoveryKit(vecchio, { threshold: 1, total: 1 });
  assert.equal(kit.shares.length, 1);
  const r = await restoreFromShares(kit.envelope, [kit.shares[0].text]);
  assert.deepEqual(r.transactions, vecchio.transactions, 'con il foglio unico si rientra');
  // Senza quel foglio non esiste nessun\'altra strada: è il compromesso dichiarato.
  await assert.rejects(() => restoreFromShares(kit.envelope, []), /Non hai inserito nessun foglio|Servono 1/);
});

test('SCENARIO — lavoro fatto DOPO la copia: torna lo stato della copia, e il pannello lo aveva già detto', async () => {
  const alMomentoDellaCopia = vaultRealistico(23);
  const kit = await createRecoveryKit(alMomentoDellaCopia, { threshold: 2, total: 3 });

  // La persona continua a usare l'app per settimane senza rifare la copia.
  const dopo = JSON.parse(JSON.stringify(alMomentoDellaCopia));
  dopo.backupHealth = { lastProtectedAt: '2026-07-31T23:59:00.000Z' };
  dopo.transactions['2026-08'] = Array.from({ length: 45 }, (_, i) => ({
    id: `nuovo-${i}`, date: `2026-08-0${(i % 9) + 1}T09:00:00.000Z`, amount: 10 + i, category: 'Casa',
  }));

  const avviso = backupRisk(dopo, { now: new Date('2026-08-04T12:00:00Z') });
  assert.equal(avviso.level, 'urgente', 'con 45 movimenti scoperti l\'avviso doveva essere già scattato');
  assert.match(avviso.headline, /45/, 'l\'avviso deve dire il numero vero, non una frase generica');

  const recuperato = await restoreFromShares(kit.envelope, [kit.shares[0].text, kit.shares[1].text]);
  assert.ok(!recuperato.transactions['2026-08'], 'il lavoro non protetto non può tornare dal nulla');
  assert.deepEqual(recuperato.transactions, alMomentoDellaCopia.transactions);
});

test('SCENARIO — custodia: la persona mette tutto nello stesso posto e l app non finge che vada bene', () => {
  let kit = { threshold: 2, total: 3, placements: [] };
  kit = recordPlacement(kit, 1, 'questoDispositivo', { now: new Date() });
  kit = recordPlacement(kit, 2, 'questoDispositivo', { now: new Date() });
  kit = recordPlacement(kit, 3, 'questoDispositivo', { now: new Date() });
  assert.equal(placementQuality(kit).ok, false, 'tre fogli sullo stesso telefono non sono una protezione');

  // Poi ne sposta uno davvero fuori: da lì in avanti è protetta sul serio.
  kit = recordPlacement(kit, 2, 'mail', { now: new Date() });
  kit = recordPlacement(kit, 3, 'personaFidata', { now: new Date() });
  const q = placementQuality(kit);
  assert.equal(q.ok, true);
  assert.equal(q.postiDistinti, 2);
});

// Prova a forza bruta su molti kit diversi: nessuna combinazione fortunata,
// nessun caso in cui due fogli qualsiasi NON aprono il backup.
test('SCENARIO — 40 kit diversi, ogni coppia di fogli deve aprire: nessuna eccezione', async () => {
  for (let n = 0; n < 40; n++) {
    const stato = vaultRealistico(n);
    const kit = await createRecoveryKit(stato, { threshold: 2, total: 3 });
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
      const r = await restoreFromShares(kit.envelope, [kit.shares[a].text, kit.shares[b].text]);
      assert.equal(r.lastHash, stato.lastHash, `kit ${n}, fogli ${a + 1}+${b + 1}`);
    }
  }
});

// Il giro completo carta-e-penna: chi trascrive un foglio a mano e lo ribatte
// su un altro telefono deve tornare esattamente al punto di partenza.
test('SCENARIO — trascrizione a mano e ribattitura su un altro dispositivo', () => {
  const segreto = Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + 5) & 0xff);
  const fogli = splitSecret(segreto, { threshold: 2, total: 3 });
  const scrittiAMano = fogli.map((f) => encodeShare(f).replace(/-/g, ' ').toLowerCase());
  const riletti = [scrittiAMano[0], scrittiAMano[2]].map(decodeShare);
  assert.deepEqual(Array.from(combineShares(riletti)), Array.from(segreto));
});
