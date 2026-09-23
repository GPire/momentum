(() => {
  "use strict";

  const keys = [
    "pageTitle","pageDescription","skip","brandHome","mainNav","navHow","navWays","navQuestions","openApp",
    "chooseLanguage","languages","openMenu","closeMenu","heroEyebrow","heroLineOne","heroLineTwo","heroBody",
    "startFree","seeHow","startBenefits","benefitOne","benefitTwo","benefitThree","previewAria","previewDemo",
    "previewTabs","tabToday","tabTogether","tabTrip","previewFootnote","scrollDiscover","howEyebrow","howTitle",
    "howBody","stepOneTitle","stepOneBody","stepTwoTitle","stepTwoBody","stepThreeTitle","stepThreeBody",
    "waysEyebrow","waysTitle","waysBody","wayDailyTitle","wayDailyBody","wayTogetherTitle","wayTogetherBody",
    "wayWorkTitle","wayWorkBody","wayMarketTitle","wayMarketBody","trustEyebrow","trustTitle","trustBody",
    "trustOneTitle","trustOneBody","trustTwoTitle","trustTwoBody","trustThreeTitle","trustThreeBody","faqEyebrow",
    "faqTitle","faqOneQ","faqOneA","faqTwoQ","faqTwoA","faqThreeQ","faqThreeA","faqFourQ","faqFourA",
    "finalEyebrow","finalTitle","finalBody","footerLine","privacy","terms"
  ];
  const lines = {
    en: [
      "Momentum — Your money, finally clear","Momentum brings expenses, upcoming payments and goals together. Start free, even without importing data.",
      "Skip to content","Momentum, back to top","Main navigation","How it works","For you","Questions","Open Momentum",
      "Choose language","Languages","Open menu","Close menu","A space to find clarity","Your money.","Finally clear.",
      "Expenses, upcoming payments and goals no longer feel scattered. Momentum connects them and shows your next step in simple words.",
      "Start free","See how it works","Getting started","No account to get started","Budget is optional","Start without importing",
      "Demonstration preview of Momentum","PREVIEW · EXAMPLE DATA","Explore features","Today","Together","Work trip",
      "A visual example, not a personal estimate.","Scroll to discover Momentum","The first step","Start where you are.",
      "No complicated setup. Start with one simple thing; the rest takes shape with your data.",
      "Add an expense","Type it or import your transactions. You can also start without importing anything.",
      "See the whole picture","Categories, upcoming payments and goals meet in a view you can understand at a glance.",
      "Choose your next step","Ask what you spent, what's coming and where you could adjust course.",
      "One place, many paths","What matters to you, within reach.","Start with everyday things. Deeper tools are there when you need them.",
      "Every day","See spending, room to spend and upcoming payments before they become surprises.",
      "Together","Split a cost, keep shares clear and follow repayments.",
      "On a work trip","Organize expenses and receipts and prepare a report to hand over.",
      "If you invest","Explore data and compare scenarios, with sources and limits in view.",
      "You stay in control","A space that follows you. Not the other way around.",
      "Momentum helps you see your numbers more clearly without asking you to decide everything on day one.",
      "Budget only if you want one","Set it later, or use Momentum without a budget.",
      "Records on your device","Your personal transactions start here. You can export a copy and choose what to share.",
      "Details when you need them","The simple view guides you; explore deeper tools whenever you like.",
      "Before you start","The right questions.","Do I have to connect my bank account?",
      "No. Add an expense manually or import a statement. You can explore Momentum without importing anything.",
      "Do I need a budget?","No. A budget is your choice, and you can change it later.",
      "Is splitting expenses free?","Yes. Splitting expenses, goals, calendar and everyday tools are in the free plan.",
      "Will Momentum decide where I should invest?","No. It shows data, comparisons and estimates with their limits. Financial decisions remain yours.",
      "Start when you're ready","Clarity starts with one action.","Open Momentum, add an expense or just take a look. The rest can wait.",
      "More clarity, one step at a time.","Privacy","Terms"
    ],
    de: [
      "Momentum — Dein Geld, endlich klar","Momentum bringt Ausgaben, anstehende Zahlungen und Ziele zusammen. Starte kostenlos, auch ohne Datenimport.",
      "Zum Inhalt springen","Momentum, zurück zum Anfang","Hauptnavigation","So funktioniert es","Für dich","Fragen","Momentum öffnen",
      "Sprache wählen","Sprachen","Menü öffnen","Menü schließen","Ein Ort für mehr Klarheit","Dein Geld.","Endlich klar.",
      "Ausgaben, anstehende Zahlungen und Ziele sind keine Einzelteile mehr. Momentum verbindet sie und zeigt dir den nächsten Schritt in einfachen Worten.",
      "Kostenlos starten","So funktioniert es","Für den Einstieg","Zum Start kein Konto nötig","Budget ist freiwillig","Ohne Import starten",
      "Demonstrationsansicht von Momentum","VORSCHAU · BEISPIELDATEN","Funktionen entdecken","Heute","Gemeinsam","Dienstreise",
      "Ein visuelles Beispiel, keine persönliche Schätzung.","Scrollen, um Momentum zu entdecken","Der erste Schritt","Fang dort an, wo du stehst.",
      "Keine komplizierte Einrichtung. Beginne mit einer einfachen Sache; der Rest entsteht mit deinen Daten.",
      "Ausgabe hinzufügen","Schreibe sie auf oder importiere deine Buchungen. Du kannst auch ohne Import starten.",
      "Den Zusammenhang sehen","Kategorien, anstehende Zahlungen und Ziele in einer Ansicht, die du sofort verstehst.",
      "Nächsten Schritt wählen","Frag, was du ausgegeben hast, was ansteht und wo du nachsteuern kannst.",
      "Ein Ort, viele Wege","Was für dich zählt, griffbereit.","Beginne mit dem Alltag. Erweiterte Werkzeuge sind da, wenn du sie brauchst.",
      "Jeden Tag","Sieh Ausgaben, Spielraum und anstehende Zahlungen, bevor sie dich überraschen.",
      "Gemeinsam","Teile eine Ausgabe, behalte Anteile im Blick und verfolge Rückzahlungen.",
      "Auf Dienstreise","Ordne Ausgaben und Belege und bereite eine Abrechnung zur Übergabe vor.",
      "Wenn du investierst","Erkunde Daten und vergleiche Szenarien mit sichtbaren Quellen und Grenzen.",
      "Du behältst die Kontrolle","Ein Ort, der sich dir anpasst. Nicht umgekehrt.",
      "Momentum hilft dir, deine Zahlen besser zu sehen, ohne dass du gleich alles entscheiden musst.",
      "Budget nur, wenn du willst","Lege es später fest oder nutze Momentum ohne Budget.",
      "Daten auf deinem Gerät","Deine persönlichen Buchungen beginnen hier. Du kannst eine Kopie exportieren und selbst entscheiden, was du teilst.",
      "Details, wenn du sie brauchst","Die einfache Ansicht begleitet dich; entdecke weitere Werkzeuge jederzeit.",
      "Vor dem Start","Die richtigen Fragen.","Muss ich mein Bankkonto verbinden?",
      "Nein. Trage eine Ausgabe selbst ein oder importiere einen Kontoauszug. Du kannst Momentum auch ohne Import erkunden.",
      "Brauche ich ein Budget?","Nein. Ein Budget ist deine Entscheidung und lässt sich später ändern.",
      "Ist das Teilen von Ausgaben kostenlos?","Ja. Ausgaben teilen, Ziele, Kalender und Alltagsfunktionen gehören zum kostenlosen Plan.",
      "Entscheidet Momentum, wo ich investieren soll?","Nein. Es zeigt Daten, Vergleiche und Schätzungen mit ihren Grenzen. Finanzentscheidungen triffst du selbst.",
      "Starte, wenn du bereit bist","Klarheit beginnt mit einem Schritt.","Öffne Momentum, füge eine Ausgabe hinzu oder schau dich erst einmal um. Der Rest kann warten.",
      "Mehr Klarheit, Schritt für Schritt.","Datenschutz","Nutzungsbedingungen"
    ],
    fr: [
      "Momentum — Votre argent, enfin clair","Momentum rassemble dépenses, échéances et objectifs. Commencez gratuitement, même sans importer de données.",
      "Aller au contenu","Momentum, retour en haut","Navigation principale","Comment ça marche","Pour vous","Questions","Ouvrir Momentum",
      "Choisir la langue","Langues","Ouvrir le menu","Fermer le menu","Un espace pour y voir clair","Votre argent.","Enfin clair.",
      "Dépenses, échéances et objectifs cessent d'être dispersés. Momentum les relie et vous montre la prochaine étape avec des mots simples.",
      "Commencer gratuitement","Voir comment ça marche","Pour commencer","Aucun compte nécessaire au départ","Budget facultatif","Commencer sans importer",
      "Aperçu de démonstration de Momentum","APERÇU · DONNÉES D'EXEMPLE","Découvrir les fonctions","Aujourd'hui","Ensemble","Déplacement",
      "Un exemple visuel, pas une estimation personnelle.","Faire défiler pour découvrir Momentum","La première étape","Commencez là où vous êtes.",
      "Pas de configuration compliquée. Un geste simple d'abord ; le reste prend forme avec vos données.",
      "Ajouter une dépense","Saisissez-la ou importez vos opérations. Vous pouvez aussi commencer sans rien importer.",
      "Voir le lien","Catégories, échéances et objectifs réunis dans une vue compréhensible d'un coup d'œil.",
      "Choisir la suite","Demandez ce que vous avez dépensé, ce qui arrive et où ajuster votre cap.",
      "Un lieu, plusieurs chemins","L'essentiel pour vous, à portée de main.","Commencez par le quotidien. Les outils avancés restent disponibles si besoin.",
      "Au quotidien","Voyez vos dépenses, votre marge et vos échéances avant les surprises.",
      "Ensemble","Partagez une dépense, gardez les parts claires et suivez les remboursements.",
      "En déplacement","Classez dépenses et reçus et préparez un compte rendu à transmettre.",
      "Si vous investissez","Explorez les données et comparez des scénarios, avec sources et limites visibles.",
      "Vous gardez le contrôle","Un espace qui vous suit. Pas l'inverse.",
      "Momentum vous aide à mieux voir vos chiffres sans tout décider dès le premier jour.",
      "Un budget si vous le souhaitez","Définissez-le plus tard ou utilisez Momentum sans budget.",
      "Données sur votre appareil","Vos opérations personnelles commencent ici. Exportez une copie et choisissez ce que vous partagez.",
      "Des détails au bon moment","La vue simple vous guide ; explorez les outils avancés quand vous le voulez.",
      "Avant de commencer","Les bonnes questions.","Dois-je connecter mon compte bancaire ?",
      "Non. Ajoutez une dépense manuellement ou importez un relevé. Vous pouvez explorer Momentum sans rien importer.",
      "Faut-il un budget ?","Non. Le budget est votre choix, modifiable plus tard.",
      "Le partage des dépenses est-il gratuit ?","Oui. Partage des dépenses, objectifs, calendrier et outils du quotidien font partie de l'offre gratuite.",
      "Momentum décide-t-il où investir à ma place ?","Non. Il présente données, comparaisons et estimations avec leurs limites. Les décisions financières restent les vôtres.",
      "Commencez quand vous voulez","La clarté commence par un geste.","Ouvrez Momentum, ajoutez une dépense ou regardez simplement. Le reste peut attendre.",
      "Plus de clarté, un pas après l'autre.","Confidentialité","Conditions"
    ],
    es: [
      "Momentum — Tu dinero, por fin claro","Momentum reúne gastos, próximos pagos y objetivos. Empieza gratis, incluso sin importar datos.",
      "Saltar al contenido","Momentum, volver al inicio","Navegación principal","Cómo funciona","Para ti","Preguntas","Abrir Momentum",
      "Elegir idioma","Idiomas","Abrir menú","Cerrar menú","Un espacio para verlo claro","Tu dinero.","Por fin claro.",
      "Gastos, próximos pagos y objetivos dejan de estar dispersos. Momentum los conecta y te muestra el siguiente paso con palabras sencillas.",
      "Empezar gratis","Ver cómo funciona","Para empezar","Sin cuenta para empezar","Presupuesto opcional","Empezar sin importar",
      "Vista de demostración de Momentum","VISTA PREVIA · DATOS DE EJEMPLO","Explorar funciones","Hoy","En compañía","Viaje de trabajo",
      "Es un ejemplo visual, no una estimación para ti.","Desplázate para descubrir Momentum","El primer paso","Empieza donde estás.",
      "Sin configuración complicada. Empieza por algo sencillo; el resto toma forma con tus datos.",
      "Añade un gasto","Escríbelo o importa tus movimientos. También puedes empezar sin importar nada.",
      "Ve la conexión","Categorías, próximos pagos y objetivos en una vista fácil de entender.",
      "Elige el siguiente paso","Pregunta qué has gastado, qué viene y dónde puedes ajustar el rumbo.",
      "Un lugar, varios caminos","Lo que te importa, a mano.","Empieza por el día a día. Las herramientas avanzadas están ahí cuando las necesites.",
      "Cada día","Ve gastos, margen y próximos pagos antes de que haya sorpresas.",
      "En compañía","Divide un gasto, aclara las partes y sigue los reembolsos.",
      "En un viaje de trabajo","Ordena gastos y recibos y prepara un informe para entregar.",
      "Si inviertes","Explora datos y compara escenarios con fuentes y límites visibles.",
      "Tú tienes el control","Un espacio que se adapta a ti. No al revés.",
      "Momentum te ayuda a entender mejor tus cifras sin pedirte que decidas todo al empezar.",
      "Presupuesto solo si quieres","Defínelo después o usa Momentum sin presupuesto.",
      "Datos en tu dispositivo","Tus movimientos personales empiezan aquí. Puedes exportar una copia y decidir qué compartir.",
      "Detalles cuando los necesites","La vista sencilla te guía; explora más herramientas cuando quieras.",
      "Antes de empezar","Las preguntas adecuadas.","¿Debo conectar mi banco?",
      "No. Añade un gasto a mano o importa un extracto. También puedes explorar Momentum sin importar nada.",
      "¿Necesito un presupuesto?","No. Tú decides si quieres uno y puedes cambiarlo después.",
      "¿Dividir gastos es gratis?","Sí. Dividir gastos, objetivos, calendario y herramientas cotidianas están en el plan gratuito.",
      "¿Momentum decide dónde invertir por mí?","No. Te muestra datos, comparaciones y estimaciones con sus límites. Las decisiones financieras son tuyas.",
      "Empieza cuando quieras","La claridad empieza con un gesto.","Abre Momentum, añade un gasto o simplemente mira cómo funciona. Lo demás puede esperar.",
      "Más claridad, paso a paso.","Privacidad","Términos"
    ],
    nl: [
      "Momentum — Je geld, eindelijk helder","Momentum brengt uitgaven, komende betalingen en doelen samen. Begin gratis, ook zonder gegevens te importeren.",
      "Ga naar inhoud","Momentum, terug naar boven","Hoofdnavigatie","Hoe het werkt","Voor jou","Vragen","Open Momentum",
      "Kies taal","Talen","Open menu","Sluit menu","Een plek voor overzicht","Jouw geld.","Eindelijk helder.",
      "Uitgaven, komende betalingen en doelen staan niet meer los van elkaar. Momentum verbindt ze en laat je volgende stap zien in gewone woorden.",
      "Begin gratis","Bekijk hoe het werkt","Om te beginnen","Geen account nodig om te starten","Budget is optioneel","Start zonder import",
      "Demonstratievoorbeeld van Momentum","VOORBEELD · DEMOGEGEVENS","Ontdek functies","Vandaag","Samen","Zakenreis",
      "Een visueel voorbeeld, geen persoonlijke schatting.","Scroll om Momentum te ontdekken","De eerste stap","Begin waar je bent.",
      "Geen ingewikkelde instelling. Begin met één eenvoudig ding; de rest groeit met je gegevens mee.",
      "Voeg een uitgave toe","Typ hem in of importeer je transacties. Je kunt ook zonder import beginnen.",
      "Zie het verband","Categorieën, komende betalingen en doelen in één overzichtelijke weergave.",
      "Kies je volgende stap","Vraag wat je hebt uitgegeven, wat eraan komt en waar je kunt bijsturen.",
      "Eén plek, meerdere wegen","Wat voor jou telt, binnen handbereik.","Begin bij de dagelijkse dingen. Geavanceerde hulpmiddelen zijn er als je ze nodig hebt.",
      "Elke dag","Zie uitgaven, bestedingsruimte en komende betalingen voordat ze je verrassen.",
      "Samen","Verdeel een uitgave, houd aandelen duidelijk en volg terugbetalingen.",
      "Op zakenreis","Orden uitgaven en bonnetjes en maak een verslag om in te leveren.",
      "Als je belegt","Verken gegevens en vergelijk scenario's, met zichtbare bronnen en beperkingen.",
      "Jij houdt de controle","Een plek die jou volgt. Niet andersom.",
      "Momentum helpt je je cijfers beter te begrijpen zonder dat je meteen alles moet beslissen.",
      "Budget alleen als je wilt","Stel het later in of gebruik Momentum zonder budget.",
      "Gegevens op je apparaat","Je persoonlijke transacties beginnen hier. Exporteer een kopie en kies zelf wat je deelt.",
      "Details wanneer nodig","De eenvoudige weergave helpt je; verdiep je wanneer je wilt.",
      "Voordat je begint","De juiste vragen.","Moet ik mijn bankrekening koppelen?",
      "Nee. Voeg een uitgave zelf toe of importeer een afschrift. Je kunt Momentum ook zonder import verkennen.",
      "Heb ik een budget nodig?","Nee. Een budget is jouw keuze en kun je later wijzigen.",
      "Is uitgaven verdelen gratis?","Ja. Uitgaven verdelen, doelen, kalender en dagelijkse hulpmiddelen zitten in het gratis plan.",
      "Bepaalt Momentum waar ik moet beleggen?","Nee. Je ziet gegevens, vergelijkingen en schattingen met hun beperkingen. Financiële beslissingen blijven van jou.",
      "Begin wanneer je wilt","Helderheid begint met één stap.","Open Momentum, voeg een uitgave toe of kijk eerst rond. De rest kan wachten.",
      "Meer overzicht, stap voor stap.","Privacy","Voorwaarden"
    ],
    pt: [
      "Momentum — O seu dinheiro, finalmente claro","Momentum reúne despesas, próximos pagamentos e objetivos. Comece grátis, mesmo sem importar dados.",
      "Saltar para o conteúdo","Momentum, voltar ao início","Navegação principal","Como funciona","Para si","Perguntas","Abrir Momentum",
      "Escolher idioma","Idiomas","Abrir menu","Fechar menu","Um espaço para ganhar clareza","O seu dinheiro.","Finalmente claro.",
      "Despesas, próximos pagamentos e objetivos deixam de estar dispersos. Momentum liga-os e mostra o próximo passo em palavras simples.",
      "Começar grátis","Ver como funciona","Para começar","Sem conta para começar","Orçamento opcional","Começar sem importar",
      "Pré-visualização de demonstração do Momentum","PRÉ-VISUALIZAÇÃO · DADOS DE EXEMPLO","Explorar funções","Hoje","Em conjunto","Viagem de trabalho",
      "Um exemplo visual, não uma estimativa pessoal.","Deslize para descobrir o Momentum","O primeiro passo","Comece onde está.",
      "Sem configuração complicada. Comece por algo simples; o resto ganha forma com os seus dados.",
      "Adicione uma despesa","Escreva-a ou importe os seus movimentos. Também pode começar sem importar nada.",
      "Veja a ligação","Categorias, próximos pagamentos e objetivos numa vista fácil de compreender.",
      "Escolha o próximo passo","Pergunte quanto gastou, o que se aproxima e onde pode ajustar o rumo.",
      "Um lugar, vários caminhos","O que importa para si, à mão.","Comece pelo dia a dia. As ferramentas avançadas estão disponíveis quando precisar.",
      "Todos os dias","Veja despesas, margem e próximos pagamentos antes de haver surpresas.",
      "Em conjunto","Divida uma despesa, mantenha as quotas claras e acompanhe reembolsos.",
      "Em viagem de trabalho","Organize despesas e recibos e prepare um relatório para entregar.",
      "Se investe","Explore dados e compare cenários, com fontes e limites visíveis.",
      "O controlo é seu","Um espaço que acompanha o seu ritmo. Não o contrário.",
      "Momentum ajuda-o a compreender melhor os seus números sem exigir todas as decisões no primeiro dia.",
      "Orçamento só se quiser","Defina-o mais tarde ou use o Momentum sem orçamento.",
      "Dados no seu dispositivo","Os seus movimentos pessoais começam aqui. Exporte uma cópia e escolha o que partilha.",
      "Detalhes quando precisar","A vista simples orienta-o; explore mais ferramentas quando quiser.",
      "Antes de começar","As perguntas certas.","Tenho de ligar a minha conta bancária?",
      "Não. Adicione uma despesa manualmente ou importe um extrato. Pode explorar o Momentum sem importar nada.",
      "Preciso de um orçamento?","Não. É uma escolha sua e pode alterá-la mais tarde.",
      "Dividir despesas é grátis?","Sim. Divisão de despesas, objetivos, calendário e ferramentas do dia a dia estão no plano gratuito.",
      "O Momentum decide onde devo investir?","Não. Mostra dados, comparações e estimativas com os respetivos limites. As decisões financeiras são suas.",
      "Comece quando quiser","A clareza começa com um gesto.","Abra o Momentum, adicione uma despesa ou veja como funciona. O resto pode esperar.",
      "Mais clareza, um passo de cada vez.","Privacidade","Termos"
    ]
  };
  const previews = {
    it: {
      today:["Il tuo mese, senza sorprese","48,39 €","Disponibili oggi · esempio","Una risposta chiara prima della prossima spesa."],
      together:["Una spesa, quote chiare","3","Persone · esempio","Ognuno vede la sua parte e cosa resta da rimborsare."],
      trip:["Spese di viaggio in ordine","4","Ricevute · esempio","Ritrova le prove di spesa e prepara il resoconto."]
    },
    en: {
      today:["Your month, without surprises","€48.39","Available today · example","A clear answer before your next expense."],
      together:["One cost, clear shares","3","People · example","See each person's share and what remains to be repaid."],
      trip:["Work expenses in order","4","Receipts · example","Find your receipts and prepare your report."]
    },
    de: {
      today:["Dein Monat, ohne Überraschungen","48,39 €","Heute verfügbar · Beispiel","Eine klare Antwort vor der nächsten Ausgabe."],
      together:["Eine Ausgabe, klare Anteile","3","Personen · Beispiel","Sieh jeden Anteil und was noch zurückgezahlt werden muss."],
      trip:["Reisekosten im Blick","4","Belege · Beispiel","Finde deine Belege und bereite die Abrechnung vor."]
    },
    fr: {
      today:["Votre mois, sans surprise","48,39 €","Disponibles aujourd'hui · exemple","Une réponse claire avant la prochaine dépense."],
      together:["Une dépense, des parts claires","3","Personnes · exemple","Voyez la part de chacun et ce qui reste à rembourser."],
      trip:["Frais de déplacement classés","4","Reçus · exemple","Retrouvez vos justificatifs et préparez votre compte rendu."]
    },
    es: {
      today:["Tu mes, sin sorpresas","48,39 €","Disponibles hoy · ejemplo","Una respuesta clara antes del próximo gasto."],
      together:["Un gasto, partes claras","3","Personas · ejemplo","Ve la parte de cada uno y lo que queda por devolver."],
      trip:["Gastos de viaje ordenados","4","Recibos · ejemplo","Encuentra tus recibos y prepara el informe."]
    },
    nl: {
      today:["Je maand, zonder verrassingen","€ 48,39","Vandaag beschikbaar · voorbeeld","Een duidelijk antwoord voor je volgende uitgave."],
      together:["Eén uitgave, duidelijke delen","3","Personen · voorbeeld","Zie ieders deel en wat nog terugbetaald moet worden."],
      trip:["Reiskosten op orde","4","Bonnetjes · voorbeeld","Vind je bonnetjes terug en maak je verslag."]
    },
    pt: {
      today:["O seu mês, sem surpresas","48,39 €","Disponíveis hoje · exemplo","Uma resposta clara antes da próxima despesa."],
      together:["Uma despesa, quotas claras","3","Pessoas · exemplo","Veja a parte de cada pessoa e o que falta reembolsar."],
      trip:["Despesas de viagem organizadas","4","Recibos · exemplo","Encontre os comprovativos e prepare o relatório."]
    }
  };
  const textNodes = [...document.querySelectorAll("[data-i18n]")];
  const ariaNodes = [...document.querySelectorAll("[data-i18n-aria]")];
  const base = {};
  for (const node of textNodes) base[node.dataset.i18n] = node.textContent.trim();
  for (const node of ariaNodes) base[node.dataset.i18nAria] = node.getAttribute("aria-label");
  base.pageTitle = document.title;
  base.pageDescription = document.querySelector('meta[name="description"]').content;
  base.closeMenu = "Chiudi menu";
  const copy = {it:base};
  for (const [language, words] of Object.entries(lines)) {
    if (words.length !== keys.length) throw new Error("Incomplete landing translation: " + language);
    copy[language] = Object.fromEntries(keys.map((key,index) => [key,words[index]]));
  }

  const supported = Object.keys(copy);
  const url = new URL(location.href);
  const requested = (url.searchParams.get("lang") || "").toLowerCase().slice(0,2);
  const browserLanguage = (navigator.languages || [navigator.language || "en"]).map(value => value.slice(0,2).toLowerCase()).find(value => supported.includes(value));
  let language = supported.includes(requested) ? requested : browserLanguage || "en";
  let mode = "today";
  const preview = document.getElementById("product-preview");
  const tabs = [...document.querySelectorAll("[data-preview]")];
  const picker = document.getElementById("language-picker") || document.querySelector(".language-picker");
  const languageButton = document.getElementById("language-trigger");
  const languageMenu = document.getElementById("language-menu");
  const menuButton = document.getElementById("menu-trigger");
  const menu = document.getElementById("site-nav");
  const panel = document.getElementById("preview-panel");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showPreview(nextMode, focus, animate = false) {
    mode = nextMode;
    const details = previews[language][mode];
    ["title","number","label","context"].forEach((field,index) => {
      document.getElementById("preview-" + field).textContent = details[index];
    });
    preview.dataset.mode = mode;
    document.getElementById("preview-panel").setAttribute("aria-labelledby","preview-tab-" + mode);
    for (const tab of tabs) {
      const active = tab.dataset.preview === mode;
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    if (animate && !reducedMotion && panel.animate) {
      panel.animate(
        [{opacity:.55,transform:"translateY(8px)"},{opacity:1,transform:"translateY(0)"}],
        {duration:300,easing:"cubic-bezier(.2,.8,.2,1)"}
      );
    }
  }
  function setLanguage(nextLanguage, updateUrl = false) {
    if (!supported.includes(nextLanguage)) return;
    language = nextLanguage;
    const words = copy[language];
    document.documentElement.lang = language;
    document.title = words.pageTitle;
    document.querySelector('meta[name="description"]').content = words.pageDescription;
    document.querySelector('meta[property="og:title"]').content = words.pageTitle;
    document.querySelector('meta[property="og:description"]').content = words.pageDescription;
    for (const node of textNodes) node.textContent = words[node.dataset.i18n];
    for (const node of ariaNodes) node.setAttribute("aria-label",words[node.dataset.i18nAria]);
    menuButton.setAttribute("aria-label",words[menuButton.getAttribute("aria-expanded") === "true" ? "closeMenu" : "openMenu"]);
    document.getElementById("current-language").textContent = language.toUpperCase();
    for (const choice of languageMenu.querySelectorAll("[data-lang-choice]")) {
      choice.setAttribute("aria-pressed",String(choice.dataset.langChoice === language));
    }
    for (const link of document.querySelectorAll("[data-app-link]")) link.href = "/?lang=" + language;
    for (const link of document.querySelectorAll(".site-footer a[href]")) {
      const destination = new URL(link.href);
      destination.searchParams.set("lang",language);
      link.href = destination.pathname + destination.search;
    }
    showPreview(mode,false);
    if (updateUrl) {
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.set("lang",language);
      history.replaceState(null,"",nextUrl.pathname + nextUrl.search + nextUrl.hash);
    }
  }
  function closeLanguageMenu() {
    languageMenu.hidden = true;
    languageButton.setAttribute("aria-expanded","false");
  }
  function closeNavigation() {
    menu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded","false");
    menuButton.setAttribute("aria-label",copy[language].openMenu);
  }
  languageButton.addEventListener("click",() => {
    const opening = languageMenu.hidden;
    languageMenu.hidden = !opening;
    languageButton.setAttribute("aria-expanded",String(opening));
    if (opening) closeNavigation();
  });
  languageMenu.addEventListener("click",event => {
    const choice = event.target.closest("[data-lang-choice]");
    if (!choice) return;
    setLanguage(choice.dataset.langChoice,true);
    closeLanguageMenu();
    languageButton.focus();
  });
  menuButton.addEventListener("click",() => {
    const opening = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open",opening);
    menuButton.setAttribute("aria-expanded",String(opening));
    menuButton.setAttribute("aria-label",copy[language][opening ? "closeMenu" : "openMenu"]);
    if (opening) closeLanguageMenu();
  });
  menu.addEventListener("click",event => {
    if (event.target.closest("a")) closeNavigation();
  });
  document.addEventListener("click",event => {
    if (!picker.contains(event.target)) closeLanguageMenu();
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) closeNavigation();
  });
  document.addEventListener("keydown",event => {
    if (event.key !== "Escape") return;
    if (!languageMenu.hidden) {closeLanguageMenu();languageButton.focus();}
    if (menu.classList.contains("is-open")) {closeNavigation();menuButton.focus();}
  });
  tabs.forEach((tab,index) => {
    tab.addEventListener("click",() => showPreview(tab.dataset.preview,false,true));
    tab.addEventListener("keydown",event => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      showPreview(tabs[nextIndex].dataset.preview,true,true);
    });
  });
  setLanguage(language);
  if (!reducedMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },{threshold:.08,rootMargin:"0px 0px 40px 0px"});
    document.querySelectorAll(".reveal").forEach(element => observer.observe(element));
    document.documentElement.classList.add("enhanced");
  }
})();
