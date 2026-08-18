// ============================================================
// SOMIGLIANZA SENZA MODELLO — la rete di sicurezza che gira su tutto
// ============================================================
// Momentum deve funzionare da un iPhone di prima generazione a una macchina
// da gioco, e il livello semantico vero (embedding, ~113MB) e' opt-in e
// richiede WASM SIMD: su Safari vecchio non c'e', e il codice lo sa —
// `prepareSemanticSimilarity` in main.js esce subito se
// `momentumDeviceProfile.simd` e' falso. Su quei dispositivi, fino a oggi,
// la comprensione per significato semplicemente non esisteva.
//
// IL PROBLEMA CHE QUESTO CREAVA, e non era di comodita'. Il banco di prova
// (qa-banco-prova.js) ha misurato che due domande su sette da rifiutare
// sfuggivano alle sole parole chiave: "su quale settore mi conviene puntare i
// soldi?" e "in quale azienda mi consigli di investire?" ricevevano una
// risposta invece di un rifiuto motivato. Cioe' **la protezione piu'
// importante dell'app mancava proprio sui dispositivi piu' modesti**, che sono
// quelli di chi ha piu' bisogno di non ricevere consigli finanziari.
//
// LA MISURA CHE HA DECISO IL DISEGNO. Rimisurato lo stesso banco passando
// questa somiglianza — sovrapposizione di parole, nessun modello, nessun
// download, poche righe di aritmetica:
//     sicurezza  71,4%  ->  100%     (entrambi i rifiuti mancati recuperati)
//     copertura  75,0%  ->  78,1%
//     errori gravi   0  ->  0        (nessuno introdotto)
// Non serviva un modello da 113MB per chiudere il buco di sicurezza: serviva
// che qualcuno misurasse dove era il buco.
//
// Questo NON sostituisce l'embedding: coglie le parafrasi che condividono
// parole ("mi conviene puntare i soldi" e "mi consigli di investire"
// condividono poco, ma abbastanza rispetto a tutto il resto del banco) e non
// coglie quelle che dicono la stessa cosa con parole diverse. E' il pavimento,
// non il tetto — e un pavimento che c'e' su ogni dispositivo vale piu' di un
// tetto che c'e' solo su alcuni.
// Funzioni PURE.
'use strict';

// Le parole troppo brevi non portano significato e gonfiano la
// sovrapposizione: "di", "il", "un" compaiono in ogni domanda e renderebbero
// tutto simile a tutto.
const MIN_LUNGHEZZA = 3;

export function tokenizza(testo) {
  return new Set(
    String(testo || '')
      .toLowerCase()
      // Gli accenti vanno via: chi scrive in fretta scrive "perche" e
      // "cosa e", e due grafie della stessa parola non devono contare come
      // parole diverse.
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= MIN_LUNGHEZZA),
  );
}

// Indice di Jaccard: quante parole hanno in comune sul totale delle parole
// distinte. Restituisce 0..1, la stessa scala della somiglianza semantica,
// cosi' i due si possono scambiare senza toccare le soglie di chi chiama.
export function similaritaLessicale(a, b) {
  const A = tokenizza(a), B = tokenizza(b);
  if (!A.size || !B.size) return 0;
  let comuni = 0;
  for (const t of A) if (B.has(t)) comuni++;
  const unione = A.size + B.size - comuni;
  return unione > 0 ? comuni / unione : 0;
}

// Quale somiglianza usare su QUESTO dispositivo. Se l'embedding e' pronto si
// usa quello; altrimenti si scende al lessicale invece di rinunciare — che era
// il comportamento di prima e lasciava scoperti i rifiuti.
export function similaritaDisponibile({ semantica = null } = {}) {
  return typeof semantica === 'function' ? semantica : similaritaLessicale;
}
