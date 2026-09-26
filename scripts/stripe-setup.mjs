#!/usr/bin/env node
// Crea su Stripe il prodotto e i 4 prezzi di Momentum, IVA INCLUSA
// (tax_behavior: inclusive: il cliente paga esattamente il prezzo mostrato in
// app, l'IVA è scorporata da Stripe Tax). Idempotente: ogni prezzo ha una
// lookup_key; se esiste già non ne crea un altro.
//
// Uso (la chiave resta nell'ambiente, mai nel repo):
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs           # prova, non scrive
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs --apply   # crea
// Alla fine stampa i comandi `wrangler pages secret put` con gli ID da
// impostare sul progetto Cloudflare (STRIPE_PRICE_*), gli stessi nomi letti
// da server/license/worker.js.
//
// Prezzi in euro dal 26/09/2026 (docs/pricing-decision-2026-09-21.md,
// src/core/subscription.js): PRO 3,99/mese o 34,99/anno; PRO Investor
// 6,99/mese o 59,99/anno.

const API = 'https://api.stripe.com/v1';
const key = process.env.STRIPE_SECRET_KEY || '';
const apply = process.argv.includes('--apply');

export const PRICES = [
  { lookup: 'momentum_pro_month', env: 'STRIPE_PRICE_PRO_MONTH', product: 'pro', cents: 399, interval: 'month' },
  { lookup: 'momentum_pro_year', env: 'STRIPE_PRICE_PRO_YEAR', product: 'pro', cents: 3499, interval: 'year' },
  { lookup: 'momentum_investor_month', env: 'STRIPE_PRICE_INVESTOR_MONTH', product: 'investor', cents: 699, interval: 'month' },
  { lookup: 'momentum_investor_year', env: 'STRIPE_PRICE_INVESTOR_YEAR', product: 'investor', cents: 5999, interval: 'year' },
];
const PRODUCTS = {
  pro: { name: 'Momentum PRO', metadata: { tier: 'PRO' } },
  investor: { name: 'Momentum PRO Investor', metadata: { tier: 'PRO_INVESTOR' } },
};

function form(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const name = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(form(v, name));
    else if (Array.isArray(v)) v.forEach((x, i) => out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(x)}`));
    else if (v !== undefined) out.push(`${encodeURIComponent(name)}=${encodeURIComponent(v)}`);
  }
  return out.filter(Boolean).join('&');
}

async function stripe(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message || res.status}`);
  return json;
}

async function main() {
  if (!/^sk_(test|live)_/.test(key) && !/^rk_(test|live)_/.test(key)) {
    console.error('Serve STRIPE_SECRET_KEY nell\'ambiente (sk_test_... per provare).');
    process.exit(1);
  }
  const live = key.includes('_live_');
  console.log(`Modalità ${live ? 'LIVE' : 'test'}${apply ? '' : ' — prova: nessuna scrittura (aggiungi --apply)'}`);

  const esistenti = await stripe('GET', `/prices?active=true&limit=100&${PRICES.map((p, i) => `lookup_keys[${i}]=${p.lookup}`).join('&')}`);
  const perLookup = new Map(esistenti.data.map((p) => [p.lookup_key, p]));
  const prodotti = {};
  const risultato = {};

  for (const p of PRICES) {
    const trovato = perLookup.get(p.lookup);
    if (trovato) {
      const ok = trovato.unit_amount === p.cents && trovato.currency === 'eur' && trovato.tax_behavior === 'inclusive';
      console.log(`${ok ? 'OK   ' : 'DIVERSO'} ${p.lookup} → ${trovato.id} (${trovato.unit_amount} ${trovato.currency}, tax ${trovato.tax_behavior})`);
      if (!ok) console.log('      Un prezzo Stripe non si modifica: creane uno nuovo e sposta la lookup_key (transfer_lookup_key).');
      risultato[p.env] = trovato.id;
      continue;
    }
    if (!apply) { console.log(`MANCA ${p.lookup}: verrebbe creato ${p.cents / 100} € / ${p.interval}, IVA inclusa`); continue; }
    if (!prodotti[p.product]) {
      const cercati = await stripe('GET', `/products/search?query=${encodeURIComponent(`metadata['tier']:'${PRODUCTS[p.product].metadata.tier}'`)}`);
      prodotti[p.product] = cercati.data[0]?.id || (await stripe('POST', '/products', { ...PRODUCTS[p.product], tax_code: 'txcd_10103000' /* software as a service, uso personale */ })).id;
    }
    const nuovo = await stripe('POST', '/prices', {
      product: prodotti[p.product], currency: 'eur', unit_amount: p.cents,
      recurring: { interval: p.interval }, tax_behavior: 'inclusive', lookup_key: p.lookup,
    });
    console.log(`CREATO ${p.lookup} → ${nuovo.id}`);
    risultato[p.env] = nuovo.id;
  }

  const righe = Object.entries(risultato);
  if (righe.length) {
    console.log('\nImposta gli ID sul progetto Cloudflare Pages:');
    for (const [env, id] of righe) console.log(`  printf '%s' '${id}' | npx wrangler pages secret put ${env} --project-name momentum-finance`);
    console.log('  printf true | npx wrangler pages secret put STRIPE_AUTOMATIC_TAX --project-name momentum-finance   # dopo aver attivato Stripe Tax');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
