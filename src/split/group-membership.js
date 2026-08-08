// ============================================================
// USCIRE DA UN GRUPPO, E CHIUDERLO — con le lapidi, altrimenti torna
// ============================================================
// Verificato prima di scrivere: NON esisteva alcun modo di uscire da un
// gruppo né di rimuoverlo (grep: nessun removeMember, leaveGroup, closeGroup).
// Un gruppo creato per una cena di due anni fa resta lì per sempre, e chi ci
// è finito dentro per sbaglio non può uscirne.
//
// IL PUNTO NON BANALE, ed è il motivo per cui questo non è una funzione da
// tre righe. `mergeMembers` in split-engine.js è SOLO-AGGIUNTA: unisce le due
// liste e tiene tutto. Cancellare un membro dal proprio elenco non serve a
// niente — al primo sync con un dispositivo che ha ancora la lista vecchia,
// quel membro TORNA. È il classico problema dei CRDT: senza una lapide, una
// cancellazione è solo un'assenza, e l'assenza perde sempre contro la
// presenza.
// Quindi uscire non significa togliere: significa aggiungere un fatto
// ("questo membro è uscito, in questo istante") che sopravvive al merge e
// vince sulla presenza.
//
// CHI PUÒ FARE COSA, e perché non è simmetrico:
//  - CHIUNQUE può uscire da sé stesso. Sempre. Non serve il permesso di
//    nessuno per andarsene, e un gruppo che non ti lascia uscire è una
//    trappola.
//  - SOLO CHI HA CREATO il gruppo può chiuderlo per tutti. Chiudere un gruppo
//    altrui sarebbe un modo per far sparire i conti a chi ti deve dei soldi.
//  - CHIUNQUE può nascondere un gruppo dal PROPRIO dispositivo senza toccare
//    quello degli altri: è la via d'uscita onesta per chi non è il creatore.
//
// ONESTÀ SU COSA NON PUÒ FARE. Uscire non cancella la tua storia: le spese
// che hai pagato e i saldi restano, altrimenti i conti degli altri non
// tornerebbero più. Non è un limite tecnico, è l'unica cosa corretta — sparire
// portandosi via i propri debiti non è una funzionalità.
'use strict';

// Un membro uscito resta nella lista con la sua lapide, e i saldi lo tengono
// in conto. Sparisce dalle SCELTE (chi paga, chi divide) e dal sync.
export function leaveGroup(group, deviceId, { now = Date.now() } = {}) {
  if (!group || !deviceId) return group;
  const idx = (group.members || []).findIndex((m) => m.claimedBy === deviceId);
  if (idx === -1) return group; // non ero in questo gruppo: niente da fare
  const members = group.members.slice();
  // `claimedBy` si azzera: lo slot si libera, ma NON si riapre a chiunque —
  // resta marcato come uscito, così nessuno ci rientra per sbaglio pensando
  // di essere quella persona.
  members[idx] = { ...members[idx], claimedBy: null, left: now, leftBy: deviceId };
  return { ...group, members };
}

// Il creatore rimuove qualcun altro. Stessa lapide: l'unica differenza è chi
// ha il diritto di metterla.
export function removeMember(group, memberId, byDeviceId, { now = Date.now() } = {}) {
  if (!group || !memberId) return { group, ok: false, motivo: 'dati mancanti' };
  if (!isCreator(group, byDeviceId)) {
    return { group, ok: false, motivo: 'solo chi ha creato il gruppo può togliere qualcun altro' };
  }
  const idx = (group.members || []).findIndex((m) => m.id === memberId);
  if (idx === -1) return { group, ok: false, motivo: 'persona non trovata nel gruppo' };
  const members = group.members.slice();
  members[idx] = { ...members[idx], claimedBy: null, left: now, leftBy: byDeviceId };
  return { group: { ...group, members }, ok: true };
}

// Chi ha creato il gruppo. I gruppi nati prima che questo campo esistesse non
// hanno un creatore: in quel caso NESSUNO può chiuderlo per tutti, e resta
// l'uscita individuale. Inventare un creatore a posteriori (es. "il primo
// membro") darebbe a qualcuno un potere che non gli è mai stato dato.
export function isCreator(group, deviceId) {
  return !!(group?.createdBy && deviceId && group.createdBy === deviceId);
}

export function markCreator(group, deviceId) {
  if (!group || !deviceId || group.createdBy) return group;
  return { ...group, createdBy: deviceId };
}

// Chiusura per tutti: una lapide sul gruppo intero. Non cancella i dati —
// il gruppo resta leggibile, ma smette di accettare spese nuove e sparisce
// dall'elenco attivo su ogni dispositivo.
export function closeGroup(group, byDeviceId, { now = Date.now() } = {}) {
  if (!group) return { group, ok: false, motivo: 'gruppo mancante' };
  if (!isCreator(group, byDeviceId)) {
    return {
      group, ok: false,
      motivo: group.createdBy
        ? 'solo chi ha creato il gruppo può chiuderlo per tutti — tu puoi uscirne'
        : 'questo gruppo è nato prima che si registrasse chi lo ha creato: puoi solo uscirne',
    };
  }
  return { group: { ...group, closed: now, closedBy: byDeviceId }, ok: true };
}

// Uscita locale: il gruppo sparisce da QUESTO dispositivo e basta. È la via
// per chi non è il creatore e non vuole più vederlo. Non è una lapide
// condivisa: gli altri non se ne accorgono, ed è giusto così.
export function hideLocally(group, { now = Date.now() } = {}) {
  return group ? { ...group, hiddenLocal: now } : group;
}

// ── Le domande che il resto dell'app fa a questo modulo ──

export function hasLeft(member) { return !!(member && member.left); }
export function isClosed(group) { return !!(group && group.closed); }

// I membri ATTIVI: chi non è uscito. È questa la lista da mostrare quando si
// chiede "chi paga" o "fra chi si divide".
export function activeMembers(group) {
  return (group?.members || []).filter((m) => !hasLeft(m));
}

// I gruppi da mostrare nell'elenco: né chiusi né nascosti qui.
export function visibleGroups(groups = []) {
  return groups.filter((g) => !isClosed(g) && !g.hiddenLocal);
}

// LA PARTE CHE FA FUNZIONARE TUTTO IL RESTO: la lapide deve VINCERE nel merge.
// Da usare in mergeMembers al posto del confronto solo-claim. Senza questa,
// tutto quanto sopra è decorativo: il membro rimosso torna al primo sync.
export function mergeMemberPair(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  // Se uno dei due è uscito, è uscito: l'uscita è un fatto, non un'opinione,
  // e una lista vecchia che non la conosce non deve poterla annullare.
  const pl = +prev.left || 0, nl = +next.left || 0;
  if (pl || nl) {
    const base = nl > pl ? next : (pl ? prev : next);
    return { ...base, left: Math.max(pl, nl), claimedBy: null };
  }
  if (prev.claimedBy && next.claimedBy) {
    return (+next.claimedAt || 0) < (+prev.claimedAt || 0) ? next : prev;
  }
  return next.claimedBy && !prev.claimedBy ? next : prev;
}

// Chiusura del gruppo nel merge: vale lo stesso principio, la lapide vince.
export function mergeClosure(a, b) {
  const ac = +a?.closed || 0, bc = +b?.closed || 0;
  if (!ac && !bc) return {};
  const closed = Math.max(ac, bc);
  return { closed, closedBy: (bc > ac ? b.closedBy : a.closedBy) || a?.closedBy || b?.closedBy };
}
