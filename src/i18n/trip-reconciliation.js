const copy = {
  it: ['Da verificare', 'Più movimenti possono corrispondere. Nessun abbinamento confermato.', 'Valuta non indicata', 'Addebito carta', 'Spesa registrata', 'Abbinamenti proposti: controlla entrambi i movimenti. Nessun dato è stato modificato.'],
  en: ['Needs review', 'Several entries may match. No match confirmed.', 'Currency not specified', 'Card charge', 'Recorded expense', 'Suggested matches: check both entries. No data has been changed.'],
  de: ['Prüfung nötig', 'Mehrere Buchungen könnten passen. Keine Zuordnung bestätigt.', 'Währung nicht angegeben', 'Kartenbelastung', 'Erfasste Ausgabe', 'Vorgeschlagene Zuordnungen: beide Buchungen prüfen. Keine Daten wurden geändert.'],
  fr: ['À vérifier', 'Plusieurs opérations peuvent correspondre. Aucun rapprochement confirmé.', 'Devise non précisée', 'Débit de carte', 'Dépense enregistrée', 'Rapprochements proposés : vérifiez les deux opérations. Aucune donnée modifiée.'],
  es: ['Por revisar', 'Varios movimientos pueden coincidir. Ninguna coincidencia confirmada.', 'Moneda no indicada', 'Cargo de tarjeta', 'Gasto registrado', 'Coincidencias propuestas: comprueba ambos movimientos. No se han modificado datos.'],
  nl: ['Controle nodig', 'Meerdere boekingen kunnen overeenkomen. Geen koppeling bevestigd.', 'Valuta niet opgegeven', 'Kaartafschrijving', 'Geregistreerde uitgave', 'Voorgestelde koppelingen: controleer beide boekingen. Er zijn geen gegevens gewijzigd.'],
  pt: ['Por verificar', 'Vários movimentos podem corresponder. Nenhuma correspondência confirmada.', 'Moeda não indicada', 'Débito do cartão', 'Despesa registada', 'Correspondências propostas: verifique ambos os movimentos. Nenhum dado foi alterado.'],
};
export const tripReconciliationCopy = lang => copy[lang] || copy.en;
