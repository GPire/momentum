'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rapportoAssorbimento, serieAssorbimento, spostamentoAssorbimento,
  validaAssorbimento, testoAssorbimento, numeroComponenti,
} from './assorbimento.js';
import { GIORNALIERO } from './daily-panel.js';

const seme = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const rumore = (rng) => (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 3;
const serie = (n, rng, scala = 0.01) => Array.from({ length: n }, () => rumore(rng) * scala);

test('serie INDIPENDENTI: il rapporto è vicino al minimo possibile', () => {
  const rng = seme(1);
  const dieci = Array.from({ length: 10 }, () => serie(500, rng));
  const r = rapportoAssorbimento(dieci);
  assert.equal(r.componenti, 2); // 20% di 10
  // Con serie indipendenti ogni autovalore vale circa 1: le prime due
  // spiegano circa 2/10. Un po' sopra per il rumore campionario, non molto.
  assert.ok(r.valore < r.minimoPossibile * 1.8, `valore ${r.valore} vs minimo ${r.minimoPossibile}`);
});

test('SERIE TUTTE UGUALI: il rapporto è ~1, cioè una scommessa sola con dieci nomi', () => {
  // Il caso che il modulo esiste per riconoscere: dieci investimenti che sono
  // in realtà lo stesso investimento.
  const rng = seme(2);
  const base = serie(400, rng);
  const dieciCopie = Array.from({ length: 10 }, () => base.map((x) => x + rumore(rng) * 1e-6));
  const r = rapportoAssorbimento(dieciCopie);
  assert.ok(r.valore > 0.97, `valore ${r.valore}`);
});

test('il minimo possibile viene dichiarato: un valore alto può essere solo aritmetica', () => {
  const rng = seme(3);
  const quattro = Array.from({ length: 4 }, () => serie(300, rng));
  const r = rapportoAssorbimento(quattro);
  // Con 4 serie, k=1, il minimo è 0,25: un rapporto di 0,3 NON è "il 30% di
  // struttura comune", è quasi il minimo strutturale.
  assert.equal(r.minimoPossibile, 0.25);
  assert.ok(r.valore >= r.minimoPossibile - 1e-9);
});

test('meno di tre serie: nessun rapporto inventato', () => {
  const rng = seme(4);
  assert.equal(rapportoAssorbimento([serie(100, rng), serie(100, rng)]), null);
  assert.equal(rapportoAssorbimento([]), null);
});

test('numeroComponenti resta almeno 1 anche con pochissime serie', () => {
  assert.equal(numeroComponenti(3), 1);
  assert.equal(numeroComponenti(10), 2);
  assert.equal(numeroComponenti(1), 1);
});

test('LO SPOSTAMENTO riconosce una struttura che cambia davvero', () => {
  // Serie indipendenti che diventano tutte legate a un fattore comune: il
  // rapporto deve salire e lo spostamento accorgersene.
  //
  // ATTENZIONE ALLA COSTRUZIONE, ed è il motivo per cui la prima versione di
  // questo test falliva: con una finestra scorrevole, un cambio di regime a
  // metà serie viene ASSORBITO molto prima della fine — le finestre recenti e
  // quelle "storiche" finiscono entrambe dentro il regime nuovo, e lo
  // spostamento confronta nuovo con nuovo. Il cambio va messo vicino al bordo
  // perché il confronto sia fra i due regimi davvero.
  const rng = seme(5);
  const n = 900, k = 6, cambio = 800;
  const comune = serie(n, rng);
  const dati = Array.from({ length: k }, () => {
    const s = [];
    for (let t = 0; t < n; t++) {
      s.push(t < cambio ? rumore(rng) * 0.01 : comune[t] * 0.9 + rumore(rng) * 0.002);
    }
    return s;
  });
  const rap = serieAssorbimento(dati, { finestra: 100, passo: 5 });
  assert.ok(rap.length > 120, `finestre ${rap.length}`);
  const sp = spostamentoAssorbimento(rap, { breve: 15, lungo: 60 });
  assert.ok(sp.spostamento > 1.5, `spostamento ${sp.spostamento}`);
  assert.ok(sp.valoreRecente > sp.mediaLunga);
});

test('spostamento su storia insufficiente: null invece di un numero fragile', () => {
  assert.equal(spostamentoAssorbimento([{ valore: 0.5 }, { valore: 0.6 }]), null);
});

// ── LA VALIDAZIONE SUI DATI VERI ──
test('SUI DATI GIORNALIERI VERI: la misura NON si conferma, e va detto', () => {
  // Il test più importante del file. Il rapporto di assorbimento è una misura
  // pubblicata (Kritzman et al. 2011) e sensata, ma una misura pubblicata non
  // è una misura verificata sui NOSTRI dati. Validata walk-forward con
  // permutazione a blocchi, l'effetto va nel verso previsto — dopo gli
  // spostamenti alti i rendimenti sono peggiori — ma NON è distinguibile dal
  // caso, perché cinque anni di dati giornalieri danno pochissime
  // osservazioni davvero indipendenti a questi orizzonti.
  const serieDati = Object.entries(GIORNALIERO).filter(([k]) => k !== 'vix').map(([, v]) => v);
  const v = validaAssorbimento(serieDati, GIORNALIERO.azioniUsa, {
    orizzonte: 63, rng: seme(11), permutazioni: 299,
  });
  assert.equal(v.disponibile, true);
  // L'effetto grezzo è grande e nel verso giusto...
  assert.ok(v.differenza < 0, `differenza ${v.differenza}`);
  assert.equal(v.versoAtteso, true);
  // ...ma le osservazioni indipendenti sono pochissime, e quindi non regge.
  assert.ok(v.osservazioniIndipendenti < 15, `indipendenti ${v.osservazioniIndipendenti}`);
  assert.equal(v.funziona, false, `p=${v.p}`);
  assert.match(v.messaggio, /NON è distinguibile dal caso/);
  assert.match(v.messaggio, /vale più dirlo che ripetere la citazione/);
});

test('la validazione dichiara SEMPRE le osservazioni indipendenti, non solo quelle apparenti', () => {
  const serieDati = Object.entries(GIORNALIERO).filter(([k]) => k !== 'vix').map(([, v]) => v);
  const v = validaAssorbimento(serieDati, GIORNALIERO.azioniUsa, { orizzonte: 21, rng: seme(12), permutazioni: 199 });
  assert.ok(v.osservazioniIndipendenti < v.osservazioni / 3,
    `${v.osservazioniIndipendenti} su ${v.osservazioni}`);
});

test('dati insufficienti per validare: si rifiuta invece di produrre un p', () => {
  const rng = seme(6);
  const corte = Array.from({ length: 5 }, () => serie(300, rng));
  const v = validaAssorbimento(corte, serie(300, rng), { finestra: 250, rng: seme(7), permutazioni: 99 });
  assert.equal(v.disponibile, false);
  assert.ok(v.motivo);
});

// ── IL TESTO ──
test('lo stato di ADESSO viene descritto, mai allarmato', () => {
  const serieDati = Object.entries(GIORNALIERO).filter(([k]) => k !== 'vix').map(([, v]) => v);
  const rap = serieAssorbimento(serieDati, { finestra: 250, passo: 5 });
  const sp = spostamentoAssorbimento(rap);
  const t = testoAssorbimento(sp);
  assert.ok(t);
  assert.ok(!/\b(allarme|pericolo|attenzione|vendi|compra|crollo imminente)\b/i.test(t), t);
});

test('se la validazione è negativa il testo lo DICE, invece di tacerlo', () => {
  const sp = { valoreRecente: 0.6, mediaLunga: 0.5, spostamento: 2 };
  const t = testoAssorbimento(sp, { disponibile: true, funziona: false });
  assert.match(t, /NON ha anticipato/);
  assert.match(t, /non cosa succederà/);
});

test('spostamento negativo: si dice che la diversificazione sta funzionando meglio', () => {
  const t = testoAssorbimento({ valoreRecente: 0.4, mediaLunga: 0.55, spostamento: -1.7 });
  assert.match(t, /più indipendente del solito/);
});
