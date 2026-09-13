const copy = {
  it: ['Modifica spesa', 'Salva modifiche', 'Annulla modifica', 'Modifiche da confrontare', 'La spesa è cambiata su un altro dispositivo. Riapri la modifica.', 'Confronta le versioni qui sotto, poi conferma i dati corretti.'],
  en: ['Edit expense', 'Save changes', 'Cancel edit', 'Changes to review', 'The expense changed on another device. Reopen the editor.', 'Compare the versions below, then confirm the correct details.'],
  de: ['Ausgabe bearbeiten', 'Änderungen speichern', 'Bearbeitung abbrechen', 'Änderungen prüfen', 'Die Ausgabe wurde auf einem anderen Gerät geändert. Öffnen Sie die Bearbeitung erneut.', 'Vergleichen Sie die Versionen und bestätigen Sie die richtigen Angaben.'],
  fr: ['Modifier la dépense', 'Enregistrer', 'Annuler la modification', 'Modifications à comparer', 'La dépense a changé sur un autre appareil. Rouvrez la modification.', 'Comparez les versions ci-dessous et confirmez les bonnes données.'],
  es: ['Editar gasto', 'Guardar cambios', 'Cancelar edición', 'Cambios por revisar', 'El gasto cambió en otro dispositivo. Abre de nuevo el editor.', 'Compara las versiones y confirma los datos correctos.'],
  nl: ['Uitgave bewerken', 'Wijzigingen opslaan', 'Bewerken annuleren', 'Wijzigingen controleren', 'De uitgave is op een ander apparaat gewijzigd. Open de editor opnieuw.', 'Vergelijk de versies hieronder en bevestig de juiste gegevens.'],
  pt: ['Editar despesa', 'Guardar alterações', 'Cancelar edição', 'Alterações a comparar', 'A despesa mudou noutro dispositivo. Reabra a edição.', 'Compare as versões abaixo e confirme os dados corretos.'],
};
export const tripEditCopy = (lang, key) => (copy[lang] || copy.en)[key];
