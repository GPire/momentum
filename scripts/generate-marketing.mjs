// Static, crawlable marketing pages from the same translations used in-browser.
// Internal vault keys, backup formats and URLs never depend on the display name.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { keys, lines, previews } from '../public/landing/landing-copy.js';
import { journeyWords } from './journey-copy.mjs';
import { renderJourneyLanding, journeyPath, journeyLocales, journeySlugs } from './journey-pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeCodes = ['it', 'en', 'de', 'fr', 'es', 'nl', 'pt'];
const defaultOrigin = 'https://momentum-finance.pages.dev';
const localeTags = { it:'it_IT', en:'en_US', de:'de_DE', fr:'fr_FR', es:'es_ES', nl:'nl_NL', pt:'pt_PT' };
const socialImageAlt = {
  it:'Un pianeta viola luminoso con orbite sottili in un cielo stellato scuro.',
  en:'A luminous violet planet with thin rings against a dark starry sky.',
  de:'Ein leuchtender violetter Planet mit feinen Ringen vor dunklem Sternenhimmel.',
  fr:'Une planète violette lumineuse aux anneaux fins dans un ciel étoilé sombre.',
  es:'Un planeta violeta luminoso con anillos finos sobre un cielo estrellado oscuro.',
  nl:'Een lichtgevende paarse planeet met dunne ringen tegen een donkere sterrenhemel.',
  pt:'Um planeta violeta luminoso com anéis finos num céu estrelado escuro.'
};
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pathFor = code => `/landing/${code === 'it' ? '' : code + '/'}`;

function assertBrand(brand) {
  if (!brand || typeof brand.name !== 'string' || !brand.name.trim() || typeof brand.wordmark !== 'string' || !brand.wordmark.trim() || /[\r\n]/.test(brand.name + brand.wordmark)) throw new Error('A one-line brand name and wordmark are required.');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(brand.origin)) throw new Error('Brand origin must be an HTTPS origin without a path.');
}

function dictionaryFor(code, brand) {
  if (code === 'it') return null;
  const words = lines[code];
  if (!words || words.length !== keys.length) throw new Error(`Incomplete ${code} landing translation.`);
  return Object.fromEntries(keys.map((key, index) => [key, words[index].replaceAll('Momentum',brand.name)]));
}

export function renderLanding(template, code, brand, revision) {
  assertBrand(brand);
  if (!localeCodes.includes(code)) throw new Error(`Unsupported landing locale: ${code}`);
  const route = pathFor(code);
  const canonical = brand.origin + route;
  const dictionary = dictionaryFor(code, brand);
  let html = template.replaceAll('{{ASSET_REV}}', revision)
    .replaceAll(defaultOrigin, brand.origin)
    .replaceAll('Momentum', esc(brand.name))
    .replaceAll('>momentum<span class="brand-point">', `>${esc(brand.wordmark)}<span class="brand-point">`)
    .replace('<html lang="it">', `<html lang="${code}">`)
    .replace('id="current-language">IT<',`id="current-language">${code.toUpperCase()}<`);

  if (dictionary) {
    const translated = new Set();
    html = html.replace(/(<([a-z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi, (match, open, _tag, key, _text, close) => {
      if (!(key in dictionary)) throw new Error(`Missing ${code} copy for ${key}`);
      translated.add(key);
      return open + esc(dictionary[key]) + close;
    });
    html = html.replace(/<[a-z][^>]*\bdata-i18n-aria="([^"]+)"[^>]*>/gi, (tag, key) => {
      if (!(key in dictionary) || !tag.includes('aria-label="')) throw new Error(`Missing ${code} aria copy for ${key}`);
      translated.add(key);
      return tag.replace(/aria-label="[^"]*"/,`aria-label="${esc(dictionary[key])}"`);
    });
    for (const key of keys.slice(2)) {
      if (key !== 'closeMenu' && !translated.has(key)) throw new Error(`Untranslated ${code} landing field: ${key}`);
    }
    const replaceIdText = (id, text) => {
      const pattern = new RegExp(`(<p\\b[^>]*\\bid="${id}"[^>]*>)[^<]*(<\\/p>)`);
      if (!pattern.test(html)) throw new Error(`Missing preview field ${id}`);
      html = html.replace(pattern,(_match,open,close) => open + esc(text) + close);
    };
    for (const [index,field] of ['title','number','label','context'].entries()) replaceIdText(`preview-${field}`,previews[code].today[index]);
    html = html.replace(/(<meta name="description" content=")[^"]*(")/,(_m,a,b) => a + esc(dictionary.pageDescription) + b)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,(_m,a,b) => a + esc(dictionary.pageTitle) + b)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,(_m,a,b) => a + esc(dictionary.pageDescription) + b)
      .replace(/<title>[^<]*<\/title>/,`<title>${esc(dictionary.pageTitle)}</title>`);
  }

  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,(_m,a,b) => a + esc(canonical) + b)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/,(_m,a,b) => a + esc(socialImageAlt[code]) + b)
    .replace(/(<link rel="canonical" href=")[^"]*(")/,(_m,a,b) => a + esc(canonical) + b)
    .replaceAll('/?lang=it',`/?lang=${code}`)
    .replaceAll('href="/privacy.html"',`href="/privacy.html?lang=${code}"`)
    .replaceAll('href="/termini.html"',`href="/termini.html?lang=${code}"`);
  const featureWords = journeyWords(code, brand.name);
  const featureLinks = Object.keys(journeySlugs).map((kind,index) => `<a href="${journeyPath(code,kind)}">${esc(index === 0 ? featureWords.wayTogetherTitle : index === 1 ? featureWords.wayWorkTitle : featureWords.fiscalEyebrow)}</a>`).join('');
  html = html.replace('<nav class="footer-nav" aria-label="Navigazione del sito">', `<nav class="footer-nav" aria-label="Navigazione del sito">${featureLinks}`);

  const alternate = localeCodes.map(other => `  <link rel="alternate" hreflang="${other}" href="${esc(brand.origin + pathFor(other))}">`).join('\n');
  const featureList = ['wayDailyTitle','wayTogetherTitle','wayWorkTitle','wayTaxTitle','wayMarketTitle','wayArchiveTitle']
    .map(key => {
      const value = html.match(new RegExp(`data-i18n="${key}">([^<]+)<`))?.[1];
      if (!value) throw new Error(`Missing landing feature ${key}`);
      return value;
    });
  const schema = {
    '@context':'https://schema.org', '@type':'WebApplication', name:brand.name,
    url:brand.origin + '/', inLanguage:code, applicationCategory:'FinanceApplication',
    operatingSystem:'Any', isAccessibleForFree:true, featureList,
    description:dictionary?.pageDescription || `${brand.name} mette in ordine spese, scadenze e obiettivi.`
  };
  return html.replace('  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:card" content="summary_large_image">\n  <meta property="og:locale" content="${localeTags[code]}">\n${alternate}\n  <link rel="alternate" hreflang="x-default" href="${esc(brand.origin + '/landing/')}">\n  <script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`);
}

export function renderSplitLanding(template, brand, revision, scriptRevision = revision) {
  assertBrand(brand);
  return template.replaceAll('Momentum',esc(brand.name)).replaceAll('{{BRAND}}',esc(brand.name)).replaceAll('{{ORIGIN}}',brand.origin).replaceAll('{{REVISION}}',revision).replaceAll('{{SCRIPT_REVISION}}',scriptRevision);
}

export function renderSitemap(brand, date) {
  assertBrand(brand);
  const urls = [...localeCodes.map(code => brand.origin + pathFor(code)), ...journeyLocales.flatMap(code => Object.keys(journeySlugs).map(kind => brand.origin + journeyPath(code,kind)))]
    .map(url => `  <url><loc>${esc(url)}</loc><lastmod>${date}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderAppBrand(app, brand) {
  assertBrand(brand);
  return app.replace(/(<meta name="description" data-brand-description content=")[^"]*(")/,(_m,a,b) => a + esc(`${brand.name} — finanze personali più chiare, al tuo ritmo.`) + b)
    .replace(/(<meta name="apple-mobile-web-app-title" data-brand-app-title content=")[^"]*(")/,(_m,a,b) => a + esc(brand.name) + b)
    .replace(/<title data-brand-title>[^<]*<\/title>/,`<title data-brand-title>${esc(brand.name)} — Le tue finanze, più chiare</title>`)
    .replace(/<([a-z][\w-]*)([^>]*\bdata-brand-text="(name|vault)"[^>]*)>[^<]*(<\/\1>)/gi,(_m,tag,attrs,key,close) => `<${tag}${attrs}>${esc(key === 'vault' ? `${brand.name} Vault` : brand.name)}${close}`)
    .replace(/(data-brand-aria="name"[^>]*aria-label=")[^"]*(")/g,(_m,a,b) => a + esc(brand.name) + b)
    .replace(/(data-brand-alt="name"[^>]*alt=")[^"]*(")/g,(_m,a,b) => a + esc(brand.name) + b);
}

export function generateMarketing() {
  const brand = JSON.parse(readFileSync(join(root,'config/brand.json'),'utf8'));
  assertBrand(brand);
  const template = readFileSync(join(root,'scripts/templates/landing.html'),'utf8');
  const assetPaths = ['landing.css','landing-motion.css','landing.js','landing-orb.js','landing-copy.js'];
  const revision = createHash('sha256').update(assetPaths.map(name => readFileSync(join(root,'public/landing',name))).join('')).digest('hex').slice(0,12);
  for (const code of localeCodes) {
    const target = join(root,'public','landing',...(code === 'it' ? [] : [code]));
    mkdirSync(target,{recursive:true});
    writeFileSync(join(target,'index.html'),renderLanding(template,code,brand,revision));
  }
  const splitTemplate = readFileSync(join(root,'scripts/templates/split-landing.html'),'utf8');
  const splitRevision = createHash('sha256').update(readFileSync(join(root,'public/landing/split.css'))).digest('hex').slice(0,12);
  const splitScriptRevision = createHash('sha256').update(readFileSync(join(root,'public/landing/split.js'))).digest('hex').slice(0,12);
  const splitTarget = join(root,'public/landing/dividere-spese');
  mkdirSync(splitTarget,{recursive:true});
  writeFileSync(join(splitTarget,'index.html'),renderSplitLanding(splitTemplate,brand,splitRevision,splitScriptRevision));
  const journeyRevision = createHash('sha256').update(readFileSync(join(root,'public/landing/journey.css'))).update(readFileSync(join(root,'public/landing/journey.js'))).digest('hex').slice(0,12);
  for (const code of journeyLocales) for (const kind of Object.keys(journeySlugs)) {
    if (code === 'it' && kind === 'split') continue;
    const target = join(root,'public',journeyPath(code,kind));
    mkdirSync(target,{recursive:true});
    writeFileSync(join(target,'index.html'),renderJourneyLanding(code,kind,brand,journeyRevision));
  }
  writeFileSync(join(root,'public/sitemap.xml'),renderSitemap(brand,new Date().toISOString().slice(0,10)));
  writeFileSync(join(root,'public/robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${brand.origin}/sitemap.xml\n`);
  const manifestTemplate = readFileSync(join(root,'scripts/templates/manifest.json'),'utf8');
  const manifestText = manifestTemplate
    .replace(/^  "name": .+,$/m,`  "name": ${JSON.stringify(`${brand.name} Vault`)},`)
    .replace(/^  "short_name": .+,$/m,`  "short_name": ${JSON.stringify(brand.name)},`)
    .replace(/^  "description": .+,$/m,`  "description": ${JSON.stringify(`Momentum riunisce spese, scadenze e obiettivi. I dati personali partono dal tuo dispositivo; scegli tu se condividerli tra i tuoi dispositivi.`.replaceAll('Momentum',brand.name))},`);
  JSON.parse(manifestText);
  writeFileSync(join(root,'public/manifest.json'),manifestText);
  writeFileSync(join(root,'src/core/brand.js'),`// Generated by scripts/generate-marketing.mjs from config/brand.json.\nexport const BRAND_NAME = ${JSON.stringify(brand.name)};\n`);
  const appPath = join(root,'index.html');
  writeFileSync(appPath,renderAppBrand(readFileSync(appPath,'utf8'),brand));
  writeFileSync(join(root,'public/llms.txt'),`# ${brand.name}\n\n> App web di finanza personale. Pagina pubblica: ${brand.origin}/landing/\n\n## Cosa offre\n- Spese, scadenze e obiettivi in un unico percorso. Budget e importazione sono facoltativi.\n- Voce dove supportata dal dispositivo; importo e categoria sono proposte da controllare prima del salvataggio. I suggerimenti si adattano alle correzioni confermate dall'utente e il modello può dichiarare incertezza. ${brand.origin}/landing/#intelligenza\n- Split gratuito senza account per iniziare: quote e valute; una spesa contestata esce dai saldi finché la contestazione non è risolta. ${brand.origin}/landing/#in-pratica\n- Trasferte: ricevute collegate alle spese, resoconto e file da preparare per l'azienda. Preparare un export non significa che il gestionale l'abbia ricevuto.\n- Partita IVA per Italia, Svizzera e Spagna: fatture, incassi anche parziali, stime e guide ai passaggi ufficiali. Invio e conservazione ufficiali non avvengono automaticamente nell'app. ${brand.origin}/landing/#partita-iva\n- Dati e confronti sugli investimenti con fonti e limiti dichiarati; non è consulenza finanziaria.\n- I movimenti personali partono dal dispositivo; la condivisione fra dispositivi è scelta dall'utente. ${brand.origin}/landing/#controllo\n\n## Pagine nelle sette lingue\n${localeCodes.map(code => `- ${code}: ${brand.origin + pathFor(code)}`).join('\n')}\n\n## Limiti attuali\nIl servizio aziendale cloud e i connettori autenticati richiedono ancora configurazione e collaudo reali. Non presentare i dati di esempio come dati dell'utente.\n`);
  console.log(`Generated ${localeCodes.length} landing locales and brand metadata (${revision}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) generateMarketing();
