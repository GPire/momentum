const copy = {
  it: ['Controlla le date: la fine precede l’inizio.', 'Giorni senza spese? Va bene: controlla solo di non aver dimenticato nulla.', n => `${n} spese fuori periodo: restano nella trasferta. Controlla la data della spesa o del viaggio.`],
  en: ['Check the dates: the end is before the start.', 'Days without expenses are fine. Just check that nothing is missing.', n => `${n} expenses outside the dates: they stay in this trip. Check the expense or trip date.`],
  de: ['Prüfe die Daten: Das Ende liegt vor dem Beginn.', 'Tage ohne Ausgaben sind in Ordnung. Prüfe nur, ob etwas fehlt.', n => `${n} Ausgaben außerhalb des Zeitraums bleiben in dieser Reise. Prüfe das Ausgaben- oder Reisedatum.`],
  fr: ['Vérifiez les dates : la fin précède le début.', 'Des jours sans dépenses, c’est normal. Vérifiez simplement que rien ne manque.', n => `${n} dépenses hors période restent dans ce déplacement. Vérifiez la date de la dépense ou du voyage.`],
  es: ['Revisa las fechas: el final es anterior al inicio.', 'No pasa nada si hay días sin gastos. Comprueba que no falte nada.', n => `${n} gastos fuera del periodo siguen en este viaje. Revisa la fecha del gasto o del viaje.`],
  nl: ['Controleer de datums: het einde ligt vóór het begin.', 'Dagen zonder uitgaven zijn prima. Controleer alleen of er niets ontbreekt.', n => `${n} uitgaven buiten de periode blijven bij deze reis. Controleer de uitgaven- of reisdatum.`],
  pt: ['Verifique as datas: o fim é anterior ao início.', 'É normal haver dias sem despesas. Verifique apenas se falta alguma coisa.', n => `${n} despesas fora do período continuam nesta viagem. Verifique a data da despesa ou da viagem.`],
};
export function tripStatusCopy(lang, key, count) {
  const value = (copy[lang] || copy.en)[key];
  return typeof value === 'function' ? value(count) : value;
}
