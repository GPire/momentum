import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serieMacro, trappolaLivelli, causeSuAzioni, previsioneNonIntervento, refertoCausale,
} from './macro-causality.js';

// La scoperta causale su 500 mesi costa: si calcola UNA volta e si riusa.
// Non e' solo economia di test — ricalcolarla in ogni caso rallentava l'intera
// suite abbastanza da far scadere due test altrove sensibili al tempo. Un test
// pesante che fa fallire test altrui e' un test scritto male.
let _trappola = null, _azioni = null, _intervento = null;
const trappola = () => (_trappola ??= trappolaLivelli());
const azioni = () => (_azioni ??= causeSuAzioni());
const intervento = () => (_intervento ??= previsioneNonIntervento());

// ── Le serie, preparate come si deve ──

test('le serie non contengono buchi: un campione diverso per ogni coppia inventerebbe legami', () => {
  for (const conAzioni of [false, true]) {
    const s = serieMacro({ variazioni: true, conAzioni });
    const lunghezze = Object.values(s).map((a) => a.length);
    assert.equal(new Set(lunghezze).size, 1, 'tutte le serie devono avere la stessa lunghezza');
    for (const [k, a] of Object.entries(s)) {
      assert.ok(a.every(Number.isFinite), `${k} contiene valori non numerici`);
    }
    assert.ok(lunghezze[0] > 350, `campione troppo piccolo: ${lunghezze[0]}`);
  }
});

test('livelli e variazioni sono davvero due cose diverse', () => {
  const liv = serieMacro({ variazioni: false });
  const va = serieMacro({ variazioni: true });
  const mediaAss = (a) => a.reduce((s, x) => s + Math.abs(x), 0) / a.length;
  assert.ok(mediaAss(va.tasso) < mediaAss(liv.tasso) / 2,
    'le variazioni devono essere molto più piccole dei livelli');
});

// ── 1. LA TRAPPOLA DEI LIVELLI ──

test('LA TRAPPOLA: i legami trovati sui livelli spariscono sulle variazioni', () => {
  const t = trappola();
  assert.ok(t.suLivelli >= 4, `sui livelli il motore deve trovare parecchi legami: ${t.suLivelli}`);
  assert.ok(t.svaniti >= t.suLivelli - 1,
    `quasi tutti i legami dei livelli devono svanire: ${t.svaniti} su ${t.suLivelli}`);
  assert.ok(t.quotaSpuria > 0.7, `quota spuria ${t.quotaSpuria}`);
  assert.match(t.lezione, /tendenza comune nel tempo/);
});

test('quel che resta sulle variazioni è pochissimo, e va guardato con sospetto', () => {
  const t = trappola();
  assert.ok(t.suVariazioni <= 2,
    `su dati macro mensili in variazioni non deve restare quasi niente: ${t.suVariazioni}`);
  // Il legame che sopravvive è tasso -> curva: la banca centrale fissa il tasso
  // breve, che è una gamba della curva. È un'identità, non una scoperta.
  if (t.suVariazioni === 1) {
    assert.equal(t.sopravvissuti[0].da, 'tasso');
    assert.equal(t.sopravvissuti[0].a, 'curva');
  }
});

// ── 2. LA DOMANDA DEL TRADER ──

test('NESSUNA VARIABILE MACRO PRECEDE I RENDIMENTI AZIONARI', () => {
  const a = azioni();
  assert.ok(a.mesi > 350, `mesi allineati: ${a.mesi}`);
  assert.equal(a.macroVersoAzioni.length, 0,
    `trovati legami macro→azioni: ${JSON.stringify(a.macroVersoAzioni)}. Se un giorno comparissero, sospettare del metodo prima di crederci.`);
});

test('MA LE AZIONI PRECEDONO L\'ECONOMIA: la freccia va nell\'altro verso', () => {
  const a = azioni();
  assert.ok(a.azioniVersoMacro.length >= 1,
    'i rendimenti azionari devono precedere almeno una variabile macro');
  assert.equal(a.laBorsaAnticipa, true);
  assert.match(a.conclusione, /la borsa anticipa l'economia, non la segue/);
  const verso = a.azioniVersoMacro.map((x) => x.a);
  assert.ok(verso.includes('disoccupazione') || verso.includes('inflazione'));
});

test('e comunque niente di tutto questo è usabile per decidere un intervento', () => {
  assert.equal(azioni().perDecidere, false);
});

// ── 3. Previsione ≠ causa ──

test('le domande a cui si può rispondere e quelle a cui no sono elencate, non sottintese', () => {
  const p = intervento();
  assert.equal(p.perDecidere, false);
  assert.ok(p.domandeAmmesse.length >= 3);
  assert.ok(p.domandeNonAmmesse.length >= 2);
  for (const d of p.domandeNonAmmesse) {
    assert.ok(d.perche && d.cosaServirebbe,
      'rifiutare una domanda senza dire perché né cosa servirebbe è una scusa, non una risposta');
  }
});

test('il rifiuto sulla politica monetaria cita il motivo vero: la banca centrale reagisce', () => {
  const p = intervento();
  const tassi = p.domandeNonAmmesse.find((d) => /banca centrale taglia/.test(d.domanda));
  assert.ok(tassi, 'la domanda sui tagli deve essere fra quelle rifiutate');
  assert.match(tassi.perche, /PROPRIO QUANDO l'economia peggiora/);
  assert.match(tassi.cosaServirebbe, /Romer/);
});

test('la curva è dichiarata previsione e non causa', () => {
  const p = intervento();
  const curva = p.domandeNonAmmesse.find((d) => /curva si disinverte/.test(d.domanda));
  assert.ok(curva);
  assert.match(curva.perche, /PREVEDE le recessioni, non le causa/);
});

// ── Il referto ──

test('il referto dice le tre cose in italiano, senza gergo e senza frecce inventate', () => {
  const r = refertoCausale();
  assert.match(r.testo, /causa ed effetto/);
  assert.match(r.testo, /variazioni mese su mese/);
  assert.match(r.testo, /anticipa/);
  assert.match(r.testo, /preferisco dirlo/);
  assert.ok(!/PCMCI|p-value|Benjamini|stazionar|endogen/i.test(r.testo), `gergo nel testo: ${r.testo}`);
});
