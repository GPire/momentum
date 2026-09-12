// Presentation overrides keep category IDs and transaction hashes unchanged.
export function resolveCategories(base, custom = []) {
  const categories = new Map(base.map(c => [c.id, c]));
  for (const cat of custom) if (cat?.id) categories.set(cat.id, { ...categories.get(cat.id), ...cat });
  return [...categories.values()];
}

export function editCategoryAppearance(custom, category, name, color, icon, now = Date.now()) {
  name = String(name ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!category?.id || !name || [...name].length > 24 || /[<>\u0000-\u001f]/u.test(name)) throw new Error('categoryInvalidName');
  const next = { ...category, name, displayName: name, color, icon, updatedAt: now };
  return [...custom.filter(c => c.id !== category.id), next];
}
