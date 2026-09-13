const copy = {
  it: ['Richieste da verificare', 'Salva nello storico', 'Nessuna richiesta salvata.', 'Storico su questo dispositivo. Gli esiti vanno inviati al dipendente; non certificano identità o ricezione.', 'Richiesta salvata'],
  en: ['Requests to review', 'Save to history', 'No saved requests.', 'History on this device. Send decisions to the employee; they do not verify identity or receipt.', 'Request saved'],
  de: ['Anfragen prüfen', 'Im Verlauf speichern', 'Keine gespeicherten Anfragen.', 'Verlauf auf diesem Gerät. Entscheidungen an Mitarbeitende senden; Identität und Empfang sind nicht bestätigt.', 'Anfrage gespeichert'],
  fr: ['Demandes à vérifier', 'Enregistrer dans l’historique', 'Aucune demande enregistrée.', 'Historique sur cet appareil. Envoyez les décisions au salarié ; identité et réception ne sont pas vérifiées.', 'Demande enregistrée'],
  es: ['Solicitudes para revisar', 'Guardar en el historial', 'No hay solicitudes guardadas.', 'Historial en este dispositivo. Envía las decisiones al empleado; no verifican identidad ni recepción.', 'Solicitud guardada'],
  nl: ['Aanvragen beoordelen', 'Bewaar in geschiedenis', 'Geen opgeslagen aanvragen.', 'Geschiedenis op dit apparaat. Stuur besluiten naar de medewerker; identiteit en ontvangst zijn niet bevestigd.', 'Aanvraag opgeslagen'],
  pt: ['Pedidos para verificar', 'Guardar no histórico', 'Nenhum pedido guardado.', 'Histórico neste dispositivo. Envie as decisões ao funcionário; não verificam identidade nem receção.', 'Pedido guardado'],
};
export const reviewHistoryCopy = (lang, key) => (copy[lang] || copy.en)[key];
