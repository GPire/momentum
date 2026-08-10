import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloGiornaliero, finestra, giorniPeggiori, criptoNeiCrolli,
  mensileNascondeIlCrollo, episodiGiornalieri, finestraText,
  EPISODI_NOTI, CLASSI,
} from './eventi.js';
import { GIORNALIERO, DATE_GIORNI } from './daily-panel.js';

let _apr = null, _cripto = null, _ep = null;
const aprile = () => (_apr ??= finestra('2025-04-01', '2025-04-30'));
const cripto = () => (_cripto ??= criptoNeiCrolli());
const episodi = () => (_ep ??= episodiGiornalieri());

// ── Il pannello ──

test('cinque anni di giorni di borsa, dieci classi più la paura implicita', () => {
  const p = pannelloGiornaliero();
  assert.ok(p.giorni > 1200, `giorni: ${p.giorni}`);
  assert.equal(p.classi.length, 10);
  assert.match(p.fonte, /VIX/);
  for (const c of CLASSI) assert.equal(GIORNALIERO[c].length, DATE_GIORNI.length, `${c} disallineato`);
  assert.equal(GIORNALIERO.vix.length, DATE_GIORNI.length);
});

test('le date sono ordinate e senza duplicati', () => {
  for (let i = 1; i < DATE_GIORNI.length; i++) {
    assert.ok(DATE_GIORNI[i] > DATE_GIORNI[i - 1], `date fuori ordine attorno a ${DATE_GIORNI[i]}`);
  }
});

test('il VIX è un livello plausibile, non un rendimento travestito', () => {
  const v = GIORNALIERO.vix;
  assert.ok(Math.min(...v) > 5 && Math.max(...v) < 120, `intervallo VIX: ${Math.min(...v)} - ${Math.max(...v)}`);
});

// ── APRILE 2025: la dimostrazione ──

test('APRILE 2025: il mese dice −0,9%, dentro c\'è stato un crollo del 12%', () => {
  const f = aprile();
  assert.equal(f.trovato, true);
  assert.ok(Math.abs(f.azioni.totale) < 0.03, `chiusura mensile: ${f.azioni.totale}`);
  assert.ok(f.azioni.caloMassimo > 0.1,
    `calo dentro il mese ${f.azioni.caloMassimo}: è quello che il dato mensile cancella`);
  assert.ok(f.quantoNascondeIlDatoDiPeriodo > 0.08);
  assert.ok(f.paura.massima > 40, `la paura è arrivata a ${f.paura.massima}`);
});

test('APRILE 2025: la sezione mostra chi ha tenuto e chi è affondato nello stesso mese', () => {
  const f = aprile();
  const nomi = f.perClasse.map((c) => c.classe);
  assert.equal(nomi.length, 10);
  const energia = f.perClasse.find((c) => c.classe === 'energia');
  assert.ok(energia.totale < -0.1, `energia: ${energia.totale}`);
  // Il primo e l'ultimo distano moltissimo: dentro lo stesso mese e lo stesso
  // mercato non è successa la stessa cosa a tutti.
  assert.ok(f.perClasse[0].totale - f.perClasse.at(-1).totale > 0.25);
});

test('il testo racconta il crollo nascosto invece di riportare solo la chiusura', () => {
  const t = finestraText(aprile());
  assert.match(t, /nel mezzo sono arrivate a perdere/);
  assert.match(t, /paura misurata dalle opzioni/);
  assert.ok(!/drawdown|volatilit|VIX|percentile/i.test(t), `gergo: ${t}`);
});

test('una finestra fuori dal pannello lo dice invece di restituire numeri vuoti', () => {
  const f = finestra('1995-01-01', '1995-02-01');
  assert.equal(f.trovato, false);
  assert.match(f.motivo, /nessun giorno di borsa/);
});

// ── LE CRIPTO ──

test('LE CRIPTO NON SONO UN RIFUGIO: nei giorni peggiori scendono PIÙ delle azioni', () => {
  const c = cripto();
  assert.equal(c.criptoRifugio, false);
  const btc = c.cripto.find((x) => x.classe === 'bitcoin');
  const eth = c.cripto.find((x) => x.classe === 'ethereum');
  assert.ok(btc.medio < c.azioniInQueiGiorni, `bitcoin ${btc.medio} contro azioni ${c.azioniInQueiGiorni}`);
  assert.ok(eth.medio < btc.medio, 'ethereum amplifica ancora di più di bitcoin');
  assert.ok(btc.quotaPositiva < 0.25, `positivo solo il ${btc.quotaPositiva} dei giorni peggiori`);
  assert.match(c.conclusione, /azionario con piu' leva/);
});

test('e il dollaro invece regge anche a frequenza giornaliera', () => {
  const usd = cripto().tradizionali.find((x) => x.classe === 'dollaro');
  assert.ok(usd.medio > 0, `dollaro nei giorni peggiori: ${usd.medio}`);
  assert.equal(usd.amplifica, false);
});

test('lo stesso mese può essere ottimo per le cripto e pessimo nei giorni peggiori: sono due domande diverse', () => {
  // Ad aprile 2025 bitcoin ha chiuso il mese molto bene, eppure nei giorni di
  // panico scende più delle azioni. Non è una contraddizione: una cosa è la
  // tendenza del mese, un'altra il comportamento negli shock.
  const btcAprile = aprile().perClasse.find((c) => c.classe === 'bitcoin');
  assert.ok(btcAprile.totale > 0.1, `bitcoin ad aprile 2025: ${btcAprile.totale}`);
  assert.equal(cripto().criptoRifugio, false);
});

// ── I giorni peggiori ──

test('i giorni peggiori elencano chi ha protetto e chi è affondato quel giorno', () => {
  const g = giorniPeggiori({ quanti: 5 });
  assert.equal(g.length, 5);
  for (const d of g) {
    assert.ok(d.azioni < -0.02, `giorno poco brutto: ${d.data} ${d.azioni}`);
    assert.ok(d.protetti.length + d.affondati.length === CLASSI.length - 1);
    assert.ok(d.paura > 15, `paura in un giorno di crollo: ${d.paura}`);
  }
  // Ordinati dal peggiore.
  for (let i = 1; i < g.length; i++) assert.ok(g[i].azioni >= g[i - 1].azioni);
});

// ── Quanto il mensile nasconde ──

test('NON È UN CASO ISOLATO: un mese su tre nasconde un calo di almeno tre punti', () => {
  const m = mensileNascondeIlCrollo();
  assert.ok(m.mesiEsaminati > 50);
  assert.ok(m.quantiIngannano / m.mesiEsaminati > 0.25,
    `${m.quantiIngannano} mesi su ${m.mesiEsaminati}: il dato mensile inganna spesso, non per eccezione`);
  assert.ok(m.peggioriInganni[0].nascosto > 0.08);
});

test('c\'è almeno un mese chiuso in POSITIVO che dentro ha avuto un crollo serio', () => {
  const m = mensileNascondeIlCrollo();
  const bugiardo = m.peggioriInganni.find((r) => r.chiusuraMensile > 0 && r.caloDentroIlMese > 0.06);
  assert.ok(bugiardo, `nessun mese positivo con crollo dentro: ${JSON.stringify(m.peggioriInganni.slice(0, 3))}`);
});

// ── Gli episodi ──

test('gli episodi li trovano i PREZZI, il nome si attacca solo se la data coincide', () => {
  const e = episodi();
  assert.ok(e.length >= 5);
  const date = new Set(e.map((x) => x.mese));
  for (const noto of EPISODI_NOTI) {
    assert.ok(date.has(noto.intorno),
      `etichetta "${noto.nome}" senza un calo corrispondente nei dati (${noto.intorno})`);
  }
});

test('ogni episodio con nome dichiara che è contesto, non causa', () => {
  for (const x of episodi().filter((y) => y.nome)) {
    assert.match(x.nota, /non una causa dimostrata/);
  }
});

test('i dazi del 2025 e il mercato orso del 2022 emergono entrambi, con firme diverse', () => {
  const e = episodi();
  const dazi = e.find((x) => x.mese === '2025-04');
  const orso = e.find((x) => x.mese === '2022-09');
  assert.ok(dazi && orso);
  // Firma diversa: aprile 2025 ha un crollo profondo ma chiude quasi in pari
  // (recupero rapido); settembre 2022 chiude male quanto è sceso.
  assert.ok(Math.abs(dazi.chiusuraMensile) < 0.03 && dazi.caloDentroIlMese > 0.1,
    'aprile 2025: crollo e recupero dentro lo stesso mese');
  assert.ok(orso.chiusuraMensile < -0.05, 'settembre 2022: il calo è rimasto');
  assert.ok(dazi.pauraMassima > orso.pauraMassima,
    `la paura ad aprile 2025 (${dazi.pauraMassima}) ha superato quella di settembre 2022 (${orso.pauraMassima})`);
});

test('GLI EPISODI SETTORIALI emergono anche quando l\'indice non si muove', () => {
  // Marzo 2023: lo S&P e' sceso solo del 4,7% e ha chiuso il mese in POSITIVO,
  // eppure era in corso una crisi bancaria. Guardare solo l'indice significa
  // non vedere la maggior parte degli episodi.
  const svb = episodi().find((x) => x.mese === '2023-03');
  assert.ok(svb, 'marzo 2023 deve emergere come episodio');
  assert.equal(svb.soloSettoriale, true, 'non era una crisi di indice');
  assert.ok(svb.chiusuraMensile > 0, `il mese ha chiuso in positivo: ${svb.chiusuraMensile}`);
  assert.ok(svb.caloClassePiuColpita > svb.caloDentroIlMese * 2,
    `la classe piu' colpita (${svb.classePiuColpita}) e' scesa molto piu' dell'indice`);
});
