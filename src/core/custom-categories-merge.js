// ============================================================
// CATEGORIE PERSONALIZZATE — fusione fra i propri dispositivi
// ============================================================
// BUG REALE, e di quelli che si vedono a occhio: le transazioni si
// sincronizzano già fra i propri dispositivi, le categorie personalizzate no.
// Chi crea "Palestra" sul telefono e ci mette dentro una spesa, sul portatile
// ritrova QUELLA STESSA spesa sotto "Altro", con l'icona di ripiego — perché
// `getCatById` non trova un id che su quel dispositivo non è mai arrivato.
// Non è un dato perso: è peggio, è lo stesso dato mostrato in due modi
// diversi sui due schermi della stessa persona, senza spiegazione.
//
// Stessa disciplina già usata per i gruppi di divisione e per le trasferte:
// unione per id, ultimo che ha scritto vince campo per campo, e la
// cancellazione è una data che si confronta invece di una sparizione (una
// categoria cancellata su un dispositivo non deve tornare in vita
// dall'altro, ma un ripristino più recente deve poter vincere).
//
// Funzioni pure: nessun DOM, nessuna rete.
'use strict';

// Una categoria è cancellata solo se l'ultima parola è stata la cancellazione.
export function isCategoryDeleted(cat) {
  const morte = +cat?.deletedAt || 0;
  const vita = +cat?.restoredAt || 0;
  return morte > 0 && morte >= vita;
}

export function touchCategory(cat, now = Date.now()) {
  return { ...cat, updatedAt: now };
}

export function deleteCategory(cat, now = Date.now()) {
  return { ...cat, deletedAt: now, updatedAt: now };
}

export function restoreCategory(cat, now = Date.now()) {
  return { ...cat, restoredAt: now, updatedAt: now };
}

export function mergeCategoryPair(a, b) {
  if (!a) return b; if (!b) return a;
  if (a.id !== b.id) return a;
  const morte = Math.max(+a.deletedAt || 0, +b.deletedAt || 0);
  const vita = Math.max(+a.restoredAt || 0, +b.restoredAt || 0);
  const aAt = +a.updatedAt || 0, bAt = +b.updatedAt || 0;
  const recente = bAt > aAt ? b : a;
  return {
    ...recente,
    id: a.id,
    updatedAt: Math.max(aAt, bAt) || undefined,
    ...(morte ? { deletedAt: morte } : {}),
    ...(vita ? { restoredAt: vita } : {}),
  };
}

// Unisce l'elenco locale con quello in arrivo. Le categorie NUOVE vengono
// accettate: a differenza di un gruppo di divisione — a cui ci si unisce con
// un invito e che quindi non può essere spinto addosso — una categoria arriva
// solo da un dispositivo già riconosciuto come proprio, e serve proprio
// perché le transazioni che la usano sono già arrivate.
export function mergeCategoryLists(locali = [], inArrivo = []) {
  const perId = new Map();
  for (const c of locali) if (c && c.id) perId.set(c.id, c);
  for (const c of inArrivo) {
    if (!c || !c.id) continue;
    perId.set(c.id, perId.has(c.id) ? mergeCategoryPair(perId.get(c.id), c) : c);
  }
  return [...perId.values()];
}

// Le categorie da mostrare: mai quelle cancellate.
export function visibleCategories(cats = []) {
  return cats.filter(c => c && !isCategoryDeleted(c));
}

// Una categoria cancellata ma ANCORA USATA da una transazione non va mostrata
// nell'elenco di scelta, ma il suo nome e la sua icona devono restare
// disponibili a chi disegna quella riga: altrimenti una spesa vecchia
// tornerebbe a essere "Altro" grigio — lo stesso difetto da cui si parte,
// spostato un metro più in là.
export function categoriesForLookup(cats = []) {
  return cats;
}
