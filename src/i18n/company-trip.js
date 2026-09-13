const copy={
  it:['Trasferta aziendale','Carico le regole dell’azienda…','Non riesco a verificare le regole. Controlla l’accesso aziendale e riprova.','Regole aziendali: puoi aggiungere un motivo, ma non modificarne i limiti.'],
  en:['Company trip','Loading company rules…','Unable to verify the rules. Check your company access and try again.','Company rules: you can add a reason, but cannot change the limits.'],
  de:['Geschäftsreise','Unternehmensregeln werden geladen…','Regeln konnten nicht geprüft werden. Prüfe deinen Unternehmenszugang und versuche es erneut.','Unternehmensregeln: Du kannst eine Begründung ergänzen, aber keine Limits ändern.'],
  fr:['Déplacement professionnel','Chargement des règles de l’entreprise…','Impossible de vérifier les règles. Vérifiez votre accès et réessayez.','Règles de l’entreprise : vous pouvez ajouter un motif, mais pas modifier les plafonds.'],
  es:['Viaje de empresa','Cargando las reglas de la empresa…','No se pueden verificar las reglas. Comprueba tu acceso y vuelve a intentarlo.','Reglas de empresa: puedes añadir un motivo, pero no cambiar los límites.'],
  nl:['Bedrijfsreis','Bedrijfsregels laden…','Regels niet te verifiëren. Controleer je bedrijfstoegang en probeer opnieuw.','Bedrijfsregels: je kunt een reden toevoegen, maar geen limieten wijzigen.'],
  pt:['Viagem de empresa','A carregar as regras da empresa…','Não foi possível verificar as regras. Verifique o acesso e tente novamente.','Regras da empresa: pode adicionar um motivo, mas não alterar os limites.'],
};
export const companyTripCopy=(lang,key)=>(copy[lang]||copy.en)[key];
