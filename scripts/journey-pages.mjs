import { journeyWords } from './journey-copy.mjs';

export const journeyLocales = ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt'];
export const journeySlugs = { split: 'dividere-spese', trips: 'trasferte', tax: 'partita-iva' };
export const journeyPath = (code, kind) => `/landing/${code === 'it' ? '' : code + '/'}${journeySlugs[kind]}/`;

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const skipCopy = { it:'Vai al contenuto', en:'Skip to content', de:'Zum Inhalt springen', fr:'Aller au contenu', es:'Ir al contenido', nl:'Ga naar inhoud', pt:'Ir para o conteúdo' };

export function renderJourneyLanding(code, kind, brand, revision) {
  if (!journeyLocales.includes(code) || !journeySlugs[kind]) throw new Error('Unsupported journey page');
  const raw = journeyWords(code, brand.name);
  const t = value => escape(String(value ?? '').replaceAll('Momentum', brand.name));
  const w = Object.fromEntries(Object.entries(raw).map(([key,value]) => [key, Array.isArray(value) ? value.map(t) : t(value)]));
  const steps = kind === 'split' ? w.split.slice(0,3) : kind === 'trips' ? w.trips.slice(0,3) : [w.fiscalDetailOne,w.fiscalDetailTwo,w.fiscalDetailFour];
  const title = kind === 'split' ? w.proofSplitTitle : kind === 'trips' ? w.proofTripTitle : w.fiscalTitle;
  const description = kind === 'split' ? w.proofSplitBody : kind === 'trips' ? w.proofTripBody : w.fiscalBody;
  const eyebrow = kind === 'split' ? w.wayTogetherTitle : kind === 'trips' ? w.wayWorkTitle : w.fiscalEyebrow;
  const path = journeyPath(code, kind), canonical = brand.origin + path;
  const alternates = journeyLocales.map(locale => `<link rel="alternate" hreflang="${locale}" href="${escape(brand.origin + journeyPath(locale,kind))}">`).join('');
  const localeLinks = journeyLocales.map(locale => `<a href="${journeyPath(locale,kind)}" lang="${locale}"${locale === code ? ' aria-current="page"' : ''}>${locale.toUpperCase()}</a>`).join('');
  const appLink = `/?lang=${code}&amp;intent=${kind}`;
  const scene = kind === 'split' ? `
      <div class="journey-demo-head"><span>${w.common[4]}</span><strong>72 €</strong></div>
      <div class="journey-people"><div><span class="journey-avatar">A</span><strong>Anna</strong><b>24 €</b></div><div><span class="journey-avatar">M</span><strong>Marco</strong><b>24 €</b></div><div><span class="journey-avatar">L</span><strong>Lea</strong><b>24 €</b></div></div>
      <div class="journey-demo-result"><span>${w.split[3]}</span><strong>48 €</strong></div>
      <div class="journey-dispute" data-demo-row><span data-label-off="${w.split[6]}" data-label-on="${w.split[7]}">${w.split[6]}</span><button type="button" data-demo-toggle data-label-off="${w.split[4]}" data-label-on="${w.split[5]}" aria-pressed="false">${w.split[4]}</button></div>` : kind === 'trips' ? `
      <div class="journey-demo-head"><span>${w.common[4]}</span><strong>${w.wayWorkTitle}</strong></div>
      <div class="journey-document"><span class="journey-document-icon" aria-hidden="true"></span><span>${w.trips[3]}</span><strong>2 / 3</strong></div>
      <div class="journey-demo-result"><span data-demo-status data-label-off="${w.trips[6]}" data-label-on="${w.trips[7]}">${w.trips[6]}</span><span class="journey-status-dot" aria-hidden="true"></span></div>
      <button type="button" class="journey-demo-action" data-demo-toggle data-label-off="${w.trips[4]}" data-label-on="${w.trips[5]}" aria-pressed="false">${w.trips[4]}</button>` : `
      <div class="journey-demo-head"><span>${w.common[4]}</span><strong>${w.tax[0]}</strong></div>
      <div class="journey-invoice"><span>${w.fiscalStepOne}</span><strong>500 €</strong></div>
      <div class="journey-document"><span>${w.fiscalStepTwo}</span><strong data-demo-paid>200 €</strong></div>
      <div class="journey-demo-result"><span data-demo-status data-label-off="${w.tax[3]}" data-label-on="${w.tax[4]}">${w.tax[3]}</span><strong data-demo-remaining>300 €</strong></div>
      <button type="button" class="journey-demo-action" data-demo-toggle data-label-off="${w.tax[1]}" data-label-on="${w.tax[2]}" aria-pressed="false">${w.tax[1]}</button>`;
  const schema = { '@context':'https://schema.org', '@type':'WebPage', name:title.replace(/&[^;]+;/g,' '), url:canonical, inLanguage:code, description:description.replace(/&[^;]+;/g,' ') };
  return `<!doctype html>
<html lang="${code}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#080b18">
<title>${title} | ${t(brand.name)}</title><meta name="description" content="${description}"><link rel="canonical" href="${escape(canonical)}">${alternates}<link rel="alternate" hreflang="x-default" href="${escape(brand.origin + journeyPath('it',kind))}">
<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(brand.origin)}/landing/orbit-social.png"><link rel="icon" href="/icons/favicon-32.png" sizes="32x32"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/landing/journey.css?v=${revision}"><script type="module" src="/landing/journey.js?v=${revision}"></script><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head>
<body data-journey="${kind}"><a class="journey-skip" href="#journey-main">${skipCopy[code]}</a><header class="journey-nav"><a class="journey-brand" href="/landing/${code === 'it' ? '' : code + '/'}"><span class="journey-brand-orb" aria-hidden="true"></span>${t(brand.wordmark)}<b>.</b></a><nav aria-label="Language">${localeLinks}</nav><a class="journey-nav-cta" href="${appLink}">${w.common[3]}</a></header>
<main id="journey-main"><section class="journey-hero"><div class="journey-stars" aria-hidden="true"></div><div class="journey-shell journey-hero-grid"><div class="journey-hero-copy"><p class="journey-eyebrow">${eyebrow}</p><h1>${title}</h1><p class="journey-lead">${description}</p><div class="journey-hero-actions"><a class="journey-button" href="${appLink}">${w.common[1]}<span aria-hidden="true">↗</span></a><a class="journey-text-link" href="#journey-steps">${w.scrollDiscover}</a></div></div><div class="journey-visual" data-scene><div class="journey-orbit" aria-hidden="true"><i></i><i></i></div><div class="journey-demo" data-journey-demo>${scene}<p class="journey-demo-foot">${w.common[4]}</p></div></div></div></section>
<section id="journey-steps" class="journey-steps journey-shell" aria-labelledby="journey-steps-title"><p class="journey-eyebrow" data-reveal>${w.common[5]}</p><h2 id="journey-steps-title" data-reveal>${kind === 'split' ? w.wayTogetherTitle : kind === 'trips' ? w.wayWorkTitle : w.fiscalStepOne}</h2><div class="journey-step-grid">${steps.map((step,index) => `<article class="journey-step" data-reveal><span>0${index + 1}</span><p>${step}</p></article>`).join('')}</div></section>
<section class="journey-final journey-shell" data-reveal><div><p class="journey-eyebrow">${w.common[2]}</p><h2>${title}</h2>${kind === 'tax' ? `<p>${w.fiscalLimit}</p>` : kind === 'trips' ? `<p>${w.trips[2]}</p>` : `<p>${w.split[2]}</p>`}</div><a class="journey-button" href="${appLink}">${w.common[3]}<span aria-hidden="true">↗</span></a></section></main>
<footer class="journey-footer journey-shell"><a href="/landing/${code === 'it' ? '' : code + '/'}">${w.common[0]}</a><nav aria-label="Features">${Object.entries(journeySlugs).map(([other]) => `<a href="${journeyPath(code,other)}">${other === 'split' ? w.wayTogetherTitle : other === 'trips' ? w.wayWorkTitle : w.fiscalEyebrow}</a>`).join('')}</nav><div><a href="/privacy.html?lang=${code}">${w.privacy}</a><a href="/termini.html?lang=${code}">${w.terms}</a></div></footer></body></html>`;
}
