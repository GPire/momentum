const labels = {
  it: ['Confronta i settori','Notizie economiche ufficiali'],
  en: ['Compare sectors','Official economic news'],
  de: ['Sektoren vergleichen','Offizielle Wirtschaftsnachrichten'],
  fr: ['Comparer les secteurs','Actualités économiques officielles'],
  es: ['Comparar sectores','Noticias económicas oficiales'],
  nl: ['Sectoren vergelijken','Officieel economisch nieuws'],
  pt: ['Comparar setores','Notícias económicas oficiais'],
};
export function marketWorkspaceCopy(lang) {
  const [sectors, official] = labels[lang] || labels.en;
  return { sectors, official };
}
