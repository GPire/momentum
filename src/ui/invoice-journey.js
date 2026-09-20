const words = {
  it: ['La fattura','I tuoi dati','Riepilogo','Continua','Indietro','Cliente, importo e descrizione.','I dati che compariranno sulla fattura.','Controlla il riepilogo e scegli il documento.','Inserisci un importo per vedere il riepilogo.'],
  en: ['Invoice','Your details','Review','Continue','Back','Client, amount and description.','The details shown on your invoice.','Review the summary and choose your document.','Enter an amount to see the summary.'],
  de: ['Rechnung','Deine Daten','Übersicht','Weiter','Zurück','Kunde, Betrag und Beschreibung.','Die Angaben auf deiner Rechnung.','Prüfe die Übersicht und wähle dein Dokument.','Gib einen Betrag ein, um die Übersicht zu sehen.'],
  fr: ['Facture','Tes coordonnées','Récapitulatif','Continuer','Retour','Client, montant et description.','Les coordonnées figurant sur ta facture.','Vérifie le récapitulatif et choisis le document.','Saisis un montant pour voir le récapitulatif.'],
  es: ['Factura','Tus datos','Resumen','Continuar','Atrás','Cliente, importe y descripción.','Los datos que aparecerán en tu factura.','Revisa el resumen y elige el documento.','Introduce un importe para ver el resumen.'],
  nl: ['Factuur','Jouw gegevens','Overzicht','Verder','Terug','Klant, bedrag en omschrijving.','De gegevens op je factuur.','Controleer het overzicht en kies je document.','Voer een bedrag in om het overzicht te zien.'],
  pt: ['Fatura','Os teus dados','Resumo','Continuar','Voltar','Cliente, valor e descrição.','Os dados que aparecem na tua fatura.','Revê o resumo e escolhe o documento.','Introduz um valor para ver o resumo.'],
};
export const invoiceJourneyCopy = lang => words[lang] || words.en;
const entryWords = {
  it: ['A chi fatturi?','Importo prima delle imposte (€)','Per quale lavoro?','Compila con una frase','Email, ricorrenza e dati fiscali','Es. Studio Rossi','Es. Consulenza'],
  en: ['Who is your client?','Amount before tax (€)','What work is this for?','Fill from a sentence','Email, recurrence and tax details','E.g. Rossi Studio','E.g. Consulting'],
  de: ['Wer ist dein Kunde?','Betrag vor Steuern (€)','Für welche Arbeit?','Mit einem Satz ausfüllen','E-Mail, Wiederholung und Steuerdaten','Z. B. Studio Rossi','Z. B. Beratung'],
  fr: ['Qui est ton client ?','Montant avant taxes (€)','Pour quel travail ?','Remplir avec une phrase','E-mail, récurrence et données fiscales','Ex. Studio Rossi','Ex. Conseil'],
  es: ['¿Quién es tu cliente?','Importe antes de impuestos (€)','¿Por qué trabajo?','Completar con una frase','Email, recurrencia y datos fiscales','Ej. Estudio Rossi','Ej. Consultoría'],
  nl: ['Wie is je klant?','Bedrag vóór belasting (€)','Voor welk werk?','Invullen met een zin','E-mail, herhaling en fiscale gegevens','Bijv. Studio Rossi','Bijv. Advies'],
  pt: ['Quem é o teu cliente?','Valor antes de impostos (€)','Por que trabalho?','Preencher com uma frase','Email, recorrência e dados fiscais','Ex. Estúdio Rossi','Ex. Consultoria'],
};

// Move original nodes: listeners, fiscal IDs, drafts and the export engines survive.
export function mountInvoiceJourney(root, footer, lang) {
  if (!root || !footer) return;
  const copy = invoiceJourneyCopy(lang);
  const profile = root.querySelector(':scope > details');
  const content = root.querySelector('#inv-client')?.closest('[data-invoice-content]');
  const preview = root.querySelector('#inv-preview');
  const guidance = root.querySelector('#inv-guidance');
  if (!profile || !content || !preview) return;
  const entry = entryWords[lang] || entryWords.en;
  const field = id => root.querySelector(id)?.closest('label');
  const essential = document.createElement('section'); essential.className = 'invoice-essential';
  const ids = ['#inv-client','#inv-amount','#inv-desc'];
  ids.forEach((id,i) => {
    const input = root.querySelector(id), label = field(id);
    if (!input || !label) return;
    label.querySelector('.tax-field-caption').textContent = entry[i];
    input.setAttribute('aria-label',entry[i]);
    input.placeholder = i === 0 ? entry[5] : i === 2 ? entry[6] : '0,00';
    label.classList.add(i === 1 ? 'invoice-amount-field' : 'invoice-main-field');
    essential.append(label);
  });
  const details = (title, cls) => {
    const el = document.createElement('details'); el.className = cls;
    const summary = document.createElement('summary'); summary.textContent = title; el.append(summary); return el;
  };
  const composer = details(entry[3],'invoice-sentence');
  const sentenceRow = field('#inv-oneline')?.parentElement;
  if (sentenceRow) composer.append(sentenceRow);
  const extras = details(entry[4],'invoice-options');
  const email = field('#inv-email'), recurring = root.querySelector('#inv-recurring')?.closest('label');
  const regime = root.querySelector('#inv-regime')?.parentElement.parentElement;
  const fiscal = root.querySelector('#inv-client-fiscal');
  for (const node of [email,recurring,regime,fiscal]) if (node) extras.append(node);
  const lines = document.createElement('div'); lines.className = 'invoice-line-items';
  for (const id of ['#inv-extra-voci','#inv-add-voce','#inv-voci-total']) { const node = root.querySelector(id); if (node) lines.append(node); }
  const clients = root.querySelector('#inv-clients');
  content.replaceChildren(essential,lines,composer,extras);
  if (clients) content.append(clients);
  root.addEventListener('invoice-autofilled', () => {
    composer.open = false;
    essential.animate?.([{opacity:.65,transform:'translateY(4px)'},{opacity:1,transform:'none'}], {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220});
    root.querySelector('#inv-client')?.focus({preventScroll:true});
    essential.scrollIntoView({block:'nearest',behavior:'instant'});
  });
  const review = document.createElement('section');
  review.className = 'invoice-review-stage';
  const empty = document.createElement('p'); empty.textContent = copy[8];
  review.append(empty, preview); if (guidance) review.append(guidance);
  root.append(review);
  const panels = [content, profile, review];
  const nav = document.createElement('nav'); nav.className = 'invoice-stage-nav';
  const hint = document.createElement('p'); hint.className = 'invoice-stage-hint'; hint.tabIndex = -1;
  const buttons = copy.slice(0,3).map((title,index) => {
    const button = document.createElement('button'); button.type = 'button';
    const number = document.createElement('span'); number.textContent = String(index + 1); number.setAttribute('aria-hidden','true');
    button.append(number,document.createTextNode(title)); button.addEventListener('click', () => show(index)); nav.append(button); return button;
  });
  root.children[0].after(nav,hint);
  const exports = document.createElement('div'); exports.className = 'invoice-export-actions';
  exports.append(...footer.childNodes); footer.append(exports);
  const actions = document.createElement('div'); actions.className = 'invoice-stage-actions';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'btn-action'; back.textContent = copy[4];
  const next = document.createElement('button'); next.type = 'button'; next.className = 'btn-action btn-primary'; next.textContent = copy[3];
  actions.append(back,next); footer.prepend(actions);
  let step = 0;
  let requestedStep = -1;
  root.addEventListener('invoice-reveal-field', event => {
    const target = root.querySelector(event.detail);
    for (let parent = target?.parentElement; parent && parent !== root; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    requestedStep = panels.findIndex(panel => panel.contains(root.querySelector(event.detail)));
    if (requestedStep >= 0) show(requestedStep, false);
  });
  function show(index, focus = true) {
    step = Math.max(0,Math.min(2,index));
    panels.forEach((panel,i) => { panel.hidden = i !== step; });
    if (step === 1) profile.open = true;
    buttons.forEach((button,i) => { if (i === step) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current'); });
    hint.textContent = copy[5 + step]; back.disabled = step === 0;
    next.hidden = step === 2; exports.hidden = step !== 2;
    empty.hidden = !preview.classList.contains('hidden');
    if (focus) { hint.focus({preventScroll:true}); hint.scrollIntoView({block:'nearest',behavior:'instant'}); }
  }
  back.addEventListener('click', () => show(step - 1)); next.addEventListener('click', () => show(step + 1));
  // Existing validators focus missing fields. Reveal first, then bring that section
  // into view; never leave an invalid field inside a hidden wizard step.
  exports.addEventListener('click', event => {
    if (!event.target.closest('#inv-xml,#inv-generate,#inv-email-send,#inv-request-pay')) return;
    requestedStep = -1;
    panels.forEach(panel => { panel.hidden = false; });
    profile.open = true;
    setTimeout(() => {
      if (!root.isConnected) return;
      const active = document.activeElement;
      const index = panels.findIndex(panel => panel.contains(active));
      show(requestedStep >= 0 ? requestedStep : index >= 0 ? index : 2, false);
      if (index >= 0) active.scrollIntoView({block:'center',behavior:'instant'});
    }, 0);
  }, true);
  show(0, false);
}
