// ============================================================
// BANCO DI PROVA DELLA SINCRONIZZAZIONE — numeri MISURATI, non promessi
// ============================================================
// Il piano (T3) chiede esplicitamente di misurare i byte scambiati PRIMA e
// DOPO l'IBLT su stati da 100/1.000/10.000 transazioni, invece di
// affermare che "si risparmia". Questo banco lo fa, e stampa anche i casi
// in cui l'IBLT NON conviene — un banco che dà sempre ragione a chi lo ha
// scritto non serve a niente.
//
// Scenario simulato: due dispositivi dello stesso utente (telefono e
// portatile) che hanno quasi tutto in comune e differiscono di poche
// transazioni — la situazione REALE e più frequente: hai aggiunto tre
// spese sul telefono e apri il portatile.
//
// Si misura anche la sincronizzazione a PRIORITÀ SEMANTICA: quanto valore
// arriva se la connessione cade dopo pochi elementi.
'use strict';

import { buildSketch, serializeCells, recommendedSize, reconcile } from '../src/mesh/iblt.js';
import { computeSyncDigest } from '../src/mesh/sync.js';
import { flattenRankedForSync } from '../src/mesh/sync-priority.js';

const NOW = Date.UTC(2026, 7, 6);
const bytes = (o) => Buffer.byteLength(JSON.stringify(o), 'utf8');
const fmt = (n) => n.toLocaleString('it-IT');

// Costruisce uno storico plausibile: transazioni sparse su ~3 anni.
function makeTx(n, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const byMonth = {};
  for (let i = 0; i < n; i++) {
    const giorniIndietro = Math.floor(rnd() * 1000);
    const d = new Date(NOW - giorniIndietro * 86400000);
    const k = d.toISOString().slice(0, 7);
    (byMonth[k] = byMonth[k] || []).push({
      id: `tx-${i}`,
      date: d.toISOString().slice(0, 10),
      amount: +(rnd() * 200).toFixed(2),
      description: 'Spesa',
    });
  }
  return byMonth;
}

const flat = (byMonth) => Object.values(byMonth).flat();

console.log('\n=== SINCRONIZZAZIONE MESH: byte scambiati, misurati ===\n');
console.log('Scenario: due dispositivi tuoi, quasi allineati, con poche differenze.\n');

const DIFFERENZE = 3;
const risultati = [];

for (const n of [100, 1000, 10000]) {
  const mie = makeTx(n, 42);
  const idsMiei = flat(mie).map((t) => t.id);
  // Il peer ha tutto tranne le ultime N transazioni
  const idsPeer = idsMiei.slice(0, idsMiei.length - DIFFERENZE);

  // ── Metodo attuale: si manda il digest, che elenca OGNI id posseduto ──
  const digest = computeSyncDigest(mie);
  const byteDigest = bytes(digest);

  // ── Metodo IBLT: si manda uno sketch dimensionato sulla DIFFERENZA ──
  const m = recommendedSize(DIFFERENZE);
  const mioSketch = buildSketch(idsMiei, { m });
  const byteSketch = bytes(serializeCells(mioSketch));

  // Verifica che la riconciliazione funzioni davvero, non solo che sia piccola
  const peerSketch = buildSketch(idsPeer, { m });
  // `peerIsMissing` sono GIÀ gli id da mandare: li conosco perché sono miei.
  // (`iAmMissingKeys` resta in forma di chiave: di quelli ho solo l'impronta,
  // non l'id — è l'altro lato a doverli risolvere.)
  const rec = reconcile(mioSketch, serializeCells(peerSketch));
  const trovati = rec.success ? rec.peerIsMissing.length : 0;

  const rapporto = byteDigest / byteSketch;
  risultati.push({ n, byteDigest, byteSketch, rapporto, ok: rec.success, trovati });

  console.log(`${fmt(n)} transazioni, ${DIFFERENZE} differenze`);
  console.log(`  digest attuale : ${fmt(byteDigest)} byte`);
  console.log(`  sketch IBLT    : ${fmt(byteSketch)} byte  (${m} celle)`);
  console.log(`  riconciliato   : ${rec.success ? `sì, ${trovati}/${DIFFERENZE} differenze trovate` : 'NO (sketch troppo piccolo)'}`);
  console.log(`  risparmio      : ${rapporto >= 1 ? `${rapporto.toFixed(1)}× meno byte` : `NESSUNO (${(1 / rapporto).toFixed(1)}× PIÙ byte)`}\n`);
}

// ── Il caso onesto in cui l'IBLT NON conviene ──
console.log('--- Quando l\'IBLT NON conviene (dichiarato, non nascosto) ---\n');
{
  const n = 100;
  const differenzeGrandi = 80; // dispositivo quasi vuoto: quasi tutto è diverso
  const mie = makeTx(n, 7);
  const idsMiei = flat(mie).map((t) => t.id);
  const byteDigest = bytes(computeSyncDigest(mie));
  const m = recommendedSize(differenzeGrandi);
  const byteSketch = bytes(serializeCells(buildSketch(idsMiei, { m })));
  console.log(`${fmt(n)} transazioni, ${differenzeGrandi} differenze (primo collegamento di un device nuovo)`);
  console.log(`  digest attuale : ${fmt(byteDigest)} byte`);
  console.log(`  sketch IBLT    : ${fmt(byteSketch)} byte`);
  console.log(`  ${byteSketch < byteDigest ? 'conviene comunque' : 'NON conviene: meglio il digest classico'}\n`);
}

// ── Priorità semantica: quanto valore arriva se la connessione cade ──
console.log('--- Priorità semantica: connessione che cade dopo 10 elementi ---\n');
{
  // Scenario realistico e DISCRIMINANTE: uno storico che contiene sia il
  // passato sia impegni GIÀ PROGRAMMATI nel futuro (rate, abbonamenti,
  // bollette). L'ordine cronologico "dal più recente" mette in cima la rata
  // fra sei mesi; la priorità semantica mette in cima ciò che sposta il
  // numero guardato ADESSO.
  const mie = {};
  let i = 0;
  const push = (giorniDaOggi, amount) => {
    const d = new Date(NOW + giorniDaOggi * 86400000);
    const k = d.toISOString().slice(0, 7);
    (mie[k] = mie[k] || []).push({ id: `t-${i++}`, date: d.toISOString().slice(0, 10), amount, description: 'Movimento' });
  };
  for (let g = 20; g <= 200; g += 10) push(g, 60);    // impegni futuri lontani
  for (let g = -5; g <= 5; g++) push(g, 45);          // la settimana intorno a oggi
  for (let g = 300; g <= 900; g += 30) push(-g, 120); // passato remoto

  const ordinate = flattenRankedForSync(mie, { now: NOW });
  const cronologiche = flat(mie).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const entro7gg = (arr) => arr.filter((t) => Math.abs(new Date(t.date).getTime() - NOW) <= 7 * 86400000).length;
  console.log(`  con priorità semantica : ${entro7gg(ordinate.slice(0, 10))}/10 movimenti entro 7 giorni da oggi`);
  console.log(`  con ordine cronologico : ${entro7gg(cronologiche.slice(0, 10))}/10`);
  console.log('  (più alto = più valore consegnato prima che la connessione cada)\n');
}

const vincenti = risultati.filter((r) => r.rapporto > 1 && r.ok).length;
console.log(`=== Esito: IBLT conviene in ${vincenti}/${risultati.length} scenari a poche differenze ===\n`);
