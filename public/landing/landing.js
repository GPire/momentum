(async () => {
  "use strict";

  const revision = encodeURIComponent(new URL(import.meta.url).searchParams.get("v") || "dev");
  const [{ keys, lines, previews }, { createLandingOrb }] = await Promise.all([
    import(`./landing-copy.js?v=${revision}`),
    import(`./landing-orb.js?v=${revision}`)
  ]);

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
  const pathLanguage = url.pathname.match(/^\/landing\/(en|de|fr|es|nl|pt)\//)?.[1];
  const queryLanguage = (url.searchParams.get("lang") || "").toLowerCase().slice(0,2);
  const baseLanguage = url.pathname === "/landing/" || url.pathname === "/landing/index.html" ? "it" : "";
  const requested = pathLanguage || queryLanguage || baseLanguage;
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
  const motionMedia = matchMedia("(prefers-reduced-motion: reduce)");
  const motionControl = document.getElementById("motion-control");
  const motionNames = {
    it:["Attiva animazioni","Riduci animazioni"], en:["Enable motion","Reduce motion"],
    de:["Animationen aktivieren","Animationen reduzieren"], fr:["Activer les animations","Réduire les animations"],
    es:["Activar animaciones","Reducir animaciones"], nl:["Animaties aanzetten","Animaties verminderen"],
    pt:["Ativar animações","Reduzir animações"]
  };
  let motionChoice = "auto";
  try {
    const saved = sessionStorage.getItem("momentum_landing_motion");
    if (saved === "on" || saved === "off") motionChoice = saved;
  } catch {}
  let reducedMotion = motionChoice === "off" || (motionChoice === "auto" && motionMedia.matches);
  function applyMotionChoice() {
    document.documentElement.classList.toggle("motion-override",motionChoice === "on");
    document.documentElement.classList.toggle("motion-paused",motionChoice === "off");
  }
  applyMotionChoice();
  const orb = createLandingOrb(document.getElementById("landing-orb-canvas"));
  orb.setMotion(!reducedMotion);
  const heroVisual = document.querySelector(".hero-visual");
  heroVisual.addEventListener("pointermove",event => {
    if (reducedMotion || event.pointerType === "touch") return;
    const bounds = heroVisual.getBoundingClientRect();
    orb.setTilt((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
  },{passive:true});
  heroVisual.addEventListener("pointerleave",() => orb.setTilt(0,0));

  // Fixed positions are deliberately irregular: no repeating background tile.
  let starSeed = 418793;
  const random = () => ((starSeed = (1664525 * starSeed + 1013904223) >>> 0) / 4294967296);
  const starfield = document.querySelector(".space-field");
  const stars = document.createDocumentFragment();
  for (let index = 0; index < 100; index++) {
    const star = document.createElement("span");
    const depth = random();
    const bright = index % 31 === 0;
    const layer = depth > .78 ? "near" : depth > .35 ? "mid" : "far";
    star.className = "space-star space-star-" + layer + (bright ? " space-star-bright" : "");
    star.style.setProperty("--star-x",(2 + random() * 96).toFixed(2) + "%");
    star.style.setProperty("--star-y",(1 + random() * 97).toFixed(2) + "%");
    star.style.setProperty("--star-size",(bright ? 2 + random() * 1.1 : .48 + depth * 1.8).toFixed(2) + "px");
    star.style.setProperty("--star-alpha",(.18 + depth * .65).toFixed(2));
    star.style.setProperty("--star-duration",(3.6 + random() * 7.1).toFixed(2) + "s");
    star.style.setProperty("--star-delay",(-random() * 8).toFixed(2) + "s");
    star.style.setProperty("--star-drift-x",((random() - .5) * (8 + depth * 13)).toFixed(1) + "px");
    star.style.setProperty("--star-drift-y",((random() - .5) * (6 + depth * 10)).toFixed(1) + "px");
    stars.append(star);
  }
  starfield.append(stars);

  const intelligenceStory = document.querySelector("[data-intelligence-story]");
  const intelligenceSteps = [...intelligenceStory.querySelectorAll("[data-intelligence-step]")];
  const intelligenceVisual = intelligenceStory.querySelector(".intelligence-visual");
  const trustStory = document.querySelector("[data-trust-story]");
  const trustSteps = [...trustStory.querySelectorAll("[data-trust-step]")];
  const faqSection = document.querySelector(".faq-section");
  const faqItems = [...faqSection.querySelectorAll("details")];
  const proofStory = document.querySelector("[data-proof-story]");
  const proofSteps = [...proofStory.querySelectorAll("[data-proof-step]")];
  const fiscalStory = document.querySelector("[data-fiscal-story]");
  const fiscalSteps = [...fiscalStory.querySelectorAll("[data-fiscal-step]")];
  const firstStory = document.querySelector("[data-first-story]");
  const firstSteps = [...firstStory.querySelectorAll("[data-first-step]")];
  const waysStory = document.querySelector("[data-ways-story]");
  const wayCards = [...waysStory.querySelectorAll(".way")];
  const waysScenes = waysStory.querySelector(".ways-stage-scenes");
  for (const card of wayCards) {
    const scene = document.createElement("div");
    scene.className = "ways-stage-scene " + [...card.classList].find(name => name.startsWith("way-"));
    const label = document.createElement("span");
    label.className = "ways-stage-label";
    label.dataset.i18n = card.querySelector("h3").dataset.i18n;
    label.textContent = card.querySelector("h3").textContent;
    textNodes.push(label);
    const number = card.querySelector(".way-number").cloneNode(true);
    number.className = "ways-stage-number";
    scene.append(card.querySelector(".way-icon").cloneNode(true),card.querySelector(".way-signal").cloneNode(true),label,number);
    waysScenes.append(scene);
  }
  const siteHeader = document.querySelector(".site-header");
  const navTargets = [...menu.querySelectorAll('a[href^="#"]')].map(link => ({link,section:document.querySelector(link.getAttribute("href"))}));
  let scrollFrame = 0;
  function updateScrollStory() {
    scrollFrame = 0;
    siteHeader.classList.toggle("is-scrolled",scrollY > 24);
    let currentNav = null;
    for (const target of navTargets) if (target.section?.getBoundingClientRect().top <= innerHeight * .34) currentNav = target.link;
    for (const {link} of navTargets) {
      if (link === currentNav) link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    }
    const heroBounds = heroVisual.getBoundingClientRect();
    if (heroBounds.bottom > 0 && heroBounds.top < innerHeight) {
      const heroProgress = Math.max(0,Math.min(1,-heroBounds.top / Math.max(1,heroBounds.height)));
      heroVisual.style.setProperty("--hero-shift",reducedMotion ? "0px" : (-34 * heroProgress).toFixed(1) + "px");
      heroVisual.style.setProperty("--preview-shift",reducedMotion ? "0px" : (15 * heroProgress).toFixed(1) + "px");
      starfield.style.setProperty("--star-near-shift",(reducedMotion ? 0 : -34 * heroProgress).toFixed(1) + "px");
      starfield.style.setProperty("--star-mid-shift",(reducedMotion ? 0 : -17 * heroProgress).toFixed(1) + "px");
      starfield.style.setProperty("--star-far-shift",(reducedMotion ? 0 : -5 * heroProgress).toFixed(1) + "px");
    }
    const firstBounds = firstStory.getBoundingClientRect();
    if (firstBounds.bottom >= 0 && firstBounds.top <= innerHeight) {
      const progress = Math.max(0,Math.min(1,(innerHeight * .8 - firstBounds.top) / (firstBounds.height + innerHeight * .2)));
      let active = Math.min(firstSteps.length - 1,Math.floor(progress * firstSteps.length));
      if (innerWidth <= 700) {
        const targetY = innerHeight * .55;
        active = firstSteps.reduce((best,step,index) => Math.abs(step.getBoundingClientRect().top + step.getBoundingClientRect().height / 2 - targetY) < Math.abs(firstSteps[best].getBoundingClientRect().top + firstSteps[best].getBoundingClientRect().height / 2 - targetY) ? index : best,0);
      }
      firstStory.dataset.activeStep = String(active);
      firstStory.style.setProperty("--first-progress",(reducedMotion ? 0 : progress).toFixed(3));
      firstSteps.forEach((step,index) => step.classList.toggle("is-active",index === active));
    }
    const waysBounds = waysStory.getBoundingClientRect();
    if (waysBounds.bottom >= 0 && waysBounds.top <= innerHeight) {
      const targetY = innerHeight * .5;
      let nearest = 0;
      let distance = Infinity;
      for (const [index,card] of wayCards.entries()) {
        const cardBounds = card.getBoundingClientRect();
        const candidate = Math.abs(cardBounds.top + cardBounds.height / 2 - targetY);
        if (candidate < distance) { distance = candidate; nearest = index; }
      }
      waysStory.dataset.activeWay = String(nearest);
      wayCards.forEach((card,index) => card.classList.toggle("is-active",index === nearest));
      [...waysScenes.children].forEach((scene,index) => scene.classList.toggle("is-active",index === nearest));
      const waysProgress = Math.max(0,Math.min(1,(innerHeight * .66 - waysBounds.top) / (waysBounds.height + innerHeight * .15)));
      waysStory.style.setProperty("--ways-turn",(reducedMotion ? 0 : waysProgress * 154).toFixed(1) + "deg");
      waysStory.style.setProperty("--ways-front-turn",(reducedMotion ? 0 : waysProgress * -94).toFixed(1) + "deg");
      waysStory.style.setProperty("--ways-core-turn",(reducedMotion ? 0 : waysProgress * 16).toFixed(1) + "deg");
    }
    const bounds = intelligenceStory.getBoundingClientRect();
    if (bounds.bottom >= 0 && bounds.top <= innerHeight) {
      const targetY = innerHeight * (innerWidth <= 700 ? .67 : .5);
      let nearest = 0;
      let distance = Infinity;
      for (const step of intelligenceSteps) {
        const stepBounds = step.getBoundingClientRect();
        const candidate = Math.abs(stepBounds.top + stepBounds.height / 2 - targetY);
        if (candidate < distance) { distance = candidate; nearest = Number(step.dataset.intelligenceStep); }
      }
      intelligenceStory.dataset.activeStep = String(nearest);
      intelligenceSteps.forEach((step,index) => step.classList.toggle("is-active",index === nearest));
      const progress = Math.max(0,Math.min(1,(innerHeight * .75 - bounds.top) / (bounds.height + innerHeight * .2)));
      intelligenceVisual.style.setProperty("--story-angle",(reducedMotion ? 0 : progress * 110).toFixed(1) + "deg");
      intelligenceVisual.style.setProperty("--orbit-angle",(reducedMotion ? 0 : progress * 80).toFixed(1) + "deg");
    }
    const trustBounds = trustStory.getBoundingClientRect();
    if (trustBounds.bottom >= 0 && trustBounds.top <= innerHeight) {
      const targetY = innerHeight * .5;
      let nearest = 0;
      let distance = Infinity;
      for (const step of trustSteps) {
        const stepBounds = step.getBoundingClientRect();
        const candidate = Math.abs(stepBounds.top + stepBounds.height / 2 - targetY);
        if (candidate < distance) { distance = candidate; nearest = Number(step.dataset.trustStep); }
      }
      trustStory.dataset.activeStep = String(nearest);
      trustSteps.forEach((step,index) => step.classList.toggle("is-active",index === nearest));
      const progress = Math.max(0,Math.min(1,(innerHeight * .75 - trustBounds.top) / (trustBounds.height + innerHeight * .2)));
      trustStory.style.setProperty("--trust-turn",(reducedMotion ? 0 : progress * 105).toFixed(1) + "deg");
      trustStory.style.setProperty("--trust-front-turn",(reducedMotion ? 0 : progress * -62).toFixed(1) + "deg");
      trustStory.style.setProperty("--trust-core-turn",(reducedMotion ? 0 : progress * 12).toFixed(1) + "deg");
      trustStory.style.setProperty("--trust-lift",(reducedMotion ? 0 : Math.sin(progress * Math.PI) * -10).toFixed(1) + "px");
    }
    const proofBounds = proofStory.getBoundingClientRect();
    if (proofBounds.bottom >= 0 && proofBounds.top <= innerHeight) {
      const targetY = innerHeight * (innerWidth <= 700 ? .67 : .5);
      let nearest = 0;
      let distance = Infinity;
      for (const step of proofSteps) {
        const stepBounds = step.getBoundingClientRect();
        const candidate = Math.abs(stepBounds.top + stepBounds.height / 2 - targetY);
        if (candidate < distance) { distance = candidate; nearest = Number(step.dataset.proofStep); }
      }
      proofStory.dataset.activeStep = String(nearest);
      proofSteps.forEach((step,index) => step.classList.toggle("is-active",index === nearest));
      const progress = Math.max(0,Math.min(1,(innerHeight * .7 - proofBounds.top) / (proofBounds.height + innerHeight * .2)));
      proofStory.style.setProperty("--proof-turn",(reducedMotion ? 0 : progress * 85).toFixed(1) + "deg");
    }
    const fiscalBounds = fiscalStory.getBoundingClientRect();
    if (fiscalBounds.bottom >= 0 && fiscalBounds.top <= innerHeight) {
      const targetY = innerHeight * (innerWidth <= 700 ? .67 : .5);
      let nearest = 0;
      let distance = Infinity;
      for (const step of fiscalSteps) {
        const stepBounds = step.getBoundingClientRect();
        const candidate = Math.abs(stepBounds.top + stepBounds.height / 2 - targetY);
        if (candidate < distance) { distance = candidate; nearest = Number(step.dataset.fiscalStep); }
      }
      fiscalStory.dataset.activeStep = String(nearest);
      fiscalSteps.forEach((step,index) => step.classList.toggle("is-active",index === nearest));
      const progress = Math.max(0,Math.min(1,(innerHeight * .7 - fiscalBounds.top) / (fiscalBounds.height + innerHeight * .2)));
      fiscalStory.style.setProperty("--fiscal-turn",(reducedMotion ? 0 : progress * 75).toFixed(1) + "deg");
    }
  }
  const queueStoryUpdate = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollStory); };
  window.addEventListener("scroll",queueStoryUpdate,{passive:true});
  window.addEventListener("resize",queueStoryUpdate,{passive:true});
  window.addEventListener("hashchange",queueStoryUpdate);
  window.addEventListener("pageshow",queueStoryUpdate);
  queueStoryUpdate();
  function updateMotionControl() {
    motionControl.hidden = false;
    motionControl.setAttribute("aria-pressed",String(!reducedMotion));
    document.getElementById("motion-control-label").textContent = motionNames[language][reducedMotion ? 0 : 1];
  }

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
      if (choice.dataset.langChoice === language) choice.setAttribute("aria-current","page");
      else choice.removeAttribute("aria-current");
    }
    for (const link of document.querySelectorAll("[data-app-link]")) link.href = "/?lang=" + language;
    for (const link of document.querySelectorAll('a[href^="/privacy"],a[href^="/termini"]')) {
      const destination = new URL(link.href);
      destination.searchParams.set("lang",language);
      link.href = destination.pathname + destination.search;
    }
    showPreview(mode,false);
    updateMotionControl();
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
  window.addEventListener("resize",() => { if (innerWidth > 980 && menu.classList.contains("is-open")) closeNavigation(); },{passive:true});
  languageButton.addEventListener("click",() => {
    const opening = languageMenu.hidden;
    languageMenu.hidden = !opening;
    languageButton.setAttribute("aria-expanded",String(opening));
    if (opening) closeNavigation();
  });
  languageMenu.addEventListener("click",event => {
    const choice = event.target.closest("[data-lang-choice]");
    if (!choice) return;
    event.preventDefault();
    const destination = choice.getAttribute("href") + location.hash;
    if (choice.dataset.langChoice !== language || choice.pathname !== location.pathname) location.assign(destination);
    closeLanguageMenu();
    if (choice.dataset.langChoice === language && choice.pathname === location.pathname) languageButton.focus();
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
  faqItems.forEach((item,index) => item.addEventListener("toggle",() => {
    const active = item.open ? index : faqItems.findIndex(question => question.open);
    faqSection.dataset.activeQuestion = String(active);
  }));
  setLanguage(language);
  let motionStarted = false;
  function startMotion() {
    if (reducedMotion || motionStarted) return;
    motionStarted = true;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },{threshold:.08,rootMargin:"0px 0px 40px 0px"});
      document.querySelectorAll(".reveal").forEach(element => observer.observe(element));
      const sceneObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          entry.target.classList.toggle("scene-active",entry.isIntersecting);
          if (entry.target === heroVisual) orb.setActive(entry.isIntersecting);
        }
      },{rootMargin:"80px 0px"});
      document.querySelectorAll(".hero-visual, .fiscal-visual, .final-section").forEach(element => sceneObserver.observe(element));
    } else {
      document.querySelectorAll(".reveal").forEach(element => element.classList.add("is-visible"));
      document.querySelectorAll(".hero-visual, .fiscal-visual, .final-section").forEach(element => element.classList.add("scene-active"));
    }
    document.documentElement.classList.add("enhanced");
  }
  motionControl.addEventListener("click",() => {
    motionChoice = reducedMotion ? "on" : "off";
    reducedMotion = motionChoice === "off";
    applyMotionChoice();
    orb.setMotion(!reducedMotion);
    queueStoryUpdate();
    try { sessionStorage.setItem("momentum_landing_motion",motionChoice); } catch {}
    updateMotionControl();
    startMotion();
  });
  const syncMotionPreference = () => {
    reducedMotion = motionChoice === "off" || (motionChoice === "auto" && motionMedia.matches);
    orb.setMotion(!reducedMotion);
    queueStoryUpdate();
    updateMotionControl();
    startMotion();
  };
  if (motionMedia.addEventListener) motionMedia.addEventListener("change",syncMotionPreference);
  else if (motionMedia.addListener) motionMedia.addListener(syncMotionPreference);
  startMotion();
})();
