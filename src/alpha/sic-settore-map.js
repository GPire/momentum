// ============================================================
// SIC → SETTORE SPDR (XLB/XLE/XLF/XLI/XLK/XLP/XLU/XLV/XLY)
// ============================================================
// PERCHÉ ESISTE: `capacita-registrate.js` ha già collegato 777 righe di
// analisi causale/comparativa (confronto-titoli.js, titolo-causale.js —
// permutation test, decomposizione prezzo-vs-mercato) ai 9 settori SPDR
// (historical-panel.js, 330 mesi, nessuna chiave) — ma dichiara ESPLICITO
// che non copre titoli arbitrari, perché non esiste uno storico prezzi
// mensile per singola azienda nel repo. Il pannello SEC (panel-settoriale.js,
// Cantiere D/E3) HA però il codice SIC di 600 aziende reali — quello che
// manca non è il dato del settore, è la CONVERSIONE da SIC (la
// classificazione della SEC) a uno dei 9 simboli SPDR (la classificazione
// che historical-panel.js usa). Questo file è quella conversione, e SOLO
// quella: non tocca nessuno dei moduli già scritti/testati.
//
// ── ONESTÀ SUL LIMITE, dichiarata non nascosta ──
// Non è un crosswalk GICS ufficiale (verificato: non esiste una tabella
// pubblica gratuita SIC→GICS, solo prodotti commerciali — cercato dal vivo,
// 2026-08-24). È costruito a mano sui GRANDI GRUPPI SIC pubblici (le
// "Division" ufficiali dello schema SIC — pubbliche, non proprietarie),
// verificato sui casi reali del pannello (Apple→Tecnologia, ExxonMobil→
// Energia, JPMorgan→Finanza). Ai CONFINI fra due settori (es. SIC 28 che
// contiene sia chimica industriale sia farmaceutica) la scelta è dichiarata
// nel commento, non indovinata in silenzio — e questo modulo restituisce
// SEMPRE quale delle due letture ha scelto, mai un settore senza motivo.
// Chi usa questa mappa deve trattare il risultato come un'APPROSSIMAZIONE
// SUL SETTORE, mai come "il titolo stesso": ogni testo che la usa lo dice.
'use strict';

// Intervalli SIC → simbolo SPDR. Ordine dal più specifico (3 cifre) al più
// generico (2 cifre) — un intervallo stretto sopra vince su uno largo sotto,
// perché serve a risolvere le sovrapposizioni dichiarate (28 sopra).
const REGOLE = [
  // Farmaceutica (283) è SALUTE, non chimica industriale — la scelta più
  // comune anche nelle classificazioni settoriali standard.
  { da: 2830, a: 2839, xl: 'XLV' },
  // Resto della chimica industriale (28 tolto 283) → Materiali.
  { da: 2800, a: 2829, xl: 'XLB' }, { da: 2840, a: 2899, xl: 'XLB' },
  // Computer/elettronica (357, 366-367) e servizi informatici (73) → Tecnologia.
  { da: 3570, a: 3579, xl: 'XLK' }, { da: 3600, a: 3699, xl: 'XLK' }, { da: 7370, a: 7379, xl: 'XLK' },
  // Comunicazioni (48): telecom — qui non esiste un settore SPDR dedicato
  // (XLC, "Communication Services", non è fra i 9 di historical-panel.js),
  // trattato come Tecnologia — approssimazione dichiarata, non un dato certo.
  { da: 4800, a: 4899, xl: 'XLK' },
  // Automotive (371) → Consumi discrezionali (un'auto è un acquisto
  // discrezionale, non industriale) — diverso dal resto del gruppo 37.
  { da: 3710, a: 3719, xl: 'XLY' },
  // Estrazione petrolio/gas (13) e raffinazione (29) → Energia.
  { da: 1300, a: 1399, xl: 'XLE' }, { da: 2900, a: 2999, xl: 'XLE' },
  // Miniere/metalli non-petroliferi (10-14 tolto 13), carta (26), gomma/
  // vetro/pietra (30-32), metalli primari (33) → Materiali.
  { da: 1000, a: 1099, xl: 'XLB' }, { da: 1400, a: 1499, xl: 'XLB' },
  { da: 2600, a: 2699, xl: 'XLB' }, { da: 3000, a: 3299, xl: 'XLB' }, { da: 3300, a: 3399, xl: 'XLB' },
  // Costruzioni (15-17), metalli lavorati (34), macchinari/elettrico
  // generico (35 tolto 357, 36 tolto 366-367), resto trasporti (37 tolto
  // 371), trasporto/logistica (40-42, 44, 45, 47) → Industria.
  { da: 1500, a: 1799, xl: 'XLI' }, { da: 3400, a: 3499, xl: 'XLI' },
  { da: 3500, a: 3569, xl: 'XLI' }, { da: 3580, a: 3599, xl: 'XLI' },
  { da: 3720, a: 3799, xl: 'XLI' },
  { da: 4000, a: 4299, xl: 'XLI' }, { da: 4400, a: 4599, xl: 'XLI' }, { da: 4700, a: 4799, xl: 'XLI' },
  // Cibo/bevande/tabacco (20-21), negozi alimentari (54) → Beni di prima necessità.
  { da: 2000, a: 2199, xl: 'XLP' }, { da: 5400, a: 5499, xl: 'XLP' },
  // Elettricità/gas/servizi igienici (49) → Utility.
  { da: 4900, a: 4999, xl: 'XLU' },
  // Servizi sanitari (80), strumenti medici (384, dentro 38 più ampio —
  // approssimato a tutto 38 per semplicità, dichiarato) → Salute.
  { da: 8000, a: 8099, xl: 'XLV' }, { da: 3800, a: 3899, xl: 'XLV' },
  // Retail generico (tolto 54, già Beni di prima necessità), alberghi (70),
  // intrattenimento/tempo libero (78-79) → Consumi discrezionali.
  { da: 5200, a: 5399, xl: 'XLY' }, { da: 5500, a: 5999, xl: 'XLY' },
  { da: 7000, a: 7099, xl: 'XLY' }, { da: 7800, a: 7999, xl: 'XLY' },
  // ECCEZIONE DICHIARATA, trovata verificando UnitedHealth sui dati veri
  // (SIC 6324 "Hospital & Medical Service Plans" → mappato a Finanza dalla
  // regola generica sotto avrebbe messo un'assicurazione sanitaria insieme
  // alle banche, un errore che chiunque conosca il settore noterebbe subito
  // — le assicurazioni sanitarie si muovono con la politica sanitaria e la
  // demografia, non con i tassi come le banche). Assicurazione
  // sanitaria/infortuni (6321-6324) → Salute, non Finanza — diverso, e
  // apposta, da `quality-scores.js.SIC_FINANZIARI` (che li tiene "finanziari"
  // per un motivo diverso: la struttura di bilancio da assicuratore rende
  // Beneish/Piotroski non applicabili comunque, indipendentemente dal
  // settore di mercato in cui si muove il titolo).
  { da: 6321, a: 6324, xl: 'XLV' },
  // Finanza/assicurazioni/immobiliare (60-67, tolta l'eccezione sopra) →
  // Finanza — STESSO intervallo di base già usato da src/alpha/quality-
  // scores.js (SIC_FINANZIARI), un solo posto dove "cosa conta come
  // finanziario" è definito, con l'unica eccezione dichiarata qui sopra.
  { da: 6000, a: 6799, xl: 'XLF' },
];

export const NOMI_SETTORE_SPDR = {
  XLB: 'Materiali', XLE: 'Energia', XLF: 'Finanza', XLI: 'Industria', XLK: 'Tecnologia',
  XLP: 'Beni di prima necessità', XLU: 'Utility', XLV: 'Salute', XLY: 'Consumi discrezionali',
};

// `null` onesto se il SIC non è riconosciuto o non rientra in nessuna
// regola — mai un settore indovinato per un codice fuori mappa.
export function sicASettoreETF(sic) {
  const n = Number(sic);
  if (!Number.isFinite(n)) return null;
  for (const r of REGOLE) if (n >= r.da && n <= r.a) return r.xl;
  return null;
}
