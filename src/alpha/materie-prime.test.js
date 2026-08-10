import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pannelloMaterie, pannelloImmobiliare, serieReale, ingannoNominale,
  tempoPerTornareInPari, protezioneDallInflazione, terreRareSonoAzioni,
  quanteScommesseDavvero, ciclioImmobiliari, confrontoImmobiliareMondo,
  ingannoText, attesaText, immobiliareText, mondoImmobiliareText, MATERIE,
} from './materie-prime.js';
import { PREZZI_MP, CPI_USA, MP_MESE } from './materie-prime-panel.js';

// ── I dati ──

test('SESSANTASEI anni di materie prime, non quaranta', () => {
  const p = pannelloMaterie();
  assert.equal(p.da, '1960-01');
  assert.ok(p.mesi > 780, `mesi: ${p.mesi}`);
  assert.ok(p.serie.length >= 13);
  const oro = p.serie.find((s) => s.chiave === 'oro');
  assert.ok(oro.mesi > 700, 'l\'oro deve coprire quasi tutto');
  assert.match(p.fonte, /World Bank/);
  for (const k of MATERIE) assert.equal(PREZZI_MP[k].length, MP_MESE.length, `${k} disallineato`);
  assert.equal(CPI_USA.length, MP_MESE.length);
});

test('SETTANTOTTO anni di prezzi delle case, VENTOTTO Paesi in cinque continenti', () => {
  const p = pannelloImmobiliare();
  assert.equal(p.da, '1947-01');
  assert.ok(p.aree.length >= 28, `Paesi: ${p.aree.length}`);
  assert.ok(Object.keys(p.continenti).length >= 5);
  // L'app non è italiana: se l'Europa fosse l'unico continente coperto,
  // la promessa "globale" sarebbe una parola.
  for (const c of ['Europa', 'Asia', 'America', 'Oceania', 'Africa']) {
    assert.ok(p.continenti[c]?.length >= 1, `continente scoperto: ${c}`);
  }
  const it = p.aree.find((a) => a.chiave === 'italia');
  assert.equal(it.da, '1947-01');
  assert.ok(it.trimestri > 300);
});

// ── IL CUORE: senza deflazionare, ogni risposta sarebbe falsa ──

test('LA TRAPPOLA: il prezzo nominale su 66 anni è quasi tutto inflazione', () => {
  const oro = ingannoNominale('oro');
  assert.equal(oro.valido, true);
  // Centoventidue volte più caro in dollari, undici in potere d'acquisto.
  assert.ok(oro.voltePiuCaroNominale > 100, `${oro.voltePiuCaroNominale}`);
  assert.ok(oro.voltePiuCaroReale < oro.voltePiuCaroNominale / 5,
    'se reale e nominale fossero vicini, il deflatore non starebbe funzionando');
  assert.ok(oro.annuoNominale - oro.annuoReale > 3, 'il divario è l\'inflazione media, circa 3,8% l\'anno');
  assert.ok(oro.quotaInflazione > 0.4 && oro.quotaInflazione < 0.8);
});

test('il MINERALE DI FERRO ha PERSO potere d\'acquisto in 66 anni, pur essendo 9 volte più caro', () => {
  const f = ingannoNominale('ferro');
  assert.equal(f.haPersoPotereDacquisto, true);
  assert.ok(f.voltePiuCaroNominale > 5, 'in dollari sembra un affare');
  assert.ok(f.voltePiuCaroReale < 1, 'in potere d\'acquisto è una perdita');
  assert.match(ingannoText(f), /vale OGGI MENO di allora/);
});

test('la serie reale è ancorata al potere d\'acquisto di OGGI, non del 1960', () => {
  const re = serieReale('oro');
  const ultimo = re.length - 1 - [...re].reverse().findIndex((x) => x !== null);
  const nomUlt = PREZZI_MP.oro[ultimo];
  assert.ok(Math.abs(re[ultimo] - nomUlt) < 1,
    'l\'ultimo punto reale e nominale devono coincidere: è il punto di ancoraggio');
  assert.equal(serieReale('inventata'), null);
});

// ── Il fatto che nessuno dice a chi compra oro ──

test('QUARANTACINQUE ANNI per tornare in pari sull\'oro dal picco del 1980', () => {
  const t = tempoPerTornareInPari('oro');
  assert.equal(t.valido, true);
  assert.ok(t.attesaPiuLunga.anni > 40, `attesa: ${t.attesaPiuLunga.anni} anni`);
  assert.match(t.attesaPiuLunga.dalPicco, /^1980/);
  assert.match(attesaText(t), /anni prima di rivedere i propri soldi/);
});

test('argento, rame e petrolio sono ANCORA sotto il loro massimo reale, da decenni', () => {
  for (const k of ['argento', 'rame', 'petrolio']) {
    const t = tempoPerTornareInPari(k);
    assert.ok(t.attesaInCorso, `${k}: dovrebbe essere ancora sotto`);
    assert.ok(t.attesaInCorso.anni > 15, `${k}: solo ${t.attesaInCorso.anni} anni`);
    assert.ok(t.attesaInCorso.sottoDi < -0.3, `${k}: solo ${t.attesaInCorso.sottoDi}`);
  }
});

// ── Il luogo comune che regge e quelli che cadono ──

test('l\'oro PROTEGGE davvero dall\'inflazione — verificato, non ripetuto', () => {
  const p = protezioneDallInflazione('oro');
  assert.equal(p.proteggeDavvero, true);
  assert.ok(p.conInflazioneAlta.rendimentoRealeAnnuo > p.conInflazioneBassa.rendimentoRealeAnnuo + 3);
  assert.ok(p.conInflazioneAlta.quotaPositive > 0.85, 'e lo fa quasi sempre, non una volta su tre');
});

test('il RAME no, e l\'ARGENTO nemmeno: la protezione non si estende per analogia', () => {
  const rame = protezioneDallInflazione('rame');
  assert.equal(rame.proteggeDavvero, false);
  assert.ok(rame.conInflazioneAlta.rendimentoRealeAnnuo < 0, 'col rame si perde proprio');
  // L'argento è il caso interessante: in media va meglio, ma troppo di rado.
  const ag = protezioneDallInflazione('argento');
  assert.equal(ag.proteggeDavvero, false);
  assert.ok(ag.conInflazioneAlta.rendimentoRealeAnnuo > ag.conInflazioneBassa.rendimentoRealeAnnuo,
    'in media sembra funzionare...');
  assert.ok(ag.conInflazioneAlta.quotaPositive < 0.7, '...ma non abbastanza spesso da poterci contare');
  assert.match(ag.perche, /NON abbastanza spesso/);
});

// ── Le terre rare ──

test('LE TERRE RARE non hanno un prezzo pubblico: quello che c\'è è azionario, e va detto', () => {
  const r = terreRareSonoAzioni();
  assert.equal(r.valido, true);
  assert.ok(r.mesiDisponibili < 250, 'solo dal 2010, non 66 anni come il resto');
  assert.match(r.da, /^201/);
  assert.match(r.avvertenza, /non e' il prezzo delle terre rare/);
  assert.match(r.avvertenza, /contratti bilaterali/);
  // Senza una serie azionaria da fuori, il confronto non si può fare: si
  // risponde null invece di inventarlo.
  assert.equal(r.correlazioneConLaBorsa, null);
  assert.equal(r.eAzionario, null);
  assert.ok(r.correlazioneConIlRame !== null, 'col rame invece il confronto si può fare');
});

// ── La diversificazione che non c'è ──

test('tredici materie prime non sono tredici scommesse', () => {
  const q = quanteScommesseDavvero();
  assert.equal(q.valido, true);
  assert.ok(q.mediaDentroLaStessaFamiglia > q.mediaFraFamiglieDiverse + 0.1,
    'dentro la stessa famiglia si muovono molto più insieme');
  assert.ok(q.mediaDentroLaStessaFamiglia > 0.35, `${q.mediaDentroLaStessaFamiglia}`);
  assert.match(q.piuLegate[0].coppia, /Oro e Argento/);
  // Il gas naturale è l'unico davvero scollegato dal resto: è un mercato
  // regionale, non trasportabile come il petrolio.
  assert.ok(q.piuIndipendenti.every((c) => /Gas naturale/.test(c.coppia)));
});

// ── La casa ──

test('"il mattone non scende mai": 22 mercati su 28 sono sotto il massimo, ovunque nel mondo', () => {
  const c = confrontoImmobiliareMondo();
  assert.ok(c.suQuante >= 28);
  assert.ok(c.quanteAncoraSottoIlMassimo / c.suQuante > 0.7,
    `solo ${c.quanteAncoraSottoIlMassimo} su ${c.suQuante}: la frase andrebbe riscritta`);
  // Il crollo peggiore del mondo non è in Giappone come vuole il luogo comune:
  // è in Irlanda, -57% in poco più di sei anni.
  assert.equal(c.peggiore.nome, 'Irlanda');
  assert.ok(c.peggiore.caloPeggiore.calo < -0.5);
  assert.equal(c.attesaPiuLunga.nome, 'Giappone');
});

test('"e nel resto del mondo?" ha una risposta per ogni continente', () => {
  for (const cont of ['Europa', 'Asia', 'America', 'Oceania', 'Africa']) {
    const c = confrontoImmobiliareMondo({ continente: cont });
    assert.ok(c.suQuante >= 1, `${cont} vuoto`);
    const t = mondoImmobiliareText(c);
    assert.ok(t.includes(cont), `il testo non nomina ${cont}`);
    // Nessun articolo sbagliato davanti ai nomi di Paese.
    assert.ok(!/ della Irlanda| del Paesi| della Stati/.test(t), `articolo storto: ${t}`);
  }
  assert.equal(confrontoImmobiliareMondo({ continente: 'Atlantide' }).suQuante, 0);
});

test('il Giappone è il contresempio che chiude il discorso, e l\'Italia non sta molto meglio', () => {
  const jp = ciclioImmobiliari('giappone');
  assert.ok(jp.caloPeggiore.calo < -0.4, `calo: ${jp.caloPeggiore.calo}`);
  assert.match(jp.massimoStorico, /^199/, 'il massimo giapponese è del 1991');
  assert.ok(jp.anniDalMassimo > 30, `${jp.anniDalMassimo} anni sotto il massimo`);

  const it = ciclioImmobiliari('italia');
  assert.equal(it.ancoraSottoIlMassimo, true);
  assert.match(it.massimoStorico, /^2007/);
  assert.ok(it.oggiRispettoAlMassimo < -0.2, `l'Italia è ${it.oggiRispettoAlMassimo} sotto il 2007`);
  assert.equal(ciclioImmobiliari('atlantide').valido, false);
});

test('i testi spiegano senza gergo e senza dire cosa comprare', () => {
  const t = [ingannoText(ingannoNominale('oro')), attesaText(tempoPerTornareInPari('oro')), immobiliareText(ciclioImmobiliari('italia'))];
  for (const x of t) {
    assert.ok(x && x.length > 60);
    assert.ok(!/dovresti|conviene comprare|ti consiglio|opportunit/i.test(x), `indicazione operativa: ${x}`);
    assert.ok(!/deflazionat|CAGR|drawdown|percentile/i.test(x), `gergo: ${x}`);
  }
  assert.match(t[2], /non scende mai/);
});
