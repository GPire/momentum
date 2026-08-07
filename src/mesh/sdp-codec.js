// ============================================================
// CODEC SDP — un invito che sta in un messaggio, non in una pagina
// ============================================================
// Il problema, misurato e non supposto: per collegare due dispositivi
// lontani serve scambiarsi un "invito" WebRTC. Un SDP vero di Chrome è di
// 719 caratteri; compresso con deflate scende a 472. Sono numeri che
// entrano in un QR, ma non in un messaggio letto al telefono, non in un SMS
// comodo, e non in una cosa che una persona incolla senza esitare.
//
// L'osservazione che cambia tutto: quasi tutto l'SDP è STRUTTURA FISSA, che
// entrambi i lati conoscono già perché eseguono la stessa app. Comprimerla
// è sprecato — non va trasmessa affatto. Quello che varia davvero è poco:
//
//   impronta DTLS      32 byte   (l'unica cosa che lega la crittografia)
//   ice-pwd            ~24 byte
//   ice-ufrag          ~4 byte
//   IP + porta          6 byte per candidato
//   ruolo setup         1 byte
//
// Si trasmette SOLO quello e si ricostruisce il resto da un modello. È la
// differenza tra comprimere una lettera e mandare solo le parole che
// cambiano in un modulo prestampato.
//
// I candidati ".local" (mDNS) vengono SCARTATI di proposito: sono nomi
// casuali lunghissimi, e per un dispositivo dall'altra parte del mondo sono
// inutili — non li può risolvere. Tenerli costerebbe 60 caratteri a testa
// per qualcosa che non serve mai al caso d'uso remoto.
//
// LIMITE DICHIARATO: il codec è tarato sull'SDP di un DataChannel. Non è un
// codec SDP generale e non pretende di esserlo: audio/video hanno righe che
// qui non esistono. Se un giorno servissero, il modello va esteso — e il
// numero di versione in testa al payload serve proprio a non confondere due
// formati diversi.
'use strict';

export const SDP_CODEC_VERSION = 1;
const SETUP = ['actpass', 'active', 'passive'];

const b64u = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (str) => {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s.padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')), (c) => c.charCodeAt(0));
};

const line = (sdp, prefisso) => {
  const m = String(sdp).match(new RegExp(`^${prefisso}(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};

// Estrae i candidati utili: solo IPv4 con porta, niente nomi .local.
function estraiCandidati(sdp) {
  const out = [];
  const re = /^a=candidate:\S+ \d+ (udp|tcp) \d+ (\S+) (\d+) typ (\w+)/gim;
  let m;
  while ((m = re.exec(String(sdp)))) {
    const [, proto, host, porta, tipo] = m;
    if (proto.toLowerCase() !== 'udp') continue;         // il DataChannel usa UDP
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) continue;     // scarta .local e IPv6
    out.push({ ip: host, port: Number(porta), tipo });
  }
  // Prima i srflx (indirizzo pubblico: è quello che serve a un peer remoto),
  // poi gli host. Massimo 3: oltre, si allunga il codice senza aggiungere
  // possibilità reali di connessione.
  return out.sort((a, b) => (a.tipo === 'srflx' ? -1 : 1) - (b.tipo === 'srflx' ? -1 : 1)).slice(0, 3);
}

// Comprime un SDP di offerta/risposta in un codice breve.
export function packSdp(sdp) {
  const testo = String(sdp || '');
  const fpRaw = line(testo, 'a=fingerprint:sha-256 ');
  const ufrag = line(testo, 'a=ice-ufrag:');
  const pwd = line(testo, 'a=ice-pwd:');
  if (!fpRaw || !ufrag || !pwd) throw new Error('SDP incompleto: manca impronta o credenziali ICE');

  const fp = fpRaw.split(':').map((h) => parseInt(h, 16));
  if (fp.length !== 32 || fp.some((n) => Number.isNaN(n))) throw new Error('Impronta DTLS non valida');

  const setupTxt = line(testo, 'a=setup:') || 'actpass';
  const candidati = estraiCandidati(testo);
  const uf = new TextEncoder().encode(ufrag);
  const pw = new TextEncoder().encode(pwd);

  const buf = [];
  buf.push(SDP_CODEC_VERSION);
  buf.push(Math.max(0, SETUP.indexOf(setupTxt)));
  buf.push(...fp);
  buf.push(uf.length, ...uf);
  buf.push(pw.length, ...pw);
  buf.push(candidati.length);
  for (const c of candidati) {
    for (const o of c.ip.split('.')) buf.push(Number(o) & 0xff);
    buf.push((c.port >> 8) & 0xff, c.port & 0xff);
  }
  return b64u(Uint8Array.from(buf));
}

// Ricostruisce un SDP valido dal codice breve. `tipo` = 'offer' | 'answer'.
export function unpackSdp(codice, tipo = 'offer') {
  const b = unb64u(codice);
  let i = 0;
  const versione = b[i++];
  if (versione !== SDP_CODEC_VERSION) throw new Error(`Codice di una versione diversa (${versione}): aggiorna l'app`);
  const setupTxt = SETUP[b[i++]] || 'actpass';
  const fp = Array.from(b.slice(i, i + 32)).map((n) => n.toString(16).padStart(2, '0').toUpperCase()).join(':');
  i += 32;
  const ufLen = b[i++]; const ufrag = new TextDecoder().decode(b.slice(i, i + ufLen)); i += ufLen;
  const pwLen = b[i++]; const pwd = new TextDecoder().decode(b.slice(i, i + pwLen)); i += pwLen;
  const nCand = b[i++];

  const candidati = [];
  for (let c = 0; c < nCand; c++) {
    const ip = `${b[i]}.${b[i + 1]}.${b[i + 2]}.${b[i + 3]}`; i += 4;
    const porta = (b[i] << 8) | b[i + 1]; i += 2;
    candidati.push({ ip, porta });
  }

  const primaPorta = candidati[0]?.porta ?? 9;
  const primoIp = candidati[0]?.ip ?? '0.0.0.0';
  const righeCand = candidati
    .map((c, idx) => `a=candidate:${1000 + idx} 1 udp ${1677729535 - idx} ${c.ip} ${c.porta} typ srflx raddr 0.0.0.0 rport 0 generation 0`)
    .join('\r\n');

  return [
    'v=0',
    `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    `m=application ${primaPorta} UDP/DTLS/SCTP webrtc-datachannel`,
    `c=IN IP4 ${primoIp}`,
    ...(righeCand ? [righeCand] : []),
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${setupTxt}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ].join('\r\n');
}

// Quanto si è risparmiato davvero, per poterlo misurare invece di dirlo.
export function packStats(sdp) {
  const originale = String(sdp || '').length;
  const compresso = packSdp(sdp).length;
  return { originale, compresso, rapporto: +(originale / compresso).toFixed(1) };
}
