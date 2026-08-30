// ============================================================
// EMETTE UNA LICENZA PRO firmata — si esegue A MANO dal computer dello
// sviluppatore dopo un pagamento reale (Stripe/App Store/Play Store),
// MAI da un server pubblico: non esiste un server di licensing in questo
// progetto, per scelta (vedi src/core/license.js).
// ============================================================
// USO:
//   node bench/issue-license.mjs --tier=PRO --days=365
//   node bench/issue-license.mjs --tier=PRO_INVESTOR            (senza --days = a vita)
//
// Richiede bench/license-signing-key.json (generato una volta con
// bench/generate-license-keypair.mjs, mai committato).
'use strict';
import { readFileSync } from 'node:fs';

const TIERS = ['PRO', 'PRO_INVESTOR'];

function argv(nome) {
  const p = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return p ? p.slice(nome.length + 3) : null;
}

const tier = argv('tier');
if (!TIERS.includes(tier)) {
  console.error(`--tier obbligatorio, uno tra: ${TIERS.join(', ')}`);
  process.exit(1);
}
const giorni = argv('days') ? Number(argv('days')) : null;
if (argv('days') && (!Number.isFinite(giorni) || giorni <= 0)) {
  console.error('--days deve essere un numero positivo (giorni di validità), oppure ometterlo per una licenza a vita.');
  process.exit(1);
}

let keyfile;
try {
  keyfile = JSON.parse(readFileSync(new URL('./license-signing-key.json', import.meta.url), 'utf8'));
} catch (e) {
  console.error('bench/license-signing-key.json non trovato — esegui prima: node bench/generate-license-keypair.mjs');
  process.exit(1);
}

const privateKey = await crypto.subtle.importKey('jwk', keyfile.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const payload = {
  tier,
  iat: Date.now(),
  exp: giorni ? Date.now() + giorni * 86_400_000 : null,
};
const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, payloadBytes);

const licenseKey = `${b64url(payloadBytes)}.${b64url(sig)}`;

console.log('Licenza generata — incollala nel campo "Codice di attivazione" in Momentum Vault:');
console.log('');
console.log(licenseKey);
console.log('');
console.log(`Tier: ${payload.tier} · Scadenza: ${payload.exp ? new Date(payload.exp).toISOString().slice(0, 10) : 'nessuna (a vita)'}`);
