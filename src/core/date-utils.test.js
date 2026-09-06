// Il bug era subdolo apposta: nell'uso normale (transazione di "adesso", di
// giorno) il taglio di stringa sbagliato e la lettura corretta concordavano
// per caso, e il difetto restava invisibile per settimane — è saltato fuori
// solo quando qualcuno ha backdatato una transazione. Per questo qui non
// basta un caso singolo: si spazzola ogni giorno di un mese intero, in più
// fusi orari REALI (non simulati a mano), eseguendo Node in un sottoprocesso
// con TZ diverso — l'unico modo di provare davvero cosa succede a chi apre
// Momentum da un altro fuso, non solo dal fuso di chi scrive il codice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { giornoLocale, meseLocale } from './date-utils.js';

test('giornoLocale: un Date costruito da componenti locali torna intatto (nessuna eccezione dal fuso della macchina che esegue il test)', () => {
  for (let mese = 0; mese < 12; mese++) {
    for (const giorno of [1, 15, 28]) {
      const d = new Date(2026, mese, giorno);
      assert.equal(giornoLocale(d), `2026-${String(mese + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`);
    }
  }
});

test('meseLocale: stesso principio, sul mese', () => {
  assert.equal(meseLocale(new Date(2026, 0, 31)), '2026-01');
  assert.equal(meseLocale(new Date(2026, 11, 1)), '2026-12');
});

test('input non valido → null, mai un\'eccezione al boot', () => {
  assert.equal(giornoLocale('non-una-data'), null);
  assert.equal(giornoLocale(new Date('invalid')), null);
  assert.equal(meseLocale(undefined), null);
});

// ── IL BUG VERO, riprodotto in un sottoprocesso Node con fuso orario reale ──
// Non un mock, non una simulazione: si lancia `node` con TZ diverso e si
// osserva cosa succede DAVVERO quando si costruisce una data locale, la si
// salva come farebbe il Command Center (`.toISOString()`, il comportamento
// ATTUALE e corretto lato scrittura) e la si rilegge nei due modi che
// convivevano in main.js — il taglio di stringa (sbagliato) e giornoLocale
// (corretto, quello a cui i 13 punti sono stati portati).
function spazzolaFuso(tz, giorni) {
  const codice = `
    import { giornoLocale } from ${JSON.stringify(new URL('./date-utils.js', import.meta.url).pathname)};
    const giorni = ${JSON.stringify(giorni)};
    const risultati = giorni.map(([y, m, g]) => {
      const scelto = new Date(y, m, g);           // mezzanotte locale, come il date-picker
      const salvato = scelto.toISOString();          // come lo scrive OGGI il Command Center
      const tagliata = salvato.slice(0, 10);          // il vecchio modo di leggere (bacato)
      const corretta = giornoLocale(new Date(salvato)); // il modo corretto
      return { atteso: \`\${y}-\${String(m+1).padStart(2,'0')}-\${String(g).padStart(2,'0')}\`, tagliata, corretta };
    });
    process.stdout.write(JSON.stringify(risultati));
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', codice], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

// Un mese intero di giorni scelti, incluso il cambio dell'ora legale
// (europea, fine ottobre) — il momento in cui questa classe di bug si sposta
// di un'ora e un errore di fuso può sommarsi a un errore di DST.
const GIORNI_DA_PROVARE = [
  [2026, 8, 1], [2026, 8, 2], [2026, 8, 5], [2026, 8, 6], [2026, 8, 7],
  [2026, 8, 15], [2026, 8, 20], [2026, 8, 30],
  [2026, 9, 1], [2026, 9, 24], [2026, 9, 25], [2026, 9, 26], [2026, 9, 31], // cambio ora legale UE
  [2026, 11, 31], [2027, 0, 1], // capodanno, cambio anno
];

test('FUSO POSITIVO (Europe/Rome, UTC+1/+2): la lettura a taglio di stringa sbaglia giorno su OGNI data provata; giornoLocale la becca sempre', () => {
  const risultati = spazzolaFuso('Europe/Rome', GIORNI_DA_PROVARE);
  let almenoUnErrore = false;
  for (const r of risultati) {
    assert.equal(r.corretta, r.atteso, `giornoLocale ha sbagliato per ${r.atteso}`);
    if (r.tagliata !== r.atteso) almenoUnErrore = true;
  }
  assert.ok(almenoUnErrore, 'il bug deve essere riproducibile: se non lo è più qui, verificare che Europe/Rome sia davvero avanti su UTC nell\'ambiente di test');
});

test('FUSO POSITIVO ESTREMO (Pacific/Kiritimati, UTC+14): stesso bug, ancora più marcato; giornoLocale regge comunque', () => {
  const risultati = spazzolaFuso('Pacific/Kiritimati', GIORNI_DA_PROVARE);
  for (const r of risultati) assert.equal(r.corretta, r.atteso, `giornoLocale ha sbagliato per ${r.atteso} a UTC+14`);
});

test('FUSO NEGATIVO (America/New_York, UTC-4/-5): qui il taglio di stringa spesso "funziona per caso" — giornoLocale deve restare corretto comunque, non solo quando il bug è invisibile', () => {
  const risultati = spazzolaFuso('America/New_York', GIORNI_DA_PROVARE);
  for (const r of risultati) assert.equal(r.corretta, r.atteso, `giornoLocale ha sbagliato per ${r.atteso} a New York`);
});

test('UTC PURO: nessuno spostamento possibile, tutti e due i metodi concordano — verifica che il test stesso sia sano', () => {
  const risultati = spazzolaFuso('UTC', GIORNI_DA_PROVARE);
  for (const r of risultati) {
    assert.equal(r.corretta, r.atteso);
    assert.equal(r.tagliata, r.atteso, 'a UTC il taglio di stringa deve combaciare per costruzione: se non combacia, lo script di test ha un bug suo');
  }
});
