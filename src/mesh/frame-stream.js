// ============================================================
// FRAME STREAM — un canale affidabile sopra un trasporto a pacchetti piccoli
// ============================================================
// Serve per far parlare la mesh su Bluetooth Low Energy (Android↔iPhone
// offline, senza Wi-Fi né internet — docs/sciame-discovery-2026-09-13.md), e
// domani su qualunque altro trasporto a frame corti (L2CAP, suono). BLE GATT
// consegna pacchetti di al massimo MTU−3 byte, senza ordine garantito fra
// notify consecutive su alcuni stack, e senza dirti se l'altro ha ricevuto.
// Un messaggio della mesh (un CRDT di gruppo spese, un impegno di pairing)
// è più grande di un pacchetto: va spezzato, numerato, riassemblato,
// confermato e, se serve, rispedito.
//
// L'interfaccia esposta è la STESSA di RTCDataChannel — `send(str)`,
// `readyState`, `onmessage`, `close()` — così MeshNode (mesh-signaling.js)
// non sa e non deve sapere se sotto c'è WebRTC o Bluetooth.
//
// Formato del frame (byte):
//   [msgId hi][msgId lo][seq hi][seq lo][flags][payload…]
//   flags: bit0 = ultimo frame del messaggio, bit1 = ACK (nessun payload;
//   seq = ultimo frame contiguo ricevuto).
//
// Onestà: qui non c'è cifratura — è del livello sopra (DTLS per WebRTC; per
// BLE il canale va aperto SOLO dopo pairing-commitment + tre parole, e il
// contenuto cifrato con la chiave concordata, altrimenti si ripete l'errore
// di Bridgefy). Questo modulo garantisce consegna ordinata e completa, non
// segretezza, e lo dice.
//
// Puro: tempo e scheduler iniettabili, nessuna API Bluetooth qui dentro.
'use strict';

export const INTESTAZIONE = 5;
export const MAX_MESSAGGIO = 64 * 1024;   // oltre, si dirotta su hotspot/Wi-Fi: dichiarato nel Centro Fiducia
export const ACK_OGNI = 8;
const FLAG_ULTIMO = 0x01;
const FLAG_ACK = 0x02;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function creaCanaleAFrame({
  mtu = 247,
  inviaFrame,                       // (Uint8Array) => void — il trasporto grezzo (write/notify BLE)
  scheduleFn = (fn, ms) => setTimeout(fn, ms),
  cancelFn = (h) => clearTimeout(h),
  timeoutAckMs = 800,
  tentativiMax = 4,
} = {}) {
  if (typeof inviaFrame !== 'function') throw new Error('creaCanaleAFrame: serve inviaFrame(bytes).');
  const payloadMax = Math.max(1, mtu - 3 - INTESTAZIONE);
  let prossimoMsgId = 1;
  const inUscita = new Map();   // msgId -> { frames, ackFino, tentativi, timer, risolvi, rifiuta }
  const inArrivo = new Map();   // msgId -> { parti: Map(seq -> Uint8Array), ultimoSeq, contiguo }

  const canale = {
    readyState: 'open',
    onmessage: null,
    onerror: null,
    onclose: null,
    bufferedAmount: 0,
    label: 'frame-stream',
  };

  function frame(msgId, seq, flags, payload = new Uint8Array(0)) {
    const f = new Uint8Array(INTESTAZIONE + payload.length);
    f[0] = (msgId >> 8) & 0xff; f[1] = msgId & 0xff;
    f[2] = (seq >> 8) & 0xff; f[3] = seq & 0xff;
    f[4] = flags;
    f.set(payload, INTESTAZIONE);
    return f;
  }

  function spedisciDa(stato, msgId, daSeq) {
    for (let s = daSeq; s < stato.frames.length; s++) inviaFrame(stato.frames[s]);
    armaTimer(stato, msgId);
  }

  function armaTimer(stato, msgId) {
    if (stato.timer) cancelFn(stato.timer);
    stato.timer = scheduleFn(() => {
      stato.timer = null;
      if (!inUscita.has(msgId)) return;
      stato.tentativi += 1;
      if (stato.tentativi > tentativiMax) {
        inUscita.delete(msgId);
        canale.bufferedAmount = Math.max(0, canale.bufferedAmount - stato.byte);
        const err = new Error(`Messaggio ${msgId} non confermato dopo ${tentativiMax} ritrasmissioni: l'altro dispositivo non risponde più.`);
        stato.rifiuta?.(err);
        canale.onerror?.({ error: err, message: err.message });
        return;
      }
      spedisciDa(stato, msgId, stato.ackFino + 1);
    }, timeoutAckMs);
  }

  // Come RTCDataChannel.send, ma restituisce anche una Promise: chi vuole
  // sapere se il messaggio è arrivato può aspettarla; chi non vuole, la ignora.
  canale.send = (dati) => {
    if (canale.readyState !== 'open') throw new Error('Canale chiuso.');
    const byte = typeof dati === 'string' ? enc.encode(dati) : new Uint8Array(dati);
    if (byte.length > MAX_MESSAGGIO) {
      throw new Error(`Messaggio di ${byte.length} byte: sopra i ${MAX_MESSAGGIO} previsti per questo trasporto. Usa Wi-Fi o hotspot.`);
    }
    const msgId = prossimoMsgId; prossimoMsgId = (prossimoMsgId % 0xffff) + 1;
    const frames = [];
    const n = Math.max(1, Math.ceil(byte.length / payloadMax));
    for (let i = 0; i < n; i++) {
      const parte = byte.subarray(i * payloadMax, Math.min(byte.length, (i + 1) * payloadMax));
      frames.push(frame(msgId, i, i === n - 1 ? FLAG_ULTIMO : 0, parte));
    }
    let risolvi, rifiuta;
    const promessa = new Promise((res, rej) => { risolvi = res; rifiuta = rej; });
    promessa.catch(() => {}); // l'errore arriva anche da onerror: nessun "unhandled rejection" per chi ignora la Promise
    const stato = { frames, ackFino: -1, tentativi: 0, timer: null, risolvi, rifiuta, byte: byte.length };
    inUscita.set(msgId, stato);
    canale.bufferedAmount += byte.length;
    spedisciDa(stato, msgId, 0);
    return promessa;
  };

  function consegna(msgId, stato) {
    const pezzi = [];
    let tot = 0;
    for (let s = 0; s <= stato.ultimoSeq; s++) { const p = stato.parti.get(s); pezzi.push(p); tot += p.length; }
    const out = new Uint8Array(tot);
    let off = 0;
    for (const p of pezzi) { out.set(p, off); off += p.length; }
    inArrivo.delete(msgId);
    canale.onmessage?.({ data: dec.decode(out) });
  }

  function mandaAck(msgId, contiguo) {
    inviaFrame(frame(msgId, contiguo < 0 ? 0xffff : contiguo, FLAG_ACK));
  }

  // Da chiamare dal trasporto per ogni pacchetto ricevuto (notify/write BLE).
  canale.ricevi = (bytes) => {
    const f = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (f.length < INTESTAZIONE) return { ok: false, motivo: 'Frame troppo corto.' };
    const msgId = (f[0] << 8) | f[1];
    const seq = (f[2] << 8) | f[3];
    const flags = f[4];

    if (flags & FLAG_ACK) {
      const stato = inUscita.get(msgId);
      if (!stato) return { ok: true, tipo: 'ack-ignoto' };
      const fino = seq === 0xffff ? -1 : seq;
      if (fino > stato.ackFino) stato.ackFino = fino;
      if (stato.ackFino >= stato.frames.length - 1) {
        if (stato.timer) cancelFn(stato.timer);
        inUscita.delete(msgId);
        canale.bufferedAmount = Math.max(0, canale.bufferedAmount - stato.byte);
        stato.risolvi?.(true);
      } else {
        stato.tentativi = 0; // progresso reale: il contatore riparte, non è l'altro che tace
        armaTimer(stato, msgId);
      }
      return { ok: true, tipo: 'ack' };
    }

    let stato = inArrivo.get(msgId);
    if (!stato) { stato = { parti: new Map(), ultimoSeq: -1, contiguo: -1 }; inArrivo.set(msgId, stato); }
    if (!stato.parti.has(seq)) stato.parti.set(seq, f.slice(INTESTAZIONE)); // duplicato: ignorato, mai riassemblato due volte
    if (flags & FLAG_ULTIMO) stato.ultimoSeq = seq;
    while (stato.parti.has(stato.contiguo + 1)) stato.contiguo += 1;

    const completo = stato.ultimoSeq >= 0 && stato.contiguo >= stato.ultimoSeq;
    if (completo || (stato.contiguo + 1) % ACK_OGNI === 0 || seq !== stato.contiguo) mandaAck(msgId, stato.contiguo);
    if (completo) consegna(msgId, stato);
    return { ok: true, tipo: 'dati', completo };
  };

  canale.close = () => {
    if (canale.readyState === 'closed') return;
    canale.readyState = 'closed';
    for (const stato of inUscita.values()) { if (stato.timer) cancelFn(stato.timer); stato.rifiuta?.(new Error('Canale chiuso prima della conferma.')); }
    inUscita.clear(); inArrivo.clear();
    canale.onclose?.();
  };

  canale.payloadMax = payloadMax;
  canale.inSospeso = () => inUscita.size;
  return canale;
}
