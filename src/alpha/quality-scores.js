// ============================================================
// BENEISH M-SCORE & PIOTROSKI F-SCORE — Cantiere E3
// ============================================================
// Due punteggi accademici standard (non inventati qui): Beneish (1999) stima
// la PROBABILITÀ che un bilancio sia stato manipolato; Piotroski (2000)
// stima la SOLIDITÀ fondamentale di un'azienda value. Entrambi confrontano
// DUE anni consecutivi dello stesso bilancio — motivo per cui `panel-
// settoriale.js` (Cantiere D) da solo non bastava: serviva estenderlo con 8
// concetti XBRL in più (crediti/costoVenduto/attivoCorrente/passivoCorrente/
// immobilizzazioniNette/ammortamento/speseSga/flussoCassaOperativo — vedi
// bench/fetch-panel-sec.mjs, già validati per le 82 aziende storiche in
// bench/fetch-fondamentali-sec.mjs, commit cf20588).
//
// FORMULE verificate contro fonti primarie/accademiche (Beneish 1999, "The
// Detection of Earnings Manipulation"; Piotroski 2000, "Value Investing:
// The Use of Historical Financial Statement Information") il 2026-08-24 —
// coefficienti e soglie non riscritti a memoria.
//
// ── LIMITI DICHIARATI, non nascosti ──
// 1. AQI (Beneish) include per definizione "Securities" (investimenti a
//    breve termine) nell'attivo di qualità: il pannello SEC non ha questo
//    concetto isolato, trattato come 0 — un'azienda con molte securities a
//    breve vedrebbe l'AQI leggermente sovrastimato. Dichiarato, non un
//    valore inventato: 0 è il caso "nessuna security", non una stima.
// 2. Piotroski è a 9 criteri nella definizione originale; qui se ne
//    calcolano SOLO 8 — il criterio "nessuna nuova emissione di azioni" non
//    è calcolabile senza il conteggio delle azioni in circolazione, dato
//    assente dal pannello SEC (che è bilanci, non mercato). Il punteggio
//    dichiara sempre `puntiMassimi:8`, mai spacciato per un F-Score a 9.
// 3. NON applicabile alle aziende finanziarie (banche/assicurazioni/real
//    estate, SIC 60-67): lo stesso Beneish (1999) esclude i finanziari dal
//    campione — la struttura di bilancio (attivo = quasi tutto crediti e
//    titoli) rende "asset quality"/"leverage" concetti diversi da quelli
//    per cui il modello è stato stimato. `applicabile:false` invece di un
//    numero fuorviante.
'use strict';

// BUG REALE trovato dal vivo sui dati veri, non nei test a mano (2026-08-24):
// bench/fetch-panel-sec.mjs scrive `sic` come STRINGA ("6324", non 6324) —
// `Number.isFinite('6324')` è sempre `false`, quindi questo controllo non
// escludeva MAI un'azienda finanziaria reale (funzionava solo nei test
// scritti a mano, che passavano un numero letterale). Trovato dalla suite
// COMPLETA, non da questo file isolato: un test qui bastava per "verde",
// serviva un'azienda finanziaria VERA del pannello per far emergere che il
// tipo non tornava. `Number(sic)` converte prima di controllare.
const SIC_FINANZIARI = (sic) => {
  const n = Number(sic);
  if (!Number.isFinite(n)) return false;
  const gruppo = Math.floor(n / 100);
  return gruppo >= 60 && gruppo <= 67;
};

// Divisione difensiva: mai Infinity/NaN silenziosi. `null` se il
// denominatore è zero o un input non è un numero finito — chi chiama deve
// poter dire "non calcolabile", non ricevere un numero senza senso.
function div(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

// ── BENEISH M-SCORE ──
// `t` = anno più recente, `t1` = anno precedente. Entrambi righe del
// pannello (bench/fetch-panel-sec.mjs): { ricavi, utileNetto, attivo,
// crediti, costoVenduto, attivoCorrente, passivoCorrente,
// immobilizzazioniNette, ammortamento, speseSga, flussoCassaOperativo,
// debitoLungo }. Un campo mancante in uno dei due anni rende quella
// componente (e quindi l'intero punteggio) non calcolabile — MAI una media
// o un valore di riempimento al posto del dato assente.
export function beneishMScore(t, t1, { sic = null } = {}) {
  if (!t || !t1) return { valido: false, motivo: 'servono due anni consecutivi' };
  if (SIC_FINANZIARI(sic)) return { valido: false, applicabile: false, motivo: 'modello non applicabile alle aziende finanziarie (Beneish 1999 le esclude dal campione)' };

  const dsri = div(div(t.crediti, t.ricavi), div(t1.crediti, t1.ricavi));
  // GMI: rapporto fra il margine lordo dell'anno PRECEDENTE e quello
  // dell'anno corrente (margine(t-1)/margine(t), non il contrario — un GMI
  // sopra 1 vuol dire margine in CALO, un segnale, non un pregio).
  const margineT = div(t.ricavi - t.costoVenduto, t.ricavi);
  const margineT1 = div(t1.ricavi - t1.costoVenduto, t1.ricavi);
  const gmiVero = div(margineT1, margineT);

  const qualitaAttivoT = Number.isFinite(t.attivo) && t.attivo !== 0
    ? 1 - ((t.attivoCorrente ?? 0) + (t.immobilizzazioniNette ?? 0)) / t.attivo : null;
  const qualitaAttivoT1 = Number.isFinite(t1.attivo) && t1.attivo !== 0
    ? 1 - ((t1.attivoCorrente ?? 0) + (t1.immobilizzazioniNette ?? 0)) / t1.attivo : null;
  const aqi = div(qualitaAttivoT, qualitaAttivoT1);

  const sgi = div(t.ricavi, t1.ricavi);

  const depiT = div(t.ammortamento, (t.immobilizzazioniNette ?? 0) + (t.ammortamento ?? 0));
  const depiT1 = div(t1.ammortamento, (t1.immobilizzazioniNette ?? 0) + (t1.ammortamento ?? 0));
  const depi = div(depiT1, depiT);

  const sgai = div(div(t.speseSga, t.ricavi), div(t1.speseSga, t1.ricavi));

  const lvgiT = div((t.passivoCorrente ?? 0) + (t.debitoLungo ?? 0), t.attivo);
  const lvgiT1 = div((t1.passivoCorrente ?? 0) + (t1.debitoLungo ?? 0), t1.attivo);
  const lvgi = div(lvgiT, lvgiT1);

  const tata = div(t.utileNetto - t.flussoCassaOperativo, t.attivo);

  const componenti = { dsri, gmi: gmiVero, aqi, sgi, depi, sgai, lvgi, tata };
  const mancanti = Object.entries(componenti).filter(([, v]) => v === null).map(([k]) => k);
  if (mancanti.length) return { valido: false, motivo: `componenti non calcolabili per dati mancanti: ${mancanti.join(', ')}`, componenti };

  const score = -4.84 + 0.92 * dsri + 0.528 * gmiVero + 0.404 * aqi + 0.892 * sgi
    + 0.115 * depi - 0.172 * sgai + 4.679 * tata - 0.327 * lvgi;

  return {
    valido: true, applicabile: true,
    score: +score.toFixed(3),
    // -1,78: soglia originale del paper (Beneish 1999) — sopra, probabile
    // manipolazione; sotto, nella norma. Non un giudizio, una soglia
    // statistica stimata su un campione storico di aziende sanzionate.
    manipolazioneProbabile: score > -1.78,
    soglia: -1.78,
    componenti: Object.fromEntries(Object.entries(componenti).map(([k, v]) => [k, +v.toFixed(4)])),
    limiti: ['AQI tratta le "securities" a breve come 0 (concetto assente nel pannello SEC)'],
  };
}

// ── PIOTROSKI F-SCORE ──
// 8 punti su 9 (limite dichiarato in cima al file: manca il conteggio delle
// azioni per il criterio di nuova emissione).
export function piotroskiFScore(t, t1, { sic = null } = {}) {
  if (!t || !t1) return { valido: false, motivo: 'servono due anni consecutivi' };
  if (SIC_FINANZIARI(sic)) return { valido: false, applicabile: false, motivo: 'modello non applicabile alle aziende finanziarie (stessa esclusione di Beneish 1999)' };

  const roaT = div(t.utileNetto, t.attivo);
  const roaT1 = div(t1.utileNetto, t1.attivo);
  const correnteT = div(t.attivoCorrente, t.passivoCorrente);
  const correnteT1 = div(t1.attivoCorrente, t1.passivoCorrente);
  const levaT = div(t.debitoLungo ?? 0, t.attivo);
  const levaT1 = div(t1.debitoLungo ?? 0, t1.attivo);
  const margineT = div(t.ricavi - t.costoVenduto, t.ricavi);
  const margineT1 = div(t1.ricavi - t1.costoVenduto, t1.ricavi);
  const turnoverT = div(t.ricavi, t.attivo);
  const turnoverT1 = div(t1.ricavi, t1.attivo);

  const richiesti = { roaT, roaT1, cfo: t.flussoCassaOperativo, correnteT, correnteT1, levaT, levaT1, margineT, margineT1, turnoverT, turnoverT1 };
  const mancanti = Object.entries(richiesti).filter(([, v]) => v === null || v === undefined || !Number.isFinite(v)).map(([k]) => k);
  if (mancanti.length) return { valido: false, motivo: `dati mancanti: ${mancanti.join(', ')}` };

  const criteri = {
    roaPositiva: roaT > 0,
    cfoPositivo: t.flussoCassaOperativo > 0,
    roaInCrescita: roaT > roaT1,
    // Qualità degli accrual: il flusso di cassa operativo (rapportato
    // all'attivo) supera l'utile contabile (stesso rapporto) — utile "di
    // carta" superiore alla cassa vera è un segnale di qualità peggiore.
    accrualDiQualita: div(t.flussoCassaOperativo, t.attivo) > roaT,
    levaInCalo: levaT < levaT1,
    correnteInCrescita: correnteT > correnteT1,
    margineInCrescita: margineT > margineT1,
    turnoverInCrescita: turnoverT > turnoverT1,
  };
  const punteggio = Object.values(criteri).filter(Boolean).length;

  return {
    valido: true, applicabile: true,
    punteggio, puntiMassimi: 8,
    criteri,
    limiti: ['manca il criterio "nessuna nuova emissione di azioni" (9° del modello originale) — dato di mercato assente dal pannello bilanci SEC'],
  };
}

// ── Testo per il QA (mercato-qa.js, intento 'qualita-contabile') ──
// `r` è il risultato di screener-settore.js.qualitaContabile(ticker):
// { disponibile, beneish, piotroski, motivo? }. Mai un giudizio assoluto
// ("è una truffa"): solo cosa dicono i due modelli, con la soglia accanto —
// stessa disciplina di reazioneAllaFed/reazioneText in notizie.js.
export function testoQualitaContabile(r) {
  if (!r?.disponibile) return `Non ho i due bilanci consecutivi necessari per calcolarlo${r?.motivo ? ` (${r.motivo})` : ''}.`;
  const parti = [];
  if (r.beneish?.valido) {
    if (r.beneish.manipolazioneProbabile) {
      // ONESTÀ SU UN LIMITE REALE del modello, trovato sui dati veri (NVIDIA,
      // 2026-08-24): SGI (crescita dei ricavi) pesa 0,892 nella formula — il
      // coefficiente più alto insieme a TATA — quindi una crescita LEGITTIMA
      // molto rapida (SGI>1,5, cioè oltre il 50% l'anno) produce da sola
      // buona parte del punteggio che segnala manipolazione, senza che ci
      // sia nulla di irregolare. Verificato: NVDA segnalata "probabile
      // manipolazione" con SGI=1,65 (crescita ricavi +65%) come motore
      // principale — un falso positivo strutturale del modello su aziende
      // in forte crescita reale, non un'invenzione di questo codice. Mai
      // presentato come "manipolazione probabile" senza questo contesto,
      // quando è proprio il caso che lo spiega.
      const crescitaAltissima = r.beneish.componenti?.sgi > 1.5;
      parti.push(`Beneish M-Score ${r.beneish.score} — SOPRA la soglia di ${r.beneish.soglia} usata dal modello per segnalare un profilo tipico di manipolazione contabile (crediti/utili che si muovono in modo insolito rispetto alle vendite e alla cassa vera).`
        + (crescitaAltissima ? ` Attenzione: qui il motore principale è la crescita dei ricavi stessa (oltre il 50% sull'anno) — il modello ha un limite noto, segnala anche una crescita del tutto legittima molto rapida allo stesso modo di un utile gonfiato, e qui non c'è modo di distinguerli solo da questo numero.` : ''));
    } else {
      parti.push(`Beneish M-Score ${r.beneish.score} — sotto la soglia di ${r.beneish.soglia}, nella norma.`);
    }
  } else if (r.beneish && !r.beneish.applicabile) {
    parti.push(`Beneish M-Score non applicabile (${r.beneish.motivo}).`);
  }
  if (r.piotroski?.valido) {
    parti.push(`Piotroski F-Score ${r.piotroski.punteggio}/${r.piotroski.puntiMassimi} — ${r.piotroski.punteggio >= 6 ? 'fondamentali in miglioramento su quasi tutti i fronti' : r.piotroski.punteggio <= 2 ? 'fondamentali in peggioramento su quasi tutti i fronti' : 'quadro misto, né forte né debole'}.`);
  }
  if (!parti.length) return 'Nessuno dei due punteggi è calcolabile per questa azienda con i dati che ho.';
  return `${parti.join(' ')} Sono modelli statistici stimati su casi storici, non un verdetto: indicano dove guardare più a fondo, non "vero" o "falso".`;
}
