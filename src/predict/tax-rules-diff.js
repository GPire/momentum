// ============================================================
// COSA È CAMBIATO NELLE REGOLE FISCALI — dirlo, non solo applicarlo
// ============================================================
// Fino a ieri l'aggiornamento delle regole non toccava nessun numero (difetto
// corretto in tax-rules.js: setActiveTaxRules). Ora lo tocca — e nasce subito
// il problema opposto, più sottile: **un numero che cambia da solo, senza che
// nessuno lo dica, è peggio di un numero vecchio**. La persona ha visto
// "metti da parte 4.320 €" a giugno, apre l'app a settembre e legge 3.900 €:
// senza una spiegazione l'unica conclusione ragionevole è che l'app sbagli, e
// da lì in poi non si fida più di nessun numero.
//
// Questo modulo non calcola niente di fiscale: confronta due set di regole e
// dice, in italiano e senza gergo, **cosa** è cambiato e **in che direzione**.
// È la stessa disciplina della provenienza già applicata ai dati di mercato:
// un numero che cambia deve poter rispondere a "perché?".
//
// Onestà sul limite: qui si confrontano le REGOLE, non si giudica se siano
// giuste. La firma prova chi le ha emesse, non che siano corrette — e questo
// modulo non pretende di saperlo.
'use strict';

const pct = (n) => `${(+n * 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}%`;
const eur = (n) => `${Math.round(+n).toLocaleString('it-IT')} €`;

// Campi semplici: etichetta leggibile + come si formatta + se salire è un bene
// per chi legge. `favorevoleSeSale` serve solo a scegliere le parole, mai a
// nascondere un cambiamento: si dicono entrambe le direzioni.
const CAMPI = [
  { key: 'forfettarioCeiling', etichetta: 'il tetto del regime forfettario', fmt: eur, favorevoleSeSale: true },
  { key: 'impostaStd', etichetta: 'l\'imposta sostitutiva del forfettario', fmt: pct, favorevoleSeSale: false },
  { key: 'impostaStartup', etichetta: 'l\'imposta dei primi 5 anni (startup)', fmt: pct, favorevoleSeSale: false },
  { key: 'inpsGestioneSeparata', etichetta: 'i contributi INPS gestione separata', fmt: pct, favorevoleSeSale: false },
  { key: 'startupAnni', etichetta: 'gli anni di durata dell\'aliquota startup', fmt: (n) => `${n} anni`, favorevoleSeSale: true },
];

function diffScaglioni(prima, dopo) {
  const a = Array.isArray(prima) ? prima : [];
  const b = Array.isArray(dopo) ? dopo : [];
  if (!a.length && !b.length) return null;
  if (a.length !== b.length) {
    return {
      campo: 'irpefScaglioni', etichetta: 'gli scaglioni IRPEF',
      testo: `Gli scaglioni IRPEF sono passati da ${a.length} a ${b.length}: la struttura dell'imposta è cambiata, non solo un'aliquota.`,
      rilevante: true,
    };
  }
  const cambi = [];
  for (let i = 0; i < b.length; i++) {
    if (a[i]?.aliquota !== b[i]?.aliquota) {
      const su = b[i].aliquota > a[i].aliquota;
      cambi.push(`il ${ordinale(i + 1)} scaglione ${su ? 'sale' : 'scende'} da ${pct(a[i].aliquota)} a ${pct(b[i].aliquota)}`);
    }
    if (a[i]?.fino !== b[i]?.fino) {
      const da = a[i].fino == null ? 'in su' : eur(a[i].fino);
      const to = b[i].fino == null ? 'in su' : eur(b[i].fino);
      cambi.push(`il limite del ${ordinale(i + 1)} scaglione passa da ${da} a ${to}`);
    }
  }
  if (!cambi.length) return null;
  return {
    campo: 'irpefScaglioni', etichetta: 'gli scaglioni IRPEF',
    testo: `IRPEF: ${cambi.join('; ')}.`,
    rilevante: true,
  };
}

const ORDINALI = ['primo', 'secondo', 'terzo', 'quarto', 'quinto'];
const ordinale = (n) => ORDINALI[n - 1] || `${n}°`;

function diffScadenze(prima, dopo) {
  const a = Array.isArray(prima) ? prima : [];
  const b = Array.isArray(dopo) ? dopo : [];
  if (!a.length && !b.length) return null;
  const perId = new Map(a.map((s) => [s.id, s]));
  const cambi = [];
  for (const s of b) {
    const vecchia = perId.get(s.id);
    if (!vecchia) { cambi.push(`una scadenza nuova: ${s.label} il ${s.giorno}/${s.mese}`); continue; }
    if (vecchia.mese !== s.mese || vecchia.giorno !== s.giorno) {
      cambi.push(`${s.label} si sposta dal ${vecchia.giorno}/${vecchia.mese} al ${s.giorno}/${s.mese}`);
    }
    if (vecchia.quota !== s.quota) {
      cambi.push(`${s.label} passa dal ${pct(vecchia.quota)} al ${pct(s.quota)} del totale`);
    }
  }
  for (const s of a) if (!b.some((x) => x.id === s.id)) cambi.push(`${s.label} non c'è più`);
  if (!cambi.length) return null;
  return {
    campo: 'scadenze', etichetta: 'le date di versamento',
    testo: `Date di versamento: ${cambi.join('; ')}.`,
    rilevante: true,
  };
}

// Confronta due set di regole PER LO STESSO ANNO. Ritorna sempre un array
// (vuoto se nulla è cambiato): mai null, così chi chiama non deve difendersi.
export function diffTaxRules(prima, dopo) {
  if (!prima || !dopo) return [];
  const out = [];
  for (const c of CAMPI) {
    const a = prima[c.key], b = dopo[c.key];
    if (a == null || b == null || a === b) continue;
    const sale = +b > +a;
    const buono = sale === c.favorevoleSeSale;
    out.push({
      campo: c.key,
      etichetta: c.etichetta,
      da: a, a: b, sale, favorevole: buono,
      testo: `${maiuscola(c.etichetta)} ${sale ? 'sale' : 'scende'} da ${c.fmt(a)} a ${c.fmt(b)}.`,
      rilevante: true,
    });
  }
  const sc = diffScaglioni(prima.irpefScaglioni, dopo.irpefScaglioni);
  if (sc) out.push(sc);
  const sd = diffScadenze(prima.scadenze, dopo.scadenze);
  if (sd) out.push(sd);
  return out;
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── IL CAMBIAMENTO CHE ARRIVA, non quello già arrivato ──
// BUG REALE trovato dal vivo il 2026-08-07: l'aggiornamento veniva scaricato e
// adottato correttamente, ma NESSUN avviso compariva. Il confronto guardava
// solo l'anno corrente, e il payload cambiava l'anno SUCCESSIVO — quindi zero
// differenze, zero avviso.
// Non era un dettaglio: è il caso NORMALE. La legge di bilancio si pubblica a
// dicembre ed entra in vigore a gennaio. Dire "l'imposta è cambiata" a gennaio
// è tardi — la persona ha già chiuso l'anno con i conti vecchi. Dirlo a
// dicembre ("dall'anno prossimo scende al 12%") è l'unica versione utile, ed è
// anche l'unica che permette di decidere qualcosa in tempo (anticipare o
// rimandare una fattura, per esempio).
// `snapPrima`/`snapDopo`: { 2026: regole, 2027: regole } — le regole viste per
// ciascun anno prima e dopo l'adozione.
export function describeRulesChangeMultiAnno(snapPrima, snapDopo, { annoCorrente = new Date().getFullYear() } = {}) {
  const anni = [...new Set([...Object.keys(snapPrima || {}), ...Object.keys(snapDopo || {})])]
    .map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const gruppi = [];
  for (const anno of anni) {
    const d = describeRulesChange(snapPrima?.[anno], snapDopo?.[anno], { anno });
    if (d) gruppi.push({ ...d, futuro: anno > annoCorrente });
  }
  if (!gruppi.length) return null;

  // Si dà la precedenza a ciò che è GIÀ in vigore (tocca i numeri di adesso);
  // il futuro si aggiunge, perché serve a decidere, non ad allarmare.
  const ora = gruppi.filter((g) => !g.futuro);
  const poi = gruppi.filter((g) => g.futuro);
  // DEDUPLICA (difetto visto dal vivo): `rulesForYear` ripiega sull'ultimo
  // anno noto, quindi guardando 2027 e 2028 la STESSA modifica compare due
  // volte — "dal 2027 l'imposta scende al 12%" e "dal 2028 l'imposta scende al
  // 12%". È falso: l'imposta è scesa una volta sola, nel 2027, e nel 2028 non
  // è cambiato niente. Ripeterlo fa sembrare due notizie dove ce n'è una, ed è
  // il tipo di rumore che insegna a ignorare gli avvisi.
  // Si tiene la PRIMA volta in cui ogni cambiamento entra in vigore.
  const visti = new Set();
  const cambi = [...ora, ...poi].flatMap((g) => g.cambi.map((c) => ({
    ...c,
    anno: g.anno,
    // Il tempo verbale cambia il significato: "scende" è adesso, "scenderà" è
    // una cosa su cui puoi ancora agire.
    testo: g.futuro ? `Dal ${g.anno}: ${c.testo.charAt(0).toLowerCase()}${c.testo.slice(1)}` : c.testo,
  }))).filter((c) => {
    const firma = `${c.campo}|${c.da}|${c.a}|${c.testo.replace(/^Dal \d{4}: /, '')}`;
    if (visti.has(firma)) return false;
    visti.add(firma);
    return true;
  });
  const favorevoli = cambi.filter((c) => c.favorevole === true).length;
  const sfavorevoli = cambi.filter((c) => c.favorevole === false).length;
  const soloFuturo = !ora.length;
  return {
    cambi,
    quanti: cambi.length,
    anni: gruppi.map((g) => g.anno),
    soloFuturo,
    tono: favorevoli && !sfavorevoli ? 'favorevole' : sfavorevoli && !favorevoli ? 'sfavorevole' : 'neutro',
    titolo: soloFuturo
      ? `Dal ${poi[0].anno} cambiano le regole fiscali`
      : (cambi.length === 1 ? 'Una regola fiscale è cambiata' : `${cambi.length} regole fiscali sono cambiate`),
    sintesi: cambi[0].testo + (cambi.length > 1 ? ` E altre ${cambi.length - 1}.` : ''),
    nota: soloFuturo
      ? 'I tuoi numeri di quest\'anno non cambiano. Te lo dico ora perché sei ancora in tempo per tenerne conto.'
      : 'I numeri che vedi qui sono già ricalcolati con le regole nuove. Se avevi appuntato un importo di prima, quello vecchio non vale più.',
  };
}

// Il messaggio da mostrare (o notificare) quando un aggiornamento è stato
// adottato. Ritorna null se non è cambiato niente di rilevante: **non si
// disturba nessuno per dire "è tutto uguale"**, che è il modo più veloce per
// far ignorare anche gli avvisi che contano.
export function describeRulesChange(prima, dopo, { anno = new Date().getFullYear() } = {}) {
  const cambi = diffTaxRules(prima, dopo);
  if (!cambi.length) return null;
  const favorevoli = cambi.filter((c) => c.favorevole === true).length;
  const sfavorevoli = cambi.filter((c) => c.favorevole === false).length;
  let tono = 'neutro';
  if (favorevoli && !sfavorevoli) tono = 'favorevole';
  else if (sfavorevoli && !favorevoli) tono = 'sfavorevole';
  return {
    anno,
    cambi,
    quanti: cambi.length,
    tono,
    titolo: cambi.length === 1 ? 'Una regola fiscale è cambiata' : `${cambi.length} regole fiscali sono cambiate`,
    // Frase breve per la notifica: la prima cosa cambiata, non un riassunto
    // generico. "Una regola è cambiata" da solo non dice niente e non fa
    // aprire l'app; "l'imposta scende dal 15% al 12%" sì.
    sintesi: cambi[0].testo + (cambi.length > 1 ? ` E altre ${cambi.length - 1}.` : ''),
    // Va SEMPRE detto: i numeri già visti cambiano, e la persona deve sapere
    // perché senza doverlo dedurre.
    nota: 'I numeri che vedi qui sono già ricalcolati con le regole nuove. Se avevi appuntato un importo di prima, quello vecchio non vale più.',
  };
}
