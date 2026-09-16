const copy = {
  it: ['Tutte', 'Da verificare', 'Esito preparato', 'Cerca una trasferta o un nome', 'Cerca', 'Mostra altre richieste', 'Nessuna richiesta corrisponde alla ricerca.', 'Esiti preparati su questo dispositivo'],
  en: ['All', 'To review', 'Decision prepared', 'Search a trip or a name', 'Search', 'Show more requests', 'No requests match your search.', 'Decisions prepared on this device'],
  de: ['Alle', 'Zu prüfen', 'Entscheidung vorbereitet', 'Reise oder Namen suchen', 'Suchen', 'Weitere Anfragen anzeigen', 'Keine passenden Anfragen gefunden.', 'Auf diesem Gerät vorbereitete Entscheidungen'],
  fr: ['Toutes', 'À vérifier', 'Décision préparée', 'Rechercher un voyage ou un nom', 'Rechercher', 'Afficher plus de demandes', 'Aucune demande ne correspond.', 'Décisions préparées sur cet appareil'],
  es: ['Todas', 'Por revisar', 'Decisión preparada', 'Busca un viaje o un nombre', 'Buscar', 'Mostrar más solicitudes', 'No hay solicitudes que coincidan.', 'Decisiones preparadas en este dispositivo'],
  nl: ['Alle', 'Te beoordelen', 'Besluit voorbereid', 'Zoek een reis of een naam', 'Zoeken', 'Meer aanvragen tonen', 'Geen aanvragen gevonden.', 'Besluiten voorbereid op dit apparaat'],
  pt: ['Todos', 'Por verificar', 'Decisão preparada', 'Procure uma viagem ou um nome', 'Procurar', 'Mostrar mais pedidos', 'Nenhum pedido corresponde à pesquisa.', 'Decisões preparadas neste dispositivo'],
};
export const reviewWorkspaceCopy = (lang, key) => (copy[lang] || copy.en)[key];
