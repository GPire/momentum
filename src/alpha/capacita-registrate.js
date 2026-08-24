// ============================================================
// LE CAPACITÀ ORFANE, RAGGIUNGIBILI — collegate senza toccarle
// ============================================================
// Quattro moduli scritti, testati, e mai chiamati da nessun codice di
// produzione (solo dal proprio test): confronto-titoli.js, titolo-
// causale.js, causale-validita.js, deterioramento.js — 777 righe. Questo
// file NON modifica nessuno dei quattro: li registra nel pianificatore
// (src/ai/pianificatore.js) così una domanda tipizzata (interrogazione.js)
// può raggiungerli.
//
// I DATI CHE USANO, e il loro limite dichiarato. L'unica serie storica
// mensile già nel repo, verificata e senza chiave, copre NOVE SETTORI
// (historical-panel.js: XLB/XLE/XLF/XLI/XLK/XLP/XLU/XLV/XLY, 330 mesi) più
// il "mercato" come loro media equipesata (mercato-vivo.js: mercatoBase()).
// NON copre singoli titoli arbitrari (AAPL, MSFT...): per quelli non esiste
// ancora una fonte di prezzi storici mensili nel repo — `copertura()` qui
// sotto lo dichiara restituendo false, non inventa un numero. Il giorno in
// cui quella fonte esisterà, basterà un'altra capacità registrata: queste
// quattro non cambiano.
'use strict';

import { registra } from '../ai/pianificatore.js';
import { confronta, testoConfronto } from './confronto-titoli.js';
import { analizzaTitolo, testoTitolo } from './titolo-causale.js';
import { valutaValidita } from './causale-validita.js';
import { validaPreavviso, testoPreavviso } from './deterioramento.js';
import { PANNELLO_SETTORI, DATE_PANNELLO } from './historical-panel.js';
import { mercatoBase } from './mercato-vivo.js';

function trovaSettore(id) {
  const q = String(id ?? '').trim().toLowerCase();
  if (!q) return null;
  return PANNELLO_SETTORI.find((s) => s.simbolo.toLowerCase() === q || s.nome.toLowerCase() === q) || null;
}

// confronto-titoli.js vuole { mese: 'YYYY-MM', rendimento } — non l'array
// grezzo che PANNELLO_SETTORI/mercatoBase() restituiscono (titolo-causale.js
// invece prende gli array grezzi direttamente: due moduli, due forme, ed è
// per questo che questo file di collegamento esiste). Le etichette si
// generano dalla data di inizio dichiarata (DATE_PANNELLO[0]), non da una
// seconda copia scritta a mano.
function etichetteMensili(daISO, n) {
  const [anno0, mese0] = daISO.split('-').map(Number);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const assoluto = anno0 * 12 + (mese0 - 1) + i;
    out[i] = `${Math.floor(assoluto / 12)}-${String((assoluto % 12) + 1).padStart(2, '0')}`;
  }
  return out;
}

// Esportata: mercato-qa.js la riusa per la stessa conversione (settore→
// {nome,mensili}) quando applica confronto-titoli.js a un titolo via il
// suo settore SPDR (src/alpha/sic-settore-map.js) — un solo posto dove si
// sa come trasformare un array di rendimenti grezzi in questa forma.
export function comeSerieMensile(valori, nome) {
  const etichette = etichetteMensili(DATE_PANNELLO[0], valori.length);
  return { nome, mensili: valori.map((rendimento, i) => ({ mese: etichette[i], rendimento })) };
}

// Idempotente: chiamarla due volte non duplica (pianificatore.registra
// rifiuta un nome già presente) — chi la richiama non deve sapere se è la
// prima volta. Va chiamata una sola volta all'avvio dell'app (main.js).
export function registraCapacitaCausali() {
  const già = new Set(); // evita l'eccezione "già registrata" su richiami ripetuti
  const registraUnaVolta = (capacita) => {
    if (già.has(capacita.nome)) return;
    già.add(capacita.nome);
    try { registra(capacita); } catch (e) {
      // Già registrata da un richiamo precedente in questo stesso processo
      // (un altro modulo ha chiamato prima): non è un errore da propagare.
      if (!/già registrata/.test(e.message)) throw e;
    }
  };

  registraUnaVolta({
    nome: 'confronto-settori',
    operazioni: ['confronta'],
    misura: 'rendimento',
    copertura: (q) => q.soggetti.length === 2 && q.soggetti.every((s) => s.tipo === 'settore' && trovaSettore(s.id)),
    calcola: (q) => {
      const [a, b] = q.soggetti.map((s) => trovaSettore(s.id));
      const mercato = comeSerieMensile(mercatoBase(), 'mercato').mensili;
      const risultato = confronta(comeSerieMensile(a.r, a.nome), comeSerieMensile(b.r, b.nome), { mercato });
      return { risultato, testo: testoConfronto(risultato), soggetti: [a.nome, b.nome] };
    },
  });

  registraUnaVolta({
    nome: 'causale-settore-mercato',
    operazioni: ['attribuisci'],
    misura: 'causale',
    copertura: (q) => q.soggetti.length === 1 && q.soggetti[0].tipo === 'settore' && !!trovaSettore(q.soggetti[0].id),
    calcola: (q) => {
      const s = trovaSettore(q.soggetti[0].id);
      const risultato = analizzaTitolo(s.r, mercatoBase(), { nome: s.nome, indice: 'il mercato (media dei nove settori)' });
      return { risultato, testo: testoTitolo(risultato) };
    },
  });

  registraUnaVolta({
    nome: 'validita-causale-serie',
    operazioni: ['spiega'],
    misura: 'validita-causale',
    copertura: (q) => q.soggetti.length === 1 && (q.soggetti[0].id === 'mercato' || !!trovaSettore(q.soggetti[0].id)),
    calcola: (q) => {
      const id = q.soggetti[0].id;
      const serie = id === 'mercato' ? mercatoBase() : trovaSettore(id).r;
      const risultato = valutaValidita(serie, { perAnno: 12, relazioniCercate: q.vincoli?.relazioniCercate ?? 1 });
      return { risultato, testo: risultato.messaggio };
    },
  });

  // Nessun soggetto: opera sull'intero archivio SEC incorporato
  // (fondamentali-storici.js, importato da deterioramento.js), sempre
  // disponibile — la copertura è sempre vera per costruzione.
  registraUnaVolta({
    nome: 'deterioramento-contabile',
    operazioni: ['spiega'],
    misura: 'deterioramento',
    copertura: () => true,
    calcola: (q) => {
      const misuraBilancio = q.vincoli?.misuraBilancio || 'roe';
      const risultato = validaPreavviso({ misura: misuraBilancio, orizzonte: q.vincoli?.orizzonte });
      return { risultato, testo: testoPreavviso(risultato) };
    },
  });
}
