// ============================================================
// TRAGUARDI VISIBILI — cosa Momentum ha davvero imparato, mostrato come
// fatto, mai come punteggio
// ============================================================
// Richiesto esplicitamente: rendere visibile la crescita del modello e
// della mesh, per portare le persone a condividere — seguendo il filtro
// etico già scritto in NEURO_VIRALITY_HYPNOTIC_ENGINE.md (PARTE 6.3): il
// progresso si MOSTRA, non si punisce mai una rottura; ogni traguardo è un
// FATTO VERO leggibile dallo stato reale dell'app, mai un algoritmo che
// ottimizza il tempo passato sull'app. Un traguardo raggiunto resta
// raggiunto per sempre — non esiste un contatore che torna a zero, non
// esiste una "serie" da perdere.
'use strict';

export const TRAGUARDI = [
  {
    id: 'prima_categorizzazione',
    testo: 'Momentum ha il tuo alfabeto di spese',
    sottotesto: (s) => `${s.categorieUsate} categorie riconosciute dalle tue transazioni reali.`,
    raggiunta: (s) => s.categorieUsate >= 5,
  },
  {
    id: 'pattern_settimanale',
    testo: 'Momentum conosce il tuo andamento settimanale',
    sottotesto: (s) => `${s.transazioni} transazioni su ${s.giorniStorico} giorni di storico.`,
    raggiunta: (s) => s.transazioni >= 50 && s.giorniStorico >= 7,
  },
  {
    id: 'causale_trovato',
    testo: 'Momentum vede cause, non solo numeri',
    sottotesto: () => 'Il grafo causale ha trovato almeno un legame reale fra due categorie (co-variazione misurata, non una legge).',
    raggiunta: (s) => s.legamiCausali > 0,
  },
  {
    id: 'sentiment_locale',
    testo: 'Momentum legge le notizie senza mai contattare un server',
    sottotesto: (s) => `${s.sentimentCalcolati} titol${s.sentimentCalcolati === 1 ? 'o classificato' : 'i classificati'} on-device.`,
    raggiunta: (s) => s.sentimentCalcolati >= 1,
  },
  {
    id: 'sentiment_da_mesh',
    testo: 'Un altro tuo dispositivo ti ha appena aiutato',
    sottotesto: () => 'Un peer aveva già calcolato un sentiment che non avevi ancora — te l\'ha passato via mesh, senza server.',
    raggiunta: (s) => s.sentimentRicevutiViaMesh > 0,
  },
  {
    id: 'percentile_settore',
    testo: 'Momentum sa dove sta il tuo titolo nel suo settore',
    sottotesto: () => 'Percentile calcolato su bilanci SEC reali, non stimato.',
    raggiunta: (s) => !!s.percentileSettoreVisto,
  },
  {
    id: 'primo_gruppo_condiviso',
    testo: 'Hai portato qualcuno su Momentum, senza un account',
    sottotesto: () => 'Un gruppo di spese condiviso via link diretto, senza server.',
    raggiunta: (s) => s.gruppiCondivisi > 0,
  },
  {
    id: 'chat_spesa_usata',
    testo: 'Una spesa chiarita accanto ai suoi numeri',
    sottotesto: () => 'La conversazione che cambia i conti, non una che corre a fianco.',
    raggiunta: (s) => !!s.chatSpesaUsata,
  },
];

// Segnali di default: mai `undefined` per un campo mancante, sempre 0/false
// — chi chiama passa solo quello che sa misurare, il resto resta
// onestamente "non ancora raggiunto" invece di rompere il calcolo.
function normalizza(segnali) {
  return {
    categorieUsate: 0, transazioni: 0, giorniStorico: 0, legamiCausali: 0,
    sentimentCalcolati: 0, sentimentRicevutiViaMesh: 0, percentileSettoreVisto: false,
    gruppiCondivisi: 0, chatSpesaUsata: false,
    ...segnali,
  };
}

// Valuta tutti i traguardi rispetto ai segnali reali. `giaMostrati` è
// l'elenco degli id già notificati in passato (persistito dal chiamante):
// serve SOLO a calcolare `nuovi` (da notificare una volta, ora), mai a
// nascondere un traguardo dalla lista completa — un traguardo raggiunto
// resta visibile per sempre in `tutti`, a prescindere da `giaMostrati`.
export function valutaTraguardi(segnali, giaMostrati = []) {
  const s = normalizza(segnali);
  const mostratiSet = new Set(giaMostrati);
  const tutti = TRAGUARDI.map((t) => ({
    id: t.id, testo: t.testo, sottotesto: t.sottotesto(s), raggiunto: !!t.raggiunta(s),
  }));
  const nuovi = tutti.filter((t) => t.raggiunto && !mostratiSet.has(t.id)).map((t) => t.id);
  return { tutti, nuovi, totali: tutti.length, raggiunti: tutti.filter((t) => t.raggiunto).length };
}

// ============================================================
// LIVELLI — gli 8 traguardi raggruppati in 4 tappe, con lo stesso arco
// narrativo già scritto in NEURO_VIRALITY_HYPNOTIC_ENGINE.md (PARTE 4,
// "Bambino → Studente → Maestro → Insegnante") ma con FATTI veri al posto
// di un punteggio: un livello si completa quando ENTRAMBI i suoi traguardi
// sono raggiunti — mai un numero arbitrario, mai un contatore che scende.
// ============================================================
export const LIVELLI = [
  { numero: 1, nome: 'Le basi', sottotitolo: 'Momentum inizia a leggere te e il mercato', ids: ['prima_categorizzazione', 'sentiment_locale'] },
  { numero: 2, nome: 'Il pattern', sottotitolo: 'Momentum capisce il tuo comportamento reale', ids: ['pattern_settimanale', 'causale_trovato'] },
  { numero: 3, nome: 'La rete', sottotitolo: 'Momentum si collega — ai tuoi dispositivi e al mercato', ids: ['sentiment_da_mesh', 'percentile_settore'] },
  { numero: 4, nome: 'Condivisione', sottotitolo: 'Momentum connette te agli altri', ids: ['primo_gruppo_condiviso', 'chat_spesa_usata'] },
];

// Stessa firma di valutaTraguardi, ma raggruppata per livello. `livelloCorrente`
// è il primo livello non ancora completo (o totaleLivelli+1 se sono completi
// tutti — mai un "livello 5" inventato, il chiamante decide come mostrarlo).
// `livelloCompletatoOra` è non-null SOLO nel preciso controllo in cui l'ultimo
// dei suoi 2 traguardi è appena stato raggiunto — un momento, non uno stato.
export function valutaLivelli(segnali, giaMostrati = []) {
  const { tutti, nuovi } = valutaTraguardi(segnali, giaMostrati);
  const byId = Object.fromEntries(tutti.map((t) => [t.id, t]));
  const livelli = LIVELLI.map((l) => {
    const traguardi = l.ids.map((id) => byId[id]);
    const raggiunti = traguardi.filter((t) => t.raggiunto).length;
    return { ...l, traguardi, raggiunti, richiesti: l.ids.length, completo: raggiunti === l.ids.length };
  });
  const idxCorrente = livelli.findIndex((l) => !l.completo);
  const livelloCorrente = idxCorrente === -1 ? livelli.length + 1 : livelli[idxCorrente].numero;
  const completatoOra = livelli.find((l) => l.completo && l.ids.some((id) => nuovi.includes(id)));
  return {
    livelli, livelloCorrente, totaleLivelli: livelli.length,
    tuttoCompleto: idxCorrente === -1,
    nuoviTraguardi: nuovi,
    livelloCompletatoOra: completatoOra ? completatoOra.numero : null,
    nomeLivelloCompletatoOra: completatoOra ? completatoOra.nome : null,
  };
}
