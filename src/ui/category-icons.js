// Same 24px, rounded-stroke vocabulary as Momentum's existing category icons.
const paths = {
  parcheggio: '<rect x="4" y="3" width="16" height="18" rx="5"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
  assicurazione: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  scuola: '<path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6M22 9v7"/>',
  bambini: '<circle cx="12" cy="13" r="8"/><path d="M9 5c0-4 6-4 6 0M8 12h.01M16 12h.01M9 16c2 2 4 2 6 0"/>',
  spesa: '<path d="m4 9 2 11h12l2-11H4Zm3 0 5-6 5 6M9 13v3M15 13v3"/>',
  consegne: '<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M8 5l9 4"/>',
  donazioni: '<path d="M12 12S5 8 5 5a3 3 0 0 1 7-1 3 3 0 0 1 7 1c0 3-7 7-7 7ZM3 17h4l3-2h5a2 2 0 0 1 0 4h-4M3 21h11l7-5"/>',
  manutenzione: '<path d="M21 4a6 6 0 0 1-8 8L6 20a2 2 0 0 1-3-3l8-7a6 6 0 0 1 8-8l-4 4 3 3 3-5Z"/>',
  abbigliamento: '<path d="m8 3 4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4 6-5Z"/>',
  tecnologia: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4m-3-9 3-2 3 2-3 2-3-2Z"/>',
};
export const EXTRA_CATEGORY_ICONS = Object.entries(paths).map(([chiave, path]) => ({ chiave,
  svg: `<svg class="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`,
}));
