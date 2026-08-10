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
  return { giorno: +giorno, osservazioni: quante, su: giorni.length, tipo: 'giorno-fisso' };
}

// ── E CHI NON HA UN GIORNO FISSO? ──
// Una partita IVA non prende lo stipendio il 27: emette fatture quando finisce
// un lavoro, e incassa quando il cliente paga — che è un'altra data ancora.
// Cercare "il giorno del mese" lì non trova niente, e la striscia resterebbe
// muta proprio per il tipo di utente che ha più bisogno di sapere quando
// rientrano i soldi.
//
// Per loro la domanda giusta non è QUALE GIORNO ma OGNI QUANTO. Si guarda la
// distanza tipica fra un incasso e il successivo, e si conta da quello vero
// più recente. È meno preciso di un giorno fisso, e infatti viene dichiarato
// come "di solito ogni tot" invece che come una data: la differenza fra sapere
// e stimare deve restare visibile anche nell'interfaccia.
export const MINIMI_INCASSI_PER_IL_RITMO = 4;

export function ritmoDegliIncassi(txPerMese, { oggi = new Date() } = {}) {
  const date = [];
  for (const mk of Object.keys(txPerMese || {})) {
    for (const t of txPerMese[mk] || []) {
      if (t?.type === 'entrata' && t.date) date.push(String(t.date).slice(0, 10));
    }
  }
  if (date.length < MINIMI_INCASSI_PER_IL_RITMO) return null;
  date.sort();
  const distanze = [];
  for (let i = 1; i < date.length; i++) {
    const g = Math.round((new Date(date[i]) - new Date(date[i - 1])) / 86400000);
    // Due incassi lo stesso giorno o a un giorno di distanza sono lo stesso
    // evento spezzato in due fatture: non sono un ritmo.
    if (g >= 2 && g <= 120) distanze.push(g);
  }
  if (distanze.length < MINIMI_INCASSI_PER_IL_RITMO - 1) return null;
  distanze.sort((a, b) => a - b);
  // La MEDIANA, non la media: un cliente che ha pagato dopo quattro mesi non
  // deve spostare la stima per tutti gli altri.
  const tipica = distanze[Math.floor(distanze.length / 2)];
  // Quanto è regolare davvero: se le distanze ballano da 5 a 90 giorni, dire
  // "di solito ogni 30" è una bugia travestita da statistica.
  const scarti = distanze.map((d) => Math.abs(d - tipica)).sort((a, b) => a - b);
  const dispersione = scarti[Math.floor(scarti.length / 2)];
  // Soglia stretta, e verificata su casi veri: con 0,6 passava una serie con
  // intervalli di 5, 57 e 90 giorni — che non e' un ritmo, e' il caso. Se lo
  // scarto tipico supera un terzo dell'intervallo tipico, non si promette
  // niente. E la coda conta quanto il centro: un solo intervallo lontanissimo
  // dagli altri basta a togliere ogni valore alla previsione.
  if (dispersione > tipica * 0.35) return null;
  if (distanze[distanze.length - 1] > tipica * 2.2) return null;
  const ultimo = date[date.length - 1];
  const giorniDaUltimo = Math.round((oggi - new Date(ultimo)) / 86400000);
  return {
    tipo: 'ritmo', ogniGiorni: tipica, dispersione,
    ultimoIncasso: ultimo, giorniDaUltimo,
    // Può essere negativo: vuol dire che è già in ritardo rispetto al solito,
    // ed è un'informazione utile, non un errore da nascondere.
    giorniAlProssimo: tipica - giorniDaUltimo,
    osservazioni: distanze.length + 1,
  };
}

// Quale dei due modi descrive questa persona. Il giorno fisso vince quando
// c'è: è più preciso e più facile da capire.
export function quandoEntranoISoldi(txPerMese, { oggi = new Date(), meseCorrente = null } = {}) {
  const fisso = giornoDelloStipendio(txPerMese, { meseCorrente });
  const ritmo = ritmoDegliIncassi(txPerMese, { oggi });
  // IL GIORNO FISSO NON REGGE SE NON INCASSA DA UN PEZZO. Una partita IVA che
  // fattura a inizio mese somiglia a uno stipendio al giorno 2, e finche' i
  // soldi arrivano la differenza non conta. Ma se l'ultimo incasso e' di due
  // mesi fa, raccontarlo come "di solito arrivavano il 2, sono 8 giorni"
  // nasconde il fatto vero: sono sessantanove giorni che non entra niente.
  // Quando la storia del giorno fisso e' smentita dai fatti, vince il ritmo —
  // che quel ritardo lo misura per intero.
  if (fisso && ritmo && ritmo.giorniDaUltimo > Math.max(45, ritmo.ogniGiorni * 1.4)) return ritmo;
  return fisso || ritmo;
}

const giorniNelMese = (anno, mese) => new Date(anno, mese, 0).getDate();

// ── Lo stato del mese, in numeri prima che in pixel ──
export function statoDelMese(txPerMese, { oggi = new Date(), speso = 0 } = {}) {
  const anno = oggi.getFullYear(), mese = oggi.getMonth() + 1;
  const mk = `${anno}-${String(mese).padStart(2, '0')}`;
  const totale = giorniNelMese(anno, mese);
  const giornoOggi = oggi.getDate();
  const schema = quandoEntranoISoldi(txPerMese, { oggi, meseCorrente: mk });
  const entrataArrivata = (txPerMese?.[mk] || []).some((t) => t?.type === 'entrata');

  // Due modi di sapere quando entrano i soldi, e due gradi di certezza
  // diversi. Il giorno fisso è una data; il ritmo è una stima, e resta
  // dichiarata come tale fino all'etichetta che l'utente legge.
  let giornoPaga = null, giorniAllaPaga = null, certezza = null, inRitardo = false;
  if (schema?.tipo === 'giorno-fisso') {
    giornoPaga = schema.giorno;
    // IL RITARDO CHE SPARIVA. Se il giorno solito e' gia' passato e non e'
    // arrivato niente, puntare al mese prossimo e dire "fra 23 giorni" nasconde
    // l'unica cosa che conta davvero: che questo mese i soldi non ci sono.
    // Trovato provando una partita IVA che fattura a inizio mese — sembrava uno
    // stipendio fisso al giorno 2, e un ritardo di trentanove giorni non
    // compariva da nessuna parte. Vale identico per un dipendente: uno
    // stipendio che non arriva il giorno solito e' una notizia.
    inRitardo = schema.giorno < giornoOggi && !entrataArrivata;
    giorniAllaPaga = (schema.giorno >= giornoOggi && !entrataArrivata)
      ? schema.giorno - giornoOggi
      : inRitardo ? -(giornoOggi - schema.giorno)
        : totale - giornoOggi + schema.giorno;
    certezza = 'data';
  } else if (schema?.tipo === 'ritmo') {
    giorniAllaPaga = schema.giorniAlProssimo;
    // Il giorno stimato può cadere nel mese dopo: in quel caso non c'è un
    // punto da mettere sulla striscia di QUESTO mese, e il segno non si mette.
    const g = giornoOggi + giorniAllaPaga;
    giornoPaga = g >= 1 && g <= totale ? g : null;
    certezza = 'stima';
    inRitardo = giorniAllaPaga < 0;
  }

  return {
    mese: mk, giorniTotali: totale, giornoOggi,
    quotaPassata: +(giornoOggi / totale).toFixed(3),
    giornoPaga, pagaAffidabile: !!schema, certezza, inRitardo,
    ogniGiorni: schema?.tipo === 'ritmo' ? schema.ogniGiorni : null,
    entrataArrivata, giorniAllaPaga,
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
  const mostraPaga = stato.pagaAffidabile && stato.giornoPaga !== null
    && (stato.inRitardo || (stato.giornoPaga >= stato.giornoOggi
      && (stato.certezza === 'stima' || !stato.entrataArrivata)));
  const pagaX = mostraPaga ? x(stato.giornoPaga) : null;

  // Le parole cambiano con quanto si sa davvero. "Stipendio fra 17 giorni" è
  // una promessa: si può dire solo quando il giorno è fisso. Per chi fattura
  // si dice "di solito incassi ogni 33 giorni", che è quello che i dati
  // sostengono — e se è già in ritardo rispetto al proprio ritmo, lo si dice
  // invece di far finta che tutto proceda.
  let etichettaPaga = null;
  if (stato.inRitardo) {
    const g = Math.abs(stato.giorniAllaPaga);
    etichettaPaga = stato.certezza === 'data'
      ? `di solito arrivavano il ${stato.giornoPaga}: sono ${g} giorni`
      : `di solito incassi ogni ${stato.ogniGiorni} giorni: sei a ${stato.ogniGiorni + g}`;
  } else if (mostraPaga && stato.certezza === 'data') {
    etichettaPaga = stato.giorniAllaPaga === 0 ? 'stipendio oggi'
      : stato.giorniAllaPaga === 1 ? 'stipendio domani'
        : `stipendio fra ${stato.giorniAllaPaga} giorni`;
  } else if (stato.certezza === 'stima') {
    etichettaPaga = stato.giorniAllaPaga === 0
      ? `di solito incassi ogni ${stato.ogniGiorni} giorni: ci siamo`
      : `di solito incassi fra ~${stato.giorniAllaPaga} giorni`;
  }

  // La descrizione per chi non vede la striscia si compone dai pezzi che ci
  // sono davvero: concatenare a vuoto produceva "Giorno 10 di 31. . Speso...",
  // e un doppio punto letto ad alta voce e' una pausa senza motivo.
  const pezzi = [`Giorno ${stato.giornoOggi} di ${stato.giorniTotali}`];
  if (etichettaPaga) pezzi.push(etichettaPaga);
  else if (stato.entrataArrivata) pezzi.push('stipendio gia\' arrivato');
  pezzi.push(`speso finora ${formatMoney(stato.speso)}`);

  // ── L'ORBITA ──
  // La striscia era dritta e l'orb e' rotondo: due geometrie che non si
  // parlano. Adesso il mese e' un ARCO — un pezzo di orbita attorno a
  // qualcosa, che e' letteralmente cosa fa il tempo che gira. Curvo, non
  // dritto, e quindi parente dell'orb invece che estraneo.
  //
  // SVG e non div: una curva con un punto che ci scorre sopra e un alone
  // esattamente sul punto giusto non si fa con i rettangoli. E resta una
  // stringa pura, senza DOM, come tutto il resto del modulo.
  const W = 300, H = 34, R = 8;         // arco basso: si sente, non si nota
  const y = (t) => H - 12 - Math.sin(Math.PI * t) * R;
  const px = (t) => 6 + t * (W - 12);
  const punto = (t) => `${px(t).toFixed(1)},${y(t).toFixed(2)}`;

  // Il tracciato completo e quello gia' percorso, campionati sulla stessa
  // curva: se usassi due formule diverse non combacerebbero mai davvero.
  const traccia = (da, a) => {
    const passi = Math.max(2, Math.round((a - da) * 48));
    const p = [];
    for (let i = 0; i <= passi; i++) p.push(punto(da + ((a - da) * i) / passi));
    return `M${p.join(' L')}`;
  };
  const tOggi = Math.max(0, Math.min(1, stato.giornoOggi / stato.giorniTotali));
  const tPaga = pagaX === null ? null : Math.max(0, Math.min(1, pagaX / 100));

  return `<div class="mese-strip" role="img" aria-label="${esc(`${pezzi.join('. ')}.`)}">
    <svg class="ms-orbita" viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ms-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--primary)" stop-opacity="0"/>
          <stop offset="55%" stop-color="var(--primary)" stop-opacity=".45"/>
          <stop offset="100%" stop-color="var(--cyan, var(--primary))" stop-opacity="1"/>
        </linearGradient>
        <radialGradient id="ms-alone">
          <stop offset="0%" stop-color="var(--cyan, var(--primary))" stop-opacity=".9"/>
          <stop offset="45%" stop-color="var(--cyan, var(--primary))" stop-opacity=".22"/>
          <stop offset="100%" stop-color="var(--cyan, var(--primary))" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="ms-oro">
          <stop offset="0%" stop-color="var(--gold, #eab308)" stop-opacity=".55"/>
          <stop offset="55%" stop-color="var(--gold, #eab308)" stop-opacity=".14"/>
          <stop offset="100%" stop-color="var(--gold, #eab308)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path class="ms-rotta" d="${traccia(0, 1)}" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="1.2" stroke-linecap="round"/>
      ${tPaga !== null ? `<ellipse class="ms-paga${stato.certezza === 'stima' ? ' stimata' : ''}" cx="${px(tPaga).toFixed(1)}" cy="${y(tPaga).toFixed(2)}" rx="15" ry="8" fill="url(#ms-oro)"/>` : ''}
      <path class="ms-passato" d="${traccia(0, tOggi)}" fill="none" stroke="url(#ms-g)" stroke-width="2.2" stroke-linecap="round" pathLength="100"/>
      <circle class="ms-alone" cx="${px(tOggi).toFixed(1)}" cy="${y(tOggi).toFixed(2)}" r="11" fill="url(#ms-alone)"/>
      <circle class="ms-oggi" cx="${px(tOggi).toFixed(1)}" cy="${y(tOggi).toFixed(2)}" r="2.4" fill="#fff"/>
    </svg>
    <div class="ms-righe">
      <span class="ms-speso">${esc(formatMoney(stato.speso))} spesi</span>
      ${etichettaPaga ? `<span class="ms-attesa">${esc(etichettaPaga)}</span>` : ''}
    </div>
  </div>`;
}
