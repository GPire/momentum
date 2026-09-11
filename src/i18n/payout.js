const languages = ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt'];
export const payoutCopy = {
  owe: ['Ciao{0}, la mia parte è {1}{2}. Come preferisci riceverla?', 'Hi{0}, my share is {1}{2}. How would you like to receive it?', 'Hallo{0}, mein Anteil beträgt {1}{2}. Wie möchtest du ihn erhalten?', 'Bonjour{0}, ma part est de {1}{2}. Comment préférez-vous la recevoir ?', 'Hola{0}, mi parte es {1}{2}. ¿Cómo prefieres recibirla?', 'Hoi{0}, mijn deel is {1}{2}. Hoe wil je het ontvangen?', 'Olá{0}, minha parte é {1}{2}. Como prefere receber?'],
  oweTitle: ['La tua parte, pronta da comunicare', 'Your share, ready to explain', 'Dein Anteil, bereit zum Teilen', 'Votre part, prête à partager', 'Tu parte, lista para compartir', 'Jouw deel, klaar om te delen', 'Sua parte, pronta para compartilhar'],
  recipient: ['Per {0}', 'To {0}', 'An {0}', 'Pour {0}', 'Para {0}', 'Voor {0}', 'Para {0}'],
  request: ['Ciao{0}, la tua parte è {1}{2}.', 'Hi{0}, your share is {1}{2}.', 'Hallo{0}, dein Anteil beträgt {1}{2}.', 'Bonjour{0}, votre part est de {1}{2}.', 'Hola{0}, tu parte es {1}{2}.', 'Hoi{0}, jouw deel is {1}{2}.', 'Olá{0}, sua parte é {1}{2}.'],
  for: [' per {0}', ' for {0}', ' für {0}', ' pour {0}', ' por {0}', ' voor {0}', ' por {0}'],
  bank: ['Puoi pagarmi con un bonifico:', 'You can pay me by bank transfer:', 'Du kannst per Überweisung zahlen:', 'Vous pouvez me payer par virement :', 'Puedes pagarme por transferencia:', 'Je kunt me betalen via overschrijving:', 'Você pode pagar por transferência:'],
  holder: ['Intestato a {0}', 'Account holder: {0}', 'Kontoinhaber: {0}', 'Titulaire : {0}', 'Titular: {0}', 'Rekeninghouder: {0}', 'Titular: {0}'],
  pay: ['Puoi pagarmi qui:', 'You can pay me here:', 'Hier kannst du zahlen:', 'Vous pouvez me payer ici :', 'Puedes pagarme aquí:', 'Je kunt me hier betalen:', 'Você pode pagar aqui:'],
  satispay: ['Puoi pagarmi su Satispay{0}.', 'You can pay me on Satispay{0}.', 'Du kannst mit Satispay zahlen{0}.', 'Vous pouvez me payer sur Satispay{0}.', 'Puedes pagarme por Satispay{0}.', 'Je kunt me betalen via Satispay{0}.', 'Você pode pagar pelo Satispay{0}.'],
  fallback: ['Dimmi come preferisci pagare.', 'Let me know how you prefer to pay.', 'Sag mir, wie du zahlen möchtest.', 'Dites-moi comment vous préférez payer.', 'Dime cómo prefieres pagar.', 'Laat weten hoe je wilt betalen.', 'Diga como prefere pagar.'],
  thanks: ['Grazie!', 'Thank you!', 'Danke!', 'Merci !', '¡Gracias!', 'Bedankt!', 'Obrigado!'],
  signature: ['— conto diviso con Momentum, giusto per tutti', '— split with Momentum, fair for everyone', '— mit Momentum aufgeteilt, fair für alle', '— partagé avec Momentum, équitable pour tous', '— dividido con Momentum, justo para todos', '— verdeeld met Momentum, eerlijk voor iedereen', '— dividido com Momentum, justo para todos'],
  details: ['Vedi la tua parte', 'See your share', 'Deinen Anteil ansehen', 'Voir votre part', 'Ver tu parte', 'Bekijk jouw deel', 'Veja sua parte'],
  title: ['Il rimborso, pronto da chiedere', 'Your repayment request is ready', 'Deine Erstattungsanfrage ist bereit', 'Votre demande est prête', 'Tu solicitud está lista', 'Je betaalverzoek staat klaar', 'Seu pedido está pronto'],
  to: ['Da {0}', 'From {0}', 'Von {0}', 'De {0}', 'De {0}', 'Van {0}', 'De {0}'],
  hint: ['Controlla il messaggio, poi scegli dove inviarlo. Il pagamento avviene nell’app scelta.', 'Review the message, then choose where to send it. Payment happens in the chosen app.', 'Prüfe die Nachricht und wähle eine App zum Senden. Die Zahlung erfolgt in der gewählten App.', 'Vérifiez le message, puis choisissez où l’envoyer. Le paiement se fait dans l’application choisie.', 'Revisa el mensaje y elige dónde enviarlo. El pago se realiza en la app elegida.', 'Controleer het bericht en kies waar je het verstuurt. Betalen gebeurt in de gekozen app.', 'Confira a mensagem e escolha onde enviar. O pagamento acontece no app escolhido.'],
  message: ['Messaggio da inviare', 'Message to send', 'Nachricht zum Senden', 'Message à envoyer', 'Mensaje para enviar', 'Te versturen bericht', 'Mensagem para enviar'],
  copy: ['Copia messaggio', 'Copy message', 'Nachricht kopieren', 'Copier le message', 'Copiar mensaje', 'Bericht kopiëren', 'Copiar mensagem'],
  copied: ['Messaggio copiato.', 'Message copied.', 'Nachricht kopiert.', 'Message copié.', 'Mensaje copiado.', 'Bericht gekopieerd.', 'Mensagem copiada.'],
  copyFailed: ['Copia non disponibile. Seleziona il messaggio e copialo.', 'Copy unavailable. Select the message and copy it.', 'Kopieren nicht verfügbar. Wähle die Nachricht aus und kopiere sie.', 'Copie indisponible. Sélectionnez le message pour le copier.', 'No se puede copiar. Selecciona el mensaje y cópialo.', 'Kopiëren niet beschikbaar. Selecteer en kopieer het bericht.', 'Cópia indisponível. Selecione a mensagem e copie.'],
  other: ['Altre app', 'Other apps', 'Andere Apps', 'Autres applications', 'Otras apps', 'Andere apps', 'Outros apps'],
  open: ['Apri {0}', 'Open {0}', '{0} öffnen', 'Ouvrir {0}', 'Abrir {0}', '{0} openen', 'Abrir {0}'],
  change: ['Cambia come farti pagare', 'Change how you get paid', 'Zahlungsweg ändern', 'Changer le moyen de paiement', 'Cambiar cómo recibir el pago', 'Betaalmethode wijzigen', 'Alterar como receber'],
  back: ['Torna alla divisione', 'Back to the split', 'Zurück zur Aufteilung', 'Retour au partage', 'Volver al reparto', 'Terug naar de verdeling', 'Voltar à divisão'],
  linkInvalid: ['Controlla il link o il nome del profilo di pagamento.', 'Check your payment link or profile name.', 'Prüfe den Zahlungslink oder Profilnamen.', 'Vérifiez le lien ou le nom du profil de paiement.', 'Revisa el enlace o nombre del perfil de pago.', 'Controleer je betaallink of profielnaam.', 'Confira o link ou nome do perfil de pagamento.'],
};
export function tPayout(key, lang = 'it', ...values) {
  const index = languages.indexOf(String(lang).slice(0, 2));
  return (payoutCopy[key]?.[index < 0 ? 1 : index] || key).replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ''));
}
