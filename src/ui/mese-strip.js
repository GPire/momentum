// ============================================================
// LA STRISCIA DEL MESE — mostrare invece di raccontare
// ============================================================
// Sotto l'orb c'era una frase: "Questo mese hai speso 922,13 €, e lo stipendio
// deve ancora arrivare." Vera, utile, e brutta — un paragrafo di prosa sotto un
// cerchio, in mezzo allo spazio vuoto. L'utente l'ha bocciata e aveva ragione:
// quella riga dice tre cose (a che punto del mese sei, quanto hai speso, quando
// entrano i soldi) e le dice tutte a parole, quando sono tutte e tre POSIZIONI
// NEL TEMPO — cioè la cosa che una riga disegnata mostra in un colpo d'occhio e
// una frase costringe a ricostruire leggendo.
//
// Qui c'è la stessa informazione come striscia: il mese da sinistra a destra,
// dove sei oggi, quando arriva lo stipendio, quanto è già passato. Si legge
// senza leggere, che è il punto.
//
// PERCHÉ È ANCHE PIÙ ONESTA DELLA FRASE. "Lo stipendio deve ancora arrivare"
// non dice fra quanto. Tre giorni e diciotto giorni sono situazioni
// completamente diverse e la frase le confonde; la striscia le distingue senza
// aggiungere una parola.
//
// IL GIORNO DELLO STIPENDIO NON SI CHIEDE, si osserva: è il giorno del mese in
// cui le entrate sono arrivate più spesso in passato. Se non c'è uno schema
// chiaro non si inventa — la striscia semplicemente non mostra quel segno.
//
// Funzioni PURE: entrano transazioni e una data, esce una stringa.
'use strict';

// Quante entrate servono per dire che esiste un giorno di paga ricorrente.
// Con due si vedono schemi ovunque; con tre si comincia a poterci contare.
export const MINIME_PER_LO_SCHEMA = 3;

// ── Il giorno dello stipendio, dedotto dalla storia ──
export function giornoDelloStipendio(txPerMese, { meseCorrente = null } = {}) {
  const giorni = [];
  for (const mk of Object.keys(txPerMese || {})) {
    if (meseCorrente && mk >= meseCorrente) continue; // il mese in corso non fa scuola
    for (const t of txPerMese[mk] || []) {
      if (t?.type !== 'entrata' || !t.date) continue;
      const g = +String(t.date).slice(8, 10);
      if (g >= 1 && g <= 31) giorni.push(g);
    }
  }
  if (giorni.length < MINIME_PER_LO_SCHEMA) return null;
  // La MODA, non la media: una media fra il 3 e il 27 darebbe il 15, un giorno
  // in cui non è mai arrivato niente. È lo stesso errore della temperatura
  // media di due stanze, una a 0 e una a 40 gradi.
  const conteggio = {};
  for (const g of giorni) conteggio[g] = (conteggio[g] || 0) + 1;
  const [giorno, quante] = Object.entries(conteggio).sort((a, b) => b[1] - a[1])[0];
  // Deve essere uno schema, non il caso: almeno metà delle entrate lo stesso giorno.
  if (quante / giorni.length < 0.5) return null;
  return { giorno: +giorno, osservazioni: quante, su: giorni.length };
}

const giorniNelMese = (anno, mese) => new Date(anno, mese, 0).getDate();

// ── Lo stato del mese, in numeri prima che in pixel ──
export function statoDelMese(txPerMese, { oggi = new Date(), speso = 0 } = {}) {
  const anno = oggi.getFullYear(), mese = oggi.getMonth() + 1;
  const mk = `${anno}-${String(mese).padStart(2, '0')}`;
  const totale = giorniNelMese(anno, mese);
  const giornoOggi = oggi.getDate();
  const paga = giornoDelloStipendio(txPerMese, { meseCorrente: mk });
  const entrataArrivata = (txPerMese?.[mk] || []).some((t) => t?.type === 'entrata');
  return {
    mese: mk, giorniTotali: totale, giornoOggi,
    quotaPassata: +(giornoOggi / totale).toFixed(3),
    giornoPaga: paga?.giorno ?? null,
    pagaAffidabile: !!paga,
    entrataArrivata,
    // Quanti giorni mancano allo stipendio. Se è già passato, il prossimo è il
    // mese dopo, e allora la distanza va contata oltre la fine del mese.
    giorniAllaPaga: paga
      ? (paga.giorno >= giornoOggi && !entrataArrivata
        ? paga.giorno - giornoOggi
        : totale - giornoOggi + paga.giorno)
      : null,
    speso: +(+speso).toFixed(2),
  };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── La striscia ──
// Larghezza 100, così il contenitore decide quanto è larga davvero e non serve
// sapere i pixel qui dentro.
export function stripHtml(stato, { formatMoney = (v) => `${v}` } = {}) {
  if (!stato?.giorniTotali) return '';
  const x = (giorno) => Math.max(0, Math.min(100, (giorno / stato.giorniTotali) * 100));
  const oggiX = x(stato.giornoOggi);

  // Il segno dello stipendio si mostra SOLO se lo schema è affidabile e la paga
  // non è ancora arrivata: dopo, indicare un giorno passato è rumore.
  const mostraPaga = stato.pagaAffidabile && !stato.entrataArrivata && stato.giornoPaga >= stato.giornoOggi;
  const pagaX = mostraPaga ? x(stato.giornoPaga) : null;

  const etichettaPaga = mostraPaga
    ? (stato.giorniAllaPaga === 0 ? 'stipendio oggi'
      : stato.giorniAllaPaga === 1 ? 'stipendio domani'
        : `stipendio fra ${stato.giorniAllaPaga} giorni`)
    : null;

  // La descrizione per chi non vede la striscia si compone dai pezzi che ci
  // sono davvero: concatenare a vuoto produceva "Giorno 10 di 31. . Speso...",
  // e un doppio punto letto ad alta voce e' una pausa senza motivo.
  const pezzi = [`Giorno ${stato.giornoOggi} di ${stato.giorniTotali}`];
  if (etichettaPaga) pezzi.push(etichettaPaga);
  else if (stato.entrataArrivata) pezzi.push('stipendio gia\' arrivato');
  pezzi.push(`speso finora ${formatMoney(stato.speso)}`);

  // LE SETTIMANE COME STELLE LUNGO LA ROTTA. Non sono decorazione: senza un
  // riferimento, una barra non dice se il tratto che manca sono cinque giorni
  // o venti. Con i punti settimanali si CONTA a colpo d'occhio — e "fra 17
  // giorni" smette di essere un numero astratto, diventa "due stelle e mezzo
  // piu' in la'". Quelle gia' passate si spengono, come tappe superate.
  const settimane = [];
  for (let g = 7; g < stato.giorniTotali; g += 7) {
    settimane.push(`<i class="ms-sett${g <= stato.giornoOggi ? ' passata' : ''}" style="left:${x(g).toFixed(1)}%"></i>`);
  }

  return `<div class="mese-strip" role="img" aria-label="${esc(`${pezzi.join('. ')}.`)}">
    <div class="ms-barra">
      <div class="ms-passato" style="--q:${oggiX.toFixed(1)}%"></div>
      ${settimane.join('')}
      ${pagaX !== null ? `<div class="ms-paga" style="left:${pagaX.toFixed(1)}%"></div>` : ''}
      <div class="ms-oggi" style="left:${oggiX.toFixed(1)}%"><span class="ms-scia"></span></div>
    </div>
    <div class="ms-righe">
      <span class="ms-speso">${esc(formatMoney(stato.speso))} spesi</span>
      ${etichettaPaga ? `<span class="ms-attesa">${esc(etichettaPaga)}</span>` : ''}
    </div>
  </div>`;
}
