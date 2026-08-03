import test from 'node:test';
import assert from 'node:assert/strict';
const { packShare, unpackShare, extractShareCode, slugify, buildInviteUrl, canCompress, CODE_V1, CODE_V2 } = await import('./invite-codec.js');
const { createGroup, addSharedExpense, encodeGroupInvite } = await import('./split-engine.js');

// Offerta di collegamento diretto realistica: e' cio' che ha fatto esplodere
// la lunghezza del link (SDP + candidati ICE), quindi i test la usano davvero.
function offertaFinta() {
  const base = ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0',
    'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:4ZcD', 'a=ice-pwd:2/1muCWoOi3uLifh0NuRHlPy', 'a=ice-options:trickle',
    'a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:3A:CC:A6:CD:E4:BC:82:CC:6C:0C:9B:CD',
    'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'].join('\r\n');
  const cand = Array.from({ length: 6 }, (_, i) => `a=candidate:${i} 1 udp 2113937151 192.168.1.${10 + i} 5${i}000 typ host generation 0 ufrag 4ZcD network-cost 999`).join('\r\n');
  return { type: 'offer', sdp: `${base}\r\n${cand}\r\n` };
}

test('CODEC: la compressione e la decompressione sono disponibili in questo ambiente', () => {
  assert.ok(canCompress(), 'senza CompressionStream il codec ripiega sul formato lungo');
});

test('CODEC: quello che entra e\' identico a quello che esce', async () => {
  const payload = { id: 'g1', name: 'Cena in pizzeria 🍕', members: [{ id: 'm0', name: 'Io', claimedBy: 'dev-1' }, { id: 'm1', name: 'Marco' }], p2p: offertaFinta() };
  const code = await packShare(payload);
  assert.deepEqual(await unpackShare(code), payload);
});

test('CODEC: l\'invito con collegamento diretto sta sotto i 900 caratteri (il QR torna possibile)', async () => {
  let g = createGroup({ name: 'Cena in pizzeria', members: ['Io', 'Marco', 'Giulia', 'Luca'] });
  for (let i = 0; i < 12; i++) g = addSharedExpense(g, { payer: 'm0', amount: 23.5 + i });
  const payload = { id: g.id, name: g.name, members: g.members, p2p: offertaFinta() };
  const code = await packShare(payload);
  const link = buildInviteUrl({ base: 'https://momentum-app.pages.dev', code, groupName: g.name });
  assert.ok(code.startsWith(CODE_V2), 'un contenuto cosi\' grande deve essere compresso');
  assert.ok(link.length <= 900, `il link deve stare nel QR: ${link.length} caratteri`);
  // Il vecchio formato, per confronto: e' la misura del problema risolto.
  const vecchio = `https://momentum-app.pages.dev/?join=${encodeURIComponent(encodeGroupInvite(g, offertaFinta()))}`;
  assert.ok(link.length < vecchio.length * 0.6, `atteso almeno il 40% in meno (prima ${vecchio.length}, ora ${link.length})`);
});

test('CODEC: i link gia\' mandati alle persone continuano a funzionare (formato vecchio)', async () => {
  let g = createGroup({ name: 'Casa', members: ['Io', 'Ale'] });
  const vecchio = encodeGroupInvite(g); // MSPLIT1, quello che gira oggi nelle chat
  assert.ok(vecchio.startsWith(CODE_V1));
  const letto = await unpackShare(vecchio);
  assert.equal(letto.id, g.id);
  assert.equal(letto.name, 'Casa');
  assert.equal(letto.members.length, 2);
});

test('CODEC: su contenuti minuscoli non si peggiora mai la lunghezza', async () => {
  const code = await packShare({ a: 1 });
  const altro = await packShare({ id: 'x', name: 'Bar', members: [{ id: 'm0', name: 'Io' }] });
  for (const c of [code, altro]) {
    assert.ok(c.startsWith(CODE_V1) || c.startsWith(CODE_V2));
    assert.ok(await unpackShare(c), 'deve restare leggibile qualunque formato scelga');
  }
});

test('CODEC: il codice si riconosce dentro un link intero, da qualunque dominio', async () => {
  const code = await packShare({ id: 'g', name: 'Viaggio', members: [] });
  const casi = [
    code,
    buildInviteUrl({ base: 'https://momentum-app.pages.dev', code, groupName: 'Viaggio' }),
    buildInviteUrl({ base: 'https://un-altro-dominio.example', code, groupName: 'Viaggio' }),
    `Ciao! Ti ho aggiunto a «Viaggio» 🏖️\nTocca qui:\n${buildInviteUrl({ base: 'https://m.app', code, groupName: 'Viaggio' })}`,
    encodeURIComponent(buildInviteUrl({ base: 'https://m.app', code, groupName: 'Viaggio' })),
  ];
  for (const c of casi) {
    const estratto = extractShareCode(c);
    assert.ok(estratto, `non riconosciuto: ${String(c).slice(0, 60)}…`);
    const letto = await unpackShare(estratto);
    assert.equal(letto?.name, 'Viaggio', `contenuto sbagliato per: ${String(c).slice(0, 60)}…`);
  }
});

test('CODEC: un codice storpiato non rompe nulla, restituisce solo null', async () => {
  for (const rotto of ['MSPLIT2.@@@non-valido@@@', 'MSPLIT1:!!!', 'MSPLIT2.', '', null, undefined, 'ciao come stai', 'MSPLIT2.QUlBSUE']) {
    assert.equal(await unpackShare(rotto), null, `doveva essere null: ${rotto}`);
  }
  assert.equal(extractShareCode('nessun codice qui'), null);
});

test('CODEC: un codice troncato a meta\' (link spezzato da WhatsApp) non rompe nulla', async () => {
  const code = await packShare({ id: 'g', name: 'Cena', members: [{ id: 'm0', name: 'Io' }], p2p: offertaFinta() });
  for (const frazione of [0.3, 0.5, 0.7, 0.9]) {
    const troncato = code.slice(0, Math.floor(code.length * frazione));
    const r = await unpackShare(troncato);
    assert.ok(r === null || typeof r === 'object', 'o legge qualcosa di valido o restituisce null, mai un\'eccezione');
  }
});

test('LINK: la parte visibile dice di che gruppo si tratta, i dati stanno dopo il cancelletto', async () => {
  const code = await packShare({ id: 'g', name: 'Cena in pizzeria', members: [{ id: 'm0', name: 'Marco' }, { id: 'm1', name: 'Giulia' }] });
  const link = buildInviteUrl({ base: 'https://momentum-app.pages.dev', code, groupName: 'Cena in pizzeria' });
  const [visibile, frammento] = link.split('#');
  assert.ok(visibile.includes('g=cena-in-pizzeria'), `la parte visibile deve dire cosa e\': ${visibile}`);
  assert.equal(frammento, code, 'tutto il contenuto sta nel fragment');
  // I nomi delle persone non devono MAI comparire nella parte che raggiunge il server.
  assert.ok(!visibile.includes('Marco') && !visibile.includes('Giulia'), 'nessun nome di persona nella parte visibile');
});

test('LINK: si puo\' generare anche muto, senza nome del gruppo nell\'indirizzo', async () => {
  const code = await packShare({ id: 'g', name: 'Divorzio', members: [] });
  const link = buildInviteUrl({ base: 'https://m.app', code, groupName: 'Divorzio', readableName: false });
  assert.ok(!link.includes('divorzio'), 'chi non vuole il nome in chiaro deve poterlo togliere');
  assert.ok(link.includes('#'), 'il contenuto resta nel fragment');
});

test('LINK: nomi di gruppo strani non producono indirizzi rotti', () => {
  assert.equal(slugify('Cena in pizzeria 🍕'), 'cena-in-pizzeria');
  assert.equal(slugify('Perù & Bolívia 2026!'), 'peru-bolivia-2026');
  assert.equal(slugify('   '), '');
  assert.equal(slugify('🍕🍕🍕'), '');
  assert.equal(slugify('a'.repeat(80)).length, 40, 'tagliato a 40 caratteri');
  assert.ok(!slugify('Casa -- Vacanze --').endsWith('-'), 'mai un trattino finale');
});
