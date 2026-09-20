import { reimbursementCandidates, reimbursementLinkState, reimbursementLinkDigest } from '../trips/reimbursement-links.js';
import { reimbursementBalance } from '../trips/reimbursement-balance.js';
const copies = {
 it: ['Collega un accredito', 'Cerca per nome o importo', 'Scegli un’entrata già registrata. Gli importi più vicini sono in cima: verifica sempre chi ti ha pagato.', 'Collega', 'Scollega', 'Confermi questo accredito per la trasferta?', 'Confermi di togliere il collegamento? Il movimento resta nei tuoi dati.', 'Annulla', 'Collegamento aggiornato', 'Il movimento è cambiato. Riapri la trasferta e controlla.', 'Nessuna entrata disponibile nella valuta della trasferta. Importa o registra prima l’accredito nei movimenti.', 'Mostro fino a 20 risultati. Cerca per restringere la lista.'],
 en: ['Link a credit', 'Search name or amount', 'Choose an existing income. Closest amounts come first: always check who paid you.', 'Link', 'Unlink', 'Link this credit to this trip?', 'Remove the link? The movement stays in your data.', 'Cancel', 'Link updated', 'The movement changed. Reopen the trip and check.', 'No available income in the trip currency. First import or record the credit in your movements.', 'Showing up to 20 results. Search to narrow the list.'],
 de: ['Gutschrift zuordnen', 'Name oder Betrag suchen', 'Vorhandene Einnahme wählen. Ähnliche Beträge zuerst: immer den Absender prüfen.', 'Zuordnen', 'Zuordnung lösen', 'Diese Gutschrift der Reise zuordnen?', 'Zuordnung lösen? Die Buchung bleibt erhalten.', 'Abbrechen', 'Zuordnung aktualisiert', 'Buchung geändert. Reise erneut öffnen und prüfen.', 'Keine verfügbare Einnahme in der Reisewährung. Zuerst die Gutschrift importieren oder erfassen.', 'Bis zu 20 Ergebnisse. Suche zum Eingrenzen.'],
 fr: ['Lier un crédit', 'Chercher nom ou montant', 'Choisissez un revenu existant. Montants proches en premier : vérifiez toujours le payeur.', 'Lier', 'Délier', 'Lier ce crédit à ce déplacement ?', 'Supprimer le lien ? Le mouvement est conservé.', 'Annuler', 'Lien mis à jour', 'Le mouvement a changé. Rouvrez le déplacement et vérifiez.', 'Aucun revenu disponible dans la devise du déplacement. Importez ou enregistrez le crédit d’abord.', 'Jusqu’à 20 résultats. Affinez la recherche.'],
 es: ['Vincular un abono', 'Buscar nombre o importe', 'Elige un ingreso existente. Importes cercanos primero: comprueba siempre quién te pagó.', 'Vincular', 'Desvincular', '¿Vincular este abono al viaje?', '¿Quitar el vínculo? El movimiento se conserva.', 'Cancelar', 'Vínculo actualizado', 'El movimiento cambió. Abre el viaje de nuevo y revisa.', 'No hay ingresos disponibles en la moneda del viaje. Importa o registra primero el abono.', 'Hasta 20 resultados. Busca para reducir la lista.'],
 nl: ['Bijschrijving koppelen', 'Zoek naam of bedrag', 'Kies bestaande inkomsten. Vergelijkbare bedragen eerst: controleer altijd de betaler.', 'Koppelen', 'Ontkoppelen', 'Deze bijschrijving aan deze reis koppelen?', 'Koppeling verwijderen? De transactie blijft bewaard.', 'Annuleren', 'Koppeling bijgewerkt', 'De transactie is gewijzigd. Open de reis opnieuw en controleer.', 'Geen beschikbare inkomsten in de reisvaluta. Importeer of registreer eerst de bijschrijving.', 'Maximaal 20 resultaten. Verfijn met zoeken.'],
 pt: ['Associar um crédito', 'Pesquisar nome ou valor', 'Escolha uma entrada existente. Valores próximos primeiro: confirme sempre quem pagou.', 'Associar', 'Desassociar', 'Associar este crédito à viagem?', 'Remover a associação? O movimento mantém-se.', 'Cancelar', 'Associação atualizada', 'O movimento mudou. Reabra a viagem e verifique.', 'Sem entradas disponíveis na moeda da viagem. Importe ou registe primeiro o crédito.', 'Até 20 resultados. Pesquise para reduzir a lista.'],
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function creditDate(value, lang) {
 const date = new Date(value);
 return Number.isFinite(date.getTime()) ? date.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
export function creditPickerHtml(lang) {
 const c = copies[lang] || copies.en;
 return `<details class="trip-company"><summary>${esc(c[0])}</summary><p class="card-sub">${esc(c[2])}</p><label for="trip-credit-search">${esc(c[1])}</label><input id="trip-credit-search" type="search" autocomplete="off" class="w-full rounded-xl border border-[var(--outline)] p-3 bg-[var(--surface-elevated)]"><div id="trip-credit-list"></div><div id="trip-credit-confirm" aria-live="polite"></div></details>`;
}
export function bindCreditPicker({ trip, transactions, lang, associate, changed, notify }) {
 const list = document.getElementById('trip-credit-list'), search = document.getElementById('trip-credit-search'), confirmation = document.getElementById('trip-credit-confirm');
 if (!list || !search || !confirmation) return;
 const c = copies[lang] || copies.en, balance = reimbursementBalance(trip, transactions);
 const candidates = reimbursementCandidates(trip, transactions, balance.remaining || 0);
 const linked = transactions.filter(tx => tx.type === 'entrata' && reimbursementLinkState(tx).tripId === trip.id && !reimbursementLinkState(tx).conflict);
 const money = tx => { try { return new Intl.NumberFormat(lang, { style: 'currency', currency: tx.currency }).format(tx.amount); } catch { return `${tx.amount} · —`; } };
 const draw = () => {
   confirmation.innerHTML = '';
   const query = search.value.trim().toLocaleLowerCase();
   const rows = [...linked, ...candidates].filter(tx => `${tx.description || ''} ${tx.amount} ${money(tx)} ${tx.date}`.toLocaleLowerCase().includes(query)).slice(0, 20);
   list.innerHTML = rows.length ? `<p class="card-sub">${esc(c[11])}</p>` + rows.map((tx, i) => `<button type="button" data-credit-choice="${i}" class="trip-credit-choice"><span>${esc(tx.description || creditDate(tx.date, lang))}<small>${esc(creditDate(tx.date, lang))}</small></span><strong>${esc(money(tx))}</strong><span>${esc(linked.includes(tx) ? c[4] : c[3])}</span></button>`).join('') : `<p class="card-sub">${esc(c[10])}</p>`;
   list.querySelectorAll('[data-credit-choice]').forEach(button => button.addEventListener('click', () => {
     const tx = rows[Number(button.dataset.creditChoice)], unlink = linked.includes(tx), digest = reimbursementLinkDigest(tx);
     confirmation.innerHTML = `<div class="trip-company"><strong>${esc(unlink ? c[6] : c[5])}</strong><p>${esc(tx.description)} · ${esc(money(tx))}</p><div class="trip-credit-actions"><button type="button" data-credit-cancel>${esc(c[7])}</button><button type="button" data-credit-confirm class="btn-action btn-primary">${esc(unlink ? c[4] : c[3])}</button></div></div>`;
     confirmation.querySelector('[data-credit-cancel]').onclick = () => { confirmation.innerHTML = ''; button.focus(); };
     confirmation.querySelector('[data-credit-confirm]').onclick = () => {
       try {
         if (!associate(tx.id, trip.id, unlink, crypto.randomUUID(), digest)) throw new Error('stale');
         notify(c[8], 'success'); changed(unlink);
       } catch { notify(c[9], 'error'); }
     };
     confirmation.scrollIntoView({ block: 'nearest' });
     confirmation.querySelector('[data-credit-confirm]').focus();
   }));
 };
 search.addEventListener('input', draw); draw();
}
