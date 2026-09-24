const copy = {
  it: 'Alcune divisioni non entrano in questa simulazione: controlla valuta, identità, contestazioni e importi nei gruppi.',
  en: 'Some split expenses are not in this scenario: check currency, identity, disputes and amounts in your groups.',
  de: 'Einige geteilte Ausgaben fehlen in diesem Szenario: Prüfe Währung, Identität, Einsprüche und Beträge in den Gruppen.',
  fr: 'Certaines dépenses partagées sont exclues de ce scénario : vérifiez la devise, l’identité, les contestations et les montants dans vos groupes.',
  es: 'Algunos gastos compartidos no entran en este escenario: revisa divisa, identidad, disputas e importes en tus grupos.',
  nl: 'Sommige gedeelde uitgaven vallen buiten dit scenario: controleer valuta, identiteit, betwistingen en bedragen in je groepen.',
  pt: 'Algumas despesas divididas não entram neste cenário: confirma a moeda, identidade, contestações e valores nos grupos.',
};
export const splitLiabilityNotice = lang => copy[lang] || copy.en;
