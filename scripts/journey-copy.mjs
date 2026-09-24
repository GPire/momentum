import { keys, lines } from '../public/landing/landing-copy.js';

const italian = {
  openApp:'Apri Momentum', startFree:'Inizia gratis', privacy:'Privacy', terms:'Termini',
  scrollDiscover:'Scorri per scoprire Momentum', proofDemo:'Esempio illustrativo, senza dati personali.',
  wayTogetherTitle:'Insieme', wayTogetherBody:'Dividi una spesa, vedi chi deve cosa e chiarisci le contestazioni prima di chiedere un rimborso.',
  proofSplitTitle:'Dieci persone, una spesa. Tutti conoscono la propria quota.',
  proofSplitBody:'Senza account: scegli chi ha pagato, quote e valute. Se qualcuno contesta una spesa, esce dai saldi finché il gruppo non la chiarisce. Dividere resta gratis.',
  proofSplitFrom:'Una spesa', proofSplitTo:'10 quote chiare', proofSplitDispute:'Contestata? Fuori dai saldi.',
  wayWorkTitle:'In trasferta', wayWorkBody:'Tieni lo scontrino con la trasferta; controlla e consegna il resoconto in un solo posto.',
  proofTripTitle:'Lo scontrino resta con la trasferta.',
  proofTripBody:'Collega la spesa alla trasferta, controlla cosa manca e prepara un resoconto o un file aziendale. Prepararlo non significa che sia stato ricevuto.',
  proofTripFrom:'Scontrino', proofTripTo:'Resoconto', proofTripCheck:'Pronto per il controllo',
  fiscalEyebrow:'Per chi lavora in proprio', fiscalTitle:'Da una fattura al prossimo passo chiaro.',
  fiscalBody:'In Italia, Svizzera e Spagna puoi preparare fatture, collegare incassi anche parziali e vedere una stima. Momentum ti guida al passaggio ufficiale da completare fuori dall’app.',
  fiscalLimit:'Stime e guide non sostituiscono un professionista. Invio e conservazione ufficiali non avvengono automaticamente nell’app.',
  fiscalStepOne:'Prepara la fattura', fiscalStepTwo:'Segui l’incasso', fiscalStepThree:'Vedi la stima', fiscalStepFour:'Completa il passaggio ufficiale',
  fiscalDetailOne:'Inserisci cliente, importo e lavoro svolto. Controlla i dettagli prima di esportare o condividere.',
  fiscalDetailTwo:'Collega anche un pagamento parziale: la fattura mostra quanto è arrivato e quanto manca.',
  fiscalDetailThree:'Vedi una stima fiscale per il tuo Paese e regime, con ipotesi e limiti in vista.',
  fiscalDetailFour:'La guida mostra dove andare e cosa controllare. Completi la pratica nel servizio ufficiale e ne conservi l’esito.'
};

const extra = {
  it: {
    common:['Torna alle possibilità','Prova questo percorso','Il prossimo passo è tuo','Apri la funzione','Esempio, non i tuoi dati','Il risultato prima della promessa'],
    split:['Scrivi chi ha anticipato. Anche due persone possono aver pagato parti diverse.','Il conto torna al centesimo. Vedi la tua quota prima di inviare un invito.','Il gruppo vede la contestazione; la spesa non entra nei saldi finché non viene chiarita.','Rimborsi ad Anna','Chiarisci il taxi','Rimetti in verifica il taxi','contestato · fuori dal saldo','chiarito · nel saldo'],
    trips:['Fotografa lo scontrino o aggiungi la spesa: resta collegata al viaggio.','Prima di consegnare, vedi il documento o il dato che manca.','Esporta per il tuo gestionale; la ricezione e l’approvazione restano stati separati.','Scontrini collegati','Collega lo scontrino mancante','Mostra lo scontrino mancante','da completare','pronto da preparare, non ancora ricevuto'],
    tax:['Fattura di esempio','Registra il saldo restante','Mostra il pagamento parziale','da incassare','incassata · pratica ufficiale da completare']
  },
  en: {
    common:['Back to all paths','Try this path','The next step is yours','Open this feature','Example, not your data','See the result before the promise'],
    split:['Enter who paid. More than one person can cover different amounts.','The total balances to the cent. See your share before sending an invite.','Everyone can see the dispute; the expense stays out of balances until it is resolved.','Repayments to Anna','Resolve the taxi','Dispute the taxi again','disputed · outside balances','resolved · included in balances'],
    trips:['Photograph a receipt or add an expense: it stays with the trip.','Before handing over the report, see which document or detail is missing.','Export for your company platform; receipt and approval remain separate states.','Receipts linked','Attach the missing receipt','Show the missing receipt','needs a receipt','ready to prepare, not received yet'],
    tax:['Example invoice','Record the remaining payment','Show partial payment','still due','paid · official step still needed']
  },
  de: {
    common:['Zurück zu allen Wegen','Diesen Weg testen','Der nächste Schritt liegt bei dir','Funktion öffnen','Beispiel, nicht deine Daten','Erst das Ergebnis, dann das Versprechen'],
    split:['Trage ein, wer bezahlt hat. Mehrere Personen können unterschiedliche Beträge vorstrecken.','Die Summe stimmt centgenau. Prüfe deinen Anteil vor der Einladung.','Alle sehen den Einwand; die Ausgabe zählt erst nach der Klärung zum Saldo.','Erstattungen an Anna','Taxifahrt klären','Taxifahrt erneut anfechten','angefochten · nicht im Saldo','geklärt · im Saldo'],
    trips:['Fotografiere den Beleg oder erfasse die Ausgabe: beides bleibt bei der Reise.','Vor der Abgabe siehst du, welcher Beleg oder welche Angabe fehlt.','Exportiere für das Firmensystem; Eingang und Genehmigung bleiben getrennte Zustände.','Belege verknüpft','Fehlenden Beleg hinzufügen','Fehlenden Beleg anzeigen','Beleg fehlt','vorbereitet, noch nicht empfangen'],
    tax:['Beispielrechnung','Restzahlung erfassen','Teilzahlung anzeigen','noch offen','bezahlt · amtlicher Schritt noch offen']
  },
  fr: {
    common:['Voir tous les parcours','Essayer ce parcours','La suite vous appartient','Ouvrir cette fonction','Exemple, pas vos données','Voir le résultat avant la promesse'],
    split:['Indiquez qui a payé. Plusieurs personnes peuvent avancer des montants différents.','Le total est exact au centime. Vérifiez votre part avant d’inviter.','Le groupe voit la contestation ; la dépense reste hors des soldes jusqu’à sa résolution.','Remboursements à Anna','Résoudre le trajet en taxi','Contester à nouveau le taxi','contesté · hors des soldes','résolu · dans les soldes'],
    trips:['Photographiez le reçu ou ajoutez la dépense : elle reste liée au déplacement.','Avant de remettre le rapport, voyez quelle pièce ou information manque.','Exportez vers l’outil de l’entreprise ; réception et approbation restent distinctes.','Reçus liés','Joindre le reçu manquant','Afficher le reçu manquant','reçu manquant','prêt à préparer, pas encore reçu'],
    tax:['Facture d’exemple','Enregistrer le solde reçu','Afficher le paiement partiel','reste à encaisser','payée · démarche officielle à terminer']
  },
  es: {
    common:['Volver a los recorridos','Probar este recorrido','El siguiente paso es tuyo','Abrir la función','Ejemplo, no tus datos','Ver el resultado antes de la promesa'],
    split:['Indica quién pagó. Varias personas pueden adelantar importes distintos.','El total cuadra al céntimo. Revisa tu parte antes de invitar.','El grupo ve la disputa; el gasto queda fuera del saldo hasta que se resuelva.','Reembolsos a Ana','Resolver el taxi','Volver a disputar el taxi','disputado · fuera del saldo','resuelto · incluido en el saldo'],
    trips:['Fotografía el recibo o añade el gasto: queda vinculado al viaje.','Antes de entregar el informe, ve qué documento o dato falta.','Exporta al sistema de la empresa; recepción y aprobación son estados distintos.','Recibos vinculados','Adjuntar el recibo pendiente','Mostrar el recibo pendiente','falta un recibo','listo para preparar, aún no recibido'],
    tax:['Factura de ejemplo','Registrar el pago restante','Mostrar el pago parcial','pendiente de cobro','cobrada · falta el trámite oficial']
  },
  nl: {
    common:['Terug naar alle routes','Probeer deze route','De volgende stap is aan jou','Open de functie','Voorbeeld, niet jouw gegevens','Eerst het resultaat, dan de belofte'],
    split:['Vul in wie betaalde. Meerdere mensen kunnen verschillende bedragen voorschieten.','Het totaal klopt tot op de cent. Controleer je deel voor je uitnodigt.','De groep ziet het bezwaar; de uitgave telt pas na oplossing mee in het saldo.','Terug naar Anna','Taxirit oplossen','Taxirit opnieuw betwisten','betwist · buiten het saldo','opgelost · in het saldo'],
    trips:['Fotografeer de bon of voeg een uitgave toe: deze blijft bij de reis.','Zie vóór het indienen welk document of gegeven ontbreekt.','Exporteer naar het bedrijfssysteem; ontvangst en goedkeuring blijven apart.','Bonnen gekoppeld','Ontbrekende bon toevoegen','Ontbrekende bon tonen','bon ontbreekt','klaar om voor te bereiden, nog niet ontvangen'],
    tax:['Voorbeeldfactuur','Resterende betaling vastleggen','Deelbetaling tonen','nog te ontvangen','betaald · officiële stap nog nodig']
  },
  pt: {
    common:['Voltar aos percursos','Experimentar este percurso','O próximo passo é seu','Abrir a função','Exemplo, não são os seus dados','Veja o resultado antes da promessa'],
    split:['Indique quem pagou. Várias pessoas podem adiantar quantias diferentes.','O total fecha até ao cêntimo. Confira a sua parte antes de convidar.','O grupo vê a contestação; a despesa fica fora dos saldos até ser resolvida.','Reembolsos à Ana','Resolver o táxi','Contestar o táxi novamente','contestado · fora dos saldos','resolvido · incluído nos saldos'],
    trips:['Fotografe o recibo ou adicione a despesa: fica ligada à viagem.','Antes de entregar o relatório, veja que documento ou dado falta.','Exporte para o sistema da empresa; receção e aprovação são estados diferentes.','Recibos associados','Juntar o recibo em falta','Mostrar o recibo em falta','falta um recibo','pronto a preparar, ainda não recebido'],
    tax:['Fatura de exemplo','Registar o pagamento restante','Mostrar pagamento parcial','por receber','recebida · passo oficial ainda necessário']
  }
};

export function journeyWords(code, brandName = 'Momentum') {
  const base = code === 'it' ? italian : Object.fromEntries(keys.map((key,index) => [key,lines[code]?.[index]]));
  if (!extra[code] || Object.values(base).some(value => value == null)) throw new Error(`Missing journey locale ${code}`);
  return { ...base, ...extra[code], brandName };
}
