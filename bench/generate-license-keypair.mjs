// ============================================================
// GENERA LA COPPIA DI CHIAVI per firmare le licenze PRO — SI ESEGUE UNA
// VOLA SOLA (o quando si vuole ruotare la chiave), MAI durante il build.
// ============================================================
// Stesso algoritmo già in uso nel progetto per l'identità dei dispositivi
// mesh (src/mesh/device-signing-identity.js): ECDSA P-256/SHA-256 — non un
// algoritmo nuovo scelto per l'occasione, coerenza con quanto già verificato
// funzionare su Web Crypto sia in Node che nel browser.
//
// USO:
//   node bench/generate-license-keypair.mjs
//
// Scrive bench/license-signing-key.json (chiave PRIVATA, .gitignore la
// esclude già — MAI committarla, mai condividerla: chi la possiede può
// emettere licenze PRO valide per chiunque) e stampa a schermo la chiave
// PUBBLICA da incollare in src/core/license.js (quella sì va nel repo,
// serve al client per VERIFICARE una licenza, mai per firmarne una nuova).
'use strict';
import { writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('./license-signing-key.json', import.meta.url);

if (existsSync(OUT)) {
  console.error('bench/license-signing-key.json esiste già — cancellalo a mano prima di rigenerare (ogni licenza già emessa con la chiave vecchia smetterebbe di verificare).');
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
const jwkPriv = await crypto.subtle.exportKey('jwk', pair.privateKey);

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

writeFileSync(OUT, JSON.stringify({ v: 1, privateKeyJwk: jwkPriv, publicKeyRawB64: b64url(rawPub) }, null, 2));

console.log('Chiave privata scritta in bench/license-signing-key.json — NON committarla, NON condividerla.');
console.log('');
console.log('Chiave PUBBLICA — incollala in src/core/license.js (costante LICENSE_PUBLIC_KEY_B64):');
console.log('');
console.log(b64url(rawPub));
