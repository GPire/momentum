// ============================================================
// SCARICARE UNA VOLTA SOLA — la memoria che toglie il problema
// ============================================================
// IL LIMITE, misurato: CoinGecko gratuito chiude la porta dopo poche
// richieste ravvicinate. Chiedendo otto monete di fila ne arrivano quattro, e
// un modulo che non se ne accorgesse costruirebbe una correlazione su un
// paniere diverso da quello che l'utente crede di avere.
//
// ── LE TRE VIE SBAGLIATE, e perche' ──
// 1. RALLENTARE E BASTA: due secondi e mezzo fra una moneta e l'altra
//    significa venti secondi di attesa per otto monete, ogni volta. Funziona
//    e nessuno lo aspetta.
// 2. UN PROXY che aggiri il limite: vedrebbe ogni moneta che l'utente guarda.
//    E' la fine della promessa su cui e' costruita l'app, per risparmiare
//    qualche secondo.
// 3. UNA CHIAVE A PAGAMENTO: rimette una dipendenza da qualcuno.
//
// ── LA VIA GIUSTA: non aggirare il limite, smettere di averne bisogno ──
// Un prezzo di ieri non cambia mai piu'. Una volta che i 365 giorni di una
// moneta sono sul dispositivo, l'unica cosa che serve domani sono i giorni
// NUOVI — di solito uno. Il costo crolla da "otto richieste ogni volta" a
// "otto richieste la prima volta, e poi quasi niente".
// E' la stessa idea dei quarant'anni di prezzi giornalieri, applicata a una
// fonte che il browser puo' chiamare da solo: li' si scarica a tempo di
// sviluppo perche' il CORS blocca, qui si scarica una volta e si tiene.
//
// La cache vive nel dispositivo e non contiene NIENTE di personale: sono
// prezzi pubblici, gli stessi per chiunque. E' l'unico tipo di dato che in
// questo progetto puo' essere messo da parte senza porsi domande.
//
// Funzioni PURE tranne `aggiorna`, che parla con la rete.
'use strict';

const GIORNO = 86400000;
// Oltre questa eta' conviene riscaricare tutto invece di cucire: se
// l'archivio ha mesi di buco, la richiesta incrementale non risparmia niente
// e il rischio di allineare male due tratti lontani non vale il guadagno.
export const MAX_GIORNI_PER_CUCIRE = 30;

export function nuovaCache() { return { versione: 1, monete: {}, elenco: null }; }

// ── ANCHE L'ELENCO DELLE MONETE VA IN CACHE, e per un motivo trovato dal vivo ──
// La prima versione teneva i PREZZI ma chiedeva ogni volta alla rete quali
// fossero le prime monete per capitalizzazione. Quella richiesta e' piccola,
// ma conta come tutte le altre nel limite: al secondo giro CoinGecko l'ha
// rifiutata, l'intero ramo cripto e' fallito in silenzio e la domanda "sono
// diversificato sulle cripto?" ha ricevuto la risposta sull'assorbimento
// delle AZIONI. Una risposta di un altro argomento e' peggio di un errore.
// La classifica per capitalizzazione cambia di rado: si tiene per qualche
// giorno, e in cambio il secondo giro non tocca la rete.
export const GIORNI_VALIDITA_ELENCO = 7;

export function elencoValido(cache, { adesso = Date.now() } = {}) {
  const e = cache?.elenco;
  if (!e?.monete?.length || !e.aggiornato) return null;
  const giorni = (adesso - new Date(e.aggiornato).getTime()) / GIORNO;
  return giorni <= GIORNI_VALIDITA_ELENCO ? e.monete : null;
}

export function salvaElenco(cache, monete) {
  return { ...cache, elenco: { monete, aggiornato: new Date().toISOString().slice(0, 10) } };
}

// Quanti giorni mancano fra l'ultimo che abbiamo e oggi. Zero significa che
// non serve chiamare nessuno.
export function giorniMancanti(voce, adesso = Date.now()) {
  if (!voce?.ultimoGiorno) return Infinity;
  const g = Math.floor((adesso - new Date(voce.ultimoGiorno).getTime()) / GIORNO);
  return Math.max(0, g);
}

// Il piano PRIMA di chiamare: quali monete servono davvero e quante
// richieste costeranno. Dichiararlo in anticipo permette di dire all'utente
// "mi servono tre richieste" invece di farlo aspettare al buio.
export function pianoAggiornamento(cache, simboli = [], { adesso = Date.now() } = {}) {
  const daScaricare = [], daCucire = [], gia = [];
  for (const s of simboli) {
    const voce = cache?.monete?.[s];
    const mancanti = giorniMancanti(voce, adesso);
    if (mancanti === Infinity) daScaricare.push(s);
    else if (mancanti === 0) gia.push(s);
    else if (mancanti <= MAX_GIORNI_PER_CUCIRE) daCucire.push({ simbolo: s, giorni: mancanti });
    else daScaricare.push(s);
  }
  return {
    daScaricare, daCucire, gia,
    richieste: daScaricare.length + daCucire.length,
    messaggio: daScaricare.length + daCucire.length === 0
      ? 'Tutto gia' + ' sul dispositivo: nessuna richiesta.'
      : `${daScaricare.length + daCucire.length} richieste: ${daScaricare.length} monete nuove, ${daCucire.length} da aggiornare di pochi giorni, ${gia.length} gia' aggiornate.`,
  };
}

// Unisce i giorni nuovi a quelli gia' salvati. Il punto delicato: i giorni
// che compaiono in ENTRAMBI non si sommano ne' si duplicano — vince il piu'
// recente, perche' una fonte puo' correggere un prezzo provvisorio.
export function cuci(vecchi = [], nuovi = []) {
  const per = new Map();
  for (const p of vecchi) if (p?.data && Number.isFinite(p.prezzo)) per.set(p.data, p.prezzo);
  for (const p of nuovi) if (p?.data && Number.isFinite(p.prezzo)) per.set(p.data, p.prezzo);
  return [...per.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([data, prezzo]) => ({ data, prezzo }));
}

export function salva(cache, simbolo, punti) {
  const c = { ...cache, monete: { ...cache.monete } };
  const uniti = cuci(c.monete[simbolo]?.punti || [], punti);
  c.monete[simbolo] = {
    punti: uniti,
    ultimoGiorno: uniti.length ? uniti[uniti.length - 1].data : null,
    aggiornata: new Date().toISOString().slice(0, 10),
  };
  return c;
}

// I rendimenti da una voce della cache: e' quello che serve ai moduli di
// analisi, e si calcola qui una volta sola.
export function rendimenti(cache, simbolo) {
  const p = cache?.monete?.[simbolo]?.punti || [];
  if (p.length < 2) return null;
  const out = [];
  for (let i = 1; i < p.length; i++) {
    if (p[i - 1].prezzo > 0) out.push(p[i].prezzo / p[i - 1].prezzo - 1);
  }
  return out;
}

// L'eta' del dato piu' vecchio del paniere: va detta, perche' un'analisi su
// prezzi di tre settimane fa non e' un'analisi di adesso.
export function freschezza(cache, simboli = [], { adesso = Date.now() } = {}) {
  const eta = simboli.map((s) => giorniMancanti(cache?.monete?.[s], adesso)).filter((x) => Number.isFinite(x));
  if (!eta.length) return null;
  const peggiore = Math.max(...eta);
  return {
    giorniPeggiore: peggiore,
    fresca: peggiore <= 1,
    messaggio: peggiore <= 1
      ? 'Prezzi aggiornati a ieri o a oggi.'
      : `Il dato piu' vecchio del paniere ha ${peggiore} giorni: non e' una fotografia di adesso.`,
  };
}
