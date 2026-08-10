// ============================================================
// LE DOMANDE VERE — sei persone diverse, un solo motore
// ============================================================
// Un QA testato solo con le domande che chi lo scrive aveva in mente supera
// sempre i propri test. Qui le domande arrivano da sei punti di vista che
// chiedono cose molto diverse, e alcune sono deliberatamente domande a cui
// Momentum NON deve saper rispondere: servono a verificare che rifiuti invece
// di improvvisare.
//
// Il test non pretende copertura totale — sarebbe una bugia — ma misura la
// copertura e la blocca dove è arrivata, così una regressione si vede subito.
import test from 'node:test';
import assert from 'node:assert/strict';
import { precarica, rispostaSincrona, dimenticaContesto } from './mercato-qa.js';

const chiedi = (d) => { dimenticaContesto(); return rispostaSincrona(d)?.answer ?? null; };

// Chi investe per decenni e ragiona in termini reali e di rischio permanente.
const PAZIENTE = [
  'quanto e salito l\'oro dal 1980?',
  'l\'oro protegge dall\'inflazione?',
  'il mattone non scende mai, vero?',
  'quanto posso perdere nel caso peggiore?',
  'quanto tempo ci vuole per recuperare da un mercato orso?',
];
// Chi ragiona per cicli, regimi e correlazioni fra classi di attivo.
const MACRO = [
  'i cicli di mercato si ripetono?',
  'quale mercato anticipa gli altri?',
  'dove siamo nel ciclo?',
  'siamo vicini a una recessione?',
  'cosa ha protetto quando la borsa e crollata?',
  'la diversificazione geografica funziona?',
];
// Banca d'affari: vuole sapere da dove vengono i dati e cosa non sai.
const ISTITUZIONALE = [
  'come sta il mercato adesso?',
  'cosa non sai?',
  'quanto sono affidabili le tue risposte?',
  'qual e il sentiment degli operatori?',
  'come sono messi i trader sull\'oro?',
];
// Operatore: posizionamento, stress, episodi datati.
const OPERATORE = [
  'cosa e successo ad aprile 2025?',
  'dove sono posizionati gli speculatori?',
  'la borsa e salita troppo, sta per scendere?',
  'siamo in una bolla?',
];
// Cripto.
const CRIPTO = [
  'le criptovalute proteggono nei crolli?',
  'qual e il sentiment sul bitcoin?',
];
// Chi non sa niente e ha paura di chiedere. È il pubblico più importante.
const PRINCIPIANTE = [
  'cosa sono le obbligazioni?',
  'cosa vuol dire volatilita?',
  'cosa sono le terre rare come investimento?',
  'come va il mercato immobiliare in Italia?',
  'le materie prime cosa sono?',
];

const GRUPPI = { PAZIENTE, MACRO, ISTITUZIONALE, OPERATORE, CRIPTO, PRINCIPIANTE };

test('OGNI punto di vista riceve risposte: nessun gruppo resta scoperto', async () => {
  await precarica();
  const buchi = [];
  for (const [nome, domande] of Object.entries(GRUPPI)) {
    const risposte = domande.map((d) => [d, chiedi(d)]);
    const senza = risposte.filter(([, r]) => !r).map(([d]) => d);
    // Un gruppo con più di un buco su cinque non è coperto, è aneddotico.
    assert.ok(senza.length <= 1, `${nome}: ${senza.length} domande senza risposta — ${senza.join(' | ')}`);
    buchi.push(...senza.map((d) => `${nome}: ${d}`));
  }
  const totale = Object.values(GRUPPI).flat().length;
  // La soglia si alza quando la copertura migliora, mai si abbassa in silenzio.
  assert.ok(buchi.length <= 2, `${buchi.length} buchi su ${totale}: ${buchi.join(' || ')}`);
});

test('NESSUNA risposta contiene un consiglio operativo, per nessun pubblico', async () => {
  await precarica();
  // La differenza fra spiegare e consigliare è la ragione per cui questo
  // motore può esistere senza essere consulenza finanziaria. Vale per il
  // principiante quanto per l'istituzionale.
  const vietate = /\b(dovresti (comprare|vendere)|ti consiglio|conviene comprare|conviene vendere|compra |vendi |e' il momento di comprare|garantit)/i;
  for (const [nome, domande] of Object.entries(GRUPPI)) {
    for (const d of domande) {
      const r = chiedi(d);
      if (!r) continue;
      assert.ok(!vietate.test(r), `${nome} — "${d}" contiene un consiglio operativo:\n${r}`);
    }
  }
});

test('le domande a cui NON si deve rispondere ricevono un rifiuto motivato', async () => {
  await precarica();
  // Queste sono previsioni puntuali e consigli personali: la risposta giusta è
  // "no, e questo è il motivo". Un "non lo so" secco sarebbe già peggio.
  const proibite = [
    'quanto salira il bitcoin il mese prossimo?',
    'cosa devo comprare adesso?',
    'quale azione mi consigli?',
  ];
  for (const d of proibite) {
    const r = chiedi(d);
    if (r === null) continue; // gestita a monte dal QA generale: accettabile
    assert.ok(/non |nessun|impossibile|non posso|non lo so/i.test(r),
      `"${d}" ha ricevuto una risposta che non è un rifiuto:\n${r}`);
    assert.ok(!/comprerei|venderei|consiglio di/i.test(r), `"${d}" ha dato un consiglio:\n${r}`);
  }
});

test('ogni risposta porta con sé QUANTI dati la sostengono', async () => {
  await precarica();
  // È la differenza fra un numero e un numero credibile. Non tutte le risposte
  // possono (una definizione da glossario non ha un campione), ma la grande
  // maggioranza deve.
  const conNumeri = [];
  for (const d of [...MACRO, ...ISTITUZIONALE, ...OPERATORE]) {
    const r = chiedi(d);
    if (!r) continue;
    conNumeri.push([d, /\b(\d{2,4})\s*(anni|mesi|casi|volte|settimane|giorni|Paesi|combinazioni|osservazioni)|volte su cento|su \d+/.test(r)]);
  }
  const senza = conNumeri.filter(([, ok]) => !ok).map(([d]) => d);
  assert.ok(senza.length <= 3, `risposte senza indicazione di quanti dati le sostengono: ${senza.join(' | ')}`);
});
