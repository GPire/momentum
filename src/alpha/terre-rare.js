// ============================================================
// TERRE RARE — centoventun anni, e una correzione a me stesso
// ============================================================
// Avevo scritto, e detto all'utente, che sulle terre rare "il dato pubblico non
// esiste". Era falso. Non esiste una QUOTAZIONE di borsa in continuo, perché
// questo mercato è fatto di contratti diretti fra chi estrae e chi usa. Ma lo
// Stato americano censisce questo mercato dal 1900, in dominio pubblico, con
// produzione, consumo, scambi e valore unitario anche in dollari costanti.
// Arrendersi dava zero anni; cercare meglio ne ha dati centoventuno.
//
// LA COSA CHE QUESTI DATI DICONO E CHE QUASI NESSUNO SI ASPETTA. Le terre rare
// sono il simbolo della scarsità strategica: se ne parla come di una risorsa
// che si esaurisce e che perciò varrà sempre di più. I numeri dicono
// l'opposto. In sessant'anni la produzione mondiale è cresciuta di più di cento
// volte e il prezzo reale è CROLLATO. Il problema delle terre rare non è che
// siano rare — non lo sono, il nome inganna — è che a produrle è rimasto quasi
// solo un Paese. È un problema di concentrazione, non di scarsità, e le due
// cose portano a conclusioni opposte su cosa farne.
//
// Funzioni PURE.
'use strict';

import {
  TR_ANNO, TR_PRODUZIONE_USA, TR_PRODUZIONE_MONDO, TR_IMPORTAZIONI_USA,
  TR_CONSUMO_USA, TR_PREZZO_NOMINALE, TR_PREZZO_REALE, TR_DA, TR_A, TR_ANNI, TR_FONTE,
} from './terre-rare-panel.js';

export function pannelloTerreRare() {
  const conPrezzo = TR_PREZZO_REALE.filter((x) => x !== null).length;
  return {
    anni: TR_ANNI, da: TR_DA, a: TR_A, fonte: TR_FONTE,
    anniConPrezzo: conPrezzo,
    primoAnnoConPrezzo: TR_ANNO[TR_PREZZO_REALE.findIndex((x) => x !== null)],
    // Il limite si dichiara nel pannello, non in fondo a un documento.
    limiti: [
      'annuale, non giornaliero: un mercato di contratti annuali non ha una quotazione continua',
      'il valore unitario e\' quello del consumo statunitense, non un prezzo mondiale',
      `finisce nel ${TR_A}: per gli anni dopo esiste solo un fondo di societa' minerarie, che e' azionario`,
    ],
  };
}

// ── LA SCARSITÀ CHE NON C'È ──
export function scarsitaOSconcentrazione() {
  const i = (a) => TR_ANNO.indexOf(a);
  const val = (arr, a) => (i(a) >= 0 ? arr[i(a)] : null);
  const primoMondo = TR_PRODUZIONE_MONDO.findIndex((x) => x !== null);
  const ultimo = TR_PRODUZIONE_MONDO.length - 1 - [...TR_PRODUZIONE_MONDO].reverse().findIndex((x) => x !== null);
  const prezzi = TR_PREZZO_REALE.map((p, k) => ({ p, a: TR_ANNO[k] })).filter((x) => x.p !== null);
  const p0 = prezzi[0], pN = prezzi[prezzi.length - 1];
  const massimo = prezzi.reduce((m, x) => (x.p > m.p ? x : m), prezzi[0]);
  return {
    produzioneMondiale: {
      da: TR_ANNO[primoMondo], quantitaIniziale: TR_PRODUZIONE_MONDO[primoMondo],
      a: TR_ANNO[ultimo], quantitaFinale: TR_PRODUZIONE_MONDO[ultimo],
      volte: +(TR_PRODUZIONE_MONDO[ultimo] / TR_PRODUZIONE_MONDO[primoMondo]).toFixed(0),
      // Rispetto al 1960, che è l'inizio dell'era industriale di questo mercato.
      volteDal1960: val(TR_PRODUZIONE_MONDO, 1960) ? +(TR_PRODUZIONE_MONDO[ultimo] / val(TR_PRODUZIONE_MONDO, 1960)).toFixed(0) : null,
    },
    prezzoReale: {
      da: p0.a, iniziale: p0.p, a: pN.a, finale: pN.p,
      variazione: +(pN.p / p0.p - 1).toFixed(3),
      massimoStorico: { anno: massimo.a, valore: massimo.p },
      sottoIlMassimo: +(pN.p / massimo.p - 1).toFixed(3),
    },
    // Il punto: più se ne produce, meno costano. Non è una risorsa che si
    // esaurisce, è una risorsa che si è imparato a estrarre.
    piuAbbondantiCheMai: TR_PRODUZIONE_MONDO[ultimo] > TR_PRODUZIONE_MONDO[primoMondo] * 10 && pN.p < p0.p,
  };
}

// ── LA CONCENTRAZIONE, che è il problema vero ──
export function chiLeProduce() {
  const quote = [];
  for (let k = 0; k < TR_ANNO.length; k++) {
    const u = TR_PRODUZIONE_USA[k], m = TR_PRODUZIONE_MONDO[k];
    if (u === null || m === null || m <= 0) continue;
    quote.push({ anno: TR_ANNO[k], quotaUsa: u / m });
  }
  if (!quote.length) return { valido: false, motivo: 'dati di produzione assenti' };
  const massimo = quote.reduce((a, b) => (b.quotaUsa > a.quotaUsa ? b : a));
  const zero = quote.filter((q) => q.quotaUsa === 0);
  const oggi = quote[quote.length - 1];
  return {
    valido: true,
    massimoAmericano: { anno: massimo.anno, quota: +massimo.quotaUsa.toFixed(3) },
    anniAQuotaZero: zero.length,
    primoAnnoAZero: zero[0]?.anno ?? null, ultimoAnnoAZero: zero[zero.length - 1]?.anno ?? null,
    oggi: { anno: oggi.anno, quota: +oggi.quotaUsa.toFixed(3) },
    // Il fatto crudo: il Paese che dominava la produzione mondiale è arrivato a
    // non produrne nemmeno una tonnellata, per anni di fila.
    daDominanteAZero: massimo.quotaUsa > 0.5 && zero.length > 0,
    // Quello che questi dati NON dicono, e va detto: la quota cinese. USGS qui
    // pubblica Stati Uniti e mondo, non il dettaglio per Paese. Che il resto sia
    // quasi tutto Cina è vero ma va preso da altre fonti, non da qui.
    nonDeducibileDaQui: 'la quota della Cina: questa serie ha solo Stati Uniti e totale mondiale',
  };
}

// ── L'EPISODIO DEL 2010-2011, che è la lezione ripetibile ──
// Nel 2010 la Cina tagliò le quote di esportazione. Il prezzo esplose, i
// giornali parlarono di guerra delle terre rare, nacquero fondi apposta. Poi.
export function panicoDel2010() {
  const idx = (a) => TR_ANNO.indexOf(a);
  const p = (a) => (idx(a) >= 0 ? TR_PREZZO_REALE[idx(a)] : null);
  const prima = p(2009), picco = [2010, 2011, 2012].map((a) => ({ a, v: p(a) })).filter((x) => x.v !== null)
    .reduce((m, x) => (m === null || x.v > m.v ? x : m), null);
  const dopo = p(2015), oggi = TR_PREZZO_REALE.filter((x) => x !== null).at(-1);
  if (prima === null || picco === null) return { valido: false, motivo: 'anni dell\'episodio non coperti' };
  return {
    valido: true,
    primaDelPanico: { anno: 2009, prezzoReale: prima },
    alPicco: { anno: picco.a, prezzoReale: picco.v, salita: +(picco.v / prima - 1).toFixed(3) },
    cinqueAnniDopo: dopo === null ? null : { anno: 2015, prezzoReale: dopo, dalPicco: +(dopo / picco.v - 1).toFixed(3) },
    oggi: { anno: TR_A, prezzoReale: oggi, dalPicco: +(oggi / picco.v - 1).toFixed(3) },
    // Chi comprò sull'onda del panico comprò il massimo.
    tornatoSottoIlLivelloDiPartenza: oggi < prima,
  };
}

// ── L'ETF SEGUE IL METALLO? La verifica che nessuno fa ──
// Chi vuole "esporsi alle terre rare" compra un fondo di società minerarie,
// perché è l'unica cosa comprabile. Qui si controlla se quel fondo si muove
// come il valore delle terre rare: negli undici anni in cui esistono entrambi.
export function etfSegueIlMetallo(etfPerAnno) {
  if (!etfPerAnno || typeof etfPerAnno !== 'object') {
    return { valido: false, motivo: 'servono i valori annuali del fondo, che questo modulo non ha: li passa il chiamante' };
  }
  const coppie = [];
  for (let k = 1; k < TR_ANNO.length; k++) {
    const a = TR_ANNO[k], p0 = TR_PREZZO_REALE[k - 1], p1 = TR_PREZZO_REALE[k];
    const e0 = etfPerAnno[TR_ANNO[k - 1]], e1 = etfPerAnno[a];
    if (p0 === null || p1 === null || !Number.isFinite(e0) || !Number.isFinite(e1) || p0 <= 0 || e0 <= 0) continue;
    coppie.push({ anno: a, metallo: p1 / p0 - 1, fondo: e1 / e0 - 1 });
  }
  if (coppie.length < 5) return { valido: false, motivo: `solo ${coppie.length} anni in comune: troppo pochi per dire qualcosa` };
  const mx = coppie.reduce((s, c) => s + c.metallo, 0) / coppie.length;
  const my = coppie.reduce((s, c) => s + c.fondo, 0) / coppie.length;
  let n = 0, dx = 0, dy = 0;
  for (const c of coppie) { n += (c.metallo - mx) * (c.fondo - my); dx += (c.metallo - mx) ** 2; dy += (c.fondo - my) ** 2; }
  const r = dx > 0 && dy > 0 ? n / Math.sqrt(dx * dy) : null;
  const concordi = coppie.filter((c) => Math.sign(c.metallo) === Math.sign(c.fondo)).length;
  return {
    valido: true, anniInComune: coppie.length, dal: coppie[0].anno, al: coppie.at(-1).anno,
    correlazione: r === null ? null : +r.toFixed(3),
    anniInCuiVannoNellaStessaDirezione: concordi,
    // Con undici osservazioni annuali non si dimostra granché, e dirlo fa parte
    // della risposta: il valore critico approssimato a undici punti è circa 0,6.
    abbastanzaDatiPerConcludere: coppie.length >= 20,
    // Il risultato ha due facce e vanno dette tutte e due, perche' da sole
    // porterebbero a conclusioni opposte. La correlazione e' debole (0,33: con
    // dieci punti non e' distinguibile dal caso), ma la DIREZIONE coincide in
    // nove anni su dieci, e nove su dieci per caso capita all'incirca una volta
    // su cento. Tradotto: il fondo azzecca il verso, sbaglia la misura.
    // Riportare solo la correlazione direbbe "non c'entra niente"; riportare
    // solo la concordanza direbbe "lo segue bene". Nessuna delle due e' vera.
    azzeccaIlVerso: coppie.length >= 8 && concordi / coppie.length >= 0.8,
    seguelaMisura: r !== null && Math.abs(r) >= 0.6,
    verdetto: r === null ? null
      : (concordi / coppie.length >= 0.8 && Math.abs(r) < 0.6)
        ? 'il fondo va nella stessa direzione del metallo quasi ogni anno, ma di quanto si muove non lo dice: azzecca il verso e sbaglia la misura. E dieci anni sono pochi per appoggiarcisi.'
        : Math.abs(r) < 0.6
          ? 'il fondo NON segue in modo affidabile il valore delle terre rare: chi lo compra per esporsi al metallo si sta comprando altro'
          : 'il fondo si muove insieme al valore delle terre rare, per quel poco che dieci anni possono dire',
  };
}

// ── I testi ──
export function terreRareText() {
  const s = scarsitaOSconcentrazione();
  const c = chiLeProduce();
  const p = panicoDel2010();
  const parti = [];
  parti.push(`Sulle terre rare ho ${TR_ANNI} anni di dati, dal ${TR_DA}: li raccoglie lo Stato americano ed e' materiale pubblico. Non c'e' una quotazione di borsa, perche' si vendono per contratti diretti fra chi le estrae e chi le usa, ma c'e' quanto se ne e' prodotto, consumato e a che prezzo.`);
  parti.push(`La cosa che sorprende quasi tutti: non sono rare. Il nome inganna. Dal 1960 la produzione mondiale e' cresciuta ${s.produzioneMondiale.volteDal1960} volte e il prezzo, tolta l'inflazione, e' SCESO. Oggi costano meno di quanto costassero nel ${s.prezzoReale.da}.`);
  if (c.valido && c.daDominanteAZero) {
    // "il 82%" invece di "l'82%": il genere di dettaglio che fa sembrare
    // approssimativo tutto il resto della risposta.
    const pc = Math.round(c.massimoAmericano.quota * 100);
    const art = /^(8|11|18)/.test(String(pc)) ? "l'" : 'il ';
    parti.push(`Il problema vero e' un altro: nel ${c.massimoAmericano.anno} gli Stati Uniti producevano ${art}${pc}% delle terre rare del mondo, e per ${c.anniAQuotaZero} anni non ne hanno prodotta nemmeno una tonnellata. Non e' scarsita', e' dipendenza da chi le produce. Sono due problemi diversi e portano a conclusioni opposte.`);
  }
  if (p.valido) {
    parti.push(`E c'e' un precedente da tenere a mente. Nel 2010 la Cina taglio' le esportazioni, il prezzo sali' del ${Math.round(p.alPicco.salita * 100)}% e nacquero fondi apposta per cavalcarlo. ${p.tornatoSottoIlLivelloDiPartenza ? `Oggi il prezzo e' tornato SOTTO il livello da cui era partito` : `Oggi il prezzo e' ${Math.round(Math.abs(p.oggi.dalPicco) * 100)}% sotto quel picco`}. Chi compro' quando se ne parlava di piu' compro' il massimo: e' il modo in cui finiscono quasi tutti i panici da materia prima strategica.`);
  }
  return parti.join(' ');
}

// ── Quello che serve per disegnarle ──
// Il pannello ha anche gli anni senza prezzo (prima del 1922): passarli al
// grafico creerebbe un buco iniziale lungo un quinto della figura.
export function prezzoRealePerGrafico() {
  const primo = TR_PREZZO_REALE.findIndex((x) => x !== null);
  return primo < 0 ? [] : TR_PREZZO_REALE.slice(primo);
}
export function anniPerGrafico() {
  const primo = TR_PREZZO_REALE.findIndex((x) => x !== null);
  return primo < 0 ? [] : TR_ANNO.slice(primo).map(String);
}
