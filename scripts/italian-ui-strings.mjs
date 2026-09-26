// Trova i testi visibili scritti in italiano direttamente nel codice, invece che
// passare dalle traduzioni (tCh/t). Euristica: testo tra tag, argomenti di
// showToast/confirm/alert e assegnazioni a textContent/placeholder che
// contengono parole italiane frequenti. Commenti esclusi.
import { readFileSync } from 'node:fs';

const PAROLE = /\b(il|la|lo|le|gli|dei|delle|della|degli|per|con|non|sono|questo|questa|questi|tuoi|tua|tuo|tue|nel|nella|alla|anche|ancora|oggi|spese|spesa|entrate|salva|salvato|riprova|chiave|dati|mese|scegli|apri|vedi|nessun|nessuna|puoi|devi|serve|servono|qui|più|già|dopo|prima|ogni|tutto|tutti|quando|come|cosa|perché|attiva|disattiva|chiudi|annulla|conferma|aggiungi|elimina|modifica|importo|fattura|fatture|gruppo|dispositivo|cifre|codice|indirizzo|comune|cliente|clienti|quanto|quanti|stile|documento|compila|totale|scarica|invia|chiedi|pagamento|esporta|anno|ricorrente|crea|nome|cognome|precedente|successivo|riepilogo|nascosti|tocca|limite|impostato|investire|movimento|movimenti|suggerimento|paese|conto|banca|telefono|restano|resta|oppure|mese|settimana|giorno|giorni|prossima|prossimo|scadenza|scadenze|saldo|saldi|risparmio|obiettivo|obiettivi|budget|categoria|categorie|carica|caricare|ricevuta|ricevute|allegato|allegati|trasferta|trasferte|rimborso|rimborsi|spendere|guadagni|entrata|uscita|uscite|aggiornamento|novità|impostazioni|preferenze|scegliere|tutte|nessuno|sempre|mai|ora|adesso|subito|pronto|pronta|errore|riprovare|attendi|caricamento|valido|valida|obbligatorio|facoltativo|ragione|sociale|cassetto|fiscale|contributi|imposta|tasse|stima)\b/i;

export function findItalianUiStrings(source) {
  const out = [];
  // Commenti HTML su più righe e blocchi <style>/<script> di sola configurazione: fuori.
  source = source.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  const lines = source.split('\n');
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlockComment) { if (t.includes('*/')) inBlockComment = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlockComment = true; return; }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return;
    const found = new Set();
    for (const m of line.matchAll(/<([^<>]*)>([^<>`]{4,})</g)) {
      if (/data-i18n(-key)?=/.test(m[1])) continue;
      const txt = m[2].replace(/\$\{[^}]*\}/g, ' ').trim();
      if (txt.length >= 4 && PAROLE.test(txt) && /[a-zà-ù]{3,}/i.test(txt)) found.add(txt);
    }
    for (const m of line.matchAll(/(?:showToast|confirm|alert)\(\s*(['"`])((?:(?!\1).){4,}?)\1/g)) {
      if (PAROLE.test(m[2]) && !/tCh\(|tVoice\(|t\(/.test(m[2])) found.add(m[2]);
    }
    for (const m of line.matchAll(/(?:textContent|placeholder|innerText)\s*=\s*(['"`])((?:(?!\1).){4,}?)\1/g)) {
      if (PAROLE.test(m[2])) found.add(m[2]);
    }
    for (const m of line.matchAll(/(?:placeholder|aria-label|title)="([^"$]{3,})"/g)) {
      if (PAROLE.test(m[1])) found.add(m[1]);
    }
    // Testo da solo su una riga dentro un template HTML (nessun codice sulla riga).
    if (t.length > 12 && !/[<>=;{}()\[\]]|^['"`]|['"`],?$/.test(t) && PAROLE.test(t) && /^[A-ZÀ-Ù]/.test(t)) found.add(t);
    for (const txt of found) out.push({ line: i + 1, text: txt.slice(0, 120) });
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  let total = 0;
  for (const f of files) {
    const r = findItalianUiStrings(readFileSync(f, 'utf8'));
    total += r.length;
    if (process.env.VERBOSE) for (const x of r) console.log(`${f}:${x.line}: ${x.text}`);
  }
  console.log(total);
}
