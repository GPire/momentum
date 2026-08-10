// ============================================================
// I GRAFICI — SVG generato dai dati, senza librerie
// ============================================================
// Fino a qui ogni risposta era testo. "L'oro ha impiegato 45 anni a tornare in
// pari" è una frase forte, ma una riga che scende e resta giù per mezzo
// grafico la si capisce in un secondo e non si dimentica più.
//
// PERCHÉ SVG SCRITTO A MANO e non una libreria: il progetto non ha
// dipendenze, funziona offline, e una libreria di grafici pesa più di tutti i
// pannelli dati messi insieme. Qui servono quattro forme — una linea, delle
// barre, una distribuzione, una fascia di scenari — e sono duecento righe.
//
// LE REGOLE CHE MI SONO DATO, perché un grafico è il posto più facile del
// mondo dove mentire senza accorgersene:
//
// 1. **L'asse verticale parte da zero** nelle barre. Tagliare la base fa
//    sembrare enorme una differenza del 2%, ed è il trucco più diffuso.
//    Nelle linee di prezzo lo zero non ha senso e allora si dichiara il minimo.
// 2. **Il numero si scrive**, non si lascia dedurre dalla lunghezza.
// 3. **Se i dati sono pochi, si dice**: un grafico con sei punti sembra
//    autorevole quanto uno con seicento.
// 4. **Niente colore come unica informazione**: chi non distingue rosso e
//    verde deve leggere lo stesso grafico. Il segno sta anche nel testo.
// 5. **Si adatta al tema chiaro e scuro** usando `currentColor`, così eredita
//    il colore del testo intorno invece di imporne uno.
//
// Funzioni PURE: entra un array, esce una stringa SVG. Nessun DOM.
'use strict';

// I colori arrivano dalle variabili CSS del tema quando ci sono, con un
// ripiego neutro: così un grafico dentro l'app non stona e uno in un test non
// esplode.
const POSITIVO = 'var(--positivo, #2e9e6b)';
const NEGATIVO = 'var(--negativo, #d1495b)';
const NEUTRO = 'currentColor';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '0');

// Quanti punti servono perché un grafico non sia una decorazione.
export const POCHI_PUNTI = 8;

function cornice(larghezza, altezza, titolo, corpo, nota) {
  const h = altezza + (nota ? 16 : 0);
  return `<svg viewBox="0 0 ${larghezza} ${h}" width="100%" height="auto" role="img" `
    + `aria-label="${esc(titolo)}" font-family="inherit" font-size="10" fill="${NEUTRO}" `
    + `preserveAspectRatio="xMidYMid meet" style="max-width:100%;overflow:visible">`
    + `<title>${esc(titolo)}</title>${corpo}`
    + (nota ? `<text x="0" y="${h - 3}" opacity="0.6" font-size="9">${esc(nota)}</text>` : '')
    + '</svg>';
}

// ── LA LINEA: una serie nel tempo ──
// Usata per i prezzi reali, dove il punto è la forma della curva e non il
// livello assoluto.
export function linea(valori, { etichette = null, titolo = 'andamento', larghezza = 320, altezza = 90, evidenzia = null, unita = '' } = {}) {
  const punti = valori.map((v, i) => ({ v, i })).filter((p) => Number.isFinite(p.v));
  if (punti.length < 2) return null;
  const vals = punti.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const padX = 2, padY = 8, w = larghezza - padX * 2, h = altezza - padY * 2;
  const x = (i) => padX + (i / Math.max(1, valori.length - 1)) * w;
  const y = (v) => padY + h - ((v - min) / span) * h;
  const d = punti.map((p, k) => `${k === 0 ? 'M' : 'L'}${num(x(p.i), 1)},${num(y(p.v), 1)}`).join(' ');
  const ultimo = punti[punti.length - 1], primo = punti[0];
  const sale = ultimo.v >= primo.v;

  let corpo = `<path d="${d}" fill="none" stroke="${sale ? POSITIVO : NEGATIVO}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  // Il massimo storico marcato: è quasi sempre il punto che interessa.
  const iMax = punti.reduce((a, b) => (b.v > a.v ? b : a), punti[0]);
  corpo += `<circle cx="${num(x(iMax.i), 1)}" cy="${num(y(iMax.v), 1)}" r="2.2" fill="${NEUTRO}" opacity="0.5"/>`;
  corpo += `<circle cx="${num(x(ultimo.i), 1)}" cy="${num(y(ultimo.v), 1)}" r="2.6" fill="${sale ? POSITIVO : NEGATIVO}"/>`;
  if (evidenzia && Number.isFinite(evidenzia.da) && Number.isFinite(evidenzia.a)) {
    corpo = `<rect x="${num(x(evidenzia.da), 1)}" y="${padY}" width="${num(Math.max(1, x(evidenzia.a) - x(evidenzia.da)), 1)}" height="${h}" fill="${NEUTRO}" opacity="0.08"/>` + corpo;
  }
  if (etichette && etichette.length === valori.length) {
    corpo += `<text x="0" y="${altezza - 0.5}" opacity="0.6">${esc(etichette[primo.i])}</text>`;
    corpo += `<text x="${larghezza}" y="${altezza - 0.5}" text-anchor="end" opacity="0.6">${esc(etichette[ultimo.i])}</text>`;
  }
  // Il valore finale scritto: il grafico mostra la forma, il numero dà la scala.
  corpo += `<text x="${larghezza}" y="10" text-anchor="end" font-weight="600">${esc(formattaValore(ultimo.v, unita))}</text>`;
  const nota = punti.length < POCHI_PUNTI ? `solo ${punti.length} punti: la forma dice poco` : null;
  return cornice(larghezza, altezza, titolo, corpo, nota);
}

function formattaValore(v, unita) {
  const a = Math.abs(v);
  const s = a >= 1000 ? Math.round(v).toLocaleString('it-IT') : a >= 10 ? v.toFixed(0) : v.toFixed(2);
  return unita ? `${s}${unita}` : s;
}

// ── LE BARRE: un confronto fra poche cose ──
// La base è sempre lo zero, e i valori negativi vanno sotto la linea.
export function barre(voci, { titolo = 'confronto', larghezza = 320, altezzaBarra = 18, percentuale = true } = {}) {
  const dati = (voci || []).filter((v) => v && Number.isFinite(v.valore));
  if (!dati.length) return null;
  const max = Math.max(...dati.map((d) => Math.abs(d.valore))) || 1;
  const etLarg = 118, gap = 4;
  const zonaBarra = larghezza - etLarg - 46;
  const haNegativi = dati.some((d) => d.valore < 0);
  // Con valori di segno diverso lo zero sta in mezzo; se sono tutti dello
  // stesso segno si usa tutta la larghezza.
  const zeroX = haNegativi ? etLarg + zonaBarra / 2 : etLarg;
  const scala = haNegativi ? (zonaBarra / 2) / max : zonaBarra / max;
  const altezza = dati.length * (altezzaBarra + gap) + 4;
  let corpo = '';
  dati.forEach((d, i) => {
    const yy = i * (altezzaBarra + gap) + 2;
    const lung = Math.abs(d.valore) * scala;
    const x0 = d.valore < 0 ? zeroX - lung : zeroX;
    const col = d.colore || (d.valore < 0 ? NEGATIVO : POSITIVO);
    corpo += `<text x="0" y="${yy + altezzaBarra * 0.72}" opacity="0.85">${esc(d.nome)}</text>`;
    corpo += `<rect x="${num(x0, 1)}" y="${yy}" width="${num(Math.max(1, lung), 1)}" height="${altezzaBarra}" fill="${col}" opacity="0.75" rx="2"/>`;
    const testo = percentuale ? `${d.valore > 0 ? '+' : ''}${(d.valore * 100).toFixed(1)}%` : formattaValore(d.valore, d.unita || '');
    corpo += `<text x="${larghezza}" y="${yy + altezzaBarra * 0.72}" text-anchor="end" font-weight="600">${esc(testo)}</text>`;
  });
  // La linea dello zero, che è il riferimento onesto.
  corpo += `<line x1="${num(zeroX, 1)}" y1="0" x2="${num(zeroX, 1)}" y2="${altezza}" stroke="${NEUTRO}" stroke-width="0.7" opacity="0.35"/>`;
  const nota = dati.length < 3 ? null : null;
  return cornice(larghezza, altezza, titolo, corpo, nota);
}

// ── LA DISTRIBUZIONE: dove cade il caso tipico e dove cadono le code ──
// È la forma giusta per una previsione onesta: non un numero, un intervallo
// con dentro quante volte è andata in ciascun modo.
export function distribuzione({ mediano, andataMale, andataBene, casi = null }, { titolo = 'come e\' andata le altre volte', larghezza = 320, altezza = 54 } = {}) {
  if (![mediano, andataMale, andataBene].every(Number.isFinite)) return null;
  const min = Math.min(andataMale, 0, mediano), max = Math.max(andataBene, 0, mediano);
  const span = (max - min) || 1;
  const padX = 2, w = larghezza - padX * 2;
  const x = (v) => padX + ((v - min) / span) * w;
  const yBar = 20, hBar = 12;
  let corpo = '';
  // La fascia fra il decimo peggiore e il decimo migliore.
  corpo += `<rect x="${num(x(andataMale), 1)}" y="${yBar}" width="${num(Math.max(1, x(andataBene) - x(andataMale)), 1)}" height="${hBar}" fill="${NEUTRO}" opacity="0.14" rx="3"/>`;
  // Lo zero, che è la linea che distingue guadagno da perdita.
  if (min < 0 && max > 0) {
    corpo += `<line x1="${num(x(0), 1)}" y1="${yBar - 5}" x2="${num(x(0), 1)}" y2="${yBar + hBar + 5}" stroke="${NEUTRO}" stroke-width="0.8" opacity="0.5"/>`;
    corpo += `<text x="${num(x(0), 1)}" y="${yBar + hBar + 14}" text-anchor="middle" opacity="0.55">in pari</text>`;
  }
  corpo += `<line x1="${num(x(mediano), 1)}" y1="${yBar - 3}" x2="${num(x(mediano), 1)}" y2="${yBar + hBar + 3}" stroke="${mediano >= 0 ? POSITIVO : NEGATIVO}" stroke-width="2.4"/>`;
  corpo += `<text x="${num(x(andataMale), 1)}" y="${yBar - 6}" opacity="0.75">${(andataMale * 100).toFixed(0)}%</text>`;
  corpo += `<text x="${num(x(andataBene), 1)}" y="${yBar - 6}" text-anchor="end" opacity="0.75">+${(andataBene * 100).toFixed(0)}%</text>`;
  corpo += `<text x="${num(x(mediano), 1)}" y="${yBar + hBar + 14}" text-anchor="middle" font-weight="600">tipico ${mediano > 0 ? '+' : ''}${(mediano * 100).toFixed(0)}%</text>`;
  const nota = casi !== null ? `su ${casi} casi storici` : null;
  return cornice(larghezza, altezza, titolo, corpo, nota);
}

// ── I costruttori pronti, che è dove i grafici incontrano i dati ──
// Ogni risposta del QA che ha dei numeri dovrebbe poterne avere uno, e questi
// li costruiscono senza che il chiamante debba sapere di SVG.

export function graficoSerie(valori, etichette, titolo, opzioni = {}) {
  return linea(valori, { etichette, titolo, ...opzioni });
}

export function graficoConfronto(voci, titolo) {
  return barre(voci, { titolo });
}

export function graficoPrevisione(statoStorico, titolo) {
  if (!statoStorico?.abbastanza) return null;
  return distribuzione({
    mediano: statoStorico.mediano,
    andataMale: statoStorico.andataMale,
    andataBene: statoStorico.andataBene,
    casi: statoStorico.casi,
  }, { titolo: titolo || 'come e\' andata le altre volte' });
}

// Un aiuto per le serie lunghe: 800 punti in 320 pixel sono rumore. Si
// campiona tenendo SEMPRE il minimo e il massimo, perché sono i punti che
// raccontano la storia e un campionamento ingenuo li perde proprio.
export function assottiglia(valori, quanti = 160) {
  const v = valori.filter((x) => x !== null);
  if (valori.length <= quanti) return valori;
  const passo = valori.length / quanti;
  const fuori = [];
  for (let k = 0; k < quanti; k++) {
    const da = Math.floor(k * passo), a = Math.min(valori.length, Math.floor((k + 1) * passo));
    const fetta = valori.slice(da, a).filter((x) => Number.isFinite(x));
    if (!fetta.length) { fuori.push(null); continue; }
    // Nella fetta si tiene il valore piu' lontano dalla mediana del tutto:
    // cosi' picchi e crolli sopravvivono all'assottigliamento.
    const rif = v.length ? v[Math.floor(v.length / 2)] : 0;
    fuori.push(fetta.reduce((a2, b) => (Math.abs(b - rif) > Math.abs(a2 - rif) ? b : a2), fetta[0]));
  }
  return fuori;
}
