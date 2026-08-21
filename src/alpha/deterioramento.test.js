'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segnaleAllAnno, validaPreavviso, testoPreavviso, ANNI_DI_CALO } from './deterioramento.js';

test('il segnale guarda SOLO il passato: nessun dato futuro nella decisione', () => {
  // Se guardasse avanti, la validazione misurerebbe la propria conoscenza del
  // futuro invece della capacità di prevederlo — l'errore più classico.
  const v = [0.30, 0.28, 0.26, 0.10];
  // All'anno 2 il segnale vede tre cali e non sa nulla del crollo che segue.
  assert.equal(segnaleAllAnno(v, 2, 0.15), true);
  // Cambiare il futuro non cambia il segnale nel presente.
  assert.equal(segnaleAllAnno([0.30, 0.28, 0.26, 0.99], 2, 0.15), true);
});

test('non è un preavviso se è GIÀ caduta', () => {
  assert.equal(segnaleAllAnno([0.30, 0.20, 0.10], 2, 0.15), false);
});

test('servono cali consecutivi, non un andamento qualsiasi', () => {
  assert.equal(segnaleAllAnno([0.30, 0.25, 0.27], 2, 0.15), false, 'un rialzo in mezzo rompe la serie');
  assert.equal(segnaleAllAnno([0.30, 0.30, 0.28], 2, 0.15), false, 'un anno piatto non è un calo');
  assert.equal(segnaleAllAnno([0.30, 0.28], 1, 0.15), false, `servono ${ANNI_DI_CALO} anni`);
});

test('valori mancanti non producono un segnale inventato', () => {
  assert.equal(segnaleAllAnno([0.30, null, 0.26], 2, 0.15), false);
  assert.equal(segnaleAllAnno([0.30, NaN, 0.26], 2, 0.15), false);
});

// ── IL RISULTATO, ed è NEGATIVO ──
test('IL SEGNALE NON FUNZIONA, e il modulo lo dice invece di nasconderlo', () => {
  // Misurato su 82 aziende e i loro bilanci depositati:
  //   ROE     tasso di base 22,8%, precisione 25,9% -> guadagno 1,14
  //   MARGINE tasso di base 22,6%, precisione 19,4% -> guadagno 0,86 (peggio)
  // "I conti scendono da tre anni" non dice quasi nulla su dove saranno fra
  // due. L'intuizione è fortissima e i dati dicono di no.
  const roe = validaPreavviso({ misura: 'roe' });
  assert.ok(roe.anniValutati > 300, `solo ${roe.anniValutati} esercizi`);
  assert.ok(roe.tassoDiBase > 0.1 && roe.tassoDiBase < 0.4);
  assert.ok(roe.guadagno < 1.3, `guadagno ${roe.guadagno}: se salisse, aggiornare i commenti`);
  assert.equal(roe.funziona, false);
  assert.match(testoPreavviso(roe), /vendere rumore/);
});

test('IL TASSO DI BASE è il numero da battere, e viene sempre dichiarato', () => {
  // Se le cadute avvengono nel 23% degli anni comunque, un segnale che ne
  // indovina il 26% non sta segnalando niente. È la stessa disciplina già
  // applicata alla curva dei rendimenti e al rapporto di assorbimento — e in
  // tutti e tre i casi il verdetto è stato negativo.
  const v = validaPreavviso({ misura: 'margine' });
  assert.ok(Number.isFinite(v.tassoDiBase));
  const t = testoPreavviso(v);
  assert.match(t, /E' il numero da battere/);
  assert.match(t, /guardando in ogni anno solo il passato/);
});

test('le cadute MANCATE vengono contate, non solo quelle viste', () => {
  // Un segnale si giudica anche da cosa si è perso: contare solo i successi è
  // il modo più facile di sembrare bravi.
  const v = validaPreavviso({ misura: 'roe' });
  assert.ok(v.mancate > 0);
  assert.equal(v.utili + v.mancate, v.cadute);
  assert.match(testoPreavviso(v), /senza preavviso/);
});

test('il testo non promette niente e non consiglia', () => {
  const t = testoPreavviso(validaPreavviso({ misura: 'roe' }));
  assert.ok(!/\b(vendi|compra|dovresti|ti consiglio|prevedo|previsione affidabile)\b/i.test(t), t);
});
